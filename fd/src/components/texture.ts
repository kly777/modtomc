export function rgbToLab(rgb: RGB): Lab {
    let rVal = rgb.r / 255;
    let gVal = rgb.g / 255;
    let bVal = rgb.b / 255;

    rVal =
        rVal > 0.04045 ? Math.pow((rVal + 0.055) / 1.055, 2.4) : rVal / 12.92;
    gVal =
        gVal > 0.04045 ? Math.pow((gVal + 0.055) / 1.055, 2.4) : gVal / 12.92;
    bVal =
        bVal > 0.04045 ? Math.pow((bVal + 0.055) / 1.055, 2.4) : bVal / 12.92;

    rVal *= 100;
    gVal *= 100;
    bVal *= 100;

    const X = rVal * 0.4124564 + gVal * 0.3575761 + bVal * 0.1804375;
    const Y = rVal * 0.2126729 + gVal * 0.7151522 + bVal * 0.072175;
    const Z = rVal * 0.0193339 + gVal * 0.119192 + bVal * 0.9503041;

    const Xn = 95.047;
    const Yn = 100.0;
    const Zn = 108.883;

    let x = X / Xn;
    let y = Y / Yn;
    let z = Z / Zn;

    x = x > 0.008856 ? Math.pow(x, 1 / 3) : 7.787 * x + 16 / 116;
    y = y > 0.008856 ? Math.pow(y, 1 / 3) : 7.787 * y + 16 / 116;
    z = z > 0.008856 ? Math.pow(z, 1 / 3) : 7.787 * z + 16 / 116;

    const L = 116 * y - 16;
    const a = 500 * (x - y);
    const b__ = 200 * (y - z);

    return { L, a, b: b__ };
}

export async function loadBlocksData() {
    let blocks: any[] = [];
    try {
        const response = await fetch("/data.json");
        const jsonData = (await response.json()) as rawTextureInfo[];
        blocks = jsonData;

        // 预计算每个方块的LAB值
        blocks.forEach((block: any) => {
            const lab = rgbToLab({
                r: block.avg_r,
                g: block.avg_g,
                b: block.avg_b,
            });
            block.lab = {
                L: lab.L,
                a: lab.a,
                b: lab.b,
            };
            block.rgb = {
                r: block.avg_r,
                g: block.avg_g,
                b: block.avg_b,
            };
        });
    } catch (error) {
        console.error("加载JSON失败", error);
    }

    return blocks as TextureInfo[];
}

type rawTextureInfo = {
    file_path: string;
    file_name: string;
    type: "null" | "side" | "top" | "bottom";
    full: boolean;
    avg_r: number;
    avg_g: number;
    avg_b: number;
    var_r: number;
    var_g: number;
    var_b: number;
};
export type RGB = { r: number; g: number; b: number };
export type Lab = { L: number; a: number; b: number };

export type TextureInfo = {
    file_path: string;
    file_name: string;
    type: "null" | "side" | "top" | "bottom";
    full: boolean;
    rgb: RGB;
    var_r: number;
    var_g: number;
    var_b: number;
    lab: Lab;
};
