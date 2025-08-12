package router

import (
	"net/http"

	"mtm/handler" // 使用模块路径导入handler包
)

func SetupRoutes() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("/convert", handler.ConvertHandler)
	return mux
}