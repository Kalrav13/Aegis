import { Project, AnalysisRun } from '../types';

export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    // If the user explicitly configured an override URL in the customizer, use it
    if (localStorage.getItem('testlens_api_url')) {
      let url = localStorage.getItem('testlens_api_url')!;
      url = url.replace(/\s+/g, '');
      url = url.replace(/\/$/, '');
      url = url.replace(/\/health$/, '');
      url = url.replace(/\/api\/v1\/api\/v1$/, '/api/v1');
      url = url.replace(/\/api\/api$/, '/api');
      if (!url.endsWith('/api/v1') && !url.endsWith('/api')) {
        url = `${url}/api/v1`;
      }
      return url;
    }
    // Otherwise, default to the current domain (e.g. Vercel's domain or localhost:3000)
    // Next.js rewrites in next.config.js will transparently proxy these requests to the backend.
    return window.location.origin;
  }

  // Server-side (during SSR or Next.js build rewrites)
  let url = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
  url = url.replace(/\s+/g, '');
  url = url.replace(/\/$/, '');
  url = url.replace(/\/api\/v1\/api\/v1$/, '/api/v1');
  url = url.replace(/\/api\/api$/, '/api');
  if (!url.endsWith('/api/v1') && !url.endsWith('/api')) {
    url = `${url}/api/v1`;
  }
  return url;
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const baseUrl = getApiBaseUrl();
  const headers = new Headers(options.headers || {});
  
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('testlens_auth_token');
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  // Ensure path starts with slash if not absolute
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  const res = await fetch(`${baseUrl}${cleanPath}`, {
    ...options,
    headers
  });

  if (res.status === 401 && typeof window !== 'undefined') {
    localStorage.removeItem('testlens_auth_token');
    if (window.location.pathname !== '/login' && window.location.pathname !== '/signup') {
      window.location.href = '/login';
    }
  }

  return res;
}

export async function loginUser(email: string, password?: string) {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || 'Login credentials invalid');
  }
  const data = await res.json();
  localStorage.setItem('testlens_auth_token', data.token);
  return data.user;
}

export async function registerUser(email: string, password?: string, name?: string) {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name })
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || 'Registration failed');
  }
  const data = await res.json();
  localStorage.setItem('testlens_auth_token', data.token);
  return data.user;
}

export async function fetchProjects(): Promise<Project[]> {
  try {
    const res = await apiFetch('/projects');
    if (!res.ok) throw new Error('Failed to fetch projects');
    return await res.json();
  } catch (err) {
    console.warn('API error, falling back to mock projects list:', err);
    return [
      {
        id: 'test-project-uuid',
        name: 'TestLens Core UI',
        gitUrl: 'https://github.com/Kalrav13/TestLens.git',
        defaultBranch: 'main',
        createdAt: new Date().toISOString()
      }
    ];
  }
}

export async function createProject(data: { name: string; repoUrl: string; branch: string; token?: string }): Promise<Project> {
  const res = await apiFetch('/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    throw new Error('Failed to create project');
  }
  return await res.json();
}

export async function triggerAnalysis(projectId: string): Promise<AnalysisRun> {
  const res = await apiFetch(`/projects/${projectId}/analyses`, {
    method: 'POST'
  });
  if (!res.ok) {
    throw new Error('Failed to trigger analysis run');
  }
  return await res.json();
}

export async function fetchProjectHistory(projectId: string): Promise<AnalysisRun[]> {
  try {
    const res = await apiFetch(`/projects/${projectId}/analyses`);
    if (!res.ok) throw new Error('Failed to fetch history');
    return await res.json();
  } catch (err) {
    console.warn('API error, falling back to mock runs history:', err);
    return [];
  }
}

export async function fetchAnalysisStatus(analysisId: string): Promise<AnalysisRun> {
  const res = await apiFetch(`/analyses/${analysisId}`);
  if (!res.ok) {
    throw new Error('Failed to fetch analysis status');
  }
  return await res.json();
}
