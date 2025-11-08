import axios from 'axios'
import Papa from 'papaparse'
import { type PointData } from './data'

export interface UploadResult {
  csvHeaders: string[]
  csvData: string[][]
  voxelData: PointData[]
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

