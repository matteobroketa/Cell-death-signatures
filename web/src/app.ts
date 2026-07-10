import { modelMetadata } from './generated/modelMetadata';
import { buildPredictionsCsv } from './lib/download';
import { parseExpressionCsv } from './lib/expression';
import { formatPercentage, formatReadableNumber } from './lib/format';
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

function renderModelMetadata(state: AppState): string {
  const cards = (Object.keys(modelMetadata) as ModelKey[]).map((key) => {
    const metadata = modelMetadata[key];
    const loadError = state.modelLoadErrors[key];
    const loadedModel = state.loadedModels[key];

    return `
      <article class="model-card">
        <h3>${escapeHtml(metadata.label)}</h3>
        <dl class="meta-list">
          <div><dt>Source file</dt><dd><code>${escapeHtml(metadata.sourcePath)}</code></dd></div>
          <div><dt>Deployed path</dt><dd><code>${escapeHtml(metadata.relativeUrl)}</code></dd></div>
          <div><dt>SHA-256</dt><dd><code>${escapeHtml(metadata.sha256)}</code></dd></div>
          <div><dt>Ordinary coefficients</dt><dd>${loadedModel ? loadedModel.genes.length : 'Loading...'}</dd></div>
          <div><dt>Intercept</dt><dd>${loadedModel ? loadedModel.intercept : 'Loading...'}</dd></div>
        </dl>
        ${
          loadError
            ? `<p class="status-error"><strong>Model load error:</strong> ${escapeHtml(loadError)}</p>`
            : '<p class="status-ok">Model available for browser-side prediction.</p>'
        }
      </article>
    `;
  });

  return `
    <section class="panel">
      <div class="panel-heading">
        <h2>Scientific provenance</h2>
        <p>An unofficial static browser interface implementing the published CEViChE prediction models from the original Cell-death-signatures repository.</p>
      </div>
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
    </section>
  `;
}

function renderControls(state: AppState): string {
  const expressionErrors = state.expressionResult?.errors ?? [];
  const modelErrors = Object.values(state.modelLoadErrors).filter((value): value is string => Boolean(value));
  const hasBlockingErrors = expressionErrors.length > 0 || modelErrors.length > 0;
  const hasFile = state.expressionResult !== null;

  return `
    <section class="hero">
      <div>
        <p class="eyebrow">Client-only research tool</p>
        <h1>CEViChE Static — Cell Viability Prediction</h1>
        <p class="lede">
          Predicts cell-viability scores from perturbation gene-expression signatures using the published Achilles and CTRP models.
          It runs entirely in the browser. Uploaded data never leaves the browser. Intended for research use, not clinical use.
        </p>
      </div>
      <div class="hero-card">
        <h2>Input contract</h2>
        <ul class="compact-list">
          <li>CSV with a first column named exactly <code>gene</code>.</li>
          <li>One or more remaining sample columns with unique, nonempty names.</li>
          <li>Nonempty gene symbols and finite numeric expression values in every cell.</li>
          <li>Duplicate genes, blank cells, NaN, Infinity and zero-overlap uploads are rejected.</li>
        </ul>
      </div>
    </section>
    <section class="panel">
      <div class="panel-heading">
        <h2>Upload expression matrix</h2>
        <p>Drag and drop a CSV file or choose one manually.</p>
      </div>
      <div class="upload-grid">
        <div id="drop-zone" class="drop-zone" tabindex="0" role="button" aria-describedby="input-instructions">
          <p><strong>Drop CSV here</strong> or press Enter / Space to browse.</p>
          <label class="button secondary" for="expression-file">Choose CSV</label>
          <input id="expression-file" type="file" accept=".csv,text/csv" />
        </div>
        <div class="input-support">
          <div>
            <h3>Instructions</h3>
            <p id="input-instructions">
              The first column must be named <code>gene</code>. Every remaining column is treated as a sample.
              Values must be finite numbers. Only genes present in both the input and the selected model contribute to prediction.
            </p>
            <div class="button-row">
              <a class="button secondary" href="./examples/example-expression.csv" download>Download example CSV</a>
              <button id="reset-input" class="button subtle" type="button">Reset</button>
              <button id="run-prediction" class="button primary" type="button" ${!hasFile || hasBlockingErrors || state.modelsLoading ? 'disabled' : ''}>
                Calculate predictions
              </button>
            </div>
          </div>
          <div>
            <h3>Sample CSV snippet</h3>
            <pre class="snippet"><code>${exampleCsvSnippet}</code></pre>
          </div>
        </div>
      </div>
      <fieldset class="model-selector">
        <legend>Select prediction model</legend>
        <label><input type="radio" name="model-mode" value="both" ${state.selectedModelMode === 'both' ? 'checked' : ''} /> Both</label>
        <label><input type="radio" name="model-mode" value="achilles" ${state.selectedModelMode === 'achilles' ? 'checked' : ''} /> Achilles</label>
        <label><input type="radio" name="model-mode" value="ctrp" ${state.selectedModelMode === 'ctrp' ? 'checked' : ''} /> CTRP</label>
      </fieldset>
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

  return `
    <section class="panel">
      <div class="panel-heading">
        <h2>Validation</h2>
        <p>Blocking errors are shown before prediction. Warnings are listed separately.</p>
      </div>
      ${renderIssueGroup('Errors', [...modelLoadIssues, ...expressionErrors], 'error')}
      ${renderIssueGroup('Warnings', expressionWarnings, 'warning')}
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
      ${renderResultsSection(state.predictionResults, rows, state.sortColumn, state.sortDirection, formatReadableNumber, formatPercentage)}
      ${renderPlotSection(state.predictionResults, rows, formatReadableNumber)}
      ${renderModelMetadata(state)}
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
