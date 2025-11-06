#!/usr/bin/env node
import { build } from 'esbuild';
import { copyFileSync, rmSync, mkdirSync } from 'fs';

// Clean dist directory
try {
  rmSync('dist', { recursive: true, force: true });
} catch (e) {
  // Directory might not exist
}

// Recreate dist directory
mkdirSync('dist', { recursive: true });

const commonConfig = {
  bundle: true,
  platform: 'browser',
  target: 'es2020',
  sourcemap: true,
};

// Build content script
await build({
  ...commonConfig,
  entryPoints: ['src/content.ts'],
  outfile: 'dist/content.js',
  format: 'iife',
});

// Build background script
await build({
  ...commonConfig,
  entryPoints: ['src/background.ts'],
  outfile: 'dist/background.js',
  format: 'iife',
});

// Build options script
await build({
  ...commonConfig,
  entryPoints: ['src/options.ts'],
  outfile: 'dist/options.js',
  format: 'iife',
});

// Copy HTML file
copyFileSync('src/options.html', 'dist/options.html');

console.log('Build complete!');
