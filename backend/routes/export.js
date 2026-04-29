const express = require('express');
const router = express.Router();
const epubService = require('../services/epubService');
const docxService = require('../services/docxService');

// Add JSON parsing middleware for this router
router.use(express.json());

/**
 * Export project as EPUB (KDP-compatible)
 * POST /api/export/epub/:projectId
 * Body: {
 *   author: string (optional),
 *   publisher: string (optional),
 *   includeImages: boolean (optional),
 *   includeCoverPage: boolean (optional)
 * }
 */
router.post('/epub/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const {
            author = 'Unknown Author',
            publisher = 'StoryForge',
            includeImages = false,
            includeCoverPage = true
        } = req.body || {};

        console.log(`Generating EPUB for project ${projectId}`, { author, publisher, includeImages });

        const epubBuffer = await epubService.generateEpub(projectId, {
            author,
            publisher,
            includeImages,
            includeCoverPage
        });

        // Set headers for file download
        const filename = `book_${projectId}_${Date.now()}.epub`;
        res.setHeader('Content-Type', 'application/epub+zip');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', epubBuffer.length);

        res.send(epubBuffer);
        console.log(`EPUB generated successfully: ${filename}`);
    } catch (error) {
        console.error('Error generating EPUB:', error);
        res.status(500).json({
            error: 'Failed to generate EPUB',
            message: error.message
        });
    }
});

/**
 * Get export options for a project
 * GET /api/export/options/:projectId
 */
router.get('/options/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const Project = require('../models/Project');
        const HybridBook = require('../models/HybridBook');

        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const hybridBook = await HybridBook.findOne({ projectId });
        const hasImages = hybridBook && hybridBook.blocks.some(b => b.type === 'image' && b.imageUrl);

        res.json({
            projectName: project.name,
            hasCover: !!project.coverImageUrl,
            hasImages: hasImages,
            language: project.language,
            formats: ['epub', 'docx'] // Added DOCX format
        });
    } catch (error) {
        console.error('Error getting export options:', error);
        res.status(500).json({
            error: 'Failed to get export options',
            message: error.message
        });
    }
});

/**
 * Export project as DOCX (Microsoft Word)
 * POST /api/export/docx/:projectId
 * Body: {
 *   author: string (optional),
 *   includeMetadata: boolean (optional),
 *   includeCoverPage: boolean (optional),
 *   fontSize: number (optional),
 *   fontFamily: string (optional)
 * }
 */
router.post('/docx/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const {
            author = 'Unknown Author',
            includeMetadata = true,
            includeCoverPage = true,
            fontSize = 24,
            fontFamily = 'Times New Roman'
        } = req.body || {};

        console.log(`Generating DOCX for project ${projectId}`, { author, includeMetadata, includeCoverPage });

        const docxBuffer = await docxService.generateDocx(projectId, {
            author,
            includeMetadata,
            includeCoverPage,
            fontSize,
            fontFamily
        });

        // Set headers for file download
        const filename = `book_${projectId}_${Date.now()}.docx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', docxBuffer.length);

        res.send(docxBuffer);
        console.log(`DOCX generated successfully: ${filename}`);
    } catch (error) {
        console.error('Error generating DOCX:', error);
        res.status(500).json({
            error: 'Failed to generate DOCX',
            message: error.message
        });
    }
});

module.exports = router;
