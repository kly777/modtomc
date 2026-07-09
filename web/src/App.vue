<script setup lang="ts">
import { computed, ref, watch } from "vue";
import World from "./components/World.vue";
import GLBImporter from "./components/GLBImporter.vue";
import GLBViewer from "./components/GLBViewer.vue";
import type { BlockData } from "./components/world";
import {
    FullBlockWithPureColor,
    FullBlockWithSamePic,
} from "./components/Block";
import * as THREE from "three";
import type { PointData } from "./components/data";
import { voxelizeGLB, computeAutoBlockSize, computeAutoParams, clusterVoxels, matchBlocks } from "./components/GLBUploader";
import { toggleNodeExpand } from "./colorTree";
import type { ColorTree } from "./colorTree";
import ColorTreeNode from "./components/ColorTreeNode.vue";

// === 步骤导航 ===
const currentStep = ref(1);
const totalSteps = 5;

const stepLabels = ["导入模型", "体素化", "颜色聚类", "颜色树", "Minecraft 材质"];

function goNext() {
    if (currentStep.value < totalSteps) currentStep.value++;
}
function goPrev() {
    if (currentStep.value > 1) currentStep.value--;
}

// ===导入glb模型===
const glbFile = ref<File | null>(null);

// ===体素化===
const blockSize = ref(0.02);

// rgb范围为0-1
const voxelData = ref<PointData[]>([]);

// 标记是否正在处理，防止重复触发
let isProcessing = false;
let voxelAbort: AbortController | null = null;

// voxelize helper，统一调用入口（新请求自动取消旧请求）
async function runVoxelize(file: File, size: number) {
    if (voxelAbort) voxelAbort.abort();
    voxelAbort = new AbortController();
    const ctrl = voxelAbort;
    isProcessing = true;
    try {
        const data = await voxelizeGLB(file, size, ctrl.signal);
        voxelData.value = data.voxelData;

        // 自动推断聚类参数
        if (data.voxelData.length > 0) {
            const auto = computeAutoParams(data.voxelData);
            colorThreshold.value = auto.colorThreshold;
            varianceThreshold.value = auto.varianceThreshold;
            posThreshold.value = auto.posThreshold;
            minClusterSize.value = auto.minClusterSize;
            autoExpend.value = auto.autoExpend;
            console.log(`自动参数: ct=${auto.colorThreshold} vt=${auto.varianceThreshold} pt=${auto.posThreshold} mc=${auto.minClusterSize} ae=${auto.autoExpend}`);
        }
    } catch (error: unknown) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        if (error && typeof error === 'object' && (error as any).code === 'ERR_CANCELED') return;
        console.error("GLB转换失败:", error);
    } finally {
        if (voxelAbort === ctrl) { isProcessing = false; voxelAbort = null; }
    }
}

// 监听文件变化：自动计算合适的体素大小，然后直接触发体素化
watch(glbFile, async (newFile) => {
    if (newFile) {
        try {
            const autoSize = await computeAutoBlockSize(newFile);
            const size = Math.max(0.001, Math.round(autoSize * 1000) / 1000);
            blockSize.value = size;
            console.log(`模型长边的 1/40 = ${autoSize.toFixed(4)}，设为体素大小`);
            // 直接触发体素化，不依赖 blockSize watch（避免值相同时不触发）
            await runVoxelize(newFile, size);
        } catch (error) {
            console.error("计算模型尺寸失败，使用默认体素大小:", error);
            await runVoxelize(newFile, blockSize.value);
        }
    } else {
        voxelData.value = [];
    }
});

// 监听体素大小手动调整：用户改变滑块时重新体素化
watch(blockSize, (newSize) => {
    if (glbFile.value) {
        runVoxelize(glbFile.value, newSize);
    }
});

// 用于显示的数据
const convertedBlocks = computed<BlockData[]>(() => {
    return voxelData.value.map((voxel) => ({
        position: [voxel.position.x, voxel.position.y, voxel.position.z],
        block: new FullBlockWithPureColor(
            new THREE.Color(voxel.color.r, voxel.color.g, voxel.color.b)
        ),
    }));
});

// ===聚类体素颜色 (后端) ===

const clusteredVoxelData = ref<PointData[][]>([]);
const clusterLoading = ref(false);

const colorThreshold = ref(5);
const varianceThreshold = ref(0.01);
const posThreshold = ref(1);
const minClusterSize = ref(0);

// 调用后端聚类 API（支持取消 + 防抖 + 序列号防乱序）
let clusterDebounce: ReturnType<typeof setTimeout> | null = null;
let clusterAbort: AbortController | null = null;
let clusterSeq = 0;

function triggerCluster(voxels: PointData[], ct: number, vt: number, pt: number, mc: number, ae: number) {
    if (!voxels || voxels.length === 0) return;
    if (clusterDebounce) clearTimeout(clusterDebounce);
    if (clusterAbort) clusterAbort.abort();
    clusterAbort = new AbortController();
    const ctrl = clusterAbort;
    const seq = ++clusterSeq;

    clusterDebounce = setTimeout(async () => {
        clusterLoading.value = true;
        try {
            const result = await clusterVoxels(voxels, ct, vt, pt, mc, ae, ctrl.signal);
            if (seq !== clusterSeq) return;  // 忽略过时响应

            const clusters: PointData[][] = [];
            const labelMap = new Map<number, PointData[]>();
            result.labels.forEach((label, i) => {
                const voxel = voxels[i];
                if (!voxel) return;
                if (!labelMap.has(label)) labelMap.set(label, []);
                labelMap.get(label)!.push(voxel);
            });
            labelMap.forEach((pts) => clusters.push(pts));
            clusters.sort((a, b) => b.length - a.length);
            clusteredVoxelData.value = clusters;

            // 保存 label→points 映射，供颜色树可见点计算用
            clusterPointMap.value = labelMap;

            // 后端树节点是平铺 {r,g,b,...}，ColorTreeNode 期望 {color:{r,g,b},...}
            // 补上 color 属性以兼容前端组件
            const tree = result.color_tree as Record<string, unknown>;
            function addNestedColor(node: Record<string, unknown>) {
                node.color = { r: node.r, g: node.g, b: node.b };
                const children = node.children as Record<string, unknown>[];
                if (children) children.forEach(addNestedColor);
            }
            addNestedColor(tree);
            colorTree.value = tree as unknown as ColorTree;
            updateVisiblePoints();
        } catch (e: unknown) {
            if (e instanceof DOMException && e.name === 'AbortError') return;
            if (e && typeof e === 'object' && (e as any).code === 'ERR_CANCELED') return;
            console.error("聚类失败:", e);
        } finally {
            if (clusterAbort === ctrl) { clusterLoading.value = false; clusterAbort = null; }
        }
    }, 300);
}

const clusteredBlocks = computed<BlockData[]>(() => {
    let blocks: BlockData[] = [];
    clusteredVoxelData.value.forEach((voxelDatas) => {
        const total = voxelDatas.length;
        const sum = voxelDatas.reduce(
            (acc, voxel) => {
                acc.r += voxel.color.r;
                acc.g += voxel.color.g;
                acc.b += voxel.color.b;
                return acc;
            },
            { r: 0, g: 0, b: 0 }
        );

        const averageColor = {
            r: sum.r / total,
            g: sum.g / total,
            b: sum.b / total,
        };
        voxelDatas.forEach((voxel) => {
            blocks.push({
                position: [
                    voxel.position.x,
                    voxel.position.y,
                    voxel.position.z,
                ],
                block: new FullBlockWithPureColor(
                    new THREE.Color(
                        averageColor.r,
                        averageColor.g,
                        averageColor.b
                    )
                ),
            });
        });
    });
    return blocks;
});

// 扩张聚类后，使用颜色对组再次聚类

// 后端颜色树节点类型（不含 points 数组，用 cluster_index + clusterPointMap 代替）
type BackendTreeNode = {
    r: number; g: number; b: number;
    n: number;
    children: BackendTreeNode[];
    expand: boolean;
    cluster_index?: number;
};

const clusterPointMap = ref<Map<number, PointData[]>>(new Map());

// 从后端树 + cluster map 计算可见点（替代原 colorTree.ts 的 getVisiblePoints）
function getVisibleFromBackendTree(node: BackendTreeNode, map: Map<number, PointData[]>): PointData[] {
    if (node.children.length > 0) {
        if (node.expand) {
            return node.children.flatMap(c => getVisibleFromBackendTree(c, map));
        }
        return collectDescendantPoints(node, map);
    }
    const ci = node.cluster_index;
    if (ci !== undefined && map.has(ci)) {
        return map.get(ci)!.map(p => ({
            position: p.position, color: { r: node.r, g: node.g, b: node.b }, variance: p.variance,
        }));
    }
    return [];
}

function collectDescendantPoints(node: BackendTreeNode, map: Map<number, PointData[]>): PointData[] {
    if (node.children.length === 0) {
        const ci = node.cluster_index;
        if (ci !== undefined && map.has(ci)) {
            return map.get(ci)!.map(p => ({
                position: p.position, color: { r: node.r, g: node.g, b: node.b }, variance: p.variance,
            }));
        }
        return [];
    }
    return node.children.flatMap(c => collectDescendantPoints(c, map))
        .map(p => ({ ...p, color: { r: node.r, g: node.g, b: node.b } }));
}

function updateVisiblePoints() {
    const tree = colorTree.value as unknown as BackendTreeNode | null;
    if (tree && clusterPointMap.value.size > 0) {
        kClusteredVoxelData.value = getVisibleFromBackendTree(tree, clusterPointMap.value);
    }
}

const colorTree = ref<ColorTree | null>(null);
const autoExpend = ref(1);  // 默认展开所有节点（1=几乎全部展开）
const kClusteredVoxelData = ref<PointData[]>([]);

// voxelData / 聚类参数 / 展开阈值 任一变化 → 重新聚类
watch(
    [voxelData, colorThreshold, varianceThreshold, posThreshold, minClusterSize, autoExpend],
    ([voxels, ct, vt, pt, mc, ae]) => triggerCluster(voxels, ct, vt, pt, mc, ae)
);

function toggleNode(node: ColorTree) {
    if (colorTree.value) {
        toggleNodeExpand(colorTree.value, node);
        updateVisiblePoints();
    }
}

function expandAllNodes(tree: ColorTree, expand: boolean) {
    tree.expand = expand;
    tree.children.forEach(c => expandAllNodes(c, expand));
    updateVisiblePoints();
}

// === 颜色匹配材质 (后端) ===
const mcBlocks = ref<BlockData[]>([]);
const matchLoading = ref(false);
let matchAbort: AbortController | null = null;
let matchSeq = 0;

watch(kClusteredVoxelData, (points) => {
    if (!points || points.length === 0) { mcBlocks.value = []; return; }
    if (matchAbort) matchAbort.abort();
    matchAbort = new AbortController();
    const ctrl = matchAbort;
    const seq = ++matchSeq;
    matchLoading.value = true;
    (async () => {
        try {
            const colors = points.map((p) => ({ r: p.color.r, g: p.color.g, b: p.color.b }));
            const paths = await matchBlocks(colors, ctrl.signal);
            if (seq !== matchSeq) return;
            mcBlocks.value = points.map((voxel, i) => ({
                position: [voxel.position.x, voxel.position.y, voxel.position.z] as [number, number, number],
                block: new FullBlockWithSamePic(paths[i] || ""),
            }));
        } catch (e: unknown) {
            if (e instanceof DOMException && e.name === 'AbortError') return;
            if (e && typeof e === 'object' && (e as any).code === 'ERR_CANCELED') return;
            console.error("材质匹配失败:", e);
        } finally {
            if (matchAbort === ctrl) { matchLoading.value = false; matchAbort = null; }
        }
    })();
});

// 颜色树预览（纯色方块，不用 MC 贴图）
const colorTreeBlocks = computed<BlockData[]>(() => {
    return kClusteredVoxelData.value.map((voxel) => ({
        position: [voxel.position.x, voxel.position.y, voxel.position.z],
        block: new FullBlockWithPureColor(
            new THREE.Color(voxel.color.r, voxel.color.g, voxel.color.b)
        ),
    }));
});

// 统计信息
const voxelCount = computed(() => voxelData.value.length);
const clusterCount = computed(() => clusteredVoxelData.value.length);
</script>

<template>
    <div class="app-container">
        <!-- 步骤指示器 -->
        <div class="step-bar">
            <template v-for="(label, i) in stepLabels" :key="i">
                <div
                    class="step-dot"
                    :class="{ active: currentStep === i + 1, done: currentStep > i + 1 }"
                    @click="currentStep = i + 1"
                >
                    <span class="step-num">{{ currentStep > i + 1 ? '✓' : i + 1 }}</span>
                    <span class="step-label">{{ label }}</span>
                </div>
                <div v-if="i < stepLabels.length - 1" class="step-line" :class="{ done: currentStep > i + 1 }" />
            </template>
        </div>

        <!-- 步骤内容 -->
        <div class="step-body">
            <!-- 左侧参数面板 -->
            <div class="step-sidebar">
                <!-- 步骤 1：导入模型 -->
                <div v-if="currentStep === 1" class="param-section">
                    <h3>① 导入 GLB 模型</h3>
                    <GLBImporter v-model="glbFile" />
                    <div v-if="glbFile" class="param-group">
                        <label>体素大小</label>
                        <div class="param-row">
                            <input type="number" v-model="blockSize" step="0.001" min="0.001" />
                        </div>
                        <p class="hint">自动计算 = 模型最长边 / 40，可手动调整</p>
                    </div>
                </div>

                <!-- 步骤 2：体素化结果 -->
                <div v-else-if="currentStep === 2" class="param-section">
                    <h3>② 体素化结果</h3>
                    <div class="param-group">
                        <label>体素大小</label>
                        <div class="param-row">
                            <input type="number" v-model="blockSize" step="0.001" min="0.001" />
                        </div>
                        <p class="hint">单个体素的边长（模型单位）。自动 = 模型最长边 / 40。</p>
                        <p class="hint hint-detail">⬆ 调大 → 体素更稀疏，处理更快但精度低<br>⬇ 调小 → 体素更密，精度高但处理慢</p>
                    </div>
                    <div v-if="voxelCount" class="stat-box">
                        <span>体素总数：<strong>{{ voxelCount }}</strong></span>
                    </div>
                    <div v-if="isProcessing" class="loading-box">
                        <span>⏳ 正在体素化...</span>
                    </div>
                </div>

                <!-- 步骤 3：颜色聚类 -->
                <div v-else-if="currentStep === 3" class="param-section">
                    <h3>③ 颜色聚类</h3>

                    <div class="param-group">
                        <label>颜色阈值 (Lab 距离)</label>
                        <div class="param-row">
                            <input type="number" v-model="colorThreshold" step="1" min="1" max="100" />
                            <span class="param-val">{{ colorThreshold }}</span>
                        </div>
                        <p class="hint">相邻体素视为"同色"的最大色差。Lab色彩空间的欧几里得距离。</p>
                        <p class="hint hint-detail">⬆ 调大 → 簇更少更大，颜色合并更激进<br>⬇ 调小 → 簇更多更细，保留细微色差</p>
                    </div>

                    <div class="param-group">
                        <label>空间邻接半径</label>
                        <div class="param-row">
                            <input type="number" v-model="posThreshold" step="1" min="1" max="5" />
                            <span class="param-val">{{ posThreshold }}</span>
                        </div>
                        <p class="hint">簇内相邻体素的最大网格距离。<b>1</b>=仅直接邻居，<b>2</b>=允许跳一格。</p>
                        <p class="hint hint-detail">⬆ 调大 → 簇跨越更大空间区域<br>⬇ 调小 → 簇更紧凑</p>
                    </div>

                    <div class="param-group">
                        <label>方差阈值</label>
                        <div class="param-row">
                            <input type="number" v-model="varianceThreshold" step="0.001" min="0" max="1" />
                            <span class="param-val">{{ varianceThreshold }}</span>
                        </div>
                        <p class="hint">体素颜色方差上限。只有方差 ≤ 此值的体素才能做簇种子。</p>
                        <p class="hint hint-detail">⬆ 调大 → 包含更多噪声纹理区域<br>⬇ 调小 → 只保留平滑纯色区域</p>
                    </div>

                    <div class="param-group">
                        <label>最小簇大小</label>
                        <div class="param-row">
                            <input type="number" v-model="minClusterSize" step="1" min="0" />
                            <span class="param-val">{{ minClusterSize }}</span>
                        </div>
                        <p class="hint">小于此值的簇会被丢弃（标记为噪声），用于过滤孤立体素。</p>
                        <p class="hint hint-detail">设为 <b>0</b> 不丢弃任何簇。模型大时可设 5-10 清理噪点。</p>
                    </div>

                    <div v-if="clusterCount" class="stat-box">
                        <span>簇数：<strong>{{ clusterCount }}</strong></span>
                    </div>
                    <div v-if="clusterLoading" class="loading-box">
                        <span>⏳ 正在聚类...</span>
                    </div>
                </div>

                <!-- 步骤 4：颜色树 -->
                <div v-else-if="currentStep === 4" class="param-section">
                    <h3>④ 颜色树</h3>
                    <div class="param-group">
                        <label>自动展开阈值</label>
                        <div class="param-row">
                            <input type="number" v-model="autoExpend" step="0.1" min="1" max="200" />
                        </div>
                        <p class="hint">树节点颜色距离 > 此值时自动展开。控制颜色树默认展开深度。</p>
                        <p class="hint hint-detail">设为 <b>1</b> 默认全部展开，便于查看所有颜色<br>设为 <b>50</b>+ 全部折叠，手动展开感兴趣的分组<br>点击节点或使用下方按钮可手动切换</p>
                    </div>
                    <div v-if="colorTree" class="tree-box">
                        <div class="tree-actions">
                            <button class="tree-btn" @click="expandAllNodes(colorTree, true)">全部展开</button>
                            <button class="tree-btn" @click="expandAllNodes(colorTree, false)">全部折叠</button>
                        </div>
                        <ColorTreeNode :node="colorTree" @toggle="toggleNode" />
                    </div>
                </div>

                <!-- 步骤 5：Minecraft 材质 -->
                <div v-else-if="currentStep === 5" class="param-section">
                    <h3>⑤ Minecraft 材质</h3>
                    <div v-if="mcBlocks.length" class="stat-box">
                        <span>最终方块数：<strong>{{ mcBlocks.length }}</strong></span>
                    </div>
                    <div v-if="matchLoading" class="loading-box">
                        <span>⏳ 正在匹配材质...</span>
                    </div>
                    <p class="hint">已自动匹配 Minecraft 方块贴图，完成！</p>
                </div>
            </div>

            <!-- 右侧 3D 查看器 -->
            <div class="step-viewer">
                <div v-if="currentStep === 1">
                    <div v-if="!glbFile" class="empty-state">
                        <span>📦 请先导入一个 .glb 模型文件</span>
                    </div>
                    <GLBViewer v-else :file="glbFile" :scale="1 / blockSize" />
                </div>
                <div v-else-if="currentStep === 2">
                    <div v-if="!voxelCount && isProcessing" class="empty-state">
                        <span>⏳ 体素化处理中...</span>
                    </div>
                    <div v-else-if="!voxelCount && !isProcessing" class="empty-state">
                        <span>⬆ 请先在步骤①导入模型</span>
                    </div>
                    <World v-else :blocks="convertedBlocks" />
                </div>
                <div v-else-if="currentStep === 3">
                    <World :blocks="clusteredBlocks" />
                </div>
                <div v-else-if="currentStep === 4">
                    <World :blocks="colorTreeBlocks" />
                </div>
                <div v-else-if="currentStep === 5">
                    <World :blocks="mcBlocks" />
                </div>
            </div>
        </div>

        <!-- 底部导航 -->
        <div class="step-nav">
            <button class="nav-btn prev" :disabled="currentStep === 1" @click="goPrev">
                ← 上一步
            </button>
            <div class="nav-info">
                {{ currentStep }} / {{ totalSteps }}
            </div>
            <button class="nav-btn next" :disabled="currentStep === totalSteps" @click="goNext">
                下一步 →
            </button>
        </div>
    </div>
</template>

<style scoped>
/* === 布局 === */
.app-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: #f0f2f5;
}

/* === 步骤指示条 === */
.step-bar {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px 24px;
    background: white;
    box-shadow: 0 1px 4px rgba(0,0,0,0.06);
    gap: 0;
    flex-shrink: 0;
}

.step-dot {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    position: relative;
    z-index: 1;
    min-width: 72px;
}

.step-num {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: #e0e0e0;
    color: #999;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 600;
    transition: all 0.3s;
}

.step-dot.active .step-num {
    background: #3498db;
    color: white;
    box-shadow: 0 0 0 4px rgba(52,152,219,0.25);
}

.step-dot.done .step-num {
    background: #27ae60;
    color: white;
}

.step-label {
    font-size: 11px;
    color: #999;
    white-space: nowrap;
}

.step-dot.active .step-label {
    color: #3498db;
    font-weight: 600;
}

.step-dot.done .step-label {
    color: #27ae60;
}

.step-line {
    width: 40px;
    height: 2px;
    background: #e0e0e0;
    margin: 0 2px;
    margin-bottom: 20px;
    transition: background 0.3s;
}

.step-line.done {
    background: #27ae60;
}

/* === 步骤主体 === */
.step-body {
    flex: 1;
    display: flex;
    overflow: hidden;
    gap: 0;
}

/* 左侧参数面板 */
.step-sidebar {
    width: 280px;
    min-width: 280px;
    background: white;
    padding: 16px;
    overflow-y: auto;
    box-shadow: 1px 0 4px rgba(0,0,0,0.04);
}

.param-section h3 {
    margin: 0 0 12px 0;
    font-size: 1.05rem;
    color: #2c3e50;
}

.param-group {
    margin-bottom: 14px;
}

.param-group label {
    display: block;
    font-size: 0.85rem;
    color: #666;
    margin-bottom: 4px;
    font-weight: 500;
}

.param-row {
    display: flex;
    align-items: center;
    gap: 8px;
}

.param-row input {
    width: 100%;
    max-width: 120px;
    padding: 6px 8px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 0.9rem;
    transition: border-color 0.2s;
}

.param-row input:focus {
    border-color: #3498db;
    outline: none;
    box-shadow: 0 0 0 2px rgba(52,152,219,0.15);
}

.stat-box {
    background: #eef6ff;
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 0.9rem;
    color: #2c3e50;
    margin-top: 8px;
}

.stat-box strong {
    color: #3498db;
}

.loading-box {
    background: #fff8e1;
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 0.9rem;
    color: #f39c12;
    margin-top: 8px;
    animation: pulse 1.2s ease-in-out infinite;
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
}

.tree-box {
    margin-top: 8px;
    max-height: calc(100vh - 280px);
    overflow-y: auto;
}

.tree-actions {
    display: flex;
    gap: 6px;
    margin-bottom: 8px;
}

.tree-btn {
    padding: 3px 10px;
    font-size: 0.78rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    background: #f8f9fa;
    cursor: pointer;
    transition: background 0.15s;
}

.tree-btn:hover {
    background: #e9ecef;
}

.hint {
    font-size: 0.78rem;
    color: #999;
    margin: 6px 0 0 0;
    line-height: 1.4;
}

.hint-detail {
    color: #bbb;
    font-size: 0.72rem;
    margin-top: 2px;
    padding-left: 4px;
    border-left: 2px solid #e0e0e0;
}

.param-val {
    font-size: 0.85rem;
    color: #3498db;
    font-weight: 600;
    min-width: 30px;
    text-align: right;
}

/* 右侧 3D 查看器 */
.step-viewer {
    flex: 1;
    overflow: hidden;
    background: white;
    margin: 8px;
    margin-left: 0;
    border-radius: 8px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}

.step-viewer > div {
    width: 100%;
    height: 100%;
}

.empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #bbb;
    font-size: 1.2rem;
}

/* === 底部导航 === */
.step-nav {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 24px;
    padding: 12px 24px;
    background: white;
    box-shadow: 0 -1px 4px rgba(0,0,0,0.06);
    flex-shrink: 0;
}

.nav-btn {
    padding: 8px 28px;
    border: none;
    border-radius: 6px;
    font-size: 0.95rem;
    cursor: pointer;
    transition: all 0.2s;
    font-weight: 500;
}

.nav-btn.prev {
    background: #f0f2f5;
    color: #555;
}

.nav-btn.prev:hover:not(:disabled) {
    background: #e0e4e8;
}

.nav-btn.next {
    background: #3498db;
    color: white;
}

.nav-btn.next:hover:not(:disabled) {
    background: #2980b9;
}

.nav-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
}

.nav-info {
    color: #999;
    font-size: 0.9rem;
}

/* === 响应式 === */
@media (max-width: 768px) {
    .step-body {
        flex-direction: column;
    }

    .step-sidebar {
        width: 100%;
        min-width: 0;
        max-height: 160px;
    }

    .step-dot {
        min-width: 50px;
    }

    .step-label {
        font-size: 10px;
    }

    .step-line {
        width: 20px;
    }
}
</style>
