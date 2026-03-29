import React, { useRef, useMemo, useState } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { Sparkles, Center } from '@react-three/drei';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

export function PrivateMatchingAnimation() {
  const groupRef = useRef<THREE.Group>(null);
  const obj = useLoader(OBJLoader, '/models/seq_4.obj');
  const baseScaleRef = useRef(1);
  const [hovered, setHovered] = useState(false);

  // 1. Process and style the model
  const processedObj = useMemo(() => {
    if (!obj) return null;
    const s = obj.clone();

    // Apply a glowing gold/amber material to all meshes
    s.traverse((child: THREE.Object3D) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.material = new THREE.MeshStandardMaterial({
          color: '#f59e0b',
          emissive: '#f59e0b',
          emissiveIntensity: 0.8,
          roughness: 0.1,
          metalness: 1.0,
          side: THREE.DoubleSide, // Ensure it's never culled from any angle
        });
      }
    });

    // Correctly face the user (0 degrees is the true front now that it's detached from scroll rotation)
    s.rotation.y = 0;

    // Normalize the scale using Box3
    const box = new THREE.Box3().setFromObject(s);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    if (maxDim > 0) {
      const targetSize = 4.8; // Increased by 50% as requested
      baseScaleRef.current = targetSize / maxDim;
      s.scale.setScalar(baseScaleRef.current);
    }

    return s;
  }, [obj]);

  useFrame((state) => {
    if (groupRef.current) {
      if (hovered) {
        // Slight up/down hover effect
        groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 2) * 0.05;
      } else {
        // Return to static state
        groupRef.current.position.y = 0;
      }
      // Ensure scale remains static
      groupRef.current.scale.setScalar(1);
    }
  });

  if (!processedObj) return null;

  return (
    <group
      ref={groupRef}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      position={[-0.5, -5, 0]} // Move left as requested
    >
      <Center>
        <primitive object={processedObj} />
      </Center>


    </group>

  );
}

// Preload the OBJ model
useLoader.preload(OBJLoader, '/models/seq_4.obj');
