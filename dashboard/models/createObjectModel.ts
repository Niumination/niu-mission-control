/**
 * createObjectModel.ts — Demo Tower Model
 * 
 * Procedural Three.js model untuk Niu-MissionControl Office 3D.
 * Tower sederhana dengan beberapa lantai, atap, dan flag.
 * 
 * Usage:
 *   import { createObjectModel } from './models/createObjectModel.js';
 *   const model = createObjectModel();
 *   scene.add(model);
 */

import * as THREE from 'three';

/**
 * Buat model tower untuk office 3D.
 * @param {Object} params - Parameter opsional
 * @param {string} params.color - Warna utama (default: '#4a90d9')
 * @param {number} params.height - Tinggi tower (default: 8)
 * @param {number} params.floors - Jumlah lantai (default: 5)
 * @returns {THREE.Group} Group dengan model tower
 */
export function createObjectModel(params = {}) {
  const {
    color = '#4a90d9',
    height = 8,
    floors = 5,
  } = params;

  const group = new THREE.Group();
  const mainColor = new THREE.Color(color);
  const accentColor = new THREE.Color(color).multiplyScalar(0.7);
  const roofColor = new THREE.Color('#c0392b');
  const glassColor = new THREE.Color('#85c1e9');

  // ── Base / Lantai Dasar ──
  const baseGeo = new THREE.BoxGeometry(2.2, 0.4, 2.2);
  const baseMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    roughness: 0.7,
    metalness: 0.3,
  });
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.y = 0.2;
  group.add(base);

  // ── Tower Body (bertingkat) ──
  const floorHeight = height / floors;
  for (let i = 0; i < floors; i++) {
    const isTop = i === floors - 1;
    const isBottom = i === 0;
    const width = 2.0 - (i / floors) * 0.4; // mengecil ke atas

    // Wall section
    const wallGeo = new THREE.BoxGeometry(width, floorHeight * 0.7, width);
    const wallMat = new THREE.MeshStandardMaterial({
      color: mainColor,
      roughness: 0.5,
      metalness: 0.4,
    });
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.y = 0.4 + i * floorHeight + floorHeight * 0.35;
    group.add(wall);

    // Glass windows
    const glassGeo = new THREE.BoxGeometry(width * 0.6, floorHeight * 0.3, 0.05);
    const glassMat = new THREE.MeshStandardMaterial({
      color: glassColor,
      roughness: 0.1,
      metalness: 0.8,
      transparent: true,
      opacity: 0.6,
    });
    // Front glass
    const glassFront = new THREE.Mesh(glassGeo, glassMat);
    glassFront.position.set(0, 0.4 + i * floorHeight + floorHeight * 0.35, width / 2);
    group.add(glassFront);

    // Balcony / trim
    if (!isTop) {
      const trimGeo = new THREE.BoxGeometry(width + 0.1, 0.05, width + 0.1);
      const trimMat = new THREE.MeshStandardMaterial({
        color: accentColor,
        roughness: 0.8,
      });
      const trim = new THREE.Mesh(trimGeo, trimMat);
      trim.position.y = 0.4 + (i + 1) * floorHeight;
      group.add(trim);
    }

    // Antenna / decorative element on each floor corner
    if (i % 2 === 1) {
      const cornerMat = new THREE.MeshStandardMaterial({
        color: accentColor,
        roughness: 0.6,
      });
      for (const dx of [-1, 1]) {
        for (const dz of [-1, 1]) {
          const pillar = new THREE.Mesh(
            new THREE.CylinderGeometry(0.04, 0.06, floorHeight * 0.3, 6),
            cornerMat
          );
          pillar.position.set(
            dx * width / 2 + dx * 0.08,
            0.4 + i * floorHeight + floorHeight * 0.5,
            dz * width / 2 + dz * 0.08
          );
          group.add(pillar);
        }
      }
    }
  }

  // ── Roof / Atap ──
  const roofGeo = new THREE.ConeGeometry(1.2, 0.8, 8);
  const roofMat = new THREE.MeshStandardMaterial({
    color: roofColor,
    roughness: 0.6,
    metalness: 0.2,
  });
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.y = height + 0.4;
  group.add(roof);

  // ── Flag / Antenna ──
  const poleGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.0, 6);
  const poleMat = new THREE.MeshStandardMaterial({
    color: '#888888',
    metalness: 0.9,
    roughness: 0.2,
  });
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.y = height + 0.8 + 0.5;
  group.add(pole);

  // Flag
  const flagGeo = new THREE.PlaneGeometry(0.4, 0.25);
  const flagMat = new THREE.MeshStandardMaterial({
    color: roofColor,
    side: THREE.DoubleSide,
  });
  const flag = new THREE.Mesh(flagGeo, flagMat);
  flag.position.set(0.2, height + 1.0 + 0.125, 0);
  group.add(flag);

  // ── Ground shadow / base plate ──
  const shadowGeo = new THREE.CircleGeometry(1.8, 16);
  const shadowMat = new THREE.MeshStandardMaterial({
    color: '#000000',
    transparent: true,
    opacity: 0.15,
    side: THREE.DoubleSide,
  });
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;
  group.add(shadow);

  return group;
}
