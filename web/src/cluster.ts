import type { PointData } from "./components/data";
import * as THREE from "three";
import { kmeans } from "ml-kmeans";

export function clusterPoints(voxelData: PointData[], k: number): PointData[] {
  // 提取颜色样本
  const colorSamples = voxelData.map(v => [v.color.r, v.color.g, v.color.b]);

  // 执行 K-Means 聚类
  const result = kmeans(colorSamples, k, {});

  // 生成聚类后的颜色数据
  return voxelData.map((voxel, index) => {
    const centroid = result.centroids[result.clusters[index]];
    return {
      ...voxel,
      color: new THREE.Color(centroid[0], centroid[1], centroid[2])
    };
  });
}