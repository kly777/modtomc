<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const props = defineProps<{
  file: File | null;
}>();

const viewerContainer = ref<HTMLDivElement | null>(null);
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let renderer: THREE.WebGLRenderer | null = null;
let model: THREE.Object3D | null = null;

const loadModel = (file: File) => {
  if (!viewerContainer.value) return;

  // 清除旧模型
  if (model && scene) {
    scene.remove(model);
    model = null;
  }

  const loader = new GLTFLoader();
  const url = URL.createObjectURL(file);

  loader.load(
    url,
    (gltf) => {
      model = gltf.scene;
      if (scene) {
        scene.add(model);
      }
      URL.revokeObjectURL(url);
    },
    undefined,
    (error) => {
      console.error('加载模型失败:', error);
      URL.revokeObjectURL(url);
    }
  );
};

watch(() => props.file, (newFile) => {
  if (newFile) {
    loadModel(newFile);
  } else {
    // 清除模型
    if (model && scene) {
      scene.remove(model);
      model = null;
    }
  }
});

onMounted(() => {
  if (viewerContainer.value) {
    // 初始化场景
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff); // 改为白色背景

    // 初始化相机
    camera = new THREE.PerspectiveCamera(75, viewerContainer.value.clientWidth / viewerContainer.value.clientHeight, 0.1, 1000);
    camera.position.set(0, 0, 5); // 设置初始相机位置

    // 初始化渲染器
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(viewerContainer.value.clientWidth, viewerContainer.value.clientHeight);
    viewerContainer.value.appendChild(renderer.domElement);

    // 添加轨道控制器
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.dampingFactor = 0.05;

    // 添加灯光
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(0, 1, 1);
    scene.add(directionalLight);

    // 动画循环
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update(); // 更新控制器
      if (renderer && scene && camera) {
        renderer.render(scene, camera);
      }
    };
    animate();
  }
});
</script>

<template>
  <div ref="viewerContainer" class="glb-viewer"></div>
</template>

<style scoped>
.glb-viewer {
  width: 100%;
  height: 100%;
}
</style>