const test = require('node:test');
const assert = require('node:assert/strict');

const {
  allocateBeatWordBudget,
  findChapterForBeat,
  groupScenesForManuscript,
  resolveBeatWordBudget,
  resolveChapterNumberForBeat,
  sortScenesForManuscript,
} = require('../services/storyStructureService');

test('findChapterForBeat finds a chapter with a numeric beatId', () => {
  const chapter = { title: 'Chapter 1', beats: [{ id: 10 }] };
  const bible = { chapters: [chapter] };

  assert.equal(findChapterForBeat(bible, 10), chapter);
});

test('findChapterForBeat finds a chapter with a string beatId', () => {
  const chapter = { title: 'Chapter 2', beats: [{ id: 'beat-2' }] };
  const bible = { chapters: [{ title: 'Chapter 1', beats: [] }, chapter] };

  assert.equal(findChapterForBeat(bible, 'beat-2'), chapter);
});

test('findChapterForBeat returns null when no beat matches', () => {
  const bible = { chapters: [{ title: 'Chapter 1', beats: [{ id: 1 }] }] };

  assert.equal(findChapterForBeat(bible, 99), null);
});

test('findChapterForBeat does not break with an empty bible', () => {
  assert.equal(findChapterForBeat({}, 1), null);
  assert.equal(findChapterForBeat(null, 1), null);
});

test('findChapterForBeat does not break with a chapter without beats', () => {
  const bible = { chapters: [{ title: 'Chapter 1' }] };

  assert.equal(findChapterForBeat(bible, 1), null);
});

test('resolveChapterNumberForBeat returns the chapter number for a beat', () => {
  const bible = {
    chapters: [
      { chapterNumber: 1, beats: [{ id: 10 }] },
      { chapterNumber: 2, beats: [{ id: 20 }] },
    ],
  };

  assert.equal(resolveChapterNumberForBeat(bible, '20'), 2);
});

test('resolveChapterNumberForBeat returns undefined when no chapter matches', () => {
  const bible = { chapters: [{ chapterNumber: 1, beats: [{ id: 10 }] }] };

  assert.equal(resolveChapterNumberForBeat(bible, 99), undefined);
});

test('allocateBeatWordBudget divides a chapter budget across 3 beats', () => {
  const budget = allocateBeatWordBudget({ wordCount: { min: 900, max: 1500 } }, 3);

  assert.deepEqual(budget, { min: 300, max: 500 });
});

test('allocateBeatWordBudget keeps the full budget with 1 beat', () => {
  const budget = allocateBeatWordBudget({ wordCount: { min: 900, max: 1500 } }, 1);

  assert.deepEqual(budget, { min: 900, max: 1500 });
});

test('allocateBeatWordBudget treats 0 beats as 1', () => {
  const budget = allocateBeatWordBudget({ wordCount: { min: 900, max: 1500 } }, 0);

  assert.deepEqual(budget, { min: 900, max: 1500 });
});

test('allocateBeatWordBudget treats missing config with a safe fallback', () => {
  const budget = allocateBeatWordBudget(undefined, 3);

  assert.deepEqual(budget, { min: 0, max: 0 });
});

test('allocateBeatWordBudget does not return NaN', () => {
  const budget = allocateBeatWordBudget({ wordCount: { min: 'bad', max: undefined } }, null);

  assert.equal(Number.isNaN(budget.min), false);
  assert.equal(Number.isNaN(budget.max), false);
});

test('resolveBeatWordBudget divides chapter word count across 3 beats', () => {
  const bible = {
    chapters: [
      { chapterNumber: 1, beats: [{ id: 1 }, { id: 2 }, { id: 3 }] },
    ],
  };

  const budget = resolveBeatWordBudget({
    bible,
    beat: { id: 2 },
    chapterTypeConfig: { wordCount: { min: 2400, max: 3000 } },
  });

  assert.deepEqual(budget, { min: 800, max: 1000 });
});

test('resolveBeatWordBudget keeps full word count for a single-beat chapter', () => {
  const bible = {
    chapters: [
      { chapterNumber: 1, beats: [{ id: 1 }] },
    ],
  };

  const budget = resolveBeatWordBudget({
    bible,
    beat: { id: 1 },
    chapterTypeConfig: { wordCount: { min: 2400, max: 3000 } },
  });

  assert.deepEqual(budget, { min: 2400, max: 3000 });
});

test('resolveBeatWordBudget uses a safe fallback when beat has no chapter', () => {
  const budget = resolveBeatWordBudget({
    bible: { chapters: [{ chapterNumber: 1, beats: [{ id: 1 }] }] },
    beat: { id: 99 },
    chapterTypeConfig: { wordCount: { min: 1200, max: 1800 } },
  });

  assert.deepEqual(budget, { min: 1200, max: 1800 });
});

test('resolveBeatWordBudget does not divide short story budgets as chapter budgets', () => {
  const bible = {
    chapters: [
      { chapterNumber: 1, beats: [{ id: 1 }, { id: 2 }, { id: 3 }] },
    ],
  };

  const budget = resolveBeatWordBudget({
    bible,
    beat: { id: 2 },
    chapterTypeConfig: { wordCount: { min: 2400, max: 3000 } },
    isShortStory: true,
  });

  assert.deepEqual(budget, { min: 2400, max: 3000 });
});

test('resolveBeatWordBudget uses default word count when config is absent without NaN', () => {
  const budget = resolveBeatWordBudget({
    bible: { chapters: [{ chapterNumber: 1, beats: [{ id: 1 }, { id: 2 }] }] },
    beat: { id: 1 },
    defaultWordCount: { min: 1000, max: 1600 },
  });

  assert.deepEqual(budget, { min: 500, max: 800 });
  assert.equal(Number.isNaN(budget.min), false);
  assert.equal(Number.isNaN(budget.max), false);
});

test('resolveBeatWordBudget supports string and numeric beat ids', () => {
  const bible = {
    chapters: [
      { chapterNumber: 1, beats: [{ id: 10 }, { id: '11' }] },
    ],
  };

  const stringBudget = resolveBeatWordBudget({
    bible,
    beatId: '10',
    chapterTypeConfig: { wordCount: { min: 1000, max: 1400 } },
  });
  const numericBudget = resolveBeatWordBudget({
    bible,
    beatId: 11,
    chapterTypeConfig: { wordCount: { min: 1000, max: 1400 } },
  });

  assert.deepEqual(stringBudget, { min: 500, max: 700 });
  assert.deepEqual(numericBudget, { min: 500, max: 700 });
});

test('sortScenesForManuscript orders scenes by chapterNumber and beatId', () => {
  const scenes = [
    { title: 'Chapter 2 Beat 1', chapterNumber: 2, beatId: 1 },
    { title: 'Chapter 1 Beat 2', chapterNumber: 1, beatId: 2 },
    { title: 'Chapter 1 Beat 1', chapterNumber: 1, beatId: 1 },
  ];

  const sorted = sortScenesForManuscript(scenes);

  assert.deepEqual(sorted.map((scene) => scene.title), [
    'Chapter 1 Beat 1',
    'Chapter 1 Beat 2',
    'Chapter 2 Beat 1',
  ]);
});

test('sortScenesForManuscript keeps scenes without chapterNumber exportable', () => {
  const scenes = [
    { title: 'Beat 2', beatId: 2 },
    { title: 'Beat 1', beatId: 1 },
  ];

  const sorted = sortScenesForManuscript(scenes);

  assert.deepEqual(sorted.map((scene) => scene.title), ['Beat 1', 'Beat 2']);
});

test('sortScenesForManuscript does not mutate the original array', () => {
  const scenes = [
    { title: 'Second', chapterNumber: 2, beatId: 1 },
    { title: 'First', chapterNumber: 1, beatId: 1 },
  ];

  const sorted = sortScenesForManuscript(scenes);

  assert.notEqual(sorted, scenes);
  assert.deepEqual(scenes.map((scene) => scene.title), ['Second', 'First']);
});

test('sortScenesForManuscript falls back to createdAt', () => {
  const scenes = [
    { title: 'Later', beatId: 1, createdAt: '2026-01-02T00:00:00.000Z' },
    { title: 'Earlier', beatId: 1, createdAt: '2026-01-01T00:00:00.000Z' },
  ];

  const sorted = sortScenesForManuscript(scenes);

  assert.deepEqual(sorted.map((scene) => scene.title), ['Earlier', 'Later']);
});

test('sortScenesForManuscript handles numeric and string beatIds predictably', () => {
  const scenes = [
    { title: 'Beat 10', chapterNumber: 1, beatId: '10' },
    { title: 'Beat 2', chapterNumber: 1, beatId: 2 },
    { title: 'Beat 1', chapterNumber: 1, beatId: '1' },
  ];

  const sorted = sortScenesForManuscript(scenes);

  assert.deepEqual(sorted.map((scene) => scene.title), ['Beat 1', 'Beat 2', 'Beat 10']);
});

test('groupScenesForManuscript groups scenes by chapterNumber', () => {
  const groups = groupScenesForManuscript([
    { title: 'Chapter 2', chapterNumber: 2, beatId: 1 },
    { title: 'Chapter 1', chapterNumber: 1, beatId: 1 },
  ]);

  assert.deepEqual(groups.map((group) => group.chapterNumber), [1, 2]);
  assert.deepEqual(groups.map((group) => group.scenes[0].title), ['Chapter 1', 'Chapter 2']);
});

test('groupScenesForManuscript keeps scenes without chapterNumber in a separate group', () => {
  const groups = groupScenesForManuscript([
    { title: 'Chapter 1', chapterNumber: 1, beatId: 1 },
    { title: 'Loose Scene', beatId: 2 },
  ]);

  assert.equal(groups.length, 2);
  assert.equal(groups[0].type, 'chapter');
  assert.equal(groups[0].chapterNumber, 1);
  assert.equal(groups[1].type, 'unassigned');
  assert.equal(groups[1].chapterNumber, undefined);
  assert.deepEqual(groups[1].scenes.map((scene) => scene.title), ['Loose Scene']);
});

test('groupScenesForManuscript does not transform missing chapterNumber into chapter 1', () => {
  const groups = groupScenesForManuscript([
    { title: 'Legacy Scene', beatId: 1 },
  ]);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].type, 'unassigned');
  assert.equal(groups[0].chapterNumber, undefined);
});

test('groupScenesForManuscript does not mutate the original array', () => {
  const scenes = [
    { title: 'Second', chapterNumber: 2, beatId: 1 },
    { title: 'First', chapterNumber: 1, beatId: 1 },
  ];

  const groups = groupScenesForManuscript(scenes);

  assert.deepEqual(scenes.map((scene) => scene.title), ['Second', 'First']);
  assert.deepEqual(groups.map((group) => group.scenes[0].title), ['First', 'Second']);
});

test('groupScenesForManuscript supports short stories and empty scene lists', () => {
  const shortStoryGroups = groupScenesForManuscript([
    { title: 'Opening', beatId: 1 },
    { title: 'Ending', beatId: 2 },
  ]);

  assert.equal(shortStoryGroups.length, 1);
  assert.equal(shortStoryGroups[0].type, 'unassigned');
  assert.deepEqual(shortStoryGroups[0].scenes.map((scene) => scene.title), ['Opening', 'Ending']);
  assert.deepEqual(groupScenesForManuscript([]), []);
});

test('groupScenesForManuscript preserves beat order within a chapter', () => {
  const groups = groupScenesForManuscript([
    { title: 'Beat 3', chapterNumber: '1', beatId: 3 },
    { title: 'Beat 1', chapterNumber: 1, beatId: 1 },
    { title: 'Beat 2', chapterNumber: '1', beatId: '2' },
  ]);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].chapterNumber, 1);
  assert.deepEqual(groups[0].scenes.map((scene) => scene.title), ['Beat 1', 'Beat 2', 'Beat 3']);
});
