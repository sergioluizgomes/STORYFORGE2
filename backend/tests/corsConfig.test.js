const test = require('node:test');
const assert = require('node:assert/strict');

const {
    buildCorsOptions,
    isOriginAllowed,
    parseAllowedOrigins
} = require('../config/corsConfig');

function resolveOrigin(options, origin) {
    return new Promise((resolve, reject) => {
        options.origin(origin, (error, allowed) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(allowed);
        });
    });
}

async function withSilencedWarnings(fn) {
    const originalWarn = console.warn;
    console.warn = () => {};
    try {
        return await fn();
    } finally {
        console.warn = originalWarn;
    }
}

test('parseAllowedOrigins parses comma-separated origins', () => {
    assert.deepEqual(
        parseAllowedOrigins('http://localhost:5173,https://app.example.com'),
        ['http://localhost:5173', 'https://app.example.com']
    );
});

test('parseAllowedOrigins trims spaces and ignores empty values', () => {
    assert.deepEqual(
        parseAllowedOrigins(' http://localhost:5173, , https://app.example.com '),
        ['http://localhost:5173', 'https://app.example.com']
    );
});

test('parseAllowedOrigins normalizes trailing slashes', () => {
    assert.deepEqual(
        parseAllowedOrigins('http://localhost:5173/,https://app.example.com///'),
        ['http://localhost:5173', 'https://app.example.com']
    );
});

test('development allows default localhost origins when CORS_ORIGIN is absent', async () => {
    const options = buildCorsOptions({ NODE_ENV: 'development' });

    assert.equal(await resolveOrigin(options, 'http://localhost:5173'), true);
    assert.equal(await resolveOrigin(options, 'http://127.0.0.1:3000'), true);
});

test('production without CORS_ORIGIN blocks browser origins', async () => {
    const options = buildCorsOptions({ NODE_ENV: 'production' });

    await withSilencedWarnings(async () => {
        assert.equal(await resolveOrigin(options, 'https://app.example.com'), false);
    });
});

test('production with CORS_ORIGIN allows listed origin', async () => {
    const options = buildCorsOptions({
        NODE_ENV: 'production',
        CORS_ORIGIN: 'https://app.example.com'
    });

    assert.equal(await resolveOrigin(options, 'https://app.example.com'), true);
});

test('production with CORS_ORIGIN blocks unlisted origin', async () => {
    const options = buildCorsOptions({
        NODE_ENV: 'production',
        CORS_ORIGIN: 'https://app.example.com'
    });

    await withSilencedWarnings(async () => {
        assert.equal(await resolveOrigin(options, 'https://admin.example.com'), false);
    });
});

test('requests without Origin are allowed', async () => {
    const options = buildCorsOptions({ NODE_ENV: 'production' });

    assert.equal(await resolveOrigin(options, undefined), true);
});

test('credentials true is respected without wildcard', () => {
    const options = buildCorsOptions({
        NODE_ENV: 'production',
        CORS_ORIGIN: 'https://app.example.com',
        CORS_ALLOW_CREDENTIALS: 'true'
    });

    assert.equal(options.credentials, true);
});

test('wildcard with credentials is not allowed', async () => {
    await withSilencedWarnings(() => {
        const options = buildCorsOptions({
            NODE_ENV: 'development',
            CORS_ORIGIN: '*',
            CORS_ALLOW_CREDENTIALS: 'true'
        });

        assert.equal(options.credentials, false);
    });
});

test('isOriginAllowed rejects wildcard in production', () => {
    assert.equal(
        isOriginAllowed('https://app.example.com', ['*'], { environment: 'production' }),
        false
    );
});
