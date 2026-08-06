#!/bin/bash
# run_anthropic_models.sh — Run the pipeline for all configured Anthropic models in sequence.
#
# Usage:
#   bash run_anthropic_models.sh           # foreground (output shown + saved to log)
#   bash run_anthropic_models.sh --detach  # background, safe to close SSH session
#
# Requires: ANTHROPIC_API_KEY set in environment
# Progress log: run_anthropic_models.log (in the same directory)

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

LOG="$SCRIPT_DIR/run_anthropic_models.log"

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
if [[ -z "${ANTHROPIC_API_KEY:-}" ]]; then
  log "ERROR: ANTHROPIC_API_KEY is not set — aborting"
  log "Export it first:  export ANTHROPIC_API_KEY=sk-ant-..."
  exit 1
fi
log "ANTHROPIC_API_KEY is set"

run_model() {
  local key=$1
  log "=== $key ==="
  node pipeline.js --model "$key" && log "$key done" || log "ERROR: $key pipeline failed"
}

log "====== Anthropic model run started ======"

# --- Anthropic models ---
# To add a new model: add a run_model line here using the key from pipeline.js MODELS config.
run_model claude_opus
run_model claude_sonnet
run_model claude_haiku

log "====== All Anthropic models finished ======"
