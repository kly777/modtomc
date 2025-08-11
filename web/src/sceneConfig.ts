import * as THREE from 'three';

// 统一场景配置（以World组件为基准）
export const sceneConfig = {
  // 背景颜色
  backgroundColor: new THREE.Color(0xffffff),

  // 相机初始位置和朝向
  cameraPosition: new THREE.Vector3(32, 10, 40),
  cameraLookAt: new THREE.Vector3(16, 5, 0),

  // 环境光设置
  ambientLight: {
    color: 0xffffff,
    intensity: 0.5
  },

  // 平行光设置
  directionalLight: {
    color: 0xffffff,
    intensity: 0.8,
    position: new THREE.Vector3(50, 100, 50)
  },

  // 网格辅助线设置（与World组件一致）
  gridHelper: {
    size: 128,       // 网格大小
    divisions: 16,   // 划分数量（128/16=8，即每8个单位一个格子）
    colorCenterLine: 0x444444,
    colorGrid: 0x888888
  }
};