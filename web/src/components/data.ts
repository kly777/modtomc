export type PointData = {
  position: position,
  color: RGB
  variance: number
}

export type position = {
  x: number;
  y: number;
  z: number;
}

export type RGB = {
  r: number;
  g: number;
  b: number;
}