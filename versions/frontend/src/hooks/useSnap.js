export function snapToGrid(value, unit = 32) {
  return Math.round(value / unit) * unit;
}

export function useSnap() {
  /**
   * Computes which screen edge the action bar is closest to and snaps it to that edge.
   * @param {number} x - Current X coordinate
   * @param {number} y - Current Y coordinate
   * @param {number} barWidth - Current action bar width
   * @param {number} barHeight - Current action bar height
   * @param {number} windowWidth - Inner width of window
   * @param {number} windowHeight - Inner height of window
   * @returns {{ edge: 'top'|'bottom'|'left'|'right', x: number, y: number }}
   */
  const getDockPosition = (x, y, barWidth, barHeight, windowWidth, windowHeight) => {
    // Calculate distances to the four screen boundaries
    const distLeft = x;
    const distRight = windowWidth - (x + barWidth);
    const distTop = y;
    const distBottom = windowHeight - (y + barHeight);

    const minDist = Math.min(distLeft, distRight, distTop, distBottom);

    let edge = 'bottom';
    let snappedX = x;
    let snappedY = y;

    // Check which distance is the smallest and snap
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
  };

  return {
    snapToGrid,
    getDockPosition,
  };
}
