from multiprocessing import process
import time
import numpy as np
import trimesh as tm
import open3d as o3d
import sys


def save_voxel_data(voxel_grid, digital_voxel_grid, filename):
    # 获取粗体素和精细体素
    coarse_voxels = voxel_grid.get_voxels()
    fine_voxels = digital_voxel_grid.get_voxels()

    # 创建精细体素索引映射 (快速查找)
    fine_voxel_dict = {}
    for voxel in fine_voxels:
        # 计算所属的粗体素坐标 (每个粗体素包含4x4x4精细体素)
        coarse_index = tuple(i // 4 for i in voxel.grid_index)
        if coarse_index not in fine_voxel_dict:
            fine_voxel_dict[coarse_index] = []
        if hasattr(voxel, "color"):
            fine_voxel_dict[coarse_index].append(voxel.color)
        else:
            fine_voxel_dict[coarse_index].append([1.0, 1.0, 1.0])

    # 准备输出数据
    grid_indices = []
    colors = []
    variances = []

    for voxel in coarse_voxels:
        grid_index = tuple(voxel.grid_index)
        grid_indices.append(grid_index)

        # 获取粗体素颜色
        if hasattr(voxel, "color"):
            colors.append(voxel.color)
        else:
            colors.append([1.0, 1.0, 1.0])

        # 计算颜色方差 (使用精细体素)
        if grid_index in fine_voxel_dict:
            fine_colors = np.array(fine_voxel_dict[grid_index])
            # 计算每个通道的方差，然后取平均值
            channel_variances = np.var(fine_colors, axis=0)
            variance = np.mean(channel_variances)
            variances.append(variance)
        else:
            variances.append(0.0)  # 没有精细体素时方差为0

    # 转换为NumPy数组
    grid_indices = np.array(grid_indices)
    colors = np.array(colors)
    variances = np.array(variances).reshape(-1, 1)  # 转换为列向量

    # 合并数据: 坐标 + 颜色 + 方差
    data = np.hstack((grid_indices, colors, variances))

    # 使用numpy写入CSV（包含表头）
    header = "x,y,z,r,g,b,variance"
    np.savetxt(
        filename,
        data,
        fmt="%.10f",  # 保留6位小数
        delimiter=",",  # 逗号分隔符
        header=header,  # 写入表头
        comments="",  # 避免添加注释符号
    )


# def check_mesh_colors(mesh):
#     """检查网格的颜色信息"""
#     print("=== 网格颜色信息 ===")

#     # 检查是否有顶点颜色
#     if hasattr(mesh.visual, "vertex_colors") and mesh.visual.vertex_colors is not None:
#         print(f"顶点颜色: 是 (形状: {mesh.visual.vertex_colors.shape})")
#         print(f"顶点颜色示例 (前5个): {mesh.visual.vertex_colors[:5]}")
#     else:
#         print("顶点颜色: 否")

#     # 检查是否有面颜色
#     if hasattr(mesh.visual, "face_colors") and mesh.visual.face_colors is not None:
#         print(f"面颜色: 是 (形状: {mesh.visual.face_colors.shape})")
#         print(f"面颜色示例 (前5个): {mesh.visual.face_colors[:5]}")
#     else:
#         print("面颜色: 否")

#     # 检查是否有材质
#     if hasattr(mesh.visual, "material"):
#         print(f"材质: 是 (类型: {type(mesh.visual.material)})")
#     else:
#         print("材质: 否")

#     # 检查是否有纹理
#     if hasattr(mesh.visual, "uv"):
#         print(
#             f"纹理坐标: 是 (形状: {mesh.visual.uv.shape if mesh.visual.uv is not None else 'None'})"
#         )
#     else:
#         print("纹理坐标: 否")

#     print("==================\n")


# check_mesh_colors(mesh)


def apply_colors_from_material(mesh):
    """从材质中提取颜色并应用到顶点和面"""
    # print("=== 从材质应用颜色 ===")

    # 尝试将材质和纹理转换为颜色
    try:
        # 使用to_color()方法将材质/纹理转换为颜色
        mesh.visual = mesh.visual.to_color()

        # 检查转换后的颜色信息
        if (
            hasattr(mesh.visual, "vertex_colors")
            and mesh.visual.vertex_colors is not None
        ):
            # print(f"顶点颜色已应用: 是 (形状: {mesh.visual.vertex_colors.shape})")
            # print(f"顶点颜色示例 (前几个): {mesh.visual.vertex_colors[:3]}")

            # 从顶点颜色计算面颜色（每个面取其顶点颜色的平均值）
            if hasattr(mesh, "faces") and mesh.faces is not None:
                # face_colors = np.zeros((len(mesh.faces), 4), dtype=np.uint8)
                # for i, face in enumerate(mesh.faces):
                #     # 计算每个面的顶点颜色平均值
                #     face_vertex_colors = mesh.visual.vertex_colors[face]
                #     face_colors[i] = np.mean(face_vertex_colors, axis=0).astype(
                #         np.uint8
                #     )
                # vertex_colors = mesh.visual.vertex_colors[mesh.faces]  # 形状: (F, 3, 4)
                # face_colors = np.mean(vertex_colors, axis=1).astype(
                #     np.uint8
                # )  # 形状: (F, 4)

                # face_colors = np.mean(
                #     mesh.visual.vertex_colors[mesh.faces], axis=1
                # ).astype(np.uint8)

                vertex_colors = mesh.visual.vertex_colors
                faces = mesh.faces
                face_colors = vertex_colors[faces].mean(axis=1).astype(np.uint8)

                # 将计算出的面颜色赋值给mesh.visual.face_colors
                mesh.visual.face_colors = face_colors
                # print(f"面颜色已计算: 是 (形状: {mesh.visual.face_colors.shape})")
        else:
            print("无法从材质中提取顶点颜色")

    except Exception as e:
        print(f"转换颜色时出错: {e}")

    # print("==================\n")


def main(glb_path, csv_path, block_size):
    start_total = time.time()

    # 1. 加载网格计时
    start_load = time.time()
    input_path = glb_path
    mesh = tm.load_mesh(input_path, process=False)
    load_time = time.time() - start_load

    # 2. 颜色处理计时
    start_color = time.time()
    apply_colors_from_material(mesh)
    color_time = time.time() - start_color

    # 3. 点云生成计时
    start_pcd = time.time()
    points = mesh.vertices
    pcd = o3d.geometry.PointCloud()
    pcd.points = o3d.utility.Vector3dVector(points)
    pcd_time = time.time() - start_pcd

    # 4. 颜色处理计时
    start_color2 = time.time()
    if hasattr(mesh, "visual") and mesh.visual is not None:
        colors = mesh.visual.vertex_colors[:, :3].astype(np.float32) / 255.0
    else:
        colors = np.ones((len(points), 3), dtype=np.float32)
    pcd.colors = o3d.utility.Vector3dVector(colors)
    color2_time = time.time() - start_color2

    # 5. 体素网格计时
    start_voxel = time.time()
    voxel_grid_1 = o3d.geometry.VoxelGrid.create_from_point_cloud(
        pcd, voxel_size=block_size
    )
    voxel_grid_2 = o3d.geometry.VoxelGrid.create_from_point_cloud(
        pcd, voxel_size=block_size / 4
    )
    voxel_time = time.time() - start_voxel

    # 6. 保存数据计时
    start_save = time.time()
    save_voxel_data(voxel_grid_1, voxel_grid_2, csv_path)
    save_time = time.time() - start_save

    # 输出各阶段耗时
    total_time = time.time() - start_total
    print("\n=== 执行时间分析 ===")
    print(f"网格加载: {load_time:.2f}s ({load_time / total_time:.1%})")
    print(f"颜色处理: {color_time:.2f}s ({color_time / total_time:.1%})")
    print(f"点云生成: {pcd_time:.2f}s ({pcd_time / total_time:.1%})")
    print(f"颜色应用: {color2_time:.2f}s ({color2_time / total_time:.1%})")
    print(f"体素生成: {voxel_time:.2f}s ({voxel_time / total_time:.1%})")
    print(f"数据保存: {save_time:.2f}s ({save_time / total_time:.1%})")
    print(f"总耗时: {total_time:.2f}s")
    print("==================\n")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print(
            "Usage: python process.py <input_glb_path> <output_csv_path> <block_size>"
        )
        sys.exit(1)

    glb_path = sys.argv[1]
    csv_path = sys.argv[2]
    block_size = float(sys.argv[3])
    main(glb_path, csv_path, block_size)
    print("Done!")
