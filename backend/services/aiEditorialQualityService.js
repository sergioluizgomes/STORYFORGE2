const textGenerationService = require('./textGenerationService');
const { countWords, evaluateProjectPublishability } = require('./publishabilityService');
const { evaluateQualitySnapshot, toQualityReportResponse } = require('./qualityService');
const { selectNarrativeMethods } = require('./narrativeMethods');
const { safeErrorForLog } = require('../utils/safeLog');

const AI_EDITORIAL_SOURCE = 'ai_editorial';
const MAX_SCENES = 30;
const MAX_SCENE_EXCERPT_CHARS = 700;
const MAX_TOTAL_SCENE_CHARS = 12000;
const MAX_TEXT = {
  short: 160,
  medium: 600,
  long: 1400,
};

const PASS_DEFINITIONS = [
  ['structural_editor', 'Structural Editor'],
  ['character_editor', 'Character Editor'],
  ['scene_editor', 'Scene Editor'],
  ['continuity_editor', 'Continuity Editor'],
  ['voice_and_prose_editor', 'Voice and Prose Editor'],
  ['genre_reader_promise_editor', 'Genre and Reader Promise Editor'],
  ['revision_strategist', 'Revision Strategist'],
];

const SCORE_KEYS = [
  'structureScore',
  'characterScore',
  'sceneScore',
  'continuityScore',
  'voiceScore',
  'genrePromiseScore',
  'bookBriefAlignmentScore',
  'revisionReadinessScore',
];

const TECHNICAL_COMPLIANCE_CODES = new Set([
  'AI_DISCLOSURE_MISSING',
  'HUMAN_REVIEW_NOT_TRACKED',
  'HUMAN_REVIEW_PENDING',
  'QUALITY_AI_DISCLOSURE_MISSING',
  'QUALITY_HUMAN_REVIEW_PENDING',
]);

const MANUSCRIPT_STAGES = new Set([
  'concept',
  'outline',
  'sample',
  'partial_draft',
  'full_draft',
  'revision',
  'final_review',
]);

const AI_EDITORIAL_SCHEMA = {
  type: 'object',
  properties: {
    source: { type: 'string' },
    overallScore: { type: 'number' },
    publishable: { type: 'boolean' },
    summary: { type: 'string' },
    scores: {
      type: 'object',
      properties: Object.fromEntries(SCORE_KEYS.map(key => [key, { type: 'number' }]))
    },
    editorialPasses: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          score: { type: 'number' },
          summary: { type: 'string' },
          findings: { type: 'array', items: { type: 'object' } }
        },
        required: ['id', 'name', 'score', 'summary', 'findings']
      }
    },
    findings: { type: 'array', items: { type: 'object' } },
    openQuestions: { type: 'array', items: { type: 'object' } },
    revisionPlan: { type: 'object' },
    recommendedMethods: { type: 'array', items: { type: 'object' } },
    metadata: { type: 'object' }
  },
  required: ['overallScore', 'publishable', 'summary', 'scores', 'editorialPasses', 'findings', 'openQuestions', 'revisionPlan']
};

function clampScore(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function truncateText(value, limit = MAX_TEXT.medium) {
  if (typeof value !== 'string') return '';
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, Math.max(0, limit - 3)).trim()}...`;
}

function toPlain(value) {
  return value && typeof value.toObject === 'function'
    ? value.toObject({ versionKey: false })
    : value;
}

function compactArray(items, mapper, limit = 12) {
  return Array.isArray(items) ? items.slice(0, limit).map(mapper).filter(Boolean) : [];
}

function normalizeOptionalId(value) {
  if (value === null || value === undefined || value === '') return null;
  return String(value);
}

function getSceneId(scene) {
  return normalizeOptionalId(scene?._id ?? scene?.id);
}

function inferManuscriptStage({ totalWordCount = 0, targetWordCount = null, sceneCount = 0, explicitStage = null } = {}) {
  const normalizedStage = String(explicitStage || '').trim().toLowerCase();
  if (MANUSCRIPT_STAGES.has(normalizedStage)) return normalizedStage;

  const safeTotal = Number(totalWordCount) > 0 ? Number(totalWordCount) : 0;
  const safeTarget = Number(targetWordCount) > 0 ? Number(targetWordCount) : null;

  if (sceneCount === 0 && safeTotal === 0) return 'outline';
  if (safeTarget) {
    const ratio = safeTotal / safeTarget;
    if (ratio < 0.1) return sceneCount <= 2 ? 'sample' : 'partial_draft';
    if (ratio < 0.6) return 'partial_draft';
    return 'full_draft';
  }

  if (safeTotal < 1500 || sceneCount <= 2) return 'sample';
  if (safeTotal < 25000 || sceneCount < 20) return 'partial_draft';
  return 'full_draft';
}

function buildSceneExcerpt(content) {
  const text = typeof content === 'string' ? content.replace(/\s+/g, ' ').trim() : '';
  if (!text) {
    return { openingExcerpt: '', closingExcerpt: '', excerptCharCount: 0, truncated: false };
  }

  const halfLimit = Math.floor(MAX_SCENE_EXCERPT_CHARS / 2);
  const openingExcerpt = truncateText(text.slice(0, halfLimit + 80), halfLimit);
  const closingExcerpt = text.length > halfLimit
    ? truncateText(text.slice(Math.max(0, text.length - halfLimit - 80)), halfLimit)
    : '';

  return {
    openingExcerpt,
    closingExcerpt,
    excerptCharCount: openingExcerpt.length + closingExcerpt.length,
    truncated: text.length > openingExcerpt.length + closingExcerpt.length,
  };
}

function sanitizeBookBrief(bookBrief) {
  const source = toPlain(bookBrief) || {};
  return {
    genre: truncateText(source.genre, MAX_TEXT.short),
    subgenre: truncateText(source.subgenre, MAX_TEXT.short),
    targetAudience: truncateText(source.targetAudience, MAX_TEXT.short),
    tone: truncateText(source.tone, MAX_TEXT.short),
    narrativeVoice: truncateText(source.narrativeVoice, MAX_TEXT.short),
    language: truncateText(source.language, MAX_TEXT.short),
    corePromise: truncateText(source.corePromise, MAX_TEXT.medium),
    protagonistWant: truncateText(source.protagonistWant, MAX_TEXT.medium),
    protagonistNeed: truncateText(source.protagonistNeed, MAX_TEXT.medium),
    centralConflict: truncateText(source.centralConflict, MAX_TEXT.medium),
    readerAppeal: compactArray(source.readerAppeal, item => truncateText(item, MAX_TEXT.short), 10),
    mustInclude: compactArray(source.mustInclude, item => truncateText(item, MAX_TEXT.short), 12),
    mustAvoid: compactArray(source.mustAvoid, item => truncateText(item, MAX_TEXT.short), 12),
    contentGuidelines: {
      violenceLevel: truncateText(source.contentGuidelines?.violenceLevel, 80),
      romanceLevel: truncateText(source.contentGuidelines?.romanceLevel, 80),
      profanityLevel: truncateText(source.contentGuidelines?.profanityLevel, 80),
      sexualContentLevel: truncateText(source.contentGuidelines?.sexualContentLevel, 80),
      sensitiveTopics: compactArray(source.contentGuidelines?.sensitiveTopics, item => truncateText(item, MAX_TEXT.short), 10),
    },
  };
}

function sanitizeBible(bible) {
  const source = toPlain(bible);
  if (!source) return null;

  return {
    summary: truncateText(source.summary, MAX_TEXT.long),
    premise: truncateText(source.premise, MAX_TEXT.long),
    theCrucible: truncateText(source.theCrucible, MAX_TEXT.medium),
    characters: compactArray(source.characters, character => ({
      name: truncateText(character.name, MAX_TEXT.short),
      role: truncateText(character.role, MAX_TEXT.short),
      archetype: truncateText(character.archetype, MAX_TEXT.short),
      motivation: truncateText(character.motivation, MAX_TEXT.medium),
      description: truncateText(character.description, MAX_TEXT.medium),
      relationships: compactArray(character.relationships, relationship => ({
        characterName: truncateText(relationship.characterName, MAX_TEXT.short),
        type: truncateText(relationship.type, 80),
        tension: truncateText(relationship.tension, MAX_TEXT.short),
      }), 6),
    }), 16),
    chapters: compactArray(source.chapters, chapter => ({
      chapterNumber: chapter.chapterNumber,
      title: truncateText(chapter.title, MAX_TEXT.short),
      type: truncateText(chapter.type, 80),
      aiSummary: truncateText(chapter.aiSummary, MAX_TEXT.medium),
      beats: compactArray(chapter.beats, beat => ({
        id: beat.id,
        title: truncateText(beat.title, MAX_TEXT.short),
        description: truncateText(beat.description, MAX_TEXT.medium),
        type: truncateText(beat.type, 80),
      }), 12),
    }), 24),
    beats: compactArray(source.beats, beat => ({
      id: beat.id,
      title: truncateText(beat.title, MAX_TEXT.short),
      description: truncateText(beat.description, MAX_TEXT.medium),
      type: truncateText(beat.type, 80),
    }), 40),
    settings: compactArray(source.settings, setting => ({
      name: truncateText(setting.name, MAX_TEXT.short),
      type: truncateText(setting.type, MAX_TEXT.short),
      description: truncateText(setting.description, MAX_TEXT.medium),
      atmosphere: truncateText(setting.atmosphere, MAX_TEXT.short),
    }), 12),
  };
}

function sanitizeScenes(scenes = []) {
  let totalExcerptChars = 0;
  let contextTruncated = scenes.length > MAX_SCENES;
  const selectedScenes = [];

  for (const scene of scenes) {
    if (selectedScenes.length >= MAX_SCENES || totalExcerptChars >= MAX_TOTAL_SCENE_CHARS) {
      contextTruncated = true;
      break;
    }

    const excerpt = buildSceneExcerpt(scene?.content);
    totalExcerptChars += excerpt.excerptCharCount;
    if (excerpt.truncated) contextTruncated = true;

    selectedScenes.push({
      sceneId: getSceneId(scene),
      title: truncateText(scene?.title, MAX_TEXT.short),
      chapterNumber: scene?.chapterNumber ?? null,
      beatId: scene?.beatId ?? null,
      wordCount: Number(scene?.wordCount) > 0 ? Number(scene.wordCount) : countWords(scene?.content),
      summary: truncateText(scene?.summary, MAX_TEXT.medium),
      openingExcerpt: excerpt.openingExcerpt,
      closingExcerpt: excerpt.closingExcerpt,
    });
  }

  return { scenes: selectedScenes, contextTruncated };
}

function buildEditorialQualityContext({ project, bookBrief, bible, scenes, publishability, heuristicQualityReport }) {
  const safeScenes = Array.isArray(scenes) ? scenes : [];
  const sanitizedScenes = sanitizeScenes(safeScenes);
  const totalWordCount = safeScenes.reduce((sum, scene) => {
    const words = Number(scene?.wordCount) > 0 ? Number(scene.wordCount) : countWords(scene?.content);
    return sum + words;
  }, 0);
  const sanitizedBookBrief = sanitizeBookBrief(bookBrief);
  const targetWordCount = project?.targetWordCount ?? bookBrief?.targetWordCount ?? null;
  const manuscriptStage = inferManuscriptStage({
    totalWordCount,
    targetWordCount,
    sceneCount: safeScenes.length,
    explicitStage: project?.manuscriptStage ?? bookBrief?.manuscriptStage,
  });
  const methodSelection = selectNarrativeMethods({
    genre: sanitizedBookBrief.genre,
    subgenre: sanitizedBookBrief.subgenre,
    targetAudience: sanitizedBookBrief.targetAudience,
    tone: sanitizedBookBrief.tone,
    projectStyle: project?.style,
    stage: safeScenes.length > 0 ? 'draft revision' : 'outline',
    detectedProblems: (heuristicQualityReport?.findings || []).map(finding => finding.code || finding.message).slice(0, 20),
  });

  return {
    project: {
      title: truncateText(project?.name || project?.title, MAX_TEXT.short),
      type: project?.isShortStory ? 'short_story' : 'book',
      targetWordCount,
      language: truncateText(project?.language || bookBrief?.language, MAX_TEXT.short),
      style: truncateText(project?.style, MAX_TEXT.short),
      premise: truncateText(project?.premise, MAX_TEXT.medium),
    },
    bookBrief: sanitizedBookBrief,
    bible: sanitizeBible(bible),
    scenes: sanitizedScenes.scenes,
    publishability: publishability ? {
      score: publishability.score,
      publishable: publishability.publishable,
      criticalFailureCount: Array.isArray(publishability.criticalFailures) ? publishability.criticalFailures.length : 0,
      warningCount: Array.isArray(publishability.warnings) ? publishability.warnings.length : 0,
    } : null,
    heuristicQualityReport: heuristicQualityReport ? {
      overallScore: heuristicQualityReport.overallScore,
      publishable: heuristicQualityReport.publishable,
      summary: truncateText(heuristicQualityReport.summary, MAX_TEXT.medium),
      scores: heuristicQualityReport.scores || {},
      findings: compactArray(heuristicQualityReport.findings, finding => ({
        code: finding.code,
        category: finding.category,
        severity: finding.severity,
        message: truncateText(finding.message, MAX_TEXT.short),
        chapterNumber: finding.chapterNumber,
        beatId: finding.beatId,
        sceneId: finding.sceneId,
      }), 25),
    } : null,
    recommendedMethods: methodSelection.selected,
    metadata: {
      contextTruncated: sanitizedScenes.contextTruncated,
      sceneCount: safeScenes.length,
      includedSceneCount: sanitizedScenes.scenes.length,
      totalWordCount,
      manuscriptStage,
      generatedAt: new Date().toISOString(),
    },
  };
}

function buildEditorialQualityPrompt(context) {
  return `You are StoryForge's AI literary editor. Analyze the manuscript snapshot as an editorial diagnostic report.

Rules:
- Return only structured JSON matching the requested schema.
- Do not rewrite scenes.
- Do not apply changes automatically.
- Do not ask to change the BookBrief, Bible, scenes, exports, CostLedger, or PublishingPackage directly.
- Use the BookBrief, Bible, scene excerpts, heuristic QualityReport, Publishability Gate, and recommended methods as evidence.
- Technical/compliance warnings must not replace editorial findings. AI disclosure and human review metadata belong in metadata.complianceWarnings, not the main editorial problems.
- Editorial findings must focus on story quality: structure, character, scene turns, continuity, voice, genre promise, and BookBrief alignment.
- If BookBrief.mustInclude is missing, every finding must include term, expectedRole, searchedIn, evidence, impact, suggestedFix, and affectedScenes or suggestedPlacement.
- If BookBrief.mustAvoid appears, every finding must include term, whereFound, evidence, risk, and suggestedFix.
- Never emit generic findings such as "A required BookBrief term was not found."
- Every openQuestion must include question, whyItMatters, at least 2 options, recommendedOption, impact, and affectedArea.
- If any finding is high/critical or overallScore is below 75, revisionPlan must include macro items; include sceneLevel items when scenes exist and authorDecisions when openQuestions exist.
- Adapt the critique to metadata.manuscriptStage. For partial_draft or sample, focus on direction, promise, early escalation, character trajectory, and expansion plan; do not judge final payoff as definitive.
- If the author must choose a direction, mark requiresAuthorDecision and add a clear question.
- Evidence must quote or summarize only short excerpts already present in the sanitized context.
- Do not include full scenes, full manuscript, prompts, provider details, or raw model response.
- Use narrative methods as operational diagnostic lenses only; do not copy protected method text.

Editorial passes to perform:
1. Structural Editor: premise, story promise, global structure, beginning, middle, ending, turns, climax, final payoff, BookBrief alignment.
2. Character Editor: protagonist external want, internal need, agency, transformation arc, antagonist, secondary characters, relationships.
3. Scene Editor: scene objective, conflict, turn, consequence, cuttable scenes, merge candidates, scenes needing complication. Use incident, complication, crisis/decision, climax, resolution/change as an operational lens.
4. Continuity Editor: character contradictions, timeline, locations, world rules, objects/clues, names, age, relationships.
5. Voice and Prose Editor: narrative voice, POV, dialogue, exposition, long paragraphs, generic prose, AI artifacts, showing versus telling.
6. Genre and Reader Promise Editor: genre promise, target audience fit, niche expectations, specificity, differentiation.
7. Revision Strategist: prioritized macro revisions, chapter/scene revisions, line/prose revisions, author decisions required.

Severity values: critical, high, medium, low, info.
Finding categories: structure, character, scene, continuity, voice, genre, bookBrief.

Sanitized context:
${JSON.stringify(context, null, 2)}`;
}

function extractJsonPayload(response) {
  if (response && typeof response === 'object') return response;
  const text = String(response || '').trim();
  if (!text) throw new Error('AI editorial response is empty.');

  const candidates = [text];
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch?.[1]) candidates.unshift(fenceMatch[1].trim());

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(text.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (error) {
      // Try the next candidate.
    }
  }

  throw new Error('AI editorial response is not valid JSON.');
}

function normalizeSeverity(value) {
  const severity = String(value || '').toLowerCase();
  if (['critical', 'high', 'medium', 'low', 'info', 'warning'].includes(severity)) return severity;
  return 'medium';
}

function normalizeCategory(value) {
  const category = String(value || '').toLowerCase();
  if (['structure', 'character', 'scene', 'continuity', 'voice', 'genre', 'bookbrief', 'book_brief'].includes(category)) {
    return category === 'bookbrief' || category === 'book_brief' ? 'bookBrief' : category;
  }
  return 'structure';
}

function normalizeStringArray(items, limit = 6) {
  return Array.isArray(items)
    ? items.map(item => truncateText(item, MAX_TEXT.medium)).filter(Boolean).slice(0, limit)
    : [];
}

function isHighImpactFinding(finding) {
  return ['critical', 'high'].includes(normalizeSeverity(finding?.severity));
}

function isTechnicalComplianceFinding(finding = {}) {
  const code = String(finding.code || '').trim().toUpperCase();
  const message = String(finding.message || '').toLowerCase();
  const category = normalizeCategory(finding.category);

  return TECHNICAL_COMPLIANCE_CODES.has(code)
    || code.includes('AI_DISCLOSURE')
    || code.includes('HUMAN_REVIEW')
    || (category === 'bookBrief' && (message.includes('ai disclosure') || message.includes('human review')));
}

function normalizeFinding(finding = {}, fallback = {}) {
  const normalized = {
    code: truncateText(finding.code || fallback.code || 'AI_EDITORIAL_FINDING', 80).replace(/\s+/g, '_').toUpperCase(),
    category: normalizeCategory(finding.category || fallback.category),
    severity: normalizeSeverity(finding.severity || fallback.severity),
    message: truncateText(finding.message || fallback.message || 'Review this editorial finding.', MAX_TEXT.medium),
    evidence: truncateText(finding.evidence, MAX_TEXT.medium),
    impact: truncateText(finding.impact, MAX_TEXT.medium),
    suggestions: normalizeStringArray(finding.suggestions, 5),
    term: truncateText(finding.term, MAX_TEXT.short) || undefined,
    expectedRole: truncateText(finding.expectedRole, MAX_TEXT.medium) || undefined,
    searchedIn: truncateText(finding.searchedIn, MAX_TEXT.medium) || undefined,
    suggestedFix: truncateText(finding.suggestedFix, MAX_TEXT.medium) || undefined,
    affectedScenes: normalizeStringArray(finding.affectedScenes, 8),
    suggestedPlacement: truncateText(finding.suggestedPlacement, MAX_TEXT.medium) || undefined,
    whereFound: truncateText(finding.whereFound, MAX_TEXT.medium) || undefined,
    risk: truncateText(finding.risk, MAX_TEXT.medium) || undefined,
    chapterNumber: Number.isFinite(Number(finding.chapterNumber)) ? Number(finding.chapterNumber) : undefined,
    beatId: normalizeOptionalId(finding.beatId),
    sceneId: normalizeOptionalId(finding.sceneId),
    requiresAuthorDecision: Boolean(finding.requiresAuthorDecision),
    question: truncateText(finding.question, MAX_TEXT.medium) || undefined,
  };

  if (normalized.affectedScenes.length === 0) delete normalized.affectedScenes;
  return normalized;
}

function normalizePass(pass = {}, index) {
  const [fallbackId, fallbackName] = PASS_DEFINITIONS[index] || [`editorial_pass_${index + 1}`, `Editorial Pass ${index + 1}`];
  const id = truncateText(pass.id || fallbackId, 80);
  const findings = compactArray(pass.findings, finding => normalizeFinding(finding, {
    category: id.includes('character') ? 'character' : id.includes('scene') ? 'scene' : id.includes('continuity') ? 'continuity' : id.includes('voice') ? 'voice' : id.includes('genre') ? 'genre' : 'structure',
  }), 12);

  return {
    id,
    name: truncateText(pass.name || fallbackName, MAX_TEXT.short),
    score: clampScore(pass.score, 0),
    summary: truncateText(pass.summary, MAX_TEXT.long),
    findings,
  };
}

function normalizeRevisionPlan(plan = {}) {
  return {
    macro: compactArray(plan.macro, item => ({
      priority: normalizeSeverity(item.priority) === 'high' ? 'high' : ['medium', 'low'].includes(normalizeSeverity(item.priority)) ? normalizeSeverity(item.priority) : 'medium',
      title: truncateText(item.title, MAX_TEXT.short),
      reason: truncateText(item.reason, MAX_TEXT.medium),
      actions: normalizeStringArray(item.actions, 6),
    }), 10),
    sceneLevel: compactArray(plan.sceneLevel, item => ({
      priority: ['high', 'medium', 'low'].includes(normalizeSeverity(item.priority)) ? normalizeSeverity(item.priority) : 'medium',
      chapterNumber: Number.isFinite(Number(item.chapterNumber)) ? Number(item.chapterNumber) : undefined,
      sceneId: normalizeOptionalId(item.sceneId),
      issue: truncateText(item.issue, MAX_TEXT.medium),
      recommendedAction: truncateText(item.recommendedAction, 80),
    }), 16),
    lineLevel: compactArray(plan.lineLevel, item => ({
      priority: ['high', 'medium', 'low'].includes(normalizeSeverity(item.priority)) ? normalizeSeverity(item.priority) : 'low',
      issue: truncateText(item.issue, MAX_TEXT.medium),
      action: truncateText(item.action, MAX_TEXT.medium),
    }), 10),
    authorDecisions: compactArray(plan.authorDecisions, item => ({
      question: truncateText(item.question, MAX_TEXT.medium),
      options: normalizeStringArray(item.options, 5),
      recommendedOption: truncateText(item.recommendedOption, MAX_TEXT.short),
    }), 10),
  };
}

function hasRevisionPlanItems(plan = {}) {
  return ['macro', 'sceneLevel', 'lineLevel', 'authorDecisions']
    .some(key => Array.isArray(plan[key]) && plan[key].length > 0);
}

function getPrimaryFinding(findings = []) {
  return findings.find(isHighImpactFinding) || findings[0] || null;
}

function buildFallbackRevisionPlan({ plan, findings, openQuestions, metadata }) {
  const nextPlan = {
    macro: [...(plan.macro || [])],
    sceneLevel: [...(plan.sceneLevel || [])],
    lineLevel: [...(plan.lineLevel || [])],
    authorDecisions: [...(plan.authorDecisions || [])],
  };
  const primary = getPrimaryFinding(findings);
  const sceneCount = Number(metadata?.sceneCount) || 0;

  if (nextPlan.macro.length === 0 && primary) {
    nextPlan.macro.push({
      priority: isHighImpactFinding(primary) ? 'high' : 'medium',
      title: primary.term
        ? `Resolve BookBrief gap: ${primary.term}`
        : truncateText(primary.message || 'Address the strongest editorial issue.', MAX_TEXT.short),
      reason: primary.impact || primary.evidence || primary.message || 'The report identified this as a blocker for revision readiness.',
      actions: primary.suggestedFix
        ? [primary.suggestedFix]
        : (primary.suggestions?.length ? primary.suggestions : ['Turn the finding into a concrete story change before automated rewriting.']),
    });
  }

  if (sceneCount > 0 && nextPlan.sceneLevel.length === 0 && primary) {
    nextPlan.sceneLevel.push({
      priority: isHighImpactFinding(primary) ? 'high' : 'medium',
      chapterNumber: primary.chapterNumber,
      sceneId: primary.sceneId,
      issue: primary.message || 'Scene needs a clearer editorial target.',
      recommendedAction: primary.suggestedFix || primary.suggestions?.[0] || 'strengthen',
    });
  }

  if (openQuestions.length > 0 && nextPlan.authorDecisions.length === 0) {
    const question = openQuestions[0];
    nextPlan.authorDecisions.push({
      question: question.question,
      options: question.options,
      recommendedOption: question.recommendedOption,
    });
  }

  return nextPlan;
}

function normalizeOpenQuestion(question = {}, fallbackArea = 'story direction') {
  const options = normalizeStringArray(question.options, 5);
  const recommendedOption = truncateText(question.recommendedOption || options[0], MAX_TEXT.short);

  if (options.length < 2) return null;

  return {
    question: truncateText(question.question, MAX_TEXT.medium),
    whyItMatters: truncateText(question.whyItMatters, MAX_TEXT.medium),
    options,
    recommendedOption,
    impact: ['high', 'medium', 'low'].includes(normalizeSeverity(question.impact)) ? normalizeSeverity(question.impact) : 'medium',
    affectedArea: truncateText(question.affectedArea || fallbackArea, MAX_TEXT.short),
  };
}

function parseEditorialQualityResponse(response, context = {}) {
  const data = extractJsonPayload(response);
  const scores = {};
  for (const key of SCORE_KEYS) {
    scores[key] = clampScore(data?.scores?.[key], 0);
  }

  const editorialPasses = compactArray(data.editorialPasses, normalizePass, 10);
  const passFindings = editorialPasses.flatMap(pass => pass.findings || []);
  const findings = compactArray(data.findings, finding => normalizeFinding(finding), 50);
  const rawFindings = findings.length > 0 ? findings : passFindings.slice(0, 50);
  const complianceWarnings = rawFindings.filter(isTechnicalComplianceFinding);
  const allFindings = rawFindings.filter(finding => !isTechnicalComplianceFinding(finding));
  const metadata = {
    ...(data.metadata && typeof data.metadata === 'object' ? data.metadata : {}),
    ...(context.metadata && typeof context.metadata === 'object' ? context.metadata : {}),
  };
  if (complianceWarnings.length > 0) {
    metadata.complianceWarnings = complianceWarnings.map(finding => ({
      code: finding.code,
      message: finding.message,
      severity: finding.severity,
    }));
  }
  metadata.manuscriptStage = inferManuscriptStage({
    totalWordCount: metadata.totalWordCount,
    targetWordCount: context.project?.targetWordCount,
    sceneCount: metadata.sceneCount,
    explicitStage: metadata.manuscriptStage,
  });
  const openQuestions = compactArray(data.openQuestions, question => normalizeOpenQuestion(question), 12);
  const normalizedRevisionPlan = normalizeRevisionPlan(data.revisionPlan);
  const needsPlan = allFindings.some(isHighImpactFinding) || clampScore(data.overallScore, 0) < 75;
  const revisionPlan = needsPlan && !hasRevisionPlanItems(normalizedRevisionPlan)
    ? buildFallbackRevisionPlan({
        plan: normalizedRevisionPlan,
        findings: allFindings,
        openQuestions,
        metadata,
      })
    : normalizedRevisionPlan;

  return {
    source: AI_EDITORIAL_SOURCE,
    overallScore: clampScore(data.overallScore, 0),
    publishable: Boolean(data.publishable),
    summary: truncateText(data.summary || 'AI editorial review completed.', 1100),
    scores,
    editorialPasses,
    findings: allFindings,
    openQuestions,
    revisionPlan,
    recommendedMethods: compactArray(data.recommendedMethods, method => ({
      id: truncateText(method.id, 100),
      name: truncateText(method.name, MAX_TEXT.short),
      reason: truncateText(method.reason, MAX_TEXT.medium),
    }), 8),
    metadata,
  };
}

async function generateAIEditorialQualityReportForProject(projectId, options = {}) {
  const Project = options.Project || require('../models/Project');
  const Bible = options.Bible || require('../models/Bible');
  const Scene = options.Scene || require('../models/Scene');
  const QualityReport = options.QualityReport || require('../models/QualityReport');
  const { getBookBriefByProjectId } = options.bookBriefService || require('./bookBriefService');
  const generateStructured = options.generateStructured || textGenerationService.generateStructured;
  const evaluatePublishability = options.evaluateProjectPublishability || evaluateProjectPublishability;

  const project = await Project.findById(projectId);
  if (!project) return null;

  const [bookBrief, bible, scenes, publishability, latestHeuristicReport] = await Promise.all([
    getBookBriefByProjectId(project._id),
    Bible.findOne({ projectId: project._id }),
    Scene.find({ projectId: project._id }).sort({ chapterNumber: 1, beatId: 1, generatedAt: 1 }),
    evaluatePublishability(project._id),
    QualityReport.findOne({ projectId: project._id, source: 'heuristic' }).sort({ createdAt: -1 }),
  ]);

  const heuristicQualityReport = latestHeuristicReport || evaluateQualitySnapshot({
    project,
    bible,
    scenes,
    bookBrief,
    publishability,
  });
  const context = buildEditorialQualityContext({
    project,
    bookBrief,
    bible,
    scenes,
    publishability,
    heuristicQualityReport,
  });

  try {
    const { data } = await generateStructured({
      project,
      prompt: buildEditorialQualityPrompt(context),
      schema: AI_EDITORIAL_SCHEMA,
      schemaName: 'ai editorial quality report',
      options: { temperature: 0.4, topP: 0.9 },
      costMetadata: {
        task: 'ai_editorial_quality_report',
        stage: 'editorial_quality',
        requestType: 'text',
        source: 'aiEditorialQualityService.generateAIEditorialQualityReportForProject',
      },
    });
    const parsed = parseEditorialQualityResponse(data, context);
    const metadata = {
      ...parsed.metadata,
      ...context.metadata,
      sourceVersion: AI_EDITORIAL_SOURCE,
      recommendedMethodCount: context.recommendedMethods.length,
    };
    const recommendedMethods = parsed.recommendedMethods.length > 0 ? parsed.recommendedMethods : context.recommendedMethods;

    const report = await QualityReport.create({
      projectId: project._id,
      source: AI_EDITORIAL_SOURCE,
      manuscriptVersion: options.manuscriptVersion || 'current',
      scores: parsed.scores,
      publishable: parsed.publishable,
      overallScore: parsed.overallScore,
      categories: {},
      findings: parsed.findings,
      recommendations: [],
      editorialPasses: parsed.editorialPasses,
      openQuestions: parsed.openQuestions,
      revisionPlan: parsed.revisionPlan,
      recommendedMethods,
      summary: parsed.summary,
      metadata,
    });

    console.log('[AI_EDITORIAL_QUALITY] generated', {
      projectId: project._id.toString(),
      sceneCount: metadata.sceneCount,
      includedSceneCount: metadata.includedSceneCount,
      contextTruncated: metadata.contextTruncated,
      findingCount: parsed.findings.length,
      passCount: parsed.editorialPasses.length,
    });

    return toQualityReportResponse(report);
  } catch (error) {
    console.error('[AI_EDITORIAL_QUALITY] generation_failed', {
      projectId: project._id.toString(),
      error: safeErrorForLog(error),
    });
    throw new Error('Failed to generate AI Editorial QualityReport.');
  }
}

module.exports = {
  AI_EDITORIAL_SCHEMA,
  AI_EDITORIAL_SOURCE,
  buildEditorialQualityContext,
  buildEditorialQualityPrompt,
  parseEditorialQualityResponse,
  generateAIEditorialQualityReportForProject,
};
