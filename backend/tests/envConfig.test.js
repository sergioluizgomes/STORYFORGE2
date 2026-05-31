const test = require('node:test');
const assert = require('node:assert/strict');

const {
    DEFAULT_DATABASE_URI,
    DEFAULT_PORT,
    buildAppConfig,
    normalizeNodeEnv,
    parseBoolean,
    parseCsv,
    parseInteger,
    validateEnv,
    validateUploadDir
} = require('../config/envConfig');

test('parseBoolean handles booleans, strings, numbers, and defaults', () => {
    assert.equal(parseBoolean(true, false), true);
    assert.equal(parseBoolean(false, true), false);
    assert.equal(parseBoolean('true', false), true);
    assert.equal(parseBoolean('false', true), false);
    assert.equal(parseBoolean('1', false), true);
    assert.equal(parseBoolean('0', true), false);
    assert.equal(parseBoolean(undefined, true), true);
});

test('parseInteger applies defaults and range limits', () => {
    assert.equal(parseInteger('3010', DEFAULT_PORT, { min: 1, max: 65535 }), 3010);
    assert.equal(parseInteger('invalid', DEFAULT_PORT, { min: 1, max: 65535 }), DEFAULT_PORT);
    assert.equal(parseInteger(undefined, DEFAULT_PORT, { min: 1, max: 65535 }), DEFAULT_PORT);
    assert.equal(parseInteger('70000', DEFAULT_PORT, { min: 1, max: 65535 }), DEFAULT_PORT);
});

test('parseCsv trims values and removes empty entries', () => {
    assert.deepEqual(parseCsv(' a, b ,,c , '), ['a', 'b', 'c']);
    assert.deepEqual(parseCsv(''), []);
});

test('normalizeNodeEnv accepts known environments and defaults unknown values', () => {
    assert.equal(normalizeNodeEnv('production'), 'production');
    assert.equal(normalizeNodeEnv('test'), 'test');
    assert.equal(normalizeNodeEnv('unexpected'), 'development');
    assert.equal(normalizeNodeEnv(undefined), 'development');
});

test('development can start without CORS_ORIGIN and uses local database default', () => {
    const result = validateEnv({ NODE_ENV: 'development' });

    assert.equal(result.errors.length, 0);
    assert.equal(result.config.runtime.nodeEnv, 'development');
    assert.equal(result.config.database.uri, DEFAULT_DATABASE_URI);
    assert.equal(result.config.cors.allowedOrigins.length, 0);
    assert(result.warnings.some(warning => warning.variable === 'MONGODB_URI'));
});

test('production without CORS_ORIGIN fails validation', () => {
    const result = validateEnv({
        NODE_ENV: 'production',
        MONGODB_URI: 'mongodb://example.invalid/storyforge'
    });

    assert(result.errors.some(error => error.variable === 'CORS_ORIGIN'));
});

test('production with valid CORS_ORIGIN and database passes', () => {
    const result = validateEnv({
        NODE_ENV: 'production',
        PORT: '5000',
        MONGODB_URI: 'mongodb://example.invalid/storyforge',
        CORS_ORIGIN: 'https://app.example.com',
        CORS_ALLOW_CREDENTIALS: 'true'
    });

    assert.equal(result.errors.length, 0);
    assert.equal(result.config.runtime.port, 5000);
    assert.deepEqual(result.config.cors.allowedOrigins, ['https://app.example.com']);
    assert.equal(result.config.cors.allowCredentials, true);
});

test('production with wildcard CORS_ORIGIN fails', () => {
    const result = validateEnv({
        NODE_ENV: 'production',
        MONGODB_URI: 'mongodb://example.invalid/storyforge',
        CORS_ORIGIN: '*'
    });

    assert(result.errors.some(error => error.code === 'wildcard_in_production'));
});

test('credentials with wildcard CORS fails in any environment', () => {
    const result = validateEnv({
        NODE_ENV: 'development',
        CORS_ORIGIN: '*',
        CORS_ALLOW_CREDENTIALS: 'true'
    });

    assert(result.errors.some(error => error.code === 'credentials_with_wildcard'));
});

test('production without database connection string fails', () => {
    const result = validateEnv({
        NODE_ENV: 'production',
        CORS_ORIGIN: 'https://app.example.com'
    });

    assert(result.errors.some(error => error.variable === 'MONGODB_URI'));
});

test('upload directory stays within expected uploads paths', () => {
    assert.equal(validateUploadDir(undefined), 'uploads');
    assert.equal(validateUploadDir('uploads/generated'), 'uploads/generated');
    assert.equal(validateUploadDir('../uploads'), null);
    assert.equal(validateUploadDir('C:\\sensitive'), null);
    assert.equal(validateUploadDir('config'), null);
});

test('AI provider keys are optional unless selected configuration is incomplete', () => {
    const geminiResult = validateEnv({
        NODE_ENV: 'development',
        TEXT_AI_PROVIDER: 'gemini'
    });
    assert.equal(geminiResult.errors.length, 0);
    assert(geminiResult.warnings.some(warning => warning.variable === 'GEMINI_API_KEY'));

    const lmStudioResult = validateEnv({
        NODE_ENV: 'development',
        TEXT_AI_PROVIDER: 'lm-studio'
    });
    assert.equal(lmStudioResult.errors.length, 0);
    assert(lmStudioResult.warnings.some(warning => warning.variable === 'LM_STUDIO_DEFAULT_MODEL'));
});

test('invalid startup values are blocked by buildAppConfig', () => {
    assert.throws(() => buildAppConfig({
        NODE_ENV: 'production',
        PORT: 'not-a-port',
        CORS_ORIGIN: '*'
    }), /Invalid backend environment configuration/);
});

test('warnings and errors do not include sensitive environment values', () => {
    const secretUri = 'mongodb://user:password@example.invalid/storyforge';
    const secretKey = 'super-secret-key';
    const result = validateEnv({
        NODE_ENV: 'production',
        MONGODB_URI: secretUri,
        CORS_ORIGIN: '*',
        GEMINI_API_KEY: secretKey
    });

    const serializedIssues = JSON.stringify([...result.warnings, ...result.errors]);
    assert.equal(serializedIssues.includes(secretUri), false);
    assert.equal(serializedIssues.includes(secretKey), false);
});
