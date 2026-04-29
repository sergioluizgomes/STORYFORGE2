const test = require('node:test');
const assert = require('node:assert/strict');

const {
  allocateBeatWordBudget,
  findChapterForBeat,
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
