import * as THREE from "three";
import { type Position, Block } from "./Block";


const textureCache = new Map<string, THREE.Texture>();

const textureLoader = new THREE.TextureLoader();
function loadTexture(path: string): THREE.Texture {
    if (textureCache.has(path)) return textureCache.get(path)!;
    const texture = textureLoader.load(path);
    // 设置纹理过滤器
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.anisotropy = 16;
    textureCache.set(path, texture);
    return texture;
}

export class MCWorld {
    cellSize: number;


    blocks: (Block | null)[];
    cellSliceSize: number;

    constructor(cellSize: number) {
        this.cellSize = cellSize;
        this.cellSliceSize = cellSize * cellSize;
        this.blocks = new Array(cellSize * cellSize * cellSize).fill(null);
    }

    computeVoxelIndex(x: number, y: number, z: number) {
        const { cellSize, cellSliceSize } = this;
        const voxelX = THREE.MathUtils.euclideanModulo(x, cellSize) | 0;
        const voxelY = THREE.MathUtils.euclideanModulo(y, cellSize) | 0;
        const voxelZ = THREE.MathUtils.euclideanModulo(z, cellSize) | 0;
        return voxelY * cellSliceSize + voxelZ * cellSize + voxelX;
    }

    getBlock(x: number, y: number, z: number): Block | null {
        // 检查坐标是否在世界范围内
        if (
            x < 0 ||
            x >= this.cellSize ||
            y < 0 ||
            y >= this.cellSize ||
            z < 0 ||
            z >= this.cellSize
        ) {
            return null;
        }
        const index = this.computeVoxelIndex(x, y, z);
        return this.blocks[index];
    }

    setBlock(x: number, y: number, z: number, block: Block) {
        const index = this.computeVoxelIndex(x, y, z);
        this.blocks[index] = block;
    }

    setBlocks(blocks: { position: Position; block: Block }[]) {
        // 清除原有数据
        this.blocks.fill(null);

        // 设置新方块
        blocks.forEach(({ position, block }) => {
            const [x, y, z] = position;
            this.setBlock(x, y, z, block);
        });
    }

    generateGeometryDataForCell(cellX: number, cellY: number, cellZ: number) {
        const { cellSize } = this;
        const positions: number[] = [];
        const normals: number[] = [];
        const indices: number[] = [];
        const uvs: number[] = [];
        const materialIndices: number[] = []; // 新增材质索引数组

        // 材质缓存（用于去重）
        const materialCache = new Map<string, number>();
        let materialIdCounter = 0;

        const startX = cellX * cellSize;
        const startY = cellY * cellSize;
        const startZ = cellZ * cellSize;

        for (let y = 0; y < cellSize; ++y) {
            const voxelY = startY + y;
            for (let z = 0; z < cellSize; ++z) {
                const voxelZ = startZ + z;
                for (let x = 0; x < cellSize; ++x) {
                    const voxelX = startX + x;
                    const block = this.getBlock(voxelX, voxelY, voxelZ);

                    if (block) {
                        // 获取方块的所有面
                        const faces = block.getFaces();
                        for (const face of faces) {
                            const dir = face.normal;
                            const neighbor = this.getBlock(
                                voxelX + dir[0],
                                voxelY + dir[1],
                                voxelZ + dir[2]
                            );

                            // 只渲染没有相邻方块的面
                            if (!neighbor) {
                                const ndx = positions.length / 3;

                                const material = face.material;

                                // 生成唯一材质标识
                                const materialKey = this.getMaterialKey(material);
                                let materialIndex = materialCache.get(materialKey);

                                if (materialIndex === undefined) {
                                    materialIndex = materialIdCounter++;
                                    materialCache.set(materialKey, materialIndex);
                                }

                                // 使用面的几何信息添加顶点
                                for (const corner of face.corners) {
                                    positions.push(
                                        corner[0] + x,
                                        corner[1] + y,
                                        corner[2] + z
                                    );
                                    normals.push(...face.normal);
                                }

                                // 添加UV坐标
                                for (const uv of face.uv) {
                                    uvs.push(uv[0], uv[1]);
                                }

                                // 添加三角形索引（每个面由两个三角形组成）
                                indices.push(
                                    ndx, ndx + 1, ndx + 2,
                                    ndx + 2, ndx + 1, ndx + 3
                                );

                                // 为每个顶点记录材质索引
                                for (let i = 0; i < 4; i++) {
                                    materialIndices.push(materialIndex);
                                }
                            }
                        }
                    }
                }
            }
        }

        return {
            positions,
            normals,
            indices,
            uvs,
            materialIndices,
            materialCache,
        };
    }

    // 每种材质生成唯一标识（基于新的材质类型）
    getMaterialKey(material: { type: "color" | "imgPath"; str: string }): string {
        return JSON.stringify(material);
    }

    parseMaterialFromKey(key: string): THREE.Material {
        const material = JSON.parse(key);
        switch (material.type) {
            case "color":
                return new THREE.MeshBasicMaterial({
                    color: new THREE.Color(material.str)
                });
            case "imgPath":

                const texture = loadTexture(material.str)
                if (texture) {
                    return new THREE.MeshBasicMaterial({ map: texture });
                } else {
                    console.warn(`Texture not found: ${material.str}`);
                    return new THREE.MeshBasicMaterial({ color: 0xffffff });
                }
            default:
                return new THREE.MeshBasicMaterial({ color: 0xffffff });
        }
    }
}

export interface BlockData {
    position: Position;
    block: Block;
}
