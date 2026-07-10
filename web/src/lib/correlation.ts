import type { CorrelationResult } from './types';

export function calculatePearsonCorrelation(left: number[], right: number[]): CorrelationResult {
  if (left.length !== right.length) {
    return {
      reason: 'length-mismatch',
      sampleCount: Math.min(left.length, right.length),
    };
  }

  if (left.length < 2) {
    return {
      reason: 'insufficient-samples',
      sampleCount: left.length,
    };
  }

  if (!left.every(Number.isFinite) || !right.every(Number.isFinite)) {
    return {
      reason: 'non-finite',
      sampleCount: Math.min(left.length, right.length),
    };
  }

  const leftMean = left.reduce((sum, value) => sum + value, 0) / left.length;
  const rightMean = right.reduce((sum, value) => sum + value, 0) / right.length;

  let numerator = 0;
  let leftVariance = 0;
  let rightVariance = 0;

  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index];
    const rightValue = right[index];
    if (leftValue === undefined || rightValue === undefined) {
      continue;
    }

    const leftCentered = leftValue - leftMean;
    const rightCentered = rightValue - rightMean;
    numerator += leftCentered * rightCentered;
    leftVariance += leftCentered * leftCentered;
    rightVariance += rightCentered * rightCentered;
  }

  if (leftVariance === 0 || rightVariance === 0) {
    return {
      reason: 'constant-vector',
      sampleCount: left.length,
    };
  }

  return {
    value: numerator / Math.sqrt(leftVariance * rightVariance),
    sampleCount: left.length,
  };
}
