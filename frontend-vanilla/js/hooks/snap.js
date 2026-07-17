/**
 * Grid Snapping Mathematical Constants and Edge boundaries calculation
 */

export function snapToGrid(value, unit = 16) {
  return Math.round(value / unit) * unit;
}

export function getDockPosition(x, y, barWidth, barHeight, windowWidth, windowHeight) {
  const distLeft = x;
  const distRight = windowWidth - (x + barWidth);
  const distTop = y;
  const distBottom = windowHeight - (y + barHeight);

  const minDist = Math.min(distLeft, distRight, distTop, distBottom);

  let edge = 'bottom';
  let snappedX = x;
  let snappedY = y;

  if (minDist === distLeft) {
    edge = 'left';
    snappedX = 0;
    snappedY = Math.max(16, Math.min(y, windowHeight - barHeight - 16));
  } else if (minDist === distRight) {
    edge = 'right';
    snappedX = windowWidth - barWidth;
    snappedY = Math.max(16, Math.min(y, windowHeight - barHeight - 16));
  } else if (minDist === distTop) {
    edge = 'top';
    snappedX = Math.max(16, Math.min(x, windowWidth - barWidth - 16));
    snappedY = 0;
  } else {
    edge = 'bottom';
    snappedX = Math.max(16, Math.min(x, windowWidth - barWidth - 16));
    snappedY = windowHeight - barHeight;
  }

  return { edge, x: snappedX, y: snappedY };
}
