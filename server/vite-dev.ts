import { type Express } from "express";
import { type Server } from "http";
import { createServer as createViteServer, createLogger } from "vite";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { nanoid } from "nanoid";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const CLIENT_ROOT = path.resolve(__dirname, "..", "client");

export async function setupVite(server: Server, app: Express) {
  const viteLogger = createLogger();

  const vite = await createViteServer({
    root:       CLIENT_ROOT,
    configFile: path.resolve(CLIENT_ROOT, "vite.config.ts"),
    customLogger: {
      ...viteLogger,
      error: (msg: string, options?: { error?: Error }) => {
        if (options?.error) {
          viteLogger.error(msg, options);
          process.exit(1);
        } else {
          viteLogger.warn(msg);
        }
      },
    },
    server: {
      allowedHosts: true as true,
      middlewareMode: true,
      hmr: { server, path: "/vite-hmr" },
    },
    appType: "custom",
  });

  app.use(vite.middlewares);

  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path.resolve(CLIENT_ROOT, "index.html");
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}
