import React, { useState } from 'react';
import { useParams, NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Network,
  Code2,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  ShieldCheck,
  Cpu,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { useRuns } from '../store/runs';
import { EvidenceDrawer } from '../components/layout/EvidenceDrawer';

export const RunLayout: React.FC = () => {
  const { runId } = useParams<{ runId: string }>();
  const { getRun } = useRuns();
  const navigate = useNavigate();

  const [isEvidenceOpen, setIsEvidenceOpen] = useState(false);
  const [evidenceTab, setEvidenceTab] = useState<'knowledge' | 'contract' | 'assumptions'>('knowledge');

  const run = runId ? getRun(runId) : undefined;

  if (!run) {
    return (
      <div className="run-not-found">
        <AlertCircle size={32} className="icon-danger" />
        <h2>Analysis Run Not Found</h2>
        <p>The requested analysis run ID does not exist or has expired.</p>
        <Link to="/" className="btn-primary">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  // Active Analyzing State
  if (run.status === 'analyzing') {
    return (
      <div className="analyzing-state-layout">
        <div className="analyzing-header">
          <Link to="/" className="back-link">
            <ArrowLeft size={16} />
            <span>Dashboard</span>
          </Link>
          <span className="font-mono text-muted">Run ID: {run.id}</span>
        </div>

        <div className="analyzing-card">
          <div className="analyzing-spinner-group">
            <div className="pipeline-spinner" aria-hidden="true"></div>
            <div>
              <h2 className="analyzing-title">Analyzing your architecture</h2>
              <p className="analyzing-intent">"{run.rawIntent}"</p>
            </div>
          </div>

          <div className="pipeline-stages-stepper">
            <div className="stage-row done">
              <CheckCircle2 size={16} className="icon-success" />
              <span>Understanding the requirement & constraints</span>
            </div>
            <div className="stage-row done">
              <CheckCircle2 size={16} className="icon-success" />
              <span>Mapping engineering dimensions & system characteristics</span>
            </div>
            <div className="stage-row active">
              <div className="active-pulse-dot" aria-hidden="true"></div>
              <span>Evaluating distributed failure modes & engineering risks</span>
            </div>
            <div className="stage-row pending">
              <div className="pending-dot" aria-hidden="true"></div>
              <span>Considering architecture choices & trade-offs</span>
            </div>
            <div className="stage-row pending">
              <div className="pending-dot" aria-hidden="true"></div>
              <span>Formulating executable verification specifications</span>
            </div>
          </div>

          <div className="skeleton-placeholder-group">
            <div className="skeleton-pulse" style={{ height: '22px', width: '55%', marginBottom: '12px' }}></div>
            <div className="skeleton-pulse" style={{ height: '14px', width: '92%', marginBottom: '8px' }}></div>
            <div className="skeleton-pulse" style={{ height: '14px', width: '80%' }}></div>
          </div>
        </div>
      </div>
    );
  }

  // Failed State
  if (run.status === 'failed') {
    return (
      <div className="run-failed-layout">
        <AlertCircle size={36} className="icon-danger" />
        <h2>Analysis Failed</h2>
        <p className="error-message">{run.error || 'The analysis pipeline encountered an error.'}</p>
        <div className="failed-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate('/')}>
            Back to Home
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => navigate('/new', { state: { example: { prompt: run.rawIntent, context: run.context } } })}
          >
            Retry Analysis
          </button>
        </div>
      </div>
    );
  }

  const result = run.result!;
  const risksCount = result.contract.discoveredConcerns.length;
  const decisionsCount = result.contract.decisions.length;
  const specsCount = result.contract.verificationSpecs.length;

  return (
    <div className="run-shell">
      {/* Run Header with Contextual Step Navigation */}
      <div className="run-nav-bar">
        <div className="run-nav-left">
          <Link to="/" className="back-to-home-link" title="Back to Dashboard">
            <ArrowLeft size={16} />
          </Link>
          <div className="run-context-title">
            <span className="run-title-text" title={run.rawIntent}>
              {run.title}
            </span>
          </div>
        </div>

        {/* Sequential Workflow Tabs */}
        <nav className="run-workflow-steps" aria-label="Analysis Workflow">
          <NavLink
            to={`/runs/${run.id}`}
            end
            className={({ isActive }) => `step-link ${isActive ? 'active' : ''}`}
          >
            <span>1. Review</span>
            <span className="step-badge font-mono">{risksCount}</span>
          </NavLink>

          <NavLink
            to={`/runs/${run.id}/architecture`}
            className={({ isActive }) => `step-link ${isActive ? 'active' : ''}`}
          >
            <span>2. Architecture</span>
            <span className="step-badge font-mono">{decisionsCount}</span>
          </NavLink>

          <NavLink
            to={`/runs/${run.id}/verification`}
            className={({ isActive }) => `step-link ${isActive ? 'active' : ''}`}
          >
            <span>3. Verify</span>
            <span className="step-badge font-mono">{specsCount}</span>
          </NavLink>

          <NavLink
            to={`/runs/${run.id}/implementation`}
            className={({ isActive }) => `step-link ${isActive ? 'active' : ''}`}
          >
            <span>4. Implement</span>
            <span className="step-badge font-mono">EXEC</span>
          </NavLink>
        </nav>

        {/* Technical Inspector Triggers */}
        <div className="run-nav-right">
          <button
            type="button"
            className="btn-ghost-secondary font-mono"
            onClick={() => {
              setEvidenceTab('knowledge');
              setIsEvidenceOpen(true);
            }}
            title="Inspect 3-level knowledge grounding trail"
          >
            <Network size={14} className="icon-brand" />
            <span>Why ArchitectAI found this</span>
          </button>

          <button
            type="button"
            className="icon-btn-ghost"
            onClick={() => {
              setEvidenceTab('contract');
              setIsEvidenceOpen(true);
            }}
            title="View EngineeringContract JSON"
          >
            <Code2 size={16} />
          </button>
        </div>
      </div>

      {/* Main Page Content */}
      <div className="run-content-view">
        <Outlet context={{ run, onOpenEvidence: () => setIsEvidenceOpen(true) }} />
      </div>

      {/* Technical Evidence Drawer */}
      <EvidenceDrawer
        isOpen={isEvidenceOpen}
        onClose={() => setIsEvidenceOpen(false)}
        contract={result.contract}
        initialTab={evidenceTab}
      />
    </div>
  );
};
