const { countWords, evaluateProjectPublishability } = require('./publishabilityService');
const { generateQualityReportForProject } = require('./qualityService');
const { generateAIEditorialQualityReportForProject } = require('./aiEditorialQualityService');
const { judgeEditorialReportForProject } = require('./editorialReportJudgeService');

const SOURCE = 'quality_validation_v1';
const MAX_TEXT = {
  short: 140,
  medium: 420,
  list: 5,
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

function formatValue(value, fallback = 'Not available') {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

function formatScore(value, suffix = '/100') {
  const number = Number(value);
  return Number.isFinite(number) ? `${Math.round(number * 10) / 10}${suffix}` : 'Not available';
}

function formatJudgeScore(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${Math.round(number * 10) / 10}/5` : 'Not available';
}

function getId(value) {
  const id = value?._id ?? value?.id;
  return id ? String(id) : null;
}

function getProjectTitle(project) {
  return project?.title || project?.name || 'Untitled project';
}

function getGenre(project, bookBrief) {
  return bookBrief?.genre || bookBrief?.subgenre || project?.style || 'Not available';
}

function getModel(project, report) {
  return report?.metadata?.model || project?.aiModel || 'Project default';
}

function summarizeItems(items, mapper, limit = MAX_TEXT.list) {
  if (!Array.isArray(items) || items.length === 0) return ['None reported'];
  const summarized = items
    .slice(0, limit)
    .map(mapper)
    .map(item => truncateText(item, MAX_TEXT.medium))
    .filter(Boolean);

  return summarized.length > 0 ? summarized : ['None reported'];
}

function summarizeFindings(findings, limit = MAX_TEXT.list) {
  return summarizeItems(findings, finding => {
    const severity = finding?.severity ? `[${finding.severity}] ` : '';
    const code = finding?.code ? `${finding.code}: ` : '';
    return `${severity}${code}${finding?.message || finding?.summary || 'Review this finding.'}`;
  }, limit);
}

function summarizeOpenQuestions(questions) {
  return summarizeItems(questions, question => {
    const options = Array.isArray(question?.options) && question.options.length > 0
      ? ` Options: ${question.options.slice(0, 3).join(' | ')}.`
      : '';
    const recommended = question?.recommendedOption ? ` Recommended: ${question.recommendedOption}.` : '';
    return `${question?.question || question}${options}${recommended}`;
  }, 4);
}

function summarizeRevisionPlan(plan = {}) {
  const macro = summarizeItems(plan.macro, item => {
    const priority = item?.priority ? `[${item.priority}] ` : '';
    return `${priority}${item?.title || item?.reason || item?.issue || 'Macro revision item.'}`;
  }, 4);
  const sceneLevel = Array.isArray(plan.sceneLevel) ? plan.sceneLevel.length : 0;
  const lineLevel = Array.isArray(plan.lineLevel) ? plan.lineLevel.length : 0;
  const authorDecisions = Array.isArray(plan.authorDecisions) ? plan.authorDecisions.length : 0;

  return [
    ...macro,
    `Scene-level items: ${sceneLevel}; line-level items: ${lineLevel}; author decisions: ${authorDecisions}.`,
  ];
}

function getRevisionPlanCounts(plan = {}) {
  return {
    macro: Array.isArray(plan.macro) ? plan.macro.length : 0,
    sceneLevel: Array.isArray(plan.sceneLevel) ? plan.sceneLevel.length : 0,
    lineLevel: Array.isArray(plan.lineLevel) ? plan.lineLevel.length : 0,
    authorDecisions: Array.isArray(plan.authorDecisions) ? plan.authorDecisions.length : 0,
  };
}

function getTopCalibrationWarnings(judge) {
  return summarizeItems(judge?.calibrationAdvice, item => item, 3);
}

function getCriticalFailures(publishability) {
  return summarizeItems(publishability?.criticalFailures, issue => `${issue?.code || 'CRITICAL'}: ${issue?.message || 'Critical readiness issue.'}`);
}

function getWarnings(publishability) {
  return summarizeItems(publishability?.warnings, issue => `${issue?.code || 'WARNING'}: ${issue?.message || 'Readiness warning.'}`);
}

function getAverageJudgeScore(judge) {
  const number = Number(judge?.averageScore);
  if (Number.isFinite(number)) return Math.round(number * 10) / 10;
  return null;
}

function getSceneCount(project, heuristicReport, aiEditorialReport) {
  return Number(heuristicReport?.metadata?.sceneCount)
    || Number(aiEditorialReport?.metadata?.sceneCount)
    || Number(project?.sceneCount)
    || 0;
}

function getApproxWordCount(project, heuristicReport, aiEditorialReport) {
  return Number(heuristicReport?.metadata?.totalWordCount)
    || Number(aiEditorialReport?.metadata?.totalWordCount)
    || Number(project?.totalWordCount)
    || 0;
}

function normalizeValidationRunResult(run) {
  if (!run) return null;
  const plain = toPlain(run);

  return {
    id: getId(plain),
    projectId: plain.projectId ? String(plain.projectId) : plain.projectId,
    status: plain.status,
    source: plain.source,
    markdownReport: plain.markdownReport,
    summary: plain.summary,
    scores: plain.scores || {},
    readiness: plain.readiness || {},
    reportIds: plain.reportIds || {},
    metadata: plain.metadata || {},
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
}

function buildQualityValidationSnapshot({
  project,
  bookBrief,
  publishability,
  heuristicReport,
  aiEditorialReport,
  editorialJudge,
} = {}) {
  const safeProject = toPlain(project) || {};
  const safeBookBrief = toPlain(bookBrief) || null;
  const safePublishability = publishability || {};
  const safeHeuristic = toPlain(heuristicReport) || null;
  const safeEditorial = toPlain(aiEditorialReport) || null;
  const safeJudge = editorialJudge || safeEditorial?.editorialJudge || null;
  const sceneCount = getSceneCount(safeProject, safeHeuristic, safeEditorial);
  const totalWordCount = getApproxWordCount(safeProject, safeHeuristic, safeEditorial);
  const readyForRewriteStudio = Boolean(safeJudge?.readyForRewriteStudio);

  return {
    source: SOURCE,
    project: {
      id: getId(safeProject),
      title: getProjectTitle(safeProject),
      genre: getGenre(safeProject, safeBookBrief),
      sceneCount,
      approxWordCount: totalWordCount,
      bookBriefFilled: Boolean(safeBookBrief),
      editorialModel: getModel(safeProject, safeEditorial),
      judgeModel: safeJudge?.metadata?.model || process.env.EDITORIAL_JUDGE_MODEL || safeProject.aiModel || 'Project default',
    },
    readiness: {
      publishable: Boolean(safePublishability.publishable),
      technicalExportable: Boolean(safePublishability.technicalExportable ?? safePublishability.checks?.exportReadiness?.status === 'passed'),
      publicationReady: Boolean(safePublishability.publicationReady ?? safePublishability.publishable),
      readinessStatus: safePublishability.readinessStatus || safePublishability.checks?.publicationReady?.readinessStatus || null,
      score: Number.isFinite(Number(safePublishability.score)) ? Number(safePublishability.score) : null,
      criticalFailures: getCriticalFailures(safePublishability),
      warnings: getWarnings(safePublishability),
      readyForRewriteStudio,
      recommendedNextStep: safeJudge?.recommendedNextStep || 'calibrate_editorial_prompt',
    },
    heuristicQualityReport: {
      id: getId(safeHeuristic),
      score: Number.isFinite(Number(safeHeuristic?.overallScore)) ? Number(safeHeuristic.overallScore) : null,
      summary: truncateText(safeHeuristic?.summary, MAX_TEXT.medium),
      mainFindings: summarizeFindings(safeHeuristic?.findings),
    },
    aiEditorialReview: {
      id: getId(safeEditorial),
      overallScore: Number.isFinite(Number(safeEditorial?.overallScore)) ? Number(safeEditorial.overallScore) : null,
      summary: truncateText(safeEditorial?.summary, MAX_TEXT.medium),
      mainStrengths: summarizeItems(safeEditorial?.editorialPasses, pass => `${pass?.name || 'Editorial pass'}: ${pass?.summary || 'Completed.'}`, 3),
      mainProblems: summarizeFindings(safeEditorial?.findings),
      openQuestions: summarizeOpenQuestions(safeEditorial?.openQuestions),
      revisionPlanSummary: summarizeRevisionPlan(safeEditorial?.revisionPlan),
      revisionPlanCounts: getRevisionPlanCounts(safeEditorial?.revisionPlan),
    },
    editorialJudge: {
      averageScore: getAverageJudgeScore(safeJudge),
      scores: safeJudge?.scores || {},
      summary: truncateText(safeJudge?.summary, MAX_TEXT.medium),
      bestFinding: safeJudge?.bestFinding || {},
      worstFinding: safeJudge?.worstFinding || {},
      mostUsefulSuggestion: truncateText(safeJudge?.mostUsefulSuggestion, MAX_TEXT.medium),
      genericOrWrongSuggestion: truncateText(safeJudge?.genericOrWrongSuggestion, MAX_TEXT.medium),
      helpfulQuestion: truncateText(safeJudge?.helpfulQuestion, MAX_TEXT.medium),
      unhelpfulQuestion: truncateText(safeJudge?.unhelpfulQuestion, MAX_TEXT.medium),
      calibrationAdvice: summarizeItems(safeJudge?.calibrationAdvice, item => item, 8),
      topCalibrationWarnings: getTopCalibrationWarnings(safeJudge),
      readyForRewriteStudio,
      recommendedNextStep: safeJudge?.recommendedNextStep || 'calibrate_editorial_prompt',
    },
    reportIds: {
      heuristicQualityReportId: getId(safeHeuristic),
      aiEditorialQualityReportId: getId(safeEditorial),
      judgedQualityReportId: getId(safeEditorial),
    },
    metadata: {
      sceneCount,
      totalWordCount,
      manuscriptStage: safeEditorial?.metadata?.manuscriptStage || safeHeuristic?.metadata?.manuscriptStage || safePublishability.readinessStatus || 'Not available',
      contextTruncated: Boolean(safeEditorial?.metadata?.contextTruncated),
      bookBriefExists: Boolean(safeBookBrief),
      editorialModel: getModel(safeProject, safeEditorial),
      judgeModel: safeJudge?.metadata?.model || process.env.EDITORIAL_JUDGE_MODEL || safeProject.aiModel || 'Project default',
      generatedAt: new Date().toISOString(),
    },
  };
}

function markdownList(items) {
  const safeItems = Array.isArray(items) && items.length > 0 ? items : ['None reported'];
  return safeItems.map(item => `- ${truncateText(item, MAX_TEXT.medium)}`).join('\n');
}

function buildManagerMarkdownReport(snapshot = {}) {
  const project = snapshot.project || {};
  const readiness = snapshot.readiness || {};
  const heuristic = snapshot.heuristicQualityReport || {};
  const editorial = snapshot.aiEditorialReview || {};
  const judge = snapshot.editorialJudge || {};
  const judgeScores = judge.scores || {};

  return `# StoryForge Quality Validation Report

## Project
- Title: ${formatValue(project.title)}
- Genre: ${formatValue(project.genre)}
- Scene count: ${formatValue(project.sceneCount, '0')}
- Approx word count: ${formatValue(project.approxWordCount, '0')}
- Manuscript stage: ${formatValue(snapshot.metadata?.manuscriptStage)}
- BookBrief filled: ${formatValue(project.bookBriefFilled)}
- Editorial model: ${formatValue(project.editorialModel)}
- Judge model: ${formatValue(project.judgeModel)}
- Context truncated: ${formatValue(snapshot.metadata?.contextTruncated)}

## Readiness
- Publishable: ${formatValue(readiness.publishable)}
- Technical exportable: ${formatValue(readiness.technicalExportable)}
- Publication ready: ${formatValue(readiness.publicationReady)}
- Readiness status: ${formatValue(readiness.readinessStatus)}
- Score: ${formatScore(readiness.score)}
- Critical failures:
${markdownList(readiness.criticalFailures)}
- Warnings:
${markdownList(readiness.warnings)}

## Heuristic QualityReport
- Score: ${formatScore(heuristic.score)}
- Main findings:
${markdownList(heuristic.mainFindings)}

## AI Editorial Review
- Overall score: ${formatScore(editorial.overallScore)}
- Main strengths:
${markdownList(editorial.mainStrengths)}
- Main problems:
${markdownList(editorial.mainProblems)}
- Open questions:
${markdownList(editorial.openQuestions)}
- Revision plan summary:
${markdownList(editorial.revisionPlanSummary)}
- Revision plan item counts: macro ${formatValue(editorial.revisionPlanCounts?.macro, '0')}; scene-level ${formatValue(editorial.revisionPlanCounts?.sceneLevel, '0')}; line-level ${formatValue(editorial.revisionPlanCounts?.lineLevel, '0')}; author decisions ${formatValue(editorial.revisionPlanCounts?.authorDecisions, '0')}.

## Editorial Judge
- Average score: ${formatJudgeScore(judge.averageScore)}
- Overall usefulness: ${formatJudgeScore(judgeScores.overallUsefulness)}
- Specificity: ${formatJudgeScore(judgeScores.specificity)}
- Clarity: ${formatJudgeScore(judgeScores.clarity)}
- Priority accuracy: ${formatJudgeScore(judgeScores.priorityAccuracy)}
- BookBrief respect: ${formatJudgeScore(judgeScores.bookBriefRespect)}
- Genre/promise understanding: ${formatJudgeScore(judgeScores.genrePromiseUnderstanding)}
- Open question quality: ${formatJudgeScore(judgeScores.openQuestionQuality)}
- Revision plan quality: ${formatJudgeScore(judgeScores.revisionPlanQuality)}
- Ready for Rewrite Studio: ${formatValue(judge.readyForRewriteStudio)}
- Recommended next step: ${formatValue(judge.recommendedNextStep)}

## Best / Worst
- Best finding: ${formatValue(judge.bestFinding?.code)} - ${formatValue(judge.bestFinding?.whyItWorks)}
- Worst finding: ${formatValue(judge.worstFinding?.code)} - ${formatValue(judge.worstFinding?.whyItFails)}
- Most useful suggestion: ${formatValue(judge.mostUsefulSuggestion)}
- Generic or wrong suggestion: ${formatValue(judge.genericOrWrongSuggestion)}
- Helpful question: ${formatValue(judge.helpfulQuestion)}
- Unhelpful question: ${formatValue(judge.unhelpfulQuestion)}

## Calibration Advice
${markdownList(judge.calibrationAdvice)}

## Top Calibration Warnings
${markdownList(judge.topCalibrationWarnings)}

## Request for Manager Review
Please analyze this report and recommend whether the next step should be:
1. calibrate the editorial prompt,
2. test another story,
3. proceed to Rewrite Studio.
`;
}

function buildSummary(snapshot) {
  const title = snapshot.project?.title || 'Project';
  const judgeScore = snapshot.editorialJudge?.averageScore;
  const nextStep = snapshot.editorialJudge?.recommendedNextStep || snapshot.readiness?.recommendedNextStep;

  return `${title}: validation run completed. Judge average: ${formatJudgeScore(judgeScore)}. Recommended next step: ${nextStep || 'Not available'}.`;
}

async function getLatestQualityValidationRun(projectId, options = {}) {
  const QualityValidationRun = options.QualityValidationRun || require('../models/QualityValidationRun');
  const run = await QualityValidationRun.findOne({ projectId }).sort({ createdAt: -1 });
  return normalizeValidationRunResult(run);
}

async function runQualityValidationForProject(projectId, options = {}) {
  const Project = options.Project || require('../models/Project');
  const Scene = options.Scene || require('../models/Scene');
  const QualityReport = options.QualityReport || require('../models/QualityReport');
  const QualityValidationRun = options.QualityValidationRun || require('../models/QualityValidationRun');
  const { getBookBriefByProjectId } = options.bookBriefService || require('./bookBriefService');
  const evaluatePublishability = options.evaluateProjectPublishability || evaluateProjectPublishability;
  const generateHeuristic = options.generateQualityReportForProject || generateQualityReportForProject;
  const generateEditorial = options.generateAIEditorialQualityReportForProject || generateAIEditorialQualityReportForProject;
  const judgeEditorial = options.judgeEditorialReportForProject || judgeEditorialReportForProject;
  const runOptions = {
    regenerateHeuristic: true,
    regenerateEditorial: true,
    regenerateJudge: true,
    ...options,
  };

  const project = await Project.findById(projectId);
  if (!project) return null;

  const [bookBrief, publishability, scenes] = await Promise.all([
    getBookBriefByProjectId(project._id),
    evaluatePublishability(project._id),
    Scene.find({ projectId: project._id }),
  ]);

  let heuristicReport = null;
  if (runOptions.regenerateHeuristic) {
    heuristicReport = await generateHeuristic(project._id, runOptions);
  } else {
    heuristicReport = await QualityReport.findOne({ projectId: project._id, source: 'heuristic' }).sort({ createdAt: -1 });
  }

  let aiEditorialReport = null;
  if (runOptions.regenerateEditorial) {
    aiEditorialReport = await generateEditorial(project._id, runOptions);
  } else {
    aiEditorialReport = await QualityReport.findOne({ projectId: project._id, source: 'ai_editorial' }).sort({ createdAt: -1 });
  }

  let editorialJudge = aiEditorialReport?.editorialJudge || null;
  if (runOptions.regenerateJudge && aiEditorialReport?.id) {
    editorialJudge = await judgeEditorial(project._id, aiEditorialReport.id, runOptions);
  } else if (runOptions.regenerateJudge && aiEditorialReport?._id) {
    editorialJudge = await judgeEditorial(project._id, aiEditorialReport._id, runOptions);
  }

  const sceneWordCount = Array.isArray(scenes)
    ? scenes.reduce((sum, scene) => sum + (Number(scene?.wordCount) > 0 ? Number(scene.wordCount) : countWords(scene?.content)), 0)
    : 0;
  const heuristicWithMetadata = heuristicReport ? {
    ...toPlain(heuristicReport),
    metadata: {
      ...(toPlain(heuristicReport)?.metadata || {}),
      sceneCount: toPlain(heuristicReport)?.metadata?.sceneCount ?? scenes.length,
      totalWordCount: toPlain(heuristicReport)?.metadata?.totalWordCount ?? sceneWordCount,
    },
  } : null;
  const snapshot = buildQualityValidationSnapshot({
    project,
    bookBrief,
    publishability,
    heuristicReport: heuristicWithMetadata,
    aiEditorialReport,
    editorialJudge,
  });
  const markdownReport = buildManagerMarkdownReport(snapshot);
  const validationRun = await QualityValidationRun.create({
    projectId: project._id,
    status: editorialJudge ? 'success' : 'partial',
    source: SOURCE,
    markdownReport,
    summary: buildSummary(snapshot),
    scores: {
      averageJudgeScore: snapshot.editorialJudge.averageScore,
      editorialOverallScore: snapshot.aiEditorialReview.overallScore,
      heuristicOverallScore: snapshot.heuristicQualityReport.score,
      publishabilityScore: snapshot.readiness.score,
    },
    readiness: {
      publishable: snapshot.readiness.publishable,
      technicalExportable: snapshot.readiness.technicalExportable,
      publicationReady: snapshot.readiness.publicationReady,
      readinessStatus: snapshot.readiness.readinessStatus,
      readyForRewriteStudio: snapshot.readiness.readyForRewriteStudio,
      recommendedNextStep: snapshot.readiness.recommendedNextStep,
    },
    reportIds: snapshot.reportIds,
    metadata: snapshot.metadata,
  });

  console.log('[QUALITY_VALIDATION_RUN] generated', {
    projectId: String(project._id),
    status: validationRun.status,
    heuristicQualityReportId: snapshot.reportIds.heuristicQualityReportId,
    aiEditorialQualityReportId: snapshot.reportIds.aiEditorialQualityReportId,
    recommendedNextStep: snapshot.readiness.recommendedNextStep,
  });

  return {
    exists: true,
    validationRun: normalizeValidationRunResult(validationRun),
    markdownReport,
  };
}

module.exports = {
  SOURCE,
  buildQualityValidationSnapshot,
  buildManagerMarkdownReport,
  runQualityValidationForProject,
  getLatestQualityValidationRun,
  normalizeValidationRunResult,
};
