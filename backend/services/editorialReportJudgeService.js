const textGenerationService = require('./textGenerationService');
const {
  AI_EDITORIAL_SOURCE,
  buildEditorialQualityContext,
} = require('./aiEditorialQualityService');
const { safeErrorForLog } = require('../utils/safeLog');

const MAX_TEXT = {
  short: 160,
  medium: 700,
  long: 1400,
};

const SCORE_KEYS = [
  'overallUsefulness',
  'specificity',
  'clarity',
  'priorityAccuracy',
  'easeOfUse',
  'bookBriefRespect',
  'genrePromiseUnderstanding',
  'openQuestionQuality',
  'revisionPlanQuality',
];

const RECOMMENDED_NEXT_STEPS = new Set([
  'calibrate_editorial_prompt',
  'test_with_larger_project',
  'ready_for_rewrite_studio',
]);

const EDITORIAL_REPORT_JUDGE_SCHEMA = {
  type: 'object',
  properties: {
    scores: {
      type: 'object',
      properties: Object.fromEntries(SCORE_KEYS.map(key => [key, { type: 'number' }]))
    },
    averageScore: { type: 'number' },
    bestFinding: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        whyItWorks: { type: 'string' }
      }
    },
    worstFinding: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        whyItFails: { type: 'string' }
      }
    },
    mostUsefulSuggestion: { type: 'string' },
    genericOrWrongSuggestion: { type: 'string' },
    helpfulQuestion: { type: 'string' },
    unhelpfulQuestion: { type: 'string' },
    calibrationAdvice: { type: 'array', items: { type: 'string' } },
    readyForRewriteStudio: { type: 'boolean' },
    recommendedNextStep: { type: 'string' },
    summary: { type: 'string' }
  },
  required: [
    'scores',
    'averageScore',
    'bestFinding',
    'worstFinding',
    'mostUsefulSuggestion',
    'genericOrWrongSuggestion',
    'helpfulQuestion',
    'unhelpfulQuestion',
    'calibrationAdvice',
    'readyForRewriteStudio',
    'recommendedNextStep',
    'summary'
  ]
};

function toPlain(value) {
  return value && typeof value.toObject === 'function'
    ? value.toObject({ versionKey: false })
    : value;
}

function truncateText(value, limit = MAX_TEXT.medium) {
  if (typeof value !== 'string') return '';
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, Math.max(0, limit - 3)).trim()}...`;
}

function compactArray(items, mapper, limit = 12) {
  return Array.isArray(items) ? items.slice(0, limit).map(mapper).filter(Boolean) : [];
}

function clampJudgeScore(value, fallback = 1) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(1, Math.min(5, Math.round(number)));
}

function normalizeCode(value, fallback) {
  const text = truncateText(value || fallback, 100);
  return text ? text.replace(/\s+/g, '_').toUpperCase() : fallback;
}

function summarizeFinding(finding = {}) {
  return {
    code: normalizeCode(finding.code, 'AI_EDITORIAL_FINDING'),
    category: truncateText(finding.category, MAX_TEXT.short),
    severity: truncateText(finding.severity, 40),
    message: truncateText(finding.message, MAX_TEXT.medium),
    evidence: truncateText(finding.evidence, MAX_TEXT.medium),
    impact: truncateText(finding.impact, MAX_TEXT.medium),
    suggestions: compactArray(finding.suggestions, item => truncateText(item, MAX_TEXT.medium), 5),
    sceneId: finding.sceneId ? String(finding.sceneId) : undefined,
    beatId: finding.beatId ? String(finding.beatId) : undefined,
    chapterNumber: Number.isFinite(Number(finding.chapterNumber)) ? Number(finding.chapterNumber) : undefined,
    question: truncateText(finding.question, MAX_TEXT.medium),
  };
}

function sanitizeEditorialReport(editorialReport) {
  const report = toPlain(editorialReport) || {};
  return {
    id: report._id ? String(report._id) : report.id,
    source: report.source,
    overallScore: report.overallScore,
    publishable: Boolean(report.publishable),
    summary: truncateText(report.summary, MAX_TEXT.long),
    scores: report.scores || {},
    editorialPasses: compactArray(report.editorialPasses, pass => ({
      id: truncateText(pass.id, 100),
      name: truncateText(pass.name, MAX_TEXT.short),
      score: Number.isFinite(Number(pass.score)) ? Number(pass.score) : undefined,
      summary: truncateText(pass.summary, MAX_TEXT.medium),
      findings: compactArray(pass.findings, summarizeFinding, 8),
    }), 10),
    findings: compactArray(report.findings, summarizeFinding, 40),
    openQuestions: compactArray(report.openQuestions, question => ({
      question: truncateText(question.question, MAX_TEXT.medium),
      whyItMatters: truncateText(question.whyItMatters, MAX_TEXT.medium),
      options: compactArray(question.options, option => truncateText(option, MAX_TEXT.short), 5),
      recommendedOption: truncateText(question.recommendedOption, MAX_TEXT.short),
      impact: truncateText(question.impact, 40),
    }), 12),
    revisionPlan: {
      macro: compactArray(report.revisionPlan?.macro, item => ({
        priority: truncateText(item.priority, 40),
        title: truncateText(item.title, MAX_TEXT.short),
        reason: truncateText(item.reason, MAX_TEXT.medium),
        actions: compactArray(item.actions, action => truncateText(action, MAX_TEXT.medium), 6),
      }), 10),
      sceneLevel: compactArray(report.revisionPlan?.sceneLevel, item => ({
        priority: truncateText(item.priority, 40),
        sceneId: item.sceneId ? String(item.sceneId) : undefined,
        chapterNumber: Number.isFinite(Number(item.chapterNumber)) ? Number(item.chapterNumber) : undefined,
        issue: truncateText(item.issue, MAX_TEXT.medium),
        recommendedAction: truncateText(item.recommendedAction, MAX_TEXT.short),
      }), 16),
      lineLevel: compactArray(report.revisionPlan?.lineLevel, item => ({
        priority: truncateText(item.priority, 40),
        issue: truncateText(item.issue, MAX_TEXT.medium),
        action: truncateText(item.action, MAX_TEXT.medium),
      }), 10),
      authorDecisions: compactArray(report.revisionPlan?.authorDecisions, item => ({
        question: truncateText(item.question, MAX_TEXT.medium),
        options: compactArray(item.options, option => truncateText(option, MAX_TEXT.short), 5),
        recommendedOption: truncateText(item.recommendedOption, MAX_TEXT.short),
      }), 10),
    },
    metadata: {
      sourceVersion: report.metadata?.sourceVersion,
      contextTruncated: Boolean(report.metadata?.contextTruncated),
      sceneCount: report.metadata?.sceneCount,
      includedSceneCount: report.metadata?.includedSceneCount,
      totalWordCount: report.metadata?.totalWordCount,
    },
  };
}

function buildEditorialReportJudgeContext({ project, bookBrief, bible, scenes, editorialReport }) {
  const baseContext = buildEditorialQualityContext({
    project,
    bookBrief,
    bible,
    scenes: Array.isArray(scenes) ? scenes : [],
    publishability: null,
    heuristicQualityReport: null,
  });

  return {
    project: baseContext.project,
    bookBrief: baseContext.bookBrief,
    bible: baseContext.bible,
    scenes: baseContext.scenes,
    editorialQualityReport: sanitizeEditorialReport(editorialReport),
    metadata: {
      ...baseContext.metadata,
      judgedReportId: editorialReport?._id ? String(editorialReport._id) : editorialReport?.id,
    },
  };
}

function buildEditorialReportJudgePrompt(context) {
  return `You are StoryForge's AI Editor-in-Chief. Audit the AI Editorial QualityReport, not the manuscript itself.

Rules:
- Return only structured JSON matching the requested schema.
- Do not rewrite scenes.
- Do not alter manuscript, BookBrief, Bible, exporters, PublishingPackage, or CostLedger.
- Do not expose prompts, provider details, raw model responses, full scenes, or full manuscript text.
- Judge whether the editorial report is specific, accurate, actionable, and faithful to the BookBrief.
- Prefer concrete evidence from scene IDs, chapters, BookBrief fields, findings, questions, and revision-plan items.
- If evidence is missing, penalize specificity and explain the calibration needed.

Score each criterion from 1 to 5:
- overallUsefulness: utilidade geral.
- specificity: especificidade.
- clarity: clareza.
- priorityAccuracy: prioridade correta.
- easeOfUse: facilidade de usar.
- bookBriefRespect: respeito ao BookBrief.
- genrePromiseUnderstanding: entendimento de gênero/promessa.
- openQuestionQuality: qualidade das perguntas abertas.
- revisionPlanQuality: qualidade do plano de revisão.

Readiness rule:
- readyForRewriteStudio may be true only when averageScore is at least 4, no score is below 3, priorityAccuracy is at least 4, and revisionPlanQuality is at least 4.
- If not ready, recommendedNextStep must be calibrate_editorial_prompt or test_with_larger_project.

Sanitized context:
${JSON.stringify(context, null, 2)}`;
}

function extractJsonPayload(response) {
  if (response && typeof response === 'object') return response;
  const text = String(response || '').trim();
  if (!text) throw new Error('Editorial report judge response is empty.');

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

  throw new Error('Editorial report judge response is not valid JSON.');
}

function normalizeFindingEvaluation(value = {}, failureKey = 'whyItFails') {
  return {
    code: normalizeCode(value.code, 'UNKNOWN_FINDING'),
    ...(failureKey === 'whyItWorks'
      ? { whyItWorks: truncateText(value.whyItWorks, MAX_TEXT.long) }
      : { whyItFails: truncateText(value.whyItFails, MAX_TEXT.long) }),
  };
}

function calculateAverageScore(scores) {
  const total = SCORE_KEYS.reduce((sum, key) => sum + scores[key], 0);
  return Math.round((total / SCORE_KEYS.length) * 10) / 10;
}

function normalizeRecommendedNextStep(value, readyForRewriteStudio, averageScore) {
  const step = String(value || '').trim();
  if (readyForRewriteStudio) return 'ready_for_rewrite_studio';
  if (RECOMMENDED_NEXT_STEPS.has(step) && step !== 'ready_for_rewrite_studio') return step;
  return averageScore >= 4 ? 'test_with_larger_project' : 'calibrate_editorial_prompt';
}

function parseEditorialReportJudgeResponse(response) {
  const data = extractJsonPayload(response);
  const scores = {};
  for (const key of SCORE_KEYS) {
    scores[key] = clampJudgeScore(data?.scores?.[key], 1);
  }

  const averageScore = calculateAverageScore(scores);
  const allScoresReady = SCORE_KEYS.every(key => scores[key] >= 3);
  const readyForRewriteStudio = Boolean(
    data.readyForRewriteStudio
    && averageScore >= 4
    && allScoresReady
    && scores.priorityAccuracy >= 4
    && scores.revisionPlanQuality >= 4
  );

  return {
    scores,
    averageScore,
    bestFinding: normalizeFindingEvaluation(data.bestFinding, 'whyItWorks'),
    worstFinding: normalizeFindingEvaluation(data.worstFinding, 'whyItFails'),
    mostUsefulSuggestion: truncateText(data.mostUsefulSuggestion, MAX_TEXT.long),
    genericOrWrongSuggestion: truncateText(data.genericOrWrongSuggestion, MAX_TEXT.long),
    helpfulQuestion: truncateText(data.helpfulQuestion, MAX_TEXT.long),
    unhelpfulQuestion: truncateText(data.unhelpfulQuestion, MAX_TEXT.long),
    calibrationAdvice: compactArray(data.calibrationAdvice, item => truncateText(item, MAX_TEXT.medium), 10),
    readyForRewriteStudio,
    recommendedNextStep: normalizeRecommendedNextStep(data.recommendedNextStep, readyForRewriteStudio, averageScore),
    summary: truncateText(data.summary || 'Editorial report evaluation completed.', 1100),
    metadata: {
      evaluatedAt: new Date().toISOString(),
      scoreScale: '1-5',
      criteria: SCORE_KEYS,
    },
  };
}

function buildJudgeProjectConfig(project) {
  const plainProject = toPlain(project) || {};
  const provider = typeof process.env.EDITORIAL_JUDGE_PROVIDER === 'string' && process.env.EDITORIAL_JUDGE_PROVIDER.trim()
    ? process.env.EDITORIAL_JUDGE_PROVIDER.trim()
    : plainProject.aiProvider;
  const model = typeof process.env.EDITORIAL_JUDGE_MODEL === 'string' && process.env.EDITORIAL_JUDGE_MODEL.trim()
    ? process.env.EDITORIAL_JUDGE_MODEL.trim()
    : plainProject.aiModel;

  return {
    ...plainProject,
    aiProvider: provider,
    aiModel: model,
  };
}

async function judgeEditorialReportForProject(projectId, qualityReportId, options = {}) {
  const Project = options.Project || require('../models/Project');
  const Bible = options.Bible || require('../models/Bible');
  const Scene = options.Scene || require('../models/Scene');
  const QualityReport = options.QualityReport || require('../models/QualityReport');
  const { getBookBriefByProjectId } = options.bookBriefService || require('./bookBriefService');
  const generateStructured = options.generateStructured || textGenerationService.generateStructured;

  const [project, editorialReport] = await Promise.all([
    Project.findById(projectId),
    QualityReport.findOne({ _id: qualityReportId, projectId }),
  ]);

  if (!project) return null;
  if (!editorialReport) {
    const error = new Error('QualityReport not found.');
    error.statusCode = 404;
    throw error;
  }
  if (editorialReport.source !== AI_EDITORIAL_SOURCE) {
    const error = new Error('Only ai_editorial QualityReports can be judged.');
    error.statusCode = 400;
    throw error;
  }

  const [bookBrief, bible, scenes] = await Promise.all([
    getBookBriefByProjectId(project._id),
    Bible.findOne({ projectId: project._id }),
    Scene.find({ projectId: project._id }).sort({ chapterNumber: 1, beatId: 1, generatedAt: 1 }),
  ]);

  const context = buildEditorialReportJudgeContext({
    project,
    bookBrief,
    bible,
    scenes,
    editorialReport,
  });

  try {
    const { data, config } = await generateStructured({
      project: buildJudgeProjectConfig(project),
      prompt: buildEditorialReportJudgePrompt(context),
      schema: EDITORIAL_REPORT_JUDGE_SCHEMA,
      schemaName: 'editorial report judge',
      options: { temperature: 0.2, topP: 0.8 },
      costMetadata: {
        task: 'ai_editorial_report_judge',
        stage: 'editorial_quality',
        requestType: 'text',
        source: 'editorialReportJudgeService.judgeEditorialReportForProject',
      },
    });

    const evaluation = parseEditorialReportJudgeResponse(data);
    editorialReport.editorialJudge = {
      ...evaluation,
      metadata: {
        ...evaluation.metadata,
        provider: config?.provider,
        model: config?.model,
        judgedReportId: String(editorialReport._id || editorialReport.id),
        contextTruncated: context.metadata.contextTruncated,
        includedSceneCount: context.metadata.includedSceneCount,
        sceneCount: context.metadata.sceneCount,
      },
    };
    await editorialReport.save();

    console.log('[EDITORIAL_REPORT_JUDGE] generated', {
      projectId: project._id.toString(),
      qualityReportId: String(editorialReport._id || editorialReport.id),
      averageScore: evaluation.averageScore,
      readyForRewriteStudio: evaluation.readyForRewriteStudio,
      recommendedNextStep: evaluation.recommendedNextStep,
    });

    return editorialReport.editorialJudge;
  } catch (error) {
    console.error('[EDITORIAL_REPORT_JUDGE] generation_failed', {
      projectId: project._id.toString(),
      qualityReportId: String(editorialReport._id || editorialReport.id),
      error: safeErrorForLog(error),
    });
    throw new Error('Failed to judge AI Editorial QualityReport.');
  }
}

module.exports = {
  EDITORIAL_REPORT_JUDGE_SCHEMA,
  SCORE_KEYS,
  buildEditorialReportJudgeContext,
  buildEditorialReportJudgePrompt,
  parseEditorialReportJudgeResponse,
  judgeEditorialReportForProject,
};
