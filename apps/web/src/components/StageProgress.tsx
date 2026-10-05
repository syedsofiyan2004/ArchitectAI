import React, { useState } from 'react';
import { AnalysisStageLog } from '../types';

interface StageProgressProps {
  stages: AnalysisStageLog[];
  isLoading: boolean;
}

const DEFAULT_STAGES = [
  { stage: 1, name: 'Requirement Decomposition', description: 'Decomposing natural-language intent and constraints.' },
  { stage: 2, name: 'Dimension Mapping', description: 'Analyzing universal systems primitives.' },
  { stage: 3, name: 'Knowledge Retrieval', description: 'Querying three-level knowledge repository.' },
  { stage: 4, name: 'Failure Mode Discovery', description: 'Discovering candidate failure patterns.' },
  { stage: 5, name: 'Architecture Decisions', description: 'Synthesizing grounded architecture choices.' },
  { stage: 6, name: 'Verification Formulation', description: 'Formulating executable verification specifications.' },
  { stage: 7, name: 'Contract Validation', description: 'Validating final schema against runtime domain invariants.' },
];

export const StageProgress: React.FC<StageProgressProps> = ({ stages, isLoading }) => {
  const [expanded, setExpanded] = useState<boolean>(false);

  const displayStages = stages.length > 0 ? stages : DEFAULT_STAGES.map((s) => ({
    ...s,
    timestamp: '',
    status: 'pending' as const,
  }));

  const completedCount = stages.length;

  return (
    <div className="surface-card activity-card" role="region" aria-label="Pipeline Progress">
      <div className="activity-header">
        <div className="activity-status-left">
          {isLoading ? (
            <span className="spinner" aria-hidden="true"></span>
          ) : (
            <span className="dot-indicator-success" aria-hidden="true"></span>
          )}
          <span className="activity-title">
            {isLoading
              ? 'Executing 7-Stage Architecture Discovery Pipeline...'
              : `Discovery Pipeline Completed (${completedCount}/7 Stages Verified)`}
          </span>
        </div>

        <button
          type="button"
          className="stage-details-toggle"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
        >
          {expanded ? 'Hide Stage Logs ▾' : 'View Stage Logs ▸'}
        </button>
      </div>

      {/* Compact Mini Stage Track */}
      <div className="compact-stages-bar" role="list">
        {displayStages.map((s, idx) => {
          const isDone = stages.length > 0 && idx < stages.length;
          const isCurrent = isLoading && idx === Math.min(stages.length, 6);

          return (
            <div
              key={s.stage}
              role="listitem"
              className={`compact-stage-pill ${isDone ? 'done' : ''} ${isCurrent ? 'active' : ''}`}
              title={`${s.stage}. ${s.name}: ${s.description}`}
            >
              <span className="pill-stage-num font-mono">{s.stage}</span>
              <span className="pill-stage-name">{s.name}</span>
            </div>
          );
        })}
      </div>

      {/* Expanded Detailed Log Drawer */}
      {expanded && (
        <div className="expanded-stages-list">
          {displayStages.map((s, idx) => {
            const isDone = stages.length > 0 && idx < stages.length;
            const isCurrent = isLoading && idx === Math.min(stages.length, 6);

            return (
              <div
                key={s.stage}
                className={`stage-detail-row ${isDone ? 'done' : ''} ${isCurrent ? 'current' : ''}`}
              >
                <div className="stage-detail-num font-mono">{s.stage}</div>
                <div className="stage-detail-body">
                  <div className="stage-detail-title-line">
                    <strong>{s.name}</strong>
                    {s.timestamp && (
                      <span className="stage-time font-mono">
                        {new Date(s.timestamp).toLocaleTimeString([], {
                          hour12: false,
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                    )}
                  </div>
                  <p className="stage-detail-desc">{s.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Shimmer skeleton shown during active loading */}
      {isLoading && (
        <div className="skeleton-preview-box" aria-live="polite">
          <div className="skeleton-pulse" style={{ height: '20px', width: '45%', marginBottom: '10px' }}></div>
          <div className="skeleton-pulse" style={{ height: '14px', width: '90%', marginBottom: '8px' }}></div>
          <div className="skeleton-pulse" style={{ height: '14px', width: '75%' }}></div>
        </div>
      )}
    </div>
  );
};
