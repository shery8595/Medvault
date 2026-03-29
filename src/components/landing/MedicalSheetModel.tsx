import React, { useRef, useMemo } from 'react';
import { Center } from '@react-three/drei';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

export function MedicalSheetModel(props: any) {
  const obj = useLoader(OBJLoader, '/models/vectorized-model.obj');
  const groupRef = useRef<THREE.Group>(null);

  const clonedScene = useMemo(() => {
    if (!obj) return null;
    const s = obj.clone();

    // 1. Color and modify the material
    s.traverse((child: THREE.Object3D) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.material = new THREE.MeshStandardMaterial({
          color: '#ef4444',
          emissive: '#ef4444',
          emissiveIntensity: 0.5,
          roughness: 0.1,
          metalness: 1.0,
          transparent: true,
          opacity: 0.9,
          side: THREE.DoubleSide,
        });
      }
    });

    // 2. Normalize the scale
    const box = new THREE.Box3().setFromObject(s);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    if (maxDim > 0) {
      const targetSize = 4.0;
      const scaleFactor = targetSize / maxDim;
      // We keep the original z-squash logic for the vectorized look if it was intended, 
      // but usually for OBJ we might want uniform scale unless it's a "sheet".
      s.scale.set(scaleFactor, scaleFactor, scaleFactor * 0.1);
    }

    return s;
  }, [obj]);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.4;
      groupRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
    }
  });

  if (!clonedScene) return null;

  return (
    <group ref={groupRef} {...props} dispose={null}>
      <Center>
        <primitive object={clonedScene} />
      </Center>
    </group>
  );
}
