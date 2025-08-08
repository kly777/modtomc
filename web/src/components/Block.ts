
type RGB = {
    r: number;
    g: number;
    b: number;
};

const textureCache = new Map<string, THREE.Texture>();
export type Position = [number, number, number];
async function loadTexture(path: string): Promise<THREE.Texture> {
    if (textureCache.has(path)) return textureCache.get(path)!;
    const texture = await new THREE.TextureLoader().loadAsync(path);
    textureCache.set(path, texture);
    return texture;
}

import * as THREE from "three";

export abstract class Block {
    pos: Position;

    constructor(pos: Position) {
        this.pos = pos;
    }
}

export type FullBlockMaterials = {
    top: THREE.Material;
    bottom: THREE.Material;
    front: THREE.Material;
    back: THREE.Material;
    left: THREE.Material;
    right: THREE.Material;
};

export class FullBlock extends Block {
    materials: FullBlockMaterials;

    constructor(pos: Position, materials: FullBlockMaterials) {
        super(pos);
        this.materials = materials;
    }

    getMaterial(direction: keyof FullBlockMaterials): THREE.Material {
        return this.materials[direction];
    }
}

export class FullBlockWithPureColor extends FullBlock {
    constructor(pos: Position, color: THREE.Color) {
        super(pos, {
            top: new THREE.MeshBasicMaterial({ color }),
            bottom: new THREE.MeshBasicMaterial({ color }),
            back: new THREE.MeshBasicMaterial({ color }),
            left: new THREE.MeshBasicMaterial({ color }),
            right: new THREE.MeshBasicMaterial({ color }),
            front: new THREE.MeshBasicMaterial({ color }),
        });
    }
}

export class FullBlockWithPicPath extends FullBlock {
    constructor(
        pos: Position,
        picPath: Record<keyof FullBlockMaterials, string>
    ) {
        // 临时占位材质（避免构造函数直接阻塞）
        super(pos, {
            top: new THREE.MeshStandardMaterial({ color: 0xffffff }), // 默认白色占位
            bottom: new THREE.MeshStandardMaterial({ color: 0xffffff }),
            front: new THREE.MeshStandardMaterial({ color: 0xffffff }),
            back: new THREE.MeshStandardMaterial({ color: 0xffffff }),
            left: new THREE.MeshStandardMaterial({ color: 0xffffff }),
            right: new THREE.MeshStandardMaterial({ color: 0xffffff }),
        });

        // 异步加载材质并更新
        this.loadMaterials(picPath)
            .then((materials) => {
                this.materials = materials; // 替换为实际加载的材质
            })
            .catch((err) => {
                console.error("材质加载失败:", err);
            });
    }

    private async loadMaterials(
        picPath: Record<keyof FullBlockMaterials, string>
    ): Promise<FullBlockMaterials> {
        // 并行加载所有纹理并生成材质
        const entries = Object.entries(picPath) as Array<
            [keyof FullBlockMaterials, string]
        >;
        const materialsEntries = await Promise.all(
            entries.map(async ([direction, path]) => {
                const texture = await loadTexture(path);
                const material = new THREE.MeshStandardMaterial({
                    map: texture,
                });
                return [direction, material] as const;
            })
        );

        // 转换为 FullBlockMaterials 对象
        return materialsEntries.reduce((acc, [direction, material]) => {
            acc[direction] = material;
            return acc;
        }, {} as FullBlockMaterials);
    }
}

export type UpAndDownBlockMaterials = {
    top: THREE.Material;
    bottom: THREE.Material;
    side: THREE.Material;
};

export class UpAndDownBlock extends FullBlock {
    constructor(pos: Position, textureInfo: UpAndDownBlockMaterials) {
        super(pos, {
            top: textureInfo.top,
            bottom: textureInfo.bottom,
            left: textureInfo.side,
            right: textureInfo.side,
            front: textureInfo.side,
            back: textureInfo.side,
        });
    }
}

export class HalfBlock extends Block {
    direction: "up" | "down" = "down";

    generateGeometry(): THREE.BoxGeometry {
        return new THREE.BoxGeometry(1, 0.5, 1);
    }

    generateMaterial(): THREE.Material {
        return new THREE.MeshStandardMaterial({
            color: 0xa0522d,
            map: new THREE.TextureLoader().load("/textures/stone_bricks.jpg"),
        });
    }
}
