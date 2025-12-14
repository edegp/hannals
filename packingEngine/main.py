import subprocess
import time
import sys
import signal
import threading
import re
import json
import urllib.request

UVICORN_CMD = [
    "uvicorn",
    "server_request:app",
    "--host", "0.0.0.0",
    "--port", "8000",
]

NGROK_CMD = [
    "ngrok",
    "http",
    "8000",
]

def stream_output(prefix, proc):
    """
    subprocess の stdout をリアルタイム表示
    """
    for line in iter(proc.stdout.readline, ""):
        if not line:
            break
        print(f"[{prefix}] {line.rstrip()}")

def get_ngrok_public_url(timeout=10):
    """
    ngrok の public URL (https) を取得
    起動直後はまだ取れないことがあるのでリトライする
    """
    start = time.time()
    while time.time() - start < timeout:
        try:
            with urllib.request.urlopen("http://127.0.0.1:4040/api/tunnels") as r:
                data = json.load(r)
                for t in data.get("tunnels", []):
                    if t.get("proto") == "https":
                        return t.get("public_url")
        except Exception:
            pass
        time.sleep(0.5)
    return None

def main():
    print("=== Launching FastAPI + ngrok ===")

    # FastAPI 起動
    print("Starting FastAPI (uvicorn)...")
    uvicorn_proc = subprocess.Popen(
        UVICORN_CMD,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,
    )

    t1 = threading.Thread(target=stream_output, args=("UVICORN", uvicorn_proc), daemon=True)
    t1.start()

    # 少し待ってから ngrok
    time.sleep(2)

    print("Starting ngrok...")
    ngrok_proc = subprocess.Popen(
        NGROK_CMD,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,
    )

    t2 = threading.Thread(target=stream_output, args=("NGROK", ngrok_proc), daemon=True)
    t2.start()

    # ngrok 公開URLを取得して表示
    url = get_ngrok_public_url()
    if url:
        print("\n=== Public ngrok URL ===")
        print(url)
        print(f"{url}/docs\n")
    else:
        print("\n[WARN] Could not get ngrok public URL\n")

    print("\n--- Press Ctrl+C to stop both ---\n")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nStopping processes...")

        for p in (ngrok_proc, uvicorn_proc):
            if p.poll() is None:
                p.send_signal(signal.CTRL_BREAK_EVENT)

        time.sleep(1)
        print("Stopped.")

if __name__ == "__main__":
    main()
