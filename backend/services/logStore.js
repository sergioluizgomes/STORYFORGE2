/**
 * In-memory log store for project generation events.
 * Keeps the last MAX_ENTRIES entries per project.
 * Logs are ephemeral — cleared on server restart.
 */

const MAX_ENTRIES = 500;

/** @type {Map<string, Array<{timestamp: string, level: 'info'|'error', event: string, details: object}>>} */
const store = new Map();

/**
 * Append a log entry for a project.
 * @param {string|object} projectId
 * @param {'info'|'error'} level
 * @param {string} event
 * @param {object} [details]
 */
function appendLog(projectId, level, event, details = {}) {
    const key = projectId?.toString?.() || String(projectId);
    if (!store.has(key)) {
        store.set(key, []);
    }
    const entries = store.get(key);
    entries.push({
        timestamp: new Date().toISOString(),
        level,
        event,
        details
    });
    // Trim to max entries (drop oldest)
    if (entries.length > MAX_ENTRIES) {
        entries.splice(0, entries.length - MAX_ENTRIES);
    }
}

/**
 * Get all log entries for a project (oldest first).
 * @param {string|object} projectId
 * @returns {Array}
 */
function getLogs(projectId) {
    const key = projectId?.toString?.() || String(projectId);
    return store.get(key) || [];
}

/**
 * Clear all log entries for a project.
 * @param {string|object} projectId
 */
function clearLogs(projectId) {
    const key = projectId?.toString?.() || String(projectId);
    store.delete(key);
}

module.exports = { appendLog, getLogs, clearLogs };
