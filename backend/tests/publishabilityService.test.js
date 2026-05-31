const test = require('node:test');
const assert = require('node:assert/strict');

const {
  countWords,
  evaluatePublishabilitySnapshot,
} = require('../services/publishabilityService');

function words(count) {
  return Array.from({ length: count }, (_, index) => `word${index + 1}`).join(' ');
}

function issueCodes(issues) {
  return issues.map((issue) => issue.code);
}

function baseProject(overrides = {}) {
  return {
    _id: 'project-1',
    name: 'Publishable Draft',
    isShortStory: false,
    ...overrides,
  };
}

function baseBible() {
  return {
    chapters: [
      {
        chapterNumber: 1,
        beats: [{ id: 1 }, { id: 2 }],
      },
    ],
  };
}

function baseScenes(overrides = {}) {
  return [
    {
      beatId: 1,
      chapterNumber: 1,
      content: words(80),
      ...overrides,
    },
    {
      beatId: 2,
      chapterNumber: 1,
      content: words(90),
    },
  ];
}

function baseBookBrief(overrides = {}) {
  return {
    aiDisclosure: 'not_configured',
    humanReviewStatus: 'not_tracked',
    monetizationMode: 'undecided',
    ...overrides,
  };
}

test('countWords counts non-empty tokens and handles empty input', () => {
  assert.equal(countWords('one two\nthree'), 3);
  assert.equal(countWords('   '), 0);
  assert.equal(countWords(null), 0);
});

test('project not found is not publishable', () => {
  const result = evaluatePublishabilitySnapshot({ project: null, bible: null, scenes: [] });

  assert.equal(result.publishable, false);
  assert.equal(result.score, 0);
  assert.ok(issueCodes(result.criticalFailures).includes('PROJECT_NOT_FOUND'));
});

test('project without scenes is not publishable', () => {
  const result = evaluatePublishabilitySnapshot({
    project: baseProject(),
    bible: baseBible(),
    scenes: [],
  });

  assert.equal(result.publishable, false);
  assert.ok(issueCodes(result.criticalFailures).includes('SCENES_MISSING'));
});

test('empty scene content blocks publishability', () => {
  const result = evaluatePublishabilitySnapshot({
    project: baseProject(),
    bible: baseBible(),
    scenes: baseScenes({ content: ' ' }),
  });

  assert.equal(result.publishable, false);
  assert.ok(issueCodes(result.criticalFailures).includes('SCENE_CONTENT_MISSING'));
});

test('project with valid scenes and tracked review metadata is publishable', () => {
  const result = evaluatePublishabilitySnapshot({
    project: baseProject({
      aiDisclosure: 'AI-assisted drafting disclosed.',
      humanReviewStatus: 'reviewed',
    }),
    bible: baseBible(),
    scenes: baseScenes(),
  });

  assert.equal(result.publishable, true);
  assert.deepEqual(result.criticalFailures, []);
  assert.equal(result.checks.exportReadiness.status, 'passed');
});

test('total word count far below target creates incomplete manuscript warning and blocks publication readiness', () => {
  const result = evaluatePublishabilitySnapshot({
    project: baseProject({ targetWordCount: 1000 }),
    bible: baseBible(),
    scenes: baseScenes(),
  });

  assert.ok(issueCodes(result.warnings).includes('WORD_COUNT_LOW'));
  assert.ok(issueCodes(result.warnings).includes('MANUSCRIPT_INCOMPLETE_FOR_TARGET'));
  assert.equal(result.technicalExportable, true);
  assert.equal(result.publicationReady, false);
  assert.equal(result.publishable, false);
  assert.equal(result.readinessStatus, 'draft_incomplete');
});

test('80000 target and 3745 words is exportable but not publication ready', () => {
  const result = evaluatePublishabilitySnapshot({
    project: baseProject({ targetWordCount: 80000 }),
    bible: null,
    scenes: [
      { content: words(940) },
      { content: words(935) },
      { content: words(935) },
      { content: words(935) },
    ],
    bookBrief: baseBookBrief({ targetWordCount: 80000 }),
  });

  assert.equal(result.checks.wordCount.total, 3745);
  assert.equal(result.technicalExportable, true);
  assert.equal(result.publicationReady, false);
  assert.equal(result.publishable, false);
  assert.ok(issueCodes(result.warnings).includes('MANUSCRIPT_INCOMPLETE_FOR_TARGET'));
});

test('total word count far above target creates WORD_COUNT_HIGH warning', () => {
  const result = evaluatePublishabilitySnapshot({
    project: baseProject({ targetWordCount: 100 }),
    bible: baseBible(),
    scenes: baseScenes(),
  });

  assert.ok(issueCodes(result.warnings).includes('WORD_COUNT_HIGH'));
  assert.equal(result.publishable, true);
});

test('Bible beat without scene is detected', () => {
  const result = evaluatePublishabilitySnapshot({
    project: baseProject(),
    bible: baseBible(),
    scenes: [baseScenes()[0]],
  });

  assert.ok(issueCodes(result.criticalFailures).includes('BEATS_MISSING_SCENES'));
  assert.equal(result.publishable, false);
});

test('scene linked to chapter beat without chapterNumber creates warning', () => {
  const result = evaluatePublishabilitySnapshot({
    project: baseProject(),
    bible: baseBible(),
    scenes: [
      { beatId: 1, content: words(80) },
      { beatId: 2, chapterNumber: 1, content: words(90) },
    ],
  });

  assert.ok(issueCodes(result.warnings).includes('CHAPTER_NUMBER_MISSING'));
  assert.equal(result.publishable, true);
});

test('short story without chapterNumber is not blocked', () => {
  const result = evaluatePublishabilitySnapshot({
    project: baseProject({ isShortStory: true }),
    bible: baseBible(),
    scenes: [
      { beatId: 1, content: words(80) },
      { beatId: 2, content: words(90) },
    ],
  });

  assert.equal(result.publishable, true);
  assert.equal(issueCodes(result.criticalFailures).includes('CHAPTER_NUMBER_MISSING'), false);
  assert.equal(issueCodes(result.warnings).includes('CHAPTER_NUMBER_MISSING'), false);
});

test('missing AI disclosure creates warning without critical failure', () => {
  const result = evaluatePublishabilitySnapshot({
    project: baseProject({ humanReviewStatus: 'reviewed' }),
    bible: baseBible(),
    scenes: baseScenes(),
  });

  assert.ok(issueCodes(result.warnings).includes('AI_DISCLOSURE_MISSING'));
  assert.equal(issueCodes(result.criticalFailures).includes('AI_DISCLOSURE_MISSING'), false);
  assert.equal(result.publishable, true);
});

test('missing BookBrief keeps AI disclosure and human review warnings', () => {
  const result = evaluatePublishabilitySnapshot({
    project: baseProject(),
    bible: baseBible(),
    scenes: baseScenes(),
  });

  const warnings = issueCodes(result.warnings);
  assert.ok(warnings.includes('AI_DISCLOSURE_MISSING'));
  assert.ok(warnings.includes('HUMAN_REVIEW_NOT_TRACKED'));
  assert.equal(result.checks.bookBrief.exists, false);
});

test('BookBrief with aiDisclosure not_configured keeps AI disclosure warning', () => {
  const result = evaluatePublishabilitySnapshot({
    project: baseProject(),
    bible: baseBible(),
    scenes: baseScenes(),
    bookBrief: baseBookBrief({ aiDisclosure: 'not_configured' }),
  });

  assert.ok(issueCodes(result.warnings).includes('AI_DISCLOSURE_MISSING'));
  assert.equal(result.checks.bookBrief.aiDisclosureConfigured, false);
});

test('BookBrief with aiDisclosure ai_generated clears AI disclosure warning', () => {
  const result = evaluatePublishabilitySnapshot({
    project: baseProject(),
    bible: baseBible(),
    scenes: baseScenes(),
    bookBrief: baseBookBrief({ aiDisclosure: 'ai_generated' }),
  });

  assert.equal(issueCodes(result.warnings).includes('AI_DISCLOSURE_MISSING'), false);
  assert.equal(result.checks.aiDisclosure.status, 'passed');
});

test('BookBrief with aiDisclosure ai_assisted clears AI disclosure warning', () => {
  const result = evaluatePublishabilitySnapshot({
    project: baseProject(),
    bible: baseBible(),
    scenes: baseScenes(),
    bookBrief: baseBookBrief({ aiDisclosure: 'ai_assisted' }),
  });

  assert.equal(issueCodes(result.warnings).includes('AI_DISCLOSURE_MISSING'), false);
  assert.equal(result.checks.aiDisclosure.status, 'passed');
});

test('BookBrief with humanReviewStatus not_tracked keeps human review warning', () => {
  const result = evaluatePublishabilitySnapshot({
    project: baseProject(),
    bible: baseBible(),
    scenes: baseScenes(),
    bookBrief: baseBookBrief({ humanReviewStatus: 'not_tracked' }),
  });

  assert.ok(issueCodes(result.warnings).includes('HUMAN_REVIEW_NOT_TRACKED'));
  assert.equal(result.checks.humanReview.tracked, false);
});

test('BookBrief with humanReviewStatus in_progress creates pending warning', () => {
  const result = evaluatePublishabilitySnapshot({
    project: baseProject(),
    bible: baseBible(),
    scenes: baseScenes(),
    bookBrief: baseBookBrief({ humanReviewStatus: 'in_progress' }),
  });

  const warnings = issueCodes(result.warnings);
  assert.ok(warnings.includes('HUMAN_REVIEW_PENDING'));
  assert.equal(warnings.includes('HUMAN_REVIEW_NOT_TRACKED'), false);
  assert.equal(result.publishable, true);
});

test('BookBrief with humanReviewStatus needed creates pending warning', () => {
  const result = evaluatePublishabilitySnapshot({
    project: baseProject(),
    bible: baseBible(),
    scenes: baseScenes(),
    bookBrief: baseBookBrief({ humanReviewStatus: 'needed' }),
  });

  assert.ok(issueCodes(result.warnings).includes('HUMAN_REVIEW_PENDING'));
  assert.equal(issueCodes(result.criticalFailures).includes('HUMAN_REVIEW_PENDING'), false);
});

test('BookBrief with humanReviewStatus completed clears human review warnings', () => {
  const result = evaluatePublishabilitySnapshot({
    project: baseProject(),
    bible: baseBible(),
    scenes: baseScenes(),
    bookBrief: baseBookBrief({ humanReviewStatus: 'completed' }),
  });

  const warnings = issueCodes(result.warnings);
  assert.equal(warnings.includes('HUMAN_REVIEW_NOT_TRACKED'), false);
  assert.equal(warnings.includes('HUMAN_REVIEW_PENDING'), false);
  assert.equal(result.checks.humanReview.status, 'passed');
});

test('BookBrief with humanReviewStatus waived clears human review warnings', () => {
  const result = evaluatePublishabilitySnapshot({
    project: baseProject(),
    bible: baseBible(),
    scenes: baseScenes(),
    bookBrief: baseBookBrief({ humanReviewStatus: 'waived' }),
  });

  const warnings = issueCodes(result.warnings);
  assert.equal(warnings.includes('HUMAN_REVIEW_NOT_TRACKED'), false);
  assert.equal(warnings.includes('HUMAN_REVIEW_PENDING'), false);
  assert.equal(result.checks.humanReview.status, 'passed');
});

test('BookBrief targetWordCount is used when project targetWordCount is missing', () => {
  const result = evaluatePublishabilitySnapshot({
    project: baseProject(),
    bible: baseBible(),
    scenes: baseScenes(),
    bookBrief: baseBookBrief({ targetWordCount: 1000 }),
  });

  assert.equal(result.checks.wordCount.target, 1000);
  assert.equal(result.checks.wordCount.targetSource, 'bookBrief');
  assert.ok(issueCodes(result.warnings).includes('WORD_COUNT_LOW'));
});

test('project targetWordCount has priority over BookBrief targetWordCount', () => {
  const result = evaluatePublishabilitySnapshot({
    project: baseProject({ targetWordCount: 100 }),
    bible: baseBible(),
    scenes: baseScenes(),
    bookBrief: baseBookBrief({ targetWordCount: 1000 }),
  });

  assert.equal(result.checks.wordCount.target, 100);
  assert.equal(result.checks.wordCount.targetSource, 'project');
  assert.ok(issueCodes(result.warnings).includes('WORD_COUNT_HIGH'));
  assert.equal(issueCodes(result.warnings).includes('WORD_COUNT_LOW'), false);
});
