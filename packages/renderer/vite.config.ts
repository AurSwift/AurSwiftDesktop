import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { visualizer } from "rollup-plugin-visualizer";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";

// Read version from root package.json
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootPackageJson = JSON.parse(
  readFileSync(path.resolve(__dirname, "../../package.json"), "utf-8")
);
const appVersion = rootPackageJson.version || "0.0.0";

// Set the version as an environment variable for Vite to pick up
// Vite automatically exposes process.env.VITE_* variables as import.meta.env.VITE_*
process.env.VITE_APP_VERSION = appVersion;

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    // Bundle visualizer - only runs when ANALYZE env var is set
    process.env.ANALYZE === "true" &&
      visualizer({
        open: true,
        filename: "./dist/stats.html",
        gzipSize: true,
        brotliSize: true,
      }),
  ].filter(Boolean),
  esbuild: mode === "production" ? { pure: ["console.log"] } : {},
  define: {
    // Provide global and process for Node.js polyfills
    global: "globalThis",
    "process.env": "{}",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@app/shared": path.resolve(__dirname, "../shared/src"),
    },
  },
  build: {
    // Enable minification for production
    minify: "esbuild", // esbuild is faster than terser
    // Report compressed size (disabled for faster builds, enable if needed)
    reportCompressedSize: false,
    // Chunk size warning limit (in KB)
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Manual chunk splitting for better caching
        manualChunks: {
          // Vendor chunk for React and core libraries
          vendor: ["react", "react-dom", "react-router-dom"],
          // UI library chunk
          "ui-vendor": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-select",
            "@radix-ui/react-tabs",
          ],
        },
      },
    },
  },
  // Optimize dependencies
  optimizeDeps: {
    // Pre-bundle these dependencies for faster dev server
    include: ["react", "react-dom", "react-router-dom"],
    esbuildOptions: {
      // Provide Buffer polyfill
      define: {
        global: "globalThis",
      },
    },
  },
}));
