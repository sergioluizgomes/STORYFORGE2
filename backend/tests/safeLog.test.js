const test = require('node:test');
const assert = require('node:assert/strict');

const {
    truncateForLog,
    redactSensitiveKeys
} = require('../utils/safeLog');

test('redactSensitiveKeys masks sensitive fields and preserves safe fields', () => {
    const input = {
        apiKey: 'gemini-key',
        token: 'token-value',
        authorization: 'Bearer abc',
        password: 'secret-password',
        projectId: 'project-123',
        status: 'ready'
    };

    assert.deepEqual(redactSensitiveKeys(input), {
        apiKey: '[REDACTED]',
        token: '[REDACTED]',
        authorization: '[REDACTED]',
        password: '[REDACTED]',
        projectId: 'project-123',
        status: 'ready'
    });
});

test('redactSensitiveKeys handles null and undefined', () => {
    assert.equal(redactSensitiveKeys(null), null);
    assert.equal(redactSensitiveKeys(undefined), undefined);
});

test('truncateForLog shortens long text and keeps short text', () => {
    assert.equal(truncateForLog('short text', 20), 'short text');
    assert.match(truncateForLog('a'.repeat(50), 10), /^aaaaaaaaaa\.\.\. \[truncated 40 chars\]$/);
});

test('truncateForLog handles objects, numbers, null and undefined', () => {
    assert.equal(truncateForLog(42), 42);
    assert.equal(truncateForLog(null), null);
    assert.equal(truncateForLog(undefined), undefined);
    assert.equal(truncateForLog({ status: 'ok' }, 50), '{"status":"ok"}');
});
