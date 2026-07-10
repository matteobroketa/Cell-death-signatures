args <- commandArgs(trailingOnly = TRUE)

if (length(args) != 3) {
  stop("Usage: Rscript reference_prediction.R <model_csv> <expression_csv> <output_csv>")
}

model_path <- args[[1]]
expression_path <- args[[2]]
output_path <- args[[3]]

model <- read.csv(model_path, check.names = FALSE, stringsAsFactors = FALSE, row.names = NULL)
expression <- read.csv(expression_path, check.names = FALSE, stringsAsFactors = FALSE, row.names = NULL)

identifier_values <- model[[1]]

intercept_row <- model[identifier_values == "INTERCEPT", , drop = FALSE]
if (nrow(intercept_row) != 1) {
  stop("Model must contain exactly one INTERCEPT row.")
}

intercept <- as.numeric(intercept_row$coefficient[[1]])
ordinary_model <- model[identifier_values != "INTERCEPT", c("pr_gene_symbol", "coefficient"), drop = FALSE]
names(ordinary_model) <- c("gene", "coefficient")
ordinary_model$coefficient <- as.numeric(ordinary_model$coefficient)

if (!identical(names(expression)[1], "gene")) {
  stop("Expression matrix must contain a first column named gene.")
}

common_genes <- intersect(expression$gene, ordinary_model$gene)
if (length(common_genes) == 0) {
  stop("Expression matrix has zero overlap with the model.")
}

expression_common <- expression[expression$gene %in% common_genes, , drop = FALSE]
model_common <- ordinary_model[ordinary_model$gene %in% common_genes, , drop = FALSE]

expression_common <- expression_common[order(expression_common$gene), , drop = FALSE]
model_common <- model_common[order(model_common$gene), , drop = FALSE]

if (!identical(expression_common$gene, model_common$gene)) {
  stop("Gene alignment failed.")
}

expression_matrix <- as.matrix(expression_common[, -1, drop = FALSE])
storage.mode(expression_matrix) <- "numeric"
coefficients <- matrix(model_common$coefficient, ncol = 1)
predictions <- t(expression_matrix) %*% coefficients + intercept

output <- data.frame(
  sample = colnames(expression_matrix),
  prediction = as.numeric(predictions),
  stringsAsFactors = FALSE
)

write.csv(output, file = output_path, row.names = FALSE, quote = FALSE)
