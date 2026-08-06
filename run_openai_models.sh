#!/bin/bash
# run_openai_models.sh — Run the pipeline for all configured OpenAI models in sequence.
#
# Usage:
#   bash run_openai_models.sh           # foreground (output shown + saved to log)
#   bash run_openai_models.sh --detach  # background, safe to close SSH session
#
# Requires: OPENAI_API_KEY set in environment
# Progress log: run_openai_models.log (in the same directory)

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

LOG="$SCRIPT_DIR/run_openai_models.log"

# Self-daemonize when --detach is passed
if [[ "${1:-}" == "--detach" ]]; then
  nohup bash "$0" > "$LOG" 2>&1 &
  echo "Running in background (pid $!). Follow progress with:"
  echo "  tail -f $LOG"
  exit 0
fi

exec > >(tee -a "$LOG") 2>&1

log() { echo "[$(date '+%H:%M:%S')] $*"; }

# Check API key
if [[ -z "${OPENAI_API_KEY:-}" ]]; then
  log "ERROR: OPENAI_API_KEY is not set — aborting"
  log "Export it first:  export OPENAI_API_KEY=sk-..."
  exit 1
fi
log "OPENAI_API_KEY is set"

run_model() {
  local key=$1
  log "=== $key ==="
  node pipeline.js --model "$key" && log "$key done" || log "ERROR: $key pipeline failed"
}

log "====== OpenAI model run started ======"

# --- OpenAI models ---
# To add a new model: add a run_model line here using the key from pipeline.js MODELS config.
run_model gpt_5_5
run_model gpt_5_4_mini
run_model gpt_5_3_codex

log "====== All OpenAI models finished ======"
