"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type { Group, Mesh } from "three";

type OrbitPalette = {
  core: string;
  ice: string;
  lime: string;
  peach: string;
  line: string;
};

function CapabilityField({ palette, paused }: { palette: OrbitPalette; paused: boolean }) {
  const field = useRef<Group>(null);
  const core = useRef<Mesh>(null);
  const spin = useRef(0);

  useFrame(({ pointer }, delta) => {
    if (!field.current || !core.current) return;
    if (!paused) spin.current += delta * 0.08;
    const ease = Math.min(1, delta * 2.5);
    field.current.rotation.y += (pointer.x * 0.2 + spin.current - field.current.rotation.y) * ease;
    field.current.rotation.x += (-pointer.y * 0.13 - field.current.rotation.x) * ease;
    if (!paused) {
      core.current.rotation.y += delta * 0.18;
      core.current.rotation.z += delta * 0.07;
    }
  });

  return (
    <group ref={field} rotation={[0.06, 0.1, 0]}>
      <mesh rotation={[1.16, 0.12, -0.16]}>
        <torusGeometry args={[2.55, 0.013, 8, 128]} />
        <meshBasicMaterial color={palette.line} transparent opacity={0.48} />
      </mesh>
      <mesh rotation={[0.39, 0.65, 0.31]}>
        <torusGeometry args={[2.2, 0.009, 8, 128]} />
        <meshBasicMaterial color={palette.line} transparent opacity={0.28} />
      </mesh>

      <mesh ref={core} rotation={[0.2, 0.32, 0]}>
        <icosahedronGeometry args={[1.14, 1]} />
        <meshStandardMaterial color={palette.core} metalness={0.12} roughness={0.43} flatShading />
      </mesh>
      <mesh rotation={[0.18, 0.4, 0]}>
        <icosahedronGeometry args={[1.47, 1]} />
        <meshBasicMaterial color={palette.line} wireframe transparent opacity={0.26} />
      </mesh>

      <mesh position={[-2.05, 1.04, 0.72]} rotation={[0.4, 0.1, -0.3]}>
        <octahedronGeometry args={[0.46, 0]} />
        <meshStandardMaterial color={palette.ice} metalness={0.06} roughness={0.47} flatShading />
      </mesh>
      <mesh position={[2.12, 0.91, -0.36]} rotation={[0.4, 0.3, 0.2]}>
        <dodecahedronGeometry args={[0.48, 0]} />
        <meshStandardMaterial color={palette.lime} metalness={0.04} roughness={0.46} flatShading />
      </mesh>
      <mesh position={[-1.69, -1.55, -0.3]} rotation={[0.35, 0.46, 0.18]}>
        <boxGeometry args={[0.72, 0.72, 0.72]} />
        <meshStandardMaterial color={palette.peach} metalness={0.05} roughness={0.48} />
      </mesh>
      <mesh position={[1.85, -1.55, 0.56]} rotation={[0.2, 0.08, 0]}>
        <icosahedronGeometry args={[0.42, 0]} />
        <meshStandardMaterial color={palette.ice} metalness={0.05} roughness={0.5} flatShading />
      </mesh>
    </group>
  );
}

export default function SkillOrbitCanvas({ palette, paused }: { palette: OrbitPalette; paused: boolean }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 8.4], fov: 43, near: 0.1, far: 30 }}
      dpr={[1, 1.5]}
      gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
      fallback={<div className="home-orbit-fallback" aria-hidden="true"><span /></div>}
    >
      <ambientLight intensity={2.1} />
      <directionalLight position={[2.5, 4.5, 5]} intensity={3.2} />
      <directionalLight position={[-4, -2, -3]} intensity={1.5} />
      <CapabilityField palette={palette} paused={paused} />
    </Canvas>
  );
}
