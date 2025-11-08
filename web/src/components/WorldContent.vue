<template>
  <!-- 无渲染组件 -->
</template>

<script setup lang="ts">
import * as THREE from 'three';
import { onMounted, watch } from 'vue';
import { MCWorld, type BlockData } from './world';

const props = defineProps<{
  scene: THREE.Scene;
  blocks: BlockData[];
}>();

const cellSize = 128;
const world = new MCWorld(cellSize);

onMounted(() => {
  // 生成初始几何体
  updateGeometry(world, props.scene);
});

watch(() => props.blocks, (newBlocks) => {
  world.setBlocks(newBlocks);
  props.scene.remove(props.scene.children.find(child => child.type === 'Mesh')!);
  updateGeometry(world, props.scene);
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
  // geometry 的不同部分与材质的对应关系通过 材质索引（materialIndex） 和 几何分组（geometry.groups） 实现
  const mesh = new THREE.Mesh(geometry, materials);
  scene.add(mesh);
}
</script>

<!-- 无样式 -->