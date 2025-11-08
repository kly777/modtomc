package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"mtm/router" // 导入router包
)

const (
	inputDir  = "in"
	outputDir = "out"
)

func main() {
	log.Println("启动服务...")

	// 创建必要目录
	for _, dir := range []string{inputDir, outputDir} {
		os.MkdirAll(dir, os.ModePerm)
	}

	// 设置路由
	mux := router.SetupRoutes()

	fmt.Println("Server started")
	fmt.Println("Access: http://localhost:8080")

	err := http.ListenAndServe(":8080", mux)
	if err != nil {
		log.Fatal(err)
	}
}
