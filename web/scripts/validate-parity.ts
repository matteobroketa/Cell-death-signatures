import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Papa from 'papaparse';
import { parseExpressionCsv } from '../src/lib/expression';
import { parseModelCsv } from '../src/lib/model';
import { predictForModel } from '../src/lib/predict';

type ExpectedPredictionRecord = {
  sample: string;
  prediction: number;
};

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(webRoot, '..');
const validationRoot = path.resolve(repoRoot, 'validation');
const fixturesRoot = path.resolve(validationRoot, 'fixtures');
const rScriptPath = path.resolve(validationRoot, 'reference_prediction.R');
const tolerance = 1e-12;

function readText(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

function parseExpectedCsv(filePath: string): ExpectedPredictionRecord[] {
  const parseResult = Papa.parse<Record<string, string>>(readText(filePath), {
    header: true,
    skipEmptyLines: true,
  });

  if (parseResult.errors.length > 0) {
    throw new Error(
      `Failed to parse expected CSV ${path.basename(filePath)}: ${parseResult.errors[0]?.message ?? 'unknown error'}`,
    );
  }

  return parseResult.data.map((row) => {
    const sample = row.sample;
    const rawPrediction = row.prediction;

    if (typeof sample !== 'string' || sample.length === 0) {
      throw new Error(`Expected CSV ${path.basename(filePath)} contains an empty sample value.`);
    }

    if (typeof rawPrediction !== 'string' || rawPrediction.length === 0) {
      throw new Error(`Expected CSV ${path.basename(filePath)} contains an empty prediction value.`);
    }

    const prediction = Number(rawPrediction);
    if (!Number.isFinite(prediction)) {
      throw new Error(`Expected CSV ${path.basename(filePath)} contains a non-finite prediction for ${sample}.`);
    }

    return { sample, prediction };
  });
}

function computePredictions(modelFileName: string, expressionFileName: string): ExpectedPredictionRecord[] {
  const modelCsv = readText(path.resolve(fixturesRoot, modelFileName));
  const expressionCsv = readText(path.resolve(fixturesRoot, expressionFileName));

  const model = parseModelCsv(modelCsv, {
    key: 'achilles',
    label: 'Parity fixture',
    filename: modelFileName,
    relativeUrl: modelFileName,
    sourcePath: path.posix.join('validation', 'fixtures', modelFileName),
    sha256: 'fixture',
  });

  const expressionResult = parseExpressionCsv(expressionCsv, expressionFileName);
  if (expressionResult.errors.length > 0 || !expressionResult.data) {
    throw new Error(
      `Expression fixture ${expressionFileName} is invalid: ${expressionResult.errors
        .map((error) => error.message)
        .join('; ')}`,
    );
  }

  const predictionResult = predictForModel(model, expressionResult.data);
  if (predictionResult.diagnostics.errors.length > 0) {
    throw new Error(
      `Prediction for fixture ${expressionFileName} failed: ${predictionResult.diagnostics.errors
        .map((error) => error.message)
        .join('; ')}`,
    );
  }

  return predictionResult.predictions.map((prediction) => ({
    sample: prediction.sample,
    prediction: prediction.value,
  }));
}

function comparePredictions(
  label: string,
  actual: ExpectedPredictionRecord[],
  expected: ExpectedPredictionRecord[],
): number {
  if (actual.length !== expected.length) {
    throw new Error(`${label}: sample-count mismatch (${actual.length} vs ${expected.length}).`);
  }

  let maxAbsoluteDifference = 0;

  for (let index = 0; index < actual.length; index += 1) {
    const actualRecord = actual[index];
    const expectedRecord = expected[index];

    if (!actualRecord || !expectedRecord) {
      throw new Error(`${label}: prediction ordering mismatch.`);
    }

    if (actualRecord.sample !== expectedRecord.sample) {
      throw new Error(
        `${label}: sample mismatch at row ${index + 2} (${actualRecord.sample} vs ${expectedRecord.sample}).`,
      );
    }

    const difference = Math.abs(actualRecord.prediction - expectedRecord.prediction);
    maxAbsoluteDifference = Math.max(maxAbsoluteDifference, difference);

    if (difference > tolerance) {
      throw new Error(
        `${label}: prediction mismatch for ${actualRecord.sample}. Expected ${expectedRecord.prediction}, got ${actualRecord.prediction}.`,
      );
    }
  }

  return maxAbsoluteDifference;
}

function isRAvailable(): boolean {
  try {
    execFileSync('Rscript', ['--version'], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function runRReference(modelFileName: string, expressionFileName: string, outputFileName: string): string {
  const outputPath = path.resolve(fixturesRoot, outputFileName);
  execFileSync(
    'Rscript',
    [
      rScriptPath,
      path.resolve(fixturesRoot, modelFileName),
      path.resolve(fixturesRoot, expressionFileName),
      outputPath,
    ],
    {
      stdio: 'inherit',
    },
  );
  return outputPath;
}

function main(): void {
  const handcalcActual = computePredictions('handcalc-model.csv', 'handcalc-expression.csv');
  const handcalcExpected = parseExpectedCsv(path.resolve(fixturesRoot, 'handcalc-expected.csv'));
  const handcalcMaxDifference = comparePredictions('Hand-calculated fixture', handcalcActual, handcalcExpected);
  console.log(`Hand-calculated fixture passed. max_abs_diff=${handcalcMaxDifference}`);

  if (!isRAvailable()) {
    console.log('Rscript not available. R parity check was skipped.');
    return;
  }

  const parityOutputPath = runRReference('parity-model.csv', 'parity-expression.csv', 'parity-expected.csv');
  const parityActual = computePredictions('parity-model.csv', 'parity-expression.csv');
  const parityExpected = parseExpectedCsv(parityOutputPath);
  const parityMaxDifference = comparePredictions('R parity fixture', parityActual, parityExpected);
  console.log(`R parity fixture passed. max_abs_diff=${parityMaxDifference}`);
}

main();
