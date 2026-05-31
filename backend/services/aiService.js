const fs = require('fs');
const NarrativeStyle = require('../models/NarrativeStyle');
const { CHAPTER_TYPES } = require('../config/constants');
const textGenerationService = require('./textGenerationService');
const { resolveBeatWordBudget } = require('./storyStructureService');
const {
    buildBookBriefPromptContext,
    getBookBriefByProjectId
} = require('./bookBriefService');
const { safeErrorForLog } = require('../utils/safeLog');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function countWords(text) {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Given a beat ID and a bible, returns the CHAPTER_TYPES entry for the chapter
 * that contains the beat, or null if not found.
 */
function findChapterTypeForBeat(beatId, bible) {
    if (!bible || !bible.chapters) return null;
    for (const chapter of bible.chapters) {
        if (chapter.beats && chapter.beats.some(b => String(b.id) === String(beatId))) {
            const typeKey = (chapter.type || 'NORMAL').toUpperCase();
            return CHAPTER_TYPES[typeKey] || null;
        }
    }
    return null;
}

/**
 * Builds a layered previous-context string from an array of scene history items.
 * Recent scenes (last 2) are included in full; older ones are compressed into a digest.
 * @param {Array<{beatId: number, title: string, summary: string}>} sceneHistory
 * @returns {string}
 */
function buildLayeredContext(sceneHistory) {
    if (!sceneHistory || sceneHistory.length === 0) return '';

    const recentCount = 2;
    const recent = sceneHistory.slice(-recentCount);
    const older = sceneHistory.slice(0, sceneHistory.length - recentCount);

    let context = '';

    if (older.length > 0) {
        const digest = older
            .map(s => `- [Cena ${s.beatId} — ${s.title}]: ${(s.summary || '').substring(0, 180).trim()}`)
            .join('\n');
        context += `CONTEXTO ANTERIOR (digest comprimido):\n${digest}\n\n`;
    }

    if (recent.length > 0) {
        context += `CENAS MAIS RECENTES:\n${recent
            .map(s => `[CENA ${s.beatId} — ${s.title}]:\n${s.summary || ''}`)
            .join('\n\n')}`;
    }

    return context;
}


async function getStyleInstruction(styleName) {
    try {
        const style = await NarrativeStyle.findOne({ name: styleName });
        return style ? style.instruction : "";
    } catch (e) {
        return "";
    }
}

async function getStyleInstructions(styleName) {
    try {
        const style = await NarrativeStyle.findOne({ name: styleName });
        if (!style) return null;

        return {
            base: style.instruction,
            bible: style.bibleInstructions || style.instruction,
            scene: style.sceneInstructions || style.instruction,
            character: style.characterInstructions || style.instruction,
            location: style.locationInstructions || style.instruction,
            beat: style.beatInstructions || style.instruction,
            craft: style.craftPrinciples || {},
            structure: style.structureRules || {},
            examples: style.examples || { good: [], bad: [] }
        };
    } catch (e) {
        return null;
    }
}

const analysisSchema = {
    type: "object",
    properties: {
        summary: { type: "string" },
        premise: { type: "string" },
        theCrucible: { type: "string" },
        tone: { type: "string" },
        characters: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    name: { type: "string" },
                    role: { type: "string" },
                    archetype: { type: "string" },
                    key_traits: { type: "string" }
                },
                required: ["name", "role", "archetype", "key_traits"]
            }
        },
        settings: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    name: { type: "string" },
                    type: { type: "string" },
                    description: { type: "string" }
                },
                required: ["name", "type", "description"]
            }
        },
        beats: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    id: { type: "number" },
                    type: { type: "string" },
                    title: { type: "string" },
                    description: { type: "string" }
                },
                required: ["id", "type", "title", "description"]
            }
        }
    },
    required: ["summary", "tone", "characters", "settings", "beats"]
};

const bibleSchema = {
    type: "object",
    properties: {
        summary: { type: "string" },
        premise: { type: "string" },
        theCrucible: { type: "string" },
        style_notes: { type: "string" },
        characters: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    original_name: { type: "string" },
                    new_name: { type: "string" },
                    role: { type: "string" },
                    archetype: { type: "string" },
                    mythicArchetype: { type: "string" },
                    rulingPassion: { type: "string" },
                    theWound: { type: "string" },
                    specialTalent: { type: "string" },
                    description: { type: "string" },
                    motivation: { type: "string" },
                    visual_description: { type: "string" }
                },
                required: ["original_name", "new_name", "role", "description", "motivation", "visual_description"]
            }
        },
        settings: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    original_name: { type: "string" },
                    new_name: { type: "string" },
                    description: { type: "string" }
                },
                required: ["original_name", "new_name", "description"]
            }
        },
        chapters: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    chapterNumber: { type: "number" },
                    title: { type: "string" },
                    type: { type: "string" },
                    aiSummary: { type: "string" },
                    mythicStage: { type: "string" },
                    beats: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                id: { type: "number" },
                                title: { type: "string" },
                                description: { type: "string" }
                            },
                            required: ["id", "title", "description"]
                        }
                    }
                },
                required: ["chapterNumber", "title", "beats"]
            }
        }
    },
    required: ["summary", "style_notes", "characters", "settings", "chapters"]
};

const characterBackgroundSchema = {
    type: "object",
    properties: {
        background: { type: "string" },
        visual_description: { type: "string" }
    },
    required: ["background", "visual_description"]
};

const locationBackgroundSchema = {
    type: "object",
    properties: {
        description: { type: "string" },
        visual_description: { type: "string" }
    },
    required: ["description", "visual_description"]
};

/**
 * Reads a text file and returns its content.
 * @param {string} filePath 
 * @returns {Promise<string>}
 */
async function readTextFile(filePath) {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) reject(err);
            else resolve(data);
        });
    });
}

/**
 * Analyzes the original story text to extract structure.
 * @param {string} text - The full text of the story.
 * @param {string} language - The target language for the analysis.
 * @returns {Promise<Object>} - The structured analysis (JSON).
 */
async function analyzeStoryStructure(text, language = "Português Brasileiro", project = null) {
    const prompt = `
    You are an expert story analyst. Analyze the following story text. 
    Your goal is to extract the underlying structural "beats" and the "DNA" of the story so it can be retold in a different genre.
    
    IMPORTANT: All text in the JSON response must be in ${language}.
    
    STORY TEXT:
    ${text.substring(0, 30000)} 
    `;
    // Truncating to 30k chars for safety in this demo, though 1.5 Flash has huge context.

    try {
        const { data } = await textGenerationService.generateStructured({
            project,
            prompt,
            schema: analysisSchema,
            schemaName: 'story analysis',
            costMetadata: {
                task: 'analyze_project',
                stage: 'analysis',
                requestType: 'text',
                source: 'aiService.analyzeStoryStructure'
            }
        });
        const rawJson = data;
        console.log("[AI_ANALYSIS] completed", {
            characterCount: rawJson.characters?.length || 0,
            settingCount: rawJson.settings?.length || 0,
            beatCount: rawJson.beats?.length || 0,
            chapterCount: rawJson.chapters?.length || 0
        });
        return rawJson;
    } catch (error) {
        console.error("AI Analysis Error:", safeErrorForLog(error));
        throw new Error("Failed to analyze story structure.");
    }
}

async function resolveBookBriefForPrompt(project, bookBrief) {
    if (bookBrief !== undefined) {
        return bookBrief;
    }

    const projectId = project && (project._id || project.id);
    if (!projectId) {
        return null;
    }

    try {
        return await getBookBriefByProjectId(projectId);
    } catch (error) {
        console.warn('[SCENE] BookBrief unavailable for prompt context', {
            projectId: projectId?.toString?.() || projectId,
            error: safeErrorForLog(error)
        });
        return null;
    }
}

async function generateStoryBible(analysis, targetStyle, targetLang = "Português Brasileiro", initialChapterStructure = [], premise = "", project = null) {
    const styleData = await getStyleInstructions(targetStyle);
    const language = targetLang || "Português Brasileiro";

    // Build structural rules section
    let structureSection = "";
    if (styleData && styleData.structure) {
        const rules = [];
        if (styleData.structure.protagonistCount) {
            rules.push(`- Limit to ${styleData.structure.protagonistCount} main protagonist(s)`);
        }
        if (styleData.structure.incitingIncidentTiming) {
            rules.push(`- Inciting incident timing: ${styleData.structure.incitingIncidentTiming}`);
        }
        if (styleData.structure.jeopardyProgression) {
            rules.push(`- Jeopardy progression: ${styleData.structure.jeopardyProgression}`);
        }
        if (rules.length > 0) {
            structureSection = `\n\nSTRUCTURAL RULES:\n${rules.join('\n')}`;
        }
    }

    // Build craft principles section
    let craftSection = "";
    if (styleData && styleData.craft) {
        const principles = [];
        if (styleData.craft.characterDepth) {
            principles.push(`- Character Depth: ${styleData.craft.characterDepth}`);
        }
        if (styleData.craft.showDontTell) {
            principles.push(`- Show Don't Tell: ${styleData.craft.showDontTell}`);
        }
        if (principles.length > 0) {
            craftSection = `\n\nCRAFT PRINCIPLES:\n${principles.join('\n')}`;
        }
    }

    // Build examples section
    let examplesSection = "";
    if (styleData && styleData.examples) {
        if (styleData.examples.good && styleData.examples.good.length > 0) {
            examplesSection += `\n\nGOOD EXAMPLES:\n${styleData.examples.good.map(ex => `✓ ${ex}`).join('\n')}`;
        }
        if (styleData.examples.bad && styleData.examples.bad.length > 0) {
            examplesSection += `\n\nAVOID THESE PATTERNS:\n${styleData.examples.bad.map(ex => `✗ ${ex}`).join('\n')}`;
        }
    }

    const bibleInstruction = styleData ? styleData.bible : "";

    // Use project.isShortStory (stored in MongoDB at creation) as primary source of truth.
    // Fall back to initialChapterStructure.length === 1 for resilience.
    const isShortStory = (project && project.isShortStory === true) ||
                         (initialChapterStructure && initialChapterStructure.length === 1);
    const targetWordCount = (project && project.targetWordCount) ? project.targetWordCount : 5000;

    // Compute beat count proportional to word count for short stories
    // ~500 words per beat is a reasonable estimate
    const shortStoryBeatCount = Math.max(3, Math.round(targetWordCount / 500));

    // Construct the chapter structure prompt part
    let chapterStructurePrompt = "";
    if (isShortStory) {
        // ── SHORT STORY MODE ──────────────────────────────────────────────
        chapterStructurePrompt = `

SHORT STORY MODE: This is a short story / conto, NOT a multi-chapter novel.
Target word count: ${targetWordCount} words.

STRUCTURE RULES:
- Generate exactly 1 entry in the "chapters" array (chapterNumber: 1).
- That single chapter must contain exactly ${shortStoryBeatCount} beats — proportional to the target word count.
- Do NOT use chapter-based narrative framing. Think of beats as scenes in a single continuous narrative arc.
- Pacing: ${targetWordCount <= 3000 ? 'tight and fast — every beat must count, no subplots' : targetWordCount <= 8000 ? 'balanced — allow some character development between action beats' : 'expansive — rich character interiority and setting detail allowed'}.
- The beats must form a complete dramatic arc: setup → conflict escalation → climax → resolution.

CRITICAL: The "chapters" array must have EXACTLY 1 element with EXACTLY ${shortStoryBeatCount} beats.`;
    } else if (initialChapterStructure && initialChapterStructure.length > 0) {
        // ── MULTI-CHAPTER MODE ────────────────────────────────────────────
        const requiredCount = initialChapterStructure.length;
        chapterStructurePrompt = `

REQUIRED CHAPTER STRUCTURE — EXACTLY ${requiredCount} CHAPTERS:
`;
        initialChapterStructure.forEach(chap => {
            const typeInfo = CHAPTER_TYPES[chap.type] || CHAPTER_TYPES.NORMAL;
            chapterStructurePrompt += `Chapter ${chap.number} (${typeInfo.name}):\n`;
            chapterStructurePrompt += `   - User Intent: ${chap.description || "No specific intent provided."}\n`;
            chapterStructurePrompt += `   - Type Guidelines: ${typeInfo.description}\n`;
            chapterStructurePrompt += `   - Writing Instruction: ${typeInfo.promptInstruction}\n`;
            chapterStructurePrompt += `   - Target Word Count: ${typeInfo.wordCount.min}-${typeInfo.wordCount.max} words (plan beats accordingly)\n\n`;
        });
        chapterStructurePrompt += `CRITICAL CONSTRAINT: The "chapters" array in your JSON response MUST contain EXACTLY ${requiredCount} chapter objects — no more, no fewer. Generating ${requiredCount + 1} or more chapters, or fewer than ${requiredCount}, is an error. Count carefully before responding.`;
    }

    const prompt = `
    You are a creative director adapting a story.
    
    ORIGINAL SUMMARY: ${analysis.summary}
    ORIGINAL TONE: ${analysis.tone}
    TARGET GENRE/STYLE: ${targetStyle}
    LANGUAGE: ${language}
    PREMISE (The Truth to be Proven): ${premise || "Infer a premise from the original story."}
    
    STYLE INSTRUCTIONS: ${bibleInstruction}${structureSection}${craftSection}
    
    Your task: Create a "Story Bible" for the new version of this story in the ${targetStyle} genre.
    ${bibleInstruction ? `Follow these genre-specific rules: ${bibleInstruction}` : ""}
    
    ${chapterStructurePrompt}

    IMPORTANT: All text in the JSON response must be in ${language}.

    For each character, you must provide:
    - new_name: A name fitting the ${targetStyle} genre.
    - role: Their dramatic role.
    - archetype: Their standard archetype (e.g. Hero, Mentor).
    - mythicArchetype: Their specific mythic role (e.g. Threshold Guardian, Shapeshifter).
    - rulingPassion: Their dominant passion (e.g. Greed, Justice).
    - theWound: A past trauma or psychological wound.
    - specialTalent: A unique skill or talent.
    - description: A rich background and personality description with inner life.
    - motivation: What drives them in this new version.
    - visual_description: A VERY detailed visual description for image generation.
    ${examplesSection}
    
    Original Data for reference:
    Characters: ${JSON.stringify(analysis.characters)}
    Settings: ${JSON.stringify(analysis.settings)}
    Beats: ${JSON.stringify(analysis.beats)}
    `;

    try {
        const { data } = await textGenerationService.generateStructured({
            project,
            prompt,
            schema: bibleSchema,
            schemaName: 'story bible',
            costMetadata: {
                task: 'generate_bible',
                stage: 'outlining',
                requestType: 'text',
                source: 'aiService.generateStoryBible'
            }
        });
        const rawJson = data;

        // ── POST-PROCESSING: enforce chapter count ────────────────────────
        if (Array.isArray(rawJson.chapters)) {
            if (isShortStory) {
                // Short story must always have exactly 1 chapter
                if (rawJson.chapters.length !== 1) {
                    console.warn(`[aiService] Short story: AI generated ${rawJson.chapters.length} chapters, truncating to 1`);
                    rawJson.chapters = rawJson.chapters.slice(0, 1);
                }
                // Enforce beat count proportional to word count
                if (rawJson.chapters.length === 1) {
                    const beats = rawJson.chapters[0].beats || [];
                    if (beats.length > shortStoryBeatCount) {
                        rawJson.chapters[0].beats = beats.slice(0, shortStoryBeatCount);
                        console.warn(`[aiService] Short story beat count truncated to ${shortStoryBeatCount}`);
                    }
                }
            } else if (initialChapterStructure && initialChapterStructure.length > 0) {
                // Multi-chapter: enforce the count the user requested
                const expectedCount = initialChapterStructure.length;
                if (rawJson.chapters.length !== expectedCount) {
                    console.warn(`[aiService] Chapter count mismatch: AI generated ${rawJson.chapters.length}, expected ${expectedCount}. Truncating.`);
                    if (rawJson.chapters.length > expectedCount) {
                        rawJson.chapters = rawJson.chapters.slice(0, expectedCount);
                    }
                    // If fewer than expected, leave as-is — better than padding with empty chapters
                }
            }
        }

        console.log("[AI_BIBLE] completed", {
            chapterCount: rawJson.chapters?.length || 0,
            topLevelBeatCount: rawJson.beats?.length || 0,
            characterCount: rawJson.characters?.length || 0,
            settingCount: rawJson.settings?.length || 0,
            isShortStory
        });

        return rawJson;
    } catch (error) {
        console.error("AI Bible Generation Error:", safeErrorForLog(error));
        throw new Error("Failed to generate story bible.");
    }
}

/**
 * Generates a concise summary of a scene's prose.
 * @param {string} content - The full prose of the scene.
 * @param {string} language - The target language.
 * @returns {Promise<string>} - The generated summary.
 */
async function generateSceneSummary(content, language = "Português Brasileiro", project = null) {
    const prompt = `
    Summarize the following scene in 2-3 concise paragraphs covering these three aspects:
    1. WHAT HAPPENED — the main actions and key plot developments.
    2. CHARACTER STATE — how characters' emotions, relationships or decisions changed as a result.
    3. UNRESOLVED — what question, tension or thread is left open for future scenes.

    The summary will be used as context when writing the next scene, so it must be specific and concrete.
    IMPORTANT: Write the summary in ${language}.
    
    SCENE PROSE:
    ${content}
    `;

    try {
        const { text } = await textGenerationService.generateText({
            project,
            prompt,
            costMetadata: {
                task: 'summarize_scene',
                stage: 'revision',
                requestType: 'text',
                source: 'aiService.generateSceneSummary'
            }
        });
        return text;
    } catch (error) {
        console.error("AI Scene Summary Error:", safeErrorForLog(error));
        throw new Error("Failed to generate scene summary.");
    }
}

/**
 * Builds the prompt string used to generate a scene so it can be previewed.
 * @param {Object} beat - The beat to write.
 * @param {Object} bible - The story bible.
 * @param {string} projectStyle - The genre/style.
 * @param {string} language - Target language.
 * @param {string} instructions - Additional instructions.
 * @param {string} previousContext - Summaries of previous scenes.
 * @param {string} projectCustomStyle - Project custom style.
 * @param {string} existingContent - Existing scene content (for revision).
 * @param {string} editorialAnalysis - Editorial analysis of the chapter.
 */
async function buildScenePrompt(beat, bible, projectStyle, language = "Português Brasileiro", instructions = "", previousContext = "", projectCustomStyle = "", existingContent = "", editorialAnalysis = "", nextContext = "", project = null, bookBrief = undefined) {
    const contextSection = previousContext ? `
    PREVIOUSLY IN THE STORY (Context from previous scenes):
    ${previousContext}
    ` : "";
    const promptBookBrief = await resolveBookBriefForPrompt(project, bookBrief);
    const bookBriefPromptContext = buildBookBriefPromptContext(promptBookBrief);
    const bookBriefSection = bookBriefPromptContext ? `
═══════════════════════════════════════════════════════════════
${bookBriefPromptContext}
═══════════════════════════════════════════════════════════════
- Treat the editorial brief as guidance and constraints for language, positioning, tone, audience, and content boundaries.
- Do not mention AI disclosure or human review status inside the story prose.
- The Story Bible, current beat, chapter context, and continuity remain the primary sources for narrative events.
` : "";

    // Short story framing — injected only when the project is a conto/short story
    const isShortStory = (project && project.isShortStory === true);
    const targetWordCount = (project && project.targetWordCount) || null;
    // Per-beat word budget: distribute total evenly so the AI knows exactly how long each scene should be
    const totalBeatsForBudget = (bible.beats || []).length || 1;
    const wordsPerBeat = (isShortStory && targetWordCount)
        ? Math.round(targetWordCount / totalBeatsForBudget)
        : null;
    const chapterTypeConfig = !isShortStory ? findChapterTypeForBeat(beat.id, bible) : null;
    const sceneWordBudget = !isShortStory
        ? resolveBeatWordBudget({
            bible,
            beat,
            chapterTypeConfig,
            defaultWordCount: CHAPTER_TYPES.NORMAL.wordCount
        })
        : null;
    const sceneWordBudgetBlock = !isShortStory && sceneWordBudget && (sceneWordBudget.min > 0 || sceneWordBudget.max > 0) ? `
═══════════════════════════════════════════════════════════════
SCENE WORD COUNT TARGET
═══════════════════════════════════════════════════════════════
- This target is for the CURRENT SCENE / BEAT, not for the whole chapter.
- Write approximately ${sceneWordBudget.min}-${sceneWordBudget.max} words for this scene.
- If this beat belongs to a chapter with multiple beats, the chapter budget has already been divided across those beats.
` : "";
    const shortStoryBlock = isShortStory ? `
═══════════════════════════════════════════════════════════════
SHORT STORY MODE — CONTINUOUS NARRATIVE
═══════════════════════════════════════════════════════════════
This is a CONTO / SHORT STORY, NOT a chapter in a novel.
- Write as a seamless, continuous narrative arc — no chapter breaks, no "end of chapter" closings.
- Every scene is part of one uninterrupted dramatic flow.${targetWordCount ? `
- The TOTAL story target is ${targetWordCount.toLocaleString('en')} words across ${totalBeatsForBudget} scenes.` : ''}${wordsPerBeat ? `
- THIS SCENE target: approximately ${wordsPerBeat} words. Do NOT exceed ${Math.round(wordsPerBeat * 1.2)} words.` : ''}
- Prioritise economy: no subplots, no redundant scenes. Every paragraph must serve the central arc.
` : "";

    // Format future context more clearly
    const futureSection = nextContext && nextContext.trim().length > 0 ? nextContext.trim() : "";

    const styleData = await getStyleInstructions(projectStyle);
    // Prefer scene-specific instructions, fall back to base/style notes so prompt isn't empty
    const sceneInstruction = (styleData && (styleData.scene || styleData.base)) || bible.style_notes || "";

    // Build craft guidelines section
    let craftGuidelines = "";
    if (styleData && styleData.craft) {
        const guidelines = [];
        if (styleData.craft.pacing) {
            guidelines.push(`- Pacing: ${styleData.craft.pacing}`);
        }
        if (styleData.craft.dialogueStyle) {
            guidelines.push(`- Dialogue: ${styleData.craft.dialogueStyle}`);
        }
        if (styleData.craft.showDontTell) {
            guidelines.push(`- Show Don't Tell: ${styleData.craft.showDontTell}`);
        }
        if (styleData.craft.sensoryFocus && styleData.craft.sensoryFocus.length > 0) {
            guidelines.push(`- Sensory Focus: ${styleData.craft.sensoryFocus.join(', ')}`);
        }
        if (guidelines.length > 0) {
            craftGuidelines = `\n\nCRAFT GUIDELINES:\n${guidelines.join('\n')}`;
        }
    }

    // Build inner life requirement
    let innerLifeSection = "\n\nINNER LIFE REQUIREMENT:\nInclude character's thoughts, emotions, memories, and physical sensations.";
    if (styleData && styleData.craft && styleData.craft.innerLifeRatio) {
        innerLifeSection += `\nAim for approximately ${Math.round(styleData.craft.innerLifeRatio * 100)}% of the text to reveal inner life.`;
    }

    // ── Narrative arc position ──────────────────────────────────────────────
    const allBeats = (bible.beats || []);
    const totalBeats = allBeats.length;
    const currentBeatIndex = totalBeats > 0 ? allBeats.findIndex(b => b.id === beat.id) : -1;
    const position = totalBeats > 1 && currentBeatIndex >= 0 ? currentBeatIndex / (totalBeats - 1) : 0.5;
    const act = position < 0.25 ? 'I' : position < 0.75 ? 'II' : 'III';
    const actGuidanceMap = {
        'I': 'ACT I — ESTABLISH: Introduce the world, voice and core conflict. Prioritise character voice, atmosphere and setting. Foreshadow what is at stake.',
        'II': 'ACT II — ESCALATE: Raise stakes, complicate relationships and deepen conflict. Characters must be tested, pushed beyond their comfort zone.',
        'III': 'ACT III — RESOLVE: Drive toward climax. Maximum tension and consequence. Characters face their defining moment; prove or disprove the story premise.'
    };
    const narrativeArcSection = `\n\nNARRATIVE POSITION (Act ${act} of III — scene ${currentBeatIndex + 1} of ${totalBeats}):\n${actGuidanceMap[act]}`;
    // ───────────────────────────────────────────────────────────────────────

    // Find chapter context
    let chapterContext = "";
    if (bible.chapters) {
        const chapter = bible.chapters.find(c => c.beats && c.beats.some(b => b.id === beat.id));
        if (chapter) {
            const mythic = chapter.mythicStage || chapter.aiSummary ? (chapter.mythicStage || 'Not specified') : 'Not specified';
            if (isShortStory) {
                // For a short story there is only 1 chapter — frame it as a continuous arc, not a chapter
                chapterContext = `
        NARRATIVE ARC CONTEXT:
        This scene is part of a single continuous short story (no chapters).
        Story Title: ${chapter.title}
        Story Intent: ${chapter.userDescription || chapter.aiSummary}
        Dramatic Stage: ${mythic}
        Total scenes in this story: ${totalBeats}
        Current scene: ${currentBeatIndex + 1} of ${totalBeats}
        Do NOT write a chapter heading, chapter number, or any chapter-level framing.
            `;
            } else {
                chapterContext = `
        CHAPTER CONTEXT:
        Chapter ${chapter.chapterNumber} of ${bible.chapters.length}: ${chapter.title} (${chapter.type})
        Chapter Intent: ${chapter.userDescription || chapter.aiSummary}
        Mythic Stage: ${mythic}
            `;
            }
        }
    }

    // If project has a custom style, include it prominently
    const customStyleSection = projectCustomStyle ? `\n\nPROJECT CUSTOM STYLE:\n${projectCustomStyle}` : "";

    // Build existing content section for revision mode
    const hasExistingContent = existingContent && existingContent.trim().length > 0;
    let existingContentSection = "";
    let editorialSection = "";
    let taskInstruction = "";

    if (hasExistingContent) {
        existingContentSection = `
    CURRENT SCENE TEXT (to revise and improve):
    ---
    ${existingContent}
    ---
        `;
        
        if (editorialAnalysis && editorialAnalysis.trim().length > 0) {
            editorialSection = `
    EDITORIAL ANALYSIS AND SUGGESTIONS:
    ${editorialAnalysis}
            `;
        }

        taskInstruction = `
    TASK:
    You are REVISING an existing scene. Rewrite and significantly improve this scene.
    ${editorialAnalysis ? 'Use the editorial analysis to guide your improvements.' : ''}
    Maintain the core events and character actions but enhance:
    - Dialogue quality and subtext
    - Sensory details and atmosphere
    - Pacing and tension
    - Character depth and inner life
    - Show don't tell
    Focus on sensory details, dialogue, and character motivation.
    Ensure the tone matches the ${projectStyle} genre.
    ${sceneInstruction ? `Special Genre Requirements: ${sceneInstruction}` : ""}
    Do not output any meta-commentary, just the improved story text.
    
    IMPORTANT: The scene must be written in ${language}.
        `;
    } else {
        taskInstruction = `
    INSTRUCTIONS:
    Write the full scene prose for this beat. 
    Focus on sensory details, dialogue, and character motivation. 
    Ensure the tone matches the ${projectStyle} genre.
    ${sceneInstruction ? `Special Genre Requirements: ${sceneInstruction}` : ""}
    Do not output any meta-commentary, just the story text.
    
    IMPORTANT: The scene must be written in ${language}.
        `;
    }

    const prompt = `
    You are a best-selling novelist ${hasExistingContent ? 'REVISING' : 'writing'} a scene for a ${projectStyle} story.
    ${bookBriefSection}
    ${shortStoryBlock}
    ${sceneWordBudgetBlock}
    STYLE INSTRUCTIONS: ${sceneInstruction}${craftGuidelines}${innerLifeSection}${narrativeArcSection}
    
    ${chapterContext}

    SCENE STRUCTURE:
    - Every scene must change either character relationships or world state
    - Include at least 3 specific sensory details per major paragraph
    - Balance dialogue with action and internal reflection

    ═══════════════════════════════════════════════════════════════
    PROJECT OVERVIEW (Complete Story Context)
    ═══════════════════════════════════════════════════════════════
    
    STORY SUMMARY:
    ${bible.summary}
    
    PREMISE (Core Dramatic Question):
    ${bible.premise || "N/A"}
    
    THE CRUCIBLE (Central Conflict/Pressure):
    ${bible.theCrucible || "N/A"}
    
    MAIN CHARACTERS:
    ${bible.characters.map(c => {
        const details = [];
        details.push(`${c.name} (${c.role})`);
        details.push(`  Description: ${c.description}`);
        if (c.motivation) details.push(`  Motivation: ${c.motivation}`);
        if (c.archetype) details.push(`  Archetype: ${c.archetype}`);
        if (c.rulingPassion) details.push(`  Ruling Passion: ${c.rulingPassion}`);
        if (c.theWound) details.push(`  The Wound: ${c.theWound}`);
        return details.join('\n');
    }).join('\n\n')}
    
    SETTINGS:
    ${bible.settings.map(s => `${s.name}: ${s.description}${s.atmosphere ? ` (Atmosphere: ${s.atmosphere})` : ''}`).join('\n')}

    ═══════════════════════════════════════════════════════════════
    NARRATIVE FLOW & CONTEXT
    ═══════════════════════════════════════════════════════════════
    ${contextSection}
    
    ▼▼▼ CURRENT SCENE (Beat #${beat.id}) ▼▼▼
    Title: ${beat.title}
    Description: ${beat.description}
    ${beat.visualDescription ? `Visual Description: ${beat.visualDescription}` : ''}
    
    ${futureSection ? `═══════════════════════════════════════════════════════════════
    ⚠️ UPCOMING EVENTS (Guide narrative towards these developments)
    ═══════════════════════════════════════════════════════════════
    ${futureSection.replace('UPCOMING EVENTS (What happens next - guide the narrative towards these):', '').trim()}
    ` : ''}
    ${customStyleSection}
    ${existingContentSection}
    ${editorialSection}

    ADDITIONAL INSTRUCTIONS:
    ${instructions}
    ${taskInstruction}
    `;

    return prompt;
}


/**
 * Generates the prose for a specific scene based on the beat and bible context.
 * @param {Object} beat - The specific beat to write.
 * @param {Object} bible - The full story bible (context).
 * @param {string} projectStyle - The genre/style.
 * @param {string} language - The target language.
 * @param {string} instructions - Optional customization.
 * @param {string} previousContext - Summaries of previous scenes.
 * @param {string} projectCustomStyle - Project custom style override.
 * @param {string} existingContent - Existing scene content (for revision).
 * @param {string} editorialAnalysis - Editorial analysis of the chapter.
 * @returns {Promise<string>} - The generated scene content.
 */
async function generateScene(beat, bible, projectStyle, language = "Português Brasileiro", instructions = "", previousContext = "", projectCustomStyle = "", existingContent = "", editorialAnalysis = "", nextContext = "", project = null, bookBrief = undefined) {
    // Build the prompt using the helper so both generation and preview can reuse it
    // Note: bible may include project-level data in bible.style_notes; if caller passes projectCustomStyle, include it.
    const customStyle = projectCustomStyle || bible.customStyle || "";
    const prompt = await buildScenePrompt(beat, bible, projectStyle, language, instructions, previousContext, customStyle, existingContent, editorialAnalysis, nextContext, project, bookBrief);

    try {
        const { text } = await textGenerationService.generateText({
            project,
            prompt,
            costMetadata: {
                task: 'generate_scene',
                stage: 'drafting',
                requestType: 'text',
                source: 'aiService.generateScene',
                beatId: beat?.id
            }
        });

        // ── Word count enforcement ──────────────────────────────────────────
        const isShortStoryProject = project && project.isShortStory === true;
        const projectTargetWordCount = project && project.targetWordCount;

        if (isShortStoryProject && projectTargetWordCount) {
            // Short story: enforce per-beat budget — do NOT use chapter type minimums
            const beatCount = (bible.beats || []).length || 1;
            const perBeatTarget = Math.round(projectTargetWordCount / beatCount);
            const perBeatMin = Math.round(perBeatTarget * 0.6);
            const perBeatMax = Math.round(perBeatTarget * 1.3);
            const wordCount = countWords(text);
            if (wordCount > perBeatMax) {
                console.warn(`[SCENE] Short story beat ${beat.id}: ${wordCount} words generated, target ~${perBeatTarget} (max ${perBeatMax}). Scene is too long.`);
            } else if (wordCount < perBeatMin) {
                const deficit = perBeatTarget - wordCount;
                console.warn(`[SCENE] Short story beat ${beat.id}: ${wordCount} words generated, target ~${perBeatTarget}. Requesting continuation (~${deficit} words).`);
                const continuationPrompt = `Continue a cena a seguir sem repetir o que já foi escrito. Adicione aproximadamente ${deficit} palavras que fluam naturalmente do final do texto. Escreva em ${language}. Não adicione comentários ou explicações — apenas o texto narrativo.\n\nFIM DA CENA ATÉ AGORA:\n${text}`;
                try {
                    const { text: continuation } = await textGenerationService.generateText({
                        project,
                        prompt: continuationPrompt,
                        costMetadata: {
                            task: 'generate_scene',
                            stage: 'drafting',
                            requestType: 'text',
                            source: 'aiService.generateScene.continuation',
                            beatId: beat?.id
                        }
                    });
                    console.log(`[SCENE] Short story beat ${beat.id}: continuation added ${countWords(continuation)} words.`);
                    return text + '\n\n' + continuation;
                } catch (contErr) {
                    console.warn(`[SCENE] Short story beat ${beat.id}: continuation failed — returning original.`, safeErrorForLog(contErr));
                }
            }
        } else {
            // Multi-chapter novel: enforce the per-beat share of the chapter type budget.
            const chapterTypeConfig = findChapterTypeForBeat(beat.id, bible);
            const sceneWordBudget = resolveBeatWordBudget({
                bible,
                beat,
                chapterTypeConfig,
                defaultWordCount: CHAPTER_TYPES.NORMAL.wordCount
            });
            if (sceneWordBudget.min > 0) {
                const wordCount = countWords(text);
                const minTarget = sceneWordBudget.min;
                if (wordCount < minTarget * 0.8) {
                    const deficit = Math.round(minTarget - wordCount);
                    console.warn(`[SCENE] Beat ${beat.id}: ${wordCount} words generated, scene target min=${minTarget}. Requesting continuation (~${deficit} words).`);
                    const continuationPrompt = `Continue a cena a seguir sem repetir o que já foi escrito. Adicione aproximadamente ${deficit} palavras que fluam naturalmente do final do texto. Escreva em ${language}. Não adicione comentários ou explicações — apenas o texto narrativo.\n\nFIM DA CENA ATÉ AGORA:\n${text}`;
                    try {
                        const { text: continuation } = await textGenerationService.generateText({
                            project,
                            prompt: continuationPrompt,
                            costMetadata: {
                                task: 'generate_scene',
                                stage: 'drafting',
                                requestType: 'text',
                                source: 'aiService.generateScene.continuation',
                                beatId: beat?.id
                            }
                        });
                        console.log(`[SCENE] Beat ${beat.id}: continuation added ${countWords(continuation)} words.`);
                        return text + '\n\n' + continuation;
                    } catch (contErr) {
                        console.warn(`[SCENE] Beat ${beat.id}: continuation failed — returning original.`, safeErrorForLog(contErr));
                    }
                }
            }
        }
        // ───────────────────────────────────────────────────────────────────

        return text;
    } catch (error) {
        console.error("AI Scene Generation Error:", safeErrorForLog(error));
        throw new Error("Failed to generate scene.");
    }
}

/**
 * Generates a detailed character background.
 * @param {Object} character - The character object.
 * @param {string} storyText - The original story text.
 * @param {string} projectStyle - The target style.
 * @param {string} userPrompt - Additional user input.
 * @returns {Promise<string>}
 */
async function generateCharacterBackground(character, storyText, projectStyle, userPrompt, project = null) {
    const styleData = await getStyleInstructions(projectStyle);
    const characterInstruction = styleData ? styleData.character : "";

    // Build craft guidelines for character depth
    let craftGuidelines = "";
    if (styleData && styleData.craft && styleData.craft.characterDepth) {
        craftGuidelines = `\n\nCHARACTER DEPTH GUIDELINES:\n${styleData.craft.characterDepth}`;
    }

    const prompt = `
    You are a character designer and writer. 
    Your goal is to expand on a character's description and background and create a detailed visual description for a story in the ${projectStyle} genre.
    STYLE INSTRUCTIONS: ${characterInstruction}${craftGuidelines}
    
    ORIGINAL STORY CONTEXT (Excerpts):
    ${storyText.substring(0, 20000)}
    
    CHARACTER INFO:
    Name: ${character.name}
    Role: ${character.role}
    Current Description: ${character.description}
    Motivation: ${character.motivation}
    
    USER'S ADDITIONAL REQUEST/PROMPT:
    ${userPrompt}
    
    TASK:
    1. Generate a more complete and rich background for this character ("background"). 
       Include details about their past, their personality, and how they fit into the ${projectStyle} world.
    2. Generate a very detailed visual description ("visual_description") that can be used for image generation.
       Include size, body type, facial features, clothes, accessories, color palette, and any unique visual traits or equipment.
       Be extremely specific about their costume and appearance to ensure consistency.

    The response must be in JSON format matching the schema.
    `;

    try {
        const { data } = await textGenerationService.generateStructured({
            project,
            prompt,
            schema: characterBackgroundSchema,
            schemaName: 'character background',
            costMetadata: {
                task: 'generate_bible',
                stage: 'outlining',
                requestType: 'text',
                source: 'aiService.generateCharacterBackground'
            }
        });
        return data;
    } catch (error) {
        console.error("AI Character Background Error:", safeErrorForLog(error));
        throw new Error("Failed to generate character background.");
    }
}

/**
 * Generates a detailed location description.
 * @param {Object} location - The location object.
 * @param {string} storyText - The original story text.
 * @param {string} projectStyle - The target style.
 * @param {string} userPrompt - Additional user input.
 * @returns {Promise<string>}
 */
async function generateLocationBackground(location, storyText, projectStyle, userPrompt, project = null) {
    const styleData = await getStyleInstructions(projectStyle);
    const locationInstruction = styleData ? styleData.location : "";

    // Build sensory focus guidelines
    let sensoryGuidelines = "";
    if (styleData && styleData.craft && styleData.craft.sensoryFocus && styleData.craft.sensoryFocus.length > 0) {
        sensoryGuidelines = `\n\nSENSORY FOCUS:\nEmphasize these sensory elements: ${styleData.craft.sensoryFocus.join(', ')}`;
    }

    const prompt = `
    You are a world builder and environment artist. 
    Your goal is to expand on a location's description and create a detailed visual description for a story in the ${projectStyle} genre.
    STYLE INSTRUCTIONS: ${locationInstruction}${sensoryGuidelines}
    
    ORIGINAL STORY CONTEXT (Excerpts):
    ${storyText.substring(0, 20000)}
    
    LOCATION INFO:
    Name: ${location.name}
    Current Description: ${location.description}
    Atmosphere: ${location.atmosphere}
    
    USER'S ADDITIONAL REQUEST/PROMPT:
    ${userPrompt}
    
    TASK:
    1. Generate a richer description for this location ("description"). 
       Include details about its history, sensory details (smell, sound), and atmosphere in the ${projectStyle} world.
    2. Generate a very detailed visual description ("visual_description") that can be used for image generation.
       Include lighting, colors, specific objects, architecture style, weather, and composition.
       
    The response must be in JSON format matching the schema.
    `;

    try {
        const { data } = await textGenerationService.generateStructured({
            project,
            prompt,
            schema: locationBackgroundSchema,
            schemaName: 'location background',
            costMetadata: {
                task: 'generate_bible',
                stage: 'outlining',
                requestType: 'text',
                source: 'aiService.generateLocationBackground'
            }
        });
        return data;
    } catch (error) {
        console.error("AI Location Background Error:", safeErrorForLog(error));
        throw new Error("Failed to generate location background.");
    }
}

const beatBackgroundSchema = {
    type: "object",
    properties: {
        description: { type: "string" },
        visual_description: { type: "string" }
    },
    required: ["description", "visual_description"]
};

/**
 * Generates detailed beat description and visual description.
 * @param {Object} beat - The beat object.
 * @param {string} storyText - The original story text.
 * @param {string} projectStyle - The target style.
 * @param {string} userPrompt - Additional user input.
 * @returns {Promise<string>}
 */
async function generateBeatDetails(beat, storyText, projectStyle, userPrompt, project = null) {
    const styleData = await getStyleInstructions(projectStyle);
    const beatInstruction = styleData ? styleData.beat : "";

    // Build structure guidelines
    let structureGuidelines = "";
    if (styleData && styleData.structure) {
        const guidelines = [];
        if (styleData.structure.jeopardyProgression) {
            guidelines.push(`Jeopardy Progression: ${styleData.structure.jeopardyProgression}`);
        }
        if (guidelines.length > 0) {
            structureGuidelines = `\n\nSTRUCTURE GUIDELINES:\n${guidelines.join('\n')}`;
        }
    }

    const prompt = `
    You are a story architect and visual director. 
    Your goal is to expand on a narrative beat's description to make it more compelling and create a detailed visual description for a scene in the ${projectStyle} genre.
    STYLE INSTRUCTIONS: ${beatInstruction}${structureGuidelines}
    
    ORIGINAL STORY CONTEXT (Excerpts):
    ${storyText.substring(0, 20000)}
    
    BEAT INFO:
    Title: ${beat.title}
    Current Description: ${beat.description}
    
    USER'S ADDITIONAL REQUEST/PROMPT:
    ${userPrompt}
    
    TASK:
    1. Generate a richer, more detailed description for this beat ("description"). 
       Focus on the dramatic conflict, emotional definition, and key actions.
    2. Generate a very detailed visual description ("visual_description") that can be used for image generation (concept art).
       Include composition, lighting, key elements, mood, and color palette.
       
    The response must be in JSON format matching the schema.
    `;

    try {
        const { data } = await textGenerationService.generateStructured({
            project,
            prompt,
            schema: beatBackgroundSchema,
            schemaName: 'beat details',
            costMetadata: {
                task: 'generate_bible',
                stage: 'outlining',
                requestType: 'text',
                source: 'aiService.generateBeatDetails',
                beatId: beat?.id
            }
        });
        return data;
    } catch (error) {
        console.error("AI Beat Details Error:", safeErrorForLog(error));
        throw new Error("Failed to generate beat details.");
    }
}

async function analyzeChapter(chapterData, bibleData, styleData, language = "Português Brasileiro", project = null) {
    // Build style context
    let styleContext = "";
    if (styleData) {
        styleContext = `\n\nESTILO NARRATIVO: ${styleData.name || 'N/A'}\n`;
        if (styleData.instruction) {
            styleContext += `Instruções: ${styleData.instruction}\n`;
        }
        if (styleData.craftPrinciples) {
            styleContext += `\nPrincípios de Escrita:\n${JSON.stringify(styleData.craftPrinciples, null, 2)}\n`;
        }
        if (styleData.structureRules) {
            styleContext += `\nRegras de Estrutura:\n${JSON.stringify(styleData.structureRules, null, 2)}\n`;
        }
    }

    // Build bible context
    let bibleContext = "";
    if (bibleData) {
        bibleContext = `\n\nBÍBLIA DO PROJETO:\n`;
        if (bibleData.summary) {
            bibleContext += `Resumo: ${bibleData.summary}\n`;
        }
        if (bibleData.premise) {
            bibleContext += `Premissa: ${bibleData.premise}\n`;
        }
        if (bibleData.theCrucible) {
            bibleContext += `O Cadinho: ${bibleData.theCrucible}\n`;
        }
        if (bibleData.characters && bibleData.characters.length > 0) {
            bibleContext += `\nPersonagens:\n${bibleData.characters.map(c => `- ${c.name}: ${c.role} (${c.archetype})${c.background ? ' - ' + c.background : ''}`).join('\n')}\n`;
        }
        if (bibleData.settings && bibleData.settings.length > 0) {
            bibleContext += `\nLocalizações:\n${bibleData.settings.map(s => `- ${s.name} (${s.type}): ${s.description}`).join('\n')}\n`;
        }
    }

    // Build chapter content
    let chapterContent = `\n\nCAPÍTULO ${chapterData.chapterNumber}: ${chapterData.title}\n`;
    if (chapterData.type) {
        chapterContent += `Tipo: ${chapterData.type}\n`;
    }
    if (chapterData.aiSummary) {
        chapterContent += `Resumo: ${chapterData.aiSummary}\n`;
    }
    if (chapterData.beats && chapterData.beats.length > 0) {
        chapterContent += `\nBeats (${chapterData.beats.length}):\n`;
        chapterData.beats.forEach((beat, idx) => {
            chapterContent += `\n${idx + 1}. Beat #${beat.id} - ${beat.title}${beat.type ? ` (${beat.type})` : ''}\n`;
            if (beat.description) {
                chapterContent += `   ${beat.description}\n`;
            }
            if (beat.enhanced_description) {
                chapterContent += `   Descrição Aprimorada: ${beat.enhanced_description}\n`;
            }
        });
    }

    const prompt = `Você é um editor experiente e analista de narrativas. Analise o capítulo fornecido considerando o estilo narrativo e a bíblia do projeto.

${styleContext}${bibleContext}${chapterContent}

CRIE UM RELATÓRIO EDITORIAL DETALHADO COM:

1. **ANÁLISE GERAL DO CAPÍTULO**
   - Função narrativa deste capítulo na história geral
   - Como ele serve à premissa e ao conflito central (o cadinho)
   - Avaliação do ritmo e estrutura

2. **ANÁLISE DE BEATS**
   - Avalie cada beat individualmente
   - Identifique beats fortes e fracos
   - Verifique se há progressão dramática clara
   - Analise se os beats seguem os princípios do estilo narrativo definido

3. **COERÊNCIA COM A BÍBLIA**
   - Os personagens estão agindo de acordo com seus arquétipos e características?
   - As localizações são usadas apropriadamente?
   - Há consistência com a premissa e tema?

4. **APLICAÇÃO DO ESTILO NARRATIVO**
   - O capítulo segue as regras de estrutura definidas?
   - Os princípios de escrita estão sendo aplicados?
   - Há desvios ou oportunidades de melhor alinhamento?

5. **PONTOS FORTES**
   - Liste os aspectos mais eficazes do capítulo
   - Momentos de maior impacto dramático

6. **PONTOS DE MELHORIA**
   - Problemas estruturais ou narrativos
   - Beats que precisam de desenvolvimento
   - Inconsistências ou buracos

7. **SUGESTÕES ESPECÍFICAS**
   - Recomendações concretas para melhorar beats específicos
   - Ideias para aumentar tensão ou conflito
   - Sugestões de novos elementos ou reviravoltas

8. **IDEIAS CRIATIVAS**
   - Possibilidades ainda não exploradas
   - Conexões que podem ser fortalecidas
   - Elementos que podem enriquecer o capítulo

Responda em ${language} de forma detalhada e construtiva. Use markdown para formatação (use ## para títulos, **negrito** para ênfase, listas com - ou números).`;

    try {
        const { text } = await textGenerationService.generateText({
            project,
            prompt,
            options: {
                temperature: 0.7,
                topP: 0.9,
                topK: 40
            },
            costMetadata: {
                task: 'analyze_project',
                stage: 'analysis',
                requestType: 'text',
                source: 'aiService.analyzeChapter',
                chapterNumber: chapterData?.chapterNumber
            }
        });
        return text;
    } catch (error) {
        console.error("AI Chapter Analysis Error:", safeErrorForLog(error));
        throw new Error(`Failed to analyze chapter: ${error.message}`);
    }
}

module.exports = {
    readTextFile,
    analyzeStoryStructure,
    generateStoryBible,
    generateScene,
    buildScenePrompt,
    generateSceneSummary,
    generateCharacterBackground,
    generateLocationBackground,
    generateBeatDetails,
    analyzeChapter,
    buildLayeredContext,
    findChapterTypeForBeat,
    countWords
};
