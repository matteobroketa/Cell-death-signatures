import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseModelCsv } from '../src/lib/model';
import type { ModelMetadata } from '../src/lib/types';

const metadata: ModelMetadata = {
  key: 'achilles',
  label: 'Achilles',
  filename: 'fixture.csv',
  relativeUrl: './models/fixture.csv',
  sourcePath: 'models/fixture.csv',
  sha256: 'fixture',
};

const testDirectory = path.dirname(fileURLToPath(import.meta.url));

function readRootModel(fileName: 'achilles.csv' | 'ctrp.csv'): string {
  return fs.readFileSync(path.resolve(testDirectory, '..', '..', 'models', fileName), 'utf8');
}

describe('parseModelCsv', () => {
  it('parses the exact committed-style schema and intercept row', () => {
    const csv = [
      ',pr_gene_symbol,coefficient',
      '100,GENE_A,1.25',
      '200,GENE_B,-0.5',
      'INTERCEPT,-0.75,-0.75',
    ].join('\n');

    const model = parseModelCsv(csv, metadata);

    expect(model.identifierHeader).toBe('');
    expect(model.intercept).toBe(-0.75);
    expect(model.genes).toEqual(['GENE_A', 'GENE_B']);
    expect(model.geneCoefficients.get('GENE_A')).toBe(1.25);
  });

  it('accepts UTF-8 BOM, CRLF endings, quoted values, scientific notation and trimmed identifiers', () => {
    const csv = '\uFEFF,pr_gene_symbol,coefficient\r\n" 100 "," GENE_A ","1e0"\r\n"INTERCEPT","0.5","0.5"\r\n';
    const model = parseModelCsv(csv, metadata);

    expect(model.intercept).toBe(0.5);
    expect(model.genes).toEqual(['GENE_A']);
    expect(model.geneCoefficients.get('GENE_A')).toBe(1);
  });

  it('rejects malformed headers', () => {
    const csv = [
      'id,pr_gene_symbol,coefficient',
      '100,GENE_A,1.25',
      'INTERCEPT,-0.5,-0.5',
    ].join('\n');

    expect(() => parseModelCsv(csv, metadata)).toThrow('must have header');
  });

  it('rejects duplicate intercept rows', () => {
    const csv = [
      ',pr_gene_symbol,coefficient',
      '100,GENE_A,1.25',
      'INTERCEPT,-0.5,-0.5',
      'INTERCEPT,-0.4,-0.4',
    ].join('\n');

    expect(() => parseModelCsv(csv, metadata)).toThrow('exactly one INTERCEPT row');
  });

  it('rejects blank coefficients and non-finite values', () => {
    const blankCoefficient = [
      ',pr_gene_symbol,coefficient',
      '100,GENE_A,',
      'INTERCEPT,-0.5,-0.5',
    ].join('\n');
    const infinityCoefficient = [
      ',pr_gene_symbol,coefficient',
      '100,GENE_A,Infinity',
      'INTERCEPT,-0.5,-0.5',
    ].join('\n');

    expect(() => parseModelCsv(blankCoefficient, metadata)).toThrow('missing the coefficient value');
    expect(() => parseModelCsv(infinityCoefficient, metadata)).toThrow('must be a finite number');
  });

  it('rejects extra columns and reordered headers', () => {
    const extraColumn = [
      ',pr_gene_symbol,coefficient,extra',
      '100,GENE_A,1.25,test',
      'INTERCEPT,-0.5,-0.5,test',
    ].join('\n');
    const reorderedHeader = [
      ',coefficient,pr_gene_symbol',
      '100,1.25,GENE_A',
      'INTERCEPT,-0.5,-0.5',
    ].join('\n');

    expect(() => parseModelCsv(extraColumn, metadata)).toThrow('must have header');
    expect(() => parseModelCsv(reorderedHeader, metadata)).toThrow('must have header');
  });

  it('rejects duplicate genes', () => {
    const csv = [
      ',pr_gene_symbol,coefficient',
      '100,GENE_A,1.25',
      '200,GENE_A,-0.5',
      'INTERCEPT,-0.5,-0.5',
    ].join('\n');

    expect(() => parseModelCsv(csv, metadata)).toThrow('duplicate gene');
  });

  it('rejects missing intercept rows', () => {
    const csv = [
      ',pr_gene_symbol,coefficient',
      '100,GENE_A,1.25',
      '200,GENE_B,-0.5',
    ].join('\n');

    expect(() => parseModelCsv(csv, metadata)).toThrow('exactly one INTERCEPT row');
  });

  it('parses the committed Achilles and CTRP root model files exactly once each', () => {
    const achilles = parseModelCsv(readRootModel('achilles.csv'), {
      ...metadata,
      filename: 'achilles.csv',
      label: 'Achilles',
    });
    const ctrp = parseModelCsv(readRootModel('ctrp.csv'), {
      ...metadata,
      key: 'ctrp',
      filename: 'ctrp.csv',
      label: 'CTRP',
    });

    expect(achilles.intercept).toBe(-0.559030373690314);
    expect(ctrp.intercept).toBe(0.9308107716622416);
    expect(achilles.genes).toHaveLength(978);
    expect(ctrp.genes).toHaveLength(978);
    expect(new Set(achilles.genes).size).toBe(978);
    expect(new Set(ctrp.genes).size).toBe(978);
  });
});
