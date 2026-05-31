const SENSITIVE_KEY_PATTERN = /(api[-_]?key|token|authorization|password|secret|connection[-_]?string)/i;
const DEFAULT_MAX_LENGTH = 120;
const MAX_ARRAY_ITEMS = 8;
const MAX_OBJECT_KEYS = 16;

function truncateForLog(value, maxLength = DEFAULT_MAX_LENGTH) {
    if (value == null) {
        return value;
    }

    let text;
    if (typeof value === 'string') {
        text = value;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
        return value;
    } else if (value instanceof Error) {
        text = value.message;
    } else {
        try {
            text = JSON.stringify(redactSensitiveKeys(value));
        } catch (error) {
            text = Object.prototype.toString.call(value);
        }
    }

    if (text.length <= maxLength) {
        return text;
    }

    return `${text.slice(0, maxLength)}... [truncated ${text.length - maxLength} chars]`;
}

function redactSensitiveKeys(value, depth = 0) {
    if (value == null) {
        return value;
    }

    if (typeof value === 'string') {
        return truncateForLog(value);
    }

    if (typeof value !== 'object') {
        return value;
    }

    if (depth >= 4) {
        return `[${Array.isArray(value) ? 'array' : 'object'}]`;
    }

    if (Array.isArray(value)) {
        const items = value.slice(0, MAX_ARRAY_ITEMS).map(item => redactSensitiveKeys(item, depth + 1));
        if (value.length > MAX_ARRAY_ITEMS) {
            items.push(`[${value.length - MAX_ARRAY_ITEMS} more items]`);
        }
        return items;
    }

    const redacted = {};
    const entries = Object.entries(value);
    for (const [key, item] of entries.slice(0, MAX_OBJECT_KEYS)) {
        if (SENSITIVE_KEY_PATTERN.test(key)) {
            redacted[key] = '[REDACTED]';
        } else {
            redacted[key] = redactSensitiveKeys(item, depth + 1);
        }
    }

    if (entries.length > MAX_OBJECT_KEYS) {
        redacted.__truncatedKeys = entries.length - MAX_OBJECT_KEYS;
    }

    return redacted;
}

function summarizeForLog(value) {
    if (value == null) {
        return value;
    }

    if (typeof value === 'string') {
        return { type: 'string', length: value.length, preview: truncateForLog(value) };
    }

    if (Array.isArray(value)) {
        return { type: 'array', length: value.length };
    }

    if (typeof value === 'object') {
        return redactSensitiveKeys(value);
    }

    return value;
}

function safeErrorForLog(error) {
    if (!error) {
        return { message: 'Unknown error' };
    }

    return redactSensitiveKeys({
        name: error.name,
        message: truncateForLog(error.message || String(error)),
        code: error.code,
        status: error.status || error.statusCode || error.response?.status,
        stack: error.stack ? truncateForLog(error.stack, 600) : undefined
    });
}

module.exports = {
    truncateForLog,
    summarizeForLog,
    safeErrorForLog,
    redactSensitiveKeys
};
