"""统一日志：同时输出到控制台和 ./log/ 目录"""

import logging
import sys
from pathlib import Path

LOG_DIR = Path(__file__).resolve().parent.parent.parent / "log"
LOG_DIR.mkdir(parents=True, exist_ok=True)


def setup_logging(name: str = "modtomc") -> logging.Logger:
    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG)

    # 控制台 handler
    if not any(isinstance(h, logging.StreamHandler) for h in logger.handlers):
        ch = logging.StreamHandler(sys.stdout)
        ch.setLevel(logging.INFO)
        ch.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s", datefmt="%H:%M:%S"))
        logger.addHandler(ch)

    # 文件 handler (完整日志)
    fh_path = LOG_DIR / "backend.log"
    fh = logging.FileHandler(str(fh_path), encoding="utf-8")
    fh.setLevel(logging.DEBUG)
    fh.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(name)s %(message)s"))
    logger.addHandler(fh)

    # 前端日志文件 (POST /api/log 写入)
    fe_path = LOG_DIR / "frontend.log"
    if not fe_path.exists():
        fe_path.write_text("", encoding="utf-8")

    logger.info(f"Log directory: {LOG_DIR}")
    return logger


def log_frontend(level: str, message: str):
    """前端发来的日志写入 frontend.log"""
    fe_path = LOG_DIR / "frontend.log"
    with open(fe_path, "a", encoding="utf-8") as f:
        from datetime import datetime
        ts = datetime.now().strftime("%H:%M:%S")
        f.write(f"{ts} [{level}] {message}\n")
