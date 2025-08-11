<template>
  <BaseThreeScene v-slot="{ scene }">
    <WorldContent :scene="scene" :blocks="blocks" />
  </BaseThreeScene>
</template>

<script setup lang="ts">
import BaseThreeScene from './BaseThreeScene.vue';
import WorldContent from './WorldContent.vue';
import type { BlockData } from './world';

defineProps<{
  blocks: BlockData[]
}>();
</script>