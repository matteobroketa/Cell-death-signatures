import Papa from 'papaparse';
import { sanitizeCsvTextCell } from './text';
import type { ModelKey, ResultTableRow } from './types';

export function buildPredictionsCsv(rows: ResultTableRow[], selectedModels: ModelKey[]): string {
  return Papa.unparse(
    rows.map((row) => {
      const baseRow: Record<string, string | number | undefined> = {
        sample: sanitizeCsvTextCell(row.sample),
      };

      if (selectedModels.includes('achilles')) {
        baseRow.achilles = row.achilles;
        baseRow.achilles_matched_genes = row.achillesMatchedGenes;
        baseRow.achilles_coverage_percentage = row.achillesCoveragePercentage;
      }

      if (selectedModels.includes('ctrp')) {
        baseRow.ctrp = row.ctrp;
        baseRow.ctrp_matched_genes = row.ctrpMatchedGenes;
        baseRow.ctrp_coverage_percentage = row.ctrpCoveragePercentage;
      }

      return baseRow;
    }),
  );
}
