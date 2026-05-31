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

function resolveChapterNumberForBeat(bible, beatId) {
  const chapter = findChapterForBeat(bible, beatId);
  const chapterNumber = Number(chapter?.chapterNumber);

  return Number.isFinite(chapterNumber) ? chapterNumber : undefined;
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

function resolveBeatWordBudget({
  bible,
  beat,
  beatId,
  chapterTypeConfig,
  defaultWordCount,
  isShortStory = false,
} = {}) {
  const selectedBeatId = beatId ?? beat?.id ?? beat?.beatId;
  const baseWordCount = chapterTypeConfig?.wordCount ?? defaultWordCount ?? {};
  const safeChapterConfig = { wordCount: baseWordCount };

  if (isShortStory) {
    return allocateBeatWordBudget(safeChapterConfig, 1);
  }

  const chapter = findChapterForBeat(bible, selectedBeatId);
  const beats = Array.isArray(chapter?.beats) ? chapter.beats : [];

  return allocateBeatWordBudget(safeChapterConfig, beats.length || 1);
}

function getFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function compareOptionalNumbers(a, b) {
  const left = getFiniteNumber(a);
  const right = getFiniteNumber(b);

  if (left !== null && right !== null) {
    return left - right;
  }

  if (left !== null) {
    return -1;
  }

  if (right !== null) {
    return 1;
  }

  return 0;
}

function getChapterNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function compareBeatIds(a, b) {
  if (a === null || a === undefined) {
    return b === null || b === undefined ? 0 : 1;
  }

  if (b === null || b === undefined) {
    return -1;
  }

  const numericComparison = compareOptionalNumbers(a, b);
  if (numericComparison !== 0) {
    return numericComparison;
  }

  return String(a).localeCompare(String(b), 'en', { numeric: true });
}

function getSceneTimestamp(scene) {
  const timestamp = new Date(scene?.createdAt ?? scene?.generatedAt).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function compareOptionalTimestamps(a, b) {
  const left = getSceneTimestamp(a);
  const right = getSceneTimestamp(b);

  if (left !== null && right !== null) {
    return left - right;
  }

  if (left !== null) {
    return -1;
  }

  if (right !== null) {
    return 1;
  }

  return 0;
}

function sortScenesForManuscript(scenes) {
  return [...scenes].sort((left, right) => {
    const chapterComparison = compareOptionalNumbers(left?.chapterNumber, right?.chapterNumber);
    if (chapterComparison !== 0) {
      return chapterComparison;
    }

    const beatComparison = compareBeatIds(left?.beatId, right?.beatId);
    if (beatComparison !== 0) {
      return beatComparison;
    }

    return compareOptionalTimestamps(left, right);
  });
}

function groupScenesForManuscript(scenes) {
  const orderedScenes = sortScenesForManuscript(Array.isArray(scenes) ? scenes : []);
  const groups = [];
  const chapters = new Map();
  let unassignedGroup = null;

  for (const scene of orderedScenes) {
    const chapterNumber = getChapterNumber(scene?.chapterNumber);

    if (chapterNumber === null) {
      if (!unassignedGroup) {
        unassignedGroup = {
          type: 'unassigned',
          title: 'Scenes',
          scenes: [],
        };
        groups.push(unassignedGroup);
      }

      unassignedGroup.scenes.push(scene);
      continue;
    }

    if (!chapters.has(chapterNumber)) {
      const chapterGroup = {
        type: 'chapter',
        chapterNumber,
        title: `Chapter ${chapterNumber}`,
        scenes: [],
      };

      chapters.set(chapterNumber, chapterGroup);
      groups.push(chapterGroup);
    }

    chapters.get(chapterNumber).scenes.push(scene);
  }

  return groups;
}

module.exports = {
  allocateBeatWordBudget,
  findChapterForBeat,
  groupScenesForManuscript,
  resolveBeatWordBudget,
  resolveChapterNumberForBeat,
  sortScenesForManuscript,
};
