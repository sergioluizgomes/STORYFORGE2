const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const path = require('path');
const { safeErrorForLog } = require('../utils/safeLog');
const { recordCostEntrySafe } = require('./costLedgerService');
// const mime = require('mime'); // Removed due to compatibility issues

let ai;

function getImageClient() {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is missing in backend .env file");
    }

    if (!ai) {
        ai = new GoogleGenAI({
            apiKey: process.env.GEMINI_API_KEY,
        });
    }

    return ai;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Saves a buffer to a file in the uploads directory
 * @param {string} fileName 
 * @param {Buffer} content 
 */
function saveBinaryFile(fileName, content) {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }
    const filePath = path.join(uploadDir, fileName);
    fs.writeFileSync(filePath, content);
    console.log(`File ${fileName} saved to ${filePath}`);
    return `/uploads/${fileName}`; // Return relative path for frontend
}

/**
 * Generates an image based on the prompt using Gemini
 * @param {string} prompt 
 * @param {string} stylePrompt - Optional style description to append
 * @param {string} aspectRatio
 * @returns {Promise<string>} public url of the generated image
 */
async function generateCharacterImage(prompt, stylePrompt = "", aspectRatio = '9:16', costMetadata = {}) {
    const config = {
        responseModalities: [
            'IMAGE',
            'TEXT',
        ],
        imageConfig: {
            aspectRatio,
            imageSize: '1K',
        },
    };
    const targetModel = 'gemini-3.1-flash-image-preview';

    const fullPrompt = stylePrompt ? `${prompt}. Style: ${stylePrompt}` : prompt;

    const maxAttempts = 3;
    let lastError;
    const startedAt = Date.now();

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const contents = [
                {
                    role: 'user',
                    parts: [{ text: fullPrompt }]
                }
            ];

            console.log(`[IMAGE_AI] generation_started`, {
                attempt,
                maxAttempts,
                model: targetModel,
                aspectRatio,
                promptLength: fullPrompt.length
            });

            const response = await getImageClient().models.generateContentStream({
                model: targetModel,
                config,
                contents,
            });

            let savedFilePath = null;
            let fileIndex = Date.now();

            for await (const chunk of response) {
                const parts = chunk.candidates?.[0]?.content?.parts || [];
                for (const part of parts) {
                    // Skip thought parts; only handle actual image output
                    if (part.thought) continue;
                    if (part.inlineData?.mimeType?.startsWith('image/')) {
                        const inlineData = part.inlineData;
                        const mimeToExt = {
                            'image/png': 'png',
                            'image/jpeg': 'jpg',
                            'image/webp': 'webp'
                        };
                        const fileExtension = mimeToExt[inlineData.mimeType] || 'png';
                        const fileName = `gen_${fileIndex}.${fileExtension}`;

                        const buffer = Buffer.from(inlineData.data, 'base64');
                        savedFilePath = saveBinaryFile(fileName, buffer);
                        break;
                    }
                }
                if (savedFilePath) break;
            }

            if (!savedFilePath) {
                throw new Error("No image data received from Gemini.");
            }

            recordCostEntrySafe({
                projectId: costMetadata.projectId,
                task: costMetadata.task || 'generate_image',
                stage: costMetadata.stage || 'image',
                provider: 'gemini',
                model: targetModel,
                requestType: 'image',
                status: 'success',
                durationMs: Date.now() - startedAt,
                metadata: {
                    source: costMetadata.source || 'imageService.generateCharacterImage',
                    aspectRatio,
                    attempt
                }
            });
            return savedFilePath;

        } catch (error) {
            lastError = error;
            if (attempt < maxAttempts) {
                const waitMs = Math.pow(2, attempt - 1) * 1500; // 1.5s, 3s
                console.warn(`[IMAGE_AI] generation_retry`, {
                    attempt,
                    waitMs,
                    error: safeErrorForLog(error)
                });
                await sleep(waitMs);
            }
        }
    }

    console.error("Image Generation Error (all attempts exhausted):", safeErrorForLog(lastError));
    recordCostEntrySafe({
        projectId: costMetadata.projectId,
        task: costMetadata.task || 'generate_image',
        stage: costMetadata.stage || 'image',
        provider: 'gemini',
        model: targetModel,
        requestType: 'image',
        status: 'error',
        durationMs: Date.now() - startedAt,
        metadata: {
            source: costMetadata.source || 'imageService.generateCharacterImage',
            aspectRatio
        },
        errorSummary: lastError?.message
    });
    throw lastError;
}

/**
 * Like generateCharacterImage but returns null on failure instead of throwing.
 * Use in automation pipelines where image generation is best-effort.
 * @returns {Promise<string|null>}
 */
async function generateCharacterImageSafe(prompt, stylePrompt = "", aspectRatio = '9:16', costMetadata = {}) {
    try {
        return await generateCharacterImage(prompt, stylePrompt, aspectRatio, costMetadata);
    } catch (error) {
        console.warn(`[imageService] Image generation skipped after retries`, safeErrorForLog(error));
        return null;
    }
}

module.exports = {
    generateCharacterImage,
    generateCharacterImageSafe
};
