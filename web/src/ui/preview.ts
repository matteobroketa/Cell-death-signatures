import { escapeHtml } from '../lib/text';
import { formatPreviewNumber, formatSampleLabel } from '../lib/format';
import type { ExpressionParseResult } from '../lib/types';

function formatPreviewCell(cell: string, columnIndex: number): string {
  if (columnIndex === 0) {
    return escapeHtml(cell);
  }

  const parsed = Number(cell);
  if (!Number.isFinite(parsed)) {
    return escapeHtml(cell);
  }

  return escapeHtml(formatPreviewNumber(parsed));
}

export function renderPreviewSection(
  fileName: string | null,
  expressionResult: ExpressionParseResult | null,
): string {
  const preview = expressionResult?.preview;
  const sampleNames = expressionResult?.data?.sampleNames ?? preview?.header.slice(1) ?? [];
  const sampleCount = sampleNames.length;
  const geneCount = expressionResult?.data?.totalGenes ?? preview?.rows.length ?? 0;
  const previewRowCount = preview?.rows.length ?? 0;
  const displayedSampleNames = sampleNames.map((sampleName) => formatSampleLabel(sampleName).displayLabel).join(', ');

  return `
    <section class="panel">
      <div class="panel-heading">
        <h2>Input preview</h2>
        <p>Compact summary plus a bounded, scrollable table preview.</p>
      </div>
      <dl class="summary-grid summary-grid--compact">
        <div class="summary-card">
          <dt>Filename</dt>
          <dd class="summary-value summary-value--wrap" title="${escapeHtml(fileName ?? 'No file loaded')}">${escapeHtml(fileName ?? 'No file loaded')}</dd>
        </div>
        <div class="summary-card">
          <dt>Genes</dt>
          <dd class="summary-value">${geneCount}</dd>
        </div>
        <div class="summary-card">
          <dt>Samples</dt>
          <dd class="summary-value">${sampleCount}</dd>
        </div>
        <div class="summary-card summary-card--wide">
          <dt>Detected sample columns</dt>
          <dd class="summary-value summary-value--wrap" title="${escapeHtml(sampleNames.join(', '))}">
            ${escapeHtml(displayedSampleNames || 'No sample columns detected')}
          </dd>
        </div>
      </dl>
      ${
        preview && preview.header.length > 0
          ? `
            <div class="preview-meta">
              <p>Showing ${previewRowCount} preview row${previewRowCount === 1 ? '' : 's'} of ${geneCount} uploaded gene row${geneCount === 1 ? '' : 's'}.</p>
            </div>
            <div class="table-wrap table-wrap--preview" role="region" aria-label="Input preview table">
              <table class="data-table preview-table">
                <thead>
                  <tr>
                    ${preview.header
                      .map(
                        (cell, columnIndex) =>
                          `<th class="${columnIndex === 0 ? 'sticky-col' : ''} ${columnIndex > 0 ? 'numeric-col' : ''}">${escapeHtml(cell || '(identifier)')}</th>`,
                      )
                      .join('')}
                  </tr>
                </thead>
                <tbody>
                  ${preview.rows
                    .map(
                      (row) => `
                        <tr>
                          ${row
                            .map(
                              (cell, columnIndex) =>
                                `<td class="${columnIndex === 0 ? 'sticky-col' : ''} ${columnIndex > 0 ? 'numeric-col' : ''}">${formatPreviewCell(cell, columnIndex)}</td>`,
                            )
                            .join('')}
                        </tr>
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
