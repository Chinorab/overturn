"""Trains a document reader on the AutoScientist training set (Adaption Labs).

The web app only starts AutoScientist from a dataset that went through Adaptive Data, which
would rewrite the expected answers. The SDK's raw mode uploads prompt/completion pairs as they
are, so this script drives the SDK instead.

    python -m pip install adaption              # once
    pnpm eval:train-set                         # builds eval/autoscientist/train.jsonl
    python scripts/eval/autoscientist.py models # base models, with their context length
    python scripts/eval/autoscientist.py upload
    python scripts/eval/autoscientist.py train --model <id> --yes   # spends Adaption credits
    python scripts/eval/autoscientist.py status
    python scripts/eval/autoscientist.py download

The key is ADAPTION_API_KEY, read from the environment or from .env.local (Adaption app >
Settings > API keys). It is never printed. Dataset and run ids are kept in
eval/autoscientist/state.json so each step picks up where the last one stopped.
"""

import argparse
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "eval" / "autoscientist"
STATE = OUT / "state.json"


def load_key() -> None:
    if os.environ.get("ADAPTION_API_KEY"):
        return
    env = ROOT / ".env.local"
    if env.exists():
        for line in env.read_text(encoding="utf-8").splitlines():
            if line.startswith("ADAPTION_API_KEY="):
                os.environ["ADAPTION_API_KEY"] = line.split("=", 1)[1].strip().strip('"')
                return
    sys.exit("ADAPTION_API_KEY is not set: add it to .env.local (Adaption app > Settings > API keys)")


def client():
    try:
        from adaption import Adaption
    except ImportError:
        sys.exit("the Adaption SDK is missing: python -m pip install adaption")
    load_key()
    return Adaption()


def state() -> dict:
    return json.loads(STATE.read_text(encoding="utf-8")) if STATE.exists() else {}


def save(**kv) -> None:
    STATE.write_text(json.dumps({**state(), **kv}, indent=2) + "\n", encoding="utf-8")


def models(_):
    for m in client().autoscientist.list_models().models:
        size = m.api_model_size or "?"
        ctx = f"{int(m.context_length):,} tokens" if m.context_length else "context ?"
        print(f"{m.id:<48} {size:>7}  {ctx:<16} {', '.join(m.methods)}  ({m.display_name})")
    print("\nOur rows are about 1,300 to 1,500 tokens: pick a model whose context covers that.")


def upload(args):
    data = Path(args.file)
    if not data.exists():
        sys.exit(f"{data} not found: run pnpm eval:train-set first")
    c = client()
    res = c.datasets.upload_file(
        data,
        name="overturn-extraction-train",
        processing_mode="raw",
        column_mapping={"prompt": "prompt", "completion": "completion"},
    )
    print(f"uploaded {data.name} as dataset {res.dataset_id}; waiting for processing...")
    status = c.datasets.wait_for_completion(res.dataset_id)
    save(dataset_id=res.dataset_id)
    print(f"dataset {res.dataset_id}: {getattr(status, 'status', status)}")


def train(args):
    ds = state().get("dataset_id")
    if not ds:
        sys.exit("no dataset yet: run upload first")
    if not args.yes:
        sys.exit(
            f"This launches AutoScientist on dataset {ds} with model {args.model}, "
            f"up to {args.iterations} iteration(s), and spends Adaption credits. Re-run with --yes."
        )
    run = client().autoscientist.create(
        dataset_id=ds,
        model=args.model,
        training_method="instruction",
        max_iterations=args.iterations,
        target_win_rate=args.target,
    )
    save(run_id=run.id, model=args.model)
    print(f"run {run.id} started ({run.status}). Check it with: python scripts/eval/autoscientist.py status")


def status(_):
    run_id = state().get("run_id")
    if not run_id:
        sys.exit("no run yet: run train first")
    run = client().autoscientist.get(run_id)
    fields = ["status", "model", "iterations_completed", "max_iterations", "best_win_rate", "download_available", "error"]
    for f in fields:
        if getattr(run, f, None) is not None:
            print(f"{f}: {getattr(run, f)}")


def download(_):
    run_id = state().get("run_id")
    if not run_id:
        sys.exit("no run yet: run train first")
    target = OUT / "best-checkpoint.tgz"
    with client().autoscientist.with_streaming_response.download(run_id) as res:
        res.stream_to_file(target)
    print(f"saved {target.relative_to(ROOT)}: extract with tar xf, then load the LoRA adapter on its base model")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("models").set_defaults(fn=models)
    u = sub.add_parser("upload")
    u.add_argument("--file", default=str(OUT / "train.jsonl"))
    u.set_defaults(fn=upload)
    t = sub.add_parser("train")
    t.add_argument("--model", required=True, help="an id from the models command")
    t.add_argument("--iterations", type=int, default=2, help="1 to 5; each one trains and evaluates a model")
    t.add_argument("--target", type=float, default=0.8, help="stop early at this win rate over the base model")
    t.add_argument("--yes", action="store_true", help="confirm that this spends credits")
    t.set_defaults(fn=train)
    sub.add_parser("status").set_defaults(fn=status)
    sub.add_parser("download").set_defaults(fn=download)
    args = p.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    args.fn(args)


if __name__ == "__main__":
    main()
