const path = require('path');

const ALLOWED_UPLOAD_EXTENSIONS = new Set([
    '.png',
    '.jpg',
    '.jpeg',
    '.webp',
    '.gif',
    '.pdf',
    '.docx',
    '.epub'
]);

const CONTENT_TYPES = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.epub': 'application/epub+zip'
};

function hasEncodedTraversal(value) {
    const lower = value.toLowerCase();
    return lower.includes('%2e') || lower.includes('%2f') || lower.includes('%5c');
}

function sanitizePublicFilename(filename) {
    if (typeof filename !== 'string') {
        return null;
    }

    const trimmed = filename.trim();
    if (!trimmed) {
        return null;
    }

    if (
        trimmed.includes('\0') ||
        trimmed.includes('/') ||
        trimmed.includes('\\') ||
        trimmed.includes('..') ||
        hasEncodedTraversal(trimmed) ||
        path.isAbsolute(trimmed) ||
        path.win32.isAbsolute(trimmed)
    ) {
        return null;
    }

    if (path.basename(trimmed) !== trimmed || path.win32.basename(trimmed) !== trimmed) {
        return null;
    }

    return trimmed;
}

function resolveSafeFilePath(baseDir, requestedFilename) {
    const filename = sanitizePublicFilename(requestedFilename);
    if (!filename) {
        return null;
    }

    const resolvedBaseDir = path.resolve(baseDir);
    const resolvedFilePath = path.resolve(resolvedBaseDir, filename);
    const relativePath = path.relative(resolvedBaseDir, resolvedFilePath);

    if (
        relativePath === '' ||
        relativePath.startsWith('..') ||
        path.isAbsolute(relativePath)
    ) {
        return null;
    }

    return resolvedFilePath;
}

function resolveSafeRelativeFilePath(baseDir, requestedPath) {
    if (typeof requestedPath !== 'string') {
        return null;
    }

    const trimmed = requestedPath.trim();
    if (
        !trimmed ||
        trimmed.includes('\0') ||
        trimmed.includes('\\') ||
        hasEncodedTraversal(trimmed) ||
        path.isAbsolute(trimmed) ||
        path.win32.isAbsolute(trimmed)
    ) {
        return null;
    }

    const relativeUploadPath = trimmed.replace(/^uploads\//, '');
    const segments = relativeUploadPath.split('/');
    if (
        segments.some(segment => !segment || segment === '.' || segment === '..') ||
        !isAllowedUploadExtension(segments[segments.length - 1])
    ) {
        return null;
    }

    const resolvedBaseDir = path.resolve(baseDir);
    const resolvedFilePath = path.resolve(resolvedBaseDir, relativeUploadPath);
    const relativePath = path.relative(resolvedBaseDir, resolvedFilePath);

    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        return null;
    }

    return resolvedFilePath;
}

function isAllowedUploadExtension(filename) {
    const safeFilename = sanitizePublicFilename(filename);
    if (!safeFilename) {
        return false;
    }

    return ALLOWED_UPLOAD_EXTENSIONS.has(path.extname(safeFilename).toLowerCase());
}

function getSafeContentType(filename) {
    const extension = path.extname(String(filename || '')).toLowerCase();
    return CONTENT_TYPES[extension] || 'application/octet-stream';
}

function summarizeFilenameForLog(filename, maxLength = 80) {
    if (typeof filename !== 'string') {
        return '[non-string]';
    }

    const normalized = filename.replace(/\0/g, '[null]');
    if (normalized.length <= maxLength) {
        return normalized;
    }

    return `${normalized.slice(0, maxLength)}...`;
}

module.exports = {
    ALLOWED_UPLOAD_EXTENSIONS,
    sanitizePublicFilename,
    resolveSafeFilePath,
    resolveSafeRelativeFilePath,
    isAllowedUploadExtension,
    getSafeContentType,
    summarizeFilenameForLog
};
