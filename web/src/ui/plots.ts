import { calculatePearsonCorrelation } from '../lib/correlation';
import { formatSampleLabel } from '../lib/format';
import { escapeHtml } from '../lib/text';
import type { ModelPredictionResult, ResultTableRow } from '../lib/types';

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function truncateLabel(label: string, maximumLength = 28): string {
  if (label.length <= maximumLength) {
    return label;
  }

  return `${label.slice(0, maximumLength - 1)}…`;
}

function buildTicks(domainMin: number, domainMax: number, count = 5): number[] {
  if (!Number.isFinite(domainMin) || !Number.isFinite(domainMax)) {
    return [0];
  }

  if (domainMin === domainMax) {
    return [domainMin];
  }

  return Array.from({ length: count }, (_, index) => domainMin + ((domainMax - domainMin) * index) / (count - 1));
}

function createPaddedDomain(values: number[]): { min: number; max: number } {
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const span = rawMax - rawMin;
  const basis = span === 0 ? Math.max(Math.abs(rawMax), 1) : span;
  const padding = basis * 0.15;

  return {
    min: Math.min(0, rawMin) - padding,
    max: Math.max(0, rawMax) + padding,
  };
}

function renderBarPlot(result: ModelPredictionResult, formatCompactNumber: (value: number) => string): string {
  if (result.predictions.length === 0) {
    return `
      <figure class="plot-card">
        <figcaption>${escapeHtml(result.model.metadata.label)} score plot</figcaption>
        <p class="empty-state">Plot unavailable because prediction did not complete.</p>
      </figure>
    `;
  }

  const width = 840;
  const leftMargin = 250;
  const rightMargin = 96;
  const topMargin = 28;
  const bottomMargin = 52;
  const rowHeight = 30;
  const chartHeight = clamp(result.predictions.length * rowHeight + topMargin + bottomMargin, 240, 760);
  const totalHeight = topMargin + result.predictions.length * rowHeight + bottomMargin;
  const plotWidth = width - leftMargin - rightMargin;
  const domain = createPaddedDomain(result.predictions.map((prediction) => prediction.value));
  const range = domain.max - domain.min || 1;
  const valueToX = (value: number): number => leftMargin + ((value - domain.min) / range) * plotWidth;
  const zeroX = valueToX(0);
  const ticks = buildTicks(domain.min, domain.max, 5);

  const bars = result.predictions
    .map((prediction, index) => {
      const sampleLabel = formatSampleLabel(prediction.sample);
      const labelText = truncateLabel(sampleLabel.displayLabel);
      const valueX = valueToX(prediction.value);
      const barX = Math.min(zeroX, valueX);
      const barWidth = Math.max(2, Math.abs(valueX - zeroX));
      const barY = topMargin + index * rowHeight + 5;
      const labelY = topMargin + index * rowHeight + 18;
      const valueText = formatCompactNumber(prediction.value);
      const insidePositive = prediction.value >= 0 && barWidth > 56;
      const insideNegative = prediction.value < 0 && barWidth > 56;
      const valueLabelX = insidePositive
        ? clamp(valueX - 8, leftMargin + 12, width - rightMargin - 10)
        : insideNegative
          ? clamp(valueX + 8, leftMargin + 10, width - rightMargin - 12)
          : clamp(prediction.value >= 0 ? valueX + 8 : valueX - 8, leftMargin + 10, width - rightMargin - 10);
      const valueAnchor = insidePositive ? 'end' : insideNegative ? 'start' : prediction.value >= 0 ? 'start' : 'end';
      const valueClass = insidePositive || insideNegative ? 'plot-value plot-value--inside' : 'plot-value';

      return `
        <g class="plot-row">
          <title>${escapeHtml(`${sampleLabel.displayLabel} (${prediction.sample}) = ${prediction.value}`)}</title>
          <text x="${leftMargin - 14}" y="${labelY}" text-anchor="end" class="plot-label">${escapeHtml(labelText)}</text>
          <rect x="${barX}" y="${barY}" width="${barWidth}" height="18" rx="4"></rect>
          <text x="${valueLabelX}" y="${labelY}" text-anchor="${valueAnchor}" class="${valueClass}">${escapeHtml(valueText)}</text>
        </g>
      `;
    })
    .join('');

  return `
    <figure class="plot-card">
      <figcaption>${escapeHtml(result.model.metadata.label)} score plot</figcaption>
      <div class="plot-scroll" style="max-height: ${chartHeight}px;">
        <svg viewBox="0 0 ${width} ${totalHeight}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${escapeHtml(result.model.metadata.label)} horizontal score plot">
          <title>${escapeHtml(result.model.metadata.label)} horizontal score plot</title>
          ${ticks
            .map((tick) => {
              const x = valueToX(tick);
              return `
                <line x1="${x}" y1="${topMargin}" x2="${x}" y2="${totalHeight - bottomMargin}" class="grid-line"></line>
                <text x="${x}" y="${totalHeight - 18}" text-anchor="middle" class="tick-label">${escapeHtml(formatCompactNumber(tick))}</text>
              `;
            })
            .join('')}
          <line x1="${zeroX}" y1="${topMargin - 4}" x2="${zeroX}" y2="${totalHeight - bottomMargin}" class="zero-line"></line>
          <line x1="${leftMargin}" y1="${totalHeight - bottomMargin}" x2="${width - rightMargin}" y2="${totalHeight - bottomMargin}" class="axis-line"></line>
          ${bars}
        </svg>
      </div>
      <p class="plot-footnote">Visible labels are formatted for readability. Hover or inspect SVG titles for the original sample names.</p>
    </figure>
  `;
}

function renderScatterPlot(rows: ResultTableRow[], formatCompactNumber: (value: number) => string): string {
  const pairedRows = rows.filter((row) => row.achilles !== undefined && row.ctrp !== undefined);
  if (pairedRows.length < 2) {
    return `
      <figure class="plot-card plot-card--scatter">
        <figcaption>Achilles versus CTRP scatter plot</figcaption>
        <p class="empty-state">Fewer than two paired samples are available, so a paired-model scatter plot cannot be drawn.</p>
      </figure>
    `;
  }

  const achillesValues = pairedRows.map((row) => row.achilles ?? 0);
  const ctrpValues = pairedRows.map((row) => row.ctrp ?? 0);
  const xDomain = createPaddedDomain(achillesValues);
  const yDomain = createPaddedDomain(ctrpValues);
  const xRange = xDomain.max - xDomain.min || 1;
  const yRange = yDomain.max - yDomain.min || 1;
  const correlation = calculatePearsonCorrelation(achillesValues, ctrpValues);

  const width = 560;
  const height = 560;
  const leftMargin = 72;
  const rightMargin = 32;
  const topMargin = 32;
  const bottomMargin = 64;
  const plotWidth = width - leftMargin - rightMargin;
  const plotHeight = height - topMargin - bottomMargin;
  const valueToX = (value: number): number => leftMargin + ((value - xDomain.min) / xRange) * plotWidth;
  const valueToY = (value: number): number => topMargin + plotHeight - ((value - yDomain.min) / yRange) * plotHeight;
  const xTicks = buildTicks(xDomain.min, xDomain.max, 5);
  const yTicks = buildTicks(yDomain.min, yDomain.max, 5);

  const points = pairedRows
    .map((row) => {
      const sampleLabel = formatSampleLabel(row.sample);
      const xValue = row.achilles ?? 0;
      const yValue = row.ctrp ?? 0;

      return `
        <g class="scatter-point">
          <title>${escapeHtml(`${sampleLabel.displayLabel} (${row.sample}) | Achilles ${xValue}, CTRP ${yValue}`)}</title>
          <circle cx="${valueToX(xValue)}" cy="${valueToY(yValue)}" r="5"></circle>
        </g>
      `;
    })
    .join('');

  const subtitle =
    correlation.value !== undefined
      ? `Pearson r = ${correlation.value.toFixed(4)}`
      : correlation.reason === 'constant-vector'
        ? 'Pearson correlation is undefined for constant vectors.'
        : 'Pearson correlation is undefined for these paired samples.';

  const zeroLineX = xDomain.min <= 0 && xDomain.max >= 0 ? valueToX(0) : undefined;
  const zeroLineY = yDomain.min <= 0 && yDomain.max >= 0 ? valueToY(0) : undefined;

  return `
    <figure class="plot-card plot-card--scatter">
      <figcaption>Achilles versus CTRP scatter plot</figcaption>
      <p class="plot-subtitle">${escapeHtml(subtitle)}</p>
      <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Scatter plot comparing Achilles and CTRP predictions">
        <title>Scatter plot comparing Achilles and CTRP predictions</title>
        ${xTicks
          .map((tick) => {
            const x = valueToX(tick);
            return `
              <line x1="${x}" y1="${topMargin}" x2="${x}" y2="${topMargin + plotHeight}" class="grid-line"></line>
              <text x="${x}" y="${height - 22}" text-anchor="middle" class="tick-label">${escapeHtml(formatCompactNumber(tick))}</text>
            `;
          })
          .join('')}
        ${yTicks
          .map((tick) => {
            const y = valueToY(tick);
            return `
              <line x1="${leftMargin}" y1="${y}" x2="${leftMargin + plotWidth}" y2="${y}" class="grid-line"></line>
              <text x="${leftMargin - 12}" y="${y + 4}" text-anchor="end" class="tick-label">${escapeHtml(formatCompactNumber(tick))}</text>
            `;
          })
          .join('')}
        ${zeroLineX !== undefined ? `<line x1="${zeroLineX}" y1="${topMargin}" x2="${zeroLineX}" y2="${topMargin + plotHeight}" class="zero-line"></line>` : ''}
        ${zeroLineY !== undefined ? `<line x1="${leftMargin}" y1="${zeroLineY}" x2="${leftMargin + plotWidth}" y2="${zeroLineY}" class="zero-line"></line>` : ''}
        <line x1="${leftMargin}" y1="${topMargin + plotHeight}" x2="${leftMargin + plotWidth}" y2="${topMargin + plotHeight}" class="axis-line"></line>
        <line x1="${leftMargin}" y1="${topMargin}" x2="${leftMargin}" y2="${topMargin + plotHeight}" class="axis-line"></line>
        ${points}
        <text x="${width / 2}" y="${height - 8}" text-anchor="middle" class="axis-title">Achilles score</text>
        <text x="20" y="${height / 2}" transform="rotate(-90 20 ${height / 2})" text-anchor="middle" class="axis-title">CTRP score</text>
      </svg>
    </figure>
  `;
}

export function renderPlotSection(
  predictionResults: ModelPredictionResult[],
  rows: ResultTableRow[],
  formatCompactNumber: (value: number) => string,
): string {
  if (predictionResults.length === 0) {
    return `
      <section class="panel">
        <div class="panel-heading">
          <h2>Plots</h2>
          <p>Responsive SVG plots appear after a successful prediction.</p>
        </div>
        <p class="empty-state">Plots appear after a successful prediction.</p>
      </section>
    `;
  }

  const scorePlots = predictionResults.map((result) => renderBarPlot(result, formatCompactNumber)).join('');
  const scatterPlot = predictionResults.length > 1 ? renderScatterPlot(rows, formatCompactNumber) : '';

  return `
    <section class="panel">
      <div class="panel-heading">
        <h2>Plots</h2>
        <p>Responsive score plots use formatted labels, visible axes and a zero reference where applicable.</p>
      </div>
      <div class="plot-grid plot-grid--scores">
        ${scorePlots}
      </div>
      ${scatterPlot}
    </section>
  `;
}
