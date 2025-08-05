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

class VoxelWorld {
  cellSize: number;
  constructor(cellSize: number) {
    this.cellSize = cellSize;
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

  const controls = new OrbitControls(camera, canvas.value);
  controls.target.set(0, 0, 0);
  controls.update();

  const renderer = new THREE.WebGLRenderer({ canvas: canvas.value });


  const cellSize = 256;
  const cell = new Uint8Array(cellSize * cellSize * cellSize);

  const scene = new THREE.Scene();
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // 环境光
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1); // 平行光
  directionalLight.position.set(50, 100, 50); // 光照方向
  scene.add(ambientLight, directionalLight);

  for (let y = 0; y < cellSize; ++y) {
    for (let z = 0; z < cellSize; ++z) {
      for (let x = 0; x < cellSize; ++x) {
        const height = (Math.sin(x / cellSize * Math.PI * 4) + Math.sin(z / cellSize * Math.PI * 6)) * 20 + cellSize / 2;
        if (height > y && height < y + 1) {
          const offset = y * cellSize * cellSize +
            z * cellSize +
            x;
          cell[offset] = 1;
        }
      }
    }
  }

  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshPhongMaterial({ color: 'green' });

  for (let y = 0; y < cellSize; ++y) {
    for (let z = 0; z < cellSize; ++z) {
      for (let x = 0; x < cellSize; ++x) {
        const offset = y * cellSize * cellSize +
          z * cellSize +
          x;
        const block = cell[offset];
        if (block === 1) {
          const mesh = new THREE.Mesh(geometry, material);
          mesh.position.set(x, y, z);
          scene.add(mesh);
        }

      }
    }
  }
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