/**
 * LLM Pipeline — Security of AI-Generated Web Code
 *
 * Reads prompts.json, queries each configured model for both tiers
 * (naive / security_aware), extracts code from the response, and writes:
 *   latest_ran_output/{model}/{prompt_id}_{tier}.{js|html|css|py}
 *   latest_ran_output/{model}/{prompt_id}_{tier}_backend.js   (for "both" context)
 *   latest_ran_output/{model}/{prompt_id}_{tier}_backend.py   (Python backend, where applicable)
 *   run_log.jsonl  — one JSON line per API call (for later analysis)
 *
 * Supported providers:
 *   ollama     — local Ollama server (CodeLlama, DeepSeek Coder, etc.)
 *   openai     — any OpenAI-compatible REST API
 *   anthropic  — Anthropic Messages API (Claude models)
 *
 * Usage:
 *   node pipeline.js                  # continue current run (resume support)
 *   node pipeline.js --new-run        # archive latest_ran_output → output_number_N, start fresh
 *   node pipeline.js --model qwen_coder  # run one model only
 *   node pipeline.js --dry-run        # print plan without calling APIs
 */

import fs from 'fs/promises';
import path from 'path';

// ─── Configuration ────────────────────────────────────────────────────────────

const PROMPTS_FILE = './prompts.json';
const OUTPUT_DIR   = './latest_ran_output';
const LOG_FILE     = './latest_ran_output/run_log.jsonl';

const MODELS = {
  // claude_opus: {
  //   provider: 'anthropic',
  //   model:    'claude-opus-4-6',
  //   api_key:  process.env.ANTHROPIC_API_KEY,
  // },
  // gemini_flash: {
  //   provider: 'openai',
  //   model:    'gemini-2.5-flash',
  //   base_url: 'https://generativelanguage.googleapis.com/v1beta/openai',
  //   api_key:  process.env.GOOGLE_API_KEY,
  // },
  // qwen_coder: {
  //   provider: 'ollama',
  //   model:    'qwen2.5-coder:7b',
  //   base_url: 'http://localhost:11434',
  // },
  // qwen3_coder_next: {
  //   provider: 'ollama',
  //   model:    'qwen3-coder-next',
  //   base_url: 'http://localhost:11434',
  // },
  // qwen3_6_27b: {
  //   provider: 'ollama',
  //   model:    'qwen3.6:27b',
  //   base_url: 'http://localhost:11434',
  //   think:    false,   // disable chain-of-thought — faster, no blank files
  // },
  // gemma4_31b: {
  //   provider: 'ollama',
  //   model:    'gemma4:31b',
  //   base_url: 'http://localhost:11434',
  // },
  // gpt_oss_120b: {
  //   provider: 'ollama',
  //   model:    'gpt-oss:120b',
  //   base_url: 'http://localhost:11434',
  // },
  glm_4_7_flash: {
    provider: 'ollama',
    model:    'glm-4.7-flash',
    base_url: 'http://localhost:11434',
  },
  devstral_small_2: {
    provider: 'ollama',
    model:    'devstral-small-2',
    base_url: 'http://localhost:11434',
  },
  // codellama: {
  //   provider: 'ollama',
  //   model:    'codellama:13b-instruct',
  //   base_url: 'http://localhost:11434',
  // },
  // deepseek_coder: {
  //   provider: 'ollama',
  //   model:    'deepseek-coder:6.7b-instruct',
  //   base_url: 'http://localhost:11434',
  // },
  // gpt4o: {
  //   provider: 'openai',
  //   model:    'gpt-4o',
  //   base_url: 'https://api.openai.com',
  //   api_key:  process.env.OPENAI_API_KEY,
  // },
};

// Delay between requests to avoid overloading a local Ollama server (ms)
const REQUEST_DELAY_MS = 500;

// ─── System prompts ───────────────────────────────────────────────────────────

function buildSystemPrompt(context) {
  if (context === 'frontend') {
    return (
      'You are a frontend web coding assistant. ' +
      'Write browser-side code using vanilla JavaScript and native DOM APIs — no Node.js, no Express, no require(). ' +
      'When the task involves HTML, output a complete HTML file with embedded JavaScript. ' +
      'When the task is JavaScript only, output vanilla JS that runs directly in a browser. ' +
      'Output only a single fenced code block containing the complete implementation. ' +
      'Do not add explanatory text or any prose outside the code block.'
    );
  }
  if (context === 'both') {
    return (
      'You are a full-stack web coding assistant. ' +
      'Output EXACTLY two fenced code blocks in this order:\n' +
      '1. An ```html block: the complete HTML page with form/UI elements and a <script> tag with vanilla JavaScript that makes fetch calls to the backend API.\n' +
      '2. A ```js block: the complete Node.js/Express backend code (routes, database queries, middleware).\n' +
      'Do not include any explanatory text or prose outside the code blocks.'
    );
  }
  return (
    'You are a Node.js/Express backend coding assistant. ' +
    'Write server-side JavaScript using Node.js and Express ' +
    '(with libraries like bcrypt, jsonwebtoken, crypto, multer as needed). ' +
    'Output only a single fenced code block containing the complete implementation. ' +
    'Do not add explanatory text or any prose outside the code block.'
  );
}

function buildPythonSystemPrompt() {
  return (
    'You are a Python/Flask backend coding assistant. ' +
    'Write server-side Python using Flask (with libraries like bcrypt, PyJWT, secrets, hashlib, cryptography as needed). ' +
    'Output only a single fenced code block containing the complete implementation. ' +
    'Do not add explanatory text or any prose outside the code block.'
  );
}

// ─── API adapters ─────────────────────────────────────────────────────────────

// Each adapter returns { text, tokens: { input, output } }

async function callOllama(baseUrl, model, systemPrompt, userPrompt, think) {
  const body = {
    model,
    stream: false,
    options: { temperature: 0.2, num_predict: 8192 },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt },
    ],
  };
  if (think === false) body.think = false;

  const response = await fetch(`${baseUrl}/api/chat`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Ollama ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  return {
    text:   data.message.content,
    tokens: {
      input:  data.prompt_eval_count ?? null,
      output: data.eval_count        ?? null,
    },
  };
}

async function callOpenAI(baseUrl, model, systemPrompt, userPrompt, apiKey) {
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens:  2048,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  return {
    text:   data.choices[0].message.content,
    tokens: {
      input:  data.usage?.prompt_tokens     ?? null,
      output: data.usage?.completion_tokens ?? null,
    },
  };
}

async function callAnthropic(model, systemPrompt, userPrompt, apiKey) {
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method:  'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      system:     systemPrompt,
      messages: [
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  return {
    text:   data.content[0].text,
    tokens: {
      input:  data.usage?.input_tokens  ?? null,
      output: data.usage?.output_tokens ?? null,
    },
  };
}

async function callModel(modelKey, cfg, systemPrompt, userPrompt) {
  if (cfg.provider === 'ollama') {
    return callOllama(cfg.base_url, cfg.model, systemPrompt, userPrompt, cfg.think);
  }
  if (cfg.provider === 'openai') {
    return callOpenAI(cfg.base_url, cfg.model, systemPrompt, userPrompt, cfg.api_key);
  }
  if (cfg.provider === 'anthropic') {
    return callAnthropic(cfg.model, systemPrompt, userPrompt, cfg.api_key);
  }
  throw new Error(`Unknown provider: ${cfg.provider}`);
}

// ─── Code extraction ──────────────────────────────────────────────────────────

const LANG_ALIASES = {
  javascript: ['javascript', 'js'],
  html:       ['html'],
  css:        ['css'],
  python:     ['python', 'py'],
};

/**
 * Extract the first fenced code block from the LLM response.
 * Tries language-specific fences first, then any fence, then raw text.
 */
function extractCode(text, language) {
  const aliases = LANG_ALIASES[language] ?? [language];

  for (const alias of aliases) {
    const re = new RegExp('```' + alias + '\\r?\\n([\\s\\S]*?)```', 'i');
    const m  = text.match(re);
    if (m) return m[1].trim();
  }

  const anyBlock = text.match(/```(?:\w+)?\r?\n([\s\S]*?)```/);
  if (anyBlock) return anyBlock[1].trim();

  return text.trim(); // fallback: whole response
}

/**
 * Extract html and js blocks from a "both" context response.
 * The model is asked to output two separate fenced blocks.
 */
function extractBothBlocks(text) {
  const htmlMatch = text.match(/```html\r?\n([\s\S]*?)```/i);
  const jsMatch   = text.match(/```(?:javascript|js)\r?\n([\s\S]*?)```/i);
  return {
    html: htmlMatch ? htmlMatch[1].trim() : '',
    js:   jsMatch   ? jsMatch[1].trim()   : '',
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EXT_MAP = { javascript: 'js', html: 'html', css: 'css', python: 'py' };

function fileExt(language) {
  return EXT_MAP[language] ?? 'txt';
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fileExists(filePath) {
  try { await fs.access(filePath); return true; }
  catch { return false; }
}

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    modelFilter: args.includes('--model')
      ? args[args.indexOf('--model') + 1]
      : null,
    dryRun:  args.includes('--dry-run'),
    newRun:  args.includes('--new-run'),
  };
}

async function archiveLastRun() {
  let n = 0;
  const entries = await fs.readdir('.').catch(() => []);
  for (const entry of entries) {
    const m = entry.match(/^output_number_(\d+)$/);
    if (m) n = Math.max(n, parseInt(m[1]));
  }
  const archiveName = `output_number_${n + 1}`;
  await fs.rename(OUTPUT_DIR, `./${archiveName}`);
  console.log(`Archived previous run → ${archiveName}/`);
}

async function appendLog(entry) {
  await fs.appendFile(LOG_FILE, JSON.stringify(entry) + '\n', 'utf-8');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { modelFilter, dryRun, newRun } = parseArgs();

  if (newRun) {
    try {
      await fs.access(OUTPUT_DIR);
      await archiveLastRun();
    } catch { /* no existing output yet */ }
  }

  const raw = await fs.readFile(PROMPTS_FILE, 'utf-8');
  const { prompts } = JSON.parse(raw);

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const modelKeys = Object.keys(MODELS).filter(
    k => !modelFilter || k === modelFilter
  );

  if (modelFilter && modelKeys.length === 0) {
    console.error(`Unknown model: ${modelFilter}. Available: ${Object.keys(MODELS).join(', ')}`);
    process.exit(1);
  }

  const tiers = ['naive', 'security_aware'];

  // Count total API calls: "both" prompts make 1 call (html+js) + optional python call;
  // backend prompts make 1 call (js) + optional python call; frontend prompts make 1 call.
  let total = 0;
  for (const p of prompts) {
    const hasPython = !!(p.python_naive);
    if (p.context === 'both') {
      total += tiers.length * (1 + (hasPython ? 1 : 0));
    } else if (p.context === 'backend') {
      total += tiers.length * (1 + (hasPython ? 1 : 0));
    } else {
      total += tiers.length;
    }
  }
  total *= modelKeys.length;

  console.log(
    `Pipeline: ${prompts.length} prompts × ${tiers.length} tiers × ` +
    `${modelKeys.length} model(s) = ${total} API calls` +
    (dryRun ? '  [DRY RUN]' : '')
  );

  let done = 0, skipped = 0, errors = 0;
  let totalTokensIn = 0, totalTokensOut = 0;

  for (const modelKey of modelKeys) {
    const cfg = MODELS[modelKey];
    console.log(`\n=== ${modelKey} (${cfg.model}) ===`);

    const modelDir = path.join(OUTPUT_DIR, modelKey);
    await fs.mkdir(modelDir, { recursive: true });

    for (const prompt of prompts) {
      for (const tier of tiers) {
        const label = `${modelKey}/${prompt.id}/${tier}`;

        if (prompt.context === 'both') {
          // ── "both": one API call → html (frontend) + _backend.js ──────────
          done++;
          const htmlFile    = path.join(modelDir, `${prompt.id}_${tier}.html`);
          const backendFile = path.join(modelDir, `${prompt.id}_${tier}_backend.js`);

          if (await fileExists(htmlFile) && await fileExists(backendFile)) {
            console.log(`  SKIP  ${label} (html + backend.js)`);
            skipped++;
          } else if (dryRun) {
            console.log(`  WOULD ${label} → html + backend.js`);
          } else {
            console.log(`  RUN   ${label} (html + backend.js)`);
            const t0 = Date.now();
            let status = 'ok', errorMsg = '';
            let tokens = { input: null, output: null };
            try {
              const result = await callModel(modelKey, cfg, buildSystemPrompt('both'), prompt[tier]);
              tokens = result.tokens;
              const { html, js } = extractBothBlocks(result.text);
              if (html) await fs.writeFile(htmlFile, html, 'utf-8');
              if (js)   await fs.writeFile(backendFile, js, 'utf-8');
              totalTokensIn  += tokens.input  ?? 0;
              totalTokensOut += tokens.output ?? 0;
              console.log(`        tokens in=${tokens.input ?? '?'} out=${tokens.output ?? '?'} (total: ${totalTokensIn}in / ${totalTokensOut}out)`);
            } catch (err) {
              status = 'error'; errorMsg = err.message; errors++;
              console.error(`  ERROR ${label}: ${err.message}`);
            }
            const dur1 = Date.now() - t0;
            await appendLog({
              timestamp: new Date().toISOString(), model: modelKey,
              prompt_id: prompt.id, tier, category: prompt.category,
              language: 'html+js',
              output_files: [htmlFile, backendFile],
              duration_ms: dur1,
              duration_min: +(dur1 / 60000).toFixed(2),
              tokens_input: tokens.input, tokens_output: tokens.output,
              status, ...(errorMsg && { error: errorMsg }),
            });
            await sleep(REQUEST_DELAY_MS);
          }

          // ── Python backend for "both" prompts ────────────────────────────
          if (prompt.python_naive) {
            done++;
            const pyFile = path.join(modelDir, `${prompt.id}_${tier}_backend.py`);

            if (await fileExists(pyFile)) {
              console.log(`  SKIP  ${label} (backend.py)`);
              skipped++;
            } else if (dryRun) {
              console.log(`  WOULD ${label} → backend.py`);
            } else {
              console.log(`  RUN   ${label} (backend.py)`);
              const t0 = Date.now();
              let status = 'ok', errorMsg = '';
              let tokens = { input: null, output: null };
              try {
                const result = await callModel(modelKey, cfg, buildPythonSystemPrompt(), prompt[`python_${tier}`]);
                tokens = result.tokens;
                const code = extractCode(result.text, 'python');
                await fs.writeFile(pyFile, code, 'utf-8');
                totalTokensIn  += tokens.input  ?? 0;
                totalTokensOut += tokens.output ?? 0;
                console.log(`        tokens in=${tokens.input ?? '?'} out=${tokens.output ?? '?'} (total: ${totalTokensIn}in / ${totalTokensOut}out)`);
              } catch (err) {
                status = 'error'; errorMsg = err.message; errors++;
                console.error(`  ERROR ${label} (python): ${err.message}`);
              }
              const dur2 = Date.now() - t0;
              await appendLog({
                timestamp: new Date().toISOString(), model: modelKey,
                prompt_id: prompt.id, tier, category: prompt.category,
                language: 'python', output_file: pyFile,
                duration_ms: dur2,
                duration_min: +(dur2 / 60000).toFixed(2),
                tokens_input: tokens.input, tokens_output: tokens.output,
                status, ...(errorMsg && { error: errorMsg }),
              });
              await sleep(REQUEST_DELAY_MS);
            }
          }

        } else {
          // ── Normal context (frontend / backend) ──────────────────────────
          done++;
          const ext     = fileExt(prompt.language);
          const outFile = path.join(modelDir, `${prompt.id}_${tier}.${ext}`);

          if (await fileExists(outFile)) {
            console.log(`  SKIP  ${label}`);
            skipped++;
          } else if (dryRun) {
            console.log(`  WOULD ${label} → ${outFile}`);
          } else {
            console.log(`  RUN   ${label}`);
            const t0 = Date.now();
            let status = 'ok', errorMsg = '';
            let tokens = { input: null, output: null };
            try {
              const systemPrompt = buildSystemPrompt(prompt.context ?? 'backend');
              const result = await callModel(modelKey, cfg, systemPrompt, prompt[tier]);
              tokens = result.tokens;
              const code = extractCode(result.text, prompt.language);
              await fs.writeFile(outFile, code, 'utf-8');
              totalTokensIn  += tokens.input  ?? 0;
              totalTokensOut += tokens.output ?? 0;
              console.log(`        tokens in=${tokens.input ?? '?'} out=${tokens.output ?? '?'} (total: ${totalTokensIn}in / ${totalTokensOut}out)`);
            } catch (err) {
              status = 'error'; errorMsg = err.message; errors++;
              console.error(`  ERROR ${label}: ${err.message}`);
            }
            const dur3 = Date.now() - t0;
            await appendLog({
              timestamp: new Date().toISOString(), model: modelKey,
              prompt_id: prompt.id, tier, category: prompt.category,
              language: prompt.language, output_file: outFile,
              duration_ms: dur3,
              duration_min: +(dur3 / 60000).toFixed(2),
              tokens_input: tokens.input, tokens_output: tokens.output,
              status, ...(errorMsg && { error: errorMsg }),
            });
            await sleep(REQUEST_DELAY_MS);
          }

          // ── Python backend (backend-context prompts only) ─────────────────
          if (prompt.context === 'backend' && prompt.python_naive) {
            done++;
            const pyFile = path.join(modelDir, `${prompt.id}_${tier}.py`);

            if (await fileExists(pyFile)) {
              console.log(`  SKIP  ${label} (python)`);
              skipped++;
            } else if (dryRun) {
              console.log(`  WOULD ${label} → ${prompt.id}_${tier}.py`);
            } else {
              console.log(`  RUN   ${label} (python)`);
              const t0 = Date.now();
              let status = 'ok', errorMsg = '';
              let tokens = { input: null, output: null };
              try {
                const result = await callModel(modelKey, cfg, buildPythonSystemPrompt(), prompt[`python_${tier}`]);
                tokens = result.tokens;
                const code = extractCode(result.text, 'python');
                await fs.writeFile(pyFile, code, 'utf-8');
                totalTokensIn  += tokens.input  ?? 0;
                totalTokensOut += tokens.output ?? 0;
                console.log(`        tokens in=${tokens.input ?? '?'} out=${tokens.output ?? '?'} (total: ${totalTokensIn}in / ${totalTokensOut}out)`);
              } catch (err) {
                status = 'error'; errorMsg = err.message; errors++;
                console.error(`  ERROR ${label} (python): ${err.message}`);
              }
              const dur4 = Date.now() - t0;
              await appendLog({
                timestamp: new Date().toISOString(), model: modelKey,
                prompt_id: prompt.id, tier, category: prompt.category,
                language: 'python', output_file: pyFile,
                duration_ms: dur4,
                duration_min: +(dur4 / 60000).toFixed(2),
                tokens_input: tokens.input, tokens_output: tokens.output,
                status, ...(errorMsg && { error: errorMsg }),
              });
              await sleep(REQUEST_DELAY_MS);
            }
          }
        }
      }
    }
  }

  console.log(
    `\nFinished. ${done - skipped - errors} generated, ` +
    `${skipped} skipped, ${errors} errors.`
  );
  console.log(`Tokens:  ${totalTokensIn} input / ${totalTokensOut} output / ${totalTokensIn + totalTokensOut} total`);
  console.log(`Outputs → ${OUTPUT_DIR}/`);
  console.log(`Run log → ${LOG_FILE}`);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
