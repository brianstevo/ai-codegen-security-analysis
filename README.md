# ai-codegen-security-analysis

An automated pipeline for evaluating security vulnerabilities in LLM-generated web code.

## Overview

This tool sends security-sensitive coding prompts to multiple LLMs, scans the generated code with Semgrep, and compares vulnerability rates across models and prompt strategies.

Each prompt is sent in two versions:
- **Naive** — functional requirement only, no security context
- **Security-aware** — same task with explicit security constraints

## Dataset

50 prompts across 10 categories:

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

Prompts are tagged with `context: backend | frontend | both` to generate the appropriate code style.

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
| `gpt_5_3_codex` | GPT-5.3-Codex | OpenAI | API |
| `claude_opus` | Claude Opus 4.8 | Anthropic | API |
| `claude_sonnet` | Claude Sonnet 4.6 | Anthropic | API |
| `claude_haiku` | Claude Haiku 4.5 | Anthropic | API |

## Setup

```bash
# Install Node.js dependencies
npm install

# Install Semgrep
pip install semgrep

# For local models — install Ollama and pull the model
ollama pull qwen2.5-coder:7b

# Set API keys
export GOOGLE_API_KEY=your-key
export ANTHROPIC_API_KEY=your-key
```

## Usage

### Run the pipeline

```bash
# Continue current run (resumes from where it stopped)
node pipeline.js

# Start a fresh run (archives current output → output_number_N)
node pipeline.js --new-run

# Run a single model only
node pipeline.js --model qwen_coder

# Preview what would run without calling any APIs
node pipeline.js --dry-run
```

### Run static analysis

```bash
# Scan latest_ran_output/ and write findings.json there
node analyze.js

# Scan all model output folders (devstral-glm/, gemma4-31b/, etc.)
# Writes findings.json inside each folder and prints a combined summary
node analyze_all.js
```

## Output Structure

```
latest_ran_output/
  run_log.jsonl        # one JSON line per API call (tokens, duration, status)
  findings.json        # all Semgrep findings with CWE IDs
  qwen_coder/
    auth_001_naive.js
    auth_001_security_aware.js
    ...
  gemini_flash/
    ...

output_number_1/       # archived previous run
output_number_2/       # archived run before that
```

## Static Analysis

Two Semgrep rulesets are combined:

| Ruleset | Coverage |
|---|---|
| `p/cwe-top-25` | MITRE CWE Top 25 — SQL injection, path traversal, hardcoded secrets, XSS, etc. |
| `custom_rules/` | innerHTML/outerHTML XSS, insertAdjacentHTML, document.write, eval() |

Findings schema:
```json
{ "model", "prompt_id", "tier", "cwe_id", "severity", "tool", "rule", "line", "file" }
```

## Target Vulnerability Classes

| CWE | Description |
|---|---|
| CWE-79 | Cross-Site Scripting (XSS) |
| CWE-89 | SQL Injection |
| CWE-94 | Code Injection (eval) |
| CWE-22 | Path Traversal |
| CWE-798 | Hardcoded Credentials |
| CWE-522 | Weak Cookie/Session Settings |
| CWE-346 | CORS Origin Validation Error |
| CWE-338 | Insecure Randomness |
| CWE-345 | Wildcard postMessage |
