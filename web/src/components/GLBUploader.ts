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


export const voxelizeGLB = async (file: File,blockSize:number): Promise<UploadResult> => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('blockSize', blockSize.toString())


  const response = await axios.post('http://localhost:8080/convert', formData, {
    responseType: 'blob',
    headers: {
      'Content-Type': 'multipart/form-data'
    }
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

