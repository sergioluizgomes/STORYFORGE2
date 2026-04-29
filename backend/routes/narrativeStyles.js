const express = require('express');
const router = express.Router();
router.use(express.json());
const NarrativeStyle = require('../models/NarrativeStyle');

// Get all narrative styles
router.get('/', async (req, res) => {
    try {
        const styles = await NarrativeStyle.find();
        res.json(styles);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
