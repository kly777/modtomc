<template>
  <div ref="container" class="three-container">
    <slot :scene="scene" :camera="camera" :renderer="renderer" />
  </div>
</template>

<script setup lang="ts">
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { sceneConfig } from '../sceneConfig';
import { ref, provide, onMounted, onBeforeUnmount } from 'vue';

// 容器引用
const container = ref<HTMLDivElement | null>(null);

// 创建场景
const scene = new THREE.Scene();
scene.background = sceneConfig.backgroundColor;

// 创建相机
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.copy(sceneConfig.cameraPosition);
camera.lookAt(sceneConfig.cameraLookAt);

// 创建渲染器
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);

// 创建控制器
const controls = new OrbitControls(camera, renderer.domElement);
controls.dampingFactor = 0.05;
controls.enableDamping = true;

// 添加灯光
const ambientLight = new THREE.AmbientLight(
  sceneConfig.ambientLight.color,
  sceneConfig.ambientLight.intensity
);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(
  sceneConfig.directionalLight.color,
  sceneConfig.directionalLight.intensity
);
directionalLight.position.copy(sceneConfig.directionalLight.position);
scene.add(directionalLight);

// 添加网格辅助线
const gridHelper = new THREE.GridHelper(
  sceneConfig.gridHelper.size,
  sceneConfig.gridHelper.divisions,
  sceneConfig.gridHelper.colorCenterLine,
  sceneConfig.gridHelper.colorGrid
);
gridHelper.position.x = sceneConfig.gridHelper.size / 2;
gridHelper.position.z = sceneConfig.gridHelper.size / 2;
scene.add(gridHelper);

// 依赖注入
provide('three', { scene, camera, renderer, controls });

// 窗口大小调整
const resizeObserver = new ResizeObserver(() => {
  if (container.value) {
    const width = container.value.clientWidth;
    const height = container.value.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }
});

// 动画循环
let animationId: number;
const animate = () => {
  animationId = requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
};

// 挂载生命周期
onMounted(() => {
  if (container.value) {
    container.value.appendChild(renderer.domElement);
    resizeObserver.observe(container.value);
    animate();
  }
});

// 卸载生命周期
onBeforeUnmount(() => {
  cancelAnimationFrame(animationId);
  resizeObserver.disconnect();
  renderer.dispose();
});

defineOptions({
  name: 'BaseThreeScene'
});
</script>

<style scoped>
.three-container {
  width: 100%;
  height: 100%;
}
</style>