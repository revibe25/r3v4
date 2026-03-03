import { type Express } from "express";
import { type Server } from "http";
import { createServer as createViteServer, createLogger } from "vite";
import * as fs from "fs";
import * as path from "path";
import { nanoid } from "nanoid";

export async function setupVite(server: Server, app: Express) {
  const viteLogger = createLogger();

  const vite = await createViteServer({
    configFile: path.resolve(process.cwd(), "vite.config.ts"),
    customLogger: {
      ...viteLogger,
      error: (msg: string, options?: { error?: Error }) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: {
      allowedHosts: true as any,
      middlewareMode: true,
      hmr: { server, path: "/vite-hmr" },
    },
    appType: "custom",
  });

  app.use(vite.middlewares);

  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path.resolve(process.cwd(), "client", "index.html");
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
