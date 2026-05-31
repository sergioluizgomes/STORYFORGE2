const { truncateForLog } = require('../utils/safeLog');

const SENSITIVE_METADATA_KEYS = new Set([
    'apikey',
    'api_key',
    'token',
    'authorization',
    'password',
    'secret',
    'connectionstring',
    'connection_string',
    'prompt',
    'response',
    'content',
    'manuscript',
    'scenecontent',
    'scene_content',
    'bookbrief',
    'book_brief',
    'qualityreport',
    'quality_report',
    'publishingpackage',
    'publishing_package'
]);

const MAX_METADATA_KEYS = 24;
const MAX_METADATA_DEPTH = 2;
const MAX_METADATA_STRING_LENGTH = 240;
const MAX_ERROR_LENGTH = 500;

function getCostLedgerModel() {
    return require('../models/CostLedger');
}

function normalizeKey(key) {
    return String(key || '').replace(/[-_\s]/g, '').toLowerCase();
}

function normalizeShortString(value, fallback = 'unknown') {
    if (value == null) return fallback;
    const text = String(value).trim();
    return text.length > 0 ? text.slice(0, 160) : fallback;
}

function normalizeStatus(value) {
    const status = normalizeShortString(value, 'success').toLowerCase();
    return ['success', 'error', 'skipped'].includes(status) ? status : 'success';
}

function normalizeRequestType(value) {
    const requestType = normalizeShortString(value, 'unknown').toLowerCase();
    return ['text', 'image', 'embedding', 'vision', 'unknown'].includes(requestType) ? requestType : 'unknown';
}

function normalizeNumber(value) {
    if (value == null || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : null;
}

function sanitizeMetadataValue(value, depth = 0) {
    if (value == null) return value;
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.slice(0, MAX_METADATA_STRING_LENGTH);
    if (value instanceof Date) return value.toISOString();
    if (depth >= MAX_METADATA_DEPTH) return '[object]';
    if (Array.isArray(value)) {
        return value.slice(0, 8).map(item => sanitizeMetadataValue(item, depth + 1));
    }
    if (typeof value === 'object') {
        return sanitizeMetadata(value, depth + 1);
    }
    return String(value).slice(0, MAX_METADATA_STRING_LENGTH);
}

function sanitizeMetadata(metadata, depth = 0) {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
        return {};
    }

    const sanitized = {};
    for (const [key, value] of Object.entries(metadata).slice(0, MAX_METADATA_KEYS)) {
        if (SENSITIVE_METADATA_KEYS.has(normalizeKey(key))) {
            continue;
        }
        sanitized[key] = sanitizeMetadataValue(value, depth);
    }
    return sanitized;
}

function normalizeCurrency(value) {
    if (value == null) return 'USD';
    const text = String(value).trim().toUpperCase();
    return text.length > 0 ? text.slice(0, 16) : 'USD';
}

function normalizeErrorSummary(value) {
    if (!value) return undefined;
    return truncateForLog(value, MAX_ERROR_LENGTH);
}

function summarizeErrorForCostLog(error) {
    if (!error) {
        return { message: 'Unknown error' };
    }

    return {
        name: error.name,
        message: truncateForLog(error.message || String(error), MAX_ERROR_LENGTH),
        code: error.code,
        status: error.status || error.statusCode || error.response?.status
    };
}

function normalizeCostLedgerEntry(input = {}) {
    const inputTokens = normalizeNumber(input.inputTokens);
    const outputTokens = normalizeNumber(input.outputTokens);
    const explicitTotalTokens = normalizeNumber(input.totalTokens);
    const totalTokens = explicitTotalTokens ?? (
        inputTokens != null || outputTokens != null
            ? (inputTokens || 0) + (outputTokens || 0)
            : null
    );

    return {
        projectId: input.projectId || undefined,
        seriesId: input.seriesId || undefined,
        task: normalizeShortString(input.task),
        stage: normalizeShortString(input.stage),
        provider: normalizeShortString(input.provider),
        model: normalizeShortString(input.model),
        requestType: normalizeRequestType(input.requestType),
        status: normalizeStatus(input.status),
        inputTokens,
        outputTokens,
        totalTokens,
        estimatedCost: normalizeNumber(input.estimatedCost),
        currency: normalizeCurrency(input.currency),
        durationMs: normalizeNumber(input.durationMs),
        metadata: sanitizeMetadata(input.metadata),
        errorSummary: normalizeErrorSummary(input.errorSummary)
    };
}

function resolvePricingEntry(pricingConfig, provider, model) {
    if (!pricingConfig || typeof pricingConfig !== 'object') return null;

    const providerPricing = pricingConfig[provider] || pricingConfig[normalizeShortString(provider)];
    if (!providerPricing || typeof providerPricing !== 'object') return null;

    return providerPricing[model] || providerPricing.default || null;
}

function estimateCost({ provider = 'unknown', model = 'unknown', inputTokens, outputTokens, totalTokens, pricingConfig } = {}) {
    const pricing = resolvePricingEntry(pricingConfig, provider, model);
    if (!pricing || typeof pricing !== 'object') return null;

    const normalizedInputTokens = normalizeNumber(inputTokens);
    const normalizedOutputTokens = normalizeNumber(outputTokens);
    const normalizedTotalTokens = normalizeNumber(totalTokens);
    const inputTokenPrice = normalizeNumber(pricing.inputTokenPrice);
    const outputTokenPrice = normalizeNumber(pricing.outputTokenPrice);
    const totalTokenPrice = normalizeNumber(pricing.totalTokenPrice);

    let cost = 0;
    let hasCost = false;

    if (inputTokenPrice != null && normalizedInputTokens != null) {
        cost += (normalizedInputTokens / 1000000) * inputTokenPrice;
        hasCost = true;
    }
    if (outputTokenPrice != null && normalizedOutputTokens != null) {
        cost += (normalizedOutputTokens / 1000000) * outputTokenPrice;
        hasCost = true;
    }
    if (!hasCost && totalTokenPrice != null && normalizedTotalTokens != null) {
        cost += (normalizedTotalTokens / 1000000) * totalTokenPrice;
        hasCost = true;
    }

    return hasCost && Number.isFinite(cost) ? cost : null;
}

async function recordCostEntry(input = {}) {
    const CostLedger = getCostLedgerModel();
    const entry = normalizeCostLedgerEntry(input);

    if (entry.estimatedCost == null) {
        entry.estimatedCost = estimateCost({
            provider: entry.provider,
            model: entry.model,
            inputTokens: entry.inputTokens,
            outputTokens: entry.outputTokens,
            totalTokens: entry.totalTokens,
            pricingConfig: input.pricingConfig
        });
    }

    return CostLedger.create(entry);
}

async function recordCostEntrySafe(input = {}) {
    try {
        return await recordCostEntry(input);
    } catch (error) {
        console.warn('[COST_LEDGER] record_failed', {
            projectId: input.projectId?.toString?.() || input.projectId,
            task: normalizeShortString(input.task),
            provider: normalizeShortString(input.provider),
            model: normalizeShortString(input.model),
            status: normalizeStatus(input.status),
            durationMs: normalizeNumber(input.durationMs),
            error: summarizeErrorForCostLog(error)
        });
        return null;
    }
}

function emptyGroup() {
    return {
        callCount: 0,
        errorCount: 0,
        totalEstimatedCost: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokens: 0
    };
}

function addToGroup(summary, key, entry) {
    const groupKey = normalizeShortString(key);
    if (!summary[groupKey]) {
        summary[groupKey] = emptyGroup();
    }

    const group = summary[groupKey];
    group.callCount += 1;
    if (entry.status === 'error') group.errorCount += 1;
    group.totalEstimatedCost += normalizeNumber(entry.estimatedCost) || 0;
    group.totalInputTokens += normalizeNumber(entry.inputTokens) || 0;
    group.totalOutputTokens += normalizeNumber(entry.outputTokens) || 0;
    group.totalTokens += normalizeNumber(entry.totalTokens) || 0;
}

function buildCostSummary(entries = []) {
    const summary = {
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
    };

    for (const rawEntry of entries || []) {
        const entry = normalizeCostLedgerEntry(rawEntry);
        summary.callCount += 1;
        if (entry.status === 'error') summary.errorCount += 1;
        summary.totalEstimatedCost += normalizeNumber(entry.estimatedCost) || 0;
        summary.totalInputTokens += normalizeNumber(entry.inputTokens) || 0;
        summary.totalOutputTokens += normalizeNumber(entry.outputTokens) || 0;
        summary.totalTokens += normalizeNumber(entry.totalTokens) || 0;
        if (entry.currency) summary.currency = entry.currency;

        addToGroup(summary.byProvider, entry.provider, entry);
        addToGroup(summary.byModel, entry.model, entry);
        addToGroup(summary.byTask, entry.task, entry);
    }

    return summary;
}

async function summarizeProjectCosts(projectId) {
    const CostLedger = getCostLedgerModel();
    const entries = await CostLedger.find({ projectId }).lean();
    return buildCostSummary(entries);
}

function extractUsageTokens(responseOrUsage) {
    const usage = responseOrUsage?.usage || responseOrUsage?.usageMetadata || responseOrUsage;
    if (!usage || typeof usage !== 'object') {
        return {
            inputTokens: null,
            outputTokens: null,
            totalTokens: null
        };
    }

    const inputTokens = normalizeNumber(
        usage.prompt_tokens
        ?? usage.input_tokens
        ?? usage.promptTokenCount
    );
    const outputTokens = normalizeNumber(
        usage.completion_tokens
        ?? usage.output_tokens
        ?? usage.candidatesTokenCount
    );
    const explicitTotalTokens = normalizeNumber(
        usage.total_tokens
        ?? usage.totalTokenCount
    );

    return {
        inputTokens,
        outputTokens,
        totalTokens: explicitTotalTokens ?? (
            inputTokens != null || outputTokens != null
                ? (inputTokens || 0) + (outputTokens || 0)
                : null
        )
    };
}

function toCostLedgerResponse(entry) {
    return {
        id: entry._id?.toString?.() || entry.id,
        projectId: entry.projectId?.toString?.() || entry.projectId,
        seriesId: entry.seriesId?.toString?.() || entry.seriesId,
        task: entry.task,
        stage: entry.stage,
        provider: entry.provider,
        model: entry.model,
        requestType: entry.requestType,
        status: entry.status,
        inputTokens: entry.inputTokens ?? null,
        outputTokens: entry.outputTokens ?? null,
        totalTokens: entry.totalTokens ?? null,
        estimatedCost: entry.estimatedCost ?? null,
        currency: entry.currency || 'USD',
        durationMs: entry.durationMs ?? null,
        metadata: sanitizeMetadata(entry.metadata),
        errorSummary: entry.errorSummary,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt
    };
}

module.exports = {
    normalizeCostLedgerEntry,
    estimateCost,
    recordCostEntry,
    recordCostEntrySafe,
    summarizeProjectCosts,
    buildCostSummary,
    extractUsageTokens,
    sanitizeMetadata,
    toCostLedgerResponse
};
