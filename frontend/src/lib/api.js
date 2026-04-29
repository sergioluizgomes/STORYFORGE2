const configuredBackendUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export const BACKEND_URL = configuredBackendUrl.replace(/\/+$/, '');
export const API_BASE_URL = `${BACKEND_URL}/api`;

export function buildApiUrl(path = '') {
    if (!path) return API_BASE_URL;
    return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export function buildBackendUrl(path = '') {
    if (!path) return BACKEND_URL;
    return `${BACKEND_URL}${path.startsWith('/') ? path : `/${path}`}`;
}