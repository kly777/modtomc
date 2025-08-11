export function rgb2lab(r: number, g: number, b: number): {
  l: number;
  a: number;
  b: number;
} {
  // Convert RGB to [0,1] range
  r /= 255; g /= 255; b /= 255;

  // Apply gamma correction
  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

  // Convert to XYZ
  let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  let y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.00000;
  let z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;

  // Apply XYZ to LAB conversion
  x = x > 0.008856 ? Math.pow(x, 1 / 3) : (7.787 * x) + 16 / 116;
  y = y > 0.008856 ? Math.pow(y, 1 / 3) : (7.787 * y) + 16 / 116;
  z = z > 0.008856 ? Math.pow(z, 1 / 3) : (7.787 * z) + 16 / 116;

  return {
    l: (116 * y) - 16,
    a: 500 * (x - y),
    b: 200 * (y - z)
  };
}


export function lab2rgb(l: number, a: number, b: number): {
  r: number;
  g: number;
  b: number;
} {
  // Convert LAB to XYZ
  let y = (l + 16) / 116;
  let x = a / 500 + y;
  let z = y - b / 200;

  // Reverse non-linear transformation
  x = x > 0.206893034 ? Math.pow(x, 3) : (x - 16 / 116) / 7.787;
  y = y > 0.206893034 ? Math.pow(y, 3) : (y - 16 / 116) / 7.787;
  z = z > 0.206893034 ? Math.pow(z, 3) : (z - 16 / 116) / 7.787;

  // Scale to D65 reference white
  x *= 0.95047;
  y *= 1.00000;
  z *= 1.08883;

  // Convert to linear RGB
  let r = x * 3.2406 + y * -1.5372 + z * -0.4986;
  let g = x * -0.9689 + y * 1.8758 + z * 0.0415;
  let bVal = x * 0.0557 + y * -0.2040 + z * 1.0570;

  // Apply gamma correction
  r = r > 0.0031308 ? 1.055 * Math.pow(r, 1 / 2.4) - 0.055 : 12.92 * r;
  g = g > 0.0031308 ? 1.055 * Math.pow(g, 1 / 2.4) - 0.055 : 12.92 * g;
  bVal = bVal > 0.0031308 ? 1.055 * Math.pow(bVal, 1 / 2.4) - 0.055 : 12.92 * bVal;

  // Clamp and scale to [0,255]
  return {
    r: Math.round(Math.max(0, Math.min(1, r)) * 255),
    g: Math.round(Math.max(0, Math.min(1, g)) * 255),
    b: Math.round(Math.max(0, Math.min(1, bVal)) * 255)
  };
}
