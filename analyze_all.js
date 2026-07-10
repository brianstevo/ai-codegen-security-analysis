/**
 * analyze_all.js — Static Analysis on all model output folders
 *
 * Runs Semgrep (CWE Top 25 + custom rules) on each model folder,
 * saves findings.json inside each folder, and prints a combined summary.
 *
 * Usage:
 *   node analyze_all.js
 */

import { execSync } from 'child_process';
import fs           from 'fs/promises';
import path         from 'path';

// Folders to skip — not model output folders
const SKIP_DIRS = new Set([
  'node_modules', 'latest_ran_output', 'custom_rules', '.git',
]);

// Semgrep

function runSemgrep(config, targetDir, label) {
  console.log(`Running Semgrep (${label})...`);
  try {
    const stdout = execSync(
      `semgrep --config=${config} ${targetDir} --json --quiet`,
      { maxBuffer: 50 * 1024 * 1024 }
    ).toString();
    return JSON.parse(stdout);
  } catch (err) {
    if (err.stdout) {
      try { return JSON.parse(err.stdout.toString()); } catch {}
    }
    console.error(`Semgrep (${label}) failed:`, err.message);
    return { results: [] };
  }
}

// Parsers

function parseFilePath(filePath) {
  const parts    = filePath.replace(/\\/g, '/').split('/');
  const model    = parts[parts.length - 2] ?? 'unknown';
  const filename = parts[parts.length - 1];

  const extMatch = filename.match(/\.(js|html|css|py|txt)$/);
  const ext      = extMatch?.[1] ?? 'txt';
  const language = ext === 'py' ? 'python' : ext === 'js' ? 'javascript' : ext;

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

function extractCwe(metadata) {
  const cwes = metadata?.cwe ?? metadata?.['cwe-id'] ?? [];
  const list  = Array.isArray(cwes) ? cwes : [cwes];
  for (const entry of list) {
    const match = String(entry).match(/CWE-\d+/);
    if (match) return match[0];
  }
  return 'unknown';
}

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

function deduplicate(findings) {
  const seen = new Set();
  return findings.filter(f => {
    const key = `${f.file}|${f.rule}|${f.line}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Summary

function printSummary(findings) {
  const byModel    = {};
  const byCwe      = {};
  const byLanguage = {};
  const byLangCwe  = {};
  const byTier     = {};
  const byTierCwe  = {};
  const byModelTier = {};

  for (const f of findings) {
    byModel[f.model]       = (byModel[f.model]       ?? 0) + 1;
    byCwe[f.cwe_id]        = (byCwe[f.cwe_id]        ?? 0) + 1;
    byLanguage[f.language] = (byLanguage[f.language] ?? 0) + 1;
    byTier[f.tier]         = (byTier[f.tier]         ?? 0) + 1;

    const langCweKey  = `${f.language}|${f.cwe_id}`;
    byLangCwe[langCweKey] = (byLangCwe[langCweKey] ?? 0) + 1;

    const tierCweKey  = `${f.tier}|${f.cwe_id}`;
    byTierCwe[tierCweKey] = (byTierCwe[tierCweKey] ?? 0) + 1;

    const modelTierKey = `${f.model}|${f.tier}`;
    byModelTier[modelTierKey] = (byModelTier[modelTierKey] ?? 0) + 1;
  }

  // By model (with naive/SA split)
  console.log('\nFindings by model');
  console.log(`  ${'Model'.padEnd(25)} ${'Naive'.padEnd(8)} ${'SA'.padEnd(8)} Total`);
  const modelsSorted = Object.entries(byModel).sort((a, b) => b[1] - a[1]);
  for (const [model, total] of modelsSorted) {
    const naive = byModelTier[`${model}|naive`]          ?? 0;
    const sa    = byModelTier[`${model}|security_aware`] ?? 0;
    console.log(`  ${model.padEnd(25)} ${String(naive).padEnd(8)} ${String(sa).padEnd(8)} ${total}`);
  }

  // By CWE
  console.log('\nFindings by CWE');
  console.log(`  ${'CWE'.padEnd(12)} ${'Count'.padEnd(8)} %`);
  const total = findings.length;
  for (const [cwe, count] of Object.entries(byCwe).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cwe.padEnd(12)} ${String(count).padEnd(8)} ${(count / total * 100).toFixed(1)}%`);
  }

  // By language
  console.log('\nFindings by language');
  for (const [lang, count] of Object.entries(byLanguage).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${lang.padEnd(12)} ${count}  (${(count / total * 100).toFixed(1)}%)`);
  }

  // Language × CWE table
  console.log('\nFindings by language x CWE');
  const languages = [...new Set(findings.map(f => f.language))].sort();
  const cwes      = [...new Set(findings.map(f => f.cwe_id))].sort();
  const colW = 12;
  const header = 'CWE'.padEnd(12) + languages.map(l => l.padEnd(colW)).join('');
  console.log('  ' + header);
  for (const cwe of cwes) {
    const row = cwe.padEnd(12) + languages.map(l => {
      const count = byLangCwe[`${l}|${cwe}`] ?? 0;
      return (count === 0 ? '-' : String(count)).padEnd(colW);
    }).join('');
    console.log('  ' + row);
  }

  // By tier
  console.log('\nFindings by prompt tier');
  for (const [tier, count] of Object.entries(byTier).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${tier.padEnd(20)} ${count}  (${(count / total * 100).toFixed(1)}%)`);
  }

  // Tier × CWE table
  console.log('\nFindings by tier x CWE');
  const tiers    = ['naive', 'security_aware'].filter(t => byTier[t]);
  const tierColW = 16;
  const tierHeader = 'CWE'.padEnd(12) + tiers.map(t => t.padEnd(tierColW)).join('');
  console.log('  ' + tierHeader);
  for (const cwe of cwes) {
    const row = cwe.padEnd(12) + tiers.map(t => {
      const count = byTierCwe[`${t}|${cwe}`] ?? 0;
      return (count === 0 ? '-' : String(count)).padEnd(tierColW);
    }).join('');
    console.log('  ' + row);
  }

  // Severity breakdown
  console.log('\nFindings by severity');
  const bySeverity = {};
  for (const f of findings) {
    bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;
  }
  for (const [sev, count] of Object.entries(bySeverity).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${sev.padEnd(12)} ${count}  (${(count / total * 100).toFixed(1)}%)`);
  }

  console.log(`\n  Total findings: ${findings.length}`);
}

// Main

async function main() {
  const baseDir = new URL('.', import.meta.url).pathname;
  const entries = await fs.readdir(baseDir, { withFileTypes: true });

  const modelDirs = entries
    .filter(e => e.isDirectory() && !SKIP_DIRS.has(e.name))
    .map(e => path.join(baseDir, e.name));

  const allFindings = [];

  for (const dir of modelDirs) {
    const name = path.basename(dir);
    console.log(`\nScanning ${name}...`);

    const cweData    = runSemgrep('p/cwe-top-25',    dir, `${name} CWE Top 25`);
    const customData = runSemgrep('./custom_rules/',  dir, `${name} custom rules`);

    const findings = deduplicate([
      ...parseSemgrepFindings(cweData),
      ...parseSemgrepFindings(customData),
    ]);

    const outFile = path.join(dir, 'findings.json');
    await fs.writeFile(outFile, JSON.stringify(findings, null, 2), 'utf-8');
    console.log(`  ${findings.length} findings → ${outFile}`);

    allFindings.push(...findings);
  }

  printSummary(allFindings);
  console.log(`\nDone. Total across all folders: ${allFindings.length}`);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
