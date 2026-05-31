const DEFAULT_LANGUAGE = 'Português Brasileiro';
const DEFAULT_MONETIZATION_MODE = 'undecided';
const DEFAULT_AI_DISCLOSURE = 'not_configured';
const DEFAULT_HUMAN_REVIEW_STATUS = 'not_tracked';

const MAX_SHORT_TEXT_LENGTH = 180;
const MAX_MEDIUM_TEXT_LENGTH = 500;
const MAX_NOTES_LENGTH = 2000;
const MAX_ARRAY_ITEMS = 30;
const MAX_CONTENT_GUIDELINE_TOPICS = 30;
const PROMPT_TEXT_LIMIT = 140;
const PROMPT_ARRAY_ITEMS_LIMIT = 6;

const STRING_FIELDS = [
    'genre',
    'subgenre',
    'targetAudience',
    'language',
    'tone',
    'narrativeVoice',
    'corePromise',
    'protagonistWant',
    'protagonistNeed',
    'centralConflict',
    'monetizationMode',
    'seriesName',
    'aiDisclosure',
    'humanReviewStatus',
    'notes'
];

const NUMBER_FIELDS = [
    'targetWordCount',
    'targetChapterCount',
    'bookNumber'
];

const ARRAY_FIELDS = [
    'readerAppeal',
    'mustInclude',
    'mustAvoid',
    'comparableTitles',
    'keywords'
];

const CONTENT_GUIDELINE_STRING_FIELDS = [
    'violenceLevel',
    'romanceLevel',
    'profanityLevel',
    'sexualContentLevel'
];

function trimString(value) {
    if (typeof value !== 'string') {
        return value;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeShortString(value, maxLength = MAX_SHORT_TEXT_LENGTH) {
    const trimmed = trimString(value);

    if (typeof trimmed !== 'string') {
        return trimmed;
    }

    return trimmed.slice(0, maxLength);
}

function normalizeStringArray(value, maxItems = MAX_ARRAY_ITEMS) {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .map(item => normalizeShortString(item))
        .filter(item => typeof item === 'string' && item.length > 0)
        .slice(0, maxItems);
}

function normalizeOptionalPositiveNumber(value) {
    if (value === undefined || value === null || value === '') {
        return undefined;
    }

    if (typeof value === 'string' && value.trim() === '') {
        return undefined;
    }

    const number = Number(value);
    return Number.isFinite(number) ? number : value;
}

function normalizeContentGuidelines(input = {}) {
    const source = input && typeof input === 'object' && !Array.isArray(input)
        ? input
        : {};
    const contentGuidelines = {};

    for (const field of CONTENT_GUIDELINE_STRING_FIELDS) {
        const value = normalizeShortString(source[field], 80);
        if (value !== undefined) {
            contentGuidelines[field] = value;
        }
    }

    contentGuidelines.sensitiveTopics = normalizeStringArray(
        source.sensitiveTopics,
        MAX_CONTENT_GUIDELINE_TOPICS
    );

    return contentGuidelines;
}

function hasPromptValue(value) {
    return value !== undefined && value !== null && String(value).trim().length > 0;
}

function formatPromptText(value, maxLength = PROMPT_TEXT_LIMIT) {
    if (!hasPromptValue(value)) {
        return null;
    }

    const normalized = String(value).replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength) {
        return normalized;
    }

    return `${normalized.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function formatPromptNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : null;
}

function formatPromptArray(value, maxItems = PROMPT_ARRAY_ITEMS_LIMIT) {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .map(item => formatPromptText(item))
        .filter(Boolean)
        .slice(0, maxItems);
}

function appendPromptLine(lines, label, value, maxLength = PROMPT_TEXT_LIMIT) {
    const text = formatPromptText(value, maxLength);
    if (text) {
        lines.push(`- ${label}: ${text}`);
    }
}

function appendPromptNumberLine(lines, label, value, suffix = '') {
    const number = formatPromptNumber(value);
    if (number) {
        lines.push(`- ${label}: ${number}${suffix}`);
    }
}

function appendPromptArrayLines(lines, label, value) {
    const items = formatPromptArray(value);
    if (items.length > 0) {
        lines.push(`- ${label}:`);
        items.forEach(item => lines.push(`  - ${item}`));
    }
}

function buildBookBriefPromptContext(bookBrief) {
    if (!bookBrief) {
        return '';
    }

    const source = typeof bookBrief.toObject === 'function'
        ? bookBrief.toObject()
        : bookBrief;
    const lines = ['EDITORIAL BRIEF'];

    appendPromptLine(lines, 'Language', source.language);
    appendPromptLine(lines, 'Genre', source.genre);
    appendPromptLine(lines, 'Subgenre', source.subgenre);
    appendPromptLine(lines, 'Target audience', source.targetAudience);
    appendPromptLine(lines, 'Tone', source.tone);
    appendPromptLine(lines, 'Narrative voice', source.narrativeVoice);
    appendPromptLine(lines, 'Core promise', source.corePromise, MAX_MEDIUM_TEXT_LENGTH);
    appendPromptLine(lines, 'Protagonist want', source.protagonistWant, MAX_MEDIUM_TEXT_LENGTH);
    appendPromptLine(lines, 'Protagonist need', source.protagonistNeed, MAX_MEDIUM_TEXT_LENGTH);
    appendPromptLine(lines, 'Central conflict', source.centralConflict, MAX_MEDIUM_TEXT_LENGTH);
    appendPromptNumberLine(lines, 'Overall target word count', source.targetWordCount, ' words');
    appendPromptNumberLine(lines, 'Overall target chapter count', source.targetChapterCount);
    appendPromptLine(lines, 'Monetization mode', source.monetizationMode);

    const seriesName = formatPromptText(source.seriesName);
    const bookNumber = formatPromptNumber(source.bookNumber);
    if (seriesName || bookNumber) {
        lines.push(`- Series: ${seriesName || 'Unspecified'}${bookNumber ? `, Book ${bookNumber}` : ''}`);
    }

    appendPromptLine(lines, 'AI disclosure intent', source.aiDisclosure);
    appendPromptLine(lines, 'Human review status', source.humanReviewStatus);
    appendPromptArrayLines(lines, 'Reader appeal', source.readerAppeal);
    appendPromptArrayLines(lines, 'Must include', source.mustInclude);
    appendPromptArrayLines(lines, 'Must avoid', source.mustAvoid);

    const contentGuidelines = source.contentGuidelines || {};
    const guidelineLines = [];
    appendPromptLine(guidelineLines, 'Violence level', contentGuidelines.violenceLevel);
    appendPromptLine(guidelineLines, 'Romance level', contentGuidelines.romanceLevel);
    appendPromptLine(guidelineLines, 'Profanity level', contentGuidelines.profanityLevel);
    appendPromptLine(guidelineLines, 'Sexual content level', contentGuidelines.sexualContentLevel);
    appendPromptArrayLines(guidelineLines, 'Sensitive topics', contentGuidelines.sensitiveTopics);
    if (guidelineLines.length > 0) {
        lines.push('- Content guidelines:');
        guidelineLines.forEach(line => lines.push(`  ${line}`));
    }

    const comparableTitles = formatPromptArray(source.comparableTitles);
    if (comparableTitles.length > 0) {
        lines.push('- Comparable titles for market positioning only. Do not imitate or copy style, characters, scenes, or structure:');
        comparableTitles.forEach(title => lines.push(`  - ${title}`));
    }

    appendPromptArrayLines(lines, 'Keywords for positioning', source.keywords);

    return lines.length > 1 ? lines.join('\n') : '';
}

function normalizeBookBriefInput(input = {}) {
    const source = input && typeof input === 'object' && !Array.isArray(input)
        ? input
        : {};
    const normalized = {};

    for (const field of STRING_FIELDS) {
        const maxLength = field === 'notes'
            ? MAX_NOTES_LENGTH
            : ['corePromise', 'protagonistWant', 'protagonistNeed', 'centralConflict'].includes(field)
                ? MAX_MEDIUM_TEXT_LENGTH
                : MAX_SHORT_TEXT_LENGTH;
        const value = normalizeShortString(source[field], maxLength);
        if (value !== undefined) {
            normalized[field] = value;
        }
    }

    for (const field of NUMBER_FIELDS) {
        const value = normalizeOptionalPositiveNumber(source[field]);
        if (value !== undefined) {
            normalized[field] = value;
        }
    }

    for (const field of ARRAY_FIELDS) {
        normalized[field] = normalizeStringArray(source[field]);
    }

    normalized.contentGuidelines = normalizeContentGuidelines(source.contentGuidelines);

    if (!normalized.language) {
        normalized.language = DEFAULT_LANGUAGE;
    }

    if (!normalized.monetizationMode) {
        normalized.monetizationMode = DEFAULT_MONETIZATION_MODE;
    }

    if (!normalized.aiDisclosure) {
        normalized.aiDisclosure = DEFAULT_AI_DISCLOSURE;
    }

    if (!normalized.humanReviewStatus) {
        normalized.humanReviewStatus = DEFAULT_HUMAN_REVIEW_STATUS;
    }

    return normalized;
}

function validatePositiveNumber(normalized, field, errors) {
    if (normalized[field] === undefined) {
        return;
    }

    if (
        typeof normalized[field] !== 'number' ||
        !Number.isFinite(normalized[field]) ||
        normalized[field] <= 0
    ) {
        errors.push({
            field,
            message: `${field} must be a positive number.`
        });
    }
}

function validateBookBriefInput(input = {}) {
    const normalized = normalizeBookBriefInput(input);
    const errors = [];

    validatePositiveNumber(normalized, 'targetWordCount', errors);
    validatePositiveNumber(normalized, 'targetChapterCount', errors);
    validatePositiveNumber(normalized, 'bookNumber', errors);

    return {
        valid: errors.length === 0,
        errors,
        normalized
    };
}

async function getBookBriefByProjectId(projectId) {
    const BookBrief = require('../models/BookBrief');
    return BookBrief.findOne({ projectId });
}

async function upsertBookBriefForProject(projectId, input) {
    const BookBrief = require('../models/BookBrief');
    const validation = validateBookBriefInput(input);

    if (!validation.valid) {
        const error = new Error('Invalid BookBrief input.');
        error.name = 'BookBriefValidationError';
        error.validationErrors = validation.errors;
        throw error;
    }

    return BookBrief.findOneAndUpdate(
        { projectId },
        {
            $set: {
                ...validation.normalized,
                projectId
            }
        },
        {
            new: true,
            upsert: true,
            runValidators: true,
            setDefaultsOnInsert: true
        }
    );
}

async function deleteBookBriefForProject(projectId) {
    const BookBrief = require('../models/BookBrief');
    return BookBrief.findOneAndDelete({ projectId });
}

module.exports = {
    DEFAULT_AI_DISCLOSURE,
    DEFAULT_HUMAN_REVIEW_STATUS,
    DEFAULT_LANGUAGE,
    DEFAULT_MONETIZATION_MODE,
    MAX_ARRAY_ITEMS,
    buildBookBriefPromptContext,
    normalizeBookBriefInput,
    validateBookBriefInput,
    getBookBriefByProjectId,
    upsertBookBriefForProject,
    deleteBookBriefForProject
};
