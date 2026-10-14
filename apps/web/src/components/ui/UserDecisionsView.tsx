import React, { useState, useEffect } from 'react';
import { HelpCircle, Check, Sparkles, RefreshCw, AlertCircle } from 'lucide-react';
import { useRuns } from '../../store/runs';
import { Button } from './Button';

interface QuestionOption {
  label: string;
  description: string;
  isRecommended?: boolean;
}

export interface QuestionData {
  question: string;
  options: QuestionOption[];
  currentAnswer?: string;
}

interface UserDecisionsViewProps {
  runId: string;
  questions?: string[];
  userAnswers?: Record<string, string>;
  onAnswerSaved?: (question: string, answer: string) => void;
  onArchitectureRefreshed?: () => void;
}

export const UserDecisionsView: React.FC<UserDecisionsViewProps> = ({
  runId,
  questions: propQuestions,
  userAnswers: propAnswers = {},
  onAnswerSaved,
  onArchitectureRefreshed,
}) => {
  const { recordQuestionAnswer, refreshRun, csrfToken } = useRuns();
  const [questionsList, setQuestionsList] = useState<QuestionData[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>(propAnswers);
  const [savingQuestions, setSavingQuestions] = useState<Record<string, boolean>>({});
  const [hasUnappliedChanges, setHasUnappliedChanges] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [refreshSuccess, setRefreshSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load canonical questions and options from backend API
  useEffect(() => {
    let isMounted = true;
    fetch(`/api/runs/${runId}/questions`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted) return;
        if (data && data.success && Array.isArray(data.questions) && data.questions.length > 0) {
          setQuestionsList(data.questions);
          const initialAnswers: Record<string, string> = { ...propAnswers };
          for (const q of data.questions) {
            if (q.currentAnswer && !initialAnswers[q.question]) {
              initialAnswers[q.question] = q.currentAnswer;
            }
          }
          setAnswers(initialAnswers);
        } else if (propQuestions && propQuestions.length > 0) {
          // Fallback if questions API returns empty but props has questions
          const fallbackList: QuestionData[] = propQuestions.map((q) => ({
            question: q,
            options: [
              {
                label: 'Recommended default',
                description: 'Follow authoritative industry best practices for high-reliability systems.',
                isRecommended: true,
              },
              {
                label: 'Conservative safety limit',
                description: 'Prioritize resource containment and fail-safe boundaries over high throughput.',
              },
            ],
            currentAnswer: propAnswers[q],
          }));
          setQuestionsList(fallbackList);
        }
      })
      .catch((err) => {
        console.warn('Failed to load questions from backend:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [runId]);

  if (!questionsList || questionsList.length === 0) {
    return null;
  }

  const isSavingAny = Object.values(savingQuestions).some(Boolean);

  const handleSelectOption = async (question: string, optionLabel: string) => {
    setSavingQuestions((prev) => ({ ...prev, [question]: true }));
    setError(null);
    try {
      await recordQuestionAnswer(runId, question, optionLabel);
      setAnswers((prev) => ({ ...prev, [question]: optionLabel }));
      setHasUnappliedChanges(true);
      setRefreshSuccess(false);
      if (onAnswerSaved) {
        onAnswerSaved(question, optionLabel);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save answer');
    } finally {
      setSavingQuestions((prev) => ({ ...prev, [question]: false }));
    }
  };

  const handleRefreshArchitecture = async () => {
    if (isSavingAny || isRefreshing) return;
    setIsRefreshing(true);
    setError(null);
    setRefreshSuccess(false);
    try {
      const res = await fetch(`/api/runs/${runId}/refresh-architecture`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
        },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to refresh architecture with decisions.');
      }
      await refreshRun(runId);
      setHasUnappliedChanges(false);
      setRefreshSuccess(true);
      if (onArchitectureRefreshed) {
        onArchitectureRefreshed();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to refresh architecture');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <section className="user-decisions-section" aria-labelledby="decisions-heading">
      <div className="user-decisions-header">
        <div className="decisions-kicker">
          <HelpCircle size={15} className="text-warning" />
          <span className="text-warning font-medium">Needs Your Input</span>
        </div>
        <h2 id="decisions-heading" className="user-decisions-title">
          {questionsList.length === 1 ? 'One decision needed from you' : `${questionsList.length} decisions needed from you`}
        </h2>
        <p className="user-decisions-subtitle">
          ArchitectAI identified edge cases where your product requirements determine the architecture.
        </p>
      </div>

      {error && (
        <div className="error-alert-banner" role="alert" style={{ marginBottom: '16px' }}>
          <AlertCircle size={16} className="icon-danger" />
          <span>{error}</span>
        </div>
      )}

      {refreshSuccess && (
        <div className="success-alert-banner" style={{ marginBottom: '16px', padding: '12px 16px', background: 'rgba(63, 185, 80, 0.15)', border: '1px solid #3fb950', borderRadius: '6px', color: '#3fb950', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Check size={16} />
          <span>Architecture updated with your decisions. Ready to build.</span>
        </div>
      )}

      <div className="questions-list">
        {questionsList.map((item, qIdx) => {
          const currentAnswer = answers[item.question];
          const isSaving = savingQuestions[item.question];

          return (
            <div key={qIdx} className={`question-card ${currentAnswer ? 'question-answered' : ''}`}>
              <div className="question-header">
                <span className="question-counter font-mono">Decision #{qIdx + 1}</span>
                <h3 className="question-text">{item.question}</h3>
              </div>

              <div className="question-options-grid">
                {item.options.map((opt, oIdx) => {
                  const isSelected = currentAnswer === opt.label;
                  return (
                    <button
                      key={oIdx}
                      type="button"
                      disabled={isSaving}
                      className={`option-btn ${isSelected ? 'option-selected' : ''}`}
                      onClick={() => handleSelectOption(item.question, opt.label)}
                    >
                      <div className="option-btn-top">
                        <strong className="option-label">{opt.label}</strong>
                        {opt.isRecommended && (
                          <span className="rec-tag">
                            <Sparkles size={11} />
                            Recommended
                          </span>
                        )}
                        {isSelected && (
                          <span className="selected-check">
                            <Check size={14} />
                          </span>
                        )}
                      </div>
                      <p className="option-desc">{opt.description}</p>
                    </button>
                  );
                })}
              </div>

              {isSaving && (
                <div className="saving-answer-indicator font-mono" style={{ fontSize: '11px', color: 'var(--text-muted, #8b949e)', marginTop: '8px' }}>
                  Saving decision...
                </div>
              )}

              {currentAnswer && !isSaving && (
                <div className="saved-answer-indicator font-mono" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Check size={12} className="text-success" />
                    <span>Selected: {currentAnswer}</span>
                  </span>
                  {hasUnappliedChanges && (
                    <span className="text-warning" style={{ fontSize: '11px', fontWeight: 600 }}>
                      Recorded — architecture needs refresh
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Explicit Architecture Refresh CTA per Item 3 */}
      <div className="decisions-footer-cta-card" style={{ marginTop: '20px', padding: '16px', background: 'var(--bg-dark, #0d1117)', border: '1px solid var(--border-color, #30363d)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <strong style={{ fontSize: '14px', color: '#fff' }}>Apply Decisions & Refresh Architecture</strong>
          <p style={{ fontSize: '12px', color: 'var(--text-muted, #8b949e)', margin: '2px 0 0' }}>
            Updates the formal Engineering Contract with your decisions before generating implementation tasks.
          </p>
        </div>
        <Button
          type="button"
          variant="primary"
          onClick={handleRefreshArchitecture}
          isLoading={isRefreshing}
          disabled={isRefreshing || isSavingAny}
          icon={<RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />}
        >
          {isRefreshing ? 'Refreshing Architecture...' : 'Apply Decisions & Refresh Architecture'}
        </Button>
      </div>
    </section>
  );
};
