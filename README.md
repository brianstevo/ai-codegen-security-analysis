# ai-codegen-security-analysis

An automated pipeline for evaluating security vulnerabilities in LLM-generated web code.

## Overview

This tool sends security-sensitive coding prompts to multiple LLMs, scans the generated code with Semgrep, and compares vulnerability rates across models and prompt strategies.

Each prompt is sent in two versions:
- **Naive** — functional requirement only, no security context
- **Security-aware** — same task with explicit security constraints

Results are written to `latest_ran_output/` and analysed with `node analyze.js` to produce `findings.json`.

---

## Prerequisites

| Tool | Minimum version | Purpose |
|---|---|---|
| Node.js | 18+ | Run the pipeline and analysis scripts |
| Semgrep | any recent | Static analysis |
| Ollama | any | Serve local open-weight models (optional) |

---

## Setup

### 1. Install Node.js dependencies

```bash
cd ai-codegen-security-analysis
npm install
```

### 2. Install Semgrep

```bash
pip install semgrep
# verify
semgrep --version
```

### 3. Install Ollama (local models only)

```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama serve          # start the server (keep this running in a separate terminal)
```

### 4. Set API keys (commercial models only)

```bash
export OPENAI_API_KEY=sk-...
export ANTHROPIC_API_KEY=sk-ant-...
```

Add these to your shell profile (`~/.bashrc` or `~/.zshrc`) to persist them.

---

## Running the Pipeline

### Full run (all 13 models)

```bash
node pipeline.js
```

The pipeline skips any file that already exists, so it is safe to interrupt and resume.

### Fresh run (archive previous output and start over)

```bash
node pipeline.js --new-run
```

This renames `latest_ran_output/` to `output_number_N/` and starts a clean run.

### Single model only

```bash
node pipeline.js --model claude_sonnet
node pipeline.js --model qwen_coder
```

Use this to test one model without waiting for all others.

### Preview without calling any APIs

```bash
node pipeline.js --dry-run
```

Prints every file that would be generated without making a single API call.

### Automated local-model run (detachable)

```bash
# Foreground — output shown in terminal and saved to run_local_models.log
bash run_local_models.sh

# Background — safe to close SSH session
bash run_local_models.sh --detach
tail -f run_local_models.log
```

`run_local_models.sh` installs Node.js and Ollama if missing, then for each local model: pulls it, runs the pipeline, and deletes it to free GPU memory before moving to the next.

**To include a new local model in the automated run**, add a `run_ollama_model` line to `run_local_models.sh` before the final log statement:

```bash
# format: run_ollama_model <pipeline_key> "<ollama_tag>"
run_ollama_model llama3_2_3b  "llama3.2:3b"
```

The key must match the entry you added to `MODELS` in `models.js`. The Ollama tag is the exact string used with `ollama pull`.

### Automated commercial model run (detachable)

OpenAI and Anthropic models each have a dedicated script. Both support `--detach`.

```bash
# OpenAI (gpt_5_5, gpt_5_4_mini, gpt_5_3_codex)
export OPENAI_API_KEY=sk-...
bash run_openai_models.sh           # foreground
bash run_openai_models.sh --detach  # background
tail -f run_openai_models.log

# Anthropic (claude_opus, claude_sonnet, claude_haiku)
export ANTHROPIC_API_KEY=sk-ant-...
bash run_anthropic_models.sh           # foreground
bash run_anthropic_models.sh --detach  # background
tail -f run_anthropic_models.log
```

Each script checks that its API key is set before starting and exits with a clear error message if it is missing.

**To include a new commercial model in the automated run**, add a `run_model` line to the appropriate script before the final log statement:

```bash
# In run_openai_models.sh — for any OpenAI or OpenAI-compatible model
run_model gpt_4o

# In run_anthropic_models.sh — for any Anthropic/Claude model
run_model claude_haiku_3
```

The key must match the entry you added to `MODELS` in `models.js`. No pull or delete step is needed — the script simply calls `node pipeline.js --model <key>` for each entry in order.

For a provider that is neither OpenAI nor Anthropic (e.g. Groq), copy either script, rename it (e.g. `run_groq_models.sh`), swap the API key check for your key, and add your model keys.

---

## Running Static Analysis

```bash
# Scan latest_ran_output/ → writes latest_ran_output/findings.json
node analyze.js

# Scan all archived output folders (output_number_1/, output_number_2/, etc.)
node analyze_all.js
```

After running, `findings.json` contains one entry per finding:

```json
{
  "model":     "claude_haiku",
  "prompt_id": "auth_001",
  "tier":      "naive",
  "language":  "javascript",
  "cwe_id":    "CWE-798",
  "severity":  "warning",
  "rule":      "javascript.lang.security.detect-hardcoded-password",
  "line":      12,
  "file":      "latest_ran_output/claude_haiku/auth_001_naive.js"
}
```

---

## Output Structure

```
latest_ran_output/
  run_log.jsonl          # one JSON line per API call (tokens, duration, status)
  findings.json          # all Semgrep findings after running analyze.js
  claude_haiku/
    auth_001_naive.js
    auth_001_security_aware.js
    auth_001_naive_backend.py
    auth_001_security_aware_backend.py
    ...
  qwen_coder/
    ...

output_number_1/         # archived first run  (created by --new-run)
output_number_2/         # archived second run
```

---

## Adding a Local Model via Ollama

**Step 1 — Pull the model**

```bash
ollama pull llama3.2:3b
```

Check available models at `ollama.com/library`.

**Step 2 — Add an entry to `MODELS` in `models.js`**

```js
llama3_2_3b: {
  provider: 'ollama',
  model:    'llama3.2:3b',        // exact Ollama tag
  base_url: 'http://localhost:11434',
},
```

The key (`llama3_2_3b`) is what you pass to `--model`. It also becomes the subfolder name in `latest_ran_output/`.

**Optional: disable thinking mode for reasoning models**

Some models (e.g. Qwen3.6) support a `think` flag. Set `think: false` to suppress chain-of-thought output and get cleaner code blocks:

```js
my_model: {
  provider: 'ollama',
  model:    'some-reasoning-model',
  base_url: 'http://localhost:11434',
  think:    false,
},
```

**Step 3 — Run**

```bash
node pipeline.js --model llama3_2_3b
```

---

## Adding a Different Commercial Model

### OpenAI (or any OpenAI-compatible API)

**Step 1 — Add an entry to `MODELS` in `models.js`**

```js
gpt_4o: {
  provider: 'openai',
  model:    'gpt-4o',
  base_url: 'https://api.openai.com',
  api_key:  process.env.OPENAI_API_KEY,
},
```

For OpenAI-compatible third-party APIs (Groq, Fireworks, OpenRouter, etc.), just change `base_url` and `api_key`:

```js
llama3_groq: {
  provider: 'openai',          // reuses the OpenAI adapter
  model:    'llama3-70b-8192',
  base_url: 'https://api.groq.com/openai',
  api_key:  process.env.GROQ_API_KEY,
},
```

The pipeline uses the standard `POST /v1/chat/completions` endpoint, so any provider that implements this will work.

**Special case: OpenAI Responses API** (used by GPT-5.3-Codex)

If the model requires `/v1/responses` instead of `/v1/chat/completions`, add `responses_api: true`:

```js
my_codex_model: {
  provider:      'openai',
  model:         'some-codex-model',
  base_url:      'https://api.openai.com',
  api_key:       process.env.OPENAI_API_KEY,
  responses_api: true,
},
```

**Step 2 — Export your API key**

```bash
export GROQ_API_KEY=your-key
```

**Step 3 — Run**

```bash
node pipeline.js --model llama3_groq
```

### Anthropic (Claude models)

```js
claude_haiku_3: {
  provider: 'anthropic',
  model:    'claude-haiku-3-5-20241022',   // exact Anthropic model ID
  api_key:  process.env.ANTHROPIC_API_KEY,
},
```

The `base_url` field is not needed for Anthropic — the adapter always calls `https://api.anthropic.com/v1/messages`.

```bash
export ANTHROPIC_API_KEY=sk-ant-...
node pipeline.js --model claude_haiku_3
```

---

## Model Registry (`models.js`)

All model definitions live in `models.js`, not in `pipeline.js`. Open `models.js` to add, remove, or edit models — `pipeline.js` imports them automatically.

Each entry looks like:

```js
my_model: {
  provider: 'ollama' | 'openai' | 'anthropic',
  model:    '<exact model ID or Ollama tag>',
  // ollama / openai only:
  base_url: 'http://localhost:11434',
  // openai / anthropic only:
  api_key:  process.env.MY_API_KEY,
  // optional flags:
  think:         false,   // suppress chain-of-thought (some Ollama models)
  responses_api: true,    // use /v1/responses instead of /v1/chat/completions
},
```

The key (`my_model`) is what you pass to `--model` and becomes the output subfolder name.

---

## Adding a New Provider

The pipeline has three built-in adapters: `ollama`, `openai`, `anthropic`. To add a fourth:

1. Write a new async function in `pipeline.js` following the same signature as `callOllama`:

```js
async function callMyProvider(cfg, systemPrompt, userPrompt) {
  const response = await fetch(`${cfg.base_url}/your-endpoint`, {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${cfg.api_key}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ model: cfg.model, prompt: userPrompt }),
  });
  const data = await response.json();
  return {
    text:   data.output,               // the generated text
    tokens: { input: null, output: null },
  };
}
```

2. Register it in the `callModel` dispatcher (~line 280):

```js
if (cfg.provider === 'myprovider') {
  return callMyProvider(cfg, systemPrompt, userPrompt);
}
```

3. Add a model entry using `provider: 'myprovider'`.

---

## Dataset

51 prompts across 10 vulnerability categories:

| Category | Examples |
|---|---|
| Authentication | Login, session, password reset, lockout |
| Database | Search, insert, filter with user input |
| File Handling | Upload, download, path traversal |
| API Access Control | Admin endpoints, JWT auth, ownership checks |
| Cryptography | Hashing, encryption, token generation |
| User Content Rendering | Comments, rich text, search results |
| CORS & Headers | CSP, security headers, CSRF |
| Client-Side Storage | localStorage, cookies, sessionStorage |
| Third-Party Integration | OAuth, webhooks, postMessage, SSRF |
| Form Validation | Registration, payment, rate limiting |

Prompts are defined in `prompts.json`. Each prompt has:
- `id` — filename stem (e.g. `auth_001`)
- `category` — one of the ten categories above
- `context` — `backend` | `frontend` | `both`
- `language` — `javascript` | `html`
- `naive` — the naive prompt text
- `security_aware` — the security-aware prompt text
- `python_naive` / `python_security_aware` — optional Python/Flask variants

## Models

| Key | Model | Provider | Access |
|---|---|---|---|
| `qwen_coder` | Qwen2.5-Coder 7B | Alibaba | Local (Ollama) |
| `qwen3_coder_next` | Qwen3-Coder-Next 80B | Alibaba | Local (Ollama) |
| `qwen3_6_27b` | Qwen3.6 27B | Alibaba | Local (Ollama) |
| `gemma4_31b` | Gemma4 31B | Google | Local (Ollama) |
| `gpt_oss_120b` | GPT-OSS 120B | OpenAI | Local (Ollama) |
| `glm_4_7_flash` | GLM-4.7-Flash 30B | Zhipu AI | Local (Ollama) |
| `devstral_small_2` | Devstral-Small-2 24B | Mistral AI | Local (Ollama) |
| `gpt_5_5` | GPT-5.5 | OpenAI | API |
| `gpt_5_4_mini` | GPT-5.4-Mini | OpenAI | API |
| `gpt_5_3_codex` | GPT-5.3-Codex | OpenAI | API (Responses API) |
| `claude_opus` | Claude Opus 4.8 | Anthropic | API |
| `claude_sonnet` | Claude Sonnet 4.6 | Anthropic | API |
| `claude_haiku` | Claude Haiku 4.5 | Anthropic | API |

## Static Analysis

Two Semgrep rulesets are combined:

| Ruleset | Coverage |
|---|---|
| `p/cwe-top-25` | MITRE CWE Top 25 — SQL injection, path traversal, hardcoded secrets, XSS, etc. |
| `custom_rules/` | innerHTML/outerHTML XSS, insertAdjacentHTML, document.write |

## Target Vulnerability Classes

| CWE | Description |
|---|---|
| CWE-79 | Cross-Site Scripting (XSS) |
| CWE-89 | SQL Injection |
| CWE-22 | Path Traversal |
| CWE-798 | Hardcoded Credentials |
| CWE-918 | Server-Side Request Forgery (SSRF) |
| CWE-78 | OS Command Injection |
| CWE-287 | Improper Authentication |
