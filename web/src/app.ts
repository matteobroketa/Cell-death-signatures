import { modelMetadata } from './generated/modelMetadata';
import { buildPredictionsCsv } from './lib/download';
import { parseExpressionCsv } from './lib/expression';
import { formatCompactNumber, formatPercentage, formatReadableNumber } from './lib/format';
import { loadModelFromUrl } from './lib/model';
import { combinePredictionRows, predictForModel } from './lib/predict';
import { escapeHtml } from './lib/text';
import type {
  ExpressionParseResult,
  ModelKey,
  ModelPredictionResult,
  ParsedModel,
  ResultTableRow,
  ValidationIssue,
} from './lib/types';
import { renderPlotSection } from './ui/plots';
import { renderPreviewSection } from './ui/preview';
import { renderResultsSection } from './ui/results';
import { renderIssueGroup } from './ui/status';
import { attachUploadInteractions } from './ui/upload';

type SortColumn = 'sample' | 'achilles' | 'ctrp';
type SortDirection = 'asc' | 'desc';
type ModelSelection = 'both' | 'achilles' | 'ctrp';

interface AppState {
  fileName: string | null;
  expressionResult: ExpressionParseResult | null;
  selectedModelMode: ModelSelection;
  loadedModels: Partial<Record<ModelKey, ParsedModel>>;
  modelLoadErrors: Partial<Record<ModelKey, string>>;
  predictionResults: ModelPredictionResult[];
  sortColumn: SortColumn;
  sortDirection: SortDirection;
  liveMessage: string;
  modelsLoading: boolean;
}

const exampleCsvSnippet = [
  'gene,Sample_A,Sample_B',
  'PSME1,1.42,-0.33',
  'ATF1,-0.18,0.55',
  'RHEB,0.07,0.11',
  'FOXO3,-0.31,0.22',
  'CBR3,-0.95,0.48',
].join('\n');

const doiUrl = 'https://doi.org/10.1093/nar/gkz805';
const publisherUrl =
  'https://academic.oup.com/nar/article/47/20/10915/5573547';
const repositoryUrl = 'https://github.com/bence-szalai/Cell-death-signatures';
const fullCitation =
  'Szalai B, Subramanian V, Holland CH, Alföldi R, Puskás LG, Saez-Rodriguez J. ' +
  'Signatures of cell death and proliferation in perturbation transcriptomics data—from confounding ' +
  'factor to effective prediction. Nucleic Acids Research. 2019;47(19):10010–10026.';

function createInitialState(): AppState {
  return {
    fileName: null,
    expressionResult: null,
    selectedModelMode: 'both',
    loadedModels: {},
    modelLoadErrors: {},
    predictionResults: [],
    sortColumn: 'sample',
    sortDirection: 'asc',
    liveMessage: 'Ready. Load a CSV file to validate and predict.',
    modelsLoading: true,
  };
}

function getSelectedModelKeys(mode: ModelSelection): ModelKey[] {
  if (mode === 'both') {
    return ['achilles', 'ctrp'];
  }

  return [mode];
}

function sortRows(rows: ResultTableRow[], column: SortColumn, direction: SortDirection): ResultTableRow[] {
  const multiplier = direction === 'asc' ? 1 : -1;
  return [...rows].sort((left, right) => {
    if (column === 'sample') {
      return left.sample.localeCompare(right.sample) * multiplier;
    }

    const leftValue = left[column] ?? Number.NEGATIVE_INFINITY;
    const rightValue = right[column] ?? Number.NEGATIVE_INFINITY;
    return (leftValue - rightValue) * multiplier;
  });
}

function countIssues(state: AppState): { errors: number; warnings: number } {
  const expressionErrors = state.expressionResult?.errors.length ?? 0;
  const expressionWarnings = state.expressionResult?.warnings.length ?? 0;
  const modelErrors = Object.keys(state.modelLoadErrors).length;

  return {
    errors: expressionErrors + modelErrors,
    warnings: expressionWarnings,
  };
}

function renderModelAvailability(state: AppState): string {
  return (Object.keys(modelMetadata) as ModelKey[])
    .map((key) => {
      const metadata = modelMetadata[key];
      const loadError = state.modelLoadErrors[key];
      const loadedModel = state.loadedModels[key];
      const statusLabel = loadError
        ? 'Load failed'
        : loadedModel
          ? 'Ready'
          : state.modelsLoading
            ? 'Loading'
            : 'Pending';
      const statusTone = loadError ? 'error' : loadedModel ? 'ready' : 'loading';

      return `
        <article class="choice-card choice-card--status">
          <div class="choice-card__header">
            <h3>${escapeHtml(metadata.label)}</h3>
            <span class="status-badge status-badge--${statusTone}">${escapeHtml(statusLabel)}</span>
          </div>
          <p class="choice-card__meta">
            ${loadedModel ? `${loadedModel.genes.length} genes plus intercept` : escapeHtml(metadata.relativeUrl)}
          </p>
          ${loadError ? `<p class="status-text status-text--error">${escapeHtml(loadError)}</p>` : ''}
        </article>
      `;
    })
    .join('');
}

function renderProvenanceSection(state: AppState): string {
  const cards = (Object.keys(modelMetadata) as ModelKey[]).map((key) => {
    const metadata = modelMetadata[key];
    const loadError = state.modelLoadErrors[key];
    const loadedModel = state.loadedModels[key];

    return `
      <article class="model-card">
        <div class="choice-card__header">
          <h3>${escapeHtml(metadata.label)}</h3>
          <span class="status-badge status-badge--${loadError ? 'error' : loadedModel ? 'ready' : 'loading'}">
            ${loadError ? 'Unavailable' : loadedModel ? 'Loaded' : 'Loading'}
          </span>
        </div>
        <dl class="meta-list">
          <div><dt>Source file</dt><dd><code>${escapeHtml(metadata.sourcePath)}</code></dd></div>
          <div><dt>Deployed path</dt><dd><code>${escapeHtml(metadata.relativeUrl)}</code></dd></div>
          <div><dt>SHA-256</dt><dd><code class="hash-value">${escapeHtml(metadata.sha256)}</code></dd></div>
          <div><dt>Ordinary coefficients</dt><dd>${loadedModel ? loadedModel.genes.length : 'Loading...'}</dd></div>
          <div><dt>Intercept</dt><dd>${loadedModel ? formatReadableNumber(loadedModel.intercept) : 'Loading...'}</dd></div>
        </dl>
        ${
          loadError
            ? `<p class="status-text status-text--error"><strong>Model load error:</strong> ${escapeHtml(loadError)}</p>`
            : '<p class="status-text status-text--ok">Model available for browser-side prediction.</p>'
        }
      </article>
    `;
  });

  return `
    <section class="panel">
      <p class="muted-text">Predictions use the published Achilles and CTRP CEViChE linear models.</p>
      <details class="details-block provenance-details">
        <summary>Scientific provenance and model details</summary>
        <div class="details-block__content provenance-grid">
          <p>
            CEViChE Static predicts cell-viability scores from perturbation gene-expression signatures using the
            published Achilles and CTRP linear models. Prediction uses only the intersection between uploaded genes
            and model genes. Raw expression is accepted, but perturbation signatures or gene-wise normalized contrasts
            are the intended input. Outputs are model predictions for research use and are not direct clinical measurements.
          </p>
          <p>
            Paper: <a href="${publisherUrl}">${escapeHtml(fullCitation)}</a>
            DOI: <a href="${doiUrl}">${doiUrl}</a>.
            Original repository: <a href="${repositoryUrl}">${repositoryUrl}</a>.
          </p>
          <p>No endorsement by the original authors is implied.</p>
          <div class="model-grid">
            ${cards.join('')}
          </div>
        </div>
      </details>
    </section>
  `;
}

function renderControls(state: AppState): string {
  const issueCounts = countIssues(state);
  const hasBlockingErrors = issueCounts.errors > 0;
  const hasFile = state.expressionResult !== null;
  const selectedFileLabel = state.fileName ?? 'No file loaded';
  const selectedModelLabel =
    state.selectedModelMode === 'both'
      ? 'Both models'
      : state.selectedModelMode === 'achilles'
        ? 'Achilles only'
        : 'CTRP only';
  const readinessLabel = state.modelsLoading
    ? 'Loading model files...'
    : issueCounts.errors > 0
      ? 'Resolve blocking issues before running predictions.'
      : hasFile
        ? 'Ready to calculate predictions.'
        : 'Load a CSV file to begin.';

  return `
    <section class="panel masthead">
      <div class="masthead__intro">
        <p class="eyebrow">Client-only research tool</p>
        <h1>CEViChE Static — Cell Viability Prediction</h1>
        <p class="lede">
          Predicts cell-viability scores from perturbation gene-expression signatures using the published Achilles and CTRP models.
          It runs entirely in the browser. Uploaded data never leaves the browser. Intended for research use, not clinical use.
        </p>
      </div>
      <dl class="header-stats">
        <div class="summary-card">
          <dt>Runtime</dt>
          <dd class="summary-value">Browser only</dd>
        </div>
        <div class="summary-card">
          <dt>Selected models</dt>
          <dd class="summary-value">${escapeHtml(selectedModelLabel)}</dd>
        </div>
        <div class="summary-card">
          <dt>Blocking errors</dt>
          <dd class="summary-value">${issueCounts.errors}</dd>
        </div>
        <div class="summary-card">
          <dt>Warnings</dt>
          <dd class="summary-value">${issueCounts.warnings}</dd>
        </div>
      </dl>
      <div class="notice-row">
        <p class="notice-chip">No uploads leave the browser</p>
        <p class="notice-chip">Published linear models only</p>
        <p class="notice-chip">Research use only</p>
      </div>
    </section>
    <section class="workspace-grid">
      <section class="panel panel--upload">
        <div class="panel-heading">
          <div>
            <h2>Upload expression matrix</h2>
            <p>Drag and drop a CSV file or choose one manually.</p>
          </div>
          <p class="panel-heading__status">${escapeHtml(readinessLabel)}</p>
        </div>
        <div class="upload-layout">
          <div id="drop-zone" class="drop-zone" tabindex="0" role="button" aria-describedby="input-instructions">
            <div class="drop-zone__body">
              <p class="drop-zone__title"><strong>Drop CSV here</strong> or press Enter / Space to browse.</p>
              <p class="drop-zone__hint">Upload a perturbation-signature CSV with a <code>gene</code> column and one or more sample columns.</p>
              <label class="button secondary interactive-only" for="expression-file">Choose CSV</label>
              <input id="expression-file" type="file" accept=".csv,text/csv" />
            </div>
          </div>
          <div class="upload-support">
            <div class="support-panel">
              <h3>Current file</h3>
              <p class="file-status" title="${escapeHtml(selectedFileLabel)}">${escapeHtml(selectedFileLabel)}</p>
              <p id="input-instructions" class="muted-text">
                The first column must be named <code>gene</code>. Every remaining column is treated as a sample.
                Values must be finite numbers. Only genes present in both the input and the selected model contribute to prediction.
              </p>
              <div class="button-row button-row--stack">
                <button id="run-prediction" class="button primary interactive-only" type="button" ${!hasFile || hasBlockingErrors || state.modelsLoading ? 'disabled' : ''}>
                  Calculate predictions
                </button>
                <button id="reset-input" class="button subtle interactive-only" type="button">Reset</button>
                <a class="button secondary interactive-only" href="./examples/example-expression.csv" download>Download example CSV</a>
              </div>
            </div>
            <details class="details-block">
              <summary>CSV format requirements</summary>
              <div class="details-block__content">
                <ul class="compact-list">
                  <li>CSV with a first column named exactly <code>gene</code>.</li>
                  <li>One or more remaining sample columns with unique, nonempty names.</li>
                  <li>Nonempty gene symbols and finite numeric expression values in every cell.</li>
                  <li>Duplicate genes, blank cells, NaN, Infinity and zero-overlap uploads are rejected.</li>
                </ul>
              </div>
            </details>
            <details class="details-block">
              <summary>Example CSV preview</summary>
              <div class="details-block__content">
                <pre class="snippet"><code>${escapeHtml(exampleCsvSnippet)}</code></pre>
              </div>
            </details>
          </div>
        </div>
      </section>
      <aside class="panel panel--config">
        <div class="panel-heading">
          <div>
            <h2>Configuration</h2>
            <p>Choose which published model output to compute.</p>
          </div>
        </div>
        <fieldset class="model-selector">
          <legend>Select prediction model</legend>
          <div class="choice-grid">
            <label class="choice-card">
              <input type="radio" name="model-mode" value="both" ${state.selectedModelMode === 'both' ? 'checked' : ''} />
              <span class="choice-card__header"><strong>Both</strong><span>Achilles and CTRP</span></span>
            </label>
            <label class="choice-card">
              <input type="radio" name="model-mode" value="achilles" ${state.selectedModelMode === 'achilles' ? 'checked' : ''} />
              <span class="choice-card__header"><strong>Achilles</strong><span>Single-model output</span></span>
            </label>
            <label class="choice-card">
              <input type="radio" name="model-mode" value="ctrp" ${state.selectedModelMode === 'ctrp' ? 'checked' : ''} />
              <span class="choice-card__header"><strong>CTRP</strong><span>Single-model output</span></span>
            </label>
          </div>
        </fieldset>
        <section class="support-panel support-panel--compact">
          <h3>Model availability</h3>
          <div class="choice-grid choice-grid--status">
            ${renderModelAvailability(state)}
          </div>
        </section>
      </aside>
    </section>
  `;
}

function renderValidation(state: AppState): string {
  const expressionErrors = state.expressionResult?.errors ?? [];
  const expressionWarnings = state.expressionResult?.warnings ?? [];
  const modelLoadIssues: ValidationIssue[] = Object.entries(state.modelLoadErrors).map(([modelKey, message]) => ({
    level: 'error',
    code: 'model-load-failure',
    message: `${modelKey}: ${message}`,
  }));
  const totalErrors = modelLoadIssues.length + expressionErrors.length;
  const totalWarnings = expressionWarnings.length;
  const hasFile = state.expressionResult !== null;

  let statusMarkup = `
    <div class="status-banner status-banner--info">
      <strong>Waiting for input.</strong>
      <span>Load a CSV file to run validation and preview the uploaded matrix.</span>
    </div>
  `;

  if (hasFile && totalErrors === 0 && totalWarnings === 0) {
    statusMarkup = `
      <div class="status-banner status-banner--ok">
        <strong>Input valid - no errors or warnings.</strong>
        <span>The uploaded matrix satisfies the required schema and numeric checks.</span>
      </div>
    `;
  } else if (totalErrors > 0) {
    statusMarkup = `
      <div class="status-banner status-banner--error">
        <strong>Blocking validation errors detected.</strong>
        <span>Resolve all errors before running predictions.</span>
      </div>
    `;
  } else if (totalWarnings > 0) {
    statusMarkup = `
      <div class="status-banner status-banner--warning">
        <strong>Validation completed with warnings.</strong>
        <span>Predictions can run, but model coverage is incomplete or reduced.</span>
      </div>
    `;
  }

  return `
    <section class="panel">
      <div class="panel-heading">
        <div>
          <h2>Validation</h2>
          <p>Blocking errors are shown before prediction. Warnings are listed separately.</p>
        </div>
      </div>
      <dl class="summary-grid summary-grid--compact">
        <div class="summary-card">
          <dt>File loaded</dt>
          <dd class="summary-value">${hasFile ? 'Yes' : 'No'}</dd>
        </div>
        <div class="summary-card">
          <dt>Errors</dt>
          <dd class="summary-value">${totalErrors}</dd>
        </div>
        <div class="summary-card">
          <dt>Warnings</dt>
          <dd class="summary-value">${totalWarnings}</dd>
        </div>
        <div class="summary-card">
          <dt>Models ready</dt>
          <dd class="summary-value">${(Object.keys(modelMetadata) as ModelKey[]).filter((key) => Boolean(state.loadedModels[key])).length}/${Object.keys(modelMetadata).length}</dd>
        </div>
      </dl>
      ${statusMarkup}
      ${renderIssueGroup(`Errors (${totalErrors})`, [...modelLoadIssues, ...expressionErrors], 'error')}
      ${renderIssueGroup(`Warnings (${totalWarnings})`, expressionWarnings, 'warning')}
    </section>
  `;
}

function renderApp(container: HTMLDivElement, state: AppState): void {
  const rows = sortRows(combinePredictionRows(state.predictionResults), state.sortColumn, state.sortDirection);

  const markup = `
    <main class="page-shell">
      ${renderControls(state)}
      <div id="live-region" class="sr-only" aria-live="polite">${escapeHtml(state.liveMessage)}</div>
      ${renderValidation(state)}
      ${renderPreviewSection(state.fileName, state.expressionResult)}
      ${renderResultsSection(state.predictionResults, rows, state.sortColumn, state.sortDirection, formatCompactNumber, formatPercentage)}
      ${renderPlotSection(state.predictionResults, rows, formatCompactNumber)}
      ${renderProvenanceSection(state)}
    </main>
  `;
  const fragment = document.createRange().createContextualFragment(markup);
  container.replaceChildren(fragment);
}

function downloadCsv(rows: ResultTableRow[], selectedModels: ModelKey[]): void {
  const blob = new Blob([buildPredictionsCsv(rows, selectedModels)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'ceviche-static-predictions.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}

export function initApp(container: HTMLDivElement | null): void {
  if (!container) {
    throw new Error('Missing #app container.');
  }

  const state = createInitialState();

  const rerender = (): void => {
    renderApp(container, state);
    bindEvents();
  };

  const loadModels = async (): Promise<void> => {
    state.modelsLoading = true;
    rerender();

    await Promise.all(
      (Object.keys(modelMetadata) as ModelKey[]).map(async (key) => {
        try {
          state.loadedModels[key] = await loadModelFromUrl(modelMetadata[key]);
        } catch (error) {
          state.modelLoadErrors[key] =
            error instanceof Error ? error.message : 'Unknown model-loading error.';
        }
      }),
    );

    state.modelsLoading = false;
    state.liveMessage = Object.keys(state.modelLoadErrors).length === 0
      ? 'Models loaded and ready.'
      : 'One or more models failed to load.';
    rerender();
  };

  const handleFile = async (file: File): Promise<void> => {
    const csvText = await file.text();
    state.fileName = file.name;
    state.expressionResult = parseExpressionCsv(csvText, file.name);
    state.predictionResults = [];
    state.sortColumn = 'sample';
    state.sortDirection = 'asc';
    state.liveMessage =
      state.expressionResult.errors.length === 0
        ? `${file.name} loaded successfully.`
        : `${file.name} loaded with validation errors.`;
    rerender();
  };

  const runPredictions = (): void => {
    if (!state.expressionResult?.data) {
      state.liveMessage = 'Load a valid CSV file before prediction.';
      rerender();
      return;
    }

    if (state.expressionResult.errors.length > 0) {
      state.liveMessage = 'Resolve validation errors before prediction.';
      rerender();
      return;
    }

    const selectedModels = getSelectedModelKeys(state.selectedModelMode)
      .map((key) => state.loadedModels[key])
      .filter((model): model is ParsedModel => Boolean(model));

    state.predictionResults = selectedModels.map((model) => predictForModel(model, state.expressionResult!.data!));
    state.liveMessage = state.predictionResults.some((result) => result.diagnostics.errors.length > 0)
      ? 'Prediction completed with blocking model-overlap errors.'
      : `Prediction completed for ${state.predictionResults.length} model${state.predictionResults.length === 1 ? '' : 's'}.`;
    rerender();
  };

  const resetState = (): void => {
    state.fileName = null;
    state.expressionResult = null;
    state.predictionResults = [];
    state.liveMessage = 'Input cleared.';
    rerender();
  };

  const bindEvents = (): void => {
    const fileInput = document.querySelector<HTMLInputElement>('#expression-file');
    const resetButton = document.querySelector<HTMLButtonElement>('#reset-input');
    const runButton = document.querySelector<HTMLButtonElement>('#run-prediction');
    const downloadButton = document.querySelector<HTMLButtonElement>('#download-results');

    if (fileInput) {
      fileInput.addEventListener('change', async (event) => {
        const target = event.currentTarget as HTMLInputElement;
        const file = target.files?.[0];
        if (file) {
          await handleFile(file);
        }
      });
    }

    attachUploadInteractions('#drop-zone', '#expression-file', handleFile);

    if (resetButton) {
      resetButton.addEventListener('click', resetState);
    }

    if (runButton) {
      runButton.addEventListener('click', runPredictions);
    }

    document.querySelectorAll<HTMLInputElement>('input[name="model-mode"]').forEach((input) => {
      input.addEventListener('change', (event) => {
        state.selectedModelMode = (event.currentTarget as HTMLInputElement).value as ModelSelection;
        state.predictionResults = [];
        state.liveMessage = `Selected model mode: ${state.selectedModelMode}.`;
        rerender();
      });
    });

    document.querySelectorAll<HTMLButtonElement>('[data-sort-column]').forEach((button) => {
      button.addEventListener('click', (event) => {
        const column = (event.currentTarget as HTMLButtonElement).dataset.sortColumn as SortColumn;
        if (state.sortColumn === column) {
          state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          state.sortColumn = column;
          state.sortDirection = 'asc';
        }
        rerender();
      });
    });

    if (downloadButton) {
      downloadButton.addEventListener('click', () => {
        downloadCsv(
          sortRows(combinePredictionRows(state.predictionResults), state.sortColumn, state.sortDirection),
          getSelectedModelKeys(state.selectedModelMode),
        );
      });
    }
  };

  rerender();
  void loadModels();
}
