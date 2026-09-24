"""Run the real AI module integration tests; optionally point at a separate AI checkout."""

import argparse
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument("--ai-root", type=Path, help="Path containing the AI checkout's backend/app")
args = parser.parse_args()
env = os.environ.copy()
if args.ai_root:
    env["AKIM_AI_REFERENCE"] = str(args.ai_root.resolve())
else:
    if not (ROOT / "backend/app/ai/schemas.py").exists():
        raise SystemExit("AI module is not merged. Pass --ai-root /path/to/checkout/backend/app.")
raise SystemExit(
    subprocess.call(
        [sys.executable, "-m", "pytest", "-q", "tests/test_ai_bridge.py", "tests/test_advice.py"],
        cwd=ROOT / "backend",
        env=env,
    )
)
