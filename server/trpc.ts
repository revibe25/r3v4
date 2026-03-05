import { initTRPC } from '@trpc/server';
import type { Request, Response } from 'express';

// Context shape — available in every procedure
export interface TRPCContext {
  req: Request;
  res: Response;
}

export function createContext({ req, res }: TRPCContext): TRPCContext {
  return { req, res };
}

const t = initTRPC.context<TRPCContext>().create();

export const router     = t.router;
export const publicProc = t.procedure;
