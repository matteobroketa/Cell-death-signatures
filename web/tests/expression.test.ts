import { describe, expect, it } from 'vitest';
import { parseExpressionCsv } from '../src/lib/expression';

describe('parseExpressionCsv', () => {
  it('parses multiple samples and preserves gene order', () => {
    const csv = ['gene,S1,S2', 'GENE_A,1,2', 'GENE_B,3,4'].join('\n');
    const result = parseExpressionCsv(csv, 'expression.csv');

    expect(result.errors).toHaveLength(0);
    expect(result.data?.sampleNames).toEqual(['S1', 'S2']);
    expect(result.data?.geneOrder).toEqual(['GENE_A', 'GENE_B']);
    expect(result.data?.valuesByGene.get('GENE_B')).toEqual([3, 4]);
  });

  it('accepts BOM, CRLF, quoted headers and scientific notation while preserving case', () => {
    const csv = '\uFEFFgene,"Sample, 1",S2\r\nGeneA,1e1,2\r\nGeneB,3,4\r\n';
    const result = parseExpressionCsv(csv, 'expression.csv');

    expect(result.errors).toHaveLength(0);
    expect(result.data?.sampleNames).toEqual(['Sample, 1', 'S2']);
    expect(result.data?.geneOrder).toEqual(['GeneA', 'GeneB']);
    expect(result.data?.valuesByGene.get('GeneA')).toEqual([10, 2]);
  });

  it('rejects a missing gene header', () => {
    const result = parseExpressionCsv(['symbol,S1', 'GENE_A,1'].join('\n'), 'expression.csv');
    expect(result.errors.map((error) => error.code)).toContain('missing-gene-column');
  });

  it('rejects a duplicate gene header after the first column', () => {
    const result = parseExpressionCsv(['gene,gene,S1', 'GENE_A,1,2'].join('\n'), 'expression.csv');
    expect(result.errors.map((error) => error.code)).toContain('duplicate-gene-header');
  });

  it('rejects whitespace-only sample names', () => {
    const result = parseExpressionCsv(['gene,   ', 'GENE_A,1'].join('\n'), 'expression.csv');
    expect(result.errors.map((error) => error.code)).toContain('empty-sample-name');
  });

  it('rejects duplicate sample names', () => {
    const result = parseExpressionCsv(['gene,S1,S1', 'GENE_A,1,2'].join('\n'), 'expression.csv');
    expect(result.errors.map((error) => error.code)).toContain('duplicate-sample-name');
  });

  it('rejects duplicate genes', () => {
    const result = parseExpressionCsv(
      ['gene,S1', 'GENE_A,1', 'GENE_A,2'].join('\n'),
      'expression.csv',
    );
    expect(result.duplicateGenes).toEqual(['GENE_A']);
  });

  it('rejects blank cells', () => {
    const result = parseExpressionCsv(['gene,S1', 'GENE_A,'].join('\n'), 'expression.csv');
    expect(result.errors.map((error) => error.code)).toContain('blank-expression-cell');
  });

  it('rejects invalid numeric cells', () => {
    const result = parseExpressionCsv(['gene,S1', 'GENE_A,NaN'].join('\n'), 'expression.csv');
    expect(result.errors.map((error) => error.code)).toContain('invalid-expression-number');
  });

  it('rejects files with no uploaded rows', () => {
    const result = parseExpressionCsv('gene,S1\n', 'expression.csv');
    expect(result.errors.map((error) => error.code)).toContain('no-expression-rows');
  });

  it('reports malformed CSV', () => {
    const result = parseExpressionCsv('gene,S1\n"GENE_A,1\n', 'expression.csv');
    expect(result.errors.map((error) => error.code)).toContain('csv-parse-error');
  });
});
