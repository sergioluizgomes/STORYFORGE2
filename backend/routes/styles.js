const express = require('express');
const router = express.Router();
router.use(express.json());
const ImageStyle = require('../models/ImageStyle');

// GET /api/styles - List all available image styles
router.get('/', async (req, res) => {
    try {
        const styles = await ImageStyle.find().sort({ name: 1 });
        res.json(styles);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch image styles' });
    }
});

module.exports = router;
