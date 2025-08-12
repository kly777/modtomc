package handler

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
)

const (
	inputDir    = "in"
	outputDir   = "out"
	pyScriptDir = "py"
)

func ConvertHandler(w http.ResponseWriter, r *http.Request) {
	// 添加CORS响应头
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	// 处理预检请求
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	log.Println("收到请求...")
	// 限制上传文件大小为100MB
	r.ParseMultipartForm(100 << 20)

	// 1. 处理文件上传
	file, handler, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "Error retrieving the file", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// 验证文件扩展名
	if ext := strings.ToLower(filepath.Ext(handler.Filename)); ext != ".glb" {
		http.Error(w, "Invalid file extension", http.StatusBadRequest)
		return
	}

	// 创建上传文件路径
	glbPath := filepath.Join(inputDir, handler.Filename)
	dst, err := os.Create(glbPath)
	if err != nil {
		http.Error(w, "Unable to create the file", http.StatusInternalServerError)
		return
	}
	defer dst.Close()

	// 保存上传文件
	if _, err := io.Copy(dst, file); err != nil {
		http.Error(w, "Error saving the file", http.StatusInternalServerError)
		return
	}

	// 2. 构建CSV输出路径
	csvFilename := strings.TrimSuffix(handler.Filename, ".glb") + ".csv"
	csvPath := filepath.Join(outputDir, csvFilename)
	// 从请求中获取blockSize参数，默认为0.03
	blockSizeStr := r.FormValue("blockSize")
	blockSize, err := strconv.ParseFloat(blockSizeStr, 64)
	if err != nil {
		blockSize = 0.03 // 如果解析失败，使用默认值
	}
	// 3. 执行Python脚本
	cmd := exec.Command("uv", "run",
		filepath.Join("process.py"),
		"../"+glbPath,
		"../"+csvPath,
		strconv.FormatFloat(blockSize, 'f', -1, 64),
	)

	cmd.Dir = "py"

	// 记录执行日志（可选）
	cmd.Stdout = log.Writer()
	cmd.Stderr = log.Writer()

	if err := cmd.Run(); err != nil {
		http.Error(w, fmt.Sprintf("Python script execution failed: %v", err), http.StatusInternalServerError)
		return
	}

	// 4. 返回CSV文件
	csvFile, err := os.Open(csvPath)
	if err != nil {
		http.Error(w, "Error opening output file", http.StatusInternalServerError)
		return
	}
	defer csvFile.Close()

	// 设置响应头
	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s", csvFilename))

	// 流式传输文件
	if _, err := io.Copy(w, csvFile); err != nil {
		http.Error(w, "Error sending the file", http.StatusInternalServerError)
		return
	}

	// 5. 清理临时文件（异步执行）
	go func() {
		os.Remove(glbPath)
		// os.Remove(csvPath)
	}()
}