<template>
  <div class="converter">
    <!-- 文件选择 -->
    <input type="file" accept=".glb" @change="handleFileChange" class="file-input" />

    <!-- 添加blockSize参数输入 -->
    <div class="block-size-input">
      <label>方块大小:</label>
      <input type="number" v-model.number="blockSize" step="0.01" min="0.01" />
    </div>

    <!-- 状态显示 -->
    <div v-if="status" class="status">{{ status }}</div>

    <!-- 上传按钮 -->
    <button @click="uploadFile" :disabled="!selectedFile || uploading" class="upload-btn">
      {{ uploading ? '处理中...' : '上传并转换' }}
    </button>

    <!-- CSV数据展示 -->
    <div v-if="csvData.length" class="result">
      <h3>转换结果预览</h3>
      <p>共{{ VoxelData.length }}个方块</p>
      <table class="csv-table">
        <thead>
          <tr>
            <th v-for="(header, i) in csvHeaders" :key="i">{{ header }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in VoxelData.slice(0, 20)" :key="i">
            <td v-for="(cell, j) in row" :key="j">{{ cell }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Papa from 'papaparse'
import axios from 'axios'
import { type PointData } from './data';

const VoxelData = defineModel<PointData[]>({
  type: Array,
  required: true
});


// 响应式状态
const selectedFile = ref<File | null>(null)
const status = ref('')
const uploading = ref(false)
const csvData = ref<string[][]>([])
const csvHeaders = ref<string[]>([])
const blockSize = ref(0.03) // 默认方块大小


// 文件选择处理
const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    const file = target.files[0]
    if (file && (file.type !== 'model/gltf-binary' && !file.name.endsWith('.glb'))) {
      alert('请选择有效的GLB文件')
      return
    }
    if (file) {
      selectedFile.value = file
      status.value = `已选择文件: ${file.name}`
    }
  }
}

// 文件上传处理
const uploadFile = async () => {
  if (!selectedFile.value) return

  const formData = new FormData()
  formData.append('file', selectedFile.value)
  // 添加blockSize参数
  formData.append('blockSize', blockSize.value.toString())

  uploading.value = true
  status.value = '正在上传并处理...'

  try {
    // 发送请求（注意设置responseType为blob）
    const response = await axios.post('http://localhost:8080/convert', formData, {
      responseType: 'blob',
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })

    // 解析CSV
    const reader = new FileReader()
    reader.onload = () => {
      const result = Papa.parse<string[]>(reader.result as string, {

      })
      csvHeaders.value = result.data[0] as string[]
      csvData.value = result.data.slice(1) as string[][]

      // 转换并存储点云数据
      // 创建新数组并赋值以触发响应式更新
      const newVoxelData: PointData[] = [];
      result.data.slice(1).forEach(row => {
        if (row.length >= 6) {
          newVoxelData.push({
            position:
            {
              x: parseInt(row[0] || '0'),
              y: parseInt(row[1] || '0'),
              z: parseInt(row[2] || '0'),
            },
            color: {
              r: parseFloat(row[3] || '0'),
              g: parseFloat(row[4] || '0'),
              b: parseFloat(row[5] || '0')
            },
            variance: row[6] ? parseFloat(row[6]) : 0

          });
        }
      });
      VoxelData.value = newVoxelData;
      // eventBus?.emit(VOXEL_DATA_EVENT, VoxelData.value)
    }
    reader.readAsText(response.data)

    status.value = '转换完成，文件已下载'
  } catch (error) {
    console.error('转换失败:', error)
    status.value = '转换失败，请重试'
    alert('文件处理失败')
  } finally {
    uploading.value = false
  }
}
</script>

<style scoped>
.file-input {
  margin: 1rem 0;
}

.status {
  margin: 1rem 0;
  color: #666;
}

.upload-btn {
  padding: 0.5rem 1rem;
  background: #42b983;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin-bottom: 2rem;
}

.upload-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.result {
  width: 100%;
  overflow-x: auto;
}

.csv-table {
  border-collapse: collapse;
  width: 100%;
  max-width: 800px;
  margin: 1rem 0;
}

.csv-table th,
.csv-table td {
  border: 1px solid #ddd;
  padding: 8px;
  text-align: left;
  white-space: nowrap;
}

.csv-table th {
  background-color: #f5f5f5;
}
</style>