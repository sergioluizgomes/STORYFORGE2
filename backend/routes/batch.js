const express = require('express');
const router = express.Router();
const BatchJob = require('../models/BatchJob');
const batchService = require('../services/batchService');

const jsonParser = express.json({ limit: '100mb' });

/**
 * Validate a single batch item's required fields.
 * Returns an error string or null if valid.
 */
function validateItem(item, index) {
    if (!item || typeof item !== 'object') {
        return `Item ${index + 1}: deve ser um objeto`;
    }

    if (!item.name || typeof item.name !== 'string' || !item.name.trim()) {
        return `Item ${index + 1}: campo "name" é obrigatório`;
    }

    if (!item.sourceText || typeof item.sourceText !== 'string' || !item.sourceText.trim()) {
        return `Item ${index + 1} ("${item.name}"): campo "sourceText" é obrigatório e não pode estar vazio`;
    }

    if (item.chapters !== undefined && !Array.isArray(item.chapters)) {
        return `Item ${index + 1} ("${item.name}"): "chapters" deve ser um array`;
    }

    if (Array.isArray(item.chapters)) {
        const validTypes = ['NORMAL', 'ACTION', 'REVELATION', 'FINAL'];
        for (const [ci, ch] of item.chapters.entries()) {
            if (!ch.number || typeof ch.number !== 'number') {
                return `Item ${index + 1} ("${item.name}"), capítulo ${ci + 1}: "number" deve ser um número`;
            }
            if (!ch.type || !validTypes.includes(ch.type)) {
                return `Item ${index + 1} ("${item.name}"), capítulo ${ci + 1}: "type" deve ser um de: ${validTypes.join(', ')}`;
            }
        }
    }

    return null;
}

/**
 * POST /api/batch
 * Start a new batch generation job.
 *
 * Body: Array of project config objects
 */
router.post('/', jsonParser, async (req, res) => {
    try {
        const items = req.body;

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                error: 'O corpo da requisição deve ser um array não vazio de projetos'
            });
        }

        if (items.length > 50) {
            return res.status(400).json({
                error: 'Máximo de 50 projetos por lote'
            });
        }

        // Validate all items before starting
        for (const [i, item] of items.entries()) {
            const err = validateItem(item, i);
            if (err) {
                return res.status(400).json({ error: err });
            }
        }

        const job = await batchService.startBatch(items);

        return res.status(201).json({
            batchId: job._id.toString(),
            itemCount: job.items.length,
            status: job.status
        });
    } catch (err) {
        console.error('[BATCH_ROUTE] POST /batch error:', err.message);
        return res.status(500).json({ error: 'Falha ao iniciar o lote' });
    }
});

/**
 * GET /api/batch/:id
 * Get the current status of a batch job.
 */
router.get('/:id', async (req, res) => {
    try {
        const job = await BatchJob.findById(req.params.id);

        if (!job) {
            return res.status(404).json({ error: 'Lote não encontrado' });
        }

        return res.json(job);
    } catch (err) {
        console.error('[BATCH_ROUTE] GET /batch/:id error:', err.message);
        return res.status(500).json({ error: 'Falha ao buscar lote' });
    }
});

/**
 * DELETE /api/batch/:id
 * Cancel all pending items in a batch job.
 */
router.delete('/:id', jsonParser, async (req, res) => {
    try {
        const job = await BatchJob.findById(req.params.id);

        if (!job) {
            return res.status(404).json({ error: 'Lote não encontrado' });
        }

        if (['completed', 'failed', 'cancelled'].includes(job.status)) {
            return res.status(400).json({ error: 'Este lote já foi finalizado e não pode ser cancelado' });
        }

        // Cancel all pending items
        const updates = {};
        job.items.forEach((item, i) => {
            if (item.status === 'pending') {
                updates[`items.${i}.status`] = 'cancelled';
            }
        });

        const hasPendingItems = Object.keys(updates).length > 0;

        if (hasPendingItems) {
            await BatchJob.findByIdAndUpdate(req.params.id, { $set: updates });
        }

        return res.json({
            message: hasPendingItems
                ? 'Itens pendentes cancelados. Itens em execução terminarão normalmente.'
                : 'Nenhum item pendente para cancelar.',
            batchId: req.params.id
        });
    } catch (err) {
        console.error('[BATCH_ROUTE] DELETE /batch/:id error:', err.message);
        return res.status(500).json({ error: 'Falha ao cancelar lote' });
    }
});

module.exports = router;
