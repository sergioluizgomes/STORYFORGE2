const path = require('path');
const { parseAllowedOrigins } = require('./corsConfig');

const ALLOWED_NODE_ENVS = new Set(['development', 'test', 'production']);
const DEFAULT_PORT = 3000;
const DEFAULT_DATABASE_URI = 'mongodb://localhost:27017/story-generator';
const DEFAULT_UPLOAD_DIR = 'uploads';
const DEFAULT_LM_STUDIO_BASE_URL = 'http://127.0.0.1:1234/v1';
const DEFAULT_GEMINI_TEXT_MODEL = 'gemini-flash-lite-latest';
const DEFAULT_DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1';
const DEFAULT_DEEPSEEK_TEXT_MODEL = 'deepseek-chat';

function isBlank(value) {
    return value == null || String(value).trim() === '';
}

function makeIssue(variable, code, message) {
    return { variable, code, message };
}

function parseBoolean(value, defaultValue = false) {
    if (value == null || value === '') {
        return defaultValue;
    }

    if (typeof value === 'boolean') {
        return value;
    }

    const normalized = String(value).trim().toLowerCase();
    if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) {
        return true;
    }
    if (['false', '0', 'no', 'n', 'off'].includes(normalized)) {
        return false;
    }

    return defaultValue;
}

function parseInteger(value, defaultValue, options = {}) {
    const { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = options;

    if (value == null || value === '') {
        return defaultValue;
    }

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
        return defaultValue;
    }

    return parsed;
}

function parseCsv(value) {
    if (!value || typeof value !== 'string') {
        return [];
    }

    return value
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
}

function normalizeNodeEnv(value) {
    if (isBlank(value)) {
        return 'development';
    }

    const normalized = String(value).trim().toLowerCase();
    return ALLOWED_NODE_ENVS.has(normalized) ? normalized : 'development';
}

function normalizeProvider(value) {
    if (isBlank(value)) {
        return 'gemini';
    }

    const normalized = String(value).trim().toLowerCase();
    if (['gemini', 'google', 'google-gemini'].includes(normalized)) {
        return 'gemini';
    }
    if (['lm-studio', 'lmstudio', 'lm_studio'].includes(normalized)) {
        return 'lm-studio';
    }
    if (['deepseek', 'deepseek-ai'].includes(normalized)) {
        return 'deepseek';
    }

    return null;
}

function validateUploadDir(value) {
    const configured = isBlank(value) ? DEFAULT_UPLOAD_DIR : String(value).trim();

    if (
        path.isAbsolute(configured) ||
        path.win32.isAbsolute(configured) ||
        configured.includes('\0') ||
        configured.includes(':') ||
        configured.includes('..')
    ) {
        return null;
    }

    const normalized = configured.replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/\/+$/, '');
    if (!normalized || (normalized !== DEFAULT_UPLOAD_DIR && !normalized.startsWith(`${DEFAULT_UPLOAD_DIR}/`))) {
        return null;
    }

    return normalized;
}

function sanitizeIssues(issues) {
    return issues.map(issue => ({
        variable: issue.variable,
        code: issue.code,
        message: issue.message
    }));
}

function validateEnv(rawEnv = {}) {
    const warnings = [];
    const errors = [];
    const nodeEnv = normalizeNodeEnv(rawEnv.NODE_ENV);

    if (isBlank(rawEnv.NODE_ENV)) {
        warnings.push(makeIssue('NODE_ENV', 'default_applied', 'NODE_ENV is not set; using development defaults.'));
    } else if (!ALLOWED_NODE_ENVS.has(String(rawEnv.NODE_ENV).trim().toLowerCase())) {
        warnings.push(makeIssue('NODE_ENV', 'unknown_value', 'NODE_ENV must be development, test, or production; using development defaults.'));
    }

    const port = parseInteger(rawEnv.PORT, DEFAULT_PORT, { min: 1, max: 65535 });
    if (!isBlank(rawEnv.PORT) && String(port) !== String(Number(rawEnv.PORT))) {
        errors.push(makeIssue('PORT', 'invalid_integer', 'PORT must be an integer between 1 and 65535.'));
    }

    const databaseUri = isBlank(rawEnv.MONGODB_URI) ? DEFAULT_DATABASE_URI : String(rawEnv.MONGODB_URI).trim();
    if (isBlank(rawEnv.MONGODB_URI)) {
        const issue = makeIssue('MONGODB_URI', 'missing', 'MONGODB_URI is not set.');
        if (nodeEnv === 'production') {
            errors.push(issue);
        } else {
            warnings.push(makeIssue('MONGODB_URI', 'default_applied', 'MONGODB_URI is not set; using local development database default.'));
        }
    }

    const corsOrigins = parseAllowedOrigins(rawEnv.CORS_ORIGIN);
    const corsCredentials = parseBoolean(rawEnv.CORS_ALLOW_CREDENTIALS, false);
    if (nodeEnv === 'production' && corsOrigins.length === 0) {
        errors.push(makeIssue('CORS_ORIGIN', 'missing_in_production', 'CORS_ORIGIN must be set in production.'));
    }
    if (nodeEnv === 'production' && corsOrigins.includes('*')) {
        errors.push(makeIssue('CORS_ORIGIN', 'wildcard_in_production', 'CORS_ORIGIN cannot use wildcard in production.'));
    }
    if (corsCredentials && corsOrigins.includes('*')) {
        errors.push(makeIssue('CORS_ALLOW_CREDENTIALS', 'credentials_with_wildcard', 'CORS_ALLOW_CREDENTIALS cannot be true when CORS_ORIGIN includes wildcard.'));
    }

    const uploadDir = validateUploadDir(rawEnv.UPLOAD_DIR);
    if (!uploadDir) {
        errors.push(makeIssue('UPLOAD_DIR', 'invalid_path', 'UPLOAD_DIR must be a safe relative directory.'));
    }

    const textProvider = normalizeProvider(rawEnv.TEXT_AI_PROVIDER);
    if (!textProvider) {
        warnings.push(makeIssue('TEXT_AI_PROVIDER', 'unsupported_provider', 'TEXT_AI_PROVIDER is not recognized; Gemini will remain the default provider.'));
    }

    const normalizedTextProvider = textProvider || 'gemini';
    const geminiConfigured = !isBlank(rawEnv.GEMINI_API_KEY);
    const lmStudioBaseUrl = isBlank(rawEnv.LM_STUDIO_BASE_URL)
        ? DEFAULT_LM_STUDIO_BASE_URL
        : String(rawEnv.LM_STUDIO_BASE_URL).trim();
    const lmStudioDefaultModel = isBlank(rawEnv.LM_STUDIO_DEFAULT_MODEL)
        ? (isBlank(rawEnv.TEXT_AI_MODEL) ? '' : String(rawEnv.TEXT_AI_MODEL).trim())
        : String(rawEnv.LM_STUDIO_DEFAULT_MODEL).trim();
    const deepSeekConfigured = !isBlank(rawEnv.DEEPSEEK_API_KEY);
    const deepSeekBaseUrl = isBlank(rawEnv.DEEPSEEK_BASE_URL)
        ? DEFAULT_DEEPSEEK_BASE_URL
        : String(rawEnv.DEEPSEEK_BASE_URL).trim();
    const deepSeekTextModel = isBlank(rawEnv.DEEPSEEK_TEXT_MODEL)
        ? (isBlank(rawEnv.DEEPSEEK_DEFAULT_MODEL) ? DEFAULT_DEEPSEEK_TEXT_MODEL : String(rawEnv.DEEPSEEK_DEFAULT_MODEL).trim())
        : String(rawEnv.DEEPSEEK_TEXT_MODEL).trim();

    if (normalizedTextProvider === 'gemini' && !geminiConfigured) {
        warnings.push(makeIssue('GEMINI_API_KEY', 'missing_optional_provider_key', 'GEMINI_API_KEY is missing; Gemini text/image generation will be unavailable until configured.'));
    }
    if (normalizedTextProvider === 'lm-studio' && !lmStudioDefaultModel) {
        warnings.push(makeIssue('LM_STUDIO_DEFAULT_MODEL', 'missing_provider_model', 'TEXT_AI_PROVIDER selects LM Studio but no default model is configured.'));
    }
    if (normalizedTextProvider === 'deepseek' && !deepSeekConfigured) {
        warnings.push(makeIssue('DEEPSEEK_API_KEY', 'missing_optional_provider_key', 'TEXT_AI_PROVIDER selects DeepSeek but DEEPSEEK_API_KEY is missing.'));
    }

    const config = {
        runtime: {
            nodeEnv,
            isProduction: nodeEnv === 'production',
            isTest: nodeEnv === 'test',
            port
        },
        database: {
            uri: databaseUri
        },
        cors: {
            origin: isBlank(rawEnv.CORS_ORIGIN) ? '' : String(rawEnv.CORS_ORIGIN).trim(),
            allowedOrigins: corsOrigins,
            allowCredentials: corsCredentials
        },
        uploads: {
            dir: uploadDir || DEFAULT_UPLOAD_DIR,
            absoluteDir: path.join(__dirname, '..', uploadDir || DEFAULT_UPLOAD_DIR)
        },
        ai: {
            textProvider: normalizedTextProvider,
            gemini: {
                configured: geminiConfigured,
                textModel: isBlank(rawEnv.GEMINI_TEXT_MODEL) ? DEFAULT_GEMINI_TEXT_MODEL : String(rawEnv.GEMINI_TEXT_MODEL).trim()
            },
            lmStudio: {
                baseUrl: lmStudioBaseUrl,
                defaultModel: lmStudioDefaultModel,
                apiKeyConfigured: !isBlank(rawEnv.LM_STUDIO_API_KEY)
            },
            deepSeek: {
                configured: deepSeekConfigured,
                baseUrl: deepSeekBaseUrl,
                textModel: deepSeekTextModel
            }
        },
        publicBaseUrl: isBlank(rawEnv.PUBLIC_BASE_URL) ? '' : String(rawEnv.PUBLIC_BASE_URL).trim()
    };

    return {
        config,
        warnings: sanitizeIssues(warnings),
        errors: sanitizeIssues(errors)
    };
}

function buildAppConfig(rawEnv = {}) {
    const result = validateEnv(rawEnv);
    if (result.errors.length > 0) {
        const error = new Error('Invalid backend environment configuration.');
        error.name = 'EnvConfigError';
        error.configErrors = result.errors;
        error.configWarnings = result.warnings;
        throw error;
    }

    return result;
}

module.exports = {
    DEFAULT_DATABASE_URI,
    DEFAULT_PORT,
    DEFAULT_UPLOAD_DIR,
    buildAppConfig,
    normalizeNodeEnv,
    parseBoolean,
    parseCsv,
    parseInteger,
    validateEnv,
    validateUploadDir
};
