/**
 * Drops the deprecated Comic collections (ComicBooks, ComicStyles).
 * Run with: node scripts/dropComicCollections.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/story-generator';
    await mongoose.connect(uri);

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    const names = new Set(collections.map(c => c.name));

    const toDrop = ['comicbooks', 'comicstyles'];
    const dropped = [];
    const skipped = [];

    for (const name of toDrop) {
        if (names.has(name)) {
            await db.dropCollection(name);
            dropped.push(name);
        } else {
            skipped.push(name);
        }
    }

    console.log(JSON.stringify({ dropped, skipped }, null, 2));
    await mongoose.disconnect();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
