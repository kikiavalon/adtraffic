import type { ResolvedFlags } from '../feature-flags/flag-registry.js';

declare global {
  namespace Express {
    interface Request {
      user?: { userId: string; email: string; role: string };
      requestId?: string;
      featureFlags?: ResolvedFlags;
    }
  }
}
export {};
