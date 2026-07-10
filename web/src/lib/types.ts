export type ModelKey = 'achilles' | 'ctrp';

export interface ModelMetadata {
  key: ModelKey;
  label: string;
  filename: string;
  relativeUrl: string;
  sourcePath: string;
  sha256: string;
}

export type ModelMetadataMap = Record<ModelKey, ModelMetadata>;

export interface ValidationIssue {
  level: 'error' | 'warning';
  code: string;
  message: string;
  row?: number;
  column?: string;
  gene?: string;
  sample?: string;
}

export interface ParsedModel {
  metadata: ModelMetadata;
  identifierHeader: string;
  intercept: number;
  geneCoefficients: Map<string, number>;
  genes: string[];
}

export interface CsvPreview {
  header: string[];
  rows: string[][];
}

export interface ParsedExpressionData {
  sourceName: string;
  sampleNames: string[];
  geneOrder: string[];
  valuesByGene: Map<string, number[]>;
  totalGenes: number;
  preview: CsvPreview;
}

export interface ExpressionParseResult {
  data?: ParsedExpressionData;
  warnings: ValidationIssue[];
  errors: ValidationIssue[];
  duplicateGenes: string[];
  preview: CsvPreview;
}

export interface PredictionDiagnostics {
  totalUploadedGenes: number;
  matchedGenes: string[];
  unmatchedUploadedGenes: string[];
  modelGenesAbsentFromUpload: string[];
  coveragePercentage: number;
  sampleCount: number;
  duplicateGenes: string[];
  warnings: ValidationIssue[];
  errors: ValidationIssue[];
}

export interface PredictionRecord {
  sample: string;
  value: number;
  matchedGeneCount: number;
  coveragePercentage: number;
}

export interface ModelPredictionResult {
  model: ParsedModel;
  diagnostics: PredictionDiagnostics;
  predictions: PredictionRecord[];
}

export interface ResultTableRow {
  sample: string;
  achilles?: number;
  ctrp?: number;
  achillesMatchedGenes?: number;
  ctrpMatchedGenes?: number;
  achillesCoveragePercentage?: number;
  ctrpCoveragePercentage?: number;
}

export interface CorrelationResult {
  value?: number;
  reason?: 'insufficient-samples' | 'constant-vector' | 'length-mismatch' | 'non-finite';
  sampleCount: number;
}
