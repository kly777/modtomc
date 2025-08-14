import type { PointData, position, RGB } from "./components/data";
import { rgb2lab, lab2rgb } from "./color-conversions";


// 区域增长参数定义
interface SegmentationParams {
  colorThreshold?: number; // 颜色差异阈值
  posThreshold?: number; // 空间位置差异阈值
  minClusterSize?: number; // 最小簇大小
  varianceThreshold?: number; // 方差阈值
}

export function segmentVoxels(
  voxelData: PointData[],
  params: SegmentationParams = {}
): PointData[][] {
  // 设置默认参数值
  const {
    colorThreshold = 30,
    posThreshold = 1.0,  // 默认支持直接邻接（√3）
    minClusterSize = 0, // 默认不限制最小簇大小
    varianceThreshold = 0
  } = params;

  // 记录已访问体素
  const visited: boolean[] = new Array(voxelData.length).fill(false);
  const clusters: PointData[][] = [];

  // 构建空间索引（坐标字符串 -> 体素索引数组）
  const gridIndex = new Map<string, number[]>();
  for (let i = 0; i < voxelData.length; i++) {
    const pos = voxelData[i].position;
    const key = `${pos.x},${pos.y},${pos.z}`;
    if (!gridIndex.has(key)) {
      gridIndex.set(key, []);
    }
    gridIndex.get(key)!.push(i);
  }

  // 寻找未访问种子点
  for (let i = 0; i < voxelData.length; i++) {
    if (!visited[i]) {
      console.log(`Starting new cluster from seed ${i}`);
      const cluster = growRegion(i, voxelData, visited, {
        colorThreshold,
        posThreshold,
        varianceThreshold
      }, gridIndex);  // 传入空间索引

      // 过滤过小的簇
      if (cluster.length >= minClusterSize) {
        clusters.push(cluster);
      }
    }
  }

  return clusters;
}

function growRegion(
  seedIndex: number,
  voxelData: PointData[],
  visited: boolean[],
  params: {
    colorThreshold: number;
    posThreshold: number;
    varianceThreshold?: number;
  },
  gridIndex: Map<string, number[]>  // 新增空间索引参数
): PointData[] {
  const { colorThreshold, posThreshold, varianceThreshold=1 } = params;
  // 队列存储体素索引（非对象）
  const queue: number[] = [seedIndex];
  const cluster: PointData[] = [voxelData[seedIndex]];
  visited[seedIndex] = true;

  // 使用BFS进行区域扩展
  while (queue.length > 0) {
    const currentIndex = queue.shift()!;
    const current = voxelData[currentIndex];

    // 计算搜索范围（整数坐标）
    const radius = Math.ceil(posThreshold);
    const xStart = current.position.x - radius;
    const xEnd = current.position.x + radius;
    const yStart = current.position.y - radius;
    const yEnd = current.position.y + radius;
    const zStart = current.position.z - radius;
    const zEnd = current.position.z + radius;

    // 遍历周围网格
    for (let x = xStart; x <= xEnd; x++) {
      for (let y = yStart; y <= yEnd; y++) {
        for (let z = zStart; z <= zEnd; z++) {
          const key = `${x},${y},${z}`;
          const candidateIndices = gridIndex.get(key) || [];

          for (const candidateIndex of candidateIndices) {
            if (!visited[candidateIndex]) {
              const candidate = voxelData[candidateIndex];
              // 检查颜色和位置条件
              if (isColorSimilar(current.color, candidate.color, colorThreshold) &&
                isPositionClose(current.position, candidate.position, posThreshold)&&current.variance<=varianceThreshold) {
                visited[candidateIndex] = true;
                queue.push(candidateIndex);
                cluster.push(candidate);
              }
            }
          }
        }
      }
    }
  }

  return cluster;
}

function isColorSimilar(c1: RGB, c2: RGB, threshold: number): boolean {
  const lab1 = rgb2lab(c1.r * 255, c1.g * 255, c1.b * 255);
  const lab2 = rgb2lab(c2.r * 255, c2.g * 255, c2.b * 255);
  
  // 计算Lab空间欧氏距离
  return Math.sqrt(
    Math.pow(lab1.l - lab2.l, 2) +
    Math.pow(lab1.a - lab2.a, 2) +
    Math.pow(lab1.b - lab2.b, 2)
  ) < threshold;
}

function isPositionClose(p1: position, p2: position, threshold: number): boolean {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  const dz = p1.z - p2.z;
  return (dx * dx + dy * dy + dz * dz) <= threshold * threshold; // 直接比较平方值
}

