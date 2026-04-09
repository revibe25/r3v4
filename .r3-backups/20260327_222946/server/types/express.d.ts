/**
 * server/types/express.d.ts
 *
 * Augments the Express Request interface so req.user is strongly-typed
 * across ALL server middleware and route handlers.
 *
 * §SES.2 fix — this file must live inside server/types/ so that the server
 * tsconfig compilation always picks it up.  If server/tsconfig.json has a
 * restrictive `include` array, ensure it contains "types/**\/*" or "**\/*".
 *
 * Without this file:
 *   • server/middleware/enforceUsage.ts sees req.user as `undefined`
 *   • Any middleware accessing req.user gets an implicit `any` TS error
 */

declare namespace Express {
  interface Request {
    /**
     * Populated by the auth middleware (server/middleware/requireUser.ts)
     * after JWT verification succeeds.  Undefined on unauthenticated routes.
     */
    user?: {
      /** Database user ID (UUID / nanoid string). */
      id: string;
      /** Registered email — may be absent for username-only accounts. */
      email?: string;
      /** Display username. */
      username?: string;
      /**
       * Subscription tier — canonical post-Stripe-migration names.
       *   explorer   ← was 'free'
       *   creator    ← was 'pro'
       *   pro_artist ← was 'studio'
       */
      tier: "explorer" | "creator" | "pro_artist";
      /** JWT issued-at (seconds since epoch). */
      iat?: number;
      /** JWT expiry (seconds since epoch). */
      exp?: number;
    };
  }
}
