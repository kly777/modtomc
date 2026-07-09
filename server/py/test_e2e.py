"""
端到端测试：体素化 → 聚类 → 颜色树 → 匹配
无需启动服务器，直接测试 compute.py 和 process.py
"""
import os
import sys
import json
import csv
from pathlib import Path

# 确保能找到模块
sys.path.insert(0, str(Path(__file__).resolve().parent))

# ── Test 1: 体素化 ───────────────────────────────────
def test_voxelize():
    from process import main as voxelize

    glb = Path(__file__).parent.parent.parent / "example" / "nld.glb"
    csv_out = Path(__file__).parent / "tmp" / "test_nld.csv"
    csv_out.parent.mkdir(parents=True, exist_ok=True)

    print("Test 1: 体素化 process.main() ...")
    voxelize(str(glb), str(csv_out), 0.02)
    assert csv_out.exists(), "CSV not generated"

    with open(csv_out) as f:
        rows = list(csv.DictReader(f))
    print(f"  ✓ 生成 {len(rows)} 个体素")
    assert len(rows) > 0, "Empty CSV"
    assert "x" in rows[0] and "r" in rows[0]
    return rows


# ── Test 2: 聚类 ─────────────────────────────────────
def test_cluster(rows):
    from compute import cluster_voxels

    points = []
    for row in rows[:2000]:  # 前 2000 点测聚类
        points.append({
            "x": int(float(row["x"])),
            "y": int(float(row["y"])),
            "z": int(float(row["z"])),
            "r": float(row["r"]),
            "g": float(row["g"]),
            "b": float(row["b"]),
            "v": float(row["variance"]),
        })

    print("\nTest 2: 聚类 cluster_voxels() ...")
    labels, clusters = cluster_voxels(points, color_threshold=5, variance_threshold=0.01)
    print(f"  ✓ labels: {len(labels)}, clusters: {len(clusters)}")
    assert len(labels) == len(points), "Labels count mismatch"
    assert len(clusters) > 0, "No clusters"

    # 每个点都有标签
    assert all(l >= 0 for l in labels), "Some points unlabeled"
    return points, labels, clusters


# ── Test 3: 颜色树 ───────────────────────────────────
def test_color_tree(clusters):
    from compute import build_color_tree

    print("\nTest 3: 颜色树 build_color_tree() ...")
    tree = build_color_tree(clusters, auto_expand=12)
    assert tree is not None
    assert "r" in tree and "g" in tree and "b" in tree
    assert "n" in tree and "children" in tree and "expand" in tree
    print(f"  ✓ root: r={tree['r']:.3f} g={tree['g']:.3f} b={tree['b']:.3f} n={tree['n']}")

    # 递归检查所有节点
    def check_node(node, path=""):
        assert isinstance(node["r"], (int, float)), f"r not number at {path}"
        assert isinstance(node["n"], int), f"n not int at {path}"
        assert isinstance(node["expand"], bool), f"expand not bool at {path}"
        if node["children"]:
            for i, child in enumerate(node["children"]):
                check_node(child, f"{path}/c{i}")
        else:
            # 叶节点应有 cluster_index
            assert "cluster_index" in node, f"leaf missing cluster_index at {path}"

    check_node(tree, "root")
    print("  ✓ 所有节点通过检查")

    # 收集所有叶节点统计
    def count_leaves(node):
        if not node["children"]:
            return 1, node["n"]
        total, n = 0, 0
        for c in node["children"]:
            l, nn = count_leaves(c)
            total += l
            n += nn
        return total, n

    leaves, total_n = count_leaves(tree)
    print(f"  ✓ 叶节点: {leaves}, 总点数: {total_n}")
    return tree


# ── Test 4: 材质匹配 ─────────────────────────────────
def test_match(rows):
    from compute import match_minecraft_blocks

    print("\nTest 4: 材质匹配 match_minecraft_blocks() ...")
    colors = []
    for row in rows[:50]:
        colors.append({"r": float(row["r"]), "g": float(row["g"]), "b": float(row["b"])})

    paths = match_minecraft_blocks(colors)
    print(f"  ✓ 返回 {len(paths)} 个匹配")
    assert len(paths) == len(colors), "Count mismatch"
    assert all(isinstance(p, str) and p for p in paths), "Empty/invalid path"
    print(f"  样例: {paths[:3]}")
    return paths


# ── Test 5: 前端逻辑模拟 ─────────────────────────────
def test_frontend_logic(rows, labels, clusters, tree):
    """模拟 App.vue 中的数据处理逻辑"""
    print("\nTest 5: 前端数据处理逻辑模拟 ...")

    # 5a. 从 labels + voxelData 构建 cluster map (triggerCluster 中的逻辑)
    print("  5a. 构建 clusterPointMap ...")
    cluster_point_map = {}
    for i, label in enumerate(labels):
        cluster_point_map.setdefault(label, []).append(i)
    print(f"      ✓ {len(cluster_point_map)} 个簇，大小: {sorted([len(v) for v in cluster_point_map.values()], reverse=True)[:5]}")

    # 5b. 模拟 getVisibleFromBackendTree (展开全部节点)
    print("  5b. 展开所有节点 → getVisibleFromBackendTree ...")
    def get_visible(node, point_map):
        if node["children"]:
            if node["expand"]:
                result = []
                for c in node["children"]:
                    result.extend(get_visible(c, point_map))
                return result
            else:
                return collect_descendants(node, point_map)
        else:
            ci = node.get("cluster_index")
            if ci is not None and ci in point_map:
                return point_map[ci]
            return []

    def collect_descendants(node, point_map):
        if not node["children"]:
            ci = node.get("cluster_index")
            return point_map.get(ci, []) if ci is not None else []
        result = []
        for c in node["children"]:
            result.extend(collect_descendants(c, point_map))
        return result

    # 测试展开根节点
    tree["expand"] = True
    visible = get_visible(tree, cluster_point_map)
    print(f"      ✓ 展开根: {len(visible)} 个可见点")
    assert len(visible) == len(rows), f"Expected {len(rows)} but got {len(visible)}"

    # 测试折叠根节点
    tree["expand"] = False
    visible_collapsed = get_visible(tree, cluster_point_map)
    print(f"      ✓ 折叠根: {len(visible_collapsed)} 个可见点 (全部用平均颜色)")
    assert len(visible_collapsed) == len(rows)

    # 5c. 模拟 toggleNode + updateVisiblePoints
    print("  5c. 模拟 toggleNode ...")
    tree["expand"] = False
    # 展开第一个子节点 (如果有)
    if tree["children"]:
        tree["expand"] = True
        child = tree["children"][0]
        child["expand"] = False  # 子节点折叠
        visible2 = get_visible(tree, cluster_point_map)
        print(f"      ✓ toggle 后可见点: {len(visible2)} (展开了根，折叠了第一个子节点)")
        # 确认不崩溃即可
        assert len(visible2) > 0 or len(rows) == 0

    # 5d. 模拟 color 属性兼容转换 (App.vue 中 addNestedColor)
    print("  5d. 添加嵌套 color 属性 (适配 ColorTreeNode.vue) ...")
    def add_nested_color(node):
        node["color"] = {"r": node["r"], "g": node["g"], "b": node["b"]}
        for child in node.get("children", []):
            add_nested_color(child)
    add_nested_color(tree)
    
    # 验证 ColorTreeNode.vue 访问方式
    assert "color" in tree, "Root missing color"
    assert isinstance(tree["color"], dict), "color not dict"
    assert "r" in tree["color"] and "g" in tree["color"] and "b" in tree["color"]
    # 验证子节点
    if tree["children"]:
        child = tree["children"][0]
        assert "color" in child, "Child missing color"
        print(f"      ✓ node.color.r = {child['color']['r']:.3f} (原 node.r = {child['r']:.3f})")

    print("  ✓ 所有前端逻辑测试通过")


# ── 主流程 ───────────────────────────────────────────
if __name__ == "__main__":
    print("=" * 60)
    print("ModToMC 端到端测试")
    print("=" * 60)

    try:
        rows = test_voxelize()
        points, labels, clusters = test_cluster(rows)
        tree = test_color_tree(clusters)
        paths = test_match(rows)
        test_frontend_logic(points, labels, clusters, tree)

        print("\n" + "=" * 60)
        print("✓ 全部通过")
        print("=" * 60)
    except Exception as e:
        print(f"\n✗ 失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
