import * as THREE from "three";


export type Position = [number, number, number];


export type FaceGeometry = {
  // 本地坐标系下的顶点位置（相对于方块中心）
  corners: [number, number, number][];
  // 面法线方向（用于光照计算）
  normal: [number, number, number];
  // UV 映射坐标（每个顶点对应一个 UV）
  uv: [number, number][];

};

export type Face = FaceGeometry & {
  material: THREE.Material;
};


export abstract class Block {
  abstract getFaces(): Face[];
  abstract getFace(faceName: string): Face;
}


type FullBlockFaces = "top" | "bottom" | "front" | "back" | "left" | "right"
/**
 * 六面体基础类（每个面独立材质）
 */
export class FullBlock extends Block {

  private static readonly faceGeometries: Record<FullBlockFaces, FaceGeometry> = {
    top: {
      corners: [[0, 1, 1], [1, 1, 1], [0, 1, 0], [1, 1, 0]],
      normal: [0, 1, 0],
      uv: [[0, 1], [1, 1], [0, 0], [1, 0]],
    },
    bottom: {
      corners: [[0, 0, 0], [1, 0, 0], [0, 0, 1], [1, 0, 1]],
      normal: [0, -1, 0],
      uv: [[0, 1], [1, 1], [0, 0], [1, 0]],
    },
    front: {
      corners: [[0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]],
      normal: [0, 0, 1],
      uv: [[0, 1], [1, 1], [0, 0], [1, 0]],
    },
    back: {
      corners: [[1, 0, 0], [0, 0, 0], [1, 1, 0], [0, 1, 0]],
      normal: [0, 0, -1],
      uv: [[0, 1], [1, 1], [0, 0], [1, 0]],
    },
    left: {
      corners: [[0, 0, 0], [0, 0, 1], [0, 1, 0], [0, 1, 1]],
      normal: [-1, 0, 0],
      uv: [[0, 1], [0, 0], [1, 1], [1, 0]],
    },
    right: {
      corners: [[1, 0, 1], [1, 0, 0], [1, 1, 1], [1, 1, 0]],
      normal: [1, 0, 0],
      uv: [[0, 1], [0, 0], [1, 1], [1, 0]],
    }
  };
  materials: Record<FullBlockFaces, THREE.Material>
  constructor(
    materials: Record<FullBlockFaces, THREE.Material>
  ) {
    super();
    this.materials = materials;
  }
  getFaces(): Face[] {
    return Object.entries(FullBlock.faceGeometries).map(([face, geometry]) => {
      return {
        ...geometry,
        material: this.materials[face as FullBlockFaces]
      }
    })
  }
  getFace(faceName: FullBlockFaces): Face {
    return {
      ...FullBlock.faceGeometries[faceName],
      material: this.materials[faceName]
    }
  }
}

/**
 * 纯色六面体（所有面使用相同颜色）
 */
export class FullBlockWithPureColor extends FullBlock {
  constructor(color: THREE.Color) {
    const material = new THREE.MeshBasicMaterial({ color });
    super({
      top: material,
      bottom: material,
      front: material,
      back: material,
      left: material,
      right: material,
    });
  }
}


export const textureCache = new Map<string, THREE.Texture>();
async function loadTexture(path: string): Promise<THREE.Texture> {
  if (textureCache.has(path)) return textureCache.get(path)!;
  const texture = await new THREE.TextureLoader().loadAsync(path);
  textureCache.set(path, texture);
  return texture;
}
/**
 * 基于图片路径的六面体
 */
export class FullBlockWithPicPath extends FullBlock {
  constructor(
    picPaths: Record<FullBlockFaces, string>
  ) {
    // 创建占位材质
    const placeholder = new THREE.MeshStandardMaterial({ color: 0xffffff });
    super({
      top: placeholder,
      bottom: placeholder,
      front: placeholder,
      back: placeholder,
      left: placeholder,
      right: placeholder
    });

    // 异步加载纹理
    this.loadMaterials(picPaths).catch(err => {
      console.error("材质加载失败:", err);
    });
  }

  private async loadMaterials(picPaths: Record<string, string>) {
    const materials = await Promise.all(
      Object.entries(picPaths).map(async ([face, path]) => {
        const texture = await loadTexture(path);
        return {
          face,
          material: new THREE.MeshStandardMaterial({ map: texture })
        };
      })
    );

    // 更新对应面的材质
    materials.forEach(({ face, material }) => {
      this.materials[face as FullBlockFaces] = material;
    });
  }
}
