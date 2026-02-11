export const API_BASE = process.env.REACT_APP_API_BASE || '/api';
export const api = (path) => `${API_BASE}${path}`;
