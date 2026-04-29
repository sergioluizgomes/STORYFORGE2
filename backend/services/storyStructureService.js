function normalizeBeatId(beatId) {
  if (beatId === null || beatId === undefined) {
    return null;
  }

  return String(beatId);
}

function findChapterForBeat(bible, beatId) {
  const targetBeatId = normalizeBeatId(beatId);
  const chapters = Array.isArray(bible?.chapters) ? bible.chapters : [];

  if (targetBeatId === null) {
    return null;
  }

  for (const chapter of chapters) {
    const beats = Array.isArray(chapter?.beats) ? chapter.beats : [];
    const hasBeat = beats.some((beat) => normalizeBeatId(beat?.id ?? beat?.beatId) === targetBeatId);

    if (hasBeat) {
      return chapter;
    }
  }

  return null;
}

function toSafeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function normalizeBeatCount(beatsInChapterCount) {
  const count = Number(beatsInChapterCount);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 1;
}

function allocateBeatWordBudget(chapterTypeConfig, beatsInChapterCount) {
  const beatCount = normalizeBeatCount(beatsInChapterCount);
  const wordCount = chapterTypeConfig?.wordCount ?? {};
  const min = toSafeNumber(wordCount.min);
  const max = toSafeNumber(wordCount.max);

  return {
    min: Math.round(min / beatCount),
    max: Math.round(max / beatCount),
  };
}

module.exports = {
  allocateBeatWordBudget,
  findChapterForBeat,
};
