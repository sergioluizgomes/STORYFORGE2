const mongoose = require('mongoose');
const ImageStyle = require('../models/ImageStyle');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const styles = [
    { name: "Cinematic", prompt: "cinematic style, highly detailed, 8k, professional lighting, shallow depth of field, dramatic shadows" },
    { name: "Cyberpunk", prompt: "cyberpunk aesthetic, neon lights, rainy streets, futuristic, high contrast, blue and magenta tones" },
    { name: "Anime/Manga", prompt: "anime style, vibrant colors, clean lines, cel-shaded, expressive features, hand-drawn look" },
    { name: "High Fantasy", prompt: "epic high fantasy, magical atmosphere, intricate gold details, ethereal lighting, majestic scenery" },
    { name: "Oil Painting", prompt: "classical oil painting style, visible brushstrokes, rich textures, warm lighting, masterpiece quality" },
    { name: "Pencil Sketch", prompt: "detailed pencil sketch, graphite texture, cross-hatching, artistic, realistic shading, parchment background" },
    { name: "Noir/Monochrome", prompt: "film noir style, black and white, dramatic high-key lighting, gritty texture, moody atmosphere" },
    { name: "Art Deco", prompt: "art deco style, geometric patterns, bold colors, elegant, 1920s aesthetic, gold accents" },
    { name: "Retro Futurist", prompt: "1950s retro-futurism, teal and orange palette, smooth curves, vintage sci-fi look" },
    { name: "Steampunk", prompt: "steampunk aesthetic, brass and copper gears, steam, victorian fashion, sepia tones" },
    { name: "Hyper Realistic", prompt: "hyper-realistic, photorealistic, extreme detail, micro-texture, 8k resolution, raw photo" },
    { name: "Vaporwave", prompt: "vaporwave aesthetic, glitch art, 80s retro, pastel pink and cyan, lo-fi vibes" },
    { name: "Ukiyo-e", prompt: "traditional Japanese woodblock print, bold outlines, flat colors, classical Japanese art style" },
    { name: "Post-Apocalyptic", prompt: "wasteland aesthetic, dusty, worn surfaces, desaturated colors, gritty and realistic" },
    { name: "Watercolor", prompt: "watercolor painting, soft edges, bleeding colors, artistic splatters, paper texture" },
    { name: "Gothic Horror", prompt: "gothic horror, dark and eerie, mist, ornate Victorian details, haunting atmosphere" },
    { name: "Synthwave", prompt: "synthwave style, 80s grid, sunset, neon glow, retro-digital aesthetic" },
    { name: "Pop Art", prompt: "pop art style, bold outlines, dot patterns, vibrant comic book colors, high energy" },
    { name: "Minimalist", prompt: "minimalist design, clean lines, simple shapes, limited color palette, spacious" },
    { name: "Surrealism", prompt: "surrealist style, dreamlike imagery, impossible geometry, vivid and strange" },
    { name: "Lovecraftian", prompt: "Lovecraftian horror style, cosmic dread, eldritch abominations, dark green and deep purple tones, wet slimy textures, ancient ruins, non-Euclidean geometry" },
    { name: "Dark Fantasy", prompt: "dark fantasy aesthetic, grim and gritty, oppressive atmosphere, skeletal remains, flickering torches, obsidian towers" },
    { name: "Ink Drawing", prompt: "intricate ink drawing, high contrast black and white, fine lines, stippling, gothic atmosphere" },
    { name: "Cybernoir", prompt: "cyberpunk meets film noir, rainy futuristic streets, neon signs reflecting in puddles, silhouettes in trench coats" },
    { name: "Pulp Fiction", prompt: "1940s pulp magazine cover style, bold typography, dramatic action, vibrant but aged colors, low-brow art aesthetic" }
];

async function seedStyles() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/writing-assistant');
        console.log('Connected to MongoDB');

        // Delete existing styles to avoid duplicates if rerun
        await ImageStyle.deleteMany({});

        await ImageStyle.insertMany(styles);
        console.log(`Successfully seeded ${styles.length} image styles`);

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('Error seeding styles:', error);
        process.exit(1);
    }
}

seedStyles();
