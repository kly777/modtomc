<template>
  <div class="world">
    <canvas id="c" ref="canvas"></canvas>
  </div>
</template>

<style scoped>
#c {
  width: 100%;
  height: 100%;
  display: block;
}

.world {
  min-width: 200px;
  min-height: 200px;
}
</style>

<script setup lang="ts">
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { inject, onMounted, ref } from 'vue';
import { EventBusSymbol, VOXEL_DATA_EVENT, type EventBus, type VoxelData } from '../eventBus';
import { MCWorld, type BlockData } from './world';

import { type Position, FullBlockWithPureColor } from './Block';

const eventBus = inject<EventBus>(EventBusSymbol)
const canvas = ref<HTMLCanvasElement | null>(null);

const cellSize = 128;
const world = new MCWorld(cellSize);

onMounted(() => {
  console.log('World.vue mounted, eventBus:', eventBus); // 添加调试日志
  if (!canvas.value) return;
  const fov = 75;
  const aspect = 2;  // the canvas default
  const near = 0.1;
  const far = 500;
  const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
  camera.position.set(128, 128, 5);
  camera.lookAt(0, 0, 0);

  const controls = new OrbitControls(camera, canvas.value);
  controls.target.set(0, 0, 0);
  controls.update();

  const renderer = new THREE.WebGLRenderer({ canvas: canvas.value });




  // 初始化测试方块
  const testBlocks: BlockData[] = [];
  for (let y = 0; y < cellSize; ++y) {
    for (let z = 0; z < cellSize / 3; ++z) {
      for (let x = 0; x < cellSize / 3; ++x) {
        const height = (Math.cos(x / cellSize * Math.PI * 2) + Math.cos(z / cellSize * Math.PI * 3)) * (cellSize / 6) + (cellSize / 2);
        if (y < height) {
          const color = new THREE.Color(
            Math.random() * 0.7 + 0.3,
            Math.random() * 0.7 + 0.3,
            Math.random() * 0.7 + 0.3
          );
          testBlocks.push({
            position: [x, y, z] as Position,
            block: new FullBlockWithPureColor(color)
          });
        }
      }
    }
  }
  world.setBlocks(testBlocks);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(173 / 256, 216 / 256, 230 / 256);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // 环境光
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1); // 平行光
  directionalLight.position.set(50, 100, 50); // 光照方向
  scene.add(ambientLight, directionalLight);

  const gridHelper = new THREE.GridHelper(cellSize, cellSize / 16); // 格点大小为 cellSize，每 1/8 cellSize 一个格子
  gridHelper.position.x = cellSize / 2;
  gridHelper.position.z = cellSize / 2;

  scene.add(gridHelper);



  // 生成初始几何体
  updateGeometry(world, scene);

  function render() {
    if (resizeRendererToDisplaySize(renderer)) {
      const canvas = renderer.domElement;
      camera.aspect = canvas.clientWidth / canvas.clientHeight;
      camera.updateProjectionMatrix();
    }
    renderer.render(scene, camera);
  }

  function animate() {
    requestAnimationFrame(animate);
    // 视锥体剔除
    const frustum = new THREE.Frustum();
    frustum.setFromProjectionMatrix(
      new THREE.Matrix4().multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse
      )
    );

    scene.traverse(object => {
      if (object instanceof THREE.Mesh) {
        object.visible = frustum.intersectsObject(object);
      }
    });

    render();
  }
  animate();

  // 订阅点云数据更新
  if (eventBus) {
    console.log('Registering VOXEL_DATA_EVENT listener'); // 添加调试日志
    eventBus.on(VOXEL_DATA_EVENT, (data: VoxelData[]) => {
      console.log('Received VOXEL_DATA_EVENT with data:', data); // 添加详细日志

      // 转换点云数据为方块
      const blocks: BlockData[] = data.map(voxel => ({
        position: [voxel.x, voxel.y, voxel.z] as Position,
        block: new FullBlockWithPureColor(
          new THREE.Color(voxel.r, voxel.g, voxel.b)
        )
      }));

      world.setBlocks(blocks);

      // 更新几何体
      scene.remove(scene.children.find(child => child.type === 'Mesh')!);
      updateGeometry(world, scene);
    });
  } else {
    console.error('EventBus not available in World.vue');
  }
});

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
    const materialIndex = materialIndices[startVertexIndex];
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


function resizeRendererToDisplaySize(renderer: THREE.WebGLRenderer) {
  const canvas = renderer.domElement;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const needResize = canvas.width !== width || canvas.height !== height;
  if (needResize) {
    renderer.setSize(width, height, false);
  }
  return needResize;
}

</script>