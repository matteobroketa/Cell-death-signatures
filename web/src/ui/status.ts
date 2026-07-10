import { escapeHtml } from '../lib/text';
import type { ValidationIssue } from '../lib/types';

function renderIssue(issue: ValidationIssue): string {
  const locationBits = [
    issue.row !== undefined ? `row ${issue.row}` : '',
    issue.gene ? `gene ${issue.gene}` : '',
    issue.sample ? `sample ${issue.sample}` : '',
  ].filter(Boolean);

  return `
    <li class="issue-item ${issue.level}">
      <strong>${issue.level === 'error' ? 'Error' : 'Warning'}</strong>
      <span>${escapeHtml(issue.message)}</span>
      ${locationBits.length > 0 ? `<span class="issue-location">(${escapeHtml(locationBits.join(', '))})</span>` : ''}
    </li>
  `;
}

export function renderIssueGroup(
  title: string,
  issues: ValidationIssue[],
  tone: 'error' | 'warning',
): string {
  if (issues.length === 0) {
    return `
      <section class="issue-group ${tone}">
        <h3>${title}</h3>
        <p class="empty-state">No ${tone}s.</p>
      </section>
    `;
  }

  return `
    <section class="issue-group ${tone}">
      <h3>${title}</h3>
      <ul class="issue-list">
        ${issues.map(renderIssue).join('')}
      </ul>
    </section>
  `;
}
