const test = require('node:test');
const assert = require('node:assert/strict');

let aiService = null;
try {
    require.resolve('mongoose');
    const NarrativeStyle = require('../models/NarrativeStyle');
    NarrativeStyle.findOne = async () => null;
    aiService = require('../services/aiService');
} catch (error) {
    aiService = null;
}

function baseBible() {
    return {
        summary: 'Uma familia enfrenta uma ameaca sobrenatural.',
        premise: 'A coragem nasce do cuidado.',
        theCrucible: 'A cidade esta isolada durante uma tempestade.',
        style_notes: 'Prosa cinematografica e emocional.',
        characters: [
            {
                name: 'Lia',
                role: 'Protagonista',
                description: 'Investigadora determinada.',
                motivation: 'Salvar o irmao.'
            }
        ],
        settings: [
            {
                name: 'Centro antigo',
                description: 'Ruas estreitas e alagadas.'
            }
        ],
        chapters: [
            {
                chapterNumber: 1,
                title: 'A chuva',
                type: 'NORMAL',
                aiSummary: 'Lia encontra o primeiro sinal.',
                beats: [
                    {
                        id: 1,
                        title: 'O sinal',
                        description: 'Lia ve marcas brilhando na parede.'
                    }
                ]
            }
        ],
        beats: [
            {
                id: 1,
                title: 'O sinal',
                description: 'Lia ve marcas brilhando na parede.'
            }
        ]
    };
}

test('buildScenePrompt includes editorial brief when BookBrief exists', async () => {
    if (!aiService) {
        assert.ok(true, 'Skipping prompt integration test because backend dependencies are not installed.');
        return;
    }

    const prompt = await aiService.buildScenePrompt(
        { id: 1, title: 'O sinal', description: 'Lia ve marcas brilhando na parede.' },
        baseBible(),
        'Fantasia urbana',
        'Portugues Brasileiro',
        '',
        '',
        '',
        '',
        '',
        '',
        { isShortStory: false },
        {
            language: 'Portugues Brasileiro',
            genre: 'Fantasia urbana',
            targetAudience: 'Jovens adultos',
            tone: 'sombrio',
            mustAvoid: ['violencia grafica excessiva']
        }
    );

    assert.match(prompt, /EDITORIAL BRIEF/);
    assert.match(prompt, /Genre: Fantasia urbana/);
    assert.match(prompt, /Target audience: Jovens adultos/);
    assert.match(prompt, /Must avoid:/);
    assert.match(prompt, /violencia grafica excessiva/);
    assert.match(prompt, /SCENE WORD COUNT TARGET/);
    assert.match(prompt, /CURRENT SCENE \(Beat #1\)/);
    assert.match(prompt, /STORY SUMMARY/);
});

test('buildScenePrompt omits editorial brief when BookBrief is missing', async () => {
    if (!aiService) {
        assert.ok(true, 'Skipping prompt integration test because backend dependencies are not installed.');
        return;
    }

    const prompt = await aiService.buildScenePrompt(
        { id: 1, title: 'O sinal', description: 'Lia ve marcas brilhando na parede.' },
        baseBible(),
        'Fantasia urbana',
        'Portugues Brasileiro',
        '',
        '',
        '',
        '',
        '',
        '',
        { isShortStory: false },
        null
    );

    assert.doesNotMatch(prompt, /EDITORIAL BRIEF/);
    assert.match(prompt, /SCENE WORD COUNT TARGET/);
    assert.match(prompt, /CURRENT SCENE \(Beat #1\)/);
});
