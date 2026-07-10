import { calculatePearsonCorrelation } from '../lib/correlation';
import { escapeHtml } from '../lib/text';
import type { ModelPredictionResult, ResultTableRow } from '../lib/types';

function renderBarPlot(result: ModelPredictionResult, formatReadableNumber: (value: number) => string): string {
  if (result.predictions.length === 0) {
    return `
      <figure class="plot-card">
        <figcaption>${escapeHtml(result.model.metadata.label)} score plot</figcaption>
        <p class="empty-state">Plot unavailable because prediction did not complete.</p>
      </figure>
    `;
  }

  const width = 720;
  const leftMargin = 180;
  const plotWidth = 460;
  const rowHeight = 28;
  const topMargin = 32;
  const bottomMargin = 28;
  const values = result.predictions.map((prediction) => prediction.value);
  const domainMin = Math.min(0, ...values);
  const domainMax = Math.max(0, ...values);
  const safeRange = domainMax === domainMin ? 1 : domainMax - domainMin;
  const zeroX = leftMargin + ((0 - domainMin) / safeRange) * plotWidth;
  const height = topMargin + result.predictions.length * rowHeight + bottomMargin;

  const bars = result.predictions
    .map((prediction, index) => {
      const barTop = topMargin + index * rowHeight;
      const scaledValue = leftMargin + ((prediction.value - domainMin) / safeRange) * plotWidth;
      const barX = Math.min(zeroX, scaledValue);
      const barWidth = Math.max(2, Math.abs(scaledValue - zeroX));

      return `
        <text x="${leftMargin - 8}" y="${barTop + 16}" text-anchor="end">${escapeHtml(prediction.sample)}</text>
        <rect x="${barX}" y="${barTop + 4}" width="${barWidth}" height="16" rx="4"></rect>
        <text x="${leftMargin + plotWidth + 12}" y="${barTop + 16}">${escapeHtml(formatReadableNumber(prediction.value))}</text>
      `;
    })
    .join('');

  return `
    <figure class="plot-card">
      <figcaption>${escapeHtml(result.model.metadata.label)} score plot</figcaption>
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(result.model.metadata.label)} horizontal score plot">
        <title>${escapeHtml(result.model.metadata.label)} horizontal score plot</title>
        <line x1="${zeroX}" y1="${topMargin - 8}" x2="${zeroX}" y2="${height - bottomMargin}" class="axis-line"></line>
        ${bars}
      </svg>
    </figure>
  `;
}

function renderScatterPlot(rows: ResultTableRow[], formatReadableNumber: (value: number) => string): string {
  const pairedRows = rows.filter((row) => row.achilles !== undefined && row.ctrp !== undefined);

  if (pairedRows.length < 2) {
    return `
      <figure class="plot-card">
        <figcaption>Achilles versus CTRP scatter plot</figcaption>
        <p class="empty-state">At least two paired samples are required for a scatter plot.</p>
      </figure>
    `;
  }

  const achillesValues = pairedRows.map((row) => row.achilles ?? 0);
  const ctrpValues = pairedRows.map((row) => row.ctrp ?? 0);
  const correlation = calculatePearsonCorrelation(achillesValues, ctrpValues);

  const width = 560;
  const height = 360;
  const leftMargin = 64;
  const rightMargin = 28;
  const topMargin = 28;
  const bottomMargin = 44;
  const plotWidth = width - leftMargin - rightMargin;
  const plotHeight = height - topMargin - bottomMargin;

  const xMin = Math.min(...achillesValues);
  const xMax = Math.max(...achillesValues);
  const yMin = Math.min(...ctrpValues);
  const yMax = Math.max(...ctrpValues);
  const xRange = xMax === xMin ? 1 : xMax - xMin;
  const yRange = yMax === yMin ? 1 : yMax - yMin;

  const points = pairedRows
    .map((row) => {
      const xValue = row.achilles ?? 0;
      const yValue = row.ctrp ?? 0;
      const x = leftMargin + ((xValue - xMin) / xRange) * plotWidth;
      const y = topMargin + plotHeight - ((yValue - yMin) / yRange) * plotHeight;
      return `
        <circle cx="${x}" cy="${y}" r="5"></circle>
        <text x="${x + 8}" y="${y - 8}">${escapeHtml(row.sample)}</text>
      `;
    })
    .join('');

  const subtitle =
    correlation.value !== undefined
      ? `Pearson r = ${correlation.value.toFixed(4)}`
      : correlation.reason === 'constant-vector'
        ? 'Pearson correlation undefined for constant vectors'
        : correlation.reason === 'non-finite'
          ? 'Pearson correlation undefined for non-finite values'
          : 'Pearson correlation undefined for fewer than two paired samples';

  return `
    <figure class="plot-card">
      <figcaption>Achilles versus CTRP scatter plot</figcaption>
      <p class="plot-subtitle">${escapeHtml(subtitle)}</p>
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Scatter plot comparing Achilles and CTRP predictions">
        <title>Scatter plot comparing Achilles and CTRP predictions</title>
        <line x1="${leftMargin}" y1="${topMargin + plotHeight}" x2="${width - rightMargin}" y2="${topMargin + plotHeight}" class="axis-line"></line>
        <line x1="${leftMargin}" y1="${topMargin}" x2="${leftMargin}" y2="${topMargin + plotHeight}" class="axis-line"></line>
        <text x="${width / 2}" y="${height - 8}" text-anchor="middle">Achilles score</text>
        <text x="18" y="${height / 2}" transform="rotate(-90 18 ${height / 2})" text-anchor="middle">CTRP score</text>
        ${points}
      </svg>
      <p class="plot-footnote">
        X range: ${formatReadableNumber(xMin)} to ${formatReadableNumber(xMax)}.
        Y range: ${formatReadableNumber(yMin)} to ${formatReadableNumber(yMax)}.
      </p>
    </figure>
  `;
}

export function renderPlotSection(
  predictionResults: ModelPredictionResult[],
  rows: ResultTableRow[],
  formatReadableNumber: (value: number) => string,
): string {
  if (predictionResults.length === 0) {
    return `
      <section class="panel">
        <div class="panel-heading">
          <h2>Plots</h2>
          <p>Horizontal score plots and paired-model scatter plot.</p>
        </div>
        <p class="empty-state">Plots appear after a successful prediction.</p>
      </section>
    `;
  }

  return `
    <section class="panel">
      <div class="panel-heading">
        <h2>Plots</h2>
        <p>Accessible SVG plots for model scores and cross-model agreement.</p>
      </div>
      <div class="plot-grid">
        ${predictionResults.map((result) => renderBarPlot(result, formatReadableNumber)).join('')}
        ${predictionResults.length > 1 ? renderScatterPlot(rows, formatReadableNumber) : ''}
      </div>
    </section>
  `;
}
