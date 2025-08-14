import type { PointData, RGB } from "./components/data";

/**
 * 计算 PointData 数组的平均颜色
 */
function getAverageColor(cluster: PointData[]): { r: number, g: number, b: number } {
  const sum = cluster.reduce(
    (acc, p) => {
      acc.r += p.color.r;
      acc.g += p.color.g;
      acc.b += p.color.b;
      return acc;
    },
    { r: 0, g: 0, b: 0 }
  );
  return {
    r: sum.r / cluster.length,
    g: sum.g / cluster.length,
    b: sum.b / cluster.length
  };
}

import { rgb2lab } from './color-conversions';

/**
 * 计算两个颜色之间的Lab空间欧氏距离
 */
function colorDistance(
  c1: { r: number, g: number, b: number },
  c2: { r: number, g: number, b: number }
): number {
  const lab1 = rgb2lab(c1.r * 255, c1.g * 255, c1.b * 255);
  const lab2 = rgb2lab(c2.r * 255, c2.g * 255, c2.b * 255);

  return Math.sqrt(
    Math.pow(lab1.l - lab2.l, 2) +
    Math.pow(lab1.a - lab2.a, 2) +
    Math.pow(lab1.b - lab2.b, 2)
  );
}

export type ColorTree = {
  color: RGB;
  n: number;
  points: PointData[];
  children: ColorTree[];
  expand: boolean;
};


export function getColorTree(
  data: PointData[][],
  autoExpend: number = 12
) {
  let colors: ColorTree[] = [];

  data.forEach(cluster => {
    let points: PointData[] = [];
    const averageColor = getAverageColor(cluster);
    cluster.forEach(point => {
      points.push({
        position: point.position,
        color: averageColor,
        variance: point.variance
      });

    })
    colors.push({ color: averageColor, n: cluster.length, points: points, children: [], expand: false });
  })

  let unprocessedColorTree: ColorTree[] = colors

  let tree = buildTree(unprocessedColorTree, autoExpend);
  return tree;
}


/**
 * 递归合并最近的两个颜色节点，构建颜色树
 */
function buildTree(nodes: ColorTree[],autoExpend:number): ColorTree {
  // 当只剩一个节点时终止递归
  if (nodes.length <= 1) {
    return nodes[0] || { color: { r: 0, g: 0, b: 0 }, n: 0, children: [] };
  }

  // 查找最近的两个颜色节点
  let minDistance = Infinity;
  let iMin = 0;
  let jMin = 0;

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const distance = colorDistance(nodes[i].color, nodes[j].color);
      if (distance < minDistance) {
        minDistance = distance;
        iMin = i;
        jMin = j;
      }
    }
  }

  // 提取最近的两个节点
  const [nodeA, nodeB] = [nodes[iMin], nodes[jMin]];

  // 创建合并后的父节点
  const mergedColor = {
    r: (nodeA.color.r * nodeA.n + nodeB.color.r * nodeB.n) / (nodeA.n + nodeB.n),
    g: (nodeA.color.g * nodeA.n + nodeB.color.g * nodeB.n) / (nodeA.n + nodeB.n),
    b: (nodeA.color.b * nodeA.n + nodeB.color.b * nodeB.n) / (nodeA.n + nodeB.n)
  };

  const mergedNode: ColorTree = {
    color: mergedColor,
    n: nodeA.n + nodeB.n,
    points: [...nodeA.points, ...nodeB.points],
    children: [nodeA, nodeB],
    expand: minDistance > autoExpend // 可以根据颜色距离决定
  };

  // 从数组中移除旧节点并添加新节点
  nodes.splice(Math.max(iMin, jMin), 1);
  nodes.splice(Math.min(iMin, jMin), 1);
  nodes.push(mergedNode);

  // 递归继续合并
  return buildTree(nodes, autoExpend);
}

/**
 * 获取指定层级的所有点数据
 * @param tree 颜色树根节点
 * @param targetLevel 目标层级(0表示根节点)
 * @param currentLevel 当前层级(内部递归使用)
 */
/**
 * 切换节点的展开状态
 * @param tree 颜色树节点
 * @param targetNode 目标节点（通过引用比较）
 */
export function toggleNodeExpand(tree: ColorTree, targetNode: ColorTree): boolean {
  if (tree === targetNode) {
    tree.expand = !tree.expand;
    return true;
  }

  for (const child of tree.children) {
    if (toggleNodeExpand(child, targetNode)) {
      return true;
    }
  }
  return false;
}

/**
 * 根据节点展开状态获取所有可见的点
 * @param tree 颜色树根节点
 */
export function getVisiblePoints(tree: ColorTree): PointData[] {
  // 如果当前节点是展开的，那么我们需要递归子节点（如果存在子节点）
  if (tree.expand && tree.children.length > 0) {
    let points: PointData[] = [];
    tree.children.forEach(child => {
      points = points.concat(getVisiblePoints(child));
    });
    return points;
  } else {
    // 如果没有展开，或者没有子节点，则返回当前节点的点
    return tree.points.map(point => ({
      ...point,
      color: tree.color
    }));
  }
}