import { authenticate } from './authenticate';
import { authorize } from './authorize';

/** Auth + admin role check before any admin-only mutation handler. */
export const requireAdmin = [authenticate, authorize('ADMIN')] as const;
