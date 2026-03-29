import React, { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Canvas } from "@react-three/fiber";
import { Environment, Float, Sparkles, MeshTransmissionMaterial, Torus, Octahedron, Sphere, Cylinder } from "@react-three/drei";
import { motion as motion3d } from "framer-motion-3d";

import { MedicalSheetModel } from "./MedicalSheetModel";
import { CipherAnimation } from "./CipherAnimation";
import { PrivateMatchingAnimation } from "./PrivateMatchingAnimation";

export function ScrollStory() {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // --- Text Opacity Transforms ---
  const t1Opacity = useTransform(scrollYProgress, [0, 0.15, 0.25], [1, 1, 0]);
  const t2Opacity = useTransform(scrollYProgress, [0.2, 0.28, 0.42, 0.5], [0, 1, 1, 0]);
  const t3Opacity = useTransform(scrollYProgress, [0.45, 0.53, 0.67, 0.75], [0, 1, 1, 0]);
  const t4Opacity = useTransform(scrollYProgress, [0.7, 0.78, 1], [0, 1, 1]);

  // --- Text Y Transforms ---
  const t1Y = useTransform(scrollYProgress, [0, 0.15, 0.25], [0, 0, -40]);
  const t2Y = useTransform(scrollYProgress, [0.2, 0.28, 0.42, 0.5], [40, 0, 0, -40]);
  const t3Y = useTransform(scrollYProgress, [0.45, 0.53, 0.67, 0.75], [40, 0, 0, -40]);
  const t4Y = useTransform(scrollYProgress, [0.7, 0.78, 1], [40, 0, 0]);

  // --- Background Glow ---
  const backgroundColor = useTransform(
    scrollYProgress,
    [0.1, 0.35, 0.6, 0.85],
    [
      "radial-gradient(ellipse at center, rgba(239, 68, 68, 0.15) 0%, transparent 60%)",
      "radial-gradient(ellipse at center, rgba(0, 240, 255, 0.15) 0%, transparent 60%)", // Electric Cyan
      "radial-gradient(ellipse at center, rgba(37, 99, 235, 0.15) 0%, transparent 60%)", // Sapphire Blue
      "radial-gradient(ellipse at center, rgba(245, 158, 11, 0.15) 0%, transparent 60%)"
    ]
  );

  // --- 3D Scene Transforms ---
  const chap1Scale = useTransform(scrollYProgress, [0, 0.1, 0.2, 0.3], [1, 1, 1, 0]);
  const chap1Z = useTransform(scrollYProgress, [0, 0.2, 0.3], [0, 0, 50]);

  const chap2Scale = useTransform(scrollYProgress, [0, 0.15, 0.3, 0.45, 0.55], [0, 0, 1.2, 1.2, 0]);
  const chap2Z = useTransform(scrollYProgress, [0, 0.15, 0.55, 0.6], [50, 0, 0, 50]);

  // Chap 3 fades out starting at 0.67 and is gone by 0.78
  const chap3Scale = useTransform(scrollYProgress, [0, 0.4, 0.55, 0.67, 0.78], [0, 0, 1, 1, 0]);
  // Chap 3 slides back (Z=50) starting at 0.78
  const chap3Z = useTransform(scrollYProgress, [0, 0.4, 0.78, 0.88], [50, 0, 0, 50]);

  // Chap 4 starts fading in at 0.70 (overlaps with Chap 3 fade-out) for a crossfade
  const chap4Scale = useTransform(scrollYProgress, [0, 0.70, 0.82, 1], [0, 0, 1.0, 1.0]);
  const chap4Z = useTransform(scrollYProgress, [0, 0.70, 1], [50, 0, 0]);
  
  const ringRotate = useTransform(scrollYProgress, [0.4, 0.8], [0, Math.PI * 4]);
  const cylinderSpin = useTransform(scrollYProgress, [0.7, 1], [0, Math.PI * 2]);
  const sceneRotationY = useTransform(scrollYProgress, [0, 1], [0, Math.PI]);

  return (
    <motion.div 
      ref={containerRef} 
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      transition={{ duration: 1.2, ease: "easeOut" }}
      viewport={{ once: true }}
      className="relative h-[400vh] w-full bg-black"
    >
      {/* Top blur mask to soften transition from Hero */}
      <div className="absolute top-0 left-0 right-0 h-48 bg-gradient-to-b from-[#030712] to-transparent z-30 pointer-events-none blur-3xl opacity-80" />

      <div className="sticky top-0 h-screen w-full flex flex-col md:flex-row items-center justify-center overflow-hidden">
        
        {/* Ambient Tracking Glow */}
        <motion.div 
          className="absolute inset-0 z-0 pointer-events-none transition-colors duration-500"
          style={{ background: backgroundColor }} 
        />

        {/* --- LEFT SIDE: TEXT NARRATIVE --- */}
        <div className="w-full md:w-1/2 h-1/2 md:h-full flex items-center justify-center relative p-8 md:pl-24 z-20 pointer-events-none">
          
          <motion.div style={{ opacity: t1Opacity, y: t1Y }} className="absolute max-w-lg left-8 right-8 md:left-24 md:right-auto">
            <div className="text-red-500 font-mono text-xs tracking-widest mb-4 flex items-center gap-2">
              <span className="h-px w-6 bg-red-500/50"></span> 01 // THE EXPOSURE
            </div>
            <h3 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-[1.1]">
              Your data is scattered.
            </h3>
            <p className="text-slate-400 text-lg leading-relaxed">
              Medical records, DNA profiles, and sensitive health histories exist in plaintext across a dozen vulnerable databases. True privacy is a myth.
            </p>
          </motion.div>
          
          <motion.div style={{ opacity: t2Opacity, y: t2Y }} className="absolute max-w-lg left-8 right-8 md:left-24 md:right-auto">
            <div className="text-[#00F0FF] font-mono text-xs tracking-widest mb-4 flex items-center gap-2">
              <span className="h-px w-6 bg-[#00F0FF]/50"></span> 02 // THE VAULT
            </div>
            <h3 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-[1.1]">
              Local Encryption.
            </h3>
            <p className="text-slate-400 text-lg leading-relaxed">
              MedVault immediately encrypts your data locally on your device using AES-256 and FHE keys before it ever touches a network. It becomes mathematically impenetrable.
            </p>
          </motion.div>

          <motion.div style={{ opacity: t3Opacity, y: t3Y }} className="absolute max-w-lg left-8 right-8 md:left-24 md:right-auto">
            <div className="text-blue-400 font-mono text-xs tracking-widest mb-4 flex items-center gap-2">
              <span className="h-px w-6 bg-blue-400/50"></span> 03 // THE ENGINE
            </div>
            <h3 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-[1.1]">
              Blind Computation.
            </h3>
            <p className="text-slate-400 text-lg leading-relaxed">
              Powered by Fhenix CoFHE, researchers can query an encrypted index to check matching eligibility—without ever decrypting the core payload.
            </p>
          </motion.div>

          <motion.div style={{ opacity: t4Opacity, y: t4Y }} className="absolute max-w-lg left-8 right-8 md:left-24 md:right-auto">
            <div className="text-amber-500 font-mono text-xs tracking-widest mb-4 flex items-center gap-2">
              <span className="h-px w-6 bg-amber-500/50"></span> 04 // THE REWARD
            </div>
            <h3 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-[1.1]">
              Private Matching.
            </h3>
            <p className="text-slate-400 text-lg leading-relaxed">
              You securely match with life-saving clinical trials and receive direct wallet compensation, retaining absolute anonymity and control over your footprint.
            </p>
          </motion.div>

        </div>

        {/* --- RIGHT SIDE: PROCEDURAL 3D CANVAS --- */}
        <div className="w-full md:w-1/2 h-1/2 md:h-full flex items-center justify-center relative z-10">
          <Canvas
            camera={{ position: [0, 0, 8], fov: 45 }}
            gl={{ antialias: true, alpha: true }}
            style={{ background: "transparent" }}
            onCreated={({ gl, scene }) => {
              gl.setClearColor(0x000000, 0);
              scene.background = null;
            }}
          >
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 10, 5]} intensity={1.5} />
            <Environment preset="city" />
            
              <Float speed={2} rotationIntensity={1} floatIntensity={1.5}>
                <motion3d.group rotation-y={sceneRotationY}>
                  
                  {/* CHAP 1: Scattered Data (Red Wireframe & Particles) */}
                  <motion3d.group scale={chap1Scale} position-z={chap1Z}>
                    <MedicalSheetModel />
                    <Sparkles 
                      count={160} 
                      scale={4} 
                      size={1.4} 
                      speed={0.3} 
                      opacity={0.6}
                      noise={1}
                      color="#ef4444" 
                    />
                  </motion3d.group>

                  {/* CHAP 2: The Vault (Electric Cyan Frosted Glass) */}
                  <motion3d.mesh scale={chap2Scale} position-z={chap2Z}>
                    <Octahedron args={[1.8, 0]}>
                      <MeshTransmissionMaterial 
                        backside
                        samples={4}
                        thickness={0.8}
                        chromaticAberration={0.06}
                        anisotropy={0.3}
                        distortion={0.2}
                        distortionScale={0.3}
                        temporalDistortion={0.1}
                        color="#00F0FF"
                      />
                    </Octahedron>

                  </motion3d.mesh>

                  {/* CHAP 3: The Engine (Cipher / Encryption Animation) */}
                  <motion3d.group scale={chap3Scale} position-z={chap3Z}>
                    <CipherAnimation />
                  </motion3d.group>

                </motion3d.group>

                {/* CHAP 4: The Reward (Crystalline Heart Animation) - STATIC ROTATION */}
                <motion3d.group scale={chap4Scale} position-y={chap4Z} position-z={chap4Z}>
                  <PrivateMatchingAnimation />
                </motion3d.group>

              </Float>
          </Canvas>
        </div>
      </div>
    </motion.div>
  );
}
