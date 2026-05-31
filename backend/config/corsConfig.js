const { truncateForLog } = require('../utils/safeLog');

const DEFAULT_DEVELOPMENT_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
];
const loggedBlockedOrigins = new Set();

function normalizeOrigin(origin) {
    if (typeof origin !== 'string') {
        return '';
    }

    const trimmed = origin.trim();
    if (!trimmed) {
        return '';
    }

    if (trimmed === '*') {
        return trimmed;
    }

    return trimmed.replace(/\/+$/, '');
}

function parseAllowedOrigins(value) {
    if (!value || typeof value !== 'string') {
        return [];
    }

    return value
        .split(',')
        .map(normalizeOrigin)
        .filter(Boolean);
}

function isProduction(env) {
    return env === 'production';
}

function isOriginAllowed(origin, allowedOrigins, options = {}) {
    const environment = options.environment || 'development';
    const allowMissingOrigin = options.allowMissingOrigin !== false;
    const normalizedOrigin = normalizeOrigin(origin);

    if (!normalizedOrigin) {
        return allowMissingOrigin;
    }

    if (allowedOrigins.includes(normalizedOrigin)) {
        return true;
    }

    if (!isProduction(environment) && allowedOrigins.includes('*')) {
        return true;
    }

    return false;
}

function parseBoolean(value) {
    return String(value).toLowerCase() === 'true';
}

function buildCorsOptions(env = process.env) {
    const environment = env.NODE_ENV || 'development';
    const configuredOrigins = parseAllowedOrigins(env.CORS_ORIGIN);
    const allowedOrigins = configuredOrigins.length > 0
        ? configuredOrigins
        : (isProduction(environment) ? [] : DEFAULT_DEVELOPMENT_ORIGINS);
    const credentials = parseBoolean(env.CORS_ALLOW_CREDENTIALS);

    if (isProduction(environment) && allowedOrigins.includes('*')) {
        console.warn('Invalid CORS configuration: wildcard origins are not allowed in production.');
    }

    if (credentials && allowedOrigins.includes('*')) {
        console.warn('Invalid CORS configuration: credentials cannot be used with wildcard origins.');
    }

    return {
        credentials: credentials && !allowedOrigins.includes('*'),
        origin(origin, callback) {
            const allowed = isOriginAllowed(origin, allowedOrigins, { environment });

            if (allowed) {
                callback(null, true);
                return;
            }

            const safeOrigin = truncateForLog(normalizeOrigin(origin), 120);
            const logKey = `${environment}:${safeOrigin}`;
            if (!loggedBlockedOrigins.has(logKey)) {
                loggedBlockedOrigins.add(logKey);
                console.warn('Blocked CORS origin', {
                    environment,
                    origin: safeOrigin
                });
            }
            callback(null, false);
        },
        optionsSuccessStatus: 204
    };
}

module.exports = {
    DEFAULT_DEVELOPMENT_ORIGINS,
    buildCorsOptions,
    isOriginAllowed,
    parseAllowedOrigins
};
