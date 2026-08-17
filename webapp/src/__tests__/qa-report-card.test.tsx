import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import QAReportCard from '../components/QAReportCard.js';
import type { QARunReport } from '@adtraffic/shared';

const REPORT: QARunReport = {
  runId: 'run-1', status: 'warned', trigger: 'auto', advisory: true,
  campaignId: '101', touched: [{ toolName: 'cm360_update_ad', entityType: 'ad', entityId: '2001' }],
  checks: [
    { checkKey: 'config.click_through.ad:2001', category: 'config', status: 'pass', message: 'Click-through resolves via landing_page' },
    { checkKey: 'config.suffix_override.ad:2001', category: 'config', status: 'warn', message: 'campaign-level URL suffix overrides the advertiser default' },
    { checkKey: 'utm.partial_tagging', category: 'tracking', status: 'fail', message: 'Partial UTM tagging breaks GA4 attribution' },
  ],
  startedAt: Date.now(),
};

describe('QAReportCard', () => {
  it('shows the run status, counts, and advisory label', () => {
    render(<QAReportCard report={REPORT} />);
    expect(screen.getByText(/Trafficking QA/)).toBeInTheDocument();
    expect(screen.getByText(/1 passed · 1 warning · 1 failed/)).toBeInTheDocument();
    expect(screen.getByText(/Advisory/)).toBeInTheDocument();
  });

  it('groups checks by category with readable labels', () => {
    render(<QAReportCard report={REPORT} />);
    expect(screen.getByText('Configuration')).toBeInTheDocument();
    expect(screen.getByText('Tracking / UTM')).toBeInTheDocument();
    expect(screen.getByText(/Click-through resolves/)).toBeInTheDocument();
    expect(screen.getByText(/Partial UTM tagging/)).toBeInTheDocument();
  });
});

const CLICK_REPORT: QARunReport = {
  runId: 'run-2', status: 'running', trigger: 'auto', advisory: true,
  touched: [{ toolName: 'cm360_update_ad', entityType: 'ad', entityId: '2001' }],
  checks: [
    { checkKey: 'config.click_through.ad:2001', category: 'config', status: 'pass', message: 'resolves' },
    { checkKey: 'clickthrough.click_test.ad:2001', category: 'clickthrough', status: 'skipped', message: 'Click test queued — results will attach to this run shortly', detail: { queued: true } },
  ],
  startedAt: Date.now(),
};

describe('QAReportCard — Phase 2', () => {
  it('labels a running report and shows the queued click test', () => {
    render(<QAReportCard report={CLICK_REPORT} />);
    expect(screen.getByText(/Click tests running/)).toBeInTheDocument();
    expect(screen.getByText(/Click test queued/)).toBeInTheDocument();
  });

  it('renders an evidence button and a redirect chain for completed click checks', () => {
    const done: QARunReport = {
      ...CLICK_REPORT, status: 'passed',
      checks: [
        { checkKey: 'landing.renders.ad:2001', category: 'landing', status: 'pass', message: 'rendered', evidenceId: 'ev-1' },
        { checkKey: 'clickthrough.click_test.ad:2001', category: 'clickthrough', status: 'pass', message: 'Click test: 2 hop(s)',
          detail: { chain: [ { url: 'https://ad.doubleclick.net/ddm/trackclk/x', status: 302, via: 'click', https: true },
                             { url: 'https://www.apexmotors.com/offers', status: 200, via: 'http_3xx', https: true } ] } },
      ],
    };
    render(<QAReportCard report={done} />);
    expect(screen.getByRole('button', { name: /screenshot/i })).toBeInTheDocument();
    expect(screen.getByText(/redirect chain \(2 hops\)/i)).toBeInTheDocument();
  });

  it('polls the run while status is running and hands the update up', async () => {
    vi.useFakeTimers();
    try {
      const updated = { ...CLICK_REPORT, status: 'passed' as const };
      const authFetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ run: updated }) });
      // Cast so the webapp typecheck accepts the mock as the prop's fetch type
      const authFetch = authFetchMock as unknown as (url: string, options?: RequestInit) => Promise<Response>;
      const onReportUpdate = vi.fn();
      render(<QAReportCard report={CLICK_REPORT} authFetch={authFetch} onReportUpdate={onReportUpdate} />);
      await vi.advanceTimersByTimeAsync(3100);
      // VITE_API_URL is unset under vitest, so API_URL === '' and the path is bare
      expect(authFetchMock).toHaveBeenCalledWith('/api/v1/qa/runs/run-2');
      expect(onReportUpdate).toHaveBeenCalledWith(updated);
    } finally {
      vi.useRealTimers();
    }
  });
});
