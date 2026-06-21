import express from 'express';
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
// ✅ FIXED: Create __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export function serveStatic(app) {
    // ✅ Point to client/dist instead of server/public
    const distPath = path.resolve(__dirname, "../client/dist");
    if (!fs.existsSync(distPath)) {
        throw new Error(`Could not find the build directory: ${distPath}, make sure to build the client first`);
    }
    app.use(express.static(distPath));
    // fall through to index.html if the file doesn't exist (SPA fallback)
    app.use("*", (_req, res) => {
        res.sendFile(path.resolve(distPath, "index.html"));
    });
}
