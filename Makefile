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
	@echo "清理构建目录..."
	@rm -rf $(OUTPUT_DIR)

# 创建输出目录
$(OUTPUT_DIR):
	@mkdir -p $(OUTPUT_DIR)

# 构建Go后端可执行文件
.PHONY: build-server
build-server: $(OUTPUT_DIR)
	@echo "构建Go后端可执行文件..."
	@cd $(SERVER_DIR) && go build -o ../$(OUTPUT_DIR)/modtomc-server.exe main.go
	@echo "Go后端构建完成: $(OUTPUT_DIR)/modtomc-server.exe"

# 构建前端静态文件
.PHONY: build-web
build-web: $(OUTPUT_DIR)
	@echo "构建前端静态文件..."
	@cd $(WEB_DIR) && pnpm install && pnpm build
	@mkdir -p $(OUTPUT_DIR)
	@cp -r $(WEB_DIR)/dist/* $(OUTPUT_DIR)/
	@echo "前端构建完成: $(OUTPUT_DIR)/"

# 复制Python脚本和依赖
.PHONY: build-python
build-python: $(OUTPUT_DIR)
	@echo "复制Python脚本和依赖..."
	@mkdir -p $(OUTPUT_DIR)/py
	@cp -r $(PYTHON_DIR)/*.py $(OUTPUT_DIR)/py/
	@cp -r $(PYTHON_DIR)/pyproject.toml $(OUTPUT_DIR)/py/
	@cp -r $(PYTHON_DIR)/uv.lock $(OUTPUT_DIR)/py/
	@mkdir -p $(OUTPUT_DIR)/py/model
	@cp -r $(PYTHON_DIR)/model/* $(OUTPUT_DIR)/py/model/ 2>/dev/null || true
	@echo "Python脚本复制完成: $(OUTPUT_DIR)/py/"

# 复制必要的资源文件
.PHONY: copy-resources
copy-resources: $(OUTPUT_DIR)
	@echo "复制资源文件..."
	@mkdir -p $(OUTPUT_DIR)/block_gen
	@cp -r $(SERVER_DIR)/block_gen/*.png $(OUTPUT_DIR)/block_gen/ 2>/dev/null || true
	@cp -r $(SERVER_DIR)/block_gen/data.json $(OUTPUT_DIR)/block_gen/ 2>/dev/null || true
	@echo "资源文件复制完成"

# 创建启动脚本
.PHONY: create-launcher
create-launcher: $(OUTPUT_DIR)
	@echo "创建启动脚本..."
	@echo "@echo off" > $(OUTPUT_DIR)/start-server.bat
	@echo "echo 启动 ModToMC 服务器..." >> $(OUTPUT_DIR)/start-server.bat
	@echo "echo 请确保已安装 Python 3.11 和 UV 包管理器" >> $(OUTPUT_DIR)/start-server.bat
	@echo "echo 安装Python依赖: cd py && uv sync" >> $(OUTPUT_DIR)/start-server.bat
	@echo "modtomc-server.exe" >> $(OUTPUT_DIR)/start-server.bat
	@echo "启动脚本创建完成: $(OUTPUT_DIR)/start-server.bat"

# 创建部署说明
.PHONY: create-readme
create-readme: $(OUTPUT_DIR)
	@echo "创建部署说明..."
	@echo "# ModToMC 部署说明" > $(OUTPUT_DIR)/DEPLOYMENT.md
	@echo "" >> $(OUTPUT_DIR)/DEPLOYMENT.md
	@echo "## 系统要求" >> $(OUTPUT_DIR)/DEPLOYMENT.md
	@echo "- Windows 操作系统" >> $(OUTPUT_DIR)/DEPLOYMENT.md
	@echo "- Python 3.11.x" >> $(OUTPUT_DIR)/DEPLOYMENT.md
	@echo "- UV 包管理器" >> $(OUTPUT_DIR)/DEPLOYMENT.md
	@echo "" >> $(OUTPUT_DIR)/DEPLOYMENT.md
	@echo "## 安装步骤" >> $(OUTPUT_DIR)/DEPLOYMENT.md
	@echo "1. 安装 Python 3.11.x" >> $(OUTPUT_DIR)/DEPLOYMENT.md
	@echo "2. 安装 UV 包管理器: pip install uv" >> $(OUTPUT_DIR)/DEPLOYMENT.md
	@echo "3. 安装 Python 依赖: cd py && uv sync" >> $(OUTPUT_DIR)/DEPLOYMENT.md
	@echo "4. 运行启动脚本: start-server.bat" >> $(OUTPUT_DIR)/DEPLOYMENT.md
	@echo "" >> $(OUTPUT_DIR)/DEPLOYMENT.md
	@echo "## 访问应用" >> $(OUTPUT_DIR)/DEPLOYMENT.md
	@echo "服务器启动后，在浏览器中访问: http://localhost:8080" >> $(OUTPUT_DIR)/DEPLOYMENT.md
	@echo "部署说明创建完成: $(OUTPUT_DIR)/DEPLOYMENT.md"

# 完整构建
.PHONY: build
build: build-server build-web build-python copy-resources create-launcher create-readme
	@echo ""
	@echo "=== 构建完成 ==="
	@echo "输出目录: $(OUTPUT_DIR)"
	@echo "包含文件:"
	@echo "  - modtomc-server.exe (Go后端)"
	@echo "  - web/ (前端静态文件)"
	@echo "  - py/ (Python脚本和依赖)"
	@echo "  - block_gen/ (方块生成资源)"
	@echo "  - start-server.bat (启动脚本)"
	@echo "  - DEPLOYMENT.md (部署说明)"
	@echo ""
	@echo "部署步骤:"
	@echo "1. 确保安装 Python 3.11 和 UV"
	@echo "2. 在 py 目录运行: uv sync"
	@echo "3. 运行: start-server.bat"
	@echo "4. 访问: http://localhost:8080"

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