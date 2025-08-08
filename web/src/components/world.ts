import * as THREE from "three";
import { Block, FullBlock, FullBlockWithPureColor, type Position, textureCache } from "./Block";

export class MCWorld {
    cellSize: number;

    faces = [
        {
            // left
            dir: [-1, 0, 0],
            corners: [
                [0, 1, 0],
                [0, 0, 0],
                [0, 1, 1],
                [0, 0, 1],
            ],
            face: "left" as const,
        },
        {
            // right
            dir: [1, 0, 0],
            corners: [
                [1, 1, 1],
                [1, 0, 1],
                [1, 1, 0],
                [1, 0, 0],
            ],
            face: "right" as const,
        },
        {
            // bottom
            dir: [0, -1, 0],
            corners: [
                [1, 0, 1],
                [0, 0, 1],
                [1, 0, 0],
                [0, 0, 0],
            ],
            face: "bottom" as const,
        },
        {
            // top
            dir: [0, 1, 0],
            corners: [
                [0, 1, 1],
                [1, 1, 1],
                [0, 1, 0],
                [1, 1, 0],
            ],
            face: "top" as const,
        },
        {
            // back
            dir: [0, 0, -1],
            corners: [
                [1, 0, 0],
                [0, 0, 0],
                [1, 1, 0],
                [0, 1, 0],
            ],
            face: "back" as const,
        },
        {
            // front
            dir: [0, 0, 1],
            corners: [
                [0, 0, 1],
                [1, 0, 1],
                [0, 1, 1],
                [1, 1, 1],
            ],
            face: "front" as const,
        },
    ];

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
      if (x < 0 || x >= this.cellSize || y < 0 || y >= this.cellSize || z < 0 || z >= this.cellSize) {
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
                        for (const { dir, corners, face } of this.faces) {
                            const neighbor = this.getBlock(
                                voxelX + dir[0],
                                voxelY + dir[1],
                                voxelZ + dir[2]
                            );

                            // 只渲染没有相邻方块的面
                            if (!neighbor) {
                                const ndx = positions.length / 3;

                                // 获取当前面的材质
                                const material = block.getMaterial(face);

                                // 生成唯一材质标识
                                const materialKey = this.getMaterialKey(material);
                                let materialIndex = materialCache.get(materialKey);

                                if (materialIndex === undefined) {
                                    materialIndex = materialIdCounter++;
                                    materialCache.set(materialKey, materialIndex);
                                }

                                // 添加顶点
                                for (const pos of corners) {
                                    positions.push(
                                        pos[0] + x,
                                        pos[1] + y,
                                        pos[2] + z
                                    );
                                    normals.push(...dir);

                                    // 添加UV坐标（简单映射）
                                    uvs.push(
                                        pos[0] === 0 ? 0 : 1,
                                        pos[1] === 0 ? 0 : 1
                                    );
                                    materialIndices.push(materialIndex); // 记录材质索引
                                }

                                // 添加三角形索引
                                indices.push(
                                    ndx,
                                    ndx + 1,
                                    ndx + 2,
                                    ndx + 2,
                                    ndx + 1,
                                    ndx + 3
                                );
                            }
                        }
                    }
                }
            }
        }

        return { positions, normals, indices, uvs, materialIndices, materialCache };
    }

    getMaterialKey(material: THREE.Material): string {
        if (material instanceof THREE.MeshStandardMaterial) {
            return JSON.stringify({
                type: 'standard',
                color: material.color.getHex(),
                map: material.map ? material.map.image.src : null
            });
        } else if (material instanceof THREE.MeshBasicMaterial) {
            return JSON.stringify({
                type: 'basic',
                color: material.color.getHex(),
                map: material.map ? material.map.image.src : null
            });
        }
        return JSON.stringify({ type: 'unknown' });
    }

    parseMaterialFromKey(key: string): THREE.Material {
        const data = JSON.parse(key);
        switch (data.type) {
            case 'standard':
                const mat = new THREE.MeshStandardMaterial({
                    color: data.color
                });
                if (data.map) {
                    // 从全局缓存获取纹理
                    const texture = textureCache.get(data.map);
                    if (texture) mat.map = texture;
                }
                return mat;
            case 'basic':
                return new THREE.MeshBasicMaterial({ color: data.color });
            default:
                return new THREE.MeshStandardMaterial({ color: 0xffffff });
        }
    }
}

export interface BlockData {
    position: Position;
    block: Block;
}
