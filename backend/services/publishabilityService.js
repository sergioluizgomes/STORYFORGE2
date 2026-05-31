const {
  groupScenesForManuscript,
  sortScenesForManuscript,
} = require('./storyStructureService');

const MIN_SCENE_WORDS_WARNING = 50;
const WORD_COUNT_LOW_RATIO = 0.6;
const WORD_COUNT_HIGH_RATIO = 1.4;
const MISSING_BEATS_CRITICAL_RATIO = 0.25;
const MANUSCRIPT_INCOMPLETE_RATIO = 0.6;
const CONFIGURED_AI_DISCLOSURES = new Set([
  'ai_assisted',
  'ai_generated',
  'human_written',
]);
const COMPLETED_HUMAN_REVIEW_STATUSES = new Set([
  'completed',
  'waived',
]);
const PENDING_HUMAN_REVIEW_STATUSES = new Set([
  'needed',
  'in_progress',
]);

function normalizeBeatId(beatId) {
  if (beatId === null || beatId === undefined || beatId === '') {
    return null;
  }

  return String(beatId);
}

function countWords(text) {
  if (typeof text !== 'string') {
    return 0;
  }

  const words = text.trim().match(/\S+/g);
  return words ? words.length : 0;
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasChapterNumber(scene) {
  const number = Number(scene?.chapterNumber);
  return Number.isFinite(number) && number > 0;
}

function getProjectId(project) {
  const id = project?._id ?? project?.id ?? project?.projectId;
  return id ? String(id) : null;
}

function getProjectTitle(project) {
  return project?.title ?? project?.name;
}

function normalizeStatus(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function hasAiDisclosure(project) {
  return Boolean(
    project?.aiDisclosure ||
    project?.aiDisclosureStatus ||
    project?.aiUsageDisclosure ||
    project?.metadata?.aiDisclosure
  );
}

function getBookBriefAiDisclosureStatus(bookBrief) {
  if (!bookBrief) {
    return { configured: false, value: null };
  }

  const value = normalizeStatus(bookBrief.aiDisclosure);

  return {
    configured: CONFIGURED_AI_DISCLOSURES.has(value),
    value: value || null,
  };
}

function getBookBriefHumanReviewStatus(bookBrief) {
  if (!bookBrief) {
    return { tracked: false, pending: false, complete: false, value: null };
  }

  const value = normalizeStatus(bookBrief.humanReviewStatus);

  return {
    tracked: Boolean(value) && value !== 'not_tracked',
    pending: PENDING_HUMAN_REVIEW_STATUSES.has(value),
    complete: COMPLETED_HUMAN_REVIEW_STATUSES.has(value),
    value: value || null,
  };
}

function hasHumanReviewStatus(project) {
  return Boolean(
    project?.humanReviewStatus ||
    project?.reviewStatus ||
    project?.humanReviewed ||
    project?.metadata?.humanReviewStatus
  );
}

function getPositiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function createIssue(code, message, severity) {
  return { code, message, severity };
}

function createCheck(status, details = {}) {
  return { status, ...details };
}

function getChapterBeats(bible) {
  const chapters = Array.isArray(bible?.chapters) ? bible.chapters : [];
  const beats = [];

  for (const chapter of chapters) {
    const chapterBeats = Array.isArray(chapter?.beats) ? chapter.beats : [];

    for (const beat of chapterBeats) {
      const beatId = normalizeBeatId(beat?.id ?? beat?.beatId);
      if (!beatId) continue;

      beats.push({
        beatId,
        chapterNumber: chapter?.chapterNumber,
      });
    }
  }

  return beats;
}

function evaluateProjectPublishabilityScore({ project, criticalFailures, warnings }) {
  if (!project) {
    return 0;
  }

  const penalty = (criticalFailures.length * 20) + (warnings.length * 5);
  return Math.max(0, Math.min(100, 100 - penalty));
}

function buildSummary(publishable, criticalFailures, warnings, checks = {}) {
  const bookBrief = checks.bookBrief;
  const bookBriefSummary = bookBrief?.exists
    ? bookBrief.aiDisclosureConfigured && bookBrief.humanReviewTracked
      ? ' BookBrief metadata is configured.'
      : ' BookBrief metadata is partially configured.'
    : '';

  if (publishable) {
    if (warnings.length === 0) {
      return `Project passes the basic technical publishability gate.${bookBriefSummary}`;
    }

    if (checks.publicationReady?.status === 'failed') {
      return `Project can be technically exported, but is not publication ready yet.${bookBriefSummary}`;
    }

    return `Project passes the basic technical gate with warnings to review.${bookBriefSummary}`;
  }

  return `Project is not technically publishable yet: ${criticalFailures.length} critical issue(s) must be resolved.${bookBriefSummary}`;
}

function evaluatePublishabilitySnapshot({ project, bible, scenes, bookBrief } = {}) {
  const criticalFailures = [];
  const warnings = [];
  const checks = {};
  const projectId = getProjectId(project);
  const safeScenes = Array.isArray(scenes) ? scenes : [];
  const isShortStory = Boolean(project?.isShortStory);

  if (!project) {
    criticalFailures.push(createIssue(
      'PROJECT_NOT_FOUND',
      'Project was not found.',
      'critical'
    ));

    checks.project = createCheck('failed', { exists: false });

    return {
      projectId: null,
      publishable: false,
      score: 0,
      criticalFailures,
      warnings,
      checks,
      summary: buildSummary(false, criticalFailures, warnings, checks),
    };
  }

  checks.project = createCheck('passed', { exists: true });

  const bookBriefAiDisclosure = getBookBriefAiDisclosureStatus(bookBrief);
  const bookBriefHumanReview = getBookBriefHumanReviewStatus(bookBrief);
  const bookBriefTargetWordCount = getPositiveNumber(bookBrief?.targetWordCount);

  checks.bookBrief = createCheck(bookBrief ? 'passed' : 'warning', {
    exists: Boolean(bookBrief),
    aiDisclosureConfigured: bookBriefAiDisclosure.configured,
    humanReviewTracked: bookBriefHumanReview.tracked,
    humanReviewStatus: bookBriefHumanReview.value,
    monetizationMode: normalizeStatus(bookBrief?.monetizationMode) || null,
    targetWordCount: bookBriefTargetWordCount,
  });

  if (!hasText(getProjectTitle(project))) {
    warnings.push(createIssue(
      'PROJECT_TITLE_MISSING',
      'Project title is missing.',
      'warning'
    ));
    checks.projectTitle = createCheck('warning');
  } else {
    checks.projectTitle = createCheck('passed');
  }

  if (!bible) {
    const issue = createIssue(
      'BIBLE_MISSING',
      isShortStory
        ? 'Project has no Bible. Short stories can continue, but structure metadata is limited.'
        : 'Project Bible is missing.',
      isShortStory ? 'warning' : 'critical'
    );

    if (isShortStory) {
      warnings.push(issue);
      checks.bible = createCheck('warning', { exists: false, required: false });
    } else {
      criticalFailures.push(issue);
      checks.bible = createCheck('failed', { exists: false, required: true });
    }
  } else {
    checks.bible = createCheck('passed', { exists: true });
  }

  if (safeScenes.length === 0) {
    criticalFailures.push(createIssue(
      'SCENES_MISSING',
      'Project has no scenes.',
      'critical'
    ));
    checks.scenes = createCheck('failed', { total: 0 });
  } else {
    checks.scenes = createCheck('passed', { total: safeScenes.length });
  }

  const sceneWordCounts = safeScenes.map((scene) => ({
    scene,
    words: countWords(scene?.content),
  }));
  const emptyScenes = sceneWordCounts.filter(({ scene }) => !hasText(scene?.content));
  const shortScenes = sceneWordCounts.filter(({ scene, words }) => hasText(scene?.content) && words < MIN_SCENE_WORDS_WARNING);
  const totalWordCount = sceneWordCounts.reduce((sum, { words }) => sum + words, 0);

  if (emptyScenes.length > 0) {
    criticalFailures.push(createIssue(
      'SCENE_CONTENT_MISSING',
      `${emptyScenes.length} scene(s) have no content.`,
      'critical'
    ));
  }

  if (shortScenes.length > 0) {
    warnings.push(createIssue(
      'SCENE_CONTENT_TOO_SHORT',
      `${shortScenes.length} scene(s) are very short.`,
      'warning'
    ));
  }

  checks.sceneContent = createCheck(emptyScenes.length > 0 ? 'failed' : 'passed', {
    emptyScenes: emptyScenes.length,
    shortScenes: shortScenes.length,
  });

  const projectTargetWordCount = getPositiveNumber(project?.targetWordCount);
  const targetWordCount = projectTargetWordCount || bookBriefTargetWordCount;
  const hasTargetWordCount = targetWordCount !== null;

  if (hasTargetWordCount) {
    if (totalWordCount < targetWordCount * WORD_COUNT_LOW_RATIO) {
      warnings.push(createIssue(
        'WORD_COUNT_LOW',
        'Total scene word count is far below the project target.',
        'warning'
      ));
    }

    if (totalWordCount < targetWordCount * MANUSCRIPT_INCOMPLETE_RATIO) {
      warnings.push(createIssue(
        'MANUSCRIPT_INCOMPLETE_FOR_TARGET',
        'Manuscript word count is below 60% of the configured publication target.',
        'warning'
      ));
    }

    if (totalWordCount > targetWordCount * WORD_COUNT_HIGH_RATIO) {
      warnings.push(createIssue(
        'WORD_COUNT_HIGH',
        'Total scene word count is far above the project target.',
        'warning'
      ));
    }
  }

  checks.wordCount = createCheck('passed', {
    total: totalWordCount,
    target: hasTargetWordCount ? targetWordCount : null,
    targetSource: projectTargetWordCount ? 'project' : bookBriefTargetWordCount ? 'bookBrief' : null,
    lowThreshold: hasTargetWordCount ? Math.floor(targetWordCount * WORD_COUNT_LOW_RATIO) : null,
    highThreshold: hasTargetWordCount ? Math.ceil(targetWordCount * WORD_COUNT_HIGH_RATIO) : null,
  });

  let orderedScenes = [];
  let sceneGroups = [];
  let sortError = null;

  try {
    orderedScenes = sortScenesForManuscript(safeScenes);
    sceneGroups = groupScenesForManuscript(safeScenes);
    checks.sceneOrder = createCheck('passed', {
      orderedScenes: orderedScenes.length,
      groups: sceneGroups.length,
    });
  } catch (error) {
    sortError = error;
    checks.sceneOrder = createCheck('failed');
  }

  const chapterBeats = getChapterBeats(bible);
  const expectedBeatIds = new Set(chapterBeats.map((beat) => beat.beatId));
  const sceneBeatIds = new Set(safeScenes.map((scene) => normalizeBeatId(scene?.beatId)).filter(Boolean));
  const missingBeatIds = chapterBeats
    .map((beat) => beat.beatId)
    .filter((beatId) => !sceneBeatIds.has(beatId));
  const coveredBeatCount = chapterBeats.length - missingBeatIds.length;

  if (chapterBeats.length > 0) {
    const missingRatio = missingBeatIds.length / chapterBeats.length;

    if (coveredBeatCount === 0 || missingRatio > MISSING_BEATS_CRITICAL_RATIO) {
      criticalFailures.push(createIssue(
        'BEATS_MISSING_SCENES',
        `${missingBeatIds.length} expected beat(s) have no scene.`,
        'critical'
      ));
    } else if (missingBeatIds.length > 0) {
      warnings.push(createIssue(
        'BEATS_MISSING_SCENES',
        `${missingBeatIds.length} expected beat(s) have no scene.`,
        'warning'
      ));
    }
  }

  checks.beatCoverage = createCheck(
    chapterBeats.length > 0 && (coveredBeatCount === 0 || missingBeatIds.length / chapterBeats.length > MISSING_BEATS_CRITICAL_RATIO)
      ? 'failed'
      : missingBeatIds.length > 0
        ? 'warning'
        : 'passed',
    {
      expectedBeats: chapterBeats.length,
      coveredBeats: coveredBeatCount,
      missingBeats: missingBeatIds.length,
    }
  );

  const hasChapters = chapterBeats.length > 0;
  const chapterLinkedScenes = safeScenes.filter((scene) => expectedBeatIds.has(normalizeBeatId(scene?.beatId)));
  const scenesMissingChapterNumber = chapterLinkedScenes.filter((scene) => !hasChapterNumber(scene));

  if (hasChapters && !isShortStory && scenesMissingChapterNumber.length > 0) {
    warnings.push(createIssue(
      'CHAPTER_NUMBER_MISSING',
      `${scenesMissingChapterNumber.length} chapter-linked scene(s) are missing chapterNumber.`,
      'warning'
    ));
  }

  checks.chapterNumbers = createCheck(
    hasChapters && !isShortStory && scenesMissingChapterNumber.length > 0 ? 'warning' : 'passed',
    {
      required: hasChapters && !isShortStory,
      missing: scenesMissingChapterNumber.length,
    }
  );

  const aiDisclosureConfigured = bookBrief
    ? bookBriefAiDisclosure.configured
    : hasAiDisclosure(project);

  if (!aiDisclosureConfigured) {
    warnings.push(createIssue(
      'AI_DISCLOSURE_MISSING',
      'AI disclosure metadata is not configured yet.',
      'warning'
    ));
    checks.aiDisclosure = createCheck('warning', {
      tracked: false,
      source: bookBrief ? 'bookBrief' : 'project',
    });
  } else {
    checks.aiDisclosure = createCheck('passed', {
      tracked: true,
      source: bookBrief ? 'bookBrief' : 'project',
    });
  }

  const humanReviewTracked = bookBrief
    ? bookBriefHumanReview.tracked
    : hasHumanReviewStatus(project);

  if (bookBrief && bookBriefHumanReview.pending) {
    warnings.push(createIssue(
      'HUMAN_REVIEW_PENDING',
      'Human review is tracked but not completed yet.',
      'warning'
    ));
    checks.humanReview = createCheck('warning', {
      tracked: true,
      reviewStatus: bookBriefHumanReview.value,
      source: 'bookBrief',
    });
  } else if (bookBrief && bookBriefHumanReview.complete) {
    checks.humanReview = createCheck('passed', {
      tracked: true,
      reviewStatus: bookBriefHumanReview.value,
      source: 'bookBrief',
    });
  } else if (!humanReviewTracked) {
    warnings.push(createIssue(
      'HUMAN_REVIEW_NOT_TRACKED',
      'Human review status is not tracked yet.',
      'warning'
    ));
    checks.humanReview = createCheck('warning', {
      tracked: false,
      reviewStatus: bookBriefHumanReview.value,
      source: bookBrief ? 'bookBrief' : 'project',
    });
  } else {
    checks.humanReview = createCheck('passed', {
      tracked: true,
      source: 'project',
    });
  }

  const exportReady = safeScenes.length > 0 && emptyScenes.length === 0 && !sortError;

  if (!exportReady) {
    criticalFailures.push(createIssue(
      'EXPORT_READINESS_FAILED',
      'Project does not meet minimum technical export readiness.',
      'critical'
    ));
  }

  checks.exportReadiness = createCheck(exportReady ? 'passed' : 'failed', {
    hasScenes: safeScenes.length > 0,
    hasContent: emptyScenes.length === 0,
    canOrderScenes: !sortError,
  });

  const technicalExportable = exportReady;
  const incompleteForTarget = hasTargetWordCount && totalWordCount < targetWordCount * MANUSCRIPT_INCOMPLETE_RATIO;
  const publicationReady = criticalFailures.length === 0 && !incompleteForTarget;
  checks.publicationReady = createCheck(publicationReady ? 'passed' : 'failed', {
    technicalExportable,
    targetWordCount: hasTargetWordCount ? targetWordCount : null,
    totalWordCount,
    minimumPublicationWordCount: hasTargetWordCount ? Math.floor(targetWordCount * MANUSCRIPT_INCOMPLETE_RATIO) : null,
    readinessStatus: publicationReady ? 'publication_ready' : incompleteForTarget ? 'draft_incomplete' : 'blocked',
  });
  const publishable = publicationReady;
  const score = evaluateProjectPublishabilityScore({ project, criticalFailures, warnings });

  return {
    projectId,
    publishable,
    technicalExportable,
    publicationReady,
    readinessStatus: checks.publicationReady.readinessStatus,
    score,
    criticalFailures,
    warnings,
    checks,
    summary: buildSummary(publishable, criticalFailures, warnings, checks),
  };
}

async function evaluateProjectPublishability(projectId) {
  const Project = require('../models/Project');
  const Bible = require('../models/Bible');
  const Scene = require('../models/Scene');
  const { getBookBriefByProjectId } = require('./bookBriefService');

  const project = await Project.findById(projectId);

  if (!project) {
    return evaluatePublishabilitySnapshot({ project: null, bible: null, scenes: [] });
  }

  const [bible, scenes, bookBrief] = await Promise.all([
    Bible.findOne({ projectId: project._id }),
    Scene.find({ projectId: project._id }),
    getBookBriefByProjectId(project._id),
  ]);

  return evaluatePublishabilitySnapshot({ project, bible, scenes, bookBrief });
}

module.exports = {
  countWords,
  evaluateProjectPublishability,
  evaluatePublishabilitySnapshot,
};
