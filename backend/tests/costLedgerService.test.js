const test = require('node:test');
const assert = require('node:assert/strict');

const {
    normalizeCostLedgerEntry,
    estimateCost,
    buildCostSummary,
    extractUsageTokens,
    sanitizeMetadata
} = require('../services/costLedgerService');

test('normalizeCostLedgerEntry applies defaults and converts token values', () => {
    const entry = normalizeCostLedgerEntry({
        inputTokens: '1200',
        outputTokens: 300,
        totalTokens: 'not-a-number',
        durationMs: '42',
        estimatedCost: '0.0015'
    });

    assert.equal(entry.provider, 'unknown');
    assert.equal(entry.model, 'unknown');
    assert.equal(entry.task, 'unknown');
    assert.equal(entry.stage, 'unknown');
    assert.equal(entry.requestType, 'unknown');
    assert.equal(entry.status, 'success');
    assert.equal(entry.currency, 'USD');
    assert.equal(entry.inputTokens, 1200);
    assert.equal(entry.outputTokens, 300);
    assert.equal(entry.totalTokens, 1500);
    assert.equal(entry.durationMs, 42);
    assert.equal(entry.estimatedCost, 0.0015);
});

test('normalizeCostLedgerEntry removes invalid numbers and sanitizes metadata', () => {
    const entry = normalizeCostLedgerEntry({
        inputTokens: Number.NaN,
        outputTokens: -1,
        metadata: {
            apiKey: 'secret-key',
            token: 'secret-token',
            authorization: 'Bearer abc',
            prompt: 'FULL PROMPT',
            response: 'FULL RESPONSE',
            content: 'FULL CONTENT',
            sceneContent: 'FULL SCENE',
            manuscript: 'FULL MANUSCRIPT',
            bookBrief: { private: true },
            qualityReport: { private: true },
            publishingPackage: { private: true },
            beatId: 7,
            chapterNumber: 2,
            source: 'unit-test'
        },
        errorSummary: 'x'.repeat(800)
    });

    const serialized = JSON.stringify(entry.metadata);
    assert.equal(entry.inputTokens, null);
    assert.equal(entry.outputTokens, null);
    assert.equal(entry.totalTokens, null);
    assert.equal(serialized.includes('secret-key'), false);
    assert.equal(serialized.includes('FULL PROMPT'), false);
    assert.equal(serialized.includes('FULL RESPONSE'), false);
    assert.equal(serialized.includes('FULL CONTENT'), false);
    assert.equal(serialized.includes('FULL SCENE'), false);
    assert.equal(serialized.includes('FULL MANUSCRIPT'), false);
    assert.equal(serialized.includes('bookBrief'), false);
    assert.equal(entry.metadata.beatId, 7);
    assert.equal(entry.metadata.chapterNumber, 2);
    assert.ok(entry.errorSummary.length <= 530);
});

test('sanitizeMetadata keeps safe fields and drops sensitive aliases', () => {
    assert.deepEqual(sanitizeMetadata({
        connectionString: 'mongodb://secret',
        password: 'pw',
        wordCount: 1200,
        source: 'scene'
    }), {
        wordCount: 1200,
        source: 'scene'
    });
});

test('estimateCost returns null without pricingConfig', () => {
    assert.equal(estimateCost({
        provider: 'gemini',
        model: 'test-model',
        inputTokens: 1000,
        outputTokens: 2000
    }), null);
});

test('estimateCost calculates cost with optional pricingConfig', () => {
    const cost = estimateCost({
        provider: 'gemini',
        model: 'test-model',
        inputTokens: 1000000,
        outputTokens: 500000,
        pricingConfig: {
            gemini: {
                'test-model': {
                    inputTokenPrice: 1,
                    outputTokenPrice: 2
                }
            }
        }
    });

    assert.equal(cost, 2);
});

test('estimateCost handles missing tokens and avoids NaN', () => {
    assert.equal(estimateCost({
        provider: 'gemini',
        model: 'test-model',
        inputTokens: null,
        outputTokens: undefined,
        pricingConfig: {
            gemini: {
                'test-model': {
                    inputTokenPrice: 1,
                    outputTokenPrice: 2
                }
            }
        }
    }), null);
});

test('buildCostSummary returns zeros for empty entries', () => {
    assert.deepEqual(buildCostSummary([]), {
        totalEstimatedCost: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokens: 0,
        callCount: 0,
        errorCount: 0,
        byProvider: {},
        byModel: {},
        byTask: {},
        currency: 'USD'
    });
});

test('buildCostSummary sums tokens, costs and groups entries', () => {
    const summary = buildCostSummary([
        {
            provider: 'gemini',
            model: 'gemini-test',
            task: 'generate_scene',
            status: 'success',
            inputTokens: 100,
            outputTokens: 50,
            totalTokens: 150,
            estimatedCost: 0.01
        },
        {
            provider: 'lm-studio',
            model: 'local-test',
            task: 'summarize_scene',
            status: 'error',
            inputTokens: 20,
            outputTokens: null,
            totalTokens: 20,
            estimatedCost: null
        }
    ]);

    assert.equal(summary.callCount, 2);
    assert.equal(summary.errorCount, 1);
    assert.equal(summary.totalEstimatedCost, 0.01);
    assert.equal(summary.totalInputTokens, 120);
    assert.equal(summary.totalOutputTokens, 50);
    assert.equal(summary.totalTokens, 170);
    assert.equal(summary.byProvider.gemini.callCount, 1);
    assert.equal(summary.byProvider['lm-studio'].errorCount, 1);
    assert.equal(summary.byModel['gemini-test'].totalTokens, 150);
    assert.equal(summary.byTask.generate_scene.totalEstimatedCost, 0.01);
});

test('extractUsageTokens supports OpenAI-like usage', () => {
    assert.deepEqual(extractUsageTokens({
        prompt_tokens: 10,
        completion_tokens: 15,
        total_tokens: 25
    }), {
        inputTokens: 10,
        outputTokens: 15,
        totalTokens: 25
    });
});

test('extractUsageTokens supports input/output usage', () => {
    assert.deepEqual(extractUsageTokens({
        input_tokens: 11,
        output_tokens: 7
    }), {
        inputTokens: 11,
        outputTokens: 7,
        totalTokens: 18
    });
});

test('extractUsageTokens supports Gemini-like usage metadata', () => {
    assert.deepEqual(extractUsageTokens({
        promptTokenCount: 30,
        candidatesTokenCount: 12,
        totalTokenCount: 42
    }), {
        inputTokens: 30,
        outputTokens: 12,
        totalTokens: 42
    });
});

test('extractUsageTokens returns nulls when usage is absent', () => {
    assert.deepEqual(extractUsageTokens(null), {
        inputTokens: null,
        outputTokens: null,
        totalTokens: null
    });
});
