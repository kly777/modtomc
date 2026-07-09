import axios from 'axios'
import Papa from 'papaparse'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { type PointData } from './data'

export interface UploadResult {
  csvHeaders: string[]
  csvData: string[][]
  voxelData: PointData[]
}

/**
 * 加载 GLB 文件并计算模型的包围盒尺寸。
 * 返回模型在三个轴上的最大跨度，以及最长边的 1/40 作为建议体素大小。
 */
export function computeAutoBlockSize(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader()
    const url = URL.createObjectURL(file)

    loader.load(
      url,
      (gltf) => {
        URL.revokeObjectURL(url)
        const model = gltf.scene

        // 计算包围盒
        const box = new THREE.Box3()
        box.setFromObject(model)
        const size = new THREE.Vector3()
        box.getSize(size)

        // 取最长边
        const maxDim = Math.max(size.x, size.y, size.z)
        // 体素大小为长边的 1/40
        const autoSize = maxDim / 40

        // 释放模型资源
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry?.dispose()
            if (Array.isArray(child.material)) {
              child.material.forEach(m => m.dispose())
            } else {
              child.material?.dispose()
            }
          }
        })

        resolve(autoSize)
      },
      undefined,
      (error) => {
        URL.revokeObjectURL(url)
        reject(error)
      }
    )
  })
}


/**
 * 从体素数据自动推断合适的聚类参数。
 * 基于相邻体素 Lab 颜色距离的中位数和方差分布。
 */
export function computeAutoParams(points: PointData[]): {
  colorThreshold: number
  varianceThreshold: number
  autoExpend: number
} {
  const sample = points.length > 2000 ? points.slice(0, 2000) : points;
  const n = sample.length;

  // 构建坐标索引
  const grid = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const p = sample[i]!;
    grid.set(`${p.position.x},${p.position.y},${p.position.z}`, i);
  }

  // 收集相邻体素之间的 Lab 距离
  const labDistances: number[] = [];
  const variances: number[] = [];
  const dirs = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];

  for (let i = 0; i < n; i++) {
    const p = sample[i]!;
    variances.push(p.variance);
    const [lx, la, lb] = rgb2labRaw(p.color.r * 255, p.color.g * 255, p.color.b * 255);

    for (const dir of dirs) {
      const [dx, dy, dz] = dir as [number, number, number];
      const k = `${p.position.x + dx},${p.position.y + dy},${p.position.z + dz}`;
      const j = grid.get(k);
      if (j !== undefined && j > i) {
        const q = sample[j]!;
        const [qlx, qla, qlb] = rgb2labRaw(q.color.r * 255, q.color.g * 255, q.color.b * 255);
        labDistances.push(Math.sqrt((lx - qlx) ** 2 + (la - qla) ** 2 + (lb - qlb) ** 2));
      }
    }
  }

  if (labDistances.length === 0) {
    return { colorThreshold: 5, varianceThreshold: 0.01, autoExpend: 12 };
  }

  // 排序取分位数
  labDistances.sort((a, b) => a - b);
  variances.sort((a, b) => a - b);

  const p75 = labDistances[Math.floor(labDistances.length * 0.75)] ?? 5;
  const p90 = variances[Math.floor(variances.length * 0.9)] ?? 0.01;

  return {
    colorThreshold: Math.max(1, Math.round(p75)),
    varianceThreshold: Math.max(0.001, Math.round(p90 * 1000) / 1000),
    autoExpend: Math.max(2, Math.round(p75 * 3)),
  };
}

// 简化的 rgb→lab (复用已有转换)
import { rgb2lab } from '../color-conversions';
function rgb2labRaw(r: number, g: number, b: number): [number, number, number] {
  const lab = rgb2lab(r, g, b);
  return [lab.l, lab.a, lab.b];
}


/**
 * 调用后端聚类 API，返回簇标签和颜色树。
 * 等价比前端 segmentVoxels() + getColorTree()。
 */
export async function clusterVoxels(
  points: PointData[],
  colorThreshold: number,
  varianceThreshold: number,
  autoExpend: number,
  signal?: AbortSignal
): Promise<{
  labels: number[]
  clusters: { index: number; size: number; avg_r: number; avg_g: number; avg_b: number }[]
  color_tree: any
}> {
  const response = await axios.post('http://localhost:8080/api/cluster', {
    points: points.map(p => ({
      x: p.position.x, y: p.position.y, z: p.position.z,
      r: p.color.r, g: p.color.g, b: p.color.b,
      v: p.variance
    })),
    color_threshold: colorThreshold,
    variance_threshold: varianceThreshold,
    auto_expend: autoExpend,
  }, { signal })
  return response.data
}

/**
 * 调用后端材质匹配 API。
 * 等价比前端 findPic()。
 */
export async function matchBlocks(
  colors: { r: number; g: number; b: number }[],
  signal?: AbortSignal
): Promise<string[]> {
  const response = await axios.post('http://localhost:8080/api/match', { colors }, { signal })
  return response.data.blocks
}

export const voxelizeGLB = async (file: File, blockSize: number, signal?: AbortSignal): Promise<UploadResult> => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('blockSize', blockSize.toString())


  const response = await axios.post('http://localhost:8080/convert', formData, {
    responseType: 'blob',
    headers: {
      'Content-Type': 'multipart/form-data'
    },
    signal
  })

  return new Promise<UploadResult>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const result = Papa.parse<string[]>(reader.result as string)

        const csvHeaders = result.data[0] as string[]
        const csvData = result.data.slice(1) as string[][]

        const voxelData: PointData[] = []
        result.data.slice(1).forEach(row => {
          if (row.length >= 6) {
            voxelData.push({
              position: {
                x: parseInt(row[0] || '0'),
                y: parseInt(row[1] || '0'),
                z: parseInt(row[2] || '0')
              },
              color: {
                r: parseFloat(row[3] || '0'),
                g: parseFloat(row[4] || '0'),
                b: parseFloat(row[5] || '0')
              },
              variance: parseFloat(row[6] || '0')
            })
          }
        })

        resolve({
          csvHeaders,
          csvData,
          voxelData
        })
      } catch (error) {
        reject(error)
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsText(response.data)
  })
}

