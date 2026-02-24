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

const requiredEnvVars = ['REPO_PATH_IDENTIFIER', 'REPO_BRANCH_NAME', 'BASH_SYLE_COMMON'];
for (const name of requiredEnvVars) {
  console.log('>>> [requiredEnvVars]=', name, process.env[name]);
  // if (!process.env[name]) {
  //   throw new Error(`${name} environment variable is not defined. Run bootstrap/common-env.sh first.`);
  // }
}

export default defineConfig({
  root: 'webapp',
  plugins: [react(), viteSingleFile(), updateServiceWorker()],
  define: {
    // NOTE: we need the fallback for deployment
    'window.REPO_PATH_IDENTIFIER': JSON.stringify((process.env.REPO_PATH_IDENTIFIER || 'synle/bashrc').trim()),
    'window.REPO_BRANCH_NAME': JSON.stringify((process.env.REPO_BRANCH_NAME || 'master').trim()),
    'window.BASH_SYLE_COMMON': JSON.stringify((process.env.BASH_SYLE_COMMON || '~/.bash_syle_common').trim()),
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
