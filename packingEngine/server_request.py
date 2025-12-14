import os
import time
import json
import secrets
import threading
import subprocess
import tempfile
import zipfile
from pathlib import Path
from typing import List, Dict, Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse, JSONResponse

# =========================
# Paths (あなたの構成に合わせて調整)
# =========================
BASE_DIR = Path(__file__).resolve().parent

PACKLIST_DIR = BASE_DIR / "packList"   # json upload先
TRUNK_DIR    = BASE_DIR / "trunk"      # obj upload先

VOXELS_DIR   = BASE_DIR / "voxels"     # trunk→GH出力先（obj/mtl/3dm等が出る想定）
BAGGAGE_DIR  = BASE_DIR / "baggage"    # packList→GH出力先（obj/mtlの連番が出る想定）

GH_TRUNK   = BASE_DIR / "251213_truckVoxel.gh"      # trunk用
GH_PACKING = BASE_DIR / "251213_3dBinPacking.gh"    # packlist用

RHINO_EXE  = r"D:\Program Files\Rhino 8\System\Rhino.exe"

# =========================
# Security
# =========================
UPLOAD_TOKEN = ""  # 空なら認証なし

# =========================
# Limits / Settings
# =========================
ALLOWED = {
    "packlist": {".json"},
    "trunk":    {".obj"},
}

MAX_BYTES = {
    "packlist": 5 * 1024 * 1024,      # 5MB
    "trunk":    500 * 1024 * 1024,    # 500MB
}

DEBOUNCE_SEC = 0.0           # APIは単発実行なので基本不要（残してもよい）
JOB_TIMEOUT_SEC = 300

IN_STABLE_CHECKS = 3
IN_STABLE_INTERVAL = 0.25
IN_STABLE_TIMEOUT = 30.0

OUT_STABLE_CHECKS = 3
OUT_STABLE_INTERVAL = 0.25
OUT_STABLE_TIMEOUT = 90.0

# 出力として期待する拡張子
OUTPUT_EXTS = {".obj", ".mtl"}

app = FastAPI(title="GH Runner Uploader", version="1.0.0")

# 同時実行防止（Rhinoを並列起動すると事故りやすい）
_job_lock = threading.Lock()
_job_running = False


# =========================
# Utils
# =========================
def _check_token(token: str):
    if UPLOAD_TOKEN and token != UPLOAD_TOKEN:
        raise HTTPException(401, "invalid token")

def _safe_name(name: str) -> str:
    return Path(name).name

def is_stable_readable(path: Path, stable_checks, interval, timeout) -> bool:
    start = time.time()
    last_size = -1
    same = 0
    while time.time() - start < timeout:
        try:
            st = path.stat()
            size = st.st_size
            with open(path, "rb"):
                pass
            if size == last_size:
                same += 1
                if same >= stable_checks:
                    return True
            else:
                last_size = size
                same = 0
        except Exception:
            same = 0
        time.sleep(interval)
    return False

def snapshot_folder(folder: Path, exts: set[str]):
    out = {ext: {} for ext in exts}
    if not folder.exists():
        return out
    for p in folder.glob("*"):
        if not p.is_file():
            continue
        ext = p.suffix.lower()
        if ext not in out:
            continue
        try:
            st = p.stat()
            out[ext][str(p.resolve())] = (st.st_mtime_ns, st.st_size)
        except Exception:
            pass
    return out

def diff_changed(before, after, exts: set[str]):
    changed = {ext: set() for ext in exts}
    for ext in exts:
        b = before.get(ext, {})
        a = after.get(ext, {})
        for path in a.keys() - b.keys():
            changed[ext].add(path)
        for path in a.keys() & b.keys():
            if a[path] != b[path]:
                changed[ext].add(path)
    return changed

def _atomic_save(kind: str, upload: UploadFile, dst_dir: Path) -> Path:
    dst_dir.mkdir(parents=True, exist_ok=True)

    fname = _safe_name(upload.filename or "")
    if not fname:
        raise HTTPException(400, "filename required")

    ext = Path(fname).suffix.lower()
    if ext not in ALLOWED[kind]:
        raise HTTPException(400, f"invalid extension: {ext}")

    tmp = dst_dir / f"{fname}.uploading.{secrets.token_hex(4)}"
    final = dst_dir / fname

    total = 0
    with open(tmp, "wb") as f:
        while True:
            chunk = upload.file.read(1024 * 1024)
            if not chunk:
                break
            total += len(chunk)
            if total > MAX_BYTES[kind]:
                try:
                    f.close()
                finally:
                    tmp.unlink(missing_ok=True)
                raise HTTPException(413, f"file too large (>{MAX_BYTES[kind]} bytes)")
            f.write(chunk)
        f.flush()
        os.fsync(f.fileno())

    tmp.replace(final)
    return final

def read_items_count(json_path: Path) -> int:
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    items = data.get("items", [])
    return len(items) if isinstance(items, list) else 0

def zip_files(files: List[Path], zip_path: Path):
    zip_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as z:
        for p in files:
            # zip内ではファイル名だけにする（必要なら相対パスに変更OK）
            z.write(p, arcname=p.name)

def _launch_rhino(gh_file: Path) -> subprocess.Popen:
    if not Path(RHINO_EXE).exists():
        raise HTTPException(500, f"Rhino.exe not found: {RHINO_EXE}")
    if not gh_file.exists():
        raise HTTPException(500, f"GH file not found: {gh_file}")
    cmd = [RHINO_EXE, str(gh_file)]
    return subprocess.Popen(cmd)

def _terminate_proc(proc: subprocess.Popen):
    if proc.poll() is None:
        try:
            proc.terminate()
        except Exception:
            pass
        try:
            proc.wait(timeout=8)
        except Exception:
            try:
                proc.kill()
            except Exception:
                pass


# =========================
# Core jobs
# =========================
def run_trunk_job_and_collect(voxels_dir: Path, gh_file: Path) -> List[Path]:
    """
    trunkアップロードをトリガーにGHを実行し、
    voxels_dir内で変化した .obj と .mtl を1セット拾って返す。
    """
    before = snapshot_folder(voxels_dir, OUTPUT_EXTS)
    proc = _launch_rhino(gh_file)

    picked_obj = None
    picked_mtl = None
    t0 = time.time()
    last_print = 0.0

    try:
        while time.time() - t0 < JOB_TIMEOUT_SEC:
            time.sleep(0.5)
            after = snapshot_folder(voxels_dir, OUTPUT_EXTS)
            changed = diff_changed(before, after, OUTPUT_EXTS)

            if changed[".obj"] and changed[".mtl"]:
                # 直近更新を採用
                picked_obj = max([Path(p) for p in changed[".obj"]], key=lambda p: p.stat().st_mtime_ns)
                picked_mtl = max([Path(p) for p in changed[".mtl"]], key=lambda p: p.stat().st_mtime_ns)

                # 安定化待ち
                if is_stable_readable(picked_obj, OUT_STABLE_CHECKS, OUT_STABLE_INTERVAL, OUT_STABLE_TIMEOUT) and \
                   is_stable_readable(picked_mtl, OUT_STABLE_CHECKS, OUT_STABLE_INTERVAL, OUT_STABLE_TIMEOUT):
                    return [picked_obj, picked_mtl]

            now = time.time()
            if now - last_print > 3.0:
                last_print = now

            if proc.poll() is not None:
                break

        raise HTTPException(504, "timeout waiting voxels outputs (.obj/.mtl)")
    finally:
        _terminate_proc(proc)


def run_packlist_job_and_collect(baggage_dir: Path, gh_file: Path, n_items: int) -> List[Path]:
    """
    packListアップロードをトリガーにGHを実行し、
    baggage_dir内で変化した .obj と .mtl を items数ぶん拾って返す。
    """
    before = snapshot_folder(baggage_dir, OUTPUT_EXTS)
    proc = _launch_rhino(gh_file)

    picked_obj = set()
    picked_mtl = set()

    t0 = time.time()
    last_print = 0.0

    try:
        while time.time() - t0 < JOB_TIMEOUT_SEC:
            time.sleep(0.5)

            after = snapshot_folder(baggage_dir, OUTPUT_EXTS)
            changed = diff_changed(before, after, OUTPUT_EXTS)

            picked_obj |= set(changed[".obj"])
            picked_mtl |= set(changed[".mtl"])

            if len(picked_obj) >= n_items and len(picked_mtl) >= n_items:
                # 直近n件を採用（連番名なら自然に揃うはず）
                obj_list = sorted([Path(p) for p in picked_obj], key=lambda p: p.stat().st_mtime_ns)[-n_items:]
                mtl_list = sorted([Path(p) for p in picked_mtl], key=lambda p: p.stat().st_mtime_ns)[-n_items:]

                ok = True
                for p in obj_list + mtl_list:
                    if not is_stable_readable(p, OUT_STABLE_CHECKS, OUT_STABLE_INTERVAL, OUT_STABLE_TIMEOUT):
                        ok = False
                        break
                if ok:
                    return obj_list + mtl_list

            now = time.time()
            if now - last_print > 3.0:
                last_print = now

            if proc.poll() is not None:
                break

        raise HTTPException(504, "timeout waiting baggage outputs (.obj/.mtl)")
    finally:
        _terminate_proc(proc)


# =========================
# Endpoints
# =========================
@app.get("/health")
def health():
    return {"ok": True, "time": time.time()}

@app.post("/upload/trunk")
async def upload_trunk(file: UploadFile = File(...), token: str = Form("")):
    _check_token(token)

    # 入力保存
    saved = _atomic_save("trunk", file, TRUNK_DIR)

    if not is_stable_readable(saved, IN_STABLE_CHECKS, IN_STABLE_INTERVAL, IN_STABLE_TIMEOUT):
        raise HTTPException(400, f"uploaded file not stable: {saved.name}")

    # 同時実行防止
    global _job_running
    with _job_lock:
        if _job_running:
            raise HTTPException(429, "job already running")
        _job_running = True

    try:
        outputs = run_trunk_job_and_collect(VOXELS_DIR, GH_TRUNK)

        # zip作成して返却
        tmpdir = Path(tempfile.mkdtemp(prefix="gh_return_"))
        zip_path = tmpdir / f"trunk_result.zip"
        zip_files(outputs, zip_path)

        return FileResponse(
            path=str(zip_path),
            filename=zip_path.name,
            media_type="application/zip"
        )
    finally:
        with _job_lock:
            _job_running = False


@app.post("/upload/packlist")
async def upload_packlist(file: UploadFile = File(...), token: str = Form("")):
    _check_token(token)

    saved = _atomic_save("packlist", file, PACKLIST_DIR)

    if not is_stable_readable(saved, IN_STABLE_CHECKS, IN_STABLE_INTERVAL, IN_STABLE_TIMEOUT):
        raise HTTPException(400, f"uploaded file not stable: {saved.name}")

    n_items = read_items_count(saved)
    if n_items <= 0:
        raise HTTPException(400, "items length is 0 in uploaded json")

    global _job_running
    with _job_lock:
        if _job_running:
            raise HTTPException(429, "job already running")
        _job_running = True

    try:
        outputs = run_packlist_job_and_collect(BAGGAGE_DIR, GH_PACKING, n_items)

        tmpdir = Path(tempfile.mkdtemp(prefix="gh_return_"))
        zip_path = tmpdir / f"baggage_result.zip"
        zip_files(outputs, zip_path)

        return FileResponse(
            path=str(zip_path),
            filename=zip_path.name,
            media_type="application/zip"
        )
    finally:
        with _job_lock:
            _job_running = False
