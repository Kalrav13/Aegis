import { Project, AnalysisRun } from '../types';

export async function fetchProjects(): Promise<Project[]> {
  try {
    const res = await fetch('/projects');
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
  const res = await fetch('/projects', {
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
  const res = await fetch(`/projects/${projectId}/analyses`, {
    method: 'POST'
  });
  if (!res.ok) {
    throw new Error('Failed to trigger analysis run');
  }
  return await res.json();
}

export async function fetchProjectHistory(projectId: string): Promise<AnalysisRun[]> {
  try {
    const res = await fetch(`/projects/${projectId}/analyses`);
    if (!res.ok) throw new Error('Failed to fetch history');
    return await res.json();
  } catch (err) {
    console.warn('API error, falling back to mock runs history:', err);
    return [];
  }
}

export async function fetchAnalysisStatus(analysisId: string): Promise<AnalysisRun> {
  const res = await fetch(`/analyses/${analysisId}`);
  if (!res.ok) {
    throw new Error('Failed to fetch analysis status');
  }
  return await res.json();
}
