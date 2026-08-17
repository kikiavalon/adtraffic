/**
 * Trafficking QA — harness page the runner renders around a placement tag.
 *
 * The tag HTML (when provided) renders for impression fire + evidence; the
 * simulated click deterministically navigates the exported clickTag URL via
 * the #qa-click anchor — creative-agnostic across formats (locked decision).
 */

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

export function buildHarnessHtml(job: { clickUrl: string; tagHtml?: string }): string {
  const tag = job.tagHtml ? `<div id="qa-tag">${job.tagHtml}</div>` : '';
  return [
    '<!doctype html><html><head><meta charset="utf-8"><title>AdTraffic QA harness</title></head><body>',
    tag,
    `<a id="qa-click" href="${escapeAttr(job.clickUrl)}" rel="noreferrer">Simulated ad click</a>`,
    '</body></html>',
  ].join('');
}
