const express = require('express');
const router = express.Router();
router.use(express.json());

const Project = require('../models/Project');
const Bible = require('../models/Bible');
const Scene = require('../models/Scene');
const HybridBook = require('../models/HybridBook');

const imageService = require('../services/imageService');
const pdfService = require('../services/pdfService');

function _buildDefaultImagePrompt(beat, bible, project) {
    const base = beat?.visualDescription || beat?.description || bible?.summary || project?.style || 'Illustration';
    return `${base}. Full-page portrait illustration, cinematic, high quality, no text, no typography, no captions, no speech bubbles.`;
}

// Create or get hybrid book for a project
router.post('/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const { title, settings } = req.body || {};

        const project = await Project.findById(projectId);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        let hybrid = await HybridBook.findOne({ projectId });
        if (!hybrid) {
            hybrid = new HybridBook({
                projectId,
                title: title || project.name,
                settings: {
                    imagesPerBeat: settings?.imagesPerBeat ?? 2,
                    includeCaptions: settings?.includeCaptions ?? true
                },
                blocks: [],
                status: 'draft'
            });
            await hybrid.save();
        }

        res.status(201).json(hybrid);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get hybrid book by project
router.get('/project/:projectId', async (req, res) => {
    try {
        const hybrid = await HybridBook.findOne({ projectId: req.params.projectId });
        if (!hybrid) return res.status(404).json({ error: 'Hybrid book not found for this project' });
        res.json(hybrid);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get hybrid book by id
router.get('/:hybridId', async (req, res) => {
    try {
        const hybrid = await HybridBook.findById(req.params.hybridId);
        if (!hybrid) return res.status(404).json({ error: 'Hybrid book not found' });
        res.json(hybrid);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Generate layout (blocks) from scenes + beats
router.post('/:hybridId/generate-layout', async (req, res) => {
    try {
        const hybrid = await HybridBook.findById(req.params.hybridId);
        if (!hybrid) return res.status(404).json({ error: 'Hybrid book not found' });

        const project = await Project.findById(hybrid.projectId);
        const bible = await Bible.findOne({ projectId: hybrid.projectId });
        const scenes = await Scene.find({ projectId: hybrid.projectId }).sort({ beatId: 1 });

        if (!scenes?.length) return res.status(400).json({ error: 'No scenes found for this project' });

        const imagesPerBeat = Math.max(0, Math.min(6, Number(req.body?.imagesPerBeat ?? hybrid.settings.imagesPerBeat ?? 2)));
        hybrid.settings.imagesPerBeat = imagesPerBeat;

        const blocks = [];
        let order = 1;

        for (const scene of scenes) {
            const beat = bible?.beats?.find(b => b.id === scene.beatId);

            blocks.push({
                order: order++,
                type: 'heading',
                beatId: scene.beatId,
                text: beat?.title || scene.title || `Beat ${scene.beatId}`
            });

            blocks.push({
                order: order++,
                type: 'prose',
                beatId: scene.beatId,
                text: scene.content || ''
            });

            for (let i = 0; i < imagesPerBeat; i++) {
                blocks.push({
                    order: order++,
                    type: 'image',
                    beatId: scene.beatId,
                    prompt: _buildDefaultImagePrompt(beat, bible, project),
                    caption: '',
                    imageUrl: '',
                    status: 'pending'
                });
            }
        }

        hybrid.blocks = blocks;
        hybrid.status = 'in_progress';
        await hybrid.save();

        res.json(hybrid);
    } catch (error) {
        console.error('Hybrid layout generation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update a block (text/prompt/caption)
router.put('/:hybridId/block/:blockId', async (req, res) => {
    try {
        const { hybridId, blockId } = req.params;
        const updates = req.body || {};

        const hybrid = await HybridBook.findById(hybridId);
        if (!hybrid) return res.status(404).json({ error: 'Hybrid book not found' });

        const block = hybrid.blocks.id(blockId);
        if (!block) return res.status(404).json({ error: 'Block not found' });

        if (typeof updates.text === 'string') block.text = updates.text;
        if (typeof updates.prompt === 'string') block.prompt = updates.prompt;
        if (typeof updates.caption === 'string') block.caption = updates.caption;
        if (typeof updates.status === 'string') block.status = updates.status;

        await hybrid.save();
        res.json({ block, hybrid });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Generate image for an image block
router.post('/:hybridId/block/:blockId/generate-image', async (req, res) => {
    try {
        const { hybridId, blockId } = req.params;

        const hybrid = await HybridBook.findById(hybridId);
        if (!hybrid) return res.status(404).json({ error: 'Hybrid book not found' });

        const block = hybrid.blocks.id(blockId);
        if (!block) return res.status(404).json({ error: 'Block not found' });
        if (block.type !== 'image') return res.status(400).json({ error: 'Block is not an image block' });
        if (!block.prompt) return res.status(400).json({ error: 'No prompt set for this image block' });

        block.status = 'generating';
        await hybrid.save();

        try {
            const imageUrl = await imageService.generateCharacterImage(block.prompt, "", '21:9');
            block.imageUrl = imageUrl;
            block.status = 'generated';
            await hybrid.save();
            res.json({ imageUrl, block });
        } catch (genError) {
            block.status = 'pending';
            await hybrid.save();
            throw genError;
        }
    } catch (error) {
        console.error('Hybrid image generation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Export hybrid book to PDF
router.get('/:hybridId/export/pdf', async (req, res) => {
    try {
        const { hybridId } = req.params;

        const hybrid = await HybridBook.findById(hybridId);
        if (!hybrid) return res.status(404).json({ error: 'Hybrid book not found' });

        const project = await Project.findById(hybrid.projectId);
        const fileBaseName = (hybrid.title || project?.name || 'hybrid')
            .toString()
            .replace(/[^a-z0-9]/gi, '_');

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${fileBaseName}.pdf"`);

        await pdfService.generateHybridBookPDF(hybrid, project, res);
    } catch (error) {
        console.error('Hybrid PDF Export Error:', error);
        res.status(500).json({ error: 'Failed to generate hybrid PDF' });
    }
});

module.exports = router;
