import React, { useState } from 'react';
import { HelpCircle, Check, Sparkles } from 'lucide-react';
import { useRuns } from '../../store/runs';

interface UserDecisionsViewProps {
  runId: string;
  questions: string[];
  userAnswers: Record<string, string>;
  onAnswerSaved?: (question: string, answer: string) => void;
}

interface QuestionOption {
  label: string;
  description: string;
  isRecommended?: boolean;
}

function deriveOptionsForQuestion(question: string): QuestionOption[] {
  const q = question.toLowerCase();
  if (q.includes('redis') || q.includes('database') || q.includes('unavailable') || q.includes('down')) {
    return [
      {
        label: 'Fail closed',
        description: 'Block incoming requests until state store recovers to guarantee quotas.',
        isRecommended: true,
      },
      {
        label: 'Fail open',
        description: 'Allow requests through temporarily to prioritize user availability over strict quotas.',
      },
      {
        label: 'Local degraded rate limiter',
        description: 'Fall back to an in-memory process counter with conservative local ceilings.',
      },
    ];
  }
  if (q.includes('timeout') || q.includes('latency') || q.includes('stall')) {
    return [
      {
        label: 'Strict timeout with abort',
        description: 'Abort request after 2,500ms and return 504 Gateway Timeout.',
        isRecommended: true,
      },
      {
        label: 'Exponential retry with jitter',
        description: 'Retry up to 3 times before returning an error to the caller.',
      },
      {
        label: 'Let ArchitectAI decide',
        description: 'Use the default bounded timeout derived from standard SLA patterns.',
      },
    ];
  }
  if (q.includes('idempot') || q.includes('duplicate') || q.includes('key')) {
    return [
      {
        label: 'Reject duplicate request',
        description: 'Return HTTP 409 Conflict with the original transaction reference.',
        isRecommended: true,
      },
      {
        label: 'Replay original response',
        description: 'Return the previously cached success response without re-executing.',
      },
      {
        label: 'Let ArchitectAI decide',
        description: 'Implement atomic payment state lock with standard deduplication.',
      },
    ];
  }
  return [
    {
      label: 'Recommended default',
      description: 'Follow authoritative industry best practices for high-reliability systems.',
      isRecommended: true,
    },
    {
      label: 'Conservative safety limit',
      description: 'Prioritize resource containment and fail-safe boundaries over high throughput.',
    },
  ];
}

export const UserDecisionsView: React.FC<UserDecisionsViewProps> = ({
  runId,
  questions,
  userAnswers,
  onAnswerSaved,
}) => {
  const { recordQuestionAnswer } = useRuns();
  const [savingQuestions, setSavingQuestions] = useState<Record<string, boolean>>({});

  if (!questions || questions.length === 0) {
    return null;
  }

  const handleSelectOption = async (question: string, optionLabel: string) => {
    setSavingQuestions((prev) => ({ ...prev, [question]: true }));
    try {
      await recordQuestionAnswer(runId, question, optionLabel);
      if (onAnswerSaved) {
        onAnswerSaved(question, optionLabel);
      }
    } finally {
      setSavingQuestions((prev) => ({ ...prev, [question]: false }));
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
          {questions.length === 1 ? 'One decision needed from you' : `${questions.length} decisions needed from you`}
        </h2>
        <p className="user-decisions-subtitle">
          ArchitectAI identified edge cases where your product requirements determine the architecture.
        </p>
      </div>

      <div className="questions-list">
        {questions.map((question, qIdx) => {
          const currentAnswer = userAnswers[question];
          const options = deriveOptionsForQuestion(question);
          const isSaving = savingQuestions[question];

          return (
            <div key={qIdx} className={`question-card ${currentAnswer ? 'question-answered' : ''}`}>
              <div className="question-header">
                <span className="question-counter font-mono">Decision #{qIdx + 1}</span>
                <h3 className="question-text">{question}</h3>
              </div>

              <div className="question-options-grid">
                {options.map((opt, oIdx) => {
                  const isSelected = currentAnswer === opt.label;
                  return (
                    <button
                      key={oIdx}
                      type="button"
                      disabled={isSaving}
                      className={`option-btn ${isSelected ? 'option-selected' : ''}`}
                      onClick={() => handleSelectOption(question, opt.label)}
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

              {currentAnswer && (
                <div className="saved-answer-indicator font-mono">
                  <Check size={12} className="text-success" />
                  <span>Decision recorded: {currentAnswer}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
