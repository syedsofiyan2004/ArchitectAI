import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AnalysisRunRecord, AnalyzeArchitectureOutput } from '../types';

interface RunsContextType {
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
}

const STORAGE_KEY = 'architectai_runs_v2';

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
  const [runs, setRuns] = useState<AnalysisRunRecord[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to parse stored runs', e);
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(runs));
    } catch (e) {
      console.warn('Failed to persist runs', e);
    }
  }, [runs]);

  const getRun = useCallback((id: string) => {
    return runs.find((r) => r.id === id);
  }, [runs]);

  const updateRun = useCallback((id: string, updates: Partial<AnalysisRunRecord>) => {
    setRuns((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
    );
  }, []);

  const deleteRun = useCallback((id: string) => {
    setRuns((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const recordQuestionAnswer = useCallback((runId: string, question: string, answer: string) => {
    setRuns((prev) =>
      prev.map((r) => {
        if (r.id !== runId) return r;
        const userAnswers = { ...(r.userAnswers || {}), [question]: answer };
        return { ...r, userAnswers };
      })
    );
  }, []);

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
        title: makeTitle(input.rawIntent),
        rawIntent: input.rawIntent,
        context: input.context,
        explicitConstraints: input.explicitConstraints,
        declaredTechStack: input.declaredTechStack,
        createdAt: new Date().toISOString(),
        status: 'analyzing',
      };

      setRuns((prev) => [newRun, ...prev]);

      // Fire the asynchronous API call
      fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawIntent: input.rawIntent,
          context: input.context,
          explicitConstraints: input.explicitConstraints,
          declaredTechStack: input.declaredTechStack,
        }),
      })
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok || !data.success) {
            throw new Error(data.error || 'Pipeline execution failed.');
          }
          const result: AnalyzeArchitectureOutput = {
            contract: data.contract,
            stages: data.stages,
            dimensionsDetected: data.dimensionsDetected,
            mode: data.mode,
            decomposition: data.decomposition,
          };
          updateRun(runId, {
            status: 'completed',
            result,
          });
        })
        .catch((err: unknown) => {
          console.error('Run failed:', err);
          updateRun(runId, {
            status: 'failed',
            error: err instanceof Error ? err.message : 'Unknown pipeline error.',
          });
        });

      return runId;
    },
    [updateRun]
  );

  return (
    <RunsContext.Provider
      value={{
        runs,
        getRun,
        createRun,
        updateRun,
        deleteRun,
        recordQuestionAnswer,
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
