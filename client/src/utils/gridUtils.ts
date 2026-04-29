/**
 * Convert grid coordinates to canvas pixel coordinates (top-left of cell).
 */
export function cellToPixel(
  x: number,
  y: number,
  cellSize: number
): { px: number; py: number } {
  return {
    px: x * cellSize,
    py: y * cellSize,
  };
}

/**
 * Convert canvas pixel coordinates to grid cell coordinates.
 * Returns null if outside the grid.
 */
export function pixelToCell(
  px: number,
  py: number,
  cellSize: number,
  gridWidth: number = 10,
  gridHeight: number = 10
): { x: number; y: number } | null {
  const x = Math.floor(px / cellSize);
  const y = Math.floor(py / cellSize);

  if (x < 0 || x >= gridWidth || y < 0 || y >= gridHeight) {
    return null;
  }

  return { x, y };
}

/**
 * Get the center pixel of a grid cell.
 */
export function cellCenter(
  x: number,
  y: number,
  cellSize: number
): { px: number; py: number } {
  return {
    px: x * cellSize + cellSize / 2,
    py: y * cellSize + cellSize / 2,
  };
}

/**
 * Calculate the optimal cell size to fit the grid in a canvas.
 */
export function calculateCellSize(
  canvasWidth: number,
  canvasHeight: number,
  gridWidth: number = 10,
  gridHeight: number = 10
): number {
  return Math.floor(Math.min(canvasWidth / gridWidth, canvasHeight / gridHeight));
}
