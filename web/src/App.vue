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
import { getColorTree, toggleNodeExpand, getVisiblePoints } from './colorTree';
import type { ColorTree } from './colorTree';
import ColorTreeNode from './components/ColorTreeNode.vue';

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
  clusteredVoxelData.value.forEach((voxelDatas) => {
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

// 扩张聚类后，使用颜色对组再次聚类

const colorTree = ref<ColorTree | null>(null);
const autoExpend = ref(12); // 自动展开的阈值
const kClusteredVoxelData = ref<PointData[]>([]);

watch([clusteredVoxelData, autoExpend], ([newClusteredVoxelData, autoExpend]) => {
  if (newClusteredVoxelData.length > 0) {
    colorTree.value = getColorTree(newClusteredVoxelData, autoExpend);
    updateVisiblePoints();
  }
});

function updateVisiblePoints() {
  if (colorTree.value) {
    kClusteredVoxelData.value = getVisiblePoints(colorTree.value);
  }
}

function toggleNode(node: ColorTree) {
  if (colorTree.value) {
    toggleNodeExpand(colorTree.value, node);
    updateVisiblePoints();
  }
}

// === 颜色匹配材质 ===
const mcBlocks = computed<BlockData[]>(() => {

  return kClusteredVoxelData.value.map(voxel => ({
    position: [voxel.position.x, voxel.position.y, voxel.position.z],
    block: new FullBlockWithSamePic(
      findPic(voxel.color) ? findPic(voxel.color)! : '',
    )
  }));
});


</script>

<template>
  <div class="app-container">

    <div class="main-layout">
      <div class="control-panel">
        <div class="panel-section">
          <h2>模型处理</h2>
          <div class="control-group">
            <h3>导入模型</h3>
            <GLBImporter v-model="glbFile" />
          </div>

          <div class="control-group">
            <h3>体素化设置</h3>
            <div class="control-item">
              <label>体素大小:</label>
              <input type="number" v-model="blockSize" step="0.001" min="0.001" max="100" />
              <span class="value-display">{{ blockSize }}</span>
            </div>
          </div>

          <div class="control-group">
            <h3>颜色聚类</h3>
            <div class="control-item">
              <label>颜色阈值:</label>
              <input type="number" v-model="colorThreshold" step="1" min="1" />
              <span class="value-display">{{ colorThreshold }}</span>
            </div>
            <div class="control-item">
              <label>方差阈值:</label>
              <input type="number" v-model="varianceThreshold" step="0.001" min="0.001" max="100" />
              <span class="value-display">{{ varianceThreshold }}</span>
            </div>
          </div>
        </div>

        <div class="panel-section">
          <h2>颜色树控制</h2>
          <div class="control-group">
            <div class="control-item">
              <label>自动展开阈值:</label>
              <input type="number" v-model="autoExpend" step="0.1" min="1" />
              <span class="value-display">{{ autoExpend }}</span>
            </div>
          </div>
          <div class="tree-control" v-if="colorTree">
            <ColorTreeNode :node="colorTree" @toggle="toggleNode" />
          </div>
        </div>
      </div>

      <div class="preview-grid">
        <div class="preview-item">
          <h3>原始模型</h3>
          <GLBViewer :file="glbFile" :scale="1 / blockSize" />
        </div>
        <div class="preview-item">
          <h3>体素化结果</h3>
          <World :blocks="convertedBlocks" />
        </div>
        <div class="preview-item">
          <h3>颜色聚类</h3>
          <World :blocks="clusteredBlocks" />
        </div>
        <div class="preview-item">
          <h3>Minecraft材质</h3>
          <World :blocks="mcBlocks" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #f8f9fa;
}


.app-header h1 {
  margin: 0;
  font-size: 1.8rem;
}

.app-header p {
  margin: 5px 0 0;
  opacity: 0.8;
}

.main-layout {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.control-panel {
  width: 300px;
  background-color: white;
  padding: 20px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 25px;
}

.panel-section {
  padding: 15px;
  background-color: #f8f9fa;
  border-radius: 8px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
}

.panel-section h2 {
  margin-top: 0;
  padding-bottom: 10px;
  border-bottom: 1px solid #e0e0e0;
  color: #2c3e50;
}

.control-group {
  margin-bottom: 20px;
}

.control-group h3 {
  margin: 15px 0 10px;
  font-size: 1.1rem;
  color: #3498db;
}

.control-item {
  display: flex;
  align-items: center;
  margin: 10px 0;
}

.control-item label {
  width: 100px;
  font-weight: 500;
}

.control-item input {
  flex: 1;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.value-display {
  width: 60px;
  text-align: right;
  margin-left: 10px;
}

.tree-control {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 10px;
  background-color: white;
}

.preview-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(2, 1fr);
  gap: 15px;
  padding: 20px;
  background-color: #f0f2f5;
}

.preview-item {
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.preview-item h3 {
  margin: 0;
  padding: 12px 15px;
  background-color: #3498db;
  color: white;
  font-size: 1.1rem;
}

.preview-item>div {
  flex: 1;
  min-height: 0;
  /* 修复flex布局问题 */
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .main-layout {
    flex-direction: column;
  }

  .control-panel {
    width: 100%;
    max-height: 300px;
  }

  .preview-grid {
    grid-template-columns: 1fr;
    grid-template-rows: repeat(4, 1fr);
  }
}
</style>
