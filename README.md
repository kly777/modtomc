# ModToMC - 3D模型转Minecraft体素转换器

一个将3D模型（GLB格式）转换为Minecraft风格体素数据的工具，包含Web前端、Go后端和Python处理脚本。

## 功能特性

- **体素化处理**: 将3D模型转换为体素数据
- **Minecraft方块映射**: 将体素映射到Minecraft方块
- **实时预览**: 在Web界面中预览转换结果

## 环境要求

### 运行环境
- **Python**: 3.11.x (推荐3.11.0-3.11.9)
- **Windows操作系统** (构建产物为Windows可执行文件)

## 快速构建和部署

### 使用Makefile构建

项目提供了Makefile用于快速构建和部署：

```bash
# 完整构建（后端+前端+Python）
make all

# 或单独构建
make build

# 清理构建目录
make clean

# 查看帮助
make help
```

构建完成后，所有文件将输出到 `.out` 目录，包含：

- `modtomc.exe` - Go后端可执行文件（集成前端服务和自动依赖管理）
- 前端静态文件（index.html, assets/等）
- `py/` - Python脚本和依赖配置
- `block_gen/` - 方块生成资源

### 部署步骤

1. **安装Python 3.11.x**
2. **直接运行可执行文件**:

   ```bash
   cd .out
   modtomc.exe
   ```

3. **访问应用**: 打开浏览器访问 `http://localhost:8080`

**自动依赖管理**:
- 首次运行时，Go服务器会自动检查并安装UV包管理器
- 自动安装Python依赖包
- 后续运行无需重复安装

## 手动安装和启动

### 1. 安装依赖

#### 后端依赖

```bash
# 进入server目录
cd server

# 安装Go依赖
go mod tidy

# 安装Python依赖 (需要先安装UV)
cd py
uv sync
```

#### 前端依赖

```bash
# 进入web目录
cd web

# 安装Node.js依赖
pnpm install
# 或使用npm
npm install
```

### 2. 启动服务

#### 启动后端服务

```bash
# 在server目录下
go run main.go
```

后端服务将在 `http://localhost:8080` 启动

#### 启动前端开发服务器

```bash
# 在web目录下
pnpm dev
```

前端应用将在 `http://localhost:5173` 启动

### 3. 访问应用

打开浏览器访问 `http://localhost:5173` 即可使用应用。
