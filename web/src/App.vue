<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import Convert from './components/Convert.vue';
import World from './components/World.vue';
import type { BlockData } from './components/world';
import { FullBlockWithPureColor } from './components/Block';
import * as THREE from 'three';
import { compute } from 'three/tsl';
interface PointData {
  x: number
  y: number
  z: number
  r: number
  g: number
  b: number
}
// 创建事件总线实例并提供给所有子组件
// const eventBus = createEventBus();
// provide(EventBusSymbol, eventBus);
const voxelData = ref<PointData[]>([{
  x: 0,
  y: 0,
  z: 0,
  r: 0,
  g: 0.5,
  b: 0.5
}]);
const convertedBlocks = computed<BlockData[]>(() => {
  return voxelData.value.map(voxel => ({
    position: [voxel.x, voxel.y, voxel.z],
    block: new FullBlockWithPureColor(
      new THREE.Color(voxel.r, voxel.g, voxel.b)
    )
  }));
});
// watch(
//   () => voxelData,
//   (newData) => {
//     if (newData) {
//       convertedBlocks.value = newData.value.map(voxel => ({
//         position: [voxel.x, voxel.y, voxel.z],
//         block: new FullBlockWithPureColor(
//           new THREE.Color(voxel.r, voxel.g, voxel.b)
//         )
//       }));
//     }
//   },
//   { deep: true }
// );

</script>

<template>
  <div>Hello {{ new Date() }}</div>
  <div class="container">
    <div>
      <Convert v-model="voxelData" />
    </div>
    <div>
      <World :blocks="convertedBlocks" />
    </div>
  </div>

</template>

<style scoped>
.container {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  height: 100vh;
}
</style>
