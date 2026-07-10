import { describe, expect, it } from 'vitest';
import { formatCompactNumber, formatConcentrationToken, formatPreviewNumber, formatSampleLabel } from '../src/lib/format';

describe('formatSampleLabel', () => {
  it('formats known technical suffixes into readable treatment labels', () => {
    const formatted = formatSampleLabel('Isoproterenol_10uM_24h_vs_vehicle_DESeq2_log2FC');

    expect(formatted.displayLabel).toBe('Isoproterenol · 10 µM · 24 h');
    expect(formatted.technicalSuffix).toBe('_vs_vehicle_DESeq2_log2FC');
    expect(formatted.rawLabel).toBe('Isoproterenol_10uM_24h_vs_vehicle_DESeq2_log2FC');
  });

  it('supports alternate control suffixes and multi-token treatment names', () => {
    const formatted = formatSampleLabel('Very_Long_Drug_Name_500nM_48h_vs_control_log2FC');

    expect(formatted.displayLabel).toBe('Very Long Drug Name · 500 nM · 48 h');
    expect(formatted.technicalSuffix).toBe('_vs_control_log2FC');
  });

  it('falls back safely for arbitrary sample names', () => {
    const formatted = formatSampleLabel('Sample_A__Replicate_2');

    expect(formatted.displayLabel).toBe('Sample A Replicate 2');
    expect(formatted.technicalSuffix).toBeUndefined();
  });

  it('preserves the original raw sample name without mutation', () => {
    const rawLabel = 'Dofetilide_10uM_24h_vs_untreated_DESeq2_log2FC';

    const formatted = formatSampleLabel(rawLabel);

    expect(rawLabel).toBe('Dofetilide_10uM_24h_vs_untreated_DESeq2_log2FC');
    expect(formatted.rawLabel).toBe(rawLabel);
  });
});

describe('display-only numeric formatters', () => {
  it('formats concentration tokens with a micro symbol', () => {
    expect(formatConcentrationToken('10uM')).toBe('10 µM');
  });

  it('uses compact display precision without affecting numeric values', () => {
    expect(formatCompactNumber(0.1234567890123)).toBe('0.1235');
    expect(formatPreviewNumber(-9876.54321)).toBe('-9,877');
    expect(0.1234567890123).toBeCloseTo(0.1234567890123, 12);
  });
});
