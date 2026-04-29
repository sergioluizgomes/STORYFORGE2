const express = require('express');
const router = express.Router();
router.use(express.json());
const { getLogs, clearLogs } = require('../services/logStore');

// GET /api/logs/:projectId
// Returns all log entries for a project (oldest first)
router.get('/:projectId', (req, res) => {
    const logs = getLogs(req.params.projectId);
    res.json({ logs });
});

// DELETE /api/logs/:projectId
// Clears all log entries for a project
router.delete('/:projectId', (req, res) => {
    clearLogs(req.params.projectId);
    res.json({ ok: true });
});

module.exports = router;
