const readableNumberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 6,
});

const compactNumberFormatter = new Intl.NumberFormat('en-US', {
  maximumSignificantDigits: 4,
});

const previewNumberFormatter = new Intl.NumberFormat('en-US', {
  maximumSignificantDigits: 4,
});

const knownTechnicalSuffixes = [
  '_vs_vehicle_DESeq2_log2FC',
  '_vs_untreated_DESeq2_log2FC',
  '_vs_control_log2FC',
] as const;

export interface SampleLabelPresentation {
  rawLabel: string;
  displayLabel: string;
  technicalSuffix?: string;
}

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function titleCaseToken(value: string): string {
  if (value.length === 0) {
    return value;
  }

  const [firstCharacter = ''] = value;
  return firstCharacter.toUpperCase() + value.slice(1);
}

function formatDurationToken(token: string): string | null {
  const match = token.match(/^(\d+(?:\.\d+)?)(h|hr|hrs|hour|hours|min|mins|minute|minutes|d|day|days)$/i);
  if (!match) {
    return null;
  }

  const [, amount, unit = ''] = match;
  const normalizedUnit = unit.toLowerCase();

  if (normalizedUnit.startsWith('h')) {
    return `${amount} h`;
  }

  if (normalizedUnit.startsWith('min')) {
    return `${amount} min`;
  }

  return `${amount} d`;
}

export function formatConcentrationToken(token: string): string {
  const match = token.match(/^(\d+(?:\.\d+)?)(um|uM|μm|μM|µm|µM|nm|nM|mm|mM|pm|pM)$/);
  if (!match) {
    return token;
  }

  const [, amount, unit = ''] = match;
  const normalizedUnit = unit.toLowerCase();

  if (normalizedUnit === 'um' || normalizedUnit === 'μm' || normalizedUnit === 'µm') {
    return `${amount} µM`;
  }

  if (normalizedUnit === 'nm') {
    return `${amount} nM`;
  }

  if (normalizedUnit === 'mm') {
    return `${amount} mM`;
  }

  return `${amount} pM`;
}

function stripKnownTechnicalSuffix(rawLabel: string): { baseLabel: string; technicalSuffix?: string } {
  const matchedSuffix = knownTechnicalSuffixes.find((suffix) => rawLabel.endsWith(suffix));
  if (!matchedSuffix) {
    return { baseLabel: rawLabel };
  }

  return {
    baseLabel: rawLabel.slice(0, -matchedSuffix.length),
    technicalSuffix: matchedSuffix,
  };
}

function formatSampleBaseLabel(baseLabel: string): string {
  const normalized = normalizeWhitespace(baseLabel.replace(/_+/g, ' '));
  if (normalized.length === 0) {
    return '';
  }

  const tokens = normalized.split(' ');
  const formattedDuration = formatDurationToken(tokens[tokens.length - 1] ?? '');
  const formattedConcentration = formatConcentrationToken(tokens[tokens.length - 2] ?? '');
  const concentrationChanged = formattedConcentration !== (tokens[tokens.length - 2] ?? '');

  if (formattedDuration && concentrationChanged) {
    const leading = tokens.slice(0, -2).join(' ');
    return [leading, formattedConcentration, formattedDuration]
      .filter((part) => part.length > 0)
      .join(' · ');
  }

  return tokens.map((token) => titleCaseToken(formatConcentrationToken(token))).join(' ');
}

export function formatSampleLabel(rawLabel: string): SampleLabelPresentation {
  const stripped = stripKnownTechnicalSuffix(rawLabel);
  const displayLabel = formatSampleBaseLabel(stripped.baseLabel);

  const presentation: SampleLabelPresentation = {
    rawLabel,
    displayLabel: displayLabel.length > 0 ? displayLabel : rawLabel,
  };

  if (stripped.technicalSuffix !== undefined) {
    presentation.technicalSuffix = stripped.technicalSuffix;
  }

  return presentation;
}

export function formatReadableNumber(value: number): string {
  return readableNumberFormatter.format(value);
}

export function formatCompactNumber(value: number): string {
  return compactNumberFormatter.format(value);
}

export function formatPreviewNumber(value: number): string {
  return previewNumberFormatter.format(value);
}

export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}
