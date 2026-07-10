import Papa from 'papaparse';
import { stripBomPrefix, normalizeTrimmedText } from './text';
import type { ModelMetadata, ParsedModel } from './types';

function parseFiniteNumber(rawValue: string, label: string, lineNumber: number): number {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} at line ${lineNumber} must be a finite number.`);
  }
  return parsed;
}

async function sha256Hex(value: string): Promise<string> {
  const buffer = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const bytes = [...new Uint8Array(hashBuffer)];
  return bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function parseModelCsv(csvText: string, metadata: ModelMetadata): ParsedModel {
  const parseResult = Papa.parse<string[]>(stripBomPrefix(csvText), {
    skipEmptyLines: true,
  });

  if (parseResult.errors.length > 0) {
    throw new Error(
      `Failed to parse ${metadata.filename}: ${parseResult.errors[0]?.message ?? 'unknown parse error'}`,
    );
  }

  const [header, ...rows] = parseResult.data;
  if (!header) {
    throw new Error(`${metadata.filename} is empty.`);
  }

  const normalizedHeader = header.map((value, index) =>
    index === 0 ? stripBomPrefix(value ?? '') : value ?? '',
  );
  const expectedHeader = ['', 'pr_gene_symbol', 'coefficient'];
  if (
    normalizedHeader.length !== expectedHeader.length ||
    normalizedHeader.some((value, index) => value !== expectedHeader[index])
  ) {
    throw new Error(
      `${metadata.filename} must have header "${expectedHeader.join(',')}", received "${normalizedHeader.join(',')}".`,
    );
  }

  const geneCoefficients = new Map<string, number>();
  let intercept: number | undefined;
  let interceptCount = 0;

  rows.forEach((row, rowIndex) => {
    const lineNumber = rowIndex + 2;
    if (row.length !== 3) {
      throw new Error(`${metadata.filename} line ${lineNumber} must contain exactly 3 columns.`);
    }

    const [identifier, geneSymbolRaw, coefficientRaw] = row;
    const identifierValue = normalizeTrimmedText(identifier ?? '');
    const geneSymbol = normalizeTrimmedText(geneSymbolRaw ?? '');
    const coefficientString = normalizeTrimmedText(coefficientRaw ?? '');

    if (identifierValue.length === 0) {
      throw new Error(`${metadata.filename} line ${lineNumber} is missing the identifier value.`);
    }

    if (coefficientString.length === 0) {
      throw new Error(`${metadata.filename} line ${lineNumber} is missing the coefficient value.`);
    }

    const coefficient = parseFiniteNumber(coefficientString, 'Coefficient', lineNumber);

    if (identifierValue === 'INTERCEPT') {
      interceptCount += 1;
      intercept = coefficient;
      return;
    }

    if (geneSymbol.length === 0) {
      throw new Error(`${metadata.filename} line ${lineNumber} is missing pr_gene_symbol.`);
    }

    if (geneCoefficients.has(geneSymbol)) {
      throw new Error(`${metadata.filename} contains duplicate gene "${geneSymbol}" at line ${lineNumber}.`);
    }

    geneCoefficients.set(geneSymbol, coefficient);
  });

  if (interceptCount !== 1 || intercept === undefined) {
    throw new Error(`${metadata.filename} must contain exactly one INTERCEPT row.`);
  }

  return {
    metadata,
    identifierHeader: normalizedHeader[0] ?? '',
    intercept,
    geneCoefficients,
    genes: [...geneCoefficients.keys()],
  };
}

export async function loadModelFromUrl(metadata: ModelMetadata): Promise<ParsedModel> {
  const response = await fetch(metadata.relativeUrl);
  if (!response.ok) {
    throw new Error(`Failed to load ${metadata.filename}: HTTP ${response.status}.`);
  }

  const csvText = await response.text();
  const actualHash = await sha256Hex(csvText);
  if (actualHash !== metadata.sha256) {
    throw new Error(
      `Hash mismatch for ${metadata.filename}. Expected ${metadata.sha256}, received ${actualHash}.`,
    );
  }

  return parseModelCsv(csvText, metadata);
}
