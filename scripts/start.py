"""Install pinned dependencies and run both local services; no third-party launcher deps."""

import argparse
import os
import shutil
import socket
import subprocess
import sys
import time
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
FRONT = ROOT / "frontend"


def run(command, *, cwd=ROOT, env=None):
    subprocess.run(command, cwd=cwd, env=env, check=True)


def check_port(port):
    with socket.socket() as probe:
        try:
            probe.bind(("127.0.0.1", port))
        except OSError as exc:
            raise RuntimeError(
                f"Port {port} is busy. Use --api-port / --web-port."
            ) from exc


def stop(process):
    if process.poll() is not None:
        return
    if os.name == "nt":
        # Stop only the process tree started by this launcher.
        subprocess.run(
            ["taskkill", "/PID", str(process.pid), "/T", "/F"],
            capture_output=True,
            check=False,
        )
    else:
        import signal

        os.killpg(process.pid, signal.SIGTERM)
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        process.kill()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--production",
        action="store_true",
        help="Build and run Next.js production mode",
    )
    parser.add_argument(
        "--install", action="store_true", help="Reinstall dependencies from lock files"
    )
    parser.add_argument("--api-port", type=int, default=8000)
    parser.add_argument("--web-port", type=int, default=3000)
    args = parser.parse_args()
    if sys.version_info < (3, 12):
        raise RuntimeError("Python 3.12 or newer is required.")
    node = shutil.which("node")
    npm = shutil.which("npm.cmd" if os.name == "nt" else "npm")
    if not node or not npm:
        raise RuntimeError(
            "Install Node.js 22.20+ with npm, then reopen your terminal."
        )
    version = (
        subprocess.check_output([node, "--version"], text=True).strip().lstrip("v")
    )
    if tuple(map(int, version.split(".")[:2])) < (22, 20):
        raise RuntimeError("Node.js 22.20+ is required.")
    if args.api_port == args.web_port or not all(
        1 <= p <= 65535 for p in (args.api_port, args.web_port)
    ):
        raise RuntimeError("Choose two different ports between 1 and 65535.")
    check_port(args.api_port)
    check_port(args.web_port)
    python = (
        ROOT / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    )
    stamp = ROOT / ".venv" / ".akim-dependencies-installed"
    if not python.exists():
        run([sys.executable, "-m", "venv", str(ROOT / ".venv")])
    if args.install or not stamp.exists():
        run([str(python), "-m", "pip", "install", "-r", "backend/requirements-ai.txt"])
        stamp.write_text(
            "Installed runtime dependencies. Use --install after updating requirements.\n"
        )
    if args.install or not (FRONT / "node_modules" / "next").exists():
        run([npm, "ci", "--no-audit", "--no-fund"], cwd=FRONT)
    for example, target in (
        (ROOT / "backend/.env.example", ROOT / "backend/.env"),
        (FRONT / ".env.example", FRONT / ".env.local"),
    ):
        if not target.exists():
            shutil.copyfile(example, target)
    env = os.environ.copy()
    env.update(
        {
            "NEXT_PUBLIC_API_MODE": "live",
            "NEXT_PUBLIC_API_BASE_URL": f"http://127.0.0.1:{args.api_port}",
            "NEXT_PUBLIC_ENABLE_RECOMMENDATIONS": "true",
            "NEXT_PUBLIC_ENABLE_AI_COMPARISON": "true",
            "NEXT_TELEMETRY_DISABLED": "1",
            "CORS_ORIGINS": f"http://127.0.0.1:{args.web_port},http://localhost:{args.web_port}",
        }
    )
    if args.production:
        run([npm, "run", "build"], cwd=FRONT, env=env)
    children = []
    options = (
        {"creationflags": subprocess.CREATE_NEW_PROCESS_GROUP}
        if os.name == "nt"
        else {"start_new_session": True}
    )
    try:
        backend = subprocess.Popen(
            [
                str(python),
                "-m",
                "uvicorn",
                "app.main:app",
                "--app-dir",
                "backend",
                "--host",
                "127.0.0.1",
                "--port",
                str(args.api_port),
            ],
            cwd=ROOT,
            env=env,
            **options,
        )
        children.append(backend)
        for _ in range(120):
            if backend.poll() is not None:
                raise RuntimeError("Backend stopped. See the error above.")
            try:
                with urlopen(f"http://127.0.0.1:{args.api_port}/api/health", timeout=1):
                    break
            except OSError:
                time.sleep(0.5)
        else:
            raise RuntimeError("Backend did not become ready within 60 seconds.")
        children.append(
            subprocess.Popen(
                [
                    node,
                    "node_modules/next/dist/bin/next",
                    "start" if args.production else "dev",
                    "--hostname",
                    "127.0.0.1",
                    "--port",
                    str(args.web_port),
                ],
                cwd=FRONT,
                env=env,
                **options,
            )
        )
        print(f"\nAKIM AI: http://127.0.0.1:{args.web_port}", flush=True)
        print(
            f"API docs: http://127.0.0.1:{args.api_port}/docs\nCtrl+C stops both services.\n",
            flush=True,
        )
        while all(child.poll() is None for child in children):
            time.sleep(0.5)
        raise RuntimeError("A service stopped unexpectedly. See the error above.")
    except KeyboardInterrupt:
        print("\nStopping AKIM AI...")
    finally:
        for child in reversed(children):
            stop(child)


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, subprocess.CalledProcessError) as error:
        print(f"\nStartup failed: {error}", file=sys.stderr)
        sys.exit(1)
