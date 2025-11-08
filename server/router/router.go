package router

import (
	"net/http"
	"os"

	"mtm/handler" // 使用模块路径导入handler包
)

func SetupRoutes() *http.ServeMux {
	mux := http.NewServeMux()

	// API路由
	mux.HandleFunc("/convert", handler.ConvertHandler)

	// 静态文件服务 - 优先检查web目录
	webDir := "web"
	if _, err := os.Stat(webDir); os.IsNotExist(err) {
		// 如果web目录不存在，检查当前目录下的index.html
		webDir = "."
	}

	// 创建文件服务器
	fs := http.FileServer(http.Dir(webDir))

	// 处理所有其他请求为静态文件
	mux.Handle("/", fs)

	return mux
}
