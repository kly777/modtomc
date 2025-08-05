import json
import numpy as np
import pyvista as pv
import pandas as pd


def load_textures(block_data):
    textures = []
    for b in block_data:
        texture = pv.read_texture(b["file_path"])
        if texture is None:
            raise ValueError(f"Failed to load texture: {b['file_path']}")
        textures.append(texture)
    return textures


data = pd.read_csv("tmp/output_voxel_grid_1.csv", header=1)
points = data.iloc[:, :3].values
point_set = set(tuple(p) for p in points)
colors = np.clip(data.iloc[:, 3:].values * 255, 0, 255)

directions = [(1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1)]

with open("block_gen/data.json") as f:
    block_data = json.load(f)

# 构建 block_colors 和 textures
block_colors = np.array([[b["avg_r"], b["avg_g"], b["avg_b"]] for b in block_data])
textures = load_textures(block_data)  # textures 现在是列表

# 匹配最近的块索引
color_diff = np.sqrt(np.sum((colors[:, None] - block_colors[None, :]) ** 2, axis=2))
closest_indices = np.argmin(color_diff, axis=1)

# 生成暴露面
meshes = []
for i, (x, y, z) in enumerate(points):
    block_idx = closest_indices[i]
    texture = textures[block_idx]  # 直接通过索引访问列表

    for dx, dy, dz in directions:
        neighbor = (x + dx, y + dy, z + dz)
        if neighbor not in point_set:
            center = (x + dx * 0.5, y + dy * 0.5, z + dz * 0.5)
            plane = pv.Plane(
                center=center
            )
            plane = plane.texture_map_to_plane()
            plane.texture = texture
            meshes.append(plane)


plotter = pv.Plotter()

for mesh in meshes:
    plotter.add_mesh(mesh)
plotter.show()
