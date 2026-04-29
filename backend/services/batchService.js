const BatchJob = require('../models/BatchJob');
const Project = require('../models/Project');
const NarrativeStyle = require('../models/NarrativeStyle');
const ImageStyle = require('../models/ImageStyle');
const projectService = require('./projectService');
const automationService = require('./automationService');

function log(event, details = {}) {
    console.log(`[BATCH] ${event}`, details);
}

function logError(event, details = {}) {
    console.error(`[BATCH] ${event}`, details);
}

/**
 * Creates a BatchJob and starts async sequential processing.
 * Returns the saved BatchJob immediately (non-blocking).
 *
 * @param {Array} items - Array of project config objects
 * @returns {Promise<object>} The created BatchJob document
 */
async function startBatch(items) {
    const job = new BatchJob({
        status: 'pending',
        items: items.map((config, index) => ({
            index,
            config,
            status: 'pending'
        }))
    });

    await job.save();

    log('batch_created', { batchId: job._id.toString(), itemCount: items.length });

    // Fire-and-forget: process sequentially in the background
    processBatch(job._id.toString()).catch(err =>
        logError('processBatch_unhandled_error', { batchId: job._id.toString(), error: err.message })
    );

    return job;
}

/**
 * Processes each batch item sequentially: create project → run full automation → await.
 * Project 2 only starts after project 1 has finished.
 *
 * @param {string} batchId
 */
async function processBatch(batchId) {
    const job = await BatchJob.findById(batchId);
    if (!job) {
        logError('batch_not_found', { batchId });
        return;
    }

    await BatchJob.findByIdAndUpdate(batchId, {
        status: 'running',
        startedAt: new Date()
    });

    log('batch_started', { batchId, itemCount: job.items.length });

    for (let i = 0; i < job.items.length; i++) {
        const item = job.items[i];

        // Skip non-pending items (e.g., cancelled)
        if (item.status !== 'pending') {
            log('item_skipped', { batchId, index: i, status: item.status });
            continue;
        }

        const config = item.config;
        log('item_started', { batchId, index: i, name: config.name });

        // Mark item as running
        await BatchJob.findByIdAndUpdate(batchId, {
            $set: {
                [`items.${i}.status`]: 'running',
                [`items.${i}.startedAt`]: new Date()
            }
        });

        let projectId = null;

        try {
            // Resolve narrative style by name
            let styleName = config.narrativeStyle || undefined;
            if (styleName) {
                const narrativeStyle = await NarrativeStyle.findOne({ name: styleName });
                if (!narrativeStyle) {
                    throw new Error(`Estilo narrativo não encontrado: "${styleName}". Verifique o nome exato no sistema.`);
                }
                styleName = narrativeStyle.name;
            }

            // Resolve image style by name
            let imageStyleId;
            if (config.imageStyle) {
                const imageStyle = await ImageStyle.findOne({ name: config.imageStyle });
                if (!imageStyle) {
                    throw new Error(`Estilo de imagem não encontrado: "${config.imageStyle}". Verifique o nome exato no sistema.`);
                }
                imageStyleId = imageStyle._id;
            }

            // Create project document + write source text to uploads/
            const { project } = await projectService.createProjectInternal({
                name: config.name,
                style: styleName,
                language: config.language || 'Português Brasileiro',
                imageStyle: imageStyleId,
                sourceText: config.sourceText,
                premise: config.premise,
                initialChapterStructure: config.chapters || [],
                aiProvider: config.aiProvider,
                aiModel: config.aiModel
            });

            projectId = project._id;

            // Persist the projectId in the batch item before automation starts
            await BatchJob.findByIdAndUpdate(batchId, {
                $set: { [`items.${i}.projectId`]: projectId }
            });

            log('item_automation_started', {
                batchId,
                index: i,
                projectId: projectId.toString(),
                name: config.name
            });

            // Run full automation synchronously — project N+1 only starts when project N finishes
            await automationService.runFullAutomation(projectId);

            // Determine success by checking final project status
            const finalProject = await Project.findById(projectId).select('status name');
            const succeeded = finalProject?.status === 'ready';

            await BatchJob.findByIdAndUpdate(batchId, {
                $set: {
                    [`items.${i}.status`]: succeeded ? 'completed' : 'failed',
                    [`items.${i}.completedAt`]: new Date(),
                    ...(!succeeded
                        ? { [`items.${i}.error`]: `Automação terminou com status: "${finalProject?.status || 'desconhecido'}"` }
                        : { [`items.${i}.error`]: null })
                }
            });

            log(succeeded ? 'item_completed' : 'item_completed_with_errors', {
                batchId,
                index: i,
                projectId: projectId.toString(),
                finalStatus: finalProject?.status
            });

        } catch (err) {
            logError('item_failed', {
                batchId,
                index: i,
                name: config.name,
                projectId: projectId?.toString() || null,
                error: err.message
            });

            await BatchJob.findByIdAndUpdate(batchId, {
                $set: {
                    [`items.${i}.status`]: 'failed',
                    [`items.${i}.completedAt`]: new Date(),
                    [`items.${i}.error`]: err.message
                }
            });
        }
    }

    // Compute final batch status
    const finalJob = await BatchJob.findById(batchId);
    const statuses = finalJob.items.map(it => it.status);
    const anyFailed = statuses.some(s => s === 'failed');
    const allFailed = statuses.every(s => s === 'failed');
    const anyCancelled = statuses.some(s => s === 'cancelled');

    let finalStatus = 'completed';
    if (allFailed && !anyCancelled) finalStatus = 'failed';
    else if (anyFailed || anyCancelled) finalStatus = 'completed_with_errors';

    await BatchJob.findByIdAndUpdate(batchId, {
        status: finalStatus,
        completedAt: new Date()
    });

    log('batch_finished', { batchId, finalStatus, itemCount: job.items.length });
}

module.exports = { startBatch };
