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

/**
 * 计算两个颜色之间的欧氏距离
 */
function colorDistance(
  c1: { r: number, g: number, b: number },
  c2: { r: number, g: number, b: number }
): number {
  return Math.sqrt(
    (c1.r - c2.r) ** 2 +
    (c1.g - c2.g) ** 2 +
    (c1.b - c2.b) ** 2
  );
}

type ColorTree = {
  color: RGB;
  n: number;
  points: PointData[];
  children: ColorTree[];
  expand: boolean;
};


export function getColorTree(
  data: PointData[][],
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

  let tree = buildTree(unprocessedColorTree);
  return tree;
}


/**
 * 递归合并最近的两个颜色节点，构建颜色树
 */
function buildTree(nodes: ColorTree[]): ColorTree {
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
    expand: false // 可以根据颜色距离决定
  };

  // 从数组中移除旧节点并添加新节点
  nodes.splice(Math.max(iMin, jMin), 1);
  nodes.splice(Math.min(iMin, jMin), 1);
  nodes.push(mergedNode);

  // 递归继续合并
  return buildTree(nodes);
}

/**
 * 获取指定层级的所有点数据
 * @param tree 颜色树根节点
 * @param targetLevel 目标层级(0表示根节点)
 * @param currentLevel 当前层级(内部递归使用)
 */
export function getPointsAtLevel(
  tree: ColorTree,
  targetLevel: number,
  currentLevel: number = 0
): PointData[] {
  if (currentLevel === targetLevel) {
    console.log("getPointsAtLevel", tree.points);
    tree.points.map(point => {
      point.color = tree.color
    })
    return tree.points;
  }

  let points: PointData[] = [];
  for (const child of tree.children) {
    points = points.concat(getPointsAtLevel(child, targetLevel, currentLevel + 1));
  }
  return points;
}