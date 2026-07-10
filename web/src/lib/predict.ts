import type {
  ModelPredictionResult,
  ParsedExpressionData,
  ParsedModel,
  PredictionDiagnostics,
  ResultTableRow,
  ValidationIssue,
} from './types';

function createIssue(issue: ValidationIssue): ValidationIssue {
  return issue;
}

export function buildDiagnostics(model: ParsedModel, expression: ParsedExpressionData): PredictionDiagnostics {
  const matchedGenes = model.genes.filter((gene) => expression.valuesByGene.has(gene));
  const unmatchedUploadedGenes = expression.geneOrder.filter((gene) => !model.geneCoefficients.has(gene));
  const modelGenesAbsentFromUpload = model.genes.filter((gene) => !expression.valuesByGene.has(gene));
  const coveragePercentage =
    model.genes.length === 0 ? 0 : (matchedGenes.length / model.genes.length) * 100;
  const warnings: ValidationIssue[] = [];
  const errors: ValidationIssue[] = [];

  if (modelGenesAbsentFromUpload.length > 0) {
    warnings.push(
      createIssue({
        level: 'warning',
        code: 'partial-model-coverage',
        message: `${model.metadata.label} uses ${matchedGenes.length} of ${model.genes.length} model genes from the uploaded matrix.`,
      }),
    );
  }

  if (matchedGenes.length === 0) {
    errors.push(
      createIssue({
        level: 'error',
        code: 'zero-overlap',
        message: `${model.metadata.label} has zero overlapping genes with the uploaded matrix.`,
      }),
    );
  }

  return {
    totalUploadedGenes: expression.totalGenes,
    matchedGenes,
    unmatchedUploadedGenes,
    modelGenesAbsentFromUpload,
    coveragePercentage,
    sampleCount: expression.sampleNames.length,
    duplicateGenes: [],
    warnings,
    errors,
  };
}

export function predictForModel(model: ParsedModel, expression: ParsedExpressionData): ModelPredictionResult {
  const diagnostics = buildDiagnostics(model, expression);
  if (diagnostics.errors.length > 0) {
    return {
      model,
      diagnostics,
      predictions: [],
    };
  }

  const predictions = expression.sampleNames.map((sample, sampleIndex) => {
    let value = model.intercept;

    diagnostics.matchedGenes.forEach((gene) => {
      const expressionValues = expression.valuesByGene.get(gene);
      const coefficient = model.geneCoefficients.get(gene);

      if (!expressionValues || coefficient === undefined) {
        return;
      }

      const expressionValue = expressionValues[sampleIndex];
      if (expressionValue === undefined) {
        return;
      }

      value += expressionValue * coefficient;
    });

    return {
      sample,
      value,
      matchedGeneCount: diagnostics.matchedGenes.length,
      coveragePercentage: diagnostics.coveragePercentage,
    };
  });

  return {
    model,
    diagnostics,
    predictions,
  };
}

export function combinePredictionRows(predictions: ModelPredictionResult[]): ResultTableRow[] {
  const rowsBySample = new Map<string, ResultTableRow>();

  predictions.forEach((predictionResult) => {
    predictionResult.predictions.forEach((prediction) => {
      const row = rowsBySample.get(prediction.sample) ?? { sample: prediction.sample };

      if (predictionResult.model.metadata.key === 'achilles') {
        row.achilles = prediction.value;
        row.achillesMatchedGenes = prediction.matchedGeneCount;
        row.achillesCoveragePercentage = prediction.coveragePercentage;
      } else {
        row.ctrp = prediction.value;
        row.ctrpMatchedGenes = prediction.matchedGeneCount;
        row.ctrpCoveragePercentage = prediction.coveragePercentage;
      }

      rowsBySample.set(prediction.sample, row);
    });
  });

  return [...rowsBySample.values()];
}
