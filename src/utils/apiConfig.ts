export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return '';

  let savedUrl = localStorage.getItem('SENZO_API_SERVER_URL');
  if (savedUrl) {
    savedUrl = savedUrl.trim();
    // Clean up old / stale dev domain references if present in localStorage
    if (savedUrl.includes('ok3o3tltxmte4gbcr2v3di')) {
      localStorage.removeItem('SENZO_API_SERVER_URL');
      savedUrl = null;
    }
  }

  if (savedUrl) {
    return savedUrl.replace(/\/+$/, '');
  }

  const envUrl = (import.meta as any).env?.VITE_API_BASE_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  if (window.location && window.location.origin && window.location.origin !== 'null') {
    return window.location.origin;
  }

  return '';
}
