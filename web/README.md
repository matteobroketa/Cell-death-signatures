# CEViChE Static

## Purpose and scope

CEViChE Static is a client-only browser application for predicting cell-viability scores from perturbation gene-expression signatures. It reproduces the published Achilles and CTRP linear-model calculation from the committed root model files:

- `../models/achilles.csv`
- `../models/ctrp.csv`

An unofficial static browser interface implementing the published CEViChE prediction models from the original Cell-death-signatures repository.

It is intended for research use only. It does not provide clinical interpretation, does not upload user data, and does not depend on a backend or external API.

## Architecture

- Vite serves and builds a no-framework TypeScript application under `web/src/`.
- Papa Parse is used for CSV parsing for both model files and uploaded expression matrices.
- Prediction logic lives in `src/lib/` and is tested independently from the browser UI.
- Root model CSV files remain the scientific source of truth and are copied into the production artifact at build time.
- Validation fixtures under `../validation/` support both an R-backed parity check and an independent hand-calculated arithmetic check.

## Local setup

1. `cd web`
2. `npm install`

## Development command

`npm run dev`

## Test command

`npm run test:run`

## Type-check command

`npm run typecheck`

## Production build command

`npm run build`

## Parity-validation command

`npm run validate:parity`

The parity command always runs the hand-calculated fixture. When `Rscript` is available, it also runs the independent R reference script in `../validation/reference_prediction.R` and reports the maximum absolute numerical difference.

## Deployment explanation

The application is built with Vite `base: "./"` so it works under a repository subpath on GitHub Pages. During the build, the production artifact includes:

- `dist/index.html`
- `dist/assets/*`
- `dist/models/achilles.csv`
- `dist/models/ctrp.csv`

The deployed application loads model files from relative paths and does not hardcode a repository owner, so forks can deploy correctly.

## Exact CSV input schema

The uploaded expression matrix must be CSV with:

- a first column named exactly `gene`
- one or more remaining sample columns
- nonempty, unique sample names
- nonempty gene symbols
- finite numeric expression values in every non-header cell

Duplicate genes are rejected. Blank cells, `NaN`, `Infinity`, and other nonnumeric values are rejected.
UTF-8 BOM is accepted. LF and CRLF line endings are accepted. Surrounding whitespace is trimmed for model identifiers, model gene symbols, sample names, gene symbols and numeric cells, while case is preserved.

## Prediction equation

For each selected model and each sample:

`prediction(sample) = intercept + sum(expression(gene, sample) * coefficient(gene))`

The intercept is detected from the model row whose unnamed identifier column equals `INTERCEPT`, and its value is parsed from the `coefficient` column.
Model parsing requires the exact committed header schema `["", "pr_gene_symbol", "coefficient"]` and rejects reordered or extra model columns.

## Missing-gene behavior

Prediction uses only genes present in both the uploaded matrix and the selected model. Model genes absent from the upload are not imputed, and uploaded genes absent from the model are ignored for the numerical calculation while still reported in diagnostics.

## Duplicate-gene behavior

Duplicate genes in the uploaded expression matrix are a blocking validation error. Duplicate ordinary gene rows in a model CSV are also treated as a blocking parse error.

## Privacy statement

Uploaded expression data is processed entirely in the browser. No backend, external API, analytics endpoint, or server-side upload path is used by the static application.

## Research-only disclaimer

This tool is intended for research use only. Prediction outputs are model scores and should not be treated as direct clinical measurements.

## Scientific citation

Szalai B, Subramanian V, Holland CH, Alföldi R, Puskás LG, Saez-Rodriguez J. *Signatures of cell death and proliferation in perturbation transcriptomics data—from confounding factor to effective prediction.* Nucleic Acids Research. 2019;47(19):10010-10026. doi:[10.1093/nar/gkz805](https://doi.org/10.1093/nar/gkz805).

## Attribution

Original source repository: `https://github.com/bence-szalai/Cell-death-signatures`

Scientific models, the original CEViChE concept, and the source repository belong to the original paper authors and repository maintainers. No endorsement by the original authors is implied.

## GPL-3.0 licensing note

This repository is distributed under the GNU General Public License v3.0. The static application is part of the same repository and should be treated accordingly when redistributed or modified.
