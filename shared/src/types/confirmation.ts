/** Categories of write operations by risk level */
export type OperationRiskLevel = 'standard' | 'elevated' | 'destructive';

/** A pending write operation awaiting user confirmation */
export interface PendingAction {
  /** Unique token for this pending action */
  actionId: string;
  /** The CM360 tool that will be called */
  toolName: string;
  /** Human-readable description of what will happen */
  description: string;
  /** Structured preview of the changes */
  preview: ActionPreview;
  /** Risk level determines confirmation UI complexity */
  riskLevel: OperationRiskLevel;
  /** Timestamp when this action was proposed */
  proposedAt: number;
  /** Expires after 5 minutes (user must re-request) */
  expiresAt: number;
}

/** Structured preview of proposed changes */
export interface ActionPreview {
  /** What entity type is being modified */
  entityType: string;
  /** Entity name for display (e.g., "Apex Motors Q1 Display Campaign") */
  entityName: string;
  /** What operation: create, update, archive, delete */
  operation: 'create' | 'update' | 'archive' | 'delete';
  /** For updates: old value -> new value pairs */
  changes?: Array<{ field: string; from?: string; to: string }>;
  /** For creates: key fields being set */
  fields?: Array<{ field: string; value: string }>;
  /** Warnings (e.g., "This will affect 3 live placements") */
  warnings?: string[];
}

/** User's confirmation decision */
export interface ConfirmationDecision {
  actionId: string;
  approved: boolean;
  /** For destructive ops: the typed confirmation text (e.g., "DELETE") */
  typedConfirmation?: string;
  /** Timestamp of user's decision */
  decidedAt: number;
}

/** SSE event for confirmation requests */
export interface ConfirmationRequestEvent {
  type: 'confirmation_required';
  action: PendingAction;
}

/** SSE event for confirmation result */
export interface ConfirmationResultEvent {
  type: 'confirmation_result';
  actionId: string;
  approved: boolean;
}
