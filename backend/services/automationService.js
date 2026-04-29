const Project = require('../models/Project');
const Bible = require('../models/Bible');
const Scene = require('../models/Scene');
const aiService = require('./aiService');
const logStore = require('./logStore');

function logAutomation(projectId, event, details = {}) {
    console.log(`[PROJECT_AUTOMATION] ${event}`, {
        projectId: projectId?.toString?.() || projectId,
        ...details
    });
    logStore.appendLog(projectId, 'info', event, details);
}

function logAutomationError(projectId, event, details = {}) {
    console.error(`[PROJECT_AUTOMATION] ${event}`, {
        projectId: projectId?.toString?.() || projectId,
        ...details
    });
    logStore.appendLog(projectId, 'error', event, details);
}

const activeAutomations = new Set();

/**
 * Updates automationProgress on the project document without triggering pre-save hooks.
 */
async function updateProgress(projectId, patch) {
    await Project.findByIdAndUpdate(projectId, {
        $set: {
            'automationProgress.phase': patch.phase || undefined,
            'automationProgress.totalBeats': patch.totalBeats,
            'automationProgress.updatedAt': new Date(),
            ...(patch.completedBeatId != null
                ? {} // handled with $push below
                : {})
        },
        ...(patch.completedBeatId != null
            ? { $push: { 'automationProgress.completedBeatIds': patch.completedBeatId } }
            : {}),
        ...(patch.error
            ? { $push: { 'automationProgress.errors': { beatId: patch.error.beatId, message: patch.error.message, at: new Date() } } }
            : {})
    });
}

/**
 * Service to automate the entire project generation process.
 */
class AutomationService {
    /**
     * Runs the full automation chain for a project.
     * Pass opts.resume = true to continue a partially completed project.
     * @param {string} projectId
     * @param {{ resume?: boolean }} opts
     */
    async runFullAutomation(projectId, opts = {}) {
        const { resume = false } = opts;
        const startedAt = Date.now();
        const automationKey = projectId?.toString?.() || projectId;
        let beatEnrichmentFailureCount = 0;
        let sceneFailureCount = 0;
        let sceneSuccessCount = 0;

        if (activeAutomations.has(automationKey)) {
            logAutomation(projectId, 'skipped_duplicate_dispatch');
            return;
        }

        activeAutomations.add(automationKey);

        try {
            const project = await Project.findById(projectId).populate('imageStyle');
            if (!project) {
                logAutomationError(projectId, 'project_not_found');
                return;
            }

            const resumable = ['bible_ready', 'generating_media', 'writing'].includes(project.status);
            if (project.status !== 'new' && !(resume && resumable)) {
                logAutomation(projectId, 'skipped_existing_progress', { status: project.status });
                return;
            }

            logAutomation(projectId, resume ? 'resumed' : 'started', {
                name: project.name,
                status: project.status,
                aiProvider: project.aiProvider || '(default)',
                aiModel: project.aiModel || '(default)',
                language: project.language,
                style: project.style
            });

            // ──────────────────────────────────────────────────────────
            // PHASE 1: Analysis + Bible Generation (skip when resuming)
            // ──────────────────────────────────────────────────────────
            let bible;
            let sourceText;

            const skipAnalysis = resume && resumable;

            if (!skipAnalysis) {
                project.status = 'analyzing';
                await project.save();
                logAutomation(projectId, 'status_updated', { status: project.status });

                sourceText = await aiService.readTextFile(project.originalFilePath);
                logAutomation(projectId, 'source_loaded', {
                    originalFilePath: project.originalFilePath,
                    textLength: sourceText.length
                });

                const analysis = await aiService.analyzeStoryStructure(sourceText, project.language, project);
                logAutomation(projectId, 'analysis_completed', {
                    characterCount: analysis.characters?.length || 0,
                    settingCount: analysis.settings?.length || 0,
                    beatCount: analysis.beats?.length || 0,
                    chapterCount: analysis.chapters?.length || 0
                });

                const bibleData = await aiService.generateStoryBible(
                    analysis,
                    project.style,
                    project.language,
                    project.initialChapterStructure || [],
                    project.premise || '',
                    project
                );

                const {
                    characters = [],
                    settings = [],
                    chapters = [],
                    beats = [],
                    summary,
                    premise,
                    theCrucible,
                    style_notes
                } = bibleData;

                logAutomation(projectId, 'bible_generated', {
                    summaryLength: summary?.length || 0,
                    characterCount: characters.length,
                    settingCount: settings.length,
                    chapterCount: chapters.length,
                    topLevelBeatCount: beats.length
                });

                const mappedCharacters = characters.map(c => ({
                    name: c.new_name,
                    role: c.role,
                    description: c.description,
                    motivation: c.motivation,
                    visualDescription: c.visual_description,
                    archetype: c.original_name
                }));

                const mappedSettings = settings.map(s => ({
                    name: s.new_name,
                    type: 'Location',
                    description: s.description,
                    atmosphere: style_notes
                }));

                const mappedChapters = chapters.map(chapter => ({
                    chapterNumber: chapter.chapterNumber,
                    title: chapter.title,
                    type: chapter.type,
                    aiSummary: chapter.aiSummary,
                    mythicStage: chapter.mythicStage,
                    beats: (chapter.beats || []).map(beat => ({
                        id: beat.id,
                        title: beat.title,
                        description: beat.description,
                        type: 'Beat'
                    }))
                }));

                // Re-number all beats with globally unique sequential IDs across chapters.
                // The AI often restarts numbering per chapter (1, 2, 3 / 1, 2, 3 ...)
                // which causes the checkpoint Set to skip duplicate beat IDs and
                // triggers scene re-generation for every chapter after the first.
                let globalBeatId = 1;
                for (const chapter of mappedChapters) {
                    for (const beat of chapter.beats) {
                        beat.id = globalBeatId++;
                    }
                }

                const mappedBeats = mappedChapters.length > 0
                    ? mappedChapters.flatMap(chapter => chapter.beats)
                    : beats.map((b, idx) => ({
                        id: idx + 1,
                        title: b.title,
                        description: b.description,
                        type: 'Beat'
                    }));

                bible = await Bible.findOne({ projectId });
                if (bible) {
                    bible.summary = summary;
                    bible.premise = premise;
                    bible.theCrucible = theCrucible;
                    bible.characters = mappedCharacters;
                    bible.settings = mappedSettings;
                    bible.chapters = mappedChapters;
                    bible.beats = mappedBeats;
                } else {
                    bible = new Bible({
                        projectId,
                        summary,
                        premise,
                        theCrucible,
                        characters: mappedCharacters,
                        settings: mappedSettings,
                        chapters: mappedChapters,
                        beats: mappedBeats
                    });
                }
                await bible.save();
                logAutomation(projectId, 'bible_saved', {
                    bibleId: bible._id.toString(),
                    beatCount: mappedBeats.length,
                    chapterCount: mappedChapters.length
                });

                project.status = 'bible_ready';
                await project.save();
                logAutomation(projectId, 'status_updated', { status: project.status });
            } else {
                bible = await Bible.findOne({ projectId });
                if (!bible) {
                    throw new Error('Resume failed: Bible not found for project');
                }
                // Try to load source text for beat enrichment (non-blocking)
                try {
                    if (project.originalFilePath && project.originalFilePath !== 'imported-json') {
                        sourceText = await aiService.readTextFile(project.originalFilePath);
                    }
                } catch (e) {
                    logAutomation(projectId, 'source_text_unavailable_on_resume', { error: e.message });
                }
                logAutomation(projectId, 'resume_bible_loaded', {
                    bibleId: bible._id.toString(),
                    beatCount: bible.beats.length,
                    chapterCount: bible.chapters.length
                });
            }

            // ──────────────────────────────────────────────────────────
            // PHASE 2: Beat Enrichment (skip if already in 'writing')
            // ──────────────────────────────────────────────────────────
            const skipEnrichment = resume && project.status === 'writing';

            if (!skipEnrichment && sourceText) {
                logAutomation(projectId, 'beat_enrichment_started', { beatCount: bible.beats.length });
                for (let i = 0; i < bible.beats.length; i++) {
                    try {
                        const beat = bible.beats[i];
                        const details = await aiService.generateBeatDetails(beat, sourceText, project.style, 'Make it cinematic.', project);
                        bible.beats[i].visualDescription = details.visual_description;
                        bible.beats[i].description = details.description;

                        // Mirror the enrichment into chapters[].beats[] (canonical source),
                        // because the pre-save hook rebuilds beats[] from chapters[].beats[],
                        // which would otherwise overwrite the values set above.
                        if (bible.chapters && bible.chapters.length > 0) {
                            for (const chapter of bible.chapters) {
                                const chapterBeat = (chapter.beats || []).find(b => b.id === beat.id);
                                if (chapterBeat) {
                                    chapterBeat.visualDescription = details.visual_description;
                                    chapterBeat.description = details.description;
                                    break;
                                }
                            }
                        }
                    } catch (err) {
                        beatEnrichmentFailureCount += 1;
                        logAutomationError(projectId, 'beat_enrichment_failed', {
                            beatId: bible.beats[i].id,
                            beatTitle: bible.beats[i].title,
                            error: err.message
                        });
                    }
                }
                bible.markModified('chapters');
                await bible.save();
                logAutomation(projectId, 'beat_enrichment_finished', {
                    beatCount: bible.beats.length,
                    failedCount: beatEnrichmentFailureCount
                });
            } else if (skipEnrichment) {
                logAutomation(projectId, 'beat_enrichment_skipped_resume');
            }

            // ──────────────────────────────────────────────────────────
            // PHASE 3: Scene Generation with checkpointing
            // ──────────────────────────────────────────────────────────
            logAutomation(projectId, 'scene_writing_started', { beatCount: bible.beats.length });
            project.status = 'writing';
            await project.save();
            logAutomation(projectId, 'status_updated', { status: project.status });

            // Load already-completed scenes to support checkpointing and resume
            const existingScenes = await Scene.find({ projectId }).lean();
            const completedBeatIds = new Set(existingScenes.map(s => s.beatId));

            // Build ordered history from existing scenes (for context chaining)
            const sceneHistory = existingScenes
                .sort((a, b) => a.beatId - b.beatId)
                .map(s => ({ beatId: s.beatId, title: s.title || '', summary: s.summary || '' }));

            const totalBeats = bible.beats.length;

            // Initialise automationProgress
            await Project.findByIdAndUpdate(projectId, {
                $set: {
                    'automationProgress.phase': 'writing',
                    'automationProgress.totalBeats': totalBeats,
                    'automationProgress.updatedAt': new Date()
                }
            });

            for (const beat of bible.beats) {
                // Checkpoint: skip already-written scenes
                if (completedBeatIds.has(beat.id)) {
                    logAutomation(projectId, 'scene_skipped_already_done', {
                        beatId: beat.id,
                        beatTitle: beat.title
                    });
                    sceneSuccessCount += 1;
                    continue;
                }

                try {
                    logAutomation(projectId, 'scene_generation_started', {
                        beatId: beat.id,
                        beatTitle: beat.title
                    });

                    // Build layered previous context (recent full + older compressed)
                    const previousContext = aiService.buildLayeredContext(sceneHistory);

                    const prose = await aiService.generateScene(
                        beat, bible, project.style, project.language,
                        '', previousContext, '', '', '', '', project
                    );
                    const sceneSummary = await aiService.generateSceneSummary(prose, project.language, project);
                    const wordCount = prose.split(/\s+/).filter(Boolean).length;

                    const scene = new Scene({
                        projectId,
                        beatId: beat.id,
                        title: beat.title,
                        content: prose,
                        summary: sceneSummary,
                        wordCount,
                        status: 'draft'
                    });
                    await scene.save();

                    // Mark as done so duplicate beats in bible.beats are skipped
                    completedBeatIds.add(beat.id);

                    // Push to history for next scene's context
                    sceneHistory.push({ beatId: beat.id, title: beat.title, summary: sceneSummary });

                    // Persist checkpoint
                    await updateProgress(projectId, {
                        phase: 'writing',
                        totalBeats,
                        completedBeatId: beat.id
                    });

                    sceneSuccessCount += 1;
                    logAutomation(projectId, 'scene_saved', {
                        beatId: beat.id,
                        beatTitle: beat.title,
                        sceneId: scene._id.toString(),
                        wordCount,
                        summaryLength: sceneSummary.length
                    });
                } catch (err) {
                    sceneFailureCount += 1;
                    logAutomationError(projectId, 'scene_generation_failed', {
                        beatId: beat.id,
                        beatTitle: beat.title,
                        error: err.message
                    });
                    await updateProgress(projectId, {
                        phase: 'writing',
                        totalBeats,
                        error: { beatId: beat.id, message: err.message }
                    });
                }
            }

            logAutomation(projectId, 'scene_writing_finished', {
                attemptedCount: totalBeats,
                successCount: sceneSuccessCount,
                failedCount: sceneFailureCount
            });

            // Finalize
            project.status = 'ready';
            await project.save();
            await Project.findByIdAndUpdate(projectId, {
                $set: { 'automationProgress.phase': 'done', 'automationProgress.updatedAt': new Date() }
            });
            logAutomation(projectId, 'status_updated', { status: project.status });

            const completionEvent = sceneFailureCount > 0 || beatEnrichmentFailureCount > 0
                ? 'completed_with_errors'
                : 'completed';

            logAutomation(projectId, completionEvent, {
                name: project.name,
                durationMs: Date.now() - startedAt,
                beatEnrichmentFailureCount,
                sceneSuccessCount,
                sceneFailureCount
            });

        } catch (error) {
            logAutomationError(projectId, 'failed', {
                error: error.message,
                durationMs: Date.now() - startedAt,
                stack: error.stack
            });
            try {
                const proj = await Project.findById(projectId);
                // Only reset to 'new' if we never got past analysis
                if (proj && proj.status === 'analyzing') {
                    await Project.findByIdAndUpdate(projectId, { status: 'new' });
                    logAutomation(projectId, 'status_reset', { status: 'new' });
                }
            } catch (e) { }
        } finally {
            activeAutomations.delete(automationKey);
        }
    }
}

module.exports = new AutomationService();
