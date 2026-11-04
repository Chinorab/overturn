# /// script
# requires-python = ">=3.10"
# dependencies = ["vllm", "peft", "transformers", "accelerate"]
# ///
"""Runs on a Hugging Face GPU job: the AutoScientist reader, and its base model, on the eval prompts.

Inputs (mounted by scripts/eval/hf_eval_launch.py):
    /input/prompts.jsonl   {id, set, prompt} from `pnpm eval:hf-prompts`
    /adapter/              the LoRA checkpoint downloaded from Adaption
Output:
    /output/generations.jsonl   {id, set, mode, text, seconds}

Modes, because the checkpoint does not say how AutoScientist laid out prompt and completion:
    tuned-chat   the model's chat template, thinking off
    tuned-raw    the prompt text alone, as a plain continuation
    base-chat    the untrained base model, chat template, thinking off (the yardstick)
Greedy decoding throughout, so the run is reproducible.
"""

import json
import os
import sys
import time
import traceback
from pathlib import Path

BASE = os.environ.get("BASE_MODEL", "Qwen/Qwen3.5-9B")
MAX_TOKENS = 2048
out = Path("/output/generations.jsonl")
rows = [json.loads(line) for line in Path("/input/prompts.jsonl").read_text(encoding="utf-8").splitlines() if line.strip()]
if __name__ == "__main__":
    out.parent.mkdir(parents=True, exist_ok=True)
    print(f"{len(rows)} prompts · base {BASE} · accelerator {os.environ.get('ACCELERATOR')}", flush=True)


def save(results):
    with out.open("a", encoding="utf-8") as f:
        for r in results:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")


def with_vllm():
    from transformers import AutoTokenizer
    from vllm import LLM, SamplingParams
    from vllm.lora.request import LoRARequest

    tok = AutoTokenizer.from_pretrained("/adapter")
    chat = [
        tok.apply_chat_template([{"role": "user", "content": r["prompt"]}], tokenize=False, add_generation_prompt=True, enable_thinking=False)
        for r in rows
    ]
    llm = LLM(
        model=BASE,
        enable_lora=True,
        max_lora_rank=16,
        max_model_len=6144,
        gpu_memory_utilization=0.9,
        limit_mm_per_prompt={"image": 0, "video": 0},
        enforce_eager=True,
    )
    params = SamplingParams(temperature=0, max_tokens=MAX_TOKENS)
    lora = LoRARequest("overturn-reader", 1, "/adapter")
    for mode, prompts, req in [
        ("tuned-chat", chat, lora),
        ("tuned-raw", [r["prompt"] for r in rows], lora),
        ("base-chat", chat, None),
    ]:
        t0 = time.time()
        outs = llm.generate(prompts, params, lora_request=req)
        dt = time.time() - t0
        save([{"id": r["id"], "set": r["set"], "mode": mode, "text": o.outputs[0].text, "seconds": dt / len(rows)} for r, o in zip(rows, outs)])
        print(f"{mode}: {len(outs)} generations in {dt:.0f}s", flush=True)


def with_transformers():
    """Slower fallback: plain PEFT + generate, tuned-chat only."""
    import torch
    from peft import PeftModel
    from transformers import AutoModelForImageTextToText, AutoTokenizer

    tok = AutoTokenizer.from_pretrained("/adapter")
    tok.padding_side = "left"
    model = AutoModelForImageTextToText.from_pretrained(BASE, torch_dtype=torch.bfloat16, device_map="cuda")
    model = PeftModel.from_pretrained(model, "/adapter").eval()
    chat = [
        tok.apply_chat_template([{"role": "user", "content": r["prompt"]}], tokenize=False, add_generation_prompt=True, enable_thinking=False)
        for r in rows
    ]
    batch = 8
    for i in range(0, len(rows), batch):
        t0 = time.time()
        enc = tok(chat[i : i + batch], return_tensors="pt", padding=True).to("cuda")
        with torch.no_grad():
            gen = model.generate(**enc, max_new_tokens=MAX_TOKENS, do_sample=False)
        texts = tok.batch_decode(gen[:, enc["input_ids"].shape[1] :], skip_special_tokens=True)
        dt = time.time() - t0
        save([{"id": r["id"], "set": r["set"], "mode": "tuned-chat", "text": t, "seconds": dt / len(texts)} for r, t in zip(rows[i : i + batch], texts)])
        print(f"tuned-chat (transformers): {i + len(texts)}/{len(rows)}", flush=True)


# vLLM starts its engine with `spawn`, which re-imports this file: everything that runs must sit
# under the main guard, or the child process tries to start a second engine and the run fails.
if __name__ == "__main__":
    try:
        with_vllm()
    except Exception:
        traceback.print_exc()
        print("vLLM failed; falling back to transformers + PEFT", flush=True)
        out.unlink(missing_ok=True)
        with_transformers()

    print(f"done: {sum(1 for _ in out.open(encoding='utf-8'))} generations in {out}", flush=True)
    sys.exit(0)
