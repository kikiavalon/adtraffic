import { useState, useRef, useEffect } from 'react';
import type { PendingAction } from '@adtraffic/shared';
import './ConfirmationCard.css';

interface ConfirmationCardProps {
  action: PendingAction;
  onApprove: (actionId: string, typedConfirmation?: string) => void;
  onReject: (actionId: string) => void;
  disabled?: boolean;
  /** Which data mode the write will hit — shown inside the card so the
   * consequence of approving is unambiguous. */
  mode?: 'live' | 'demo';
}

const RISK_ICONS: Record<string, string> = {
  standard: '\u26A1',   // lightning bolt
  elevated: '\u26A0\uFE0F', // warning triangle
  destructive: '\uD83D\uDD34', // red circle
};

export default function ConfirmationCard({
  action,
  onApprove,
  onReject,
  disabled = false,
  mode,
}: ConfirmationCardProps) {
  const [submitted, setSubmitted] = useState(false);
  const [typedConfirmation, setTypedConfirmation] = useState('');
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    cardRef.current?.focus();
  }, []);

  const { preview, riskLevel, actionId } = action;
  const isDestructive = riskLevel === 'destructive';
  const expectedPhrase = preview.operation.toUpperCase();
  const confirmationValid = typedConfirmation === expectedPhrase;

  function handleApprove() {
    if (submitted || disabled) return;
    setSubmitted(true);
    onApprove(actionId, isDestructive ? typedConfirmation : undefined);
  }

  function handleReject() {
    if (submitted || disabled) return;
    setSubmitted(true);
    onReject(actionId);
  }

  const titleVerb = preview.operation.charAt(0).toUpperCase() + preview.operation.slice(1);
  const title = `Kiki wants to ${titleVerb} a ${preview.entityType}`;

  return (
    <div
      className={`confirmation-card confirmation-card--${riskLevel}`}
      role="region"
      aria-label={`Confirmation: ${title}`}
      ref={cardRef}
      tabIndex={-1}
    >
      {/* Header */}
      <div className="confirmation-card__header">
        <span className="confirmation-card__icon" aria-hidden="true">
          {RISK_ICONS[riskLevel] ?? RISK_ICONS.standard}
        </span>
        <span className="confirmation-card__title">{title}</span>
        {mode && (
          <span className={`confirmation-card__mode confirmation-card__mode--${mode}`}>
            {mode === 'live' ? 'Live data' : 'Demo data'}
          </span>
        )}
      </div>

      {/* Entity name */}
      <div className="confirmation-card__entity-name">{preview.entityName}</div>

      {/* Warnings */}
      {preview.warnings && preview.warnings.length > 0 && (
        <ul className="confirmation-card__warnings" role="alert">
          {preview.warnings.map((warning, i) => (
            <li key={i} className="confirmation-card__warning-item">{warning}</li>
          ))}
        </ul>
      )}

      {/* Create fields */}
      {preview.fields && preview.fields.length > 0 && (
        <table className="confirmation-card__fields">
          <tbody>
            {preview.fields.map((f) => (
              <tr key={f.field}>
                <td className="confirmation-card__field-name">{f.field}</td>
                <td className="confirmation-card__field-value">{f.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Update changes */}
      {preview.changes && preview.changes.length > 0 && (
        <table className="confirmation-card__changes">
          <tbody>
            {preview.changes.map((c) => (
              <tr key={c.field}>
                <td className="confirmation-card__change-field">{c.field}</td>
                <td className="confirmation-card__change-from">{c.from ?? '\u2014'}</td>
                <td className="confirmation-card__change-arrow" aria-hidden="true">{'\u2192'}</td>
                <td className="confirmation-card__change-to">{c.to}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Destructive typed confirmation */}
      {isDestructive && (
        <div className="confirmation-card__type-confirm">
          <label htmlFor={`confirm-${actionId}`} className="confirmation-card__type-label">
            Type {expectedPhrase} to confirm:
          </label>
          <input
            id={`confirm-${actionId}`}
            className="confirmation-card__type-input"
            type="text"
            placeholder={`Type ${expectedPhrase} to confirm`}
            value={typedConfirmation}
            onChange={(e) => setTypedConfirmation(e.target.value)}
            disabled={submitted || disabled}
            autoComplete="off"
          />
        </div>
      )}

      {/* Action buttons — Cancel first so the safe path is the first target */}
      <div className="confirmation-card__actions">
        {isDestructive ? (
          <>
            <button
              className="confirmation-card__btn confirmation-card__btn--cancel"
              onClick={handleReject}
              disabled={submitted || disabled}
              aria-label="Cancel"
            >
              Cancel
            </button>
            <button
              className="confirmation-card__btn confirmation-card__btn--destructive"
              onClick={handleApprove}
              disabled={submitted || disabled || !confirmationValid}
              aria-label={`${titleVerb} ${preview.entityType}`}
            >
              {titleVerb} {preview.entityType}
            </button>
          </>
        ) : (
          <>
            <button
              className="confirmation-card__btn confirmation-card__btn--reject"
              onClick={handleReject}
              disabled={submitted || disabled}
              aria-label="Cancel"
            >
              Cancel
            </button>
            <button
              className="confirmation-card__btn confirmation-card__btn--approve"
              onClick={handleApprove}
              disabled={submitted || disabled}
              aria-label="Approve"
            >
              Approve
            </button>
          </>
        )}
      </div>
    </div>
  );
}
