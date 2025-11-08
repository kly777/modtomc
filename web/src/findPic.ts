
import type { RGB } from "./components/data";



const BlockInfo = await loadBlocksData();


console.log("BlockInfo loaded:", BlockInfo.length, "blocks", BlockInfo[0]);

export function findPic(RGB: RGB): string | null {
        const Lab = rgbToLab(RGB.r * 255, RGB.g * 255, RGB.b * 255);
        let minDistance = Infinity;
        let closestBlock: BlockInfo | null = null;

        for (const block of BlockInfo) {
                if (block.type !== "null" || !block.full) continue;

                // 使用标准差总和作为过滤条件 (更合理的阈值)
                const stdSum = Math.sqrt(block.var_r + block.var_g + block.var_b);
                if (stdSum > 30) continue; // 基于实际数据调整阈值

                const distance = calculateColorDistance(Lab, block.lab);
                if (distance+0.3*stdSum< minDistance) {
                        minDistance = distance;
                        closestBlock = block;
                }
        }
        console.log("closestBlock", closestBlock);

        return closestBlock?.file_path || null;
}

async function loadBlocksData() {
        let blocks: any[] = [];
        try {
                const response = await fetch('/data.json');
                const jsonData = await response.json();
                blocks = jsonData;

                // 预计算每个方块的LAB值
                (blocks as any[]).forEach((block) => {
                        const lab = rgbToLab(block.avg_r, block.avg_g, block.avg_b);
                        block.lab = { L: lab.L, a: lab.a, b: lab.b };
                        block.rgb = { r: block.avg_r, g: block.avg_g, b: block.avg_b };

                        // 计算并存储标准差
                        block.std_r = Math.sqrt(block.var_r);
                        block.std_g = Math.sqrt(block.var_g);
                        block.std_b = Math.sqrt(block.var_b);
                });
        } catch (error) {
                console.error('加载JSON失败', error);
        }

        return blocks as BlockInfo[];
};

type Lab = { L: number; a: number; b: number; }
type BlockInfo = {
        file_path: string;
        file_name: string;
        type: "null" | "side" | "top" | "bottom";
        full: boolean;
        rgb: RGB
        var_r: number;
        var_g: number;
        var_b: number;
        lab: Lab
}


type rawBlockInfo = {
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
}

// RGB 转 LAB (0-255)
function rgbToLab(r: number, g: number, b: number): { L: number; a: number; b: number } {

        r = Math.min(255, Math.max(0, r));
        g = Math.min(255, Math.max(0, g));
        b = Math.min(255, Math.max(0, b));


        let rVal = r / 255
        let gVal = g / 255

        let bVal = b / 255

        rVal = rVal > 0.04045 ? Math.pow((rVal + 0.055) / 1.055, 2.4) : rVal / 12.92;
        gVal = gVal > 0.04045 ? Math.pow((gVal + 0.055) / 1.055, 2.4) : gVal / 12.92;
        bVal = bVal > 0.04045 ? Math.pow((bVal + 0.055) / 1.055, 2.4) : bVal / 12.92;

        rVal *= 100;
        gVal *= 100;
        bVal *= 100;

        const X = rVal * 0.4124564 + gVal * 0.3575761 + bVal * 0.1804375;
        const Y = rVal * 0.2126729 + gVal * 0.7151522 + bVal * 0.0721750;
        const Z = rVal * 0.0193339 + gVal * 0.1191920 + bVal * 0.9503041;

        const Xn = 95.047;
        const Yn = 100.000;
        const Zn = 108.883;

        let x = X / Xn;
        let y = Y / Yn;
        let z = Z / Zn;

        x = x > 0.008856 ? Math.pow(x, 1 / 3) : (7.787 * x) + 16 / 116;
        y = y > 0.008856 ? Math.pow(y, 1 / 3) : (7.787 * y) + 16 / 116;
        z = z > 0.008856 ? Math.pow(z, 1 / 3) : (7.787 * z) + 16 / 116;

        const L = (116 * y) - 16;
        const a = 500 * (x - y);
        const b__ = 200 * (y - z);

        return { L, a, b: b__ };
}

// CIEDE2000 算法实现 (优化数值稳定性)
function deltaE2000(lab1: Lab, lab2: Lab): number {
        const kL = 2;
        const kC = 1;
        const kH = 1;

        const C1 = Math.sqrt(lab1.a * lab1.a + lab1.b * lab1.b);
        const C2 = Math.sqrt(lab2.a * lab2.a + lab2.b * lab2.b);

        const aC = (C1 + C2) / 2;
        const aC7 = Math.pow(aC, 7);
        const twentyFivePow7 = Math.pow(25, 7);
        const G = 0.5 * (1 - Math.sqrt(aC7 / (aC7 + twentyFivePow7)));

        const a1p = (1 + G) * lab1.a;
        const a2p = (1 + G) * lab2.a;

        const C1p = Math.sqrt(a1p * a1p + lab1.b * lab1.b);
        const C2p = Math.sqrt(a2p * a2p + lab2.b * lab2.b);

        const h1p = Math.atan2(lab1.b, a1p) * (180 / Math.PI);
        const h2p = Math.atan2(lab2.b, a2p) * (180 / Math.PI);

        const dLp = lab2.L - lab1.L;
        const dCp = C2p - C1p;

        let dh = 0;
        if (C1p * C2p !== 0) {
                dh = h2p - h1p;
                if (dh > 180) dh -= 360;
                else if (dh < -180) dh += 360;
        }

        const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(dh * Math.PI / 360);

        const aL = (lab1.L + lab2.L) / 2;
        const aCp = (C1p + C2p) / 2;

        let aHp = (h1p + h2p) / 2;
        if (Math.abs(h1p - h2p) > 180) {
                aHp += 180;
        }

        const T = 1
                - 0.17 * Math.cos((aHp - 30) * Math.PI / 180)
                + 0.24 * Math.cos(2 * aHp * Math.PI / 180)
                + 0.32 * Math.cos((3 * aHp + 6) * Math.PI / 180)
                - 0.20 * Math.cos((4 * aHp - 63) * Math.PI / 180);

        const dTheta = 30 * Math.exp(-Math.pow((aHp - 275) / 25, 2));
        const aCp7 = Math.pow(aCp, 7);
        const RC = 2 * Math.sqrt(aCp7 / (aCp7 + twentyFivePow7));

        const SL = 1 + (0.015 * Math.pow(aL - 50, 2)) / Math.sqrt(20 + Math.pow(aL - 50, 2));
        const SC = 1 + 0.045 * aCp;
        const SH = 1 + 0.015 * aCp * T;

        const RT = -Math.sin(2 * dTheta * Math.PI / 180) * RC;

        return Math.sqrt(
                Math.pow(dLp / (kL * SL), 2) +
                Math.pow(dCp / (kC * SC), 2) +
                Math.pow(dHp / (kH * SH), 2) +
                RT * (dCp / (kC * SC)) * (dHp / (kH * SH))
        );
}

// 使用预计算的LAB值计算颜色距离
function calculateColorDistance(
        lab1: Lab,
        lab2: Lab
): number {
        return deltaE2000(lab1, lab2);
}