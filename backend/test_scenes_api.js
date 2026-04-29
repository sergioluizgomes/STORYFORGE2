const mongoose = require('mongoose');

async function testScenesAPI() {
    console.log("Starting Scene API Test (using fetch)...");

    const API_URL = 'http://localhost:3005/api';

    try {
        // 1. Get a project ID
        console.log("Fetching projects...");
        const resProjects = await fetch(`${API_URL}/projects`);
        if (!resProjects.ok) throw new Error(`Failed to fetch projects: ${resProjects.statusText}`);

        const projects = await resProjects.json();
        if (projects.length === 0) {
            console.error("No projects found. Create a project first.");
            return;
        }

        // Find a project with 'bible_ready' status or similar
        const project = projects.find(p => p.status !== 'new');
        if (!project) {
            console.error("No project with bible ready found.");
            return;
        }
        console.log(`Using Project: ${project.name} (${project._id})`);

        // 2. Get the Bible to find a beat
        console.log("Fetching Bible...");
        const resBible = await fetch(`${API_URL}/generate/bible/${project._id}`);
        if (!resBible.ok) throw new Error("Failed to fetch bible");

        const bible = await resBible.json();
        if (!bible || !bible.beats || bible.beats.length === 0) {
            console.error("Bible has no beats.");
            return;
        }

        const beatToTest = bible.beats[0];
        console.log(`Testing with Beat #${beatToTest.id}: ${beatToTest.title}`);

        // 3. Generate Scene for this beat
        console.log("Triggering Scene Generation (this might take a while)...");

        const resGenerate = await fetch(`${API_URL}/scenes/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                projectId: project._id,
                beatId: beatToTest.id
            })
        });

        if (!resGenerate.ok) {
            const errText = await resGenerate.text();
            throw new Error(`Generation failed: ${errText}`);
        }

        const generatedScene = await resGenerate.json();
        console.log("Generation Response Status:", resGenerate.status);
        console.log("Generated Scene Content Length:", generatedScene.content ? generatedScene.content.length : 0);
        console.log("Scene Status:", generatedScene.status);

        if (generatedScene.content && generatedScene.content.length > 0 && generatedScene.status === 'draft') {
            console.log("SUCCESS: Scene Generated.");
        } else {
            console.error("FAILURE: Scene generation response invalid.");
        }

        // 4. Fetch Scenes for Project
        console.log("Fetching all scenes for project...");
        const resScenes = await fetch(`${API_URL}/scenes/project/${project._id}`);
        const scenes = await resScenes.json();
        console.log(`Found ${scenes.length} scenes.`);

        const foundScene = scenes.find(s => s.beatId === beatToTest.id);
        if (foundScene) {
            console.log("SUCCESS: Fetched generated scene.");
        } else {
            console.error("FAILURE: Could not find generated scene in list.");
        }

    } catch (error) {
        console.error("Test Failed:", error.message);
    }
}

testScenesAPI();
