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
import { segmentVoxels } from './cluster';

// ===导入glb模型===
const glbFile = ref<File | null>(null);


// ===体素化===
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


// 用于显示的数据
const convertedBlocks = computed<BlockData[]>(() => {
  return voxelData.value.map(voxel => ({
    position: [voxel.position.x, voxel.position.y, voxel.position.z],
    block: new FullBlockWithPureColor(
      new THREE.Color(voxel.color.r, voxel.color.g, voxel.color.b)
    )
  }));
});



// ===聚类体素颜色===

const clusteredVoxelData = ref<PointData[][]>([]);

const colorThreshold = ref(5);
const ttt = ref(0); // 用于测试的索引
const varianceThreshold = ref(0.01);
// 监听 voxelData 的变化，进行聚类处理
watch([voxelData, colorThreshold, varianceThreshold], ([newVoxelData, colorThreshold, varianceThreshold]) => {
  clusteredVoxelData.value = segmentVoxels(newVoxelData, {
    colorThreshold,
    varianceThreshold,
  }).sort((a, b) => {
    return a.length > b.length ? -1 : 1;
  });
})




const clusteredBlocks = computed<BlockData[]>(() => {
  let blocks: BlockData[] = [];
  clusteredVoxelData.value.forEach((voxelDatas)=>{
    const total = voxelDatas.length;
    const sum = voxelDatas.reduce((acc, voxel) => {
      acc.r += voxel.color.r;
      acc.g += voxel.color.g;
      acc.b += voxel.color.b;
      return acc;
    }, { r: 0, g: 0, b: 0 });

    const averageColor = {
      r: sum.r / total,
      g: sum.g / total,
      b: sum.b / total
    };
    voxelDatas.forEach(voxel => {
      blocks.push({
        position: [voxel.position.x, voxel.position.y, voxel.position.z],
        block: new FullBlockWithPureColor(
          new THREE.Color(averageColor.r, averageColor.g, averageColor.b)
        )
      });
    });
  })
  return blocks;
});

// 扩张聚类后，使用k-means再次聚类
const kClusteredVoxelData = ref<PointData[]>([])

const k = ref(5)

watch([clusteredVoxelData, k], ([newClusteredVoxelData, k]) => {
  if (newClusteredVoxelData.length > 0) {
    // 这里可以调用k-means聚类算法
    // 例如：kMeans(newClusteredVoxelData, k);
    // 注意：需要实现kMeans函数
    console.log(`进行K-means聚类，k=${k}`);
    // kClusteredVoxelData.value = kMeans(newClusteredVoxelData, k);
  }
});



// === 颜色匹配材质 ===
const mcBlocks = computed<BlockData[]>(() => {
  const averageColor = kClusteredVoxelData.value.reduce(
    (acc, voxel) => {
      acc.r += voxel.color.r;
      acc.g += voxel.color.g;
      acc.b += voxel.color.b;
      return acc;
    },
    { r: 0, g: 0, b: 0 }
  )
  const averageColor2 = {
    r: averageColor.r / kClusteredVoxelData.value.length,
    g: averageColor.g / kClusteredVoxelData.value.length,
    b: averageColor.b / kClusteredVoxelData.value.length
  }
  return kClusteredVoxelData.value.map(voxel => ({
    position: [voxel.position.x, voxel.position.y, voxel.position.z],
    block: new FullBlockWithSamePic(
      findPic(averageColor2) ? findPic(averageColor2)! : '',
    )
  }));
});


</script>

<template>
  <div class="container">
    <div class="panel">
      <h4>导入模型</h4>
      <GLBImporter v-model="glbFile" />
      <h4>体素化</h4>
      <div>
        <input type="number" v-model="blockSize" step="0.001" min="0.001" max="100" />
        {{ blockSize }}
      </div>
      <h4>扩张聚类</h4>
      <div>
        <input type="number" v-model="varianceThreshold" step="0.001" min="0.001" max="100" />
        {{ varianceThreshold }}
      </div>
      <div id="k">
        <input type="number" v-model="colorThreshold" step="1" min="1" />
        {{ colorThreshold }}
        <input type="number" v-model="ttt" step="1" min="0" />
        {{ ttt }}
      </div>
    </div>
    <div class="grid">
      <div class="top-left">
        <GLBViewer :file="glbFile" :scale="1 / blockSize" />
      </div>
      <div class="top-right">
        <World :blocks="convertedBlocks" />
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
