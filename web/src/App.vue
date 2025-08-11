<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import World from './components/World.vue';
import GLBImporter from './components/GLBImporter.vue';
import type { BlockData } from './components/world';
import { FullBlockWithPureColor, FullBlockWithSamePic } from './components/Block';
import * as THREE from 'three';
import type { PointData } from './components/data';
import { voxelizeGLB } from './components/GLBUploader';
import { findPic } from './findPic';

const glbFile = ref<File | null>(null);
const blockSize = ref(0.02);

// rgb范围为0-1
const voxelData = ref<PointData[]>([]);

// 使用 watch 监听依赖
watch([glbFile, blockSize], ([newFile, newSize]) => {
  if (newFile) {
    voxelizeGLB(newFile, newSize)
      .then((data) => {
        voxelData.value = data.voxelData; // 更新 ref 的值
      })
      .catch((error) => {
        console.error('GLB转换失败:', error);
      });
  }
});

const convertedBlocks = computed<BlockData[]>(() => {
  return voxelData.value.map(voxel => ({
    position: [voxel.position.x, voxel.position.y, voxel.position.z],
    block: new FullBlockWithPureColor(
      new THREE.Color(voxel.color.r, voxel.color.g, voxel.color.b)
    )
  }));
});

const mcBlocks = computed<BlockData[]>(() => {
  return voxelData.value.map(voxel => ({
    position: [voxel.position.x, voxel.position.y, voxel.position.z],
    block: new FullBlockWithSamePic(
      findPic(voxel.color) ? findPic(voxel.color)! : '',
    )
  }));
});
</script>

<template>
  <div class="container">
    <div class="panel">
      <GLBImporter v-model="glbFile" />
      <div>
        <input type="number" v-model="blockSize" step="0.001" min="0.001" max="100" />
        {{ blockSize }}
      </div>
    </div>
    <div class="result">
      <div class="before show">
        <World :blocks="convertedBlocks" />
      </div>
      <div class="after show">
        <World :blocks="mcBlocks" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.container {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  height: 100%;
}

.panel {
  width: 300px;
  background-color: #f0f0f0;
  padding: 20px;
  box-sizing: border-box;
}

.result {
  flex: 1;
  background-color: #ffffff;
  height: 100%;
  gap: 20px;
  box-sizing: border-box;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>
