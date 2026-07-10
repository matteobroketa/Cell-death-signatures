import { describe, expect, it } from 'vitest';
import { buildPredictionsCsv } from '../src/lib/download';

describe('buildPredictionsCsv', () => {
  it('includes full-precision numeric output and coverage columns', () => {
    const csv = buildPredictionsCsv(
      [
        {
          sample: 'S1',
          achilles: 0.1234567890123,
          achillesMatchedGenes: 10,
          achillesCoveragePercentage: 50,
          ctrp: -0.9876543210987,
          ctrpMatchedGenes: 9,
          ctrpCoveragePercentage: 45,
        },
      ],
      ['achilles', 'ctrp'],
    );

    expect(csv).toContain('0.1234567890123');
    expect(csv).toContain('-0.9876543210987');
    expect(csv).toContain('achilles_matched_genes');
    expect(csv).toContain('ctrp_coverage_percentage');
  });

  it('exports only selected model columns and neutralizes formula-like sample names', () => {
    const csv = buildPredictionsCsv(
      [
        {
          sample: '=SUM(A1:A2)',
          achilles: 1,
          achillesMatchedGenes: 5,
          achillesCoveragePercentage: 25,
        },
      ],
      ['achilles'],
    );

    expect(csv).toContain('sample,achilles,achilles_matched_genes,achilles_coverage_percentage');
    expect(csv).not.toContain('ctrp');
    expect(csv).toContain("'=SUM(A1:A2)");
  });
});
