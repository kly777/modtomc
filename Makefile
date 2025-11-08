# ModToMC 构建脚本
# 构建Go后端、前端静态文件和Python脚本到.out目录

# 配置变量
OUTPUT_DIR := .out
SERVER_DIR := server
WEB_DIR := web
PYTHON_DIR := $(SERVER_DIR)/py
BUILD_DIR := $(OUTPUT_DIR)/build

# 默认目标
.PHONY: all
all: clean build

# 清理构建目录
.PHONY: clean
clean:
	@echo "Cleaning build directory..."
	@rm -rf $(OUTPUT_DIR)

# 创建输出目录
$(OUTPUT_DIR):
	@mkdir -p $(OUTPUT_DIR)

# 构建Go后端可执行文件
.PHONY: build-server
build-server: $(OUTPUT_DIR)
	@echo "Building Go backend executable..."
	@cd $(SERVER_DIR) && go build -o ../$(OUTPUT_DIR)/modtomc.exe main.go
	@echo "Go backend built: $(OUTPUT_DIR)/modtomc.exe"

# 构建前端静态文件
.PHONY: build-web
build-web: $(OUTPUT_DIR)
	@echo "Building frontend static files..."
	@cd $(WEB_DIR) && pnpm install && pnpm build
	@mkdir -p $(OUTPUT_DIR)
	@cp -r $(WEB_DIR)/dist/* $(OUTPUT_DIR)/
	@echo "Frontend built: $(OUTPUT_DIR)/"

# 复制Python脚本和依赖
.PHONY: build-python
build-python: $(OUTPUT_DIR)
	@echo "Copying Python scripts and dependencies..."
	@mkdir -p $(OUTPUT_DIR)/py
	@cp -r $(PYTHON_DIR)/*.py $(OUTPUT_DIR)/py/
	@cp -r $(PYTHON_DIR)/pyproject.toml $(OUTPUT_DIR)/py/
	@cp -r $(PYTHON_DIR)/uv.lock $(OUTPUT_DIR)/py/
	@mkdir -p $(OUTPUT_DIR)/py/model
	@cp -r $(PYTHON_DIR)/model/* $(OUTPUT_DIR)/py/model/ 2>/dev/null || true
	@echo "Python scripts copied: $(OUTPUT_DIR)/py/"

# 复制必要的资源文件
.PHONY: copy-resources
copy-resources: $(OUTPUT_DIR)
	@echo "Copying resource files..."
	@mkdir -p $(OUTPUT_DIR)/block_gen
	@cp -r $(SERVER_DIR)/block_gen/*.png $(OUTPUT_DIR)/block_gen/ 2>/dev/null || true
	@cp -r $(SERVER_DIR)/block_gen/data.json $(OUTPUT_DIR)/block_gen/ 2>/dev/null || true
	@echo "Resource files copied"



# 完整构建
.PHONY: build
build: build-server build-web build-python copy-resources
	@echo ""
	@echo "=== BUILD COMPLETE ==="
	@echo "Output directory: $(OUTPUT_DIR)"
	@echo "Files included:"
	@echo "  - modtomc-server.exe (Go backend with frontend server)"
	@echo "  - Frontend static files (index.html, assets/, etc.)"
	@echo "  - py/ (Python scripts and dependencies)"
	@echo "  - block_gen/ (Block generation resources)"
	@echo ""
	@echo "Deployment steps:"
	@echo "1. Ensure Python 3.11 and UV are installed"
	@echo "2. In py directory run: uv sync"
	@echo "3. Run: modtomc-server.exe"
	@echo "4. Access: http://localhost:8080"

# 开发模式构建（不构建前端）
.PHONY: dev-build
dev-build: build-server build-python copy-resources
	@echo "开发模式构建完成"
	@echo "前端开发服务器需要单独启动: cd web && pnpm dev"

# 快速构建（仅后端）
.PHONY: quick-build
quick-build: build-server
	@echo "快速构建完成（仅后端）"

# 帮助信息
.PHONY: help
help:
	@echo "ModToMC 构建脚本"
	@echo ""
	@echo "可用目标:"
	@echo "  all          - 清理并完整构建"
	@echo "  build        - 完整构建（后端+前端+Python）"
	@echo "  build-server - 仅构建Go后端"
	@echo "  build-web    - 仅构建前端静态文件"
	@echo "  build-python - 仅复制Python脚本"
	@echo "  dev-build    - 开发模式构建（不构建前端）"
	@echo "  quick-build  - 快速构建（仅后端）"
	@echo "  clean        - 清理构建目录"
	@echo "  help         - 显示此帮助信息"
	@echo ""
	@echo "使用示例:"
	@echo "  make all     # 完整构建"
	@echo "  make build   # 完整构建"
	@echo "  make clean   # 清理"