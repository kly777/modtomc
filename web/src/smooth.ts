import type { PointData } from "./components/data";

export function smooth(
  voxelData: PointData[],
  options: { radius?: number; sigmaColor?: number; sigmaSpace?: number } = {}
): PointData[] {
  const radius = options.radius || 1;
  const sigmaColor = options.sigmaColor || 0.5; // 控制颜色相似性敏感度
  const sigmaSpace = options.sigmaSpace || 1.0; // 控制空间距离敏感度

  const positionMap = new Map<string, PointData>();

  // 构建位置映射
  voxelData.forEach(point => {
    const { x, y, z } = point.position;
    const key = `${x},${y},${z}`;
    positionMap.set(key, point);
  });

  return voxelData.map(point => {
    const { x, y, z } = point.position;
    let rSum = 0, gSum = 0, bSum = 0;
    let weightSum = 0;

    // 遍历邻域
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dz = -radius; dz <= radius; dz++) {
          const nx = x + dx;
          const ny = y + dy;
          const nz = z + dz;
          const neighborKey = `${nx},${ny},${nz}`;

          if (positionMap.has(neighborKey)) {
            const neighbor = positionMap.get(neighborKey)!;

            // 空间距离
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            const spaceWeight = Math.exp(-dist * dist / (2 * sigmaSpace * sigmaSpace));

            // 颜色差异
            const colorDiff = Math.sqrt(
              (point.color.r - neighbor.color.r) ** 2 +
              (point.color.g - neighbor.color.g) ** 2 +
              (point.color.b - neighbor.color.b) ** 2
            );
            const colorWeight = Math.exp(-colorDiff * colorDiff / (2 * sigmaColor * sigmaColor));

            const weight = spaceWeight * colorWeight;

            rSum += neighbor.color.r * weight;
            gSum += neighbor.color.g * weight;
            bSum += neighbor.color.b * weight;
            weightSum += weight;
          }
        }
      }
    }

    if (weightSum > 0) {
      return {
        ...point,
        color: {
          r: rSum / weightSum,
          g: gSum / weightSum,
          b: bSum / weightSum
        }
      };
    }

    return point;
  });
}