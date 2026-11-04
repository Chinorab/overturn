"""Tests the AutoScientist reader on a Hugging Face GPU job, from this machine.

    pnpm eval:hf-prompts                              # writes eval/autoscientist/job-input/prompts.jsonl
    python scripts/eval/hf_eval_launch.py run --yes   # uploads, starts the job (spends HF credits)
    python scripts/eval/hf_eval_launch.py wait        # follows it, then downloads generations.jsonl
    pnpm eval:score-generations                       # scores them

Uses the `hf` login already on this machine (`hf auth login`); no token goes through this script.
Hardware is an L40S (48 GB, $1.80/h, billed per second) with a hard 45-minute timeout, so one
run can never cost more than about $1.35. The job id is kept in eval/autoscientist/state.json.
"""

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / "eval" / "autoscientist"
STATE = WORK / "state.json"
FLAVOR, TIMEOUT, PRICE_PER_HOUR = "l40sx1", "45m", 1.80


def state() -> dict:
    return json.loads(STATE.read_text(encoding="utf-8")) if STATE.exists() else {}


def save(**kv) -> None:
    STATE.write_text(json.dumps({**state(), **kv}, indent=2) + "\n", encoding="utf-8")


def run(args):
    from huggingface_hub import run_uv_job, sync_job_volume

    prompts = WORK / "job-input" / "prompts.jsonl"
    adapter = WORK / "adapter" / "adapter_model.safetensors"
    if not prompts.exists():
        sys.exit("no prompts yet: run pnpm eval:hf-prompts")
    if not adapter.exists():
        sys.exit("no adapter yet: python scripts/eval/autoscientist.py download, then extract it into eval/autoscientist/adapter")
    if not args.yes:
        cap = PRICE_PER_HOUR * 0.75
        sys.exit(f"This starts a job on {FLAVOR} (${PRICE_PER_HOUR}/h, {TIMEOUT} timeout: at most ${cap:.2f}). Re-run with --yes.")

    (WORK / "job-output").mkdir(exist_ok=True)
    stale = WORK / "job-output" / "generations.jsonl"
    stale.unlink(missing_ok=True)
    print("syncing inputs to your private jobs-artifacts bucket...", flush=True)
    volumes = [
        sync_job_volume(WORK / "job-input", "/input"),
        sync_job_volume(WORK / "adapter", "/adapter"),
        sync_job_volume(WORK / "job-output", "/output", read_only=False),
    ]
    out = volumes[2]
    job = run_uv_job(
        str(ROOT / "scripts" / "eval" / "hf_eval_job.py"),
        flavor=FLAVOR,
        timeout=TIMEOUT,
        name="overturn-reader-eval",
        volumes=volumes,
    )
    save(hf_job_id=job.id, hf_output=f"hf://buckets/{out.source}/{out.path}".rstrip("/"))
    print(f"job {job.id} started: {job.url}")


def wait(_):
    from huggingface_hub import fetch_job_logs, sync_bucket, wait_for_job

    s = state()
    job_id = s.get("hf_job_id")
    if not job_id:
        sys.exit("no job yet: run `run --yes` first")
    info = wait_for_job(job_id, poll_interval=20)
    print(f"job {job_id}: {info.status.stage} {info.status.message or ''}".strip())
    for line in list(fetch_job_logs(job_id=job_id, tail=25)):
        print("  |", line)
    sync_bucket(s["hf_output"], str(WORK / "job-output"), quiet=True)
    gen = WORK / "job-output" / "generations.jsonl"
    print(f"{gen.relative_to(ROOT)}: {sum(1 for _ in gen.open(encoding='utf-8')) if gen.exists() else 0} generations")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("run")
    r.add_argument("--yes", action="store_true", help="confirm that this spends Hugging Face credits")
    r.set_defaults(fn=run)
    sub.add_parser("wait").set_defaults(fn=wait)
    args = p.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
