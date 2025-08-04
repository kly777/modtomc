import pyvista as pv
import pandas as pd
import numpy as np

# 读取数据
data = pd.read_csv('voxel_data.csv', header=1)

# 创建点云数据集
points = data.iloc[:, :3].astype(float).values
colors = data.iloc[:, 3:].astype(float).values
colors = np.clip(colors, 0, 1)  # 限制颜色范围

# 创建点云网格
grid = pv.PolyData(points)
grid['colors'] = colors  # 将颜色作为点数据存储

# 创建渲染器
plotter = pv.Plotter()
plotter.add_mesh(
    grid,
    style='points',
    point_size=10,
    render_points_as_spheres=True,
    scalars='colors',
    rgba=True
)

# 设置显示参数
plotter.set_background('white')
plotter.show_grid()
plotter.camera_position = 'iso'

# 显示模型
plotter.show()
