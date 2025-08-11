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
  material: { type: "color" | "imgPath"; str: string };
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
  materials: Record<FullBlockFaces, { type: "color" | "imgPath"; str: string }>
  constructor(
    materials: Record<FullBlockFaces, { type: "color" | "imgPath"; str: string }>
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
    const colorStr = `#${color.getHexString()}`;
    super({
      top: { type: "color", str: colorStr },
      bottom: { type: "color", str: colorStr },
      front: { type: "color", str: colorStr },
      back: { type: "color", str: colorStr },
      left: { type: "color", str: colorStr },
      right: { type: "color", str: colorStr },
    });
  }
}



/**
 * 基于图片路径的六面体
 */
export class FullBlockWithPicPath extends FullBlock {
  constructor(
    picPaths: Record<FullBlockFaces, string>
  ) {
    super({
      top: { type: "imgPath", str: picPaths.top },
      bottom: { type: "imgPath", str: picPaths.bottom },
      front: { type: "imgPath", str: picPaths.front },
      back: { type: "imgPath", str: picPaths.back },
      left: { type: "imgPath", str: picPaths.left },
      right: { type: "imgPath", str: picPaths.right }
    });
  }
}

export class FullBlockWithSamePic extends FullBlockWithPicPath {
  constructor(picPath: string) {
    super({
      top: picPath,
      bottom: picPath,
      front: picPath,
      back: picPath,
      left: picPath,
      right: picPath
    });
  }
}