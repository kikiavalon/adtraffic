import { describe, it, expect } from 'vitest';
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
