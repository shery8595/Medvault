import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import * as THREE from 'three';

function CipherBit({ delay, position }: { delay: number; position: [number, number, number] }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      // Random flickering and movement
      meshRef.current.position.y += Math.sin(state.clock.elapsedTime + delay) * 0.002;
      meshRef.current.scale.setScalar(0.8 + Math.sin(state.clock.elapsedTime * 2 + delay) * 0.2);
    }
  });

  return (
    <mesh ref={meshRef} position={position}>
      <boxGeometry args={[0.08, 0.08, 0.08]} />
      <meshStandardMaterial 
        color="#00F0FF" 
        emissive="#00F0FF" 
        emissiveIntensity={1} 
      />
    </mesh>
  );
}

export function CipherAnimation() {
  const groupRef = useRef<THREE.Group>(null);

  // Generate a cloud of "bits" (small boxes instead of text for stability)
  const bits = useMemo(() => {
    const b = [];
    for (let i = 0; i < 40; i++) {
        const phi = Math.acos(-1 + (2 * i) / 40);
        const theta = Math.sqrt(40 * Math.PI) * phi;
        const x = Math.cos(theta) * Math.sin(phi) * 1.5;
        const y = Math.sin(theta) * Math.sin(phi) * 1.5;
        const z = Math.cos(phi) * 1.5;
        b.push({ position: [x, y, z] as [number, number, number], delay: Math.random() * 10 });
    }
    return b;
  }, []);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.2;
      groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.1) * 0.2;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Central "Core" */}
      <mesh>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshStandardMaterial 
          color="#020617" 
          emissive="#00F0FF" 
          emissiveIntensity={0.2}
          roughness={0.1}
          metalness={1}
        />
      </mesh>
      
      {/* Shifting Rings of Bits */}
      {bits.map((bit, i) => (
        <CipherBit key={i} {...bit} />
      ))}

      {/* Outer Data Shell */}
      <mesh rotation={[Math.PI / 4, 0, Math.PI / 4]}>
        <boxGeometry args={[2.2, 2.2, 2.2]} />
        <meshStandardMaterial 
          color="#00F0FF"
          wireframe
          transparent
          opacity={0.15}
          emissive="#3b82f6"
          emissiveIntensity={0.5}
        />
      </mesh>


    </group>
  );
}
