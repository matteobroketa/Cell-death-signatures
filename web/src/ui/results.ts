import { formatSampleLabel } from '../lib/format';
import { escapeHtml } from '../lib/text';
import { renderIssueGroup } from './status';
import type { ModelKey, ModelPredictionResult, ResultTableRow } from '../lib/types';

function countStatus(result: ModelPredictionResult): string {
  const errorCount = result.diagnostics.errors.length;
  const warningCount = result.diagnostics.warnings.length;

  if (errorCount > 0) {
    return `${errorCount} error${errorCount === 1 ? '' : 's'}`;
  }

  if (warningCount > 0) {
    return `${warningCount} warning${warningCount === 1 ? '' : 's'}`;
  }

  return 'ready';
}

function renderDiagnosticLists(result: ModelPredictionResult): string {
  const sections: string[] = [];

  if (result.diagnostics.errors.length > 0) {
    sections.push(renderIssueGroup(`Errors (${result.diagnostics.errors.length})`, result.diagnostics.errors, 'error'));
  }

  if (result.diagnostics.warnings.length > 0) {
    sections.push(renderIssueGroup(`Warnings (${result.diagnostics.warnings.length})`, result.diagnostics.warnings, 'warning'));
  }

  if (result.diagnostics.unmatchedUploadedGenes.length > 0) {
    sections.push(`
      <details class="details-block">
        <summary>Uploaded genes absent from model (${result.diagnostics.unmatchedUploadedGenes.length})</summary>
        <p class="gene-list">${escapeHtml(result.diagnostics.unmatchedUploadedGenes.join(', '))}</p>
      </details>
    `);
  }

  if (result.diagnostics.modelGenesAbsentFromUpload.length > 0) {
    sections.push(`
      <details class="details-block">
        <summary>Model genes absent from input (${result.diagnostics.modelGenesAbsentFromUpload.length})</summary>
        <p class="gene-list">${escapeHtml(result.diagnostics.modelGenesAbsentFromUpload.join(', '))}</p>
      </details>
    `);
  }

  if (result.diagnostics.matchedGenes.length > 0) {
    sections.push(`
      <details class="details-block">
        <summary>Matched genes (${result.diagnostics.matchedGenes.length})</summary>
        <p class="gene-list">${escapeHtml(result.diagnostics.matchedGenes.join(', '))}</p>
      </details>
    `);
  }

  return sections.join('');
}

function renderDiagnosticsCard(result: ModelPredictionResult, formatPercentage: (value: number) => string): string {
  const matchedCount = result.diagnostics.matchedGenes.length;
  const totalGenes = result.model.genes.length;

  return `
    <article class="diagnostic-card">
      <div class="diagnostic-card__header">
        <div>
          <h3>${escapeHtml(result.model.metadata.label)}</h3>
          <p class="diagnostic-card__status">${escapeHtml(countStatus(result))}</p>
        </div>
        <div class="diagnostic-card__summary">
          <strong>${matchedCount}/${totalGenes}</strong>
          <span>genes matched</span>
        </div>
      </div>
      <div class="coverage-meter" aria-label="${escapeHtml(result.model.metadata.label)} coverage ${formatPercentage(result.diagnostics.coveragePercentage)}">
        <div class="coverage-meter__track">
          <span class="coverage-meter__fill" style="width: ${result.diagnostics.coveragePercentage}%"></span>
        </div>
        <span class="coverage-meter__value">${formatPercentage(result.diagnostics.coveragePercentage)}</span>
      </div>
      <dl class="summary-grid summary-grid--tight">
        <div class="summary-card">
          <dt>Samples</dt>
          <dd class="summary-value">${result.diagnostics.sampleCount}</dd>
        </div>
        <div class="summary-card">
          <dt>Uploaded genes</dt>
          <dd class="summary-value">${result.diagnostics.totalUploadedGenes}</dd>
        </div>
        <div class="summary-card">
          <dt>Missing model genes</dt>
          <dd class="summary-value">${result.diagnostics.modelGenesAbsentFromUpload.length}</dd>
        </div>
      </dl>
      ${renderDiagnosticLists(result)}
    </article>
  `;
}

function sortLabel(column: 'sample' | 'achilles' | 'ctrp', activeColumn: 'sample' | 'achilles' | 'ctrp', direction: 'asc' | 'desc'): string {
  if (column !== activeColumn) {
    return 'none';
  }

  return direction === 'asc' ? 'ascending' : 'descending';
}

function renderResultHeader(modelKey: ModelKey): string {
  const label = modelKey === 'achilles' ? 'Achilles' : 'CTRP';

  return `
    <th colspan="3" scope="colgroup" class="group-header">${label}</th>
  `;
}

function renderResultColumnHeader(
  modelKey: ModelKey,
  sortColumn: 'sample' | 'achilles' | 'ctrp',
  sortDirection: 'asc' | 'desc',
): string {
  const label = modelKey === 'achilles' ? 'Achilles score' : 'CTRP score';

  return `
    <th scope="col" class="numeric-col" aria-sort="${sortLabel(modelKey, sortColumn, sortDirection)}">
      <button class="sort-button" data-sort-column="${modelKey}" aria-label="Sort by ${label}">
        Score ${sortColumn === modelKey ? `(${sortDirection})` : ''}
      </button>
    </th>
    <th scope="col" class="numeric-col">Matched genes</th>
    <th scope="col" class="numeric-col">Coverage</th>
  `;
}

function renderResultCell(row: ResultTableRow, modelKey: ModelKey, formatCompactNumber: (value: number) => string, formatPercentage: (value: number) => string): string {
  if (modelKey === 'achilles') {
    return `
      <td class="numeric-col">${row.achilles !== undefined ? formatCompactNumber(row.achilles) : '—'}</td>
      <td class="numeric-col">${row.achillesMatchedGenes ?? '—'}</td>
      <td class="numeric-col">${row.achillesCoveragePercentage !== undefined ? formatPercentage(row.achillesCoveragePercentage) : '—'}</td>
    `;
  }

  return `
    <td class="numeric-col">${row.ctrp !== undefined ? formatCompactNumber(row.ctrp) : '—'}</td>
    <td class="numeric-col">${row.ctrpMatchedGenes ?? '—'}</td>
    <td class="numeric-col">${row.ctrpCoveragePercentage !== undefined ? formatPercentage(row.ctrpCoveragePercentage) : '—'}</td>
  `;
}

export function renderResultsSection(
  predictionResults: ModelPredictionResult[],
  rows: ResultTableRow[],
  sortColumn: 'sample' | 'achilles' | 'ctrp',
  sortDirection: 'asc' | 'desc',
  formatCompactNumber: (value: number) => string,
  formatPercentage: (value: number) => string,
): string {
  if (predictionResults.length === 0) {
    return `
      <section class="panel">
        <div class="panel-heading">
          <h2>Results</h2>
          <p>Predictions, diagnostics and CSV export appear after a successful run.</p>
        </div>
        <p class="empty-state">Run a prediction to populate model diagnostics and result tables.</p>
      </section>
    `;
  }

  const selectedModels = predictionResults.map((result) => result.model.metadata.key);

  return `
    <section class="panel">
      <div class="panel-heading">
        <div>
          <h2>Results</h2>
          <p>Compact on-screen precision for reading, full precision preserved in downloads.</p>
        </div>
        <div class="panel-actions">
          <button id="download-results" class="button secondary interactive-only" type="button">Download prediction CSV</button>
        </div>
      </div>
      <div class="diagnostic-grid">
        ${predictionResults.map((result) => renderDiagnosticsCard(result, formatPercentage)).join('')}
      </div>
      <div class="table-wrap table-wrap--results" role="region" aria-label="Prediction results table">
        <table class="data-table results-table">
          <thead>
            <tr>
              <th rowspan="2" scope="col" class="sticky-col" aria-sort="${sortLabel('sample', sortColumn, sortDirection)}">
                <button class="sort-button" data-sort-column="sample" aria-label="Sort by sample">
                  Sample ${sortColumn === 'sample' ? `(${sortDirection})` : ''}
                </button>
              </th>
              ${selectedModels.map(renderResultHeader).join('')}
            </tr>
            <tr>
              ${selectedModels.map((modelKey) => renderResultColumnHeader(modelKey, sortColumn, sortDirection)).join('')}
            </tr>
          </thead>
          <tbody>
            ${rows
              .map((row) => {
                const sampleLabel = formatSampleLabel(row.sample);
                return `
                  <tr>
                    <th scope="row" class="sticky-col sample-cell" title="${escapeHtml(row.sample)}" aria-label="${escapeHtml(`Sample ${sampleLabel.displayLabel}. Original name ${row.sample}`)}">
                      <span class="sample-label">${escapeHtml(sampleLabel.displayLabel)}</span>
                    </th>
                    ${selectedModels.map((modelKey) => renderResultCell(row, modelKey, formatCompactNumber, formatPercentage)).join('')}
                  </tr>
                `;
              })
              .join('')}
          </tbody>
        </table>
      </div>
    </section>
  `;
}
