const test = require('node:test');
const assert = require('node:assert/strict');

const {
  allocateBeatWordBudget,
  findChapterForBeat,
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
