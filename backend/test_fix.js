
const { ensureArray } = require('./routeHelperForTest');

// Mock data as received from AI (bad case)
const badData = {
    characters: '[{"new_name": "Test Char", "role": "Hero", "description": "Desc"}]',
    settings: '[{"new_name": "Test Loc", "description": "Desc"}]',
    beats: '[{"id": 1, "title": "Test Beat"}]'
};

// Mock data (good case)
const goodData = {
    characters: [{ "new_name": "Test Char", "role": "Hero", "description": "Desc" }],
    settings: [{ "new_name": "Test Loc", "description": "Desc" }],
    beats: [{ "id": 1, "title": "Test Beat" }]
};

console.log("Testing Bad Data Parsing...");
const char1 = ensureArray(badData.characters);
const sett1 = ensureArray(badData.settings);
const beat1 = ensureArray(badData.beats);

if (Array.isArray(char1) && char1.length === 1 && char1[0].new_name === "Test Char") console.log("- Characters: PASS"); else console.error("- Characters: FAIL", char1);
if (Array.isArray(sett1) && sett1.length === 1 && sett1[0].new_name === "Test Loc") console.log("- Settings: PASS"); else console.error("- Settings: FAIL", sett1);
if (Array.isArray(beat1) && beat1.length === 1 && beat1[0].title === "Test Beat") console.log("- Beats: PASS"); else console.error("- Beats: FAIL", beat1);

console.log("\nTesting Good Data Passthrough...");
const char2 = ensureArray(goodData.characters);
const beat2 = ensureArray(goodData.beats);

if (Array.isArray(char2) && char2.length === 1) console.log("- Characters: PASS"); else console.error("- Characters: FAIL");
if (Array.isArray(beat2) && beat2.length === 1) console.log("- Beats: PASS"); else console.error("- Beats: FAIL");
