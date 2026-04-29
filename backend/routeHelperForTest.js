
// Helper to ensure we have an array, parsing if it's a string
const ensureArray = (data) => {
    if (Array.isArray(data)) return data;
    if (typeof data === 'string') {
        try {
            // Try to parse if it looks like JSON
            if (data.trim().startsWith('[')) {
                return JSON.parse(data);
            }
        } catch (e) {
            console.error('Failed to parse array string:', data.substring(0, 100) + '...');
            return [];
        }
    }
    return [];
};

module.exports = { ensureArray };
