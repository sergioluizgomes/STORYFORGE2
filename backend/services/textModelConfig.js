const GEMINI_PROVIDER = 'gemini';
const LM_STUDIO_PROVIDER = 'lm-studio';

function normalizeProvider(provider) {
    if (!provider) return null;

    const normalized = String(provider).trim().toLowerCase();
    if ([GEMINI_PROVIDER, 'google', 'google-gemini'].includes(normalized)) {
        return GEMINI_PROVIDER;
    }
    if ([LM_STUDIO_PROVIDER, 'lmstudio', 'lm_studio'].includes(normalized)) {
        return LM_STUDIO_PROVIDER;
    }

    return null;
}

function getLmStudioBaseUrl() {
    return process.env.LM_STUDIO_BASE_URL || 'http://127.0.0.1:1234/v1';
}

function getProviderDefaultModel(provider) {
    switch (provider) {
        case LM_STUDIO_PROVIDER:
            return process.env.LM_STUDIO_DEFAULT_MODEL || process.env.TEXT_AI_MODEL || '';
        case GEMINI_PROVIDER:
        default:
            return process.env.GEMINI_TEXT_MODEL || 'gemini-flash-lite-latest';
    }
}

function getGlobalTextDefaults() {
    const provider = normalizeProvider(process.env.TEXT_AI_PROVIDER) || GEMINI_PROVIDER;
    const configuredModel = process.env.TEXT_AI_MODEL && process.env.TEXT_AI_MODEL.trim();

    return {
        provider,
        model: configuredModel || getProviderDefaultModel(provider),
        baseUrl: provider === LM_STUDIO_PROVIDER ? getLmStudioBaseUrl() : null
    };
}

function resolveTextGenerationConfig(project) {
    const globalDefaults = getGlobalTextDefaults();
    const projectProvider = normalizeProvider(project?.aiProvider);
    const projectModel = typeof project?.aiModel === 'string' && project.aiModel.trim()
        ? project.aiModel.trim()
        : null;

    const provider = projectProvider || globalDefaults.provider;
    const model = projectModel
        || (provider === globalDefaults.provider ? globalDefaults.model : getProviderDefaultModel(provider));

    return {
        provider,
        model,
        baseUrl: provider === LM_STUDIO_PROVIDER ? getLmStudioBaseUrl() : null,
        inherited: !projectProvider && !projectModel,
        source: !projectProvider && !projectModel ? 'global' : 'project'
    };
}

function listTextProviders() {
    return [
        {
            id: GEMINI_PROVIDER,
            label: 'Google Gemini',
            description: 'Cloud provider with native structured JSON support.',
            defaultModel: getProviderDefaultModel(GEMINI_PROVIDER),
            configured: Boolean(process.env.GEMINI_API_KEY),
            local: false
        },
        {
            id: LM_STUDIO_PROVIDER,
            label: 'LM Studio',
            description: 'Local OpenAI-compatible provider for text generation.',
            defaultModel: getProviderDefaultModel(LM_STUDIO_PROVIDER),
            configured: true,
            local: true,
            baseUrl: getLmStudioBaseUrl()
        }
    ];
}

module.exports = {
    GEMINI_PROVIDER,
    LM_STUDIO_PROVIDER,
    normalizeProvider,
    getLmStudioBaseUrl,
    getProviderDefaultModel,
    getGlobalTextDefaults,
    resolveTextGenerationConfig,
    listTextProviders
};