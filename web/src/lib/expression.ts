import Papa from 'papaparse';
import { normalizeTrimmedText, stripBomPrefix } from './text';
import type { ExpressionParseResult, ParsedExpressionData, ValidationIssue } from './types';

interface ParsedExpressionRow {
  rowNumber: number;
  gene: string;
  values: number[];
}

function createIssue(issue: ValidationIssue): ValidationIssue {
  return issue;
}

function createPreview(rows: string[][]): { header: string[]; rows: string[][] } {
  const [header = [], ...body] = rows;
  return {
    header,
    rows: body.slice(0, 8),
  };
}

export function parseExpressionCsv(csvText: string, sourceName = 'uploaded-expression.csv'): ExpressionParseResult {
  const parseResult = Papa.parse<string[]>(stripBomPrefix(csvText), {
    skipEmptyLines: 'greedy',
  });

  const preview = createPreview(parseResult.data);
  const warnings: ValidationIssue[] = [];
  const errors: ValidationIssue[] = parseResult.errors.map((error) =>
    createIssue({
      level: 'error',
      code: 'csv-parse-error',
      message: `${sourceName}: ${error.message}`,
      ...(error.row !== undefined ? { row: error.row + 1 } : {}),
    }),
  );

  const [rawHeader, ...bodyRows] = parseResult.data;
  const header = rawHeader?.map((value, index) =>
    index === 0 ? stripBomPrefix(value ?? '') : value ?? '',
  );
  if (!header) {
    errors.push(
      createIssue({
        level: 'error',
        code: 'missing-header',
        message: `${sourceName} must contain a header row.`,
      }),
    );

    return { warnings, errors, duplicateGenes: [], preview };
  }

  if (header[0] !== 'gene') {
    errors.push(
      createIssue({
        level: 'error',
        code: 'missing-gene-column',
        message: `${sourceName} must contain a first column named exactly "gene".`,
        row: 1,
        column: 'gene',
      }),
    );
  }

  if (header.length < 2) {
    errors.push(
      createIssue({
        level: 'error',
        code: 'missing-sample-columns',
        message: `${sourceName} must contain at least one sample column in addition to "gene".`,
        row: 1,
      }),
    );
  }

  const sampleNames = header.slice(1).map((sampleName) => normalizeTrimmedText(sampleName));
  const sampleNameCounts = new Map<string, number>();
  sampleNames.forEach((sampleName, index) => {
    if (sampleName.length === 0) {
      errors.push(
        createIssue({
          level: 'error',
          code: 'empty-sample-name',
          message: `${sourceName} contains an empty sample column name at column ${index + 2}.`,
          row: 1,
          column: String(index + 2),
        }),
      );
    }

    sampleNameCounts.set(sampleName, (sampleNameCounts.get(sampleName) ?? 0) + 1);
  });

  if (sampleNames.includes('gene')) {
    errors.push(
      createIssue({
        level: 'error',
        code: 'duplicate-gene-header',
        message: `${sourceName} must not contain another header named "gene" after the first column.`,
        row: 1,
        column: 'gene',
      }),
    );
  }

  sampleNameCounts.forEach((count, sampleName) => {
    if (sampleName.length > 0 && count > 1) {
      errors.push(
        createIssue({
          level: 'error',
          code: 'duplicate-sample-name',
          message: `${sourceName} contains duplicate sample column "${sampleName}".`,
          row: 1,
          sample: sampleName,
        }),
      );
    }
  });

  const parsedRows: ParsedExpressionRow[] = [];
  const geneCounts = new Map<string, number>();

  bodyRows.forEach((rawRow, rowIndex) => {
    const rowNumber = rowIndex + 2;
    const row = [...rawRow];

    if (row.length > header.length) {
      errors.push(
        createIssue({
          level: 'error',
          code: 'extra-columns',
          message: `${sourceName} row ${rowNumber} contains more columns than the header row.`,
          row: rowNumber,
        }),
      );
      return;
    }

    while (row.length < header.length) {
      row.push('');
    }

    const gene = normalizeTrimmedText(row[0] ?? '');
    if (gene.length === 0) {
      errors.push(
        createIssue({
          level: 'error',
          code: 'empty-gene',
          message: `${sourceName} row ${rowNumber} contains an empty gene symbol.`,
          row: rowNumber,
          column: 'gene',
        }),
      );
      return;
    }

    geneCounts.set(gene, (geneCounts.get(gene) ?? 0) + 1);

    const values: number[] = [];
    for (let sampleIndex = 0; sampleIndex < sampleNames.length; sampleIndex += 1) {
      const rawValue = normalizeTrimmedText(row[sampleIndex + 1] ?? '');
      const sampleName = sampleNames[sampleIndex] ?? `column-${sampleIndex + 2}`;

      if (rawValue.length === 0) {
        errors.push(
          createIssue({
            level: 'error',
            code: 'blank-expression-cell',
            message: `${sourceName} row ${rowNumber}, sample "${sampleName}" is blank.`,
            row: rowNumber,
            sample: sampleName,
            gene,
          }),
        );
        return;
      }

      const parsed = Number(rawValue);
      if (!Number.isFinite(parsed)) {
        errors.push(
          createIssue({
            level: 'error',
            code: 'invalid-expression-number',
            message: `${sourceName} row ${rowNumber}, sample "${sampleName}" must be a finite number.`,
            row: rowNumber,
            sample: sampleName,
            gene,
          }),
        );
        return;
      }

      values.push(parsed);
    }

    parsedRows.push({ rowNumber, gene, values });
  });

  const duplicateGenes = [...geneCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([gene]) => gene)
    .sort((left, right) => left.localeCompare(right));

  duplicateGenes.forEach((gene) => {
    errors.push(
      createIssue({
        level: 'error',
        code: 'duplicate-gene',
        message: `${sourceName} contains duplicate gene "${gene}".`,
        gene,
      }),
    );
  });

  if (parsedRows.length === 0) {
    errors.push(
      createIssue({
        level: 'error',
        code: 'no-expression-rows',
        message: `${sourceName} must contain at least one uploaded gene row.`,
        row: 1,
      }),
    );
  }

  if (errors.length > 0) {
    return { warnings, errors, duplicateGenes, preview };
  }

  const valuesByGene = new Map<string, number[]>();
  const geneOrder: string[] = [];
  parsedRows.forEach((row) => {
    valuesByGene.set(row.gene, row.values);
    geneOrder.push(row.gene);
  });

  const data: ParsedExpressionData = {
    sourceName,
    sampleNames,
    geneOrder,
    valuesByGene,
    totalGenes: geneOrder.length,
    preview,
  };

  return {
    data,
    warnings,
    errors,
    duplicateGenes,
    preview,
  };
}
