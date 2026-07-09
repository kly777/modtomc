# ModToMC 构建脚本
# 构建前端静态文件和 Python 后端到 .out 目录

OUTPUT_DIR := .out
WEB_DIR    := web
SERVER_DIR := server
PY_DIR     := $(SERVER_DIR)/py

.PHONY: all
all: clean build

# ── 清理 ──────────────────────────────────────────────
.PHONY: clean
clean:
	@echo "Cleaning build directory..."
	@rm -rf $(OUTPUT_DIR)

# 创建输出目录
$(OUTPUT_DIR):
	@mkdir -p $(OUTPUT_DIR)

# ── 前端构建 ──────────────────────────────────────────
.PHONY: build-web
build-web: $(OUTPUT_DIR)
	@echo "Building frontend..."
	@cd $(WEB_DIR) && pnpm install && pnpm build
	@cp -r $(WEB_DIR)/dist/* $(OUTPUT_DIR)/
	@echo "Frontend built → $(OUTPUT_DIR)/"

# ── Python 后端 ───────────────────────────────────────
.PHONY: build-python
build-python: $(OUTPUT_DIR)
	@echo "Preparing Python backend..."
	@mkdir -p $(OUTPUT_DIR)/py
	@cp $(PY_DIR)/*.py $(OUTPUT_DIR)/py/ 2>/dev/null || true
	@cp $(PY_DIR)/pyproject.toml $(OUTPUT_DIR)/py/
	@cp $(PY_DIR)/uv.lock $(OUTPUT_DIR)/py/
	@echo "Installing Python dependencies..."
	@cd $(OUTPUT_DIR)/py && uv sync
	@echo "Python backend ready → $(OUTPUT_DIR)/py/"

# ── 资源文件 ──────────────────────────────────────────
.PHONY: copy-resources
copy-resources: $(OUTPUT_DIR)
	@echo "Copying resources..."
	@mkdir -p $(OUTPUT_DIR)/block_gen
	@cp $(SERVER_DIR)/block_gen/*.png $(OUTPUT_DIR)/block_gen/ 2>/dev/null || true
	@cp $(SERVER_DIR)/block_gen/data.json $(OUTPUT_DIR)/block_gen/ 2>/dev/null || true

# ── 完整构建 ──────────────────────────────────────────
.PHONY: build
build: build-web build-python copy-resources
	@echo ""
	@echo "=============================="
	@echo "  BUILD COMPLETE"
	@echo "=============================="
	@echo "Output: $(OUTPUT_DIR)/"
	@echo ""
	@echo "To run:"
	@echo "  make run"
	@echo "  or: cd $(OUTPUT_DIR)/py && uv run uvicorn main:app --host 0.0.0.0 --port 8080"
	@echo ""

# ── 开发模式 ──────────────────────────────────────────
.PHONY: dev-build
dev-build: build-python copy-resources
	@echo "Dev build done."
	@echo "Start frontend separately: cd $(WEB_DIR) && pnpm dev"

# ── 运行 ──────────────────────────────────────────────
.PHONY: run
run:
	@echo "Starting ModToMC server..."
	@cd $(OUTPUT_DIR)/py && uv run uvicorn main:app --host 0.0.0.0 --port 8080

.PHONY: dev
dev:
	@echo "Starting dev server (with auto-reload)..."
	@cd $(PY_DIR) && uv run uvicorn main:app --reload --host 0.0.0.0 --port 8080

# ── 帮助 ──────────────────────────────────────────────
.PHONY: help
help:
	@echo "ModToMC 构建 & 运行"
	@echo ""
	@echo "  make all         清理 + 完整构建"
	@echo "  make build       完整构建 (.out/)"
	@echo "  make build-web   仅构建前端"
	@echo "  make build-python 仅准备 Python 后端"
	@echo "  make dev-build   开发模式构建（不构建前端）"
	@echo "  make clean       清理 .out/"
	@echo ""
	@echo "  make run         从 .out/ 启动生产服务器"
	@echo "  make dev         开发模式启动（自动重载）"
