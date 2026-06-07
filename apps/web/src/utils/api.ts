import { Project, AnalysisRun } from '../types';

export function getApiBaseUrl(): string {
  let url = '';
  if (typeof window !== 'undefined' && localStorage.getItem('testlens_api_url')) {
    url = localStorage.getItem('testlens_api_url')!;
  } else if (process.env.NEXT_PUBLIC_API_URL) {
    url = process.env.NEXT_PUBLIC_API_URL;
  } else if (typeof window !== 'undefined') {
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      url = 'http://localhost:3001/api/v1';
    }
  }

  if (url) {
    // Remove all whitespace characters, newlines, and carriage returns
    url = url.replace(/\s+/g, '');
    // Strip trailing slashes
    url = url.replace(/\/$/, '');
    // Normalize duplicate suffix segments or accidental trailing health check paths
    url = url.replace(/\/health$/, '');
    url = url.replace(/\/api\/v1\/api\/v1$/, '/api/v1');
    url = url.replace(/\/api\/api$/, '/api');

    if (!url.endsWith('/api/v1') && !url.endsWith('/api')) {
      url = `${url}/api/v1`;
    }
  }
  return url;
}

export async function fetchProjects(): Promise<Project[]> {
  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/projects`);
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
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/projects`, {
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
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/projects/${projectId}/analyses`, {
    method: 'POST'
  });
  if (!res.ok) {
    throw new Error('Failed to trigger analysis run');
  }
  return await res.json();
}

export async function fetchProjectHistory(projectId: string): Promise<AnalysisRun[]> {
  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/projects/${projectId}/analyses`);
    if (!res.ok) throw new Error('Failed to fetch history');
    return await res.json();
  } catch (err) {
    console.warn('API error, falling back to mock runs history:', err);
    return [];
  }
}

export async function fetchAnalysisStatus(analysisId: string): Promise<AnalysisRun> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/analyses/${analysisId}`);
  if (!res.ok) {
    throw new Error('Failed to fetch analysis status');
  }
  return await res.json();
}
