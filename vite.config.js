import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// Plugin to update service worker with build timestamp
const updateServiceWorker = () => ({
  name: "update-service-worker",
  closeBundle() {
    const swSourcePath = "./webapp/sw-bashrc.js";
    const swDestPath = "./dist/sw-bashrc.js";

    if (fs.existsSync(swSourcePath)) {
      let content = fs.readFileSync(swSourcePath, "utf-8");
      const timestamp = Date.now();
      content = content.replace(/__BUILD_TIMESTAMP__/g, timestamp);

      // Ensure dist directory exists
      const distDir = path.dirname(swDestPath);
      if (!fs.existsSync(distDir)) {
        fs.mkdirSync(distDir, { recursive: true });
      }

      fs.writeFileSync(swDestPath, content);
      console.log(`Service Worker copied to dist and updated with build timestamp: ${timestamp}`);
    } else {
      console.warn(`Service Worker not found at ${swSourcePath}`);
    }
  },
});

const requiredEnvKeys = ["REPO_PATH_IDENTIFIER", "REPO_BRANCH_NAME"];
const requiredEnvs = {};
for (const envKey of requiredEnvKeys) {
  process.env[envKey] = (process.env[envKey] || "").trim();
  if (!process.env[envKey]) {
    throw new Error(`${envKey} environment variable is not defined. Run software/bootstrap/common-env.sh first.`);
  }
  requiredEnvs[`window.${envKey}`] = JSON.stringify(process.env[envKey]);
}

export default defineConfig({
  root: "webapp",
  plugins: [react(), viteSingleFile(), updateServiceWorker()],
  define: {
    ...requiredEnvs,
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    assetsInlineLimit: 100000000,
    rollupOptions: {
      output: {
        manualChunks: undefined,
        inlineDynamicImports: true,
      },
    },
  },
});
