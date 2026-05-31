const { countWords, evaluateProjectPublishability } = require('./publishabilityService');

const MIN_SCENE_WORDS_WARNING = 50;
const MAX_SCENE_WORDS_WARNING = 5000;
const LONG_PARAGRAPH_WORDS = 250;
const WORD_COUNT_LOW_RATIO = 0.6;
const WORD_COUNT_HIGH_RATIO = 1.4;
const MANUSCRIPT_INCOMPLETE_RATIO = 0.6;
const MANY_EMPTY_LINES_PATTERN = /\n\s*\n\s*\n\s*\n/;
const PLACEHOLDER_PATTERN = /\b(TODO|lorem ipsum|placeholder)\b|\[INSERIR\]/i;
const MODEL_ARTIFACT_PATTERN = /\b(Here is the scene|Claro,\s*aqui est[aá]|As an AI|I cannot)\b/i;
const CONFIGURED_AI_DISCLOSURES = new Set(['ai_assisted', 'ai_generated', 'human_written']);
const COMPLETED_HUMAN_REVIEW_STATUSES = new Set(['completed', 'waived']);
const PENDING_HUMAN_REVIEW_STATUSES = new Set(['not_tracked', 'needed', 'in_progress']);
const SCORE_CATEGORIES = [
  'structureScore',
  'continuityScore',
  'proseScore',
  'pacingScore',
  'bookBriefAlignmentScore',
  'technicalReadinessScore',
];

const MANUSCRIPT_STAGES = new Set(['concept', 'outline', 'sample', 'partial_draft', 'full_draft', 'revision', 'final_review']);

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeStatus(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function getPositiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function normalizeBeatId(beatId) {
  if (beatId === null || beatId === undefined || beatId === '') {
    return null;
  }

  return String(beatId);
}

function getProjectId(project) {
  const id = project?._id ?? project?.id ?? project?.projectId;
  return id ? String(id) : null;
}

function getSceneId(scene) {
  const id = scene?._id ?? scene?.id;
  return id ? String(id) : undefined;
}

function inferManuscriptStage({ totalWordCount = 0, targetWordCount = null, sceneCount = 0, explicitStage = null } = {}) {
  const normalizedStage = String(explicitStage || '').trim().toLowerCase();
  if (MANUSCRIPT_STAGES.has(normalizedStage)) return normalizedStage;
  const safeTarget = getPositiveNumber(targetWordCount);
  const safeTotal = Number(totalWordCount) > 0 ? Number(totalWordCount) : 0;

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

function getChapterNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function createFinding(code, category, severity, message, context = {}) {
  const finding = {
    code,
    category,
    severity,
    message,
  };

  if (context.sceneId) finding.sceneId = String(context.sceneId);
  for (const field of ['term', 'expectedRole', 'searchedIn', 'evidence', 'impact', 'suggestedFix', 'suggestedPlacement', 'whereFound', 'risk']) {
    if (context[field]) finding[field] = String(context[field]);
  }
  if (Array.isArray(context.affectedScenes) && context.affectedScenes.length > 0) {
    finding.affectedScenes = context.affectedScenes.map(String);
  }
  if (context.beatId !== undefined && context.beatId !== null) finding.beatId = String(context.beatId);
  if (context.chapterNumber !== undefined && context.chapterNumber !== null) {
    finding.chapterNumber = Number(context.chapterNumber);
  }

  return finding;
}

function uniqueByCodePriority(findings) {
  const priority = { critical: 0, warning: 1, info: 2 };
  return [...findings].sort((left, right) => {
    if (priority[left.severity] !== priority[right.severity]) {
      return priority[left.severity] - priority[right.severity];
    }

    return left.code.localeCompare(right.code);
  });
}

function getExpectedBeats(bible) {
  const chapters = Array.isArray(bible?.chapters) ? bible.chapters : [];
  const expected = [];

  for (const chapter of chapters) {
    const chapterNumber = getChapterNumber(chapter?.chapterNumber);
    const beats = Array.isArray(chapter?.beats) ? chapter.beats : [];

    for (const beat of beats) {
      const beatId = normalizeBeatId(beat?.id ?? beat?.beatId);
      if (!beatId) continue;

      expected.push({ beatId, chapterNumber });
    }
  }

  if (expected.length > 0) {
    return expected;
  }

  const flatBeats = Array.isArray(bible?.beats) ? bible.beats : [];
  return flatBeats
    .map((beat) => ({ beatId: normalizeBeatId(beat?.id ?? beat?.beatId), chapterNumber: null }))
    .filter((beat) => beat.beatId);
}

function getManuscriptText(scenes) {
  return scenes
    .map((scene) => (typeof scene?.content === 'string' ? scene.content : ''))
    .join('\n');
}

function getSceneWordData(scenes) {
  return scenes.map((scene) => ({
    scene,
    sceneId: getSceneId(scene),
    beatId: normalizeBeatId(scene?.beatId),
    chapterNumber: getChapterNumber(scene?.chapterNumber),
    words: Number.isFinite(Number(scene?.wordCount)) && Number(scene.wordCount) > 0
      ? Number(scene.wordCount)
      : countWords(scene?.content),
  }));
}

function getDuplicateSentenceCount(text) {
  const sentences = String(text || '')
    .split(/[.!?]+/)
    .map((sentence) => normalizeText(sentence).trim())
    .filter((sentence) => sentence.split(/\s+/).filter(Boolean).length >= 4);

  const counts = new Map();
  let duplicates = 0;

  for (const sentence of sentences) {
    const nextCount = (counts.get(sentence) || 0) + 1;
    counts.set(sentence, nextCount);
    if (nextCount === 3) {
      duplicates += 1;
    }
  }

  return duplicates;
}

function hasLongParagraph(text) {
  return String(text || '')
    .split(/\n+/)
    .some((paragraph) => countWords(paragraph) > LONG_PARAGRAPH_WORDS);
}

function addRecommendation(recommendations, code, priority, message) {
  if (recommendations.some((recommendation) => recommendation.code === code)) {
    return;
  }

  recommendations.push({ code, priority, message });
}

function calculateCategoryScore(findings, category) {
  const deductions = findings
    .filter((finding) => finding.category === category)
    .reduce((sum, finding) => {
      if (finding.severity === 'critical') return sum + 25;
      if (finding.severity === 'warning') return sum + 7;
      return sum + 1;
    }, 0);

  return clampScore(100 - deductions);
}

function calculateOverallScore(scores, findings) {
  const categoryAverage = SCORE_CATEGORIES.reduce((sum, key) => sum + scores[key], 0) / SCORE_CATEGORIES.length;
  const directScore = 100 - findings.reduce((sum, finding) => {
    if (finding.severity === 'critical') return sum + 20;
    if (finding.severity === 'warning') return sum + 5;
    return sum;
  }, 0);

  return clampScore(Math.min(categoryAverage, directScore));
}

function buildCategories(findings) {
  const categories = {};
  const categoryNames = ['structure', 'continuity', 'prose', 'pacing', 'bookBriefAlignment', 'technicalReadiness'];

  for (const category of categoryNames) {
    const categoryFindings = findings.filter((finding) => finding.category === category);
    const critical = categoryFindings.filter((finding) => finding.severity === 'critical').length;
    const warning = categoryFindings.filter((finding) => finding.severity === 'warning').length;

    categories[category] = {
      status: critical > 0 ? 'failed' : warning > 0 ? 'warning' : 'passed',
      findingCount: categoryFindings.length,
      criticalCount: critical,
      warningCount: warning,
    };
  }

  return categories;
}

function buildSummary({ findings, overallScore, sceneCount, totalWordCount }) {
  const criticalCount = findings.filter((finding) => finding.severity === 'critical').length;
  const warningCount = findings.filter((finding) => finding.severity === 'warning').length;

  if (sceneCount === 0) {
    return 'QualityReport found no generated scenes to evaluate.';
  }

  if (criticalCount > 0) {
    return `QualityReport found ${criticalCount} critical issue(s) and ${warningCount} warning(s) across ${sceneCount} scene(s).`;
  }

  if (warningCount > 0) {
    return `QualityReport scored ${overallScore}/100 with ${warningCount} warning(s) across ${sceneCount} scene(s) and ${totalWordCount} word(s).`;
  }

  return `QualityReport scored ${overallScore}/100 with no critical heuristic findings across ${sceneCount} scene(s).`;
}

function evaluateQualitySnapshot({ project, bible, scenes, bookBrief, publishability } = {}) {
  const safeScenes = Array.isArray(scenes) ? scenes : [];
  const findings = [];
  const recommendations = [];
  const projectId = getProjectId(project);
  const expectedBeats = getExpectedBeats(bible);
  const expectedBeatIds = new Set(expectedBeats.map((beat) => beat.beatId));
  const sceneWordData = getSceneWordData(safeScenes);
  const sceneBeatIds = new Set(sceneWordData.map((item) => item.beatId).filter(Boolean));
  const totalWordCount = sceneWordData.reduce((sum, item) => sum + item.words, 0);
  const chapterNumbers = new Set(sceneWordData.map((item) => item.chapterNumber).filter(Boolean));
  const manuscriptText = getManuscriptText(safeScenes);

  if (!project) {
    findings.push(createFinding(
      'QUALITY_PROJECT_MISSING',
      'technicalReadiness',
      'critical',
      'Project was not found.'
    ));
  }

  if (!bible) {
    findings.push(createFinding(
      'QUALITY_BIBLE_MISSING',
      'structure',
      'warning',
      'Project has no Bible, so structural quality checks are limited.'
    ));
  }

  if (safeScenes.length === 0) {
    findings.push(createFinding(
      'QUALITY_SCENES_MISSING',
      'structure',
      'critical',
      'Project has no generated scenes to evaluate.'
    ));
    addRecommendation(recommendations, 'QUALITY_GENERATE_SCENES', 'high', 'Generate scenes before running a full editorial quality pass.');
  }

  for (const item of sceneWordData) {
    if (!hasText(item.scene?.content)) {
      findings.push(createFinding(
        'QUALITY_SCENE_EMPTY',
        'structure',
        'critical',
        'Scene has no prose content.',
        item
      ));
    } else if (item.words < MIN_SCENE_WORDS_WARNING) {
      findings.push(createFinding(
        'QUALITY_SCENE_TOO_SHORT',
        'pacing',
        'warning',
        'Scene is very short and may need expansion.',
        item
      ));
    }

    if (item.words > MAX_SCENE_WORDS_WARNING) {
      findings.push(createFinding(
        'QUALITY_SCENE_TOO_LONG',
        'pacing',
        'warning',
        'Scene is unusually long and may need splitting or tightening.',
        item
      ));
    }

    if (expectedBeats.length > 0 && !item.beatId) {
      findings.push(createFinding(
        'QUALITY_SCENE_BEAT_MISSING',
        'structure',
        'warning',
        'Scene is missing beatId even though the project has expected beats.',
        item
      ));
    }

    if (expectedBeats.length > 0 && item.beatId && expectedBeatIds.has(item.beatId) && !item.chapterNumber) {
      findings.push(createFinding(
        'QUALITY_CHAPTER_NUMBER_MISSING',
        'structure',
        'warning',
        'Scene is linked to a chapter beat but has no chapterNumber.',
        item
      ));
    }

    if (PLACEHOLDER_PATTERN.test(item.scene?.content || '')) {
      findings.push(createFinding(
        'QUALITY_PLACEHOLDER_TEXT',
        'prose',
        'warning',
        'Scene contains placeholder text.',
        item
      ));
    }

    if (MODEL_ARTIFACT_PATTERN.test(item.scene?.content || '')) {
      findings.push(createFinding(
        'QUALITY_MODEL_ARTIFACT',
        'prose',
        'warning',
        'Scene appears to contain model response artifact text.',
        item
      ));
    }

    if (hasLongParagraph(item.scene?.content)) {
      findings.push(createFinding(
        'QUALITY_LONG_PARAGRAPH',
        'prose',
        'warning',
        'Scene contains an extremely long paragraph.',
        item
      ));
    }

    if (MANY_EMPTY_LINES_PATTERN.test(item.scene?.content || '')) {
      findings.push(createFinding(
        'QUALITY_EXCESS_EMPTY_LINES',
        'prose',
        'info',
        'Scene contains many consecutive empty lines.',
        item
      ));
    }
  }

  const duplicateSentenceCount = getDuplicateSentenceCount(manuscriptText);
  if (duplicateSentenceCount > 0) {
    findings.push(createFinding(
      'QUALITY_REPETITIVE_TEXT',
      'prose',
      'warning',
      'Manuscript contains repeated identical sentences.'
    ));
  }

  const missingBeatIds = expectedBeats
    .map((beat) => beat.beatId)
    .filter((beatId) => !sceneBeatIds.has(beatId));

  for (const beatId of missingBeatIds.slice(0, 20)) {
    const expectedBeat = expectedBeats.find((beat) => beat.beatId === beatId);
    findings.push(createFinding(
      'QUALITY_BEAT_MISSING_SCENE',
      'structure',
      'warning',
      'Expected beat has no generated scene.',
      expectedBeat
    ));
  }

  if (missingBeatIds.length > 0) {
    addRecommendation(recommendations, 'QUALITY_COMPLETE_BEAT_COVERAGE', 'high', 'Generate or attach scenes for expected beats that are still missing.');
  }

  const targetWordCount = getPositiveNumber(project?.targetWordCount) || getPositiveNumber(bookBrief?.targetWordCount);
  if (targetWordCount) {
    if (totalWordCount < targetWordCount * WORD_COUNT_LOW_RATIO) {
      findings.push(createFinding(
        'QUALITY_WORD_COUNT_LOW',
        'structure',
        'warning',
        'Total word count is far below the configured target.'
      ));
    }

    if (totalWordCount < targetWordCount * MANUSCRIPT_INCOMPLETE_RATIO) {
      findings.push(createFinding(
        'MANUSCRIPT_INCOMPLETE_FOR_TARGET',
        'structure',
        'warning',
        'Manuscript word count is below 60% of the configured publication target.'
      ));
    }

    if (totalWordCount > targetWordCount * WORD_COUNT_HIGH_RATIO) {
      findings.push(createFinding(
        'QUALITY_WORD_COUNT_HIGH',
        'structure',
        'warning',
        'Total word count is far above the configured target.'
      ));
    }
  }

  const sortedWords = sceneWordData.map((item) => item.words);
  for (let index = 0; index < sortedWords.length - 1; index += 1) {
    if (sortedWords[index] > 0 && sortedWords[index] < MIN_SCENE_WORDS_WARNING && sortedWords[index + 1] < MIN_SCENE_WORDS_WARNING) {
      findings.push(createFinding(
        'QUALITY_SHORT_SCENES_IN_SEQUENCE',
        'pacing',
        'warning',
        'Multiple very short scenes appear in sequence.'
      ));
      break;
    }

    if (sortedWords[index] > MAX_SCENE_WORDS_WARNING && sortedWords[index + 1] > MAX_SCENE_WORDS_WARNING) {
      findings.push(createFinding(
        'QUALITY_LONG_SCENES_IN_SEQUENCE',
        'pacing',
        'warning',
        'Multiple unusually long scenes appear in sequence.'
      ));
      break;
    }
  }

  const nonEmptySceneWords = sortedWords.filter((words) => words > 0);
  if (nonEmptySceneWords.length >= 3) {
    const minWords = Math.min(...nonEmptySceneWords);
    const maxWords = Math.max(...nonEmptySceneWords);
    if (minWords > 0 && maxWords / minWords >= 6) {
      findings.push(createFinding(
        'QUALITY_SCENE_LENGTH_VARIANCE',
        'pacing',
        'info',
        'Scene lengths vary sharply across the manuscript.'
      ));
    }
  }

  const scenesByChapter = new Map();
  for (const item of sceneWordData) {
    if (!item.chapterNumber) continue;
    if (!scenesByChapter.has(item.chapterNumber)) scenesByChapter.set(item.chapterNumber, []);
    scenesByChapter.get(item.chapterNumber).push(item);
  }

  for (const [chapterNumber, chapterScenes] of scenesByChapter.entries()) {
    if (chapterScenes.length === 1 && chapterScenes[0].words < MIN_SCENE_WORDS_WARNING) {
      findings.push(createFinding(
        'QUALITY_CHAPTER_TOO_THIN',
        'pacing',
        'warning',
        'Chapter has a single very short scene.',
        { chapterNumber }
      ));
    }
  }

  if (bookBrief) {
    if (hasText(bookBrief.language)) {
      findings.push(createFinding(
        'QUALITY_BOOKBRIEF_LANGUAGE_CONFIGURED',
        'bookBriefAlignment',
        'info',
        'BookBrief language is configured.'
      ));
    }

    for (const field of ['targetAudience', 'genre', 'tone']) {
      if (hasText(bookBrief[field])) {
        findings.push(createFinding(
          `QUALITY_BOOKBRIEF_${field.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}_CONFIGURED`,
          'bookBriefAlignment',
          'info',
          `BookBrief ${field} is configured.`
        ));
      }
    }

    const normalizedManuscript = normalizeText(manuscriptText);
    const mustInclude = Array.isArray(bookBrief.mustInclude) ? bookBrief.mustInclude : [];
    const mustAvoid = Array.isArray(bookBrief.mustAvoid) ? bookBrief.mustAvoid : [];

    for (const term of mustInclude.filter(hasText).slice(0, 20)) {
      if (!normalizedManuscript.includes(normalizeText(term))) {
        findings.push(createFinding(
          'QUALITY_MUST_INCLUDE_MISSING',
          'bookBriefAlignment',
          'warning',
          `Required BookBrief term "${term.trim()}" was not found in the manuscript.`,
          {
            term: term.trim(),
            expectedRole: 'BookBrief requires this element to appear in the manuscript.',
            searchedIn: `all generated scenes (${safeScenes.length})`,
            evidence: 'No normalized scene text matched the required term.',
            impact: 'BookBrief alignment becomes difficult to verify and the intended promise may remain abstract.',
            suggestedFix: `Add a concrete story beat or scene detail that uses "${term.trim()}" where it naturally supports the promise.`,
            suggestedPlacement: safeScenes.length > 0 ? 'Place it in the earliest scene where the missing element affects character choice or escalation.' : 'Add it when drafting the first relevant scene.',
            affectedScenes: safeScenes.map(getSceneId).filter(Boolean).slice(0, 8),
          }
        ));
      }
    }

    for (const term of mustAvoid.filter(hasText).slice(0, 20)) {
      if (normalizedManuscript.includes(normalizeText(term))) {
        const matchingScenes = safeScenes
          .filter(scene => normalizeText(scene?.content).includes(normalizeText(term)))
          .map(getSceneId)
          .filter(Boolean);
        findings.push(createFinding(
          'QUALITY_MUST_AVOID_PRESENT',
          'bookBriefAlignment',
          'warning',
          `Restricted BookBrief term "${term.trim()}" appears in the manuscript.`,
          {
            term: term.trim(),
            whereFound: matchingScenes.length > 0 ? `scene(s): ${matchingScenes.slice(0, 8).join(', ')}` : 'generated manuscript text',
            evidence: 'Normalized manuscript text matched the restricted term.',
            risk: 'The draft may violate the BookBrief constraints or target-audience promise.',
            suggestedFix: `Remove, replace, or reframe "${term.trim()}" so the scene preserves intent without the restricted element.`,
            affectedScenes: matchingScenes.slice(0, 8),
          }
        ));
      }
    }

    const aiDisclosureStatus = normalizeStatus(bookBrief.aiDisclosure);
    if (!CONFIGURED_AI_DISCLOSURES.has(aiDisclosureStatus)) {
      findings.push(createFinding(
        'QUALITY_AI_DISCLOSURE_MISSING',
        'bookBriefAlignment',
        'warning',
        'BookBrief AI disclosure is not configured.'
      ));
    }

    const humanReviewStatus = normalizeStatus(bookBrief.humanReviewStatus);
    if (PENDING_HUMAN_REVIEW_STATUSES.has(humanReviewStatus) || !humanReviewStatus) {
      findings.push(createFinding(
        'QUALITY_HUMAN_REVIEW_PENDING',
        'bookBriefAlignment',
        'warning',
        'Human review is not completed or waived.'
      ));
    } else if (!COMPLETED_HUMAN_REVIEW_STATUSES.has(humanReviewStatus)) {
      findings.push(createFinding(
        'QUALITY_HUMAN_REVIEW_PENDING',
        'bookBriefAlignment',
        'info',
        'Human review status should be checked.'
      ));
    }
  }

  const publishabilityCritical = Array.isArray(publishability?.criticalFailures)
    ? publishability.criticalFailures
    : [];
  if (publishabilityCritical.length > 0) {
    findings.push(createFinding(
      'QUALITY_EXPORT_READINESS_FAILED',
      'technicalReadiness',
      'critical',
      'Publishability Gate has critical failures.'
    ));
    addRecommendation(recommendations, 'QUALITY_FIX_EXPORT_READINESS', 'high', 'Resolve Publishability Gate critical failures before packaging or release.');
  }

  const technicalReadinessScore = publishability?.score !== undefined
    ? clampScore(publishability.score)
    : calculateCategoryScore(findings, 'technicalReadiness');

  const scores = {
    structureScore: calculateCategoryScore(findings, 'structure'),
    continuityScore: calculateCategoryScore(findings, 'continuity'),
    proseScore: calculateCategoryScore(findings, 'prose'),
    pacingScore: calculateCategoryScore(findings, 'pacing'),
    bookBriefAlignmentScore: calculateCategoryScore(findings, 'bookBriefAlignment'),
    technicalReadinessScore,
  };

  const sortedFindings = uniqueByCodePriority(findings);
  const overallScore = calculateOverallScore(scores, sortedFindings);
  const criticalCount = sortedFindings.filter((finding) => finding.severity === 'critical').length;
  const targetWordCountForReadiness = getPositiveNumber(project?.targetWordCount) || getPositiveNumber(bookBrief?.targetWordCount);
  const technicalExportable = safeScenes.length > 0 && safeScenes.every(scene => hasText(scene?.content));
  const publicationReady = criticalCount === 0
    && (!targetWordCountForReadiness || totalWordCount >= targetWordCountForReadiness * MANUSCRIPT_INCOMPLETE_RATIO);
  const publishable = publicationReady;
  const beatCoverage = expectedBeats.length > 0
    ? {
        expectedBeats: expectedBeats.length,
        coveredBeats: expectedBeats.length - missingBeatIds.length,
        missingBeats: missingBeatIds.length,
        ratio: (expectedBeats.length - missingBeatIds.length) / expectedBeats.length,
      }
    : {
        expectedBeats: 0,
        coveredBeats: 0,
        missingBeats: 0,
        ratio: null,
      };
  const metadata = {
    sceneCount: safeScenes.length,
    totalWordCount,
    averageSceneWordCount: safeScenes.length > 0 ? Math.round(totalWordCount / safeScenes.length) : 0,
    chapterCount: chapterNumbers.size || (Array.isArray(bible?.chapters) ? bible.chapters.length : 0),
    beatCoverage,
    bookBriefExists: Boolean(bookBrief),
    manuscriptStage: inferManuscriptStage({
      totalWordCount,
      targetWordCount: targetWordCountForReadiness,
      sceneCount: safeScenes.length,
      explicitStage: project?.manuscriptStage ?? bookBrief?.manuscriptStage,
    }),
    technicalExportable,
    publicationReady,
    readinessStatus: publicationReady ? 'publication_ready' : targetWordCountForReadiness && totalWordCount < targetWordCountForReadiness * MANUSCRIPT_INCOMPLETE_RATIO ? 'draft_incomplete' : 'blocked',
    generatedAt: new Date().toISOString(),
  };

  return {
    projectId,
    source: 'heuristic',
    overallScore,
    scores,
    publishable,
    summary: buildSummary({
      findings: sortedFindings,
      overallScore,
      sceneCount: safeScenes.length,
      totalWordCount,
    }),
    categories: buildCategories(sortedFindings),
    findings: sortedFindings,
    recommendations,
    metadata,
  };
}

function toResponse(report) {
  if (!report) return report;

  const plain = typeof report.toObject === 'function'
    ? report.toObject({ versionKey: false })
    : report;

  return {
    id: plain._id ? String(plain._id) : plain.id,
    projectId: plain.projectId ? String(plain.projectId) : plain.projectId,
    source: plain.source,
    manuscriptVersion: plain.manuscriptVersion,
    overallScore: plain.overallScore,
    scores: plain.scores,
    publishable: plain.publishable,
    summary: plain.summary,
    categories: plain.categories,
    findings: plain.findings || [],
    recommendations: plain.recommendations || [],
    editorialPasses: plain.editorialPasses || [],
    openQuestions: plain.openQuestions || [],
    revisionPlan: plain.revisionPlan || {},
    recommendedMethods: plain.recommendedMethods || [],
    editorialJudge: plain.editorialJudge || null,
    metadata: plain.metadata || {},
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
}

async function generateQualityReportForProject(projectId, options = {}) {
  const Project = require('../models/Project');
  const Bible = require('../models/Bible');
  const Scene = require('../models/Scene');
  const { getBookBriefByProjectId } = require('./bookBriefService');
  const QualityReport = require('../models/QualityReport');

  const project = await Project.findById(projectId);
  if (!project) {
    return null;
  }

  const [bible, scenes, bookBrief, publishability] = await Promise.all([
    Bible.findOne({ projectId: project._id }),
    Scene.find({ projectId: project._id }).sort({ chapterNumber: 1, beatId: 1, generatedAt: 1 }),
    getBookBriefByProjectId(project._id),
    evaluateProjectPublishability(project._id),
  ]);

  const snapshot = evaluateQualitySnapshot({
    project,
    bible,
    scenes,
    bookBrief,
    publishability,
  });

  const report = await QualityReport.create({
    projectId: project._id,
    source: snapshot.source,
    manuscriptVersion: options.manuscriptVersion || 'current',
    scores: snapshot.scores,
    publishable: snapshot.publishable,
    overallScore: snapshot.overallScore,
    categories: snapshot.categories,
    findings: snapshot.findings,
    recommendations: snapshot.recommendations,
    summary: snapshot.summary,
    metadata: snapshot.metadata,
  });

  console.log('[QUALITY_REPORT] generated', {
    projectId: project._id.toString(),
    sceneCount: snapshot.metadata.sceneCount,
    totalWordCount: snapshot.metadata.totalWordCount,
    findingCount: snapshot.findings.length,
    source: snapshot.source,
  });

  return toResponse(report);
}

module.exports = {
  evaluateQualitySnapshot,
  generateQualityReportForProject,
  toQualityReportResponse: toResponse,
};
