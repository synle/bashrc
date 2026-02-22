import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import fs from 'fs';
import path from 'path';

// Plugin to update service worker with build timestamp
const updateServiceWorker = () => ({
  name: 'update-service-worker',
  closeBundle() {
    const swSourcePath = './webapp/sw-bashrc.js';
    const swDestPath = './dist/sw-bashrc.js';

    if (fs.existsSync(swSourcePath)) {
      let content = fs.readFileSync(swSourcePath, 'utf-8');
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

export default defineConfig({
  root: 'webapp',
  plugins: [react(), viteSingleFile(), updateServiceWorker()],
  define: {
    // NOTE - IMPORTANT: This is where you update the bash profile code repo raw url
    'window.BASH_PROFILE_CODE_REPO_RAW_URL': JSON.stringify(
      process.env.BASH_PROFILE_CODE_REPO_RAW_URL || 'https://raw.githubusercontent.com/synle/bashrc/master',
    ),
  },
  build: {
    outDir: '../dist',
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
