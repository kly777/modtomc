<template>
  <div class="tree-node">
    <div class="node-header">
      <button @click="toggleExpand">{{ node.expand ? '折叠' : '展开' }}</button>
      <div class="color-box" :style="{ backgroundColor: `rgb(${nodeColor.r}, ${nodeColor.g}, ${nodeColor.b})` }"></div>
      <span>节点 ({{ node.n }} 点)</span>
    </div>
    <div v-if="node.expand && node.children.length" class="node-children">
      <ColorTreeNode v-for="(child, index) in node.children" :key="index" :node="child" @toggle="onChildToggle" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ColorTree } from '../colorTree';

const props = defineProps<{
  node: ColorTree
}>();

const emit = defineEmits(['toggle']);

const nodeColor = computed(() => ({
  r: Math.floor(props.node.color.r * 255),
  g: Math.floor(props.node.color.g * 255),
  b: Math.floor(props.node.color.b * 255)
}));

function toggleExpand() {
  emit('toggle', props.node);
}

function onChildToggle(childNode: ColorTree) {
  emit('toggle', childNode);
}
</script>

<style scoped>
.tree-node {
  margin-left: 20px;
  padding: 5px 0;
}

.node-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.color-box {
  width: 20px;
  height: 20px;
  border: 1px solid #999;
}

.node-children {
  margin-left: 20px;
  border-left: 1px dashed #ccc;
  padding-left: 10px;
}
</style>