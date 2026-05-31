const textGenerationService = require('./textGenerationService');
const { normalizeBookBriefInput, upsertBookBriefForProject } = require('./bookBriefService');
const { selectNarrativeMethods } = require('./narrativeMethods');
const { safeErrorForLog } = require('../utils/safeLog');

const TEXT_LIMITS = {
  premise: 700,
  summary: 900,
  bibleSection: 1200,
  sceneSummary: 420,
  sceneContent: 260
};

const AI_BOOK_BRIEF_SCHEMA = {
  type: 'object',
  properties: {
    suggestedBookBrief: {
      type: 'object',
      properties: {
        genre: { type: 'string' },
        subgenre: { type: 'string' },
        targetAudience: { type: 'string' },
        language: { type: 'string' },
        tone: { type: 'string' },
        narrativeVoice: { type: 'string' },
        targetWordCount: { type: 'number' },
        targetChapterCount: { type: 'number' },
        corePromise: { type: 'string' },
        protagonistWant: { type: 'string' },
        protagonistNeed: { type: 'string' },
        centralConflict: { type: 'string' },
        readerAppeal: { type: 'array', items: { type: 'string' } },
        mustInclude: { type: 'array', items: { type: 'string' } },
        mustAvoid: { type: 'array', items: { type: 'string' } },
        keywords: { type: 'array', items: { type: 'string' } },
        notes: { type: 'string' }
      },
      required: ['genre', 'targetAudience', 'corePromise', 'centralConflict']
    },
    confidence: { type: 'number' },
    storyDiagnosis: {
      type: 'object',
      properties: {
        premise: { type: 'string' },
        strengths: { type: 'array', items: { type: 'string' } },
        weaknesses: { type: 'array', items: { type: 'string' } },
        missingDecisions: { type: 'array', items: { type: 'string' } }
      },
      required: ['premise', 'strengths', 'weaknesses', 'missingDecisions']
    },
    recommendedMethods: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          reason: { type: 'string' },
          priority: { type: 'string' }
        },
        required: ['id', 'name', 'reason']
      }
    },
    openQuestions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          question: { type: 'string' },
          whyItMatters: { type: 'string' },
          options: { type: 'array', items: { type: 'string' } },
          recommendedOption: { type: 'string' },
          impact: { type: 'string' },
          scope: { type: 'string' }
        },
        required: ['id', 'question', 'whyItMatters', 'options', 'impact', 'scope']
      }
    },
    directionOptions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          tonalImpact: { type: 'string' },
          plotImpact: { type: 'string' },
          characterImpact: { type: 'string' },
          commercialImpact: { type: 'string' },
          risks: { type: 'array', items: { type: 'string' } }
        },
        required: ['title', 'description', 'tonalImpact', 'plotImpact', 'characterImpact', 'risks']
      }
    },
    risks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          issue: { type: 'string' },
          severity: { type: 'string' },
          mitigation: { type: 'string' }
        },
        required: ['issue', 'severity', 'mitigation']
      }
    }
  },
  required: ['suggestedBookBrief', 'confidence', 'storyDiagnosis', 'recommendedMethods', 'openQuestions', 'directionOptions', 'risks']
};

function truncateText(value, limit) {
  if (typeof value !== 'string') return '';
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, Math.max(0, limit - 3)).trim()}...`;
}

function summarizeArray(items, mapper, limit = 8) {
  return Array.isArray(items) ? items.slice(0, limit).map(mapper).filter(Boolean) : [];
}

function toPlain(value) {
  return value && typeof value.toObject === 'function'
    ? value.toObject({ versionKey: false })
    : value;
}

function buildSanitizedStoryContext({ project, bookBrief, bible, scenes }) {
  const plainBrief = toPlain(bookBrief) || {};
  const chapters = summarizeArray(bible?.chapters, chapter => ({
    chapterNumber: chapter.chapterNumber,
    title: truncateText(chapter.title, 120),
    type: truncateText(chapter.type, 80),
    aiSummary: truncateText(chapter.aiSummary, TEXT_LIMITS.summary),
    beats: summarizeArray(chapter.beats, beat => ({
      id: beat.id,
      title: truncateText(beat.title, 120),
      description: truncateText(beat.description, 260)
    }), 10)
  }), 12);

  return {
    project: {
      name: truncateText(project?.name, 160),
      style: truncateText(project?.style, 120),
      language: truncateText(project?.language, 80),
      premise: truncateText(project?.premise, TEXT_LIMITS.premise),
      isShortStory: Boolean(project?.isShortStory),
      targetWordCount: project?.targetWordCount
    },
    currentBookBrief: {
      genre: plainBrief.genre,
      subgenre: plainBrief.subgenre,
      targetAudience: plainBrief.targetAudience,
      language: plainBrief.language,
      tone: plainBrief.tone,
      narrativeVoice: plainBrief.narrativeVoice,
      targetWordCount: plainBrief.targetWordCount,
      targetChapterCount: plainBrief.targetChapterCount,
      corePromise: plainBrief.corePromise,
      protagonistWant: plainBrief.protagonistWant,
      protagonistNeed: plainBrief.protagonistNeed,
      centralConflict: plainBrief.centralConflict,
      readerAppeal: Array.isArray(plainBrief.readerAppeal) ? plainBrief.readerAppeal.slice(0, 8) : [],
      mustInclude: Array.isArray(plainBrief.mustInclude) ? plainBrief.mustInclude.slice(0, 8) : [],
      mustAvoid: Array.isArray(plainBrief.mustAvoid) ? plainBrief.mustAvoid.slice(0, 8) : []
    },
    bible: bible ? {
      summary: truncateText(bible.summary, TEXT_LIMITS.bibleSection),
      premise: truncateText(bible.premise, TEXT_LIMITS.bibleSection),
      theCrucible: truncateText(bible.theCrucible, TEXT_LIMITS.bibleSection),
      characters: summarizeArray(bible.characters, character => ({
        name: truncateText(character.name, 100),
        role: truncateText(character.role, 100),
        archetype: truncateText(character.archetype, 100),
        motivation: truncateText(character.motivation, 260),
        description: truncateText(character.description, 320)
      }), 12),
      settings: summarizeArray(bible.settings, setting => ({
        name: truncateText(setting.name, 100),
        type: truncateText(setting.type, 100),
        description: truncateText(setting.description, 260)
      }), 10),
      chapters
    } : null,
    scenes: summarizeArray(scenes, scene => ({
      beatId: scene.beatId,
      chapterNumber: scene.chapterNumber,
      title: truncateText(scene.title, 120),
      status: scene.status,
      wordCount: scene.wordCount,
      summary: truncateText(scene.summary, TEXT_LIMITS.sceneSummary),
      excerpt: truncateText(scene.content, TEXT_LIMITS.sceneContent)
    }), 20)
  };
}

function buildPrompt(context, methodSelection) {
  return `You are StoryForge's AI literary editor. Create an editorial BookBrief suggestion and direction engine output.

Rules:
- Respond only as structured JSON matching the provided schema.
- Do not rewrite scenes.
- Do not apply changes automatically.
- Ask clear questions where the author's decision matters.
- Use narrative methods as operational lenses, not copied course or book content.
- Keep feedback specific, actionable, and in the project's language when possible.

Recommended method selection:
${JSON.stringify(methodSelection, null, 2)}

Sanitized project context:
${JSON.stringify(context, null, 2)}
`;
}

function normalizeConfidence(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0.5;
  if (number > 1) return Math.max(0, Math.min(1, number / 100));
  return Math.max(0, Math.min(1, number));
}

function normalizeOpenQuestions(questions = []) {
  return (Array.isArray(questions) ? questions : []).slice(0, 10).map((question, index) => ({
    id: truncateText(question.id, 80) || `question_${index + 1}`,
    question: truncateText(question.question, 500),
    whyItMatters: truncateText(question.whyItMatters, 700),
    options: Array.isArray(question.options) ? question.options.map(option => truncateText(option, 220)).filter(Boolean).slice(0, 5) : [],
    recommendedOption: truncateText(question.recommendedOption, 220),
    impact: truncateText(question.impact, 120) || 'medium',
    scope: truncateText(question.scope, 120) || 'book'
  })).filter(question => question.question && question.options.length > 0);
}

function normalizeDirectionOptions(options = []) {
  return (Array.isArray(options) ? options : []).slice(0, 4).map((option, index) => ({
    title: truncateText(option.title, 160) || `Option ${index + 1}`,
    description: truncateText(option.description, 900),
    tonalImpact: truncateText(option.tonalImpact, 500),
    plotImpact: truncateText(option.plotImpact, 500),
    characterImpact: truncateText(option.characterImpact, 500),
    commercialImpact: truncateText(option.commercialImpact, 500),
    risks: Array.isArray(option.risks) ? option.risks.map(risk => truncateText(risk, 240)).filter(Boolean).slice(0, 6) : []
  })).filter(option => option.description);
}

function normalizeAiSuggestion(data, fallbackMethods) {
  const suggestedBookBrief = normalizeBookBriefInput(data?.suggestedBookBrief || {});
  return {
    suggestedBookBrief,
    confidence: normalizeConfidence(data?.confidence),
    storyDiagnosis: {
      premise: truncateText(data?.storyDiagnosis?.premise, 900),
      strengths: summarizeArray(data?.storyDiagnosis?.strengths, item => truncateText(item, 260), 8),
      weaknesses: summarizeArray(data?.storyDiagnosis?.weaknesses, item => truncateText(item, 260), 8),
      missingDecisions: summarizeArray(data?.storyDiagnosis?.missingDecisions, item => truncateText(item, 260), 8)
    },
    recommendedMethods: summarizeArray(data?.recommendedMethods, method => ({
      id: truncateText(method.id, 100),
      name: truncateText(method.name, 160),
      reason: truncateText(method.reason, 500),
      priority: truncateText(method.priority, 80) || 'medium'
    }), 8).filter(method => method.id && method.name),
    openQuestions: normalizeOpenQuestions(data?.openQuestions),
    directionOptions: normalizeDirectionOptions(data?.directionOptions),
    risks: summarizeArray(data?.risks, risk => ({
      issue: truncateText(risk.issue, 360),
      severity: truncateText(risk.severity, 80) || 'medium',
      mitigation: truncateText(risk.mitigation, 500)
    }), 10).filter(risk => risk.issue),
    methodSelection: fallbackMethods
  };
}

async function suggestBookBriefForProject(projectId, options = {}) {
  const Project = options.Project || require('../models/Project');
  const Bible = options.Bible || require('../models/Bible');
  const Scene = options.Scene || require('../models/Scene');
  const { getBookBriefByProjectId } = options.bookBriefService || require('./bookBriefService');
  const generateStructured = options.generateStructured || textGenerationService.generateStructured;

  const project = await Project.findById(projectId);
  if (!project) return null;

  const [bookBrief, bible, scenes] = await Promise.all([
    getBookBriefByProjectId(project._id),
    Bible.findOne({ projectId: project._id }),
    Scene.find({ projectId: project._id }).sort({ chapterNumber: 1, beatId: 1, generatedAt: 1 }).limit(40)
  ]);

  const context = buildSanitizedStoryContext({ project, bookBrief, bible, scenes });
  const methodSelection = selectNarrativeMethods({
    genre: context.currentBookBrief.genre,
    subgenre: context.currentBookBrief.subgenre,
    targetAudience: context.currentBookBrief.targetAudience,
    tone: context.currentBookBrief.tone,
    projectStyle: context.project.style,
    stage: scenes?.length > 0 ? 'draft revision' : bible ? 'outline' : 'idea'
  });

  try {
    const { data } = await generateStructured({
      project,
      prompt: buildPrompt(context, methodSelection),
      schema: AI_BOOK_BRIEF_SCHEMA,
      schemaName: 'ai book brief suggestion',
      costMetadata: {
        task: 'ai_book_brief_suggest',
        stage: 'editorial_direction',
        requestType: 'text',
        source: 'storyDirectionService.suggestBookBriefForProject'
      }
    });

    const suggestion = normalizeAiSuggestion(data, methodSelection);
    console.log('[AI_BOOK_BRIEF] suggestion_generated', {
      projectId: project._id.toString(),
      confidence: suggestion.confidence,
      openQuestionCount: suggestion.openQuestions.length,
      directionOptionCount: suggestion.directionOptions.length,
      methodCount: suggestion.recommendedMethods.length
    });
    return suggestion;
  } catch (error) {
    console.error('[AI_BOOK_BRIEF] suggestion_failed', {
      projectId: project._id.toString(),
      error: safeErrorForLog(error)
    });
    throw new Error('Failed to generate AI BookBrief suggestion.');
  }
}

const APPLYABLE_FIELDS = new Set([
  'genre',
  'subgenre',
  'targetAudience',
  'language',
  'tone',
  'narrativeVoice',
  'targetWordCount',
  'targetChapterCount',
  'corePromise',
  'protagonistWant',
  'protagonistNeed',
  'centralConflict',
  'readerAppeal',
  'mustInclude',
  'mustAvoid',
  'comparableTitles',
  'keywords',
  'notes',
  'contentGuidelines'
]);

function pickApprovedFields(suggestion = {}, approvedFields = []) {
  const source = suggestion?.suggestedBookBrief || suggestion || {};
  const picked = {};
  for (const field of approvedFields) {
    if (APPLYABLE_FIELDS.has(field) && Object.prototype.hasOwnProperty.call(source, field)) {
      picked[field] = source[field];
    }
  }
  return picked;
}

async function applyBookBriefSuggestion(projectId, { suggestion, approvedFields } = {}) {
  if (!Array.isArray(approvedFields) || approvedFields.length === 0) {
    const error = new Error('At least one approved field is required.');
    error.name = 'BookBriefApplyValidationError';
    throw error;
  }

  const approvedInput = pickApprovedFields(suggestion, approvedFields);
  if (Object.keys(approvedInput).length === 0) {
    const error = new Error('No approved fields are applicable to BookBrief.');
    error.name = 'BookBriefApplyValidationError';
    throw error;
  }

  const { getBookBriefByProjectId } = require('./bookBriefService');
  const current = await getBookBriefByProjectId(projectId);
  const currentPlain = toPlain(current) || {};
  const mergedInput = {
    ...currentPlain,
    ...approvedInput
  };

  for (const internalField of ['_id', 'id', 'projectId', 'createdAt', 'updatedAt', '__v']) {
    delete mergedInput[internalField];
  }

  const bookBrief = await upsertBookBriefForProject(projectId, mergedInput);
  console.log('[AI_BOOK_BRIEF] suggestion_applied', {
    projectId: projectId.toString(),
    approvedFieldCount: Object.keys(approvedInput).length,
    approvedFields: Object.keys(approvedInput)
  });

  return {
    appliedFields: Object.keys(approvedInput),
    bookBrief
  };
}

module.exports = {
  AI_BOOK_BRIEF_SCHEMA,
  APPLYABLE_FIELDS,
  buildSanitizedStoryContext,
  selectNarrativeMethods,
  suggestBookBriefForProject,
  applyBookBriefSuggestion,
  pickApprovedFields
};
