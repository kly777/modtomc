<template>
  <BaseThreeScene v-slot="{ scene, camera }">
    <GLBContent :scene="scene" :file="file" :camera="camera" :scale="scale" />
  </BaseThreeScene>
</template>

<script setup lang="ts">
import BaseThreeScene from './BaseThreeScene.vue';
import GLBContent from './GLBContent.vue';

defineProps<{
  file: File | null;
  scale?: number; // 可选的缩放参数
}>();
</script>