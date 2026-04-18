/* server/types/custom-modules.d.ts
   - Provide fallback module declarations for packages that may not expose types
   - This file is intentionally narrow and only declares missing modules to allow
     the TypeScript build to proceed while proper types are installed.
*/
declare module "compression";
declare module "morgan";
declare module "express-rate-limit";
declare module "drizzle-zod";
