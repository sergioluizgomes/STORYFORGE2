const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildPublishingPackageSnapshot,
  buildCategorySuggestions,
  buildKeywordSuggestions,
  buildMonetizationStrategy,
  normalizeList,
} = require('../services/publishingPackageService');

function baseProject(overrides = {}) {
  return {
    _id: 'project-1',
    name: 'Commercial Draft',
    style: 'Fantasia Urbana',
    language: 'Português Brasileiro',
    premise: 'Uma investigadora descobre uma sociedade secreta em Sao Paulo.',
    ...overrides,
  };
}

function baseBookBrief(overrides = {}) {
  return {
    language: 'English',
    genre: 'Fantasy',
    subgenre: 'Urban Fantasy',
    targetAudience: 'Adult readers',
    tone: 'Suspenseful',
    monetizationMode: 'wide',
    seriesName: 'Hidden City',
    keywords: ['magic', 'detective'],
    aiDisclosure: 'ai_assisted',
    humanReviewStatus: 'completed',
    notes: 'Private editorial notes must not be copied into the package.',
    ...overrides,
  };
}

function basePublishability(overrides = {}) {
  return {
    publishable: true,
    score: 92,
    criticalFailures: [],
    warnings: [],
    ...overrides,
  };
}

function baseQualityReport(overrides = {}) {
  return {
    _id: 'quality-1',
    overallScore: 88,
    findings: [],
    metadata: {
      sceneCount: 12,
      totalWordCount: 42000,
    },
    summary: 'Quality summary should not be copied wholesale.',
    ...overrides,
  };
}

function warningText(snapshot) {
  return snapshot.complianceWarnings.join(' | ');
}

test('minimal project generates draft package without BookBrief', () => {
  const snapshot = buildPublishingPackageSnapshot({
    project: baseProject({ name: 'Minimum Book' }),
    publishability: basePublishability(),
  });

  assert.equal(snapshot.status, 'draft');
  assert.equal(snapshot.title, 'Minimum Book');
  assert.equal(snapshot.language, 'Português Brasileiro');
  assert.equal(snapshot.metadata.bookBriefExists, false);
  assert.ok(snapshot.kdpChecklist.length >= 8);
  assert.ok(snapshot.descriptionShort.includes('Minimum Book'));
});

test('BookBrief data feeds language, monetization, keywords, genre and target audience', () => {
  const snapshot = buildPublishingPackageSnapshot({
    project: baseProject(),
    bookBrief: baseBookBrief(),
    publishability: basePublishability(),
    qualityReport: baseQualityReport(),
  });

  assert.equal(snapshot.language, 'English');
  assert.equal(snapshot.monetizationStrategy.mode, 'wide');
  assert.ok(snapshot.keywords.includes('magic'));
  assert.ok(snapshot.keywords.includes('Fantasy'));
  assert.ok(snapshot.descriptionShort.includes('Adult readers'));
  assert.ok(snapshot.categories.includes('Suggested genre: Fantasy'));
});

test('keywords remove empties and duplicates and enforce limit', () => {
  const keywords = buildKeywordSuggestions(baseProject(), baseBookBrief({
    keywords: ['Magic', ' ', 'magic', 'detective', 'portal', 'quest', 'series', 'hero', 'villain', 'city', 'extra', 'overflow'],
  }));

  assert.equal(keywords.includes(' '), false);
  assert.equal(keywords.filter((item) => item.toLowerCase() === 'magic').length, 1);
  assert.ok(keywords.length <= 10);
});

test('normalizeList removes empty duplicate values and limits output', () => {
  assert.deepEqual(
    normalizeList([' A ', '', 'a', null, 'B', 'C'], { maxItems: 2 }),
    ['A', 'B']
  );
});

test('categories use genre and subgenre as suggestions without official category claims', () => {
  const categories = buildCategorySuggestions(baseProject(), baseBookBrief({
    genre: 'Romance',
    subgenre: 'Cozy Mystery',
  }));

  assert.deepEqual(categories.slice(0, 2), [
    'Suggested genre: Romance',
    'Suggested subgenre: Cozy Mystery',
  ]);
  assert.equal(categories.some((category) => category.includes('official')), false);
});

test('aiDisclosure not_configured generates compliance warning', () => {
  const snapshot = buildPublishingPackageSnapshot({
    project: baseProject(),
    bookBrief: baseBookBrief({ aiDisclosure: 'not_configured' }),
    publishability: basePublishability(),
  });

  assert.ok(warningText(snapshot).includes('AI disclosure is not configured.'));
});

test('aiDisclosure ai_generated is recorded and warns for platform disclosure review', () => {
  const snapshot = buildPublishingPackageSnapshot({
    project: baseProject(),
    bookBrief: baseBookBrief({ aiDisclosure: 'ai_generated' }),
    publishability: basePublishability(),
  });

  assert.equal(snapshot.aiDisclosure, 'ai_generated');
  assert.ok(warningText(snapshot).includes('AI-generated content may require disclosure'));
  assert.ok(snapshot.appleChecklist.some((item) => item.label.includes('AI-generated content disclosed')));
});

test('humanReviewStatus not_tracked and in_progress generate review warnings', () => {
  for (const humanReviewStatus of ['not_tracked', 'in_progress']) {
    const snapshot = buildPublishingPackageSnapshot({
      project: baseProject(),
      bookBrief: baseBookBrief({ humanReviewStatus }),
      publishability: basePublishability(),
    });

    assert.ok(warningText(snapshot).includes('Human review is not completed or waived.'));
  }
});

test('publishability false generates technical readiness warning without blocking package creation', () => {
  const snapshot = buildPublishingPackageSnapshot({
    project: baseProject(),
    bookBrief: baseBookBrief(),
    publishability: basePublishability({ publishable: false, score: 55 }),
  });

  assert.equal(snapshot.status, 'needs_work');
  assert.ok(warningText(snapshot).includes('Project is not technically publishable yet.'));
  assert.equal(snapshot.title, 'Commercial Draft');
});

test('QualityReport critical findings generate quality warning', () => {
  const snapshot = buildPublishingPackageSnapshot({
    project: baseProject(),
    bookBrief: baseBookBrief(),
    publishability: basePublishability(),
    qualityReport: baseQualityReport({
      findings: [{ code: 'QUALITY_SCENE_EMPTY', severity: 'critical', message: 'Hidden details' }],
    }),
  });

  assert.ok(warningText(snapshot).includes('QualityReport indicates issues'));
});

test('snapshot does not include notes, manuscript, scenes, prompts, full BookBrief or full QualityReport', () => {
  const snapshot = buildPublishingPackageSnapshot({
    project: {
      ...baseProject(),
      manuscript: 'FULL MANUSCRIPT',
      scenes: [{ content: 'FULL SCENE' }],
      prompt: 'PROMPT',
    },
    bookBrief: baseBookBrief({
      notes: 'PRIVATE NOTES',
      mustInclude: ['secret full brief field'],
    }),
    publishability: basePublishability(),
    qualityReport: baseQualityReport({
      findings: [{ code: 'QUALITY_INFO', severity: 'info', message: 'FULL QUALITY FINDING' }],
      recommendations: [{ message: 'FULL QUALITY RECOMMENDATION' }],
      summary: 'FULL QUALITY SUMMARY',
    }),
  });

  const serialized = JSON.stringify(snapshot);
  assert.equal(serialized.includes('FULL MANUSCRIPT'), false);
  assert.equal(serialized.includes('FULL SCENE'), false);
  assert.equal(serialized.includes('PROMPT'), false);
  assert.equal(serialized.includes('PRIVATE NOTES'), false);
  assert.equal(serialized.includes('secret full brief field'), false);
  assert.equal(serialized.includes('FULL QUALITY FINDING'), false);
  assert.equal(serialized.includes('FULL QUALITY RECOMMENDATION'), false);
  assert.equal(serialized.includes('FULL QUALITY SUMMARY'), false);
});

test('monetizationMode undecided offers options and risks without profit promises', () => {
  const strategy = buildMonetizationStrategy(baseProject(), baseBookBrief({ monetizationMode: 'undecided' }));
  const serialized = JSON.stringify(strategy).toLowerCase();

  assert.equal(strategy.mode, 'undecided');
  assert.ok(strategy.rationale.includes('Compare KDP Select'));
  assert.ok(strategy.risks.length > 0);
  assert.equal(serialized.includes('profit'), false);
  assert.equal(serialized.includes('guaranteed sales'), false);
});

test('monetizationMode kdp_select creates coherent strategy and exclusivity warning', () => {
  const strategy = buildMonetizationStrategy(baseProject(), baseBookBrief({ monetizationMode: 'kdp_select' }));

  assert.equal(strategy.mode, 'kdp_select');
  assert.deepEqual(strategy.suggestedChannels, ['KDP']);
  assert.ok(strategy.risks.some((risk) => risk.includes('exclusivity')));
  assert.ok(strategy.rationale.includes('Review exclusivity'));
});
