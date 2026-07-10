import { escapeHtml } from '../lib/text';
import type { ExpressionParseResult } from '../lib/types';

export function renderPreviewSection(
  fileName: string | null,
  expressionResult: ExpressionParseResult | null,
): string {
  const preview = expressionResult?.preview;
  const sampleCount = expressionResult?.data?.sampleNames.length ?? Math.max((preview?.header.length ?? 1) - 1, 0);
  const geneCount = expressionResult?.data?.totalGenes ?? preview?.rows.length ?? 0;

  return `
    <section class="panel">
      <div class="panel-heading">
        <h2>Input preview</h2>
        <p>Filename, dimensions and a scrollable table preview.</p>
      </div>
      <dl class="summary-grid">
        <div><dt>Filename</dt><dd>${escapeHtml(fileName ?? 'No file loaded')}</dd></div>
        <div><dt>Genes</dt><dd>${geneCount}</dd></div>
        <div><dt>Samples</dt><dd>${sampleCount}</dd></div>
      </dl>
      ${
        preview && preview.header.length > 0
          ? `
            <div class="table-wrap">
              <table class="data-table preview-table">
                <thead>
                  <tr>${preview.header.map((cell) => `<th>${escapeHtml(cell || '(identifier)')}</th>`).join('')}</tr>
                </thead>
                <tbody>
                  ${preview.rows
                    .map(
                      (row) => `
                        <tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>
                      `,
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
          `
          : '<p class="empty-state">Upload a CSV file to preview it.</p>'
      }
    </section>
  `;
}
