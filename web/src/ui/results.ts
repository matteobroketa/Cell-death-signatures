import { calculatePearsonCorrelation } from '../lib/correlation';
import { escapeHtml } from '../lib/text';
import { renderIssueGroup } from './status';
import type { ModelPredictionResult, ResultTableRow } from '../lib/types';

function renderDiagnosticsCard(result: ModelPredictionResult, formatPercentage: (value: number) => string): string {
  const matchedCount = result.diagnostics.matchedGenes.length;
  return `
    <article class="diagnostic-card">
      <h3>${escapeHtml(result.model.metadata.label)}</h3>
      <dl class="summary-grid">
        <div><dt>Matched genes</dt><dd>${matchedCount}</dd></div>
        <div><dt>Total model genes</dt><dd>${result.model.genes.length}</dd></div>
        <div><dt>Coverage</dt><dd>${formatPercentage(result.diagnostics.coveragePercentage)}</dd></div>
        <div><dt>Uploaded-only genes</dt><dd>${result.diagnostics.unmatchedUploadedGenes.length}</dd></div>
        <div><dt>Model genes absent from input</dt><dd>${result.diagnostics.modelGenesAbsentFromUpload.length}</dd></div>
        <div><dt>Samples</dt><dd>${result.diagnostics.sampleCount}</dd></div>
      </dl>
      ${renderIssueGroup('Model warnings', result.diagnostics.warnings, 'warning')}
      ${renderIssueGroup('Model errors', result.diagnostics.errors, 'error')}
      <details>
        <summary>Matched genes (${matchedCount})</summary>
        <p class="gene-list">${escapeHtml(result.diagnostics.matchedGenes.join(', ') || 'None')}</p>
      </details>
      <details>
        <summary>Uploaded genes absent from model (${result.diagnostics.unmatchedUploadedGenes.length})</summary>
        <p class="gene-list">${escapeHtml(result.diagnostics.unmatchedUploadedGenes.join(', ') || 'None')}</p>
      </details>
      <details>
        <summary>Model genes absent from input (${result.diagnostics.modelGenesAbsentFromUpload.length})</summary>
        <p class="gene-list">${escapeHtml(result.diagnostics.modelGenesAbsentFromUpload.join(', ') || 'None')}</p>
      </details>
    </article>
  `;
}

function sortLabel(column: 'sample' | 'achilles' | 'ctrp', activeColumn: 'sample' | 'achilles' | 'ctrp', direction: 'asc' | 'desc'): string {
  if (column !== activeColumn) {
    return 'none';
  }

  return direction === 'asc' ? 'ascending' : 'descending';
}

export function renderResultsSection(
  predictionResults: ModelPredictionResult[],
  rows: ResultTableRow[],
  sortColumn: 'sample' | 'achilles' | 'ctrp',
  sortDirection: 'asc' | 'desc',
  formatReadableNumber: (value: number) => string,
  formatPercentage: (value: number) => string,
): string {
  const showScatterHint =
    rows.length >= 2 && rows.every((row) => row.achilles !== undefined && row.ctrp !== undefined);
  const correlation = showScatterHint
    ? calculatePearsonCorrelation(
        rows.map((row) => row.achilles ?? 0),
        rows.map((row) => row.ctrp ?? 0),
      )
    : undefined;

  return `
    <section class="panel">
      <div class="panel-heading">
        <h2>Results</h2>
        <p>Sortable predictions with full-precision CSV export.</p>
      </div>
      ${
        predictionResults.length === 0
          ? '<p class="empty-state">Run a prediction to populate results, diagnostics and plots.</p>'
          : `
            <div class="button-row">
              <button id="download-results" class="button primary" type="button">Download prediction CSV</button>
            </div>
            <div class="diagnostic-grid">
              ${predictionResults.map((result) => renderDiagnosticsCard(result, formatPercentage)).join('')}
            </div>
            <div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th scope="col" aria-sort="${sortLabel('sample', sortColumn, sortDirection)}"><button class="sort-button" data-sort-column="sample" aria-label="Sort by sample">Sample ${sortColumn === 'sample' ? `(${sortDirection})` : ''}</button></th>
                    <th scope="col" aria-sort="${sortLabel('achilles', sortColumn, sortDirection)}"><button class="sort-button" data-sort-column="achilles" aria-label="Sort by Achilles score">Achilles ${sortColumn === 'achilles' ? `(${sortDirection})` : ''}</button></th>
                    <th>Achilles matched genes</th>
                    <th>Achilles coverage</th>
                    <th scope="col" aria-sort="${sortLabel('ctrp', sortColumn, sortDirection)}"><button class="sort-button" data-sort-column="ctrp" aria-label="Sort by CTRP score">CTRP ${sortColumn === 'ctrp' ? `(${sortDirection})` : ''}</button></th>
                    <th>CTRP matched genes</th>
                    <th>CTRP coverage</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows
                    .map(
                      (row) => `
                        <tr>
                          <td>${escapeHtml(row.sample)}</td>
                          <td>${row.achilles !== undefined ? formatReadableNumber(row.achilles) : '—'}</td>
                          <td>${row.achillesMatchedGenes ?? '—'}</td>
                          <td>${row.achillesCoveragePercentage !== undefined ? formatPercentage(row.achillesCoveragePercentage) : '—'}</td>
                          <td>${row.ctrp !== undefined ? formatReadableNumber(row.ctrp) : '—'}</td>
                          <td>${row.ctrpMatchedGenes ?? '—'}</td>
                          <td>${row.ctrpCoveragePercentage !== undefined ? formatPercentage(row.ctrpCoveragePercentage) : '—'}</td>
                        </tr>
                      `,
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
            ${
              correlation
                ? `
                  <p class="correlation-note">
                    Pearson correlation:
                    ${
                      correlation.value !== undefined
                        ? correlation.value.toFixed(4)
                        : correlation.reason === 'constant-vector'
                          ? 'not defined for constant vectors'
                          : 'not defined for fewer than two paired samples'
                    }
                  </p>
                `
                : ''
            }
          `
      }
    </section>
  `;
}
