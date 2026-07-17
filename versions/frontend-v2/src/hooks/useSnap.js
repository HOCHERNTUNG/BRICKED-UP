export function snapToGrid(value, unit = 32) {
  return Math.round(value / unit) * unit;
}
