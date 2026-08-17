import { useEffect } from 'react';
import type { QACheckResult, QARunReport } from '@adtraffic/shared';
import './QAReportCard.css';

const API_URL = import.meta.env.VITE_API_URL ?? '';

const CATEGORY_LABELS: Record<string, string> = {
  config: 'Configuration',
  tracking: 'Tracking / UTM',
  clickthrough: 'Click-through',
  landing: 'Landing page',
};

const STATUS_ICONS: Record<QACheckResult['status'], string> = {
  pass: '✓',    // check mark
  warn: '⚠',    // warning sign
  fail: '✕',    // cross
  skipped: '–', // en dash
};

const RUN_LABELS: Record<string, string> = {
  passed: 'All checks passed',
  warned: 'Passed with warnings',
  failed: 'Issues found',
  error: 'Run errored',
  running: 'Click tests running…',
  pending: 'Queued…',
};

export interface QAReportCardProps {
  report: QARunReport;
  /** AuthContext.authFetch — evidence + polling need the Bearer token; a plain
   * <a href> to the API cannot authenticate. Optional so static renders work. */
  authFetch?: (url: string, options?: RequestInit) => Promise<Response>;
  /** Replaces the report in parent state when polling sees the run finish. */
  onReportUpdate?: (report: QARunReport) => void;
}

export default function QAReportCard({ report, authFetch, onReportUpdate }: QAReportCardProps) {
  const polling = report.status === 'running' || report.status === 'pending';
  useEffect(() => {
    if (!polling || !authFetch || !onReportUpdate) return;
    let ticks = 0;
    const interval = setInterval(() => {
      ticks += 1;
      if (ticks > 60) { clearInterval(interval); return; } // give up after ~3 min; the run detail page still has it
      void authFetch(`${API_URL}/api/v1/qa/runs/${report.runId}`)
        .then((res) => (res.ok ? (res.json() as Promise<{ run: QARunReport }>) : null))
        .then((body) => { if (body?.run && body.run.status !== report.status) onReportUpdate(body.run); })
        .catch(() => undefined);
    }, 3000);
    return () => clearInterval(interval);
  }, [polling, report.runId, report.status, authFetch, onReportUpdate]);

  const openEvidence = async (evidenceId: string): Promise<void> => {
    if (!authFetch) return;
    try {
      const res = await authFetch(`${API_URL}/api/v1/qa/runs/${report.runId}/evidence/${evidenceId}`);
      if (!res.ok) return;
      const url = URL.createObjectURL(await res.blob());
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch { /* evidence is optional */ }
  };

  const counts: Record<QACheckResult['status'], number> = { pass: 0, warn: 0, fail: 0, skipped: 0 };
  const grouped = new Map<string, QACheckResult[]>();
  for (const check of report.checks) {
    counts[check.status] += 1;
    const list = grouped.get(check.category) ?? [];
    list.push(check);
    grouped.set(check.category, list);
  }

  const countText = [
    `${counts.pass} passed`,
    `${counts.warn} warning${counts.warn === 1 ? '' : 's'}`,
    `${counts.fail} failed`,
    ...(counts.skipped > 0 ? [`${counts.skipped} skipped`] : []),
  ].join(' · ');

  return (
    <div
      className={`qa-report-card qa-report-card--${report.status}`}
      role="region"
      aria-label="Trafficking QA report"
    >
      <div className="qa-report-card__header">
        <span className="qa-report-card__title">
          Trafficking QA — {RUN_LABELS[report.status] ?? report.status}
        </span>
        <span className="qa-report-card__advisory">Advisory — never blocks approvals</span>
      </div>
      <div className="qa-report-card__counts">{countText}</div>
      {[...grouped.entries()].map(([category, checks]) => (
        <div key={category} className="qa-report-card__category">
          <div className="qa-report-card__category-title">{CATEGORY_LABELS[category] ?? category}</div>
          <ul className="qa-report-card__checks">
            {checks.map((check) => (
              <li
                key={check.checkKey}
                className={`qa-report-card__check qa-report-card__check--${check.status}`}
              >
                <span className="qa-report-card__check-icon" aria-hidden="true">
                  {STATUS_ICONS[check.status]}
                </span>
                <span className="qa-report-card__check-message">{check.message}</span>
                {check.evidenceId && (
                  <button
                    type="button"
                    className="qa-report-card__evidence"
                    onClick={() => { void openEvidence(check.evidenceId!); }}
                  >
                    View screenshot
                  </button>
                )}
                {Array.isArray((check.detail as { chain?: unknown[] } | undefined)?.chain) && (
                  <details className="qa-report-card__chain">
                    <summary>redirect chain ({(check.detail!['chain'] as unknown[]).length} hops)</summary>
                    <ol>
                      {(check.detail!['chain'] as Array<{ url: string; status?: number; via: string }>).map((hop, i) => (
                        <li key={i}><code>{hop.status ?? '—'}</code> {hop.via}: {hop.url}</li>
                      ))}
                    </ol>
                  </details>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
