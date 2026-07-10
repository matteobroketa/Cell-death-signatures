import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDirectory, '..');
const repoRoot = path.resolve(webRoot, '..');
const outputDirectory = path.resolve(webRoot, 'src', 'generated');
const outputPath = path.resolve(outputDirectory, 'modelMetadata.ts');

const modelDefinitions = [
  {
    key: 'achilles',
    label: 'Achilles',
    filename: 'achilles.csv',
  },
  {
    key: 'ctrp',
    label: 'CTRP',
    filename: 'ctrp.csv',
  },
];

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

const lines = [
  'import type { ModelMetadataMap } from "../lib/types";',
  '',
  'export const modelMetadata: ModelMetadataMap = {',
];

for (const definition of modelDefinitions) {
  const sourcePath = path.resolve(repoRoot, 'models', definition.filename);
  const buffer = await fs.readFile(sourcePath);
  const hash = sha256(buffer);

  lines.push(`  ${definition.key}: {`);
  lines.push(`    key: "${definition.key}",`);
  lines.push(`    label: "${definition.label}",`);
  lines.push(`    filename: "${definition.filename}",`);
  lines.push(`    relativeUrl: "./models/${definition.filename}",`);
  lines.push(`    sourcePath: "models/${definition.filename}",`);
  lines.push(`    sha256: "${hash}",`);
  lines.push('  },');
}

lines.push('};', '');

await fs.mkdir(outputDirectory, { recursive: true });
await fs.writeFile(outputPath, `${lines.join('\n')}`, 'utf8');
