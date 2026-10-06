// Mini bibliothèque de matrices 4×4 (ordre colonne, comme WebGL).

export type Vec3 = [number, number, number];

export function perspective(out: Float32Array, fovy: number, aspect: number, near: number, far: number): Float32Array {
  const f = 1 / Math.tan(fovy / 2);
  out.fill(0);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) / (near - far);
  out[11] = -1;
  out[14] = (2 * far * near) / (near - far);
  return out;
}

export function lookAt(out: Float32Array, eye: Vec3, center: Vec3, up: Vec3): Float32Array {
  let zx = eye[0] - center[0];
  let zy = eye[1] - center[1];
  let zz = eye[2] - center[2];
  let len = Math.hypot(zx, zy, zz) || 1;
  zx /= len;
  zy /= len;
  zz /= len;
  let xx = up[1] * zz - up[2] * zy;
  let xy = up[2] * zx - up[0] * zz;
  let xz = up[0] * zy - up[1] * zx;
  len = Math.hypot(xx, xy, xz) || 1;
  xx /= len;
  xy /= len;
  xz /= len;
  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;
  out[0] = xx;
  out[1] = yx;
  out[2] = zx;
  out[3] = 0;
  out[4] = xy;
  out[5] = yy;
  out[6] = zy;
  out[7] = 0;
  out[8] = xz;
  out[9] = yz;
  out[10] = zz;
  out[11] = 0;
  out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
  out[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
  out[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
  out[15] = 1;
  return out;
}

/** Matrice modèle = Translation · RotationY · RotationX · Échelle. */
export function modelMatrix(out: Float32Array, tx: number, ty: number, tz: number, tilt: number, yaw: number, scale: number): Float32Array {
  const ca = Math.cos(tilt);
  const sa = Math.sin(tilt);
  const cb = Math.cos(yaw);
  const sb = Math.sin(yaw);
  out[0] = cb * scale;
  out[1] = 0;
  out[2] = -sb * scale;
  out[3] = 0;
  out[4] = sb * sa * scale;
  out[5] = ca * scale;
  out[6] = cb * sa * scale;
  out[7] = 0;
  out[8] = sb * ca * scale;
  out[9] = -sa * scale;
  out[10] = cb * ca * scale;
  out[11] = 0;
  out[12] = tx;
  out[13] = ty;
  out[14] = tz;
  out[15] = 1;
  return out;
}
