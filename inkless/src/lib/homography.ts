export interface CalibrationPoint {
  x: number;
  y: number;
}

export type Homography = [number, number, number, number, number, number, number, number, number];

const solve = (matrix: number[][], values: number[]) => {
  const a = matrix.map((row, i) => [...row, values[i]]);
  for (let column = 0; column < 8; column++) {
    let pivot = column;
    for (let row = column + 1; row < 8; row++) {
      if (Math.abs(a[row][column]) > Math.abs(a[pivot][column])) pivot = row;
    }
    if (Math.abs(a[pivot][column]) < 1e-10) throw new Error("Calibration points are too close together.");
    [a[column], a[pivot]] = [a[pivot], a[column]];
    const divisor = a[column][column];
    for (let j = column; j <= 8; j++) a[column][j] /= divisor;
    for (let row = 0; row < 8; row++) {
      if (row === column) continue;
      const factor = a[row][column];
      for (let j = column; j <= 8; j++) a[row][j] -= factor * a[column][j];
    }
  }
  return a.map((row) => row[8]);
};

/** Computes the same planar projective transform used by cv2.findHomography. */
export function findHomography(source: CalibrationPoint[], destination: CalibrationPoint[]): Homography {
  if (source.length !== 4 || destination.length !== 4) {
    throw new Error("Exactly four source and destination points are required.");
  }
  const matrix: number[][] = [];
  const values: number[] = [];
  source.forEach((point, i) => {
    const target = destination[i];
    matrix.push([point.x, point.y, 1, 0, 0, 0, -target.x * point.x, -target.x * point.y]);
    values.push(target.x);
    matrix.push([0, 0, 0, point.x, point.y, 1, -target.y * point.x, -target.y * point.y]);
    values.push(target.y);
  });
  return [...solve(matrix, values), 1] as Homography;
}

export function project(point: CalibrationPoint, homography: Homography): CalibrationPoint {
  const [h11, h12, h13, h21, h22, h23, h31, h32, h33] = homography;
  const denominator = h31 * point.x + h32 * point.y + h33;
  return {
    x: (h11 * point.x + h12 * point.y + h13) / denominator,
    y: (h21 * point.x + h22 * point.y + h23) / denominator,
  };
}
