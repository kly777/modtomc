<template>
  <!-- 无渲染组件 -->
</template>

<script setup lang="ts">
import * as THREE from 'three';
import { onMounted, watch } from 'vue';
import { MCWorld, type BlockData } from './world';
import { logger } from "../logger";

const props = defineProps<{
  scene: THREE.Scene;
  blocks: BlockData[];
}>();

const cellSize = 128;
const world = new MCWorld(cellSize);

// 统一的几何体更新逻辑
function rebuildGeometry() {
  logger.info(`rebuildGeometry: ${props.blocks.length} blocks`);
  // 清理旧 mesh
  const oldMesh = props.scene.children.find(child => child.type === 'Mesh');
  if (oldMesh) props.scene.remove(oldMesh);

  world.setBlocks(props.blocks);
  updateGeometry(world, props.scene);
  logger.info(`scene children after rebuild: ${props.scene.children.length}`);
}

onMounted(() => {
  // 挂载时立即用当前的 blocks 初始化（从其他步骤切回时需要）
  rebuildGeometry();
});

watch(() => props.blocks, () => {
  rebuildGeometry();
}, { deep: true });

function updateGeometry(world: MCWorld, scene: THREE.Scene) {
  const { positions, normals, indices, uvs, materialIndices, materialCache } = world.generateGeometryDataForCell(0, 0, 0);
  const geometry = new THREE.BufferGeometry();

  const positionNumComponents = 3;
  const normalNumComponents = 3;
  const uvNumComponents = 2;

  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array(positions), positionNumComponents)
  );

  geometry.setAttribute(
    'normal',
    new THREE.BufferAttribute(new Float32Array(normals), normalNumComponents)
  );

  geometry.setAttribute(
    'uv',
    new THREE.BufferAttribute(new Float32Array(uvs), uvNumComponents)
  );

  geometry.setIndex(indices);
  geometry.computeBoundingSphere();

  // 生成材质数组
  const materials: THREE.Material[] = [];
  // 根据materialCache创建材质数组（按索引顺序）
  // 注意：materialCache是一个Map<string, number>，我们需要按索引顺序创建材质数组
  // 创建一个临时数组，长度为materialCache.size
  const tempMaterials: THREE.Material[] = new Array(materialCache.size);
  materialCache.forEach((index, key) => {
    tempMaterials[index] = world.parseMaterialFromKey(key);
  });
  materials.push(...tempMaterials);

  // 设置几何分组（groups）以指定每个面的材质索引
  const groups: { start: number, count: number, materialIndex: number }[] = [];
  // 每个面对应6个索引（两个三角形）
  const faceCount = indices.length / 6;
  for (let faceIndex = 0; faceIndex < faceCount; faceIndex++) {
    // 每个面在顶点数组中的起始索引（每个面4个顶点）
    const startVertexIndex = faceIndex * 4;
    // 该面的材质索引
    const materialIndex = materialIndices[startVertexIndex] || 0;
    groups.push({
      start: faceIndex * 6, // 该面在索引数组中的起始位置
      count: 6, // 6个索引（两个三角形）
      materialIndex
    });
  }
  geometry.groups = groups;
  logger.info(`updateGeometry: ${positions.length/3} verts, ${indices.length/6} faces, ${materials.length} materials`);
  const mesh = new THREE.Mesh(geometry, materials);
  scene.add(mesh);
}
</script>

<!-- 无样式 -->