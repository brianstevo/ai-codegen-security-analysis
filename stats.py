"""
Security of AI-Generated Web Code — Statistics Summary
Reads all findings.json files and prints a full breakdown of results.
Run: python3 stats.py  (from the ai-codegen-security-analysis directory)
"""

import json
import glob
import collections

# Load all findings
all_findings = []
for path in sorted(glob.glob("*/findings.json")):
    with open(path) as f:
        all_findings.extend(json.load(f))

N = len(all_findings)

# Friendly display names
MODEL_NAMES = {
    "gemma4_31b":       "Gemma4 31B",
    "devstral_small_2": "Devstral-Small-2 24B",
    "glm_4_7_flash":    "GLM-4.7-Flash 30B",
    "qwen_coder":       "Qwen2.5-Coder 7B",
    "qwen3_coder_next": "Qwen3-Coder-Next 80B",
    "qwen3_6_27b":      "Qwen3.6 27B",
    "gpt_oss_120b":     "GPT-OSS 120B",
    "gpt_5_5":          "GPT-5.5",
    "gpt_5_4_mini":     "GPT-5.4-Mini",
    "gpt_5_3_codex":    "GPT-5.3-Codex",
    "claude_opus":      "Claude Opus 4.8",
    "claude_sonnet":    "Claude Sonnet 4.6",
    "claude_haiku":     "Claude Haiku 4.5",
}

def sep(title=""):
    if title:
        print(f"\n{title}")
    else:
        print()

# 1. Overall
sep("OVERALL")
sev = collections.Counter(d["severity"] for d in all_findings)
print(f"  Total findings : {N}")
print(f"  Warning        : {sev['warning']}  ({sev['warning']/N*100:.1f}%)")
print(f"  Error          : {sev['error']}   ({sev['error']/N*100:.1f}%)")

# 2. By CWE
sep("BY CWE")
cwe_counter = collections.Counter(d["cwe_id"] for d in all_findings)
CWE_DESC = {
    "CWE-798": "Hardcoded Credentials",
    "CWE-79":  "Cross-Site Scripting (XSS)",
    "CWE-22":  "Path Traversal",
    "CWE-918": "Server-Side Request Forgery",
    "CWE-78":  "OS Command Injection",
    "CWE-287": "Improper Authentication",
    "CWE-89":  "SQL Injection",
}
print(f"  {'CWE':<10} {'Description':<35} {'Count':>5}  {'%':>6}")
print(f"  {'-'*10} {'-'*35} {'-'*5}  {'-'*6}")
for cwe, count in cwe_counter.most_common():
    desc = CWE_DESC.get(cwe, "")
    print(f"  {cwe:<10} {desc:<35} {count:>5}  {count/N*100:>5.1f}%")

top3 = sum(v for k, v in cwe_counter.most_common(3))
print(f"\n  Top-3 CWEs account for {top3}/{N} = {top3/N*100:.1f}% of all findings")

# 3. By Model
sep("BY MODEL  (sorted by total, descending)")
model_n  = collections.Counter(d["model"] for d in all_findings if d["tier"] == "naive")
model_sa = collections.Counter(d["model"] for d in all_findings if d["tier"] == "security_aware")
model_t  = collections.Counter(d["model"] for d in all_findings)

print(f"  {'Model':<28} {'Naive':>6} {'SA':>6} {'Total':>7}")
print(f"  {'-'*28} {'-'*6} {'-'*6} {'-'*7}")
for model_key in sorted(model_t, key=lambda x: -model_t[x]):
    name = MODEL_NAMES.get(model_key, model_key)
    print(f"  {name:<28} {model_n[model_key]:>6} {model_sa[model_key]:>6} {model_t[model_key]:>7}")
print(f"  {'TOTAL':<28} {sum(model_n.values()):>6} {sum(model_sa.values()):>6} {N:>7}")

# Group totals
claude_models = ["claude_sonnet", "claude_opus", "claude_haiku"]
gpt_models    = ["gpt_5_5", "gpt_5_4_mini", "gpt_5_3_codex"]
local_models  = [k for k in model_t if k not in claude_models + gpt_models]

prop  = sum(model_t[m] for m in claude_models + gpt_models)
local = sum(model_t[m] for m in local_models)
print(f"\n  Proprietary (Claude + GPT-5.x) : {prop}  ({prop/N*100:.1f}%)")
print(f"  Local open-weight (7 models)   : {local}  ({local/N*100:.1f}%)")

# 4. By Language
sep("BY LANGUAGE")
lang_t  = collections.Counter(d["language"] for d in all_findings)
lang_n  = collections.Counter(d["language"] for d in all_findings if d["tier"] == "naive")
lang_sa = collections.Counter(d["language"] for d in all_findings if d["tier"] == "security_aware")
lang_sev = collections.defaultdict(lambda: collections.Counter())
for d in all_findings:
    lang_sev[d["language"]][d["severity"]] += 1

for lang in ["javascript", "python"]:
    total = lang_t[lang]
    print(f"\n  {lang.upper()}  (total {total}, {total/N*100:.1f}%)")
    print(f"    Naive: {lang_n[lang]}  |  Security-aware: {lang_sa[lang]}")
    for sev_label in ["warning", "error"]:
        c = lang_sev[lang][sev_label]
        print(f"    {sev_label.capitalize():<10}: {c}  ({c/total*100:.1f}%)")
    # CWE breakdown per language
    lc = collections.Counter(
        d["cwe_id"] for d in all_findings if d["language"] == lang
    )
    print(f"    CWE breakdown:")
    for cwe, count in lc.most_common():
        print(f"      {cwe:<10} {CWE_DESC.get(cwe,''):<35} {count}")

# 5. By Tier
sep("BY TIER")
tier_t = collections.Counter(d["tier"] for d in all_findings)
naive  = tier_t["naive"]
sa     = tier_t["security_aware"]
reduction = (naive - sa) / naive * 100
print(f"  Naive          : {naive}")
print(f"  Security-aware : {sa}")
print(f"  Reduction      : {naive - sa} findings  ({reduction:.1f}%)")

# Per-model tier breakdown showing counterintuitive increases
sep("TIER EFFECT PER MODEL")
print(f"  {'Model':<28} {'Naive':>6} {'SA':>6} {'Change':>8}")
print(f"  {'-'*28} {'-'*6} {'-'*6} {'-'*8}")
for model_key in sorted(model_t, key=lambda x: -model_t[x]):
    name = MODEL_NAMES.get(model_key, model_key)
    n  = model_n[model_key]
    s  = model_sa[model_key]
    delta = s - n
    arrow = f"+{delta}" if delta > 0 else str(delta)
    print(f"  {name:<28} {n:>6} {s:>6} {arrow:>8}")

# 6. Provider comparison
sep("PROVIDER COMPARISON")
providers = {
    "Anthropic (Claude)": claude_models,
    "OpenAI (GPT-5.x)":   gpt_models,
    "Open-weight (local)": local_models,
}
for prov, models in providers.items():
    total = sum(model_t[m] for m in models)
    print(f"  {prov:<25} {total:>3} findings  ({total/N*100:.1f}%)")

sep()
print(f"  All statistics computed from {N} deduplicated Semgrep findings")
print(f"  across 13 models and 51 prompts (naive + security-aware tiers).\n")
