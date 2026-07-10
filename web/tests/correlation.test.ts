import { describe, expect, it } from 'vitest';
import { calculatePearsonCorrelation } from '../src/lib/correlation';

describe('calculatePearsonCorrelation', () => {
  it('computes Pearson correlation when valid', () => {
    const result = calculatePearsonCorrelation([1, 2, 3], [2, 4, 6]);
    expect(result.value).toBeCloseTo(1, 12);
  });

  it('handles constant vectors gracefully', () => {
    const result = calculatePearsonCorrelation([1, 1, 1], [2, 3, 4]);
    expect(result.reason).toBe('constant-vector');
  });

  it('handles one-sample inputs gracefully', () => {
    const result = calculatePearsonCorrelation([1], [2]);
    expect(result.reason).toBe('insufficient-samples');
  });

  it('rejects non-finite inputs', () => {
    const result = calculatePearsonCorrelation([1, Number.POSITIVE_INFINITY], [2, 3]);
    expect(result.reason).toBe('non-finite');
  });
});
