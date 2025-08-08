import numpy as np
import trimesh as tm
import csv
import open3d as o3d
import sys

# mesh.show()

def save_voxel_data(voxel_grid, filename):
    """保存Voxel数据为CSV文件"""
    # 获取体素大小和原点
    voxel_size = voxel_grid.voxel_size
    origin = voxel_grid.origin

    # 获取所有体素
    voxels = voxel_grid.get_voxels()

    voxel_data = []

    for voxel in voxels:
        grid_index = voxel.grid_index
        # 转换为世界坐标
        coordinate = origin + grid_index * voxel_size
        # 获取颜色（如果存在）
        color = voxel.color if hasattr(voxel, "color") else [1.0, 1.0, 1.0]  # 默认白色

        voxel_data.append(
            {
                "grid_index": grid_index.tolist(),
                "coordinate": coordinate.tolist(),
                "color": color.tolist(),
            }
        )

    with open(filename, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["x", "y", "z", "r", "g", "b"])
        for data in voxel_data:
            writer.writerow(
                [
                    data["grid_index"][0],
                    data["grid_index"][1],
                    data["grid_index"][2],
                    data["color"][0],
                    data["color"][1],
                    data["color"][2],
                ]
            )


def check_mesh_colors(mesh):
    """检查网格的颜色信息"""
    print("=== 网格颜色信息 ===")

    # 检查是否有顶点颜色
    if hasattr(mesh.visual, "vertex_colors") and mesh.visual.vertex_colors is not None:
        print(f"顶点颜色: 是 (形状: {mesh.visual.vertex_colors.shape})")
        print(f"顶点颜色示例 (前5个): {mesh.visual.vertex_colors[:5]}")
    else:
        print("顶点颜色: 否")

    # 检查是否有面颜色
    if hasattr(mesh.visual, "face_colors") and mesh.visual.face_colors is not None:
        print(f"面颜色: 是 (形状: {mesh.visual.face_colors.shape})")
        print(f"面颜色示例 (前5个): {mesh.visual.face_colors[:5]}")
    else:
        print("面颜色: 否")

    # 检查是否有材质
    if hasattr(mesh.visual, "material"):
        print(f"材质: 是 (类型: {type(mesh.visual.material)})")
    else:
        print("材质: 否")

    # 检查是否有纹理
    if hasattr(mesh.visual, "uv"):
        print(
            f"纹理坐标: 是 (形状: {mesh.visual.uv.shape if mesh.visual.uv is not None else 'None'})"
        )
    else:
        print("纹理坐标: 否")

    print("==================\n")


# check_mesh_colors(mesh)


def apply_colors_from_material(mesh):
    """从材质中提取颜色并应用到顶点和面"""
    print("=== 从材质应用颜色 ===")

    # 尝试将材质和纹理转换为颜色
    try:
        # 使用to_color()方法将材质/纹理转换为颜色
        mesh.visual = mesh.visual.to_color()

        # 检查转换后的颜色信息
        if (
            hasattr(mesh.visual, "vertex_colors")
            and mesh.visual.vertex_colors is not None
        ):
            print(f"顶点颜色已应用: 是 (形状: {mesh.visual.vertex_colors.shape})")
            print(f"顶点颜色示例 (前几个): {mesh.visual.vertex_colors[:3]}")

            # 从顶点颜色计算面颜色（每个面取其顶点颜色的平均值）
            if hasattr(mesh, "faces") and mesh.faces is not None:
                face_colors = np.zeros((len(mesh.faces), 4), dtype=np.uint8)
                for i, face in enumerate(mesh.faces):
                    # 计算每个面的顶点颜色平均值
                    face_vertex_colors = mesh.visual.vertex_colors[face]
                    face_colors[i] = np.mean(face_vertex_colors, axis=0).astype(
                        np.uint8
                    )

                # 将计算出的面颜色赋值给mesh.visual.face_colors
                mesh.visual.face_colors = face_colors
                print(f"面颜色已计算: 是 (形状: {mesh.visual.face_colors.shape})")
        else:
            print("无法从材质中提取顶点颜色")

    except Exception as e:
        print(f"转换颜色时出错: {e}")

    print("==================\n")

def main(glb_path, csv_path,block_size):
    input_path = glb_path
    mesh = tm.load_mesh(input_path)


    # 从材质应用颜色到顶点和面
    apply_colors_from_material(mesh)

    # 再次检查网格颜色信息
    # check_mesh_colors(mesh)

    # 显示网格

    # mesh.export("output.ply")

    # 提取顶点数据
    points = mesh.vertices

    colors = mesh.visual.vertex_colors

    # 创建点云对象
    point_cloud = tm.PointCloud(points, colors)


    point_cloud.export("output_point_cloud.ply", file_type="ply")

    pcd = o3d.io.read_point_cloud("output_point_cloud.ply")

    # block_size = 0.030

    # 创建体素网格
    voxel_grid_1 = o3d.geometry.VoxelGrid.create_from_point_cloud(
        pcd, voxel_size=block_size
    )
    # voxel_grid_2 = o3d.geometry.VoxelGrid.create_from_point_cloud(
    #     pcd, voxel_size=block_size / 2
    # )
    # voxel_grid_4= o3d.geometry.VoxelGrid.create_from_point_cloud(
    #     pcd, voxel_size=block_size / 4
    # )

    # o3d.visualization.draw_geometries([voxel_grid_1])
    # o3d.visualization.draw_geometries([voxel_grid_2])
    # o3d.visualization.draw_geometries([voxel_grid_4])

    save_voxel_data(voxel_grid_1, csv_path)
    # save_voxel_data(voxel_grid_2, "tmp/output_voxel_grid_2.csv")
    # save_voxel_data(voxel_grid_4, "tmp/output_voxel_grid_4.csv")

if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: python process.py <input_glb_path> <output_csv_path> <block_size>")
        sys.exit(1)

    glb_path = sys.argv[1]
    csv_path = sys.argv[2]
    block_size =float(sys.argv[3])
    main(glb_path, csv_path,block_size)