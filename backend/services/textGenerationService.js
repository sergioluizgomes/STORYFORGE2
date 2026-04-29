const Ajv = require('ajv');
const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const {
    GEMINI_PROVIDER,
    LM_STUDIO_PROVIDER,
    getLmStudioBaseUrl,
    getProviderDefaultModel,
    resolveTextGenerationConfig
} = require('./textModelConfig');

const ajv = new Ajv({ allErrors: true, strict: false });
let geminiClient;

function getGeminiClient() {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is missing in backend .env file');
    }

    if (!geminiClient) {
        geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }

    return geminiClient;
}

function getLmStudioClient() {
    return new OpenAI({
        baseURL: getLmStudioBaseUrl(),
        apiKey: process.env.LM_STUDIO_API_KEY || 'lm-studio'
    });
}

function robustParse(data) {
    if (!data) return data;

    if (typeof data === 'string') {
        const trimmed = data.trim();
        if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
            try {
                return robustParse(JSON.parse(trimmed));
            } catch (error) {
                return data;
            }
        }
    }

    if (Array.isArray(data)) {
        return data.map(item => robustParse(item));
    }

    if (typeof data === 'object') {
        const parsed = {};
        for (const [key, value] of Object.entries(data)) {
            parsed[key] = robustParse(value);
        }
        return parsed;
    }

    return data;
}

function normalizeTextContent(content) {
    if (!content) return '';
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
        return content
            .map(item => {
                if (typeof item === 'string') return item;
                if (item?.type === 'text') return item.text || '';
                return '';
            })
            .join('');
    }

    return String(content);
}

function extractJsonPayload(text) {
    const trimmed = text.trim();
    if (!trimmed) {
        throw new Error('Model returned an empty response.');
    }

    const directCandidates = [trimmed];
    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenceMatch?.[1]) {
        directCandidates.unshift(fenceMatch[1].trim());
    }

    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
        directCandidates.push(trimmed.slice(firstBrace, lastBrace + 1));
    }

    const firstBracket = trimmed.indexOf('[');
    const lastBracket = trimmed.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket > firstBracket) {
        directCandidates.push(trimmed.slice(firstBracket, lastBracket + 1));
    }

    for (const candidate of directCandidates) {
        try {
            return robustParse(JSON.parse(candidate));
        } catch (error) {
            // Try the next candidate.
        }
    }

    throw new Error('Model returned invalid JSON.');
}

function validateStructuredResponse(schema, data) {
    const validate = ajv.compile(schema);
    const valid = validate(data);

    if (valid) {
        return { valid: true, errors: [] };
    }

    const errors = (validate.errors || []).map(error => {
        const location = error.instancePath || error.schemaPath || '/';
        return `${location} ${error.message}`.trim();
    });

    return { valid: false, errors };
}

function buildStructuredPrompt(prompt, schema, schemaName, validationErrors) {
    const correctionBlock = validationErrors?.length
        ? `\n\nPREVIOUS RESPONSE ERRORS:\n- ${validationErrors.join('\n- ')}`
        : '';

    return `${prompt}

RESPONSE FORMAT REQUIREMENTS:
- Return exactly one valid JSON object and nothing else.
- Do not wrap the JSON in markdown fences.
- Keep property names exactly as defined.
- Ensure every required field is present.
${correctionBlock}

TARGET SCHEMA (${schemaName || 'response'}):
${JSON.stringify(schema, null, 2)}`;
}

function buildProviderError(config, error) {
    if (config.provider === LM_STUDIO_PROVIDER) {
        if (error.code === 'ECONNREFUSED' || /ECONNREFUSED|fetch failed|connect ECONNREFUSED/i.test(error.message)) {
            return new Error(`LM Studio is unavailable at ${config.baseUrl}. Start the local server and load a model before generating text.`);
        }

        if (/model/i.test(error.message) && /not found|does not exist/i.test(error.message)) {
            return new Error(`The LM Studio model "${config.model}" is not available. Load the model in LM Studio or choose another one.`);
        }
    }

    return error;
}

function getResolvedModelOrThrow(config) {
    const resolvedModel = config.model || getProviderDefaultModel(config.provider);
    if (resolvedModel) {
        return resolvedModel;
    }

    if (config.provider === LM_STUDIO_PROVIDER) {
        throw new Error('No LM Studio model is configured. Select a model in the project settings or set LM_STUDIO_DEFAULT_MODEL/TEXT_AI_MODEL in the backend environment.');
    }

    throw new Error(`No model is configured for provider ${config.provider}.`);
}

async function generateGeminiText(modelName, prompt, options = {}) {
    const model = getGeminiClient().getGenerativeModel({
        model: modelName,
        generationConfig: {
            temperature: options.temperature,
            topP: options.topP,
            topK: options.topK
        }
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
}

async function generateGeminiStructured(modelName, prompt, schema, options = {}) {
    const model = getGeminiClient().getGenerativeModel({
        model: modelName,
        generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: schema,
            temperature: options.temperature,
            topP: options.topP,
            topK: options.topK
        }
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return extractJsonPayload(response.text());
}

async function generateLmStudioCompletion(modelName, prompt, options = {}, useJsonMode = false) {
    const client = getLmStudioClient();

    try {
        const completion = await client.chat.completions.create({
            model: modelName,
            messages: [
                {
                    role: 'system',
                    content: useJsonMode
                        ? 'You are a careful JSON generator. Reply only with valid JSON matching the requested schema.'
                        : 'You are a careful writing assistant. Reply directly to the user request.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: options.temperature,
            top_p: options.topP,
            response_format: useJsonMode ? { type: 'json_object' } : undefined
        });

        return normalizeTextContent(completion.choices?.[0]?.message?.content);
    } catch (error) {
        if (useJsonMode && /response_format|json_object|not supported|unsupported/i.test(error.message || '')) {
            const fallbackCompletion = await client.chat.completions.create({
                model: modelName,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a careful JSON generator. Reply only with valid JSON matching the requested schema.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: options.temperature,
                top_p: options.topP
            });

            return normalizeTextContent(fallbackCompletion.choices?.[0]?.message?.content);
        }

        throw error;
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function generateStructuredWithRetry(config, prompt, schema, schemaName, options = {}) {
    const maxAttempts = config.provider === LM_STUDIO_PROVIDER ? 3 : 2;
    let validationErrors = [];
    let lastError;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        if (attempt > 0) {
            const backoffMs = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
            console.log(`[TEXT AI] structured retry ${attempt}/${maxAttempts - 1} — waiting ${backoffMs}ms`);
            await sleep(backoffMs);
        }

        try {
            const structuredPrompt = buildStructuredPrompt(prompt, schema, schemaName, validationErrors);
            const rawData = config.provider === GEMINI_PROVIDER
                ? await generateGeminiStructured(config.model, structuredPrompt, schema, options)
                : extractJsonPayload(await generateLmStudioCompletion(config.model, structuredPrompt, options, true));

            const validation = validateStructuredResponse(schema, rawData);
            if (validation.valid) {
                return rawData;
            }

            validationErrors = validation.errors;
            lastError = new Error(`Structured response validation failed: ${validation.errors.join('; ')}`);
        } catch (error) {
            lastError = error;
            validationErrors = [error.message];
        }
    }

    throw lastError;
}

async function generateTextWithRetry(config, model, prompt, options = {}) {
    const maxAttempts = 2;
    let lastError;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        if (attempt > 0) {
            const backoffMs = Math.pow(2, attempt - 1) * 1000;
            console.log(`[TEXT AI] text retry ${attempt}/${maxAttempts - 1} — waiting ${backoffMs}ms`);
            await sleep(backoffMs);
        }

        try {
            return config.provider === GEMINI_PROVIDER
                ? await generateGeminiText(model, prompt, options)
                : await generateLmStudioCompletion(model, prompt, options, false);
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError;
}

async function generateText({ project, prompt, options = {} }) {
    const config = resolveTextGenerationConfig(project);
    const startedAt = Date.now();

    try {
        const model = getResolvedModelOrThrow(config);
        const text = await generateTextWithRetry(config, model, prompt, options);

        console.log(`[TEXT AI] mode=text provider=${config.provider} model=${model} durationMs=${Date.now() - startedAt}`);
        return { text, config: { ...config, model } };
    } catch (error) {
        console.error(`[TEXT AI] mode=text provider=${config.provider} model=${config.model || 'default'} failed`, error);
        throw buildProviderError(config, error);
    }
}

async function generateStructured({ project, prompt, schema, schemaName, options = {} }) {
    const config = resolveTextGenerationConfig(project);
    const startedAt = Date.now();

    try {
        const model = getResolvedModelOrThrow(config);
        const data = await generateStructuredWithRetry({ ...config, model }, prompt, schema, schemaName, options);
        console.log(`[TEXT AI] mode=structured provider=${config.provider} model=${model} durationMs=${Date.now() - startedAt}`);
        return { data, config: { ...config, model } };
    } catch (error) {
        console.error(`[TEXT AI] mode=structured provider=${config.provider} model=${config.model || 'default'} failed`, error);
        throw buildProviderError(config, error);
    }
}

async function listProviderModels(provider) {
    if (provider === GEMINI_PROVIDER) {
        return [
            {
                id: getProviderDefaultModel(GEMINI_PROVIDER),
                label: 'Gemini Flash Lite',
                provider: GEMINI_PROVIDER,
                source: 'static'
            },
            {
                id: 'gemini-2.5-flash',
                label: 'Gemini 2.5 Flash',
                provider: GEMINI_PROVIDER,
                source: 'static'
            }
        ];
    }

    if (provider === LM_STUDIO_PROVIDER) {
        try {
            const client = getLmStudioClient();
            const result = await client.models.list();

            return (result.data || []).map(model => ({
                id: model.id,
                label: model.id,
                provider: LM_STUDIO_PROVIDER,
                source: 'lm-studio'
            }));
        } catch (error) {
            throw buildProviderError({
                provider: LM_STUDIO_PROVIDER,
                model: getProviderDefaultModel(LM_STUDIO_PROVIDER),
                baseUrl: getLmStudioBaseUrl()
            }, error);
        }
    }

    throw new Error(`Unsupported provider: ${provider}`);
}

module.exports = {
    generateText,
    generateStructured,
    listProviderModels
};