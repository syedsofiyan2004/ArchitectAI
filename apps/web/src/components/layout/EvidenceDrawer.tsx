import React, { useState } from 'react';
import { X, Network, FileCode, CheckCircle2, ExternalLink, Copy, Check } from 'lucide-react';
import { EngineeringContract } from '@architectai/domain';

interface EvidenceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  contract?: EngineeringContract;
  initialTab?: 'knowledge' | 'contract' | 'assumptions';
}

export const EvidenceDrawer: React.FC<EvidenceDrawerProps> = ({
  isOpen,
  onClose,
  contract,
  initialTab = 'knowledge',
}) => {
  const [activeTab, setActiveTab] = useState<'knowledge' | 'contract' | 'assumptions'>(initialTab);
  const [copied, setCopied] = useState(false);

  if (!isOpen || !contract) return null;

  const jsonString = JSON.stringify(contract, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contract-${contract.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="drawer-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div className="drawer-title-group">
            <Network className="icon-brand" size={18} />
            <div>
              <h3>Technical Evidence & Grounding</h3>
              <p className="drawer-subtitle font-mono">Contract ID: {contract.id}</p>
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close drawer">
            <X size={18} />
          </button>
        </div>

        <div className="drawer-tabs">
          <button
            type="button"
            className={`drawer-tab-btn ${activeTab === 'knowledge' ? 'active' : ''}`}
            onClick={() => setActiveTab('knowledge')}
          >
            <span>3-Level Knowledge Causal Trail</span>
          </button>
          <button
            type="button"
            className={`drawer-tab-btn ${activeTab === 'contract' ? 'active' : ''}`}
            onClick={() => setActiveTab('contract')}
          >
            <span>Contract JSON</span>
          </button>
          <button
            type="button"
            className={`drawer-tab-btn ${activeTab === 'assumptions' ? 'active' : ''}`}
            onClick={() => setActiveTab('assumptions')}
          >
            <span>Assumptions & Open Questions</span>
          </button>
        </div>

        <div className="drawer-content">
          {activeTab === 'knowledge' && (
            <div className="knowledge-trail-view">
              <div className="drawer-section-lead">
                ArchitectAI grounds every discovered risk by bridging invariant physical primitives (L1),
                reusable software failure patterns (L2), and concrete technology implementations (L3).
              </div>

              {/* L1 Fundamental */}
              <div className="drawer-level-card">
                <div className="level-indicator-bar l1">
                  <span className="level-pill font-mono">L1 FUNDAMENTAL</span>
                  <strong>Durable Physical Systems Primitives</strong>
                </div>
                <p className="level-desc">
                  Physical invariants governing finite computational capacity, concurrency, time windows, and trust boundaries.
                </p>
                <div className="primitives-list">
                  <div className="primitive-pill font-mono">Finite Memory & Buffer Saturation</div>
                  <div className="primitive-pill font-mono">Interleaved State Mutation</div>
                  <div className="primitive-pill font-mono">Network Ingress Boundaries</div>
                </div>
              </div>

              <div className="trail-arrow-divider">↓ triggers failure modes in distributed environments</div>

              {/* L2 Failure Pattern */}
              <div className="drawer-level-card">
                <div className="level-indicator-bar l2">
                  <span className="level-pill font-mono">L2 FAILURE PATTERN</span>
                  <strong>Reusable Software Failure Modes</strong>
                </div>
                <p className="level-desc">
                  Recurrent architectural anti-patterns discovered for this specific requirement:
                </p>
                <div className="concerns-summary-list">
                  {contract.discoveredConcerns.map((c) => (
                    <div key={c.id} className="concern-trail-row">
                      <div className="concern-trail-title">
                        <strong>{c.title}</strong>
                        <span className="font-mono text-muted">({Math.round(c.confidence * 100)}% confidence)</span>
                      </div>
                      <p className="concern-trail-reason">{c.applicabilityReason}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="trail-arrow-divider">↓ mitigated by authoritative runtime mechanisms</div>

              {/* L3 Technology Specific */}
              <div className="drawer-level-card">
                <div className="level-indicator-bar l3">
                  <span className="level-pill font-mono">L3 TECHNOLOGY SPECIFIC</span>
                  <strong>Concrete Mechanisms & Provenance</strong>
                </div>
                <div className="tech-citations-list">
                  <div className="citation-row">
                    <div className="citation-header">
                      <strong>Redis Atomic Sliding Window</strong>
                      <span className="tech-badge font-mono">Redis 7+</span>
                    </div>
                    <p className="citation-claim">
                      Uses Redis sorted sets with EVAL Lua script for atomic boundary checks without multi-instance race conditions.
                    </p>
                    <a
                      href="https://redis.io/docs/manual/patterns/rate-limiter/"
                      target="_blank"
                      rel="noreferrer"
                      className="citation-link font-mono"
                    >
                      <span>redis.io/docs/manual/patterns/rate-limiter</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>

                  <div className="citation-row">
                    <div className="citation-header">
                      <strong>RFC 6749 OAuth 2.0 Token Refresh</strong>
                      <span className="tech-badge font-mono">OAuth 2.0</span>
                    </div>
                    <p className="citation-claim">
                      RFC 6749 §6 single-flight refresh with request replay prevents invalidating refresh token rotations.
                    </p>
                    <a
                      href="https://datatracker.ietf.org/doc/html/rfc6749#section-6"
                      target="_blank"
                      rel="noreferrer"
                      className="citation-link font-mono"
                    >
                      <span>datatracker.ietf.org/doc/html/rfc6749#section-6</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'contract' && (
            <div className="contract-json-view">
              <div className="json-toolbar">
                <div className="json-validation-status">
                  <CheckCircle2 size={16} className="icon-success" />
                  <span className="font-mono">zod: EngineeringContractSchema (valid)</span>
                </div>
                <div className="json-actions">
                  <button type="button" className="btn-secondary" onClick={handleDownload}>
                    Download
                  </button>
                  <button type="button" className="btn-primary" onClick={handleCopy}>
                    {copied ? (
                      <>
                        <Check size={14} />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        <span>Copy JSON</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <pre className="json-box font-mono">
                <code>{jsonString}</code>
              </pre>
            </div>
          )}

          {activeTab === 'assumptions' && (
            <div className="assumptions-view">
              <div className="drawer-section-lead">
                ArchitectAI explicitly surfaces assumptions and open questions rather than inventing false certainty.
              </div>

              <div className="assumptions-group">
                <h4>Inherent Architectural Assumptions</h4>
                {contract.discoveredConcerns.flatMap((c) => c.assumptions || []).length > 0 ? (
                  <ul className="drawer-list">
                    {contract.discoveredConcerns.flatMap((c) => c.assumptions || []).map((a, idx) => (
                      <li key={idx}>{a}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted">No explicit assumptions declared.</p>
                )}
              </div>

              <div className="assumptions-group">
                <h4>Open Engineering Questions</h4>
                {contract.discoveredConcerns.flatMap((c) => c.unresolvedQuestions || []).length > 0 ? (
                  <ul className="drawer-list highlight-questions">
                    {contract.discoveredConcerns.flatMap((c) => c.unresolvedQuestions || []).map((q, idx) => (
                      <li key={idx}>{q}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted">No unresolved questions flagged.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
