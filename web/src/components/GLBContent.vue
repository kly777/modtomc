<script setup lang="ts">
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { watch } from 'vue';

const props = defineProps<{
  scene: THREE.Scene;
  camera: THREE.Camera;
  file: File | null;
  scale?: number; // 可选的缩放参数
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

      // 3. 应用缩放（保持原有逻辑）
      const scaleValue = props.scale || 1;
      model.scale.set(scaleValue, scaleValue, scaleValue);
      // 1. 计算包围盒
      const box = new THREE.Box3();
      box.setFromObject(model);
      // 2. 获取最小点并计算对齐位置
      const { min } = box;
      console.log('模型包围盒最小点:', min);
      model.position.set(-min.x, -min.y, -min.z);


      // 4. 添加到场景
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