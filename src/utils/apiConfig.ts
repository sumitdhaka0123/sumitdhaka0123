export const getApiBaseUrl = (): string => {
  const customUrl = localStorage.getItem('SENZO_API_SERVER_URL');
  if (customUrl && customUrl.trim()) {
    return customUrl.trim().replace(/\/+$/, '');
  }
  const envUrl = (import.meta as any).env ? (import.meta as any).env.VITE_API_BASE_URL : undefined;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  // Default to active live backend server
  return 'https://sumitdhaka0123.onrender.com';
};
