import React from 'react';
import { AnalysisStageLog } from '../types';

interface StageProgressProps {
  stages: AnalysisStageLog[];
  isLoading: boolean;
}

const DEFAULT_STAGES = [
  { stage: 1, name: 'Understanding requirement', description: 'Decomposing natural-language intent and constraints.' },
  { stage: 2, name: 'Mapping engineering dimensions', description: 'Analyzing universal systems primitives.' },
  { stage: 3, name: 'Searching engineering knowledge', description: 'Querying three-level knowledge repository.' },
  { stage: 4, name: 'Identifying failure modes', description: 'Discovering candidate failure patterns.' },
  { stage: 5, name: 'Evaluating architecture choices', description: 'Synthesizing grounded architecture decisions.' },
  { stage: 6, name: 'Building verification plan', description: 'Formulating executable verification specifications.' },
  { stage: 7, name: 'Validating Engineering Contract', description: 'Validating final schema against runtime domain invariants.' },
];

export const StageProgress: React.FC<StageProgressProps> = ({ stages, isLoading }) => {
  const currentStages = stages.length > 0 ? stages : DEFAULT_STAGES.map((s) => ({
    ...s,
    timestamp: '',
    status: 'pending' as const,
  }));

  return (
    <div className="stages-container card">
      <div className="stages-header">
        <div className="section-label">
          <span className="dot-indicator blue"></span>
          <span>7-Stage Discovery Pipeline</span>
        </div>
        <div className="pipeline-status">
          {isLoading ? (
            <span className="status-badge running">Pipeline In Progress</span>
          ) : stages.length > 0 ? (
            <span className="status-badge success">All 7 Stages Verified</span>
          ) : (
            <span className="status-badge idle">Ready</span>
          )}
        </div>
      </div>

      <div className="stages-track">
        {currentStages.map((s, idx) => {
          const isDone = stages.length > 0 && idx < stages.length;
          const isCurrent = isLoading && idx === Math.min(stages.length, 6);

          return (
            <div
              key={s.stage}
              className={`stage-item ${isDone ? 'completed' : ''} ${isCurrent ? 'active' : ''}`}
            >
              <div className="stage-marker">
                <span className="stage-num font-mono">{s.stage}</span>
                {idx < currentStages.length - 1 && <div className="stage-connector"></div>}
              </div>
              <div className="stage-details">
                <div className="stage-title-row">
                  <span className="stage-name">{s.name}</span>
                  {s.timestamp && (
                    <span className="stage-time font-mono">
                      {new Date(s.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  )}
                </div>
                <p className="stage-desc">{s.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
