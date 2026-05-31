const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildQualityValidationSnapshot,
  buildManagerMarkdownReport,
  runQualityValidationForProject,
} = require('../services/qualityValidationRunService');

function baseProject(overrides = {}) {
  return {
    _id: 'project-1',
    name: 'Relatorio de Teste',
    style: 'Fantasia urbana',
    aiModel: 'fake-editor-model',
    ...overrides,
  };
}

function baseBookBrief(overrides = {}) {
  return {
    _id: 'brief-1',
    projectId: 'project-1',
    genre: 'Fantasia',
    corePromise: 'SECRET_BOOKBRIEF_FULL_TEXT',
    ...overrides,
  };
}

function basePublishability(overrides = {}) {
  return {
    publishable: false,
    score: 72,
    criticalFailures: [{ code: 'SCENES_MISSING', message: 'Project has no scenes.' }],
    warnings: [{ code: 'AI_DISCLOSURE_MISSING', message: 'AI disclosure is not configured.' }],
    ...overrides,
  };
}

function baseHeuristicReport(overrides = {}) {
  return {
    _id: 'heuristic-1',
    id: 'heuristic-1',
    overallScore: 68,
    summary: 'Heuristic summary.',
    findings: [
      { code: 'QUALITY_SCENE_TOO_SHORT', severity: 'warning', message: 'Scene is very short.' },
      { code: 'QUALITY_PROMPT_LEAK', severity: 'warning', message: 'Prompt marker detected.' },
    ],
    metadata: { sceneCount: 2, totalWordCount: 940, bookBriefExists: true },
    ...overrides,
  };
}

function baseAiEditorialReport(overrides = {}) {
  return {
    _id: 'editorial-1',
    id: 'editorial-1',
    source: 'ai_editorial',
    overallScore: 71,
    summary: 'AI editorial summary.',
    editorialPasses: [{ name: 'Structural Editor', summary: 'The premise has a clear hook.' }],
    findings: [
      { code: 'MIDPOINT_WEAK', severity: 'high', message: 'The midpoint does not force a new strategy.' },
    ],
    openQuestions: [{ question: 'What must the protagonist risk in the climax?' }],
    revisionPlan: {
      macro: [{ priority: 'high', title: 'Strengthen the midpoint.' }],
      sceneLevel: [{ issue: 'Low conflict.' }],
      lineLevel: [{ issue: 'Generic prose.' }],
      authorDecisions: [{ question: 'Reveal the secret earlier?' }],
    },
    metadata: { sceneCount: 2, totalWordCount: 940, model: 'fake-editor-model', manuscriptStage: 'partial_draft', contextTruncated: false },
    ...overrides,
  };
}

function baseJudge(overrides = {}) {
  return {
    scores: {
      overallUsefulness: 4,
      specificity: 3,
      clarity: 4,
      priorityAccuracy: 3,
      easeOfUse: 4,
      bookBriefRespect: 5,
      genrePromiseUnderstanding: 4,
      openQuestionQuality: 4,
      revisionPlanQuality: 3,
    },
    averageScore: 3.8,
    bestFinding: { code: 'MIDPOINT_WEAK', whyItWorks: 'It points to a concrete structural turn.' },
    worstFinding: { code: 'VOICE_GENERIC', whyItFails: 'It lacks enough evidence.' },
    mostUsefulSuggestion: 'Tie the midpoint to a costly protagonist choice.',
    genericOrWrongSuggestion: 'Improve tension everywhere.',
    helpfulQuestion: 'What cost changes the protagonist after the midpoint?',
    unhelpfulQuestion: 'Is the story good?',
    calibrationAdvice: ['Require scene references for high-priority findings.'],
    readyForRewriteStudio: false,
    recommendedNextStep: 'calibrate_editorial_prompt',
    metadata: { model: 'fake-judge-model' },
    ...overrides,
  };
}

test('buildManagerMarkdownReport includes required sections and judge scores', () => {
  const snapshot = buildQualityValidationSnapshot({
    project: baseProject(),
    bookBrief: baseBookBrief(),
    publishability: basePublishability(),
    heuristicReport: baseHeuristicReport(),
    aiEditorialReport: baseAiEditorialReport(),
    editorialJudge: baseJudge(),
  });
  const markdown = buildManagerMarkdownReport(snapshot);

  assert.match(markdown, /# StoryForge Quality Validation Report/);
  assert.match(markdown, /## Project/);
  assert.match(markdown, /## Readiness/);
  assert.match(markdown, /## Heuristic QualityReport/);
  assert.match(markdown, /## AI Editorial Review/);
  assert.match(markdown, /## Editorial Judge/);
  assert.match(markdown, /Average score: 3.8\/5/);
  assert.match(markdown, /Recommended next step: calibrate_editorial_prompt/);
  assert.match(markdown, /Manuscript stage: partial_draft/);
  assert.match(markdown, /Technical exportable:/);
  assert.match(markdown, /Publication ready:/);
  assert.match(markdown, /Context truncated: No/);
  assert.match(markdown, /Revision plan item counts: macro 1; scene-level 1; line-level 1; author decisions 1\./);
  assert.match(markdown, /## Top Calibration Warnings/);
  assert.match(markdown, /## Request for Manager Review/);
});

test('manager markdown avoids manuscript, prompts, raw responses and raw JSON payloads', () => {
  const snapshot = buildQualityValidationSnapshot({
    project: {
      ...baseProject(),
      originalFilePath: 'SECRET_MANUSCRIPT_PATH',
      rawManuscript: 'SECRET_FULL_MANUSCRIPT',
    },
    bookBrief: baseBookBrief(),
    publishability: basePublishability(),
    heuristicReport: {
      ...baseHeuristicReport(),
      prompt: 'SECRET_FULL_PROMPT',
      rawResponse: 'SECRET_RAW_AI_RESPONSE',
      scenes: [{ content: 'SECRET_FULL_SCENE' }],
    },
    aiEditorialReport: baseAiEditorialReport({
      prompt: 'SECRET_FULL_PROMPT',
      rawResponse: 'SECRET_RAW_AI_RESPONSE',
      manuscript: 'SECRET_FULL_MANUSCRIPT',
    }),
    editorialJudge: baseJudge(),
  });
  const markdown = buildManagerMarkdownReport(snapshot);

  assert.equal(markdown.includes('SECRET_FULL_MANUSCRIPT'), false);
  assert.equal(markdown.includes('SECRET_FULL_SCENE'), false);
  assert.equal(markdown.includes('SECRET_FULL_PROMPT'), false);
  assert.equal(markdown.includes('SECRET_RAW_AI_RESPONSE'), false);
  assert.equal(markdown.includes('SECRET_BOOKBRIEF_FULL_TEXT'), false);
  assert.equal(markdown.includes('"rawResponse"'), false);
});

test('buildQualityValidationSnapshot works with minimal data and missing BookBrief or Judge', () => {
  const snapshot = buildQualityValidationSnapshot({
    project: baseProject({ aiModel: undefined }),
    bookBrief: null,
    publishability: { publishable: true, score: 95, criticalFailures: [], warnings: [] },
    heuristicReport: null,
    aiEditorialReport: null,
    editorialJudge: null,
  });

  assert.equal(snapshot.project.bookBriefFilled, false);
  assert.equal(snapshot.readiness.publishable, true);
  assert.equal(snapshot.editorialJudge.averageScore, null);
  assert.equal(snapshot.editorialJudge.recommendedNextStep, 'calibrate_editorial_prompt');
  assert.deepEqual(snapshot.heuristicQualityReport.mainFindings, ['None reported']);
});

test('runQualityValidationForProject uses fakes, saves summary, and does not mutate source documents', async () => {
  let savedRun = null;
  let aiCalled = false;
  let judgeCalled = false;
  const project = baseProject();
  const bookBrief = baseBookBrief();
  const scenes = [{ _id: 'scene-1', content: 'Original scene text.', wordCount: 3 }];
  const originalSceneContent = scenes[0].content;
  const originalBookBriefGenre = bookBrief.genre;

  const result = await runQualityValidationForProject('project-1', {
    Project: { findById: async () => project },
    Scene: { find: async () => scenes },
    QualityReport: { findOne: () => ({ sort: async () => null }) },
    QualityValidationRun: {
      create: async (payload) => {
        savedRun = { _id: 'validation-1', ...payload, createdAt: new Date(), updatedAt: new Date() };
        return savedRun;
      },
    },
    bookBriefService: { getBookBriefByProjectId: async () => bookBrief },
    evaluateProjectPublishability: async () => basePublishability({ criticalFailures: [], warnings: [] }),
    generateQualityReportForProject: async () => baseHeuristicReport(),
    generateAIEditorialQualityReportForProject: async () => {
      aiCalled = true;
      return baseAiEditorialReport();
    },
    judgeEditorialReportForProject: async () => {
      judgeCalled = true;
      return baseJudge();
    },
  });

  assert.equal(aiCalled, true);
  assert.equal(judgeCalled, true);
  assert.equal(result.exists, true);
  assert.equal(result.validationRun.status, 'success');
  assert.equal(savedRun.metadata.sceneCount, 2);
  assert.equal(savedRun.metadata.bookBriefExists, true);
  assert.equal(savedRun.metadata.rawResponse, undefined);
  assert.equal(savedRun.metadata.prompt, undefined);
  assert.equal(scenes[0].content, originalSceneContent);
  assert.equal(bookBrief.genre, originalBookBriefGenre);
});
