import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, "client"),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client/src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  server: {
    port: 5000,
    host: "0.0.0.0",
  },
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom"],
          "audio-vendor": ["tone", "webmidi"],
          "ui-vendor": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-slider",
            "@radix-ui/react-tabs",
          ],
        },
      },
    },
  },
  optimizeDeps: {
    include: ["tone", "webmidi", "zustand"],
  },
});
