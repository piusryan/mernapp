export const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000';
export const api = (path) => `${API_BASE}${path}`;
