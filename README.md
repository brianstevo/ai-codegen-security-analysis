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

| Key | Model | Provider |
|---|---|---|
| `qwen_coder` | qwen2.5-coder:7b | Local Ollama (free) |
| `gemini_flash` | gemini-2.5-flash | Google AI Studio (free tier) |
| `claude_opus` | claude-opus-4-6 | Anthropic API |

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
node analyze.js
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
