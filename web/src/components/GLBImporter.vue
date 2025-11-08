<template>
  <div class="glb-importer">
    <!-- 文件选择 -->
    <input
      type="file"
      accept=".glb"
      @change="handleFileChange"
      class="file-input"
    />

    <!-- 状态显示 -->
    <div v-if="status" class="status">{{ status }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

// 定义 v-model
const modelValue = defineModel<File | null>({
  type: File,
  required: false,
  default: null
})

// 状态显示
const status = ref('')

// 文件选择处理
const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    const file = target.files[0]
    if (file && (file.type !== 'model/gltf-binary' && !file.name.endsWith('.glb'))) {
      alert('请选择有效的 GLB 文件')
      return
    }
    if (file) {
      modelValue.value = file
      status.value = `已选择文件: ${file.name}`
    } else {
      modelValue.value = null
      status.value = ''
    }
  } else {
    modelValue.value = null
    status.value = ''
  }
}
</script>

<style scoped>
.glb-importer {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 20px;
}

.file-input {
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.status {
  color: #666;
  font-size: 0.9em;
}
</style>