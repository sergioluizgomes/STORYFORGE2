const test = require('node:test');
const assert = require('node:assert/strict');

const {
  evaluateQualitySnapshot,
} = require('../services/qualityService');

function words(count, prefix = 'word') {
  return Array.from({ length: count }, (_, index) => `${prefix}${index + 1}`).join(' ');
}

function issueCodes(result) {
  return result.findings.map((finding) => finding.code);
}

function findIssue(result, code) {
  return result.findings.find((finding) => finding.code === code);
}

function baseProject(overrides = {}) {
  return {
    _id: 'project-1',
    name: 'Quality Draft',
    targetWordCount: 200,
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
      _id: 'scene-1',
      beatId: 1,
      chapterNumber: 1,
      content: `${words(80)} Aurora`,
      ...overrides,
    },
    {
      _id: 'scene-2',
      beatId: 2,
      chapterNumber: 1,
      content: words(90, 'term'),
    },
  ];
}

function baseBookBrief(overrides = {}) {
  return {
    language: 'Português Brasileiro',
    genre: 'Fantasia',
    targetAudience: 'Adulto',
    tone: 'Lirico',
    mustInclude: ['Aurora'],
    mustAvoid: ['forbidden'],
    aiDisclosure: 'ai_assisted',
    humanReviewStatus: 'completed',
    targetWordCount: 200,
    ...overrides,
  };
}

function basePublishability(overrides = {}) {
  return {
    score: 100,
    criticalFailures: [],
    warnings: [],
    ...overrides,
  };
}

test('project without scenes creates QUALITY_SCENES_MISSING and is not publishable', () => {
  const result = evaluateQualitySnapshot({
    project: baseProject(),
    bible: baseBible(),
    scenes: [],
    bookBrief: baseBookBrief(),
    publishability: basePublishability(),
  });

  assert.ok(issueCodes(result).includes('QUALITY_SCENES_MISSING'));
  assert.equal(result.publishable, false);
  assert.ok(result.overallScore < 80);
});

test('empty scene creates critical QUALITY_SCENE_EMPTY', () => {
  const result = evaluateQualitySnapshot({
    project: baseProject(),
    bible: baseBible(),
    scenes: baseScenes({ content: '   ' }),
    bookBrief: baseBookBrief(),
    publishability: basePublishability(),
  });

  const issue = findIssue(result, 'QUALITY_SCENE_EMPTY');
  assert.equal(issue.severity, 'critical');
});

test('very short scene creates QUALITY_SCENE_TOO_SHORT warning', () => {
  const result = evaluateQualitySnapshot({
    project: baseProject(),
    bible: baseBible(),
    scenes: baseScenes({ content: 'short scene' }),
    bookBrief: baseBookBrief(),
    publishability: basePublishability(),
  });

  const issue = findIssue(result, 'QUALITY_SCENE_TOO_SHORT');
  assert.equal(issue.severity, 'warning');
});

test('word count below target creates QUALITY_WORD_COUNT_LOW', () => {
  const result = evaluateQualitySnapshot({
    project: baseProject({ targetWordCount: 1000 }),
    bible: baseBible(),
    scenes: baseScenes(),
    bookBrief: baseBookBrief({ targetWordCount: 1000 }),
    publishability: basePublishability(),
  });

  assert.ok(issueCodes(result).includes('QUALITY_WORD_COUNT_LOW'));
});

test('word count above target creates QUALITY_WORD_COUNT_HIGH', () => {
  const result = evaluateQualitySnapshot({
    project: baseProject({ targetWordCount: 50 }),
    bible: baseBible(),
    scenes: baseScenes(),
    bookBrief: baseBookBrief({ targetWordCount: 50 }),
    publishability: basePublishability(),
  });

  assert.ok(issueCodes(result).includes('QUALITY_WORD_COUNT_HIGH'));
});

test('Bible beat without scene creates QUALITY_BEAT_MISSING_SCENE', () => {
  const result = evaluateQualitySnapshot({
    project: baseProject(),
    bible: baseBible(),
    scenes: [baseScenes()[0]],
    bookBrief: baseBookBrief(),
    publishability: basePublishability(),
  });

  assert.ok(issueCodes(result).includes('QUALITY_BEAT_MISSING_SCENE'));
});

test('chapter beat scene without chapterNumber creates QUALITY_CHAPTER_NUMBER_MISSING', () => {
  const result = evaluateQualitySnapshot({
    project: baseProject(),
    bible: baseBible(),
    scenes: [
      { _id: 'scene-1', beatId: 1, content: `${words(80)} Aurora` },
      { _id: 'scene-2', beatId: 2, chapterNumber: 1, content: words(90) },
    ],
    bookBrief: baseBookBrief(),
    publishability: basePublishability(),
  });

  assert.ok(issueCodes(result).includes('QUALITY_CHAPTER_NUMBER_MISSING'));
});

test('placeholder text creates QUALITY_PLACEHOLDER_TEXT', () => {
  const result = evaluateQualitySnapshot({
    project: baseProject(),
    bible: baseBible(),
    scenes: baseScenes({ content: `${words(80)} TODO` }),
    bookBrief: baseBookBrief(),
    publishability: basePublishability(),
  });

  assert.ok(issueCodes(result).includes('QUALITY_PLACEHOLDER_TEXT'));
});

test('model artifact text creates QUALITY_MODEL_ARTIFACT', () => {
  const result = evaluateQualitySnapshot({
    project: baseProject(),
    bible: baseBible(),
    scenes: baseScenes({ content: `Here is the scene. ${words(80)} Aurora` }),
    bookBrief: baseBookBrief(),
    publishability: basePublishability(),
  });

  assert.ok(issueCodes(result).includes('QUALITY_MODEL_ARTIFACT'));
});

test('missing mustInclude term creates QUALITY_MUST_INCLUDE_MISSING', () => {
  const result = evaluateQualitySnapshot({
    project: baseProject(),
    bible: baseBible(),
    scenes: baseScenes({ content: words(80) }),
    bookBrief: baseBookBrief({ mustInclude: ['unseen relic'] }),
    publishability: basePublishability(),
  });

  const issue = findIssue(result, 'QUALITY_MUST_INCLUDE_MISSING');
  assert.ok(issue);
  assert.equal(issue.term, 'unseen relic');
  assert.match(issue.evidence, /No normalized scene text/);
  assert.match(issue.suggestedFix, /unseen relic/);
});

test('present mustAvoid term creates QUALITY_MUST_AVOID_PRESENT', () => {
  const result = evaluateQualitySnapshot({
    project: baseProject(),
    bible: baseBible(),
    scenes: baseScenes({ content: `${words(80)} forbidden Aurora` }),
    bookBrief: baseBookBrief(),
    publishability: basePublishability(),
  });

  const issue = findIssue(result, 'QUALITY_MUST_AVOID_PRESENT');
  assert.ok(issue);
  assert.equal(issue.term, 'forbidden');
  assert.match(issue.whereFound, /scene-1/);
  assert.match(issue.suggestedFix, /forbidden/);
});

test('manuscriptStage is inferred and incomplete target blocks publishable', () => {
  const result = evaluateQualitySnapshot({
    project: baseProject({ targetWordCount: 80000 }),
    bible: baseBible(),
    scenes: baseScenes(),
    bookBrief: baseBookBrief({ targetWordCount: 80000 }),
    publishability: basePublishability(),
  });

  assert.equal(result.metadata.manuscriptStage, 'sample');
  assert.equal(result.metadata.technicalExportable, true);
  assert.equal(result.metadata.publicationReady, false);
  assert.equal(result.publishable, false);
  assert.ok(issueCodes(result).includes('MANUSCRIPT_INCOMPLETE_FOR_TARGET'));
});

test('BookBrief aiDisclosure not_configured creates QUALITY_AI_DISCLOSURE_MISSING', () => {
  const result = evaluateQualitySnapshot({
    project: baseProject(),
    bible: baseBible(),
    scenes: baseScenes(),
    bookBrief: baseBookBrief({ aiDisclosure: 'not_configured' }),
    publishability: basePublishability(),
  });

  assert.ok(issueCodes(result).includes('QUALITY_AI_DISCLOSURE_MISSING'));
});

test('BookBrief humanReviewStatus in_progress creates QUALITY_HUMAN_REVIEW_PENDING', () => {
  const result = evaluateQualitySnapshot({
    project: baseProject(),
    bible: baseBible(),
    scenes: baseScenes(),
    bookBrief: baseBookBrief({ humanReviewStatus: 'in_progress' }),
    publishability: basePublishability(),
  });

  assert.ok(issueCodes(result).includes('QUALITY_HUMAN_REVIEW_PENDING'));
});

test('BookBrief humanReviewStatus completed or waived does not create pending warning', () => {
  for (const humanReviewStatus of ['completed', 'waived']) {
    const result = evaluateQualitySnapshot({
      project: baseProject(),
      bible: baseBible(),
      scenes: baseScenes(),
      bookBrief: baseBookBrief({ humanReviewStatus }),
      publishability: basePublishability(),
    });

    assert.equal(issueCodes(result).includes('QUALITY_HUMAN_REVIEW_PENDING'), false);
  }
});

test('missing BookBrief does not break quality evaluation', () => {
  const result = evaluateQualitySnapshot({
    project: baseProject(),
    bible: baseBible(),
    scenes: baseScenes(),
    publishability: basePublishability(),
  });

  assert.equal(result.metadata.bookBriefExists, false);
  assert.equal(result.findings.some((finding) => finding.severity === 'critical'), false);
});

test('Publishability Gate critical failures are reflected in technical readiness', () => {
  const result = evaluateQualitySnapshot({
    project: baseProject(),
    bible: baseBible(),
    scenes: baseScenes(),
    bookBrief: baseBookBrief(),
    publishability: basePublishability({
      score: 40,
      criticalFailures: [{ code: 'EXPORT_READINESS_FAILED' }],
    }),
  });

  assert.ok(issueCodes(result).includes('QUALITY_EXPORT_READINESS_FAILED'));
  assert.equal(result.scores.technicalReadinessScore, 40);
  assert.equal(result.publishable, false);
});

test('healthy snapshot has high score and no critical findings', () => {
  const result = evaluateQualitySnapshot({
    project: baseProject(),
    bible: baseBible(),
    scenes: baseScenes(),
    bookBrief: baseBookBrief(),
    publishability: basePublishability(),
  });

  assert.ok(result.overallScore >= 85);
  assert.equal(result.findings.some((finding) => finding.severity === 'critical'), false);
  assert.equal(result.publishable, true);
  assert.equal(result.metadata.bookBriefExists, true);
});
