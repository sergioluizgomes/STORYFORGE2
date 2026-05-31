const test = require('node:test');
const assert = require('node:assert/strict');

const {
    DEFAULT_AI_DISCLOSURE,
    DEFAULT_HUMAN_REVIEW_STATUS,
    DEFAULT_MONETIZATION_MODE,
    MAX_ARRAY_ITEMS,
    buildBookBriefPromptContext,
    normalizeBookBriefInput,
    validateBookBriefInput
} = require('../services/bookBriefService');

test('normalizeBookBriefInput trims strings and removes empty array entries', () => {
    const normalized = normalizeBookBriefInput({
        genre: '  Fantasia  ',
        targetAudience: '  Jovens adultos  ',
        mustInclude: [' protagonista forte ', '', '   ', 'conflito claro']
    });

    assert.equal(normalized.genre, 'Fantasia');
    assert.equal(normalized.targetAudience, 'Jovens adultos');
    assert.deepEqual(normalized.mustInclude, ['protagonista forte', 'conflito claro']);
});

test('normalizeBookBriefInput limits arrays', () => {
    const normalized = normalizeBookBriefInput({
        keywords: Array.from({ length: MAX_ARRAY_ITEMS + 5 }, (_, index) => `keyword ${index}`)
    });

    assert.equal(normalized.keywords.length, MAX_ARRAY_ITEMS);
});

test('normalizeBookBriefInput applies safe defaults', () => {
    const normalized = normalizeBookBriefInput({});

    assert.equal(normalized.monetizationMode, DEFAULT_MONETIZATION_MODE);
    assert.equal(normalized.aiDisclosure, DEFAULT_AI_DISCLOSURE);
    assert.equal(normalized.humanReviewStatus, DEFAULT_HUMAN_REVIEW_STATUS);
});

test('normalizeBookBriefInput converts numeric strings when possible', () => {
    const normalized = normalizeBookBriefInput({
        targetWordCount: '50000',
        targetChapterCount: '24',
        bookNumber: '2'
    });

    assert.equal(normalized.targetWordCount, 50000);
    assert.equal(normalized.targetChapterCount, 24);
    assert.equal(normalized.bookNumber, 2);
});

test('normalizeBookBriefInput normalizes content guidelines without sensitive echoes', () => {
    const normalized = normalizeBookBriefInput({
        contentGuidelines: {
            violenceLevel: '  moderate  ',
            sensitiveTopics: [' grief ', '', 'politics']
        }
    });

    assert.equal(normalized.contentGuidelines.violenceLevel, 'moderate');
    assert.deepEqual(normalized.contentGuidelines.sensitiveTopics, ['grief', 'politics']);
});

test('validateBookBriefInput accepts minimal input', () => {
    const validation = validateBookBriefInput({});

    assert.equal(validation.valid, true);
    assert.deepEqual(validation.errors, []);
});

test('validateBookBriefInput rejects negative targetWordCount', () => {
    const validation = validateBookBriefInput({ targetWordCount: -1 });

    assert.equal(validation.valid, false);
    assert.equal(validation.errors[0].field, 'targetWordCount');
    assert.match(validation.errors[0].message, /positive number/);
});

test('validateBookBriefInput rejects negative targetChapterCount', () => {
    const validation = validateBookBriefInput({ targetChapterCount: -3 });

    assert.equal(validation.valid, false);
    assert.equal(validation.errors[0].field, 'targetChapterCount');
    assert.match(validation.errors[0].message, /positive number/);
});

test('validateBookBriefInput rejects negative bookNumber', () => {
    const validation = validateBookBriefInput({ bookNumber: -2 });

    assert.equal(validation.valid, false);
    assert.equal(validation.errors[0].field, 'bookNumber');
    assert.match(validation.errors[0].message, /positive number/);
});

test('validateBookBriefInput does not echo sensitive field values in errors', () => {
    const validation = validateBookBriefInput({ targetWordCount: 'secret manuscript text' });

    assert.equal(validation.valid, false);
    assert.equal(validation.errors[0].message.includes('secret manuscript text'), false);
});

test('buildBookBriefPromptContext returns empty text for missing BookBrief', () => {
    assert.equal(buildBookBriefPromptContext(null), '');
    assert.equal(buildBookBriefPromptContext(undefined), '');
});

test('buildBookBriefPromptContext includes minimal editorial fields', () => {
    const context = buildBookBriefPromptContext({
        language: 'Portugues Brasileiro',
        genre: 'Fantasia urbana',
        targetAudience: 'Jovens adultos'
    });

    assert.match(context, /EDITORIAL BRIEF/);
    assert.match(context, /Language: Portugues Brasileiro/);
    assert.match(context, /Genre: Fantasia urbana/);
    assert.match(context, /Target audience: Jovens adultos/);
});

test('buildBookBriefPromptContext filters and limits editorial arrays', () => {
    const context = buildBookBriefPromptContext({
        mustInclude: ['ambientacao brasileira', '', 'conflito familiar', 'mentor suspeito', 'portal', 'chuva', 'ritual', 'extra'],
        mustAvoid: ['violencia grafica excessiva', '   ', 'cliches sem reviravolta']
    });

    assert.match(context, /Must include:/);
    assert.match(context, /ambientacao brasileira/);
    assert.match(context, /conflito familiar/);
    assert.doesNotMatch(context, /extra/);
    assert.match(context, /Must avoid:/);
    assert.match(context, /violencia grafica excessiva/);
    assert.match(context, /cliches sem reviravolta/);
});

test('buildBookBriefPromptContext does not include notes or internal fields', () => {
    const context = buildBookBriefPromptContext({
        _id: 'internal-id',
        projectId: 'internal-project-id',
        createdAt: 'internal-created-at',
        updatedAt: 'internal-updated-at',
        __v: 7,
        notes: 'private editorial notes should stay out',
        genre: 'Misterio'
    });

    assert.match(context, /Genre: Misterio/);
    assert.doesNotMatch(context, /internal-id/);
    assert.doesNotMatch(context, /internal-project-id/);
    assert.doesNotMatch(context, /internal-created-at/);
    assert.doesNotMatch(context, /internal-updated-at/);
    assert.doesNotMatch(context, /private editorial notes/);
    assert.doesNotMatch(context, /__v/);
});

test('buildBookBriefPromptContext frames comparable titles as positioning only', () => {
    const context = buildBookBriefPromptContext({
        comparableTitles: ['Titulo A', 'Titulo B']
    });

    assert.match(context, /market positioning only/);
    assert.match(context, /Do not imitate or copy/);
    assert.match(context, /Titulo A/);
    assert.match(context, /Titulo B/);
});

test('buildBookBriefPromptContext includes configured content guidelines', () => {
    const context = buildBookBriefPromptContext({
        contentGuidelines: {
            violenceLevel: 'moderate',
            romanceLevel: 'low',
            profanityLevel: 'low',
            sensitiveTopics: ['luto', 'abandono']
        }
    });

    assert.match(context, /Content guidelines:/);
    assert.match(context, /Violence level: moderate/);
    assert.match(context, /Romance level: low/);
    assert.match(context, /Profanity level: low/);
    assert.match(context, /Sensitive topics:/);
    assert.match(context, /luto/);
    assert.match(context, /abandono/);
});

test('buildBookBriefPromptContext truncates long strings and skips empty lines', () => {
    const longTone = 'a'.repeat(220);
    const context = buildBookBriefPromptContext({
        genre: '',
        tone: longTone,
        narrativeVoice: '   '
    });

    assert.match(context, /Tone: a+/);
    assert.match(context, /\.\.\./);
    assert.doesNotMatch(context, /Genre:/);
    assert.doesNotMatch(context, /Narrative voice:/);
});
