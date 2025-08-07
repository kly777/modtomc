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
import { onMounted, ref } from 'vue';

const canvas = ref<HTMLCanvasElement | null>(null);

class MCWorld {
  cellSize: number;

  faces = [
    { // left
      dir: [-1, 0, 0,],
      corners: [
        [0, 1, 0],
        [0, 0, 0],
        [0, 1, 1],
        [0, 0, 1],
      ],
    },
    { // right
      dir: [1, 0, 0,],
      corners: [
        [1, 1, 1],
        [1, 0, 1],
        [1, 1, 0],
        [1, 0, 0],
      ],
    },
    { // bottom
      dir: [0, -1, 0,],
      corners: [
        [1, 0, 1],
        [0, 0, 1],
        [1, 0, 0],
        [0, 0, 0],
      ],
    },
    { // top
      dir: [0, 1, 0,],
      corners: [
        [0, 1, 1],
        [1, 1, 1],
        [0, 1, 0],
        [1, 1, 0],
      ],
    },
    { // back
      dir: [0, 0, -1,],
      corners: [
        [1, 0, 0],
        [0, 0, 0],
        [1, 1, 0],
        [0, 1, 0],
      ],
    },
    { // front
      dir: [0, 0, 1,],
      corners: [
        [0, 0, 1],
        [1, 0, 1],
        [0, 1, 1],
        [1, 1, 1],
      ],
    },
  ];
  cell: Uint8Array<ArrayBuffer>;
  cellSliceSize: number;
  constructor(cellSize: number) {
    this.cellSize = cellSize;
    this.cellSliceSize = cellSize * cellSize;
    this.cell = new Uint8Array(cellSize * cellSize * cellSize);
  }
  getCellForVoxel(x: number, y: number, z: number) {
    const { cellSize } = this;
    const cellX = Math.floor(x / cellSize);
    const cellY = Math.floor(y / cellSize);
    const cellZ = Math.floor(z / cellSize);
    if (cellX !== 0 || cellY !== 0 || cellZ !== 0) {
      return null
    }
    return this.cell;
  }
  computeVoxelOffset(x: number, y: number, z: number) {
    const { cellSize, cellSliceSize } = this;
    const voxelX = THREE.MathUtils.euclideanModulo(x, cellSize) | 0;
    const voxelY = THREE.MathUtils.euclideanModulo(y, cellSize) | 0;
    const voxelZ = THREE.MathUtils.euclideanModulo(z, cellSize) | 0;
    return voxelY * cellSliceSize +
      voxelZ * cellSize +
      voxelX;
  }
  getBlock(x: number, y: number, z: number) {
    const cell = this.getCellForVoxel(x, y, z);
    if (!cell) {
      return 0;
    }
    const voxelOffset = this.computeVoxelOffset(x, y, z);
    return cell[voxelOffset];
  }

  setBlock(x: number, y: number, z: number, v: number) {
    let cell = this.getCellForVoxel(x, y, z);
    if (!cell) {
      return;
    }
    const voxelOffset = this.computeVoxelOffset(x, y, z);
    cell[voxelOffset] = v;
  }
  generateGeometryDataForCell(cellX: number, cellY: number, cellZ: number) {
    const { cellSize } = this;

    const positions: number[] = [];// 顶点坐标 (x,y,z)
    const normals: number[] = [];// 法线方向 (nx,ny,nz)
    const indices: number[] = [];// 索引数据 (三角形顶点顺序)
    const startX = cellX * cellSize;
    const startY = cellY * cellSize;
    const startZ = cellZ * cellSize;

    for (let y = 0; y < cellSize; ++y) {
      const voxelY = startY + y;
      for (let z = 0; z < cellSize; ++z) {
        const voxelZ = startZ + z;
        for (let x = 0; x < cellSize; ++x) {
          const voxelX = startX + x;
          const voxel = this.getBlock(voxelX, voxelY, voxelZ);
          if (voxel) {
            for (const { dir, corners } of this.faces) {
              const neighbor = this.getBlock(
                voxelX + dir[0],
                voxelY + dir[1],
                voxelZ + dir[2]);
              if (!neighbor) {
                // 这个体素在这个方向上没有邻居，因此我们需要渲染。
                const ndx = positions.length / 3;
                for (const pos of corners) {
                  positions.push(pos[0] + x, pos[1] + y, pos[2] + z);
                  normals.push(...dir);
                }
                indices.push(
                  ndx, ndx + 1, ndx + 2,
                  ndx + 2, ndx + 1, ndx + 3,
                );
              }
            }
          }
        }
      }
    }
    return {
      positions,
      normals,
      indices,
    };
  }
}

onMounted(() => {
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


  const cellSize = 128;
  const world = new MCWorld(cellSize);

  for (let y = 0; y < cellSize; ++y) {
    for (let z = 0; z < cellSize; ++z) {
      for (let x = 0; x < cellSize; ++x) {
        const height = (Math.sin(x / cellSize * Math.PI * 2) + Math.sin(z / cellSize * Math.PI * 3)) * (cellSize / 6) + (cellSize / 2);
        if (y < height) {
          world.setBlock(x, y, z, 1);
        }
      }
    }
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(173 / 256, 216 / 256, 230 / 256);


  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // 环境光
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1); // 平行光
  directionalLight.position.set(50, 100, 50); // 光照方向
  scene.add(ambientLight, directionalLight);


  const { positions, normals, indices } = world.generateGeometryDataForCell(0, 0, 0);
  const geometry = new THREE.BufferGeometry();
  const material = new THREE.MeshLambertMaterial({ color: 'green' });

  const positionNumComponents = 3;
  const normalNumComponents = 3;
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array(positions), positionNumComponents));
  geometry.setAttribute(
    'normal',
    new THREE.BufferAttribute(new Float32Array(normals), normalNumComponents));
  geometry.setIndex(indices);
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

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
    render();
  }
  animate();
})

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