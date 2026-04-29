const mongoose = require('mongoose');
const NarrativeStyle = require('../models/NarrativeStyle');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const styles = [
    {
        name: "Space Opera",
        description: "Epic adventures in deep space, featuring interstellar travel and massive spacecraft.",
        instruction: "Focus on grand scale, diverse alien civilizations, high-tech gadgets, and dramatic space battles. The tone should be heroic and adventurous."
    },
    {
        name: "Cyberpunk",
        description: "High-tech and low-life. Futuristic settings where technology dominates society.",
        instruction: "Emphasize neon aesthetics, social decay, powerful corporations, and hacking. The setting should feel rainy, gritty, and oppressive."
    },
    {
        name: "High Fantasy",
        description: "Epic tales in secondary worlds with magic, mythical creatures, and ancient legends.",
        instruction: "Use formal language, emphasize magic systems, medieval-inspired settings, and clearly defined forces of good and evil."
    },
    {
        name: "Noir Mystery",
        description: "Gritty, dark detective stories set in a corrupt urban environment.",
        instruction: "Adopt a cynical and melancholic tone. Focus on shadows, moral ambiguity, internal monologues, and sharp, hard-boiled dialogue."
    },
    {
        name: "Lovecraftian Horror",
        description: "Cosmic dread and ancient, incomprehensible beings that defy human understanding.",
        instruction: "Focus on desolation, madness, and the insignificance of humanity. Use descriptive adjectives that evoke wetness, slime, and ancient architectural decay. Never fully describe the monsters, focus on the psychological impact."
    },
    {
        name: "Steampunk",
        description: "A reimagined Victorian era powered by steam and clockwork technology.",
        instruction: "Include brass gears, steam-powered vehicles, and Victorian social norms blended with futuristic machinery. The atmosphere should be industrious and ornate."
    },
    {
        name: "Grimdark Fantasy",
        description: "Violent, amoral fantasy where survival is the only victory.",
        instruction: "The tone should be bleak and nihilistic. Characters are deeply flawed, and traditional heroism is absent. Focus on the harsh reality of war and corruption."
    },
    {
        name: "Psychological Thriller",
        description: "Suspense focused on the mental and emotional states of characters.",
        instruction: "Focus on unreliable narrators, internal tension, and subtle clues. The environment should reflect the character's deteriorating mental state."
    },
    {
        name: "Urban Fantasy",
        description: "Magical elements existing within a modern, realistic urban setting.",
        instruction: "Blend the mundane with the magical. Hidden societies and supernatural beings living among humans in a contemporary city."
    },
    {
        name: "Hard Sci-Fi",
        description: "Science fiction characterized by a concern for scientific accuracy and logic.",
        instruction: "Prioritize technical detail, logical consistency, and the consequences of scientific advancement. The tone is often analytical and grounded in physics or biology."
    }
];

async function seedNarrativeStyles() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/writing-assistant');
        console.log('Connected to MongoDB');

        await NarrativeStyle.deleteMany({});
        await NarrativeStyle.insertMany(styles);
        console.log(`Successfully seeded ${styles.length} narrative styles`);

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('Error seeding narrative styles:', error);
        process.exit(1);
    }
}

seedNarrativeStyles();
