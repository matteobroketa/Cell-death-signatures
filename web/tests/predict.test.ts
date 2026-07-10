import { describe, expect, it } from 'vitest';
import { parseExpressionCsv } from '../src/lib/expression';
import { parseModelCsv } from '../src/lib/model';
import { combinePredictionRows, predictForModel } from '../src/lib/predict';
import type { ModelMetadata } from '../src/lib/types';

const metadata: ModelMetadata = {
  key: 'achilles',
  label: 'Achilles',
  filename: 'fixture.csv',
  relativeUrl: './models/fixture.csv',
  sourcePath: 'models/fixture.csv',
  sha256: 'fixture',
};

const modelCsv = [
  ',pr_gene_symbol,coefficient',
  '100,GENE_A,1.5',
  '101,GENE_B,-2',
  '102,GENE_C,0.5',
  'INTERCEPT,0.25,0.25',
].join('\n');

describe('predictForModel', () => {
  it('computes a hand-calculated prediction', () => {
    const model = parseModelCsv(modelCsv, metadata);
    const expressionResult = parseExpressionCsv(['gene,S1', 'GENE_A,2', 'GENE_B,3'].join('\n'), 'expression.csv');
    const prediction = predictForModel(model, expressionResult.data!);

    expect(prediction.predictions[0]?.value).toBeCloseTo(-2.75, 12);
    expect(prediction.diagnostics.matchedGenes).toEqual(['GENE_A', 'GENE_B']);
  });

  it('supports multiple samples and shuffled gene order', () => {
    const model = parseModelCsv(modelCsv, metadata);
    const expressionResult = parseExpressionCsv(
      ['gene,S1,S2', 'GENE_C,10,20', 'GENE_A,1,2', 'GENE_B,3,4'].join('\n'),
      'expression.csv',
    );
    const prediction = predictForModel(model, expressionResult.data!);

    expect(prediction.predictions.map((item) => item.value)).toEqual([0.75, 5.25]);
  });

  it('tracks unmatched genes and partial coverage', () => {
    const model = parseModelCsv(modelCsv, metadata);
    const expressionResult = parseExpressionCsv(
      ['gene,S1', 'GENE_A,1', 'GENE_X,9'].join('\n'),
      'expression.csv',
    );
    const prediction = predictForModel(model, expressionResult.data!);

    expect(prediction.diagnostics.unmatchedUploadedGenes).toEqual(['GENE_X']);
    expect(prediction.diagnostics.modelGenesAbsentFromUpload).toEqual(['GENE_B', 'GENE_C']);
    expect(prediction.diagnostics.warnings).toHaveLength(1);
  });

  it('fails when there is zero overlap', () => {
    const model = parseModelCsv(modelCsv, metadata);
    const expressionResult = parseExpressionCsv(['gene,S1', 'GENE_X,1'].join('\n'), 'expression.csv');
    const prediction = predictForModel(model, expressionResult.data!);

    expect(prediction.predictions).toHaveLength(0);
    expect(prediction.diagnostics.errors.map((error) => error.code)).toContain('zero-overlap');
  });

  it('combines predictions into result rows', () => {
    const achilles = parseModelCsv(modelCsv, metadata);
    const ctrp = parseModelCsv(
      [
        ',pr_gene_symbol,coefficient',
        '100,GENE_A,2',
        '101,GENE_B,1',
        'INTERCEPT,1,1',
      ].join('\n'),
      { ...metadata, key: 'ctrp', label: 'CTRP' },
    );
    const expressionResult = parseExpressionCsv(['gene,S1', 'GENE_A,1', 'GENE_B,2'].join('\n'), 'expression.csv');

    const rows = combinePredictionRows([
      predictForModel(achilles, expressionResult.data!),
      predictForModel(ctrp, expressionResult.data!),
    ]);

    expect(rows).toEqual([
      expect.objectContaining({
        sample: 'S1',
        achilles: -2.25,
        ctrp: 5,
      }),
    ]);
  });
});
