<template>
  <BaseThreeScene v-slot="{ scene }">
    <GLBContent :scene="scene" :file="file" />
  </BaseThreeScene>
</template>

<script setup lang="ts">
import BaseThreeScene from './BaseThreeScene.vue';
import GLBContent from './GLBContent.vue';

defineProps<{
  file: File | null;
}>();
</script>