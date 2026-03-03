import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PendingAction } from '@adtraffic/shared';
import ConfirmationCard from '../components/ConfirmationCard.js';

function makeAction(overrides: Partial<PendingAction> = {}): PendingAction {
  return {
    actionId: 'act-001',
    toolName: 'cm360_create_campaign',
    description: 'Create a new campaign for Apex Motors',
    riskLevel: 'standard',
    proposedAt: Date.now(),
    expiresAt: Date.now() + 300_000,
    preview: {
      entityType: 'Campaign',
      entityName: 'Apex Motors Q1 Display',
      operation: 'create',
      fields: [
        { field: 'Advertiser', value: 'Apex Motors' },
        { field: 'Name', value: 'Apex Motors Q1 Display' },
        { field: 'Start Date', value: '2026-03-01' },
      ],
    },
    ...overrides,
  };
}

describe('ConfirmationCard', () => {
  let onApprove: ReturnType<typeof vi.fn>;
  let onReject: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onApprove = vi.fn();
    onReject = vi.fn();
  });

  it('renders standard create preview with fields', () => {
    const action = makeAction();

    render(
      <ConfirmationCard action={action} onApprove={onApprove} onReject={onReject} />
    );

    // Title should describe the operation
    expect(screen.getByText(/create/i)).toBeInTheDocument();
    expect(screen.getByText(/campaign/i)).toBeInTheDocument();

    // Fields should be rendered
    expect(screen.getByText('Advertiser')).toBeInTheDocument();
    expect(screen.getByText('Apex Motors')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
    // Entity name appears in both the entity name section and the fields table
    expect(screen.getAllByText('Apex Motors Q1 Display').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Start Date')).toBeInTheDocument();
    expect(screen.getByText('2026-03-01')).toBeInTheDocument();

    // Approve and Reject buttons should be present
    expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument();
  });

  it('renders update preview with old to new changes', () => {
    const action = makeAction({
      toolName: 'cm360_update_campaign',
      description: 'Update Apex Motors campaign name',
      preview: {
        entityType: 'Campaign',
        entityName: 'Apex Motors Q1 Display',
        operation: 'update',
        changes: [
          { field: 'Name', from: 'Apex Motors Q1 Display', to: 'Apex Motors Q1 Performance' },
          { field: 'End Date', from: '2026-03-31', to: '2026-04-30' },
        ],
      },
    });

    render(
      <ConfirmationCard action={action} onApprove={onApprove} onReject={onReject} />
    );

    // Should show old -> new values (entity name also appears in entity name section)
    expect(screen.getAllByText('Apex Motors Q1 Display').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Apex Motors Q1 Performance')).toBeInTheDocument();
    expect(screen.getByText('2026-03-31')).toBeInTheDocument();
    expect(screen.getByText('2026-04-30')).toBeInTheDocument();
  });

  it('calls onApprove when Approve button clicked', async () => {
    const action = makeAction();
    const user = userEvent.setup();

    render(
      <ConfirmationCard action={action} onApprove={onApprove} onReject={onReject} />
    );

    await user.click(screen.getByRole('button', { name: /approve/i }));

    expect(onApprove).toHaveBeenCalledOnce();
    expect(onApprove).toHaveBeenCalledWith('act-001', undefined);
  });

  it('calls onReject when Reject button clicked', async () => {
    const action = makeAction();
    const user = userEvent.setup();

    render(
      <ConfirmationCard action={action} onApprove={onApprove} onReject={onReject} />
    );

    await user.click(screen.getByRole('button', { name: /reject/i }));

    expect(onReject).toHaveBeenCalledOnce();
    expect(onReject).toHaveBeenCalledWith('act-001');
  });

  it('shows warnings for elevated operations', () => {
    const action = makeAction({
      riskLevel: 'elevated',
      toolName: 'cm360_update_placement',
      description: 'Archive placement',
      preview: {
        entityType: 'Placement',
        entityName: 'Homepage Banner 728x90',
        operation: 'archive',
        changes: [
          { field: 'Active Status', from: 'ACTIVE', to: 'ARCHIVED' },
        ],
        warnings: [
          'This will affect 3 live placements',
          'Archived placements cannot serve ads',
        ],
      },
    });

    render(
      <ConfirmationCard action={action} onApprove={onApprove} onReject={onReject} />
    );

    // Warnings should be visible
    expect(screen.getByText('This will affect 3 live placements')).toBeInTheDocument();
    expect(screen.getByText('Archived placements cannot serve ads')).toBeInTheDocument();
  });

  it('requires typed confirmation for destructive operations', async () => {
    const action = makeAction({
      riskLevel: 'destructive',
      toolName: 'cm360_delete_event_tag',
      description: 'Delete event tag',
      preview: {
        entityType: 'Event Tag',
        entityName: 'DV360 Click Tracker',
        operation: 'delete',
        warnings: ['This action CANNOT be undone.'],
      },
    });

    const user = userEvent.setup();

    render(
      <ConfirmationCard action={action} onApprove={onApprove} onReject={onReject} />
    );

    // Should show the undoable warning
    expect(screen.getByText('This action CANNOT be undone.')).toBeInTheDocument();

    // Should have text input for typed confirmation
    const input = screen.getByPlaceholderText(/type DELETE to confirm/i);
    expect(input).toBeInTheDocument();

    // Type DELETE and click the delete button
    await user.type(input, 'DELETE');
    await user.click(screen.getByRole('button', { name: /delete forever/i }));

    expect(onApprove).toHaveBeenCalledOnce();
    expect(onApprove).toHaveBeenCalledWith('act-001', 'DELETE');
  });

  it('disables Delete button until correct text typed', async () => {
    const action = makeAction({
      riskLevel: 'destructive',
      toolName: 'cm360_delete_event_tag',
      description: 'Delete event tag',
      preview: {
        entityType: 'Event Tag',
        entityName: 'DV360 Click Tracker',
        operation: 'delete',
        warnings: ['This action CANNOT be undone.'],
      },
    });

    const user = userEvent.setup();

    render(
      <ConfirmationCard action={action} onApprove={onApprove} onReject={onReject} />
    );

    const deleteButton = screen.getByRole('button', { name: /delete forever/i });

    // Initially disabled
    expect(deleteButton).toBeDisabled();

    // Type partial text — still disabled
    const input = screen.getByPlaceholderText(/type DELETE to confirm/i);
    await user.type(input, 'DEL');
    expect(deleteButton).toBeDisabled();

    // Type wrong text — still disabled
    await user.clear(input);
    await user.type(input, 'delete');
    expect(deleteButton).toBeDisabled();

    // Type correct text — enabled
    await user.clear(input);
    await user.type(input, 'DELETE');
    expect(deleteButton).toBeEnabled();
  });

  it('disables buttons after click (prevent double-submit)', async () => {
    const action = makeAction();
    const user = userEvent.setup();

    render(
      <ConfirmationCard action={action} onApprove={onApprove} onReject={onReject} />
    );

    const approveButton = screen.getByRole('button', { name: /approve/i });
    const rejectButton = screen.getByRole('button', { name: /reject/i });

    // Click approve
    await user.click(approveButton);

    // Both buttons should now be disabled
    expect(approveButton).toBeDisabled();
    expect(rejectButton).toBeDisabled();

    // Should only have been called once despite potential rapid clicks
    expect(onApprove).toHaveBeenCalledOnce();
  });

  it('disables buttons after reject click (prevent double-submit)', async () => {
    const action = makeAction();
    const user = userEvent.setup();

    render(
      <ConfirmationCard action={action} onApprove={onApprove} onReject={onReject} />
    );

    const approveButton = screen.getByRole('button', { name: /approve/i });
    const rejectButton = screen.getByRole('button', { name: /reject/i });

    // Click reject
    await user.click(rejectButton);

    // Both buttons should now be disabled
    expect(approveButton).toBeDisabled();
    expect(rejectButton).toBeDisabled();

    // Should only have been called once
    expect(onReject).toHaveBeenCalledOnce();
    // Approve should not have been called
    expect(onApprove).not.toHaveBeenCalled();
  });

  it('respects disabled prop — prevents all interactions', async () => {
    const action = makeAction({
      riskLevel: 'destructive',
      toolName: 'cm360_delete_event_tag',
      description: 'Delete event tag',
      preview: {
        entityType: 'Event Tag',
        entityName: 'DV360 Click Tracker',
        operation: 'delete',
        warnings: ['This action CANNOT be undone.'],
      },
    });

    const user = userEvent.setup();

    render(
      <ConfirmationCard action={action} onApprove={onApprove} onReject={onReject} disabled />
    );

    // All interactive elements should be disabled
    const deleteButton = screen.getByRole('button', { name: /delete forever/i });
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    const input = screen.getByPlaceholderText(/type DELETE to confirm/i);

    expect(deleteButton).toBeDisabled();
    expect(cancelButton).toBeDisabled();
    expect(input).toBeDisabled();

    // Even typing DELETE should not enable the button when disabled
    await user.type(input, 'DELETE');
    expect(deleteButton).toBeDisabled();

    // Callbacks should not fire
    expect(onApprove).not.toHaveBeenCalled();
    expect(onReject).not.toHaveBeenCalled();
  });
});
