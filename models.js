/**
 * models.js — Model registry for the LLM security pipeline.
 *
 * To add a model, add an entry to the MODELS object below.
 * The key becomes the --model flag value and the output subfolder name.
 *
 * Supported providers: ollama | openai | anthropic
 */

export const MODELS = {
  // ── Anthropic ──────────────────────────────────────────────────────────
  claude_opus: {
    provider: 'anthropic',
    model:    'claude-opus-4-8',
    api_key:  process.env.ANTHROPIC_API_KEY,
  },
  claude_sonnet: {
    provider: 'anthropic',
    model:    'claude-sonnet-4-6',
    api_key:  process.env.ANTHROPIC_API_KEY,
  },
  claude_haiku: {
    provider: 'anthropic',
    model:    'claude-haiku-4-5-20251001',
    api_key:  process.env.ANTHROPIC_API_KEY,
  },

  // ── OpenAI ─────────────────────────────────────────────────────────────
  gpt_5_5: {
    provider: 'openai',
    model:    'gpt-5.5',
    base_url: 'https://api.openai.com',
    api_key:  process.env.OPENAI_API_KEY,
  },
  gpt_5_4_mini: {
    provider: 'openai',
    model:    'gpt-5.4-mini',
    base_url: 'https://api.openai.com',
    api_key:  process.env.OPENAI_API_KEY,
  },
  gpt_5_3_codex: {
    provider:      'openai',
    model:         'gpt-5.3-codex',
    base_url:      'https://api.openai.com',
    api_key:       process.env.OPENAI_API_KEY,
    responses_api: true,
  },

  // ── Local (Ollama) ─────────────────────────────────────────────────────
  qwen_coder: {
    provider: 'ollama',
    model:    'qwen2.5-coder:7b',
    base_url: 'http://localhost:11434',
  },
  qwen3_coder_next: {
    provider: 'ollama',
    model:    'qwen3-coder-next',
    base_url: 'http://localhost:11434',
  },
  qwen3_6_27b: {
    provider: 'ollama',
    model:    'qwen3.6:27b',
    base_url: 'http://localhost:11434',
    think:    false,
  },
  gemma4_31b: {
    provider: 'ollama',
    model:    'gemma4:31b',
    base_url: 'http://localhost:11434',
  },
  gpt_oss_120b: {
    provider: 'ollama',
    model:    'gpt-oss:120b',
    base_url: 'http://localhost:11434',
  },
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
};
