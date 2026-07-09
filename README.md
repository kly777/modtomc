# ModToMC - 3D模型转Minecraft体素转换器

将3D模型（GLB格式）转换为Minecraft风格体素数据，Web前端 + Python FastAPI 后端。

## 功能特性

- **体素化处理**: 将3D模型转换为体素数据
- **颜色聚类**: 智能颜色分组和层级树
- **Minecraft方块映射**: CIE76色差匹配800+方块贴图
- **分步向导**: 5步交互式处理流程

## 环境要求

- **Python**: 3.11.x
- **Node.js**: 20+ (pnpm)
- **UV**: Python 包管理器

## 快速开始

```bash
# 1. 构建
make build

# 2. 运行
make run
# 或: cd .out/py && uv run uvicorn main:app --host 0.0.0.0 --port 8080

# 3. 访问
open http://localhost:8080
```

## 开发模式

```bash
# 后端 (自动重载)
make dev

# 前端 (另一个终端)
cd web && pnpm dev
# 访问 http://localhost:5173
```

## 项目结构

```
modtomc/
├── web/           # Vue 3 前端
├── server/py/     # Python FastAPI 后端
│   ├── main.py    # 入口
│   └── process.py # 体素化处理
├── Makefile
└── .out/          # 构建输出
```
