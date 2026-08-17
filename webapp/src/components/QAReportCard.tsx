import type { QACheckResult, QARunReport } from '@adtraffic/shared';
import './QAReportCard.css';

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
};

export default function QAReportCard({ report }: { report: QARunReport }) {
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
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
