package main

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

const (
	uploadDir   = "in"
	outputDir   = "out"
	pyScriptDir = "py"
)

func main() {
	// 创建必要目录
	for _, dir := range []string{uploadDir, outputDir} {
		os.MkdirAll(dir, os.ModePerm)
	}

	http.HandleFunc("/convert", func(w http.ResponseWriter, r *http.Request) {
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
		glbPath := filepath.Join(uploadDir, handler.Filename)
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

		// 3. 执行Python脚本
		cmd := exec.Command("python", 
			filepath.Join(pyScriptDir, "process.py"),
			glbPath,
			csvPath,
		)
		
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
			// 可选：保留CSV文件或清理
			// os.Remove(csvPath)
		}()
	})

	fmt.Println("Server started at :8080")
	http.ListenAndServe(":8080", nil)
}