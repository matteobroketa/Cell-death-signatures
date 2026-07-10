import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Papa from 'papaparse';
import { describe, expect, it } from 'vitest';
import { parseExpressionCsv } from '../src/lib/expression';
import { parseModelCsv } from '../src/lib/model';
import { predictForModel } from '../src/lib/predict';
import type { ModelMetadata } from '../src/lib/types';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));

function readFixture(fileName: string): string {
  return fs.readFileSync(path.resolve(testDirectory, '..', '..', 'validation', 'fixtures', fileName), 'utf8');
}

describe('handcalc parity fixture', () => {
  it('matches the independently calculated expected values', () => {
    const modelMetadata: ModelMetadata = {
      key: 'achilles',
      label: 'Handcalc fixture',
      filename: 'handcalc-model.csv',
      relativeUrl: 'handcalc-model.csv',
      sourcePath: 'validation/fixtures/handcalc-model.csv',
      sha256: 'fixture',
    };

    const model = parseModelCsv(readFixture('handcalc-model.csv'), modelMetadata);
    const expressionResult = parseExpressionCsv(readFixture('handcalc-expression.csv'), 'handcalc-expression.csv');
    const predictionResult = predictForModel(model, expressionResult.data!);
    const expected = Papa.parse<Record<string, string>>(readFixture('handcalc-expected.csv'), {
      header: true,
      skipEmptyLines: true,
    }).data;

    expect(predictionResult.predictions).toHaveLength(expected.length);
    expected.forEach((row, index) => {
      expect(predictionResult.predictions[index]?.sample).toBe(row.sample);
      expect(predictionResult.predictions[index]?.value).toBeCloseTo(Number(row.prediction), 12);
    });
  });
});
