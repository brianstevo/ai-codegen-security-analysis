/**
 * LLM Pipeline — Security of AI-Generated Web Code
 *
 * Reads prompts.json, queries each configured model for both tiers
 * (naive / security_aware), extracts code from the response, and writes:
 *   raw_outputs/{model}_{prompt_id}_{tier}.{js|html|css}
 *   run_log.jsonl  — one JSON line per run (for later analysis)
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

/**
 * Add or remove models here.
 *
 * provider: 'ollama' | 'openai'
 * model   : model name as recognised by the provider
 * base_url: API base URL (no trailing slash)
 * api_key : required for 'openai' provider; ignored for 'ollama'
 *
 * Ollama quick-start:
 *   ollama pull codellama:13b-instruct
 *   ollama pull deepseek-coder:6.7b-instruct
 *
 * Anthropic quick-start:
 *   export ANTHROPIC_API_KEY=sk-ant-...
 */
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
  qwen_coder: {
    provider: 'ollama',
    model:    'qwen2.5-coder:7b',
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

// Returns the appropriate system prompt based on prompt context
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
      'Output a single complete HTML file that contains three clearly separated sections:\n' +
      '1. The HTML <body> with the form or UI elements.\n' +
      '2. A <script> tag with vanilla JavaScript for DOM interactions and fetch calls to the backend.\n' +
      '3. A <script type="text/plain" id="backend"> block containing the Node.js/Express backend code ' +
      '(routes, database queries, middleware) as plain text so it is readable but not executed by the browser.\n' +
      'Output only a single fenced html code block. ' +
      'Do not add explanatory text or any prose outside the code block.'
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

// Each adapter returns { text, tokens: { input, output } }

async function callOllama(baseUrl, model, systemPrompt, userPrompt) {
  const response = await fetch(`${baseUrl}/api/chat`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      options: { temperature: 0.2, num_predict: 2048 },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt },
      ],
    }),
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
    return callOllama(cfg.base_url, cfg.model, systemPrompt, userPrompt);
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EXT_MAP = { javascript: 'js', html: 'html', css: 'css' };

function fileExt(language) {
  return EXT_MAP[language] ?? 'txt';
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
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
  // Find highest existing output_number_N and increment
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

async function main() {
  const { modelFilter, dryRun, newRun } = parseArgs();

  // Archive existing output and start fresh if --new-run
  if (newRun) {
    try {
      await fs.access(OUTPUT_DIR);
      await archiveLastRun();
    } catch { /* no existing output yet — nothing to archive */ }
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
  const total = prompts.length * tiers.length * modelKeys.length;

  console.log(
    `Pipeline: ${prompts.length} prompts × ${tiers.length} tiers × ` +
    `${modelKeys.length} model(s) = ${total} runs` +
    (dryRun ? '  [DRY RUN]' : '')
  );

  let done = 0, skipped = 0, errors = 0;

  for (const modelKey of modelKeys) {
    const cfg = MODELS[modelKey];
    console.log(`\n=== ${modelKey} (${cfg.model}) ===`);

    const modelDir = path.join(OUTPUT_DIR, modelKey);
    await fs.mkdir(modelDir, { recursive: true });

    for (const prompt of prompts) {
      for (const tier of tiers) {
        done++;
        const ext     = fileExt(prompt.language);
        const outFile = path.join(modelDir, `${prompt.id}_${tier}.${ext}`);
        const label   = `[${done}/${total}] ${modelKey}/${prompt.id}/${tier}`;

        // Resume support: skip already-completed files
        try {
          await fs.access(outFile);
          console.log(`  SKIP  ${label}`);
          skipped++;
          continue;
        } catch { /* file does not exist — proceed */ }

        if (dryRun) {
          console.log(`  WOULD ${label} → ${outFile}`);
          continue;
        }

        console.log(`  RUN   ${label}`);
        const t0 = Date.now();
        let status = 'ok';
        let errorMsg = '';
        let tokens = { input: null, output: null };

        try {
          const systemPrompt = buildSystemPrompt(prompt.context ?? 'backend');
          const result = await callModel(modelKey, cfg, systemPrompt, prompt[tier]);
          const code   = extractCode(result.text, prompt.language);
          tokens       = result.tokens;
          await fs.writeFile(outFile, code, 'utf-8');
          console.log(`        tokens in=${tokens.input ?? '?'} out=${tokens.output ?? '?'}`);
        } catch (err) {
          status   = 'error';
          errorMsg = err.message;
          errors++;
          console.error(`  ERROR ${label}: ${err.message}`);
        }

        const logEntry = {
          timestamp:    new Date().toISOString(),
          model:        modelKey,
          prompt_id:    prompt.id,
          tier,
          category:     prompt.category,
          language:     prompt.language,
          output_file:  outFile,
          duration_ms:  Date.now() - t0,
          tokens_input:  tokens.input,
          tokens_output: tokens.output,
          status,
          ...(errorMsg && { error: errorMsg }),
        };
        await fs.appendFile(LOG_FILE, JSON.stringify(logEntry) + '\n', 'utf-8');

        await sleep(REQUEST_DELAY_MS);
      }
    }
  }

  console.log(
    `\nFinished. ${done - skipped - errors} generated, ` +
    `${skipped} skipped, ${errors} errors.`
  );
  console.log(`Outputs → ${OUTPUT_DIR}/`);
  console.log(`Run log → ${LOG_FILE}`);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
