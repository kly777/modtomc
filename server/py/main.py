"""
ModToMC - 3D 模型转 Minecraft 体素转换器
FastAPI 后端入口（替换原 Go 后端）

开发: uv run uvicorn main:app --reload --port 8080
生产: uv run uvicorn main:app --host 0.0.0.0 --port 8080
"""

import logging
import os
import sys
from pathlib import Path

# 修复 Windows 下 uvicorn 子进程中文 print 的编码问题
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

from fastapi import FastAPI, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
logger = logging.getLogger(__name__)

# ── 路径解析 ──────────────────────────────────────────
# __file__ = server/py/main.py  →  BASE = server/
# __file__ = .out/py/main.py    →  BASE = .out/
SCRIPT_DIR = Path(__file__).resolve().parent
BASE_DIR = SCRIPT_DIR.parent

INPUT_DIR = BASE_DIR / "in"
OUTPUT_DIR = BASE_DIR / "out"

# 静态文件目录：生产 = .out/, 开发 = web/dist/
STATIC_CANDIDATES = [
    BASE_DIR,                            # 生产 (.out/)
    BASE_DIR.parent / "web" / "dist",    # 开发 (web/dist/)
]
STATIC_DIR = next(
    (d for d in STATIC_CANDIDATES if (d / "index.html").exists()),
    BASE_DIR,
)

# ── 应用初始化 ─────────────────────────────────────────
app = FastAPI(title="ModToMC")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    INPUT_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    logger.info(f"STATIC_DIR = {STATIC_DIR}")
    logger.info(f"INPUT_DIR  = {INPUT_DIR}")
    logger.info(f"OUTPUT_DIR = {OUTPUT_DIR}")
    logger.info("Server started – http://localhost:8080")


# ── API：体素化 GLB → CSV ──────────────────────────────
@app.post("/convert")
async def convert(file: UploadFile, blocksize: float = Form(default=0.03, alias="blockSize")):
    if not file.filename or not file.filename.lower().endswith(".glb"):
        raise HTTPException(400, "仅支持 .glb 文件")

    logger.info(f"收到文件: {file.filename}, blockSize={blocksize}")

    # 保存上传文件
    glb_path = INPUT_DIR / file.filename
    with open(glb_path, "wb") as f:
        f.write(await file.read())

    # 构建输出路径
    csv_filename = Path(file.filename).stem + ".csv"
    csv_path = OUTPUT_DIR / csv_filename

    # 执行体素化（直接调用，不走子进程）
    from process import main as voxelize

    try:
        voxelize(str(glb_path), str(csv_path), blocksize)
    except Exception as e:
        glb_path.unlink(missing_ok=True)
        logger.exception("体素化失败")
        raise HTTPException(500, f"体素化失败: {e}")

    logger.info(f"体素化完成 → {csv_path}")

    # 流式返回 CSV，返回后清输入文件
    def iter_csv():
        with open(csv_path, "rb") as f:
            while chunk := f.read(65536):
                yield chunk
        glb_path.unlink(missing_ok=True)

    return StreamingResponse(
        iter_csv(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={csv_filename}"},
    )


# ── API：聚类 + 颜色树 ─────────────────────────────────
from pydantic import BaseModel


class ClusterRequest(BaseModel):
    points: list[dict]
    color_threshold: float = 5.0
    variance_threshold: float = 0.01
    pos_threshold: int = 1
    min_cluster_size: int = 0
    auto_expend: float = 12.0


@app.post("/api/cluster")
async def api_cluster(req: ClusterRequest):
    """
    对体素点云做空间-颜色联合聚类，返回簇标签和颜色树。
    等价比前端 segmentVoxels() + getColorTree()。
    """
    from compute import cluster_voxels, build_color_tree

    labels, clusters = cluster_voxels(
        req.points,
        req.color_threshold,
        req.variance_threshold,
        req.pos_threshold,
        req.min_cluster_size,
    )
    tree = build_color_tree(clusters, req.auto_expend)

    return {
        "labels": labels,
        "clusters": clusters,
        "color_tree": tree,
    }


class MatchRequest(BaseModel):
    colors: list[dict]  # [{r, g, b}, ...] 0-1


@app.post("/api/match")
async def api_match(req: MatchRequest):
    """
    为每个颜色匹配最近的 Minecraft 方块贴图。
    等价比前端 findPic()。
    """
    from compute import match_minecraft_blocks

    file_paths = match_minecraft_blocks(req.colors)
    return {"blocks": file_paths}


# ── 静态文件服务 ───────────────────────────────────────
@app.get("/{full_path:path}")
async def serve_static(full_path: str):
    """兜底路由：为所有非 API 路径提供静态文件"""
    # API 路径已在上方匹配，不会落到这里
    file_path = STATIC_DIR / full_path
    if file_path.is_file():
        return FileResponse(file_path)
    # SPA fallback：所有未匹配路径返回 index.html
    index_path = STATIC_DIR / "index.html"
    if index_path.is_file():
        return FileResponse(index_path)
    raise HTTPException(404, "Not found")
