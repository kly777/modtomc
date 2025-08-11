<script setup lang="ts">
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { onMounted, watch } from 'vue';

const props = defineProps<{
  scene: THREE.Scene;
  file: File | null;
}>();

let model: THREE.Object3D | null = null;

const loadModel = (file: File) => {
  // 清除旧模型
  if (model) {
    props.scene.remove(model);
    model = null;
  }

  const loader = new GLTFLoader();
  const url = URL.createObjectURL(file);

  loader.load(
    url,
    (gltf) => {
      model = gltf.scene;
      props.scene.add(model);
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
    if (model) {
      props.scene.remove(model);
      model = null;
    }
  }
});
</script>

<template>
  <!-- 无渲染组件 -->
</template>