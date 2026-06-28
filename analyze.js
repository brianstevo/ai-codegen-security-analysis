/**
 * analyze.js — Static Analysis
 *
 * Runs Semgrep (CWE Top 25 + custom rules) on all generated files in latest_ran_output/,
 * parses the results, and writes findings.json with the schema:
 *   { model, prompt_id, tier, cwe_id, severity, rule, line, file }
 *
 * Usage:
 *   node analyze.js
 */

import { execSync }  from 'child_process';
import fs            from 'fs/promises';

const RAW_OUTPUTS_DIR = './latest_ran_output';
const FINDINGS_FILE   = './latest_ran_output/findings.json';

// ─── Semgrep ──────────────────────────────────────────────────────────────────

function runSemgrep(config, label) {
  console.log(`Running Semgrep (${label})...`);
  try {
    const stdout = execSync(
      `semgrep --config=${config} ${RAW_OUTPUTS_DIR} --json --quiet`,
      { maxBuffer: 50 * 1024 * 1024 }
    ).toString();
    return JSON.parse(stdout);
  } catch (err) {
    // Semgrep exits with code 1 when findings exist — stdout still has valid JSON
    if (err.stdout) {
      try { return JSON.parse(err.stdout.toString()); } catch {}
    }
    console.error(`Semgrep (${label}) failed:`, err.message);
    return { results: [] };
  }
}

/**
 * Parse model, prompt_id, tier, and language from a file path.
 * Expected formats:
 *   latest_ran_output/{model}/{prompt_id}_{tier}.{ext}
 *   latest_ran_output/{model}/{prompt_id}_{tier}_backend.{ext}
 *   output_number_N/{model}/{prompt_id}_{tier}.{ext}
 */
function parseFilePath(filePath) {
  const parts = filePath.replace(/\\/g, '/').split('/');

  // model is always the second-to-last path segment
  const model    = parts[parts.length - 2] ?? 'unknown';
  const filename = parts[parts.length - 1];

  const extMatch = filename.match(/\.(js|html|css|py|txt)$/);
  const ext      = extMatch?.[1] ?? 'txt';
  const language = ext === 'py' ? 'python' : ext === 'js' ? 'javascript' : ext;

  // Strip extension, then strip optional _backend suffix
  let basename = filename.replace(/\.(js|html|css|py|txt)$/, '');
  if (basename.endsWith('_backend')) {
    basename = basename.slice(0, -'_backend'.length);
  }

  let tier, prompt_id;
  if (basename.endsWith('_security_aware')) {
    tier      = 'security_aware';
    prompt_id = basename.slice(0, -'_security_aware'.length);
  } else if (basename.endsWith('_naive')) {
    tier      = 'naive';
    prompt_id = basename.slice(0, -'_naive'.length);
  } else {
    tier      = 'unknown';
    prompt_id = basename;
  }

  return { model, prompt_id, tier, language };
}

/**
 * Extract the first CWE ID string (e.g. "CWE-79") from Semgrep metadata.
 * Semgrep returns CWE as an array of strings like ["CWE-79: Improper Neutralization..."]
 */
function extractCwe(metadata) {
  const cwes = metadata?.cwe ?? metadata?.['cwe-id'] ?? [];
  const list  = Array.isArray(cwes) ? cwes : [cwes];
  for (const entry of list) {
    const match = String(entry).match(/CWE-\d+/);
    if (match) return match[0];
  }
  return 'unknown';
}

// ─── Parser ───────────────────────────────────────────────────────────────────

function parseSemgrepFindings(semgrepData) {
  const findings = [];

  for (const result of semgrepData.results ?? []) {
    const { model, prompt_id, tier, language } = parseFilePath(result.path);

    findings.push({
      model,
      prompt_id,
      tier,
      language,
      cwe_id:   extractCwe(result.extra?.metadata),
      severity: (result.extra?.severity ?? 'unknown').toLowerCase(),
      tool:     'semgrep',
      rule:     result.check_id,
      line:     result.start?.line ?? null,
      file:     result.path,
    });
  }

  return findings;
}

// ─── Summary ──────────────────────────────────────────────────────────────────

function printSummary(findings) {
  const byModel    = {};
  const byCwe      = {};
  const byLanguage = {};
  const byLangCwe  = {};
  const byTier     = {};
  const byTierCwe  = {};

  for (const f of findings) {
    byModel[f.model]       = (byModel[f.model]       ?? 0) + 1;
    byCwe[f.cwe_id]        = (byCwe[f.cwe_id]        ?? 0) + 1;
    byLanguage[f.language] = (byLanguage[f.language] ?? 0) + 1;

    const langCweKey = `${f.language}|${f.cwe_id}`;
    byLangCwe[langCweKey] = (byLangCwe[langCweKey] ?? 0) + 1;

    byTier[f.tier] = (byTier[f.tier] ?? 0) + 1;
    const tierCweKey = `${f.tier}|${f.cwe_id}`;
    byTierCwe[tierCweKey] = (byTierCwe[tierCweKey] ?? 0) + 1;
  }

  console.log('\n── Findings by model ─────────────────');
  for (const [model, count] of Object.entries(byModel)) {
    console.log(`  ${model.padEnd(20)} ${count}`);
  }

  console.log('\n── Findings by CWE ───────────────────');
  for (const [cwe, count] of Object.entries(byCwe).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cwe.padEnd(12)} ${count}`);
  }

  console.log('\n── Findings by language ──────────────');
  for (const [lang, count] of Object.entries(byLanguage).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${lang.padEnd(12)} ${count}`);
  }

  console.log('\n── Findings by language × CWE ────────');
  const languages = [...new Set(findings.map(f => f.language))].sort();
  const cwes      = [...new Set(findings.map(f => f.cwe_id))].sort();
  const colW = 10;
  const header = 'CWE'.padEnd(12) + languages.map(l => l.padEnd(colW)).join('');
  console.log('  ' + header);
  console.log('  ' + '─'.repeat(header.length));
  for (const cwe of cwes) {
    const row = cwe.padEnd(12) + languages.map(l => {
      const count = byLangCwe[`${l}|${cwe}`] ?? 0;
      return (count === 0 ? '-' : String(count)).padEnd(colW);
    }).join('');
    console.log('  ' + row);
  }

  console.log('\n── Findings by prompt tier ───────────');
  for (const [tier, count] of Object.entries(byTier).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${tier.padEnd(20)} ${count}`);
  }

  console.log('\n── Findings by tier × CWE ────────────');
  const tiers    = ['naive', 'security_aware'].filter(t => byTier[t] !== undefined);
  const tierCwes = [...new Set(findings.map(f => f.cwe_id))].sort();
  const tierColW = 16;
  const tierHeader = 'CWE'.padEnd(12) + tiers.map(t => t.padEnd(tierColW)).join('');
  console.log('  ' + tierHeader);
  console.log('  ' + '─'.repeat(tierHeader.length));
  for (const cwe of tierCwes) {
    const row = cwe.padEnd(12) + tiers.map(t => {
      const count = byTierCwe[`${t}|${cwe}`] ?? 0;
      return (count === 0 ? '-' : String(count)).padEnd(tierColW);
    }).join('');
    console.log('  ' + row);
  }

  console.log(`\n  Total findings: ${findings.length}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const cweTop25Data = runSemgrep('p/cwe-top-25',    'CWE Top 25');
  const customData   = runSemgrep('./custom_rules/', 'custom innerHTML/eval');

  const findings = [
    ...parseSemgrepFindings(cweTop25Data),
    ...parseSemgrepFindings(customData),
  ];

  // Deduplicate: same file + rule + line
  const seen    = new Set();
  const unique  = findings.filter(f => {
    const key = `${f.file}|${f.rule}|${f.line}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  await fs.writeFile(FINDINGS_FILE, JSON.stringify(unique, null, 2), 'utf-8');

  printSummary(unique);
  console.log(`\nSaved → ${FINDINGS_FILE}`);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
