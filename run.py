import os
import sys
import time
import socket
import subprocess
import threading
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FRONTEND_DIR = ROOT / "frontend"

# Ensure PATH has Python and Node
extra_paths = [
    r"D:\swb\shell\bin",
    r"D:\swb\shell\lib\Python3.13",
    r"D:\swb\shell\lib\Python3.13\DLLs",
    r"D:\\",
]
existing_path = os.environ.get("PATH", "")
os.environ["PATH"] = ";".join(extra_paths) + ";" + existing_path
os.environ["PYTHONPATH"] = str(ROOT)

def is_port_in_use(port: int) -> bool:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(0.5)
            return s.connect_ex(('127.0.0.1', port)) == 0
    except Exception:
        return False

def stream_output(pipe, prefix, color_code):
    try:
        for line in iter(pipe.readline, ''):
            if line:
                print(f"\033[{color_code}m[{prefix}]\033[0m {line}", end="", flush=True)
    except Exception:
        pass

def main():
    print("=" * 68)
    print("  Tarang Expense Intelligence — Unified Runner")
    print("=" * 68)

    # 1. Resolve Python executable
    python_candidates = [
        r"D:\swb\shell\lib\Python3.13\python.exe",
        sys.executable,
        "python"
    ]
    python_exe = sys.executable
    for p in python_candidates:
        if os.path.exists(p):
            python_exe = p
            break

    # 2. Resolve npm executable (use .cmd to avoid PowerShell .ps1 execution policy restrictions)
    npm_cmd = "npm.cmd"
    for candidate in [r"D:\npm.cmd", "npm.cmd", "npm"]:
        if os.path.exists(candidate):
            npm_cmd = candidate
            break

    backend_proc = None
    frontend_proc = None

    # Check and start FastAPI Backend on port 8000
    if is_port_in_use(8000):
        print("[1/2] Backend is ALREADY ACTIVE on http://127.0.0.1:8000")
    else:
        print("[1/2] Starting FastAPI Backend on http://127.0.0.1:8000 ...")
        backend_cmd = [
            python_exe, "-m", "uvicorn", "backend.app.main:app",
            "--host", "127.0.0.1", "--port", "8000"
        ]
        backend_proc = subprocess.Popen(
            backend_cmd,
            cwd=str(ROOT),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            shell=(os.name == "nt")
        )
        t_backend = threading.Thread(target=stream_output, args=(backend_proc.stdout, "BACKEND", "36"), daemon=True)
        t_backend.start()

    # Check and start React Frontend on port 5173
    if is_port_in_use(5173):
        print("[2/2] Frontend is ALREADY ACTIVE on http://localhost:5173")
    else:
        print("[2/2] Starting React Frontend on http://localhost:5173 ...")
        frontend_cmd = [
            npm_cmd, "run", "dev", "--", "--host", "127.0.0.1", "--port", "5173"
        ]
        frontend_proc = subprocess.Popen(
            frontend_cmd,
            cwd=str(FRONTEND_DIR),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            shell=(os.name == "nt")
        )
        t_frontend = threading.Thread(target=stream_output, args=(frontend_proc.stdout, "FRONTEND", "32"), daemon=True)
        t_frontend.start()

    time.sleep(2)
    print("\n" + "=" * 68)
    print("  STATUS: Both Services are LIVE & READY!")
    print("  • Web App (Frontend):  http://localhost:5173")
    print("  • REST API (Backend):  http://127.0.0.1:8000")
    print("  • Swagger API Docs:    http://127.0.0.1:8000/docs")
    print("  • Health Check:        http://127.0.0.1:8000/api/health")
    print("  Press Ctrl+C to stop servers.")
    print("=" * 68 + "\n")

    try:
        webbrowser.open("http://localhost:5173")
    except Exception:
        pass

    try:
        while True:
            time.sleep(1)
            if backend_proc and backend_proc.poll() is not None:
                print("\n[BACKEND] Process exited.")
                break
            if frontend_proc and frontend_proc.poll() is not None:
                print("\n[FRONTEND] Process exited.")
                break
    except KeyboardInterrupt:
        print("\nStopping servers...")
    finally:
        if backend_proc:
            try:
                backend_proc.terminate()
            except Exception:
                pass
        if frontend_proc:
            try:
                frontend_proc.terminate()
            except Exception:
                pass
        print("Done.")

if __name__ == "__main__":
    main()
