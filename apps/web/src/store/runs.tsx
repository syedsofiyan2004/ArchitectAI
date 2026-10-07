import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  AnalysisRunRecord,
  AnalyzeArchitectureOutput,
  Project,
  ProjectRepository,
} from '../types';

interface RunsContextType {
  projects: Project[];
  activeProject: Project | null;
  activeRepository: ProjectRepository | null;
  runs: AnalysisRunRecord[];
  getRun: (id: string) => AnalysisRunRecord | undefined;
  createRun: (input: {
    rawIntent: string;
    context: Record<string, string>;
    explicitConstraints: string[];
    declaredTechStack: string[];
  }) => Promise<string>;
  updateRun: (id: string, updates: Partial<AnalysisRunRecord>) => void;
  deleteRun: (id: string) => void;
  recordQuestionAnswer: (runId: string, question: string, answer: string) => void;
  createProject: (name: string, description?: string) => Promise<Project>;
  selectProject: (projectId: string) => Promise<void>;
  registerRepository: (repoPath: string) => Promise<ProjectRepository>;
  refreshRepository: () => Promise<void>;
  csrfToken: string | null;
}

const RunsContext = createContext<RunsContextType | null>(null);

function makeTitle(intent: string): string {
  const trimmed = intent.trim();
  const firstSentence = trimmed.split(/[.?!]/)[0] || trimmed;
  if (firstSentence.length > 60) {
    return firstSentence.slice(0, 57) + '...';
  }
  return firstSentence;
}

export const RunsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [activeRepository, setActiveRepository] = useState<ProjectRepository | null>(null);
  const [runs, setRuns] = useState<AnalysisRunRecord[]>([]);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  // Helper to fetch server CSRF token and config
  useEffect(() => {
    fetch('/api/config')
      .then((res) => res.json())
      .then((data) => {
        if (data.csrfToken) {
          setCsrfToken(data.csrfToken);
        }
      })
      .catch((err) => console.warn('Failed to load server config/token', err));
  }, []);

  // Fetch projects on initial load
  useEffect(() => {
    fetch('/api/projects')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.projects) && data.projects.length > 0) {
          setProjects(data.projects);
          setActiveProject(data.projects[0]);
        }
      })
      .catch((err) => console.warn('Failed to load projects', err));
  }, []);

  // Fetch repository and runs when activeProject changes
  useEffect(() => {
    if (!activeProject) return;

    // Fetch repository
    fetch(`/api/projects/${activeProject.id}/repository`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.success && data.repository) {
          setActiveRepository(data.repository);
        } else {
          setActiveRepository(null);
        }
      })
      .catch(() => setActiveRepository(null));

    // Fetch runs from server
    fetch(`/api/projects/${activeProject.id}/runs`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.runs)) {
          const mappedRuns: AnalysisRunRecord[] = data.runs.map((r: any) => ({
            id: r.id,
            projectId: r.projectId,
            title: r.title,
            rawIntent: r.rawIntent,
            context: r.context,
            explicitConstraints: r.explicitConstraints,
            declaredTechStack: r.declaredTechStack,
            createdAt: r.createdAt,
            status: (r.state === 'FAILED' && !r.contract) ? 'failed' : r.state === 'ANALYZING' ? 'analyzing' : 'completed',
            state: r.state,
            userAnswers: r.userAnswers || {},
            result: r.contract ? {
              contract: r.contract,
              stages: [],
              dimensionsDetected: r.dimensionsDetected || [],
              mode: r.analysisMode === 'deterministic' ? 'deterministic-demo' : 'remote-model',
              decomposition: r.decomposition,
            } : undefined,
          }));

          setRuns((prev) => {
            // Merge with local runs, prioritizing server runs
            const serverRunIds = new Set(mappedRuns.map((mr) => mr.id));
            const localOnly = prev.filter((p) => !serverRunIds.has(p.id));
            return [...mappedRuns, ...localOnly];
          });
        }
      })
      .catch((err) => console.warn('Failed to load project runs', err));
  }, [activeProject]);

  const selectProject = useCallback(async (projectId: string) => {
    const proj = projects.find((p) => p.id === projectId);
    if (proj) {
      setActiveProject(proj);
    } else {
      const res = await fetch(`/api/projects/${projectId}`);
      const data = await res.json();
      if (data.success && data.project) {
        setProjects((prev) => [data.project, ...prev.filter((p) => p.id !== data.project.id)]);
        setActiveProject(data.project);
      }
    }
  }, [projects]);

  const createProject = useCallback(async (name: string, description?: string): Promise<Project> => {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
      },
      body: JSON.stringify({ name, description }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to create project.');
    }
    setProjects((prev) => [data.project, ...prev]);
    setActiveProject(data.project);
    return data.project;
  }, [csrfToken]);

  const registerRepository = useCallback(async (repoPath: string): Promise<ProjectRepository> => {
    if (!activeProject) {
      throw new Error('No active project selected.');
    }
    const res = await fetch(`/api/projects/${activeProject.id}/repository`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
      },
      body: JSON.stringify({ repoPath }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to register repository.');
    }
    setActiveRepository(data.repository);
    return data.repository;
  }, [activeProject, csrfToken]);

  const refreshRepository = useCallback(async (): Promise<void> => {
    if (!activeProject) return;
    const res = await fetch(`/api/projects/${activeProject.id}/repository/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
      },
    });
    const data = await res.json();
    if (data.success && data.repository) {
      setActiveRepository(data.repository);
    }
  }, [activeProject, csrfToken]);

  const getRun = useCallback((id: string) => {
    return runs.find((r) => r.id === id);
  }, [runs]);

  const updateRun = useCallback((id: string, updates: Partial<AnalysisRunRecord>) => {
    setRuns((prev) => {
      const exists = prev.some((r) => r.id === id);
      if (exists) {
        return prev.map((r) => (r.id === id ? { ...r, ...updates } : r));
      }
      const newRecord: AnalysisRunRecord = {
        id,
        title: updates.title || 'Architecture Run',
        rawIntent: updates.rawIntent || '',
        context: updates.context || {},
        explicitConstraints: updates.explicitConstraints || [],
        declaredTechStack: updates.declaredTechStack || [],
        createdAt: updates.createdAt || new Date().toISOString(),
        status: updates.status || 'completed',
        ...updates,
      };
      return [newRecord, ...prev];
    });
  }, []);

  const deleteRun = useCallback((id: string) => {
    setRuns((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const recordQuestionAnswer = useCallback((runId: string, question: string, answer: string) => {
    // 1. Optimistic update in state
    setRuns((prev) =>
      prev.map((r) => {
        if (r.id !== runId) return r;
        const userAnswers = { ...(r.userAnswers || {}), [question]: answer };
        return { ...r, userAnswers };
      })
    );

    // 2. Persist to server SQLite database
    fetch(`/api/runs/${runId}/answers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
      },
      body: JSON.stringify({ question, answer }),
    }).catch((err) => console.warn('Failed to persist answer to server', err));
  }, [csrfToken]);

  const createRun = useCallback(
    async (input: {
      rawIntent: string;
      context: Record<string, string>;
      explicitConstraints: string[];
      declaredTechStack: string[];
    }): Promise<string> => {
      const runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newRun: AnalysisRunRecord = {
        id: runId,
        projectId: activeProject?.id || 'default_project',
        title: makeTitle(input.rawIntent),
        rawIntent: input.rawIntent,
        context: input.context,
        explicitConstraints: input.explicitConstraints,
        declaredTechStack: input.declaredTechStack,
        createdAt: new Date().toISOString(),
        status: 'analyzing',
        state: 'ANALYZING',
      };

      setRuns((prev) => [newRun, ...prev]);

      // Fire the asynchronous API call to server
      const endpoint = activeProject ? `/api/projects/${activeProject.id}/runs` : '/api/analyze';

      fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
        },
        body: JSON.stringify({
          runId,
          rawIntent: input.rawIntent,
          context: input.context,
          explicitConstraints: input.explicitConstraints,
          declaredTechStack: input.declaredTechStack,
          projectId: activeProject?.id,
        }),
      })
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok || !data.success) {
            throw new Error(data.error || 'Pipeline execution failed.');
          }
          const result: AnalyzeArchitectureOutput = {
            contract: data.contract,
            stages: data.stages || [],
            dimensionsDetected: data.dimensionsDetected || [],
            mode: data.mode === 'deterministic' ? 'deterministic-demo' : (data.mode || 'remote-model'),
            decomposition: data.decomposition,
          };
          updateRun(runId, {
            status: 'completed',
            state: 'ANALYSIS_COMPLETE',
            result,
          });
        })
        .catch((err: unknown) => {
          console.error('Run failed:', err);
          updateRun(runId, {
            status: 'failed',
            state: 'FAILED',
            error: err instanceof Error ? err.message : 'Unknown pipeline error.',
          });
        });

      return runId;
    },
    [activeProject, csrfToken, updateRun]
  );

  return (
    <RunsContext.Provider
      value={{
        projects,
        activeProject,
        activeRepository,
        runs,
        getRun,
        createRun,
        updateRun,
        deleteRun,
        recordQuestionAnswer,
        createProject,
        selectProject,
        registerRepository,
        refreshRepository,
        csrfToken,
      }}
    >
      {children}
    </RunsContext.Provider>
  );
};

export function useRuns() {
  const context = useContext(RunsContext);
  if (!context) {
    throw new Error('useRuns must be used within a RunsProvider');
  }
  return context;
}
