import type { PointData } from "./components/data";
import * as THREE from "three";
import { DBSCAN } from 'density-clustering';
import { rgb2lab, lab2rgb } from './color-conversions';

// 计算欧几里得距离的辅助函数
function euclideanDistance(a: number[], b: number[]): number {
  return Math.sqrt(
    a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0)
  );
}

export function clusterPoints(voxelData: PointData[], epsilon: number = 5, minPoints: number = 5): PointData[] {
  // 提取颜色样本并转换为Lab颜色空间
  const labSamples = voxelData.map(v => {
    const lab = rgb2lab(v.color.r * 255, v.color.g * 255, v.color.b * 255);
    return [lab.l, lab.a, lab.b];
  });

  // 使用DBSCAN进行聚类
  const dbscan = new DBSCAN();
  const clusters = dbscan.run(labSamples, epsilon, minPoints);

  // 计算每个聚类的平均颜色和Lab空间质心
  const clusterColors: THREE.Color[] = [];
  const clusterCentroidsLab: [number, number, number][] = []; // 每个聚类的Lab质心

  clusters.forEach(cluster => {
    if (cluster.length === 0) return;

    let sumL = 0, sumA = 0, sumB = 0;
    cluster.forEach(index => {
      sumL += labSamples[index][0];
      sumA += labSamples[index][1];
      sumB += labSamples[index][2];
    });

    const avgL = sumL / cluster.length;
    const avgA = sumA / cluster.length;
    const avgB = sumB / cluster.length;

    // 存储Lab质心
    clusterCentroidsLab.push([avgL, avgA, avgB]);

    // 转换回RGB并存储颜色
    const rgb = lab2rgb(avgL, avgA, avgB);
    clusterColors.push(new THREE.Color(rgb.r / 255, rgb.g / 255, rgb.b / 255));
  });

  // 应用聚类后的颜色
  return voxelData.map((voxel, index) => {
    let clusterId = -1;
    let minDistance = Infinity;

    // 查找当前点所属的聚类
    for (let i = 0; i < clusters.length; i++) {
      if (clusters[i].includes(index)) {
        clusterId = i;
        break;
      }
    }

    // 如果是噪声点，查找最近的聚类
    if (clusterId === -1) {
      const pointLab = labSamples[index];

      for (let j = 0; j < clusterCentroidsLab.length; j++) {
        const centroid = clusterCentroidsLab[j];
        const distance = euclideanDistance(pointLab, centroid);

        if (distance < minDistance) {
          minDistance = distance;
          clusterId = j;
        }
      }

      // 如果最小距离超出阈值，保留原始颜色
      if (minDistance > epsilon * 2) {
        clusterId = -1;
      }
    }

    return {
      ...voxel,
      color: clusterId >= 0 ? clusterColors[clusterId] : voxel.color
    };
  });
}