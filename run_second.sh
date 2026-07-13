#!/bin/bash
# run_second.sh — Automated second run across all models
# Usage: bash run_second.sh
# Logs everything to run_second.log in the same directory.
# Safe to disconnect — run with: nohup bash run_second.sh &

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

LOG="$SCRIPT_DIR/run_second.log"
exec > >(tee -a "$LOG") 2>&1

log() { echo "[$(date '+%H:%M:%S')] $*"; }

setup_ollama() {
  # Install ollama if missing
  if ! command -v ollama &>/dev/null; then
    log "Ollama not found — installing..."
    curl -fsSL https://ollama.com/install.sh | sh
    if ! command -v ollama &>/dev/null; then
      log "ERROR: ollama install failed — aborting"
      exit 1
    fi
    log "Ollama installed"
  else
    log "Ollama already installed: $(ollama --version)"
  fi

  # Start ollama serve if not already running
  if ! pgrep -x ollama &>/dev/null; then
    log "Starting ollama serve..."
    ollama serve >> "$SCRIPT_DIR/ollama_serve.log" 2>&1 &
    OLLAMA_PID=$!
    sleep 5
    if ! pgrep -x ollama &>/dev/null; then
      log "ERROR: ollama serve failed to start — aborting"
      exit 1
    fi
    log "Ollama serve started (pid $OLLAMA_PID)"
  else
    log "Ollama serve already running"
  fi
}

run_ollama_model() {
  local key=$1
  local model=$2
  log "=== $key — pulling $model ==="
  ollama pull "$model" || {
    log "WARN: pull failed for $model — retrying once..."
    sleep 5
    ollama pull "$model" || { log "ERROR: pull failed again for $model, skipping"; return; }
  }
  log "$key — running pipeline"
  node pipeline.js --model "$key" && log "$key done" || log "ERROR: $key pipeline failed"
  log "$key — deleting $model"
  ollama rm "$model" && log "$model deleted" || log "WARN: could not delete $model"
}

log "====== Second run started (open-weight models only) ======"
setup_ollama

# --- Ollama models (pull → run → delete) ---
run_ollama_model qwen_coder        "qwen2.5-coder:7b"
run_ollama_model qwen3_coder_next  "qwen3-coder-next"
run_ollama_model qwen3_6_27b       "qwen3.6:27b"
run_ollama_model gemma4_31b        "gemma4:31b"
run_ollama_model gpt_oss_120b      "gpt-oss:120b"
run_ollama_model glm_4_7_flash     "glm-4.7-flash"
run_ollama_model devstral_small_2  "devstral-small-2"

log "====== All models finished ======"
