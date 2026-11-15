import * as THREE from 'three';

/** Soft radial glow (white, alpha falling off from the centre), for the halo around the Sun. */
export function glowPixels(size = 128) {
  const pixels = new Uint8Array(size * size * 4);
  const c = (size - 1) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.min(Math.hypot(x - c, y - c) / c, 1);
      const alpha = (1 - d) ** 2.6;
      pixels.set([255, 244, 214, Math.round(alpha * 255)], (y * size + x) * 4);
    }
  }
  return pixels;
}

export function createGlowTexture(size = 128) {
  const texture = new THREE.DataTexture(glowPixels(size), size, size, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
