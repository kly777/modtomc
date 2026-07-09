"""后端计算模块：聚类 + 颜色树 + MineCraft 材质匹配"""

import json
import logging
from pathlib import Path

import numpy as np

logger = logging.getLogger(__name__)

# ── 工具函数 ──────────────────────────────────────────


def _rgb_to_lab(rgb: np.ndarray) -> np.ndarray:
    """RGB (0-255) → CIE Lab (向量化)"""
    rgb = np.asarray(rgb, dtype=np.float64) / 255.0
    mask = rgb > 0.04045
    rgb[mask] = ((rgb[mask] + 0.055) / 1.055) ** 2.4
    rgb[~mask] = rgb[~mask] / 12.92

    M = np.array(
        [
            [0.4124564, 0.3575761, 0.1804375],
            [0.2126729, 0.7151522, 0.0721750],
            [0.0193339, 0.1191920, 0.9503041],
        ]
    )
    xyz = rgb @ M.T
    ref = np.array([0.95047, 1.0, 1.08883])
    xyz = xyz / ref
    mask2 = xyz > 0.008856
    xyz[mask2] = np.cbrt(xyz[mask2])
    xyz[~mask2] = 7.787 * xyz[~mask2] + 16.0 / 116.0

    L = 116.0 * xyz[..., 1] - 16.0
    a = 500.0 * (xyz[..., 0] - xyz[..., 1])
    b = 200.0 * (xyz[..., 1] - xyz[..., 2])
    return np.stack([L, a, b], axis=-1)


def _lab_dist_batch(lab1: np.ndarray, lab2: np.ndarray) -> np.ndarray:
    """欧几里得 Lab 距离 (CIE76)，与前端 cluster.ts 的 isColorSimilar 一致"""
    return np.sqrt(np.sum((lab1 - lab2) ** 2, axis=-1))


# ── 方块库加载 ────────────────────────────────────────

_blocks_cache: dict | None = None  # {block_name: {top, bottom, side, null, lab, std_sum}}


def _load_block_library() -> dict:
    """加载方块库，按名分组，每块有 top/bottom/side/null 纹理和代表色"""
    global _blocks_cache
    if _blocks_cache is not None:
        return _blocks_cache

    candidates = [
        Path(__file__).resolve().parent.parent / "block_gen" / "data.json",
        Path(__file__).resolve().parent.parent.parent / "web" / "public" / "data.json",
    ]
    path = next((p for p in candidates if p.exists()), candidates[0])

    with open(path) as f:
        raw = json.load(f)

    # 分组: block_name → {type: {file_path, lab, std_sum}}
    groups: dict[str, dict] = {}
    for b in raw:
        if not b.get("full"):
            continue
        fp = b["file_path"]
        bt = b.get("type", "null")
        stem = Path(fp).stem

        # 提取方块名: 去掉 _top/_side/_bottom 后缀
        for suffix in ["_top", "_bottom", "_side"]:
            if stem.endswith(suffix):
                stem = stem[: -len(suffix)]
                break

        std_sum = np.sqrt(b.get("var_r", 0) + b.get("var_g", 0) + b.get("var_b", 0))
        if std_sum > 30:
            continue
        lab = _rgb_to_lab(np.array([[b["avg_r"], b["avg_g"], b["avg_b"]]]))[0]

        if stem not in groups:
            groups[stem] = {
                "name": stem,
                "top": None, "bottom": None, "side": None, "null": None,
            }
        g = groups[stem]
        g[bt] = {"file_path": fp, "lab": lab, "std_sum": std_sum}

    # 为每个方块计算代表色（优先 null，否则 side，否则 average）
    result = {}
    for name, g in groups.items():
        entries = [g[k] for k in ["null", "side", "top", "bottom"] if g[k]]
        if not entries:
            continue
        rep = g.get("null") or g.get("side") or entries[0]
        result[name] = {
            "name": name,
            "top": g.get("top"),
            "bottom": g.get("bottom"),
            "side": g.get("side"),
            "null": g.get("null"),
            "lab": rep["lab"],
            "std_sum": rep["std_sum"],
        }

    _blocks_cache = result
    logger.info(f"Loaded {len(result)} MC blocks ({sum(1 for b in result.values() if b['top'])} with top/bottom/side)")
    return _blocks_cache


# ── 聚类 (DBSCAN 区域增长) ────────────────────────────


def cluster_voxels(
    points: list[dict],
    color_threshold: float = 30,
    variance_threshold: float = 1.0,
    pos_threshold: int = 1,
    min_cluster_size: int = 0,
) -> tuple[list[int], list[dict]]:
    """
    空间-颜色联合聚类。

    Args:
        points: [{x, y, z, r, g, b, v}, ...]  (r/g/b 0-1)
        color_threshold: Lab 空间颜色距离阈值（越大簇越少越大）
        variance_threshold: 方差过滤阈值（只允许颜色方差≤此值的体素做种子）
        pos_threshold: 空间邻接半径（1=直接邻居，2=允许跳一格）
        min_cluster_size: 最小簇大小（小于此值的簇被丢弃）

    Returns:
        labels: 每个点的簇 ID
        clusters: 簇摘要列表
    """
    n = len(points)
    if n == 0:
        return [], []

    # 提取数组
    pos = np.array([[p["x"], p["y"], p["z"]] for p in points], dtype=np.int32)
    rgb = np.array(
        [[p["r"] * 255, p["g"] * 255, p["b"] * 255] for p in points],
        dtype=np.float64,
    )
    variances = np.array([p.get("v", 0) for p in points], dtype=np.float64)
    lab = _rgb_to_lab(rgb)

    # 用方差过滤种子点
    valid_mask = variances <= variance_threshold

    if not valid_mask.any():
        return [-1] * n, []

    # scikit-learn DBSCAN: 在 Lab 空间聚类，同时强制空间邻接
    # 策略：先用 Lab 距离做 DBSCAN，然后用空间连通性拆分
    from sklearn.cluster import DBSCAN

    # 只在有效点上聚类
    valid_indices = np.where(valid_mask)[0]
    valid_lab = lab[valid_indices]
    valid_pos = pos[valid_indices]

    # DBSCAN 在 Lab 空间
    eps = color_threshold  # Lab 欧几里得距离阈值
    db = DBSCAN(eps=eps, min_samples=1, metric="euclidean", n_jobs=-1)
    valid_labels = db.fit_predict(valid_lab)

    # 对每个 DBSCAN 簇，再用空间连通性拆分子簇
    from scipy.sparse import csr_matrix
    from scipy.sparse.csgraph import connected_components

    final_labels = np.full(n, -1, dtype=int)
    cluster_id = 0
    unique_db = np.unique(valid_labels)

    # 空间邻接：曼哈顿距离 ≤ pos_threshold
    # 预生成偏移列表
    offsets = []
    rng = range(-pos_threshold, pos_threshold + 1)
    for dx in rng:
        for dy in rng:
            for dz in rng:
                if abs(dx) + abs(dy) + abs(dz) <= pos_threshold and not (dx == 0 and dy == 0 and dz == 0):
                    offsets.append((dx, dy, dz))
    for db_label in unique_db:
        if db_label == -1:
            continue
        mask = valid_labels == db_label
        idx = valid_indices[mask]
        p = pos[idx]

        coord_dict = {tuple(p[i]): i for i in range(len(p))}
        edges = []
        for i_pt, (x, y, z) in enumerate(p):
            for dx, dy, dz in offsets:
                nb = (x + dx, y + dy, z + dz)
                j = coord_dict.get(nb)
                if j is not None and j > i_pt:
                    edges.append((i_pt, j))

        if not edges:
            # 无邻居 → 每个点独立成簇
            for i_global in idx:
                final_labels[i_global] = cluster_id
                cluster_id += 1
        else:
            # 构建稀疏图 + 连通分量
            row = [e[0] for e in edges] + [e[1] for e in edges]
            col = [e[1] for e in edges] + [e[0] for e in edges]
            data = np.ones(len(row), dtype=int)
            graph = csr_matrix((data, (row, col)), shape=(len(p), len(p)))
            n_components, comp_labels = connected_components(
                graph, directed=False
            )
            for comp in range(n_components):
                comp_mask = comp_labels == comp
                local_to_global = idx[comp_mask]
                for i_global in local_to_global:
                    final_labels[i_global] = cluster_id
                cluster_id += 1

    # 将未处理的点设为独立簇
    for i in range(n):
        if final_labels[i] == -1:
            final_labels[i] = cluster_id
            cluster_id += 1

    # 构建簇摘要（同时过滤小簇）
    unique_clusters = np.unique(final_labels)
    clusters = []
    for cid in unique_clusters:
        c_mask = final_labels == cid
        size = int(c_mask.sum())
        if min_cluster_size > 0 and size < min_cluster_size:
            # 丢弃过小簇，标记点为噪声
            final_labels[c_mask] = -1
            continue
        c_rgb = rgb[c_mask] / 255.0
        clusters.append(
            {
                "index": int(cid),
                "size": size,
                "avg_r": float(c_rgb[:, 0].mean()),
                "avg_g": float(c_rgb[:, 1].mean()),
                "avg_b": float(c_rgb[:, 2].mean()),
            }
        )

    return final_labels.tolist(), clusters


# ── 颜色树 (层次聚类) ─────────────────────────────────


def build_color_tree(
    clusters: list[dict], auto_expand: float = 12.0
) -> dict:
    """
    对簇的平均颜色做层次聚类构建颜色树，等价比前端 getColorTree().

    Returns:
        color_tree: 树根节点 {r, g, b, n, children: [...], expand: bool}
    """
    if not clusters:
        return {"r": 0, "g": 0, "b": 0, "n": 0, "children": [], "expand": False}

    colors_rgb = np.array(
        [[c["avg_r"] * 255, c["avg_g"] * 255, c["avg_b"] * 255] for c in clusters],
        dtype=np.float64,
    )
    colors_lab = _rgb_to_lab(colors_rgb)
    sizes = np.array([c["size"] for c in clusters], dtype=np.int32)

    n = len(clusters)
    nodes = [
        {
            "r": float(colors_rgb[i, 0] / 255.0),
            "g": float(colors_rgb[i, 1] / 255.0),
            "b": float(colors_rgb[i, 2] / 255.0),
            "n": int(sizes[i]),
            "children": [],
            "expand": False,
            "_lab": colors_lab[i].copy(),
            "_cluster_index": i,
        }
        for i in range(n)
    ]

    # 层次合并 (agglomerative, single linkage via nearest neighbor)
    import heapq

    # 预计算颜色距离矩阵
    dist = np.zeros((n, n))
    for i in range(n):
        for j in range(i + 1, n):
            d = float(np.sqrt(np.sum((colors_lab[i] - colors_lab[j]) ** 2)))
            dist[i, j] = d
            dist[j, i] = d

    # 最小堆: (距离, i, j)
    heap = []
    for i in range(n):
        for j in range(i + 1, n):
            heapq.heappush(heap, (dist[i, j], i, j))

    active = set(range(n))

    while len(active) > 1 and heap:
        # 找最近的一对
        d, i, j = heapq.heappop(heap)
        if i not in active or j not in active:
            continue

        active.remove(i)
        active.remove(j)

        na, nb = nodes[i], nodes[j]
        new_node = {
            "r": float(
                (na["r"] * na["n"] + nb["r"] * nb["n"]) / (na["n"] + nb["n"])
            ),
            "g": float(
                (na["g"] * na["n"] + nb["g"] * nb["n"]) / (na["n"] + nb["n"])
            ),
            "b": float(
                (na["b"] * na["n"] + nb["b"] * nb["n"]) / (na["n"] + nb["n"])
            ),
            "n": na["n"] + nb["n"],
            "children": [na, nb],
            "expand": d > auto_expand,
            "_lab": (na["_lab"] * na["n"] + nb["_lab"] * nb["n"])
            / (na["n"] + nb["n"]),
        }

        new_idx = len(nodes)
        nodes.append(new_node)
        active.add(new_idx)

        # 计算新节点到其他活跃节点的距离
        for k in list(active):
            if k == new_idx:
                continue
            dk = float(
                np.sqrt(np.sum((new_node["_lab"] - nodes[k]["_lab"]) ** 2))
            )
            heapq.heappush(heap, (dk, new_idx, k))

    # 收集剩余活跃节点 + 找到最终根
    if len(active) == 1:
        root_idx = next(iter(active))
        root = nodes[root_idx]
    elif len(active) == 0 and len(nodes) > 0:
        root = nodes[-1]  # 最后合并的节点
    else:
        root = nodes[0]

    # 清除内部字段，转换 numpy 类型
    def _clean(node):
        node.pop("_lab", None)
        node["r"] = float(node["r"])
        node["g"] = float(node["g"])
        node["b"] = float(node["b"])
        node["n"] = int(node["n"])
        node["expand"] = bool(node["expand"])
        # leaf nodes keep cluster_index for frontend to map to points
        ci = node.pop("_cluster_index", None)
        if ci is not None:
            node["cluster_index"] = int(ci)
        for child in node.get("children", []):
            _clean(child)

    _clean(root)
    return root


# ── MC 材质匹配 ───────────────────────────────────────


def match_minecraft_blocks(
    colors: list[dict],
) -> list[dict]:
    """
    为每个颜色匹配最近的 Minecraft 方块，返回分面纹理。

    Args:
        colors: [{r, g, b}, ...]  (0-1 范围)

    Returns:
        [{top, bottom, side, null}, ...]  每个面独立纹理路径
    """
    block_dict = _load_block_library()  # {name: {top,bottom,side,null,lab,std_sum}}
    if not colors or not block_dict:
        return []

    block_names = list(block_dict.keys())
    block_lab = np.array([block_dict[n]["lab"] for n in block_names])  # (N, 3)
    block_std = np.array([block_dict[n]["std_sum"] for n in block_names])  # (N,)

    rgb_arr = np.array(
        [[c["r"] * 255, c["g"] * 255, c["b"] * 255] for c in colors],
        dtype=np.float64,
    )
    query_lab = _rgb_to_lab(rgb_arr)  # (M, 3)

    diff = query_lab[:, np.newaxis, :] - block_lab[np.newaxis, :, :]
    dist = np.sqrt(np.sum(diff**2, axis=-1)) + 0.3 * block_std[np.newaxis, :]

    best_idx = np.argmin(dist, axis=1)

    result = []
    for idx in best_idx:
        blk = block_dict[block_names[idx]]
        # 构建每个面的纹理路径（统一用正斜杠，浏览器 URL 只认 /）
        null_path = blk["null"]["file_path"].replace("\\", "/") if blk["null"] else None
        face_textures = {
            "top": blk["top"]["file_path"].replace("\\", "/") if blk["top"] else (null_path or ""),
            "bottom": blk["bottom"]["file_path"].replace("\\", "/") if blk["bottom"] else (null_path or ""),
            "side": blk["side"]["file_path"].replace("\\", "/") if blk["side"] else (null_path or ""),
            "all": null_path or "",  # fallback for uniform blocks
        }
        result.append(face_textures)

    return result
