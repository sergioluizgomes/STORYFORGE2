const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const {
    getSafeContentType,
    isAllowedUploadExtension,
    resolveSafeFilePath,
    resolveSafeRelativeFilePath,
    sanitizePublicFilename
} = require('../utils/fileSecurity');

const baseDir = path.join(__dirname, '..', 'uploads');

test('sanitizePublicFilename accepts simple generated image names', () => {
    assert.equal(sanitizePublicFilename('image.png'), 'image.png');
    assert.equal(sanitizePublicFilename('book-cover.webp'), 'book-cover.webp');
});

test('sanitizePublicFilename rejects empty and missing values', () => {
    assert.equal(sanitizePublicFilename(''), null);
    assert.equal(sanitizePublicFilename('   '), null);
    assert.equal(sanitizePublicFilename(null), null);
    assert.equal(sanitizePublicFilename(undefined), null);
});

test('sanitizePublicFilename rejects traversal and absolute paths', () => {
    assert.equal(sanitizePublicFilename('../.env'), null);
    assert.equal(sanitizePublicFilename('..\\secret.txt'), null);
    assert.equal(sanitizePublicFilename('/absolute/path/file.png'), null);
    assert.equal(sanitizePublicFilename('C:\\secret\\file.png'), null);
    assert.equal(sanitizePublicFilename('%2e%2e%2f.env'), null);
    assert.equal(sanitizePublicFilename('image.png\0.js'), null);
});

test('resolveSafeFilePath keeps final path inside the base directory', () => {
    const resolvedPath = resolveSafeFilePath(baseDir, 'image.png');

    assert.equal(resolvedPath, path.resolve(baseDir, 'image.png'));
    assert.equal(path.relative(path.resolve(baseDir), resolvedPath).startsWith('..'), false);
    assert.equal(resolveSafeFilePath(baseDir, '../.env'), null);
    assert.equal(resolveSafeFilePath(baseDir, 'C:\\secret\\file.png'), null);
});

test('resolveSafeRelativeFilePath allows stored uploads subpaths and blocks escape attempts', () => {
    assert.equal(
        resolveSafeRelativeFilePath(baseDir, 'uploads/anthologies/book.pdf'),
        path.resolve(baseDir, 'anthologies', 'book.pdf')
    );
    assert.equal(resolveSafeRelativeFilePath(baseDir, 'uploads/../.env'), null);
    assert.equal(resolveSafeRelativeFilePath(baseDir, 'uploads/%2e%2e%2f.env'), null);
    assert.equal(resolveSafeRelativeFilePath(baseDir, 'C:\\secret\\file.pdf'), null);
});

test('isAllowedUploadExtension permits only expected public file types', () => {
    assert.equal(isAllowedUploadExtension('image.png'), true);
    assert.equal(isAllowedUploadExtension('image.jpg'), true);
    assert.equal(isAllowedUploadExtension('image.jpeg'), true);
    assert.equal(isAllowedUploadExtension('book-cover.webp'), true);
    assert.equal(isAllowedUploadExtension('animation.gif'), true);
    assert.equal(isAllowedUploadExtension('book.pdf'), true);
    assert.equal(isAllowedUploadExtension('book.docx'), true);
    assert.equal(isAllowedUploadExtension('book.epub'), true);

    assert.equal(isAllowedUploadExtension('.env'), false);
    assert.equal(isAllowedUploadExtension('script.js'), false);
    assert.equal(isAllowedUploadExtension('page.html'), false);
    assert.equal(isAllowedUploadExtension('image.png.js'), false);
});

test('getSafeContentType maps known types and falls back safely', () => {
    assert.equal(getSafeContentType('image.png'), 'image/png');
    assert.equal(getSafeContentType('cover.jpg'), 'image/jpeg');
    assert.equal(getSafeContentType('cover.jpeg'), 'image/jpeg');
    assert.equal(getSafeContentType('book.pdf'), 'application/pdf');
    assert.equal(getSafeContentType('book.docx'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    assert.equal(getSafeContentType('book.epub'), 'application/epub+zip');
    assert.equal(getSafeContentType('unknown.bin'), 'application/octet-stream');
});
