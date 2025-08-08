<script setup lang="ts">
import { provide } from 'vue';
import Convert from './components/Convert.vue';
import World from './components/World.vue';
import { createEventBus, EventBusSymbol } from './eventBus';

// 创建事件总线实例并提供给所有子组件
const eventBus = createEventBus();
provide(EventBusSymbol, eventBus);
</script>

<template>
  <div>Hello {{ new Date() }}</div>
  <World />
  <Convert />
</template>

<style scoped>

</style>
