import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Connect, Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(projectRoot, '..');
const modelDirectory = path.resolve(repoRoot, 'models');
const modelFiles = ['achilles.csv', 'ctrp.csv'] as const;

function contentTypeFor(fileName: string): string {
  if (fileName.endsWith('.csv')) {
    return 'text/csv; charset=utf-8';
  }
  return 'text/plain; charset=utf-8';
}

function createModelMiddleware(): Connect.NextHandleFunction {
  return async (request, response, next) => {
    const requestPath = request.url?.split('?')[0];
    if (!requestPath?.startsWith('/models/')) {
      next();
      return;
    }

    const fileName = path.basename(requestPath);
    if (!modelFiles.includes(fileName as (typeof modelFiles)[number])) {
      response.statusCode = 404;
      response.end('Model file not found.');
      return;
    }

    try {
      const sourcePath = path.resolve(modelDirectory, fileName);
      const contents = await fs.readFile(sourcePath);
      response.setHeader('Content-Type', contentTypeFor(fileName));
      response.end(contents);
    } catch (error) {
      response.statusCode = 500;
      response.end(error instanceof Error ? error.message : 'Failed to load model file.');
    }
  };
}

function rootModelPlugin(): Plugin {
  return {
    name: 'root-model-plugin',
    configureServer(server) {
      server.middlewares.use(createModelMiddleware());
    },
    async writeBundle() {
      const outputDirectory = path.resolve(projectRoot, 'dist', 'models');
      await fs.mkdir(outputDirectory, { recursive: true });

      await Promise.all(
        modelFiles.map(async (fileName) => {
          await fs.copyFile(
            path.resolve(modelDirectory, fileName),
            path.resolve(outputDirectory, fileName),
          );
        }),
      );
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [rootModelPlugin()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
