<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import World from './components/World.vue';
import GLBImporter from './components/GLBImporter.vue';
import GLBViewer from './components/GLBViewer.vue';
import type { BlockData } from './components/world';
import { FullBlockWithPureColor, FullBlockWithSamePic } from './components/Block';
import * as THREE from 'three';
import type { PointData } from './components/data';
import { voxelizeGLB } from './components/GLBUploader';
import { findPic } from './findPic';
import { clusterPoints } from './cluster';
import { smooth } from './smooth';

const glbFile = ref<File | null>(null);
const blockSize = ref(0.02);

// rgb范围为0-1
const voxelData = ref<PointData[]>([]);

// 使用 watch 监听依赖
watch([glbFile, blockSize], async ([newFile, newSize]) => {
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

const smoothVoxelData = ref<PointData[]>([]);

const radius = ref(1);
// 监听 voxelData 的变化，进行平滑处理
watch([voxelData, radius], async ([newData, radius]) => {
  // smoothVoxelData.value = smooth(newData, { radius: radius });
  smoothVoxelData.value = newData
})


const clusteredVoxelData = ref<PointData[]>([]);

const k = ref(8);
// 监听 voxelData 的变化，进行聚类处理
watch([smoothVoxelData, k], async ([newVoxelData, newEpsilon]) => {
  clusteredVoxelData.value = clusterPoints(newVoxelData, newEpsilon);
})


// 用于显示的数据
const convertedBlocks = computed<BlockData[]>(() => {
  return voxelData.value.map(voxel => ({
    position: [voxel.position.x, voxel.position.y, voxel.position.z],
    block: new FullBlockWithPureColor(
      new THREE.Color(voxel.color.r, voxel.color.g, voxel.color.b)
    )
  }));
});

const smoothBlocks = computed<BlockData[]>(() => {
  return smoothVoxelData.value.map(voxel => ({
    position: [voxel.position.x, voxel.position.y, voxel.position.z],
    block: new FullBlockWithPureColor(
      new THREE.Color(voxel.color.r, voxel.color.g, voxel.color.b)
    )
  }));
});


const clusteredBlocks = computed<BlockData[]>(() => {
  return clusteredVoxelData.value.map(voxel => ({
    position: [voxel.position.x, voxel.position.y, voxel.position.z],
    block: new FullBlockWithPureColor(
      new THREE.Color(voxel.color.r, voxel.color.g, voxel.color.b)
    )
  }));
});

const mcBlocks = computed<BlockData[]>(() => {
  return clusteredVoxelData.value.map(voxel => ({
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
      <div>
        <input type="number" v-model="radius" step="0.001" min="0.001" max="100" />
        {{ radius }}
      </div>
      <div id="k">
        <input type="number" v-model="k" step="1" min="1" />
      </div>
    </div>
    <div class="grid">
      <div class="top-left">
        <!-- <GLBViewer :file="glbFile" :scale="1 / blockSize" /> -->
        <World :blocks="convertedBlocks" />
      </div>
      <div class="top-right">
        <World :blocks="smoothBlocks" />
      </div>
      <div class="bottom-left">
        <World :blocks="clusteredBlocks" />
      </div>
      <div class="bottom-right">
        <World :blocks="mcBlocks" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.container {
  display: flex;
  flex-direction: row;
  height: 100%;
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  height: 100%;
  gap: 10px;
  width: 100%;
  padding: 20px;
}

.top-left,
.top-right,
.bottom-left,
.bottom-right {
  background-color: #ffffff;
  overflow: hidden;
  position: relative;
  height: 100%;
}

.panel {
  background-color: #f0f0f0;
  padding: 20px;
  box-sizing: border-box;
  height: 100%;
}
</style>
