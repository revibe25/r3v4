import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "../shared"),
    },
    // Explicitly define extensions to resolve
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json']
  },
  
  server: {
    port: 5000,
    host: "0.0.0.0",
    strictPort: true, // Fail if port is already in use
    
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        secure: false,
      },
    },
    
    // Ensure proper MIME types are served
    headers: {
      'Cache-Control': 'no-store', // Prevent stale module caching during dev
    },
    
    // Enable CORS for localhost development
    cors: true,
    
    // Force optimization on server start
    warmup: {
      clientFiles: [
        './src/App.tsx',
        './src/main.tsx',
        './src/components/**/*.tsx',
      ],
    },
  },
  
  build: {
    outDir: path.resolve(__dirname, "dist"),
    sourcemap: true,
    
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom"],
          "audio-vendor": ["tone", "webmidi"],
          "radix-vendor": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-slider",
            "@radix-ui/react-tabs",
            "@radix-ui/react-select",
            "@radix-ui/react-popover",
          ],
          "form-vendor": [
            "react-hook-form",
            "@hookform/resolvers",
            "zod",
          ],
          // Add wouter if you're using it
          "router-vendor": ["wouter"],
        },
      },
    },
  },
  
  optimizeDeps: {
    include: [
      "tone",
      "webmidi",
      "zustand",
      "react",
      "react-dom",
      "framer-motion",
      "wouter", // Add if you're using wouter
    ],
    // Force pre-bundling to avoid runtime issues
    force: false, // Set to true temporarily if you have cache issues
  },
  
  // Ensure proper handling of TS/TSX files
  esbuild: {
    logOverride: { 'this-is-undefined-in-esm': 'silent' }
  },
});