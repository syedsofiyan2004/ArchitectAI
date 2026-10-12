import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ShieldAlert, Sparkles, ExternalLink, BookOpen } from 'lucide-react';
import { ConcernCandidate } from '@architectai/domain';

interface RiskCardProps {
  concern: ConcernCandidate;
  onOpenEvidence?: () => void;
  defaultExpanded?: boolean;
}

export function formatConfidence(conf: number): { label: string; tone: 'high' | 'medium' | 'low' } {
  if (conf >= 0.85) return { label: 'High confidence', tone: 'high' };
  if (conf >= 0.7) return { label: 'Moderate confidence', tone: 'medium' };
  return { label: 'Needs confirmation', tone: 'low' };
}

export function getSeverityLabel(confidence: number): { label: 'Critical' | 'High' | 'Medium' | 'Low'; level: string } {
  if (confidence >= 0.9) return { label: 'Critical', level: 'critical' };
  if (confidence >= 0.8) return { label: 'High', level: 'high' };
  if (confidence >= 0.65) return { label: 'Medium', level: 'medium' };
  return { label: 'Low', level: 'low' };
}

export function getHumanRecommendation(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('rate') || t.includes('burst') || t.includes('window')) {
    return 'Use a shared atomic rolling-window limiter with token-bucket burst control.';
  }
  if (t.includes('refresh') || t.includes('token') || t.includes('race')) {
    return 'Use single-flight in-flight request deduplication with queued replay.';
  }
  if (t.includes('memory') || t.includes('buffer') || t.includes('exhaustion') || t.includes('stream')) {
    return 'Enforce stream backpressure via highWaterMark and cap concurrent workers with a bounded queue.';
  }
  if (t.includes('pool') || t.includes('connection')) {
    return 'Configure connection pool acquisition timeouts, query cancellation, and circuit breaking.';
  }
  if (t.includes('idempot') || t.includes('payment') || t.includes('duplicate')) {
    return 'Generate unique idempotency keys per operation and enforce transactional deduplication.';
  }
  return 'Establish an explicit bounded queue, transactional isolation, and independent verification tests.';
}

export const RiskCard: React.FC<RiskCardProps> = ({
  concern,
  onOpenEvidence,
  defaultExpanded = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const severity = getSeverityLabel(concern.confidence);
  const confidence = formatConfidence(concern.confidence);
  const recommendation = getHumanRecommendation(concern.title);
  const evidenceCount = concern.supportingKnowledgeIds?.length || 1;
  const dimensions = concern.dimensions && concern.dimensions.length > 0
    ? concern.dimensions.map((d) => d.replace(/_/g, ' ')).join(' • ')
    : 'High concurrency / edge conditions';

  return (
    <article className="risk-card finding-row-card" aria-labelledby={`risk-title-${concern.id}`}>
      <div className="risk-card-header">
        <div className="risk-card-top-row">
          <div className="risk-severity-badge-group">
            <span className={`risk-severity-pill sev-${severity.level}`}>
              {severity.label} Risk
            </span>
            <span className={`risk-confidence-chip tone-${confidence.tone}`}>
              {confidence.label}
            </span>
          </div>

          <span className="risk-evidence-counter">
            <BookOpen size={13} className="text-muted" />
            <span>{evidenceCount} {evidenceCount === 1 ? 'source' : 'sources'}</span>
          </span>
        </div>

        <h3 id={`risk-title-${concern.id}`} className="risk-card-title">
          {concern.title}
        </h3>
      </div>

      <div className="risk-card-body">
        <div className="risk-field">
          <span className="risk-field-label">Why it matters</span>
          <p className="risk-field-text">{concern.applicabilityReason || concern.description}</p>
        </div>

        <div className="risk-field">
          <span className="risk-field-label">When it happens</span>
          <p className="risk-field-text text-secondary">{dimensions}</p>
        </div>

        <div className="risk-recommendation-block">
          <div className="risk-rec-header">
            <Sparkles size={14} className="icon-brand" />
            <span className="risk-rec-title">ArchitectAI Recommendation</span>
          </div>
          <p className="risk-rec-text">{recommendation}</p>
        </div>
      </div>

      <div className="risk-card-footer">
        <button
          type="button"
          className="risk-expand-btn btn-ghost"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
        >
          <span>Why ArchitectAI believes this</span>
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {onOpenEvidence && (
          <button
            type="button"
            className="btn-ghost risk-drawer-trigger-btn font-mono"
            onClick={onOpenEvidence}
            title="Inspect technical evidence sources"
          >
            <span>[Why ArchitectAI found this]</span>
            <ExternalLink size={12} />
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="risk-expanded-drawer">
          <div className="risk-expanded-section">
            <span className="expanded-label">Underlying failure mechanism</span>
            <p className="expanded-text">{concern.description}</p>
          </div>

          {concern.assumptions && concern.assumptions.length > 0 && (
            <div className="risk-expanded-section">
              <span className="expanded-label">Architectural Assumptions</span>
              <ul className="expanded-list">
                {concern.assumptions.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          )}

          {concern.supportingKnowledgeIds && concern.supportingKnowledgeIds.length > 0 && (
            <div className="risk-expanded-section">
              <span className="expanded-label">Evidence Citations</span>
              <div className="evidence-chips-list font-mono">
                {concern.supportingKnowledgeIds.map((kId, i) => (
                  <span key={i} className="evidence-chip">
                    {kId.replace(/-/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
};
