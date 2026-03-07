"use client"

import { memo } from "react"
import * as THREE from "three"

/**
 * VehicleModel — detailed procedural car model.
 * No position/yaw props — positioned by the parent group via ref in useFrame.
 */
export const VehicleModel = memo(function VehicleModel() {
  return (
    <group>
      {/* Main body */}
      <mesh position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[1.85, 0.55, 4.6]} />
        <meshStandardMaterial color="#1e40af" metalness={0.8} roughness={0.2} envMapIntensity={1.2} />
      </mesh>

      {/* Body accent */}
      <mesh position={[0, 0.32, 0]}>
        <boxGeometry args={[1.87, 0.04, 4.62]} />
        <meshStandardMaterial color="#1e3a8a" metalness={0.9} roughness={0.15} />
      </mesh>

      {/* Cabin */}
      <mesh position={[0, 0.92, -0.15]} castShadow>
        <boxGeometry args={[1.6, 0.42, 2.6]} />
        <meshStandardMaterial color="#1d4ed8" metalness={0.7} roughness={0.25} />
      </mesh>

      {/* Front windshield */}
      <mesh position={[0, 0.88, 1.05]} rotation={[0.3, 0, 0]}>
        <planeGeometry args={[1.5, 0.5]} />
        <meshPhysicalMaterial color="#a5c8ff" transparent opacity={0.35} metalness={0.1} roughness={0.1} side={THREE.DoubleSide} />
      </mesh>

      {/* Rear windshield */}
      <mesh position={[0, 0.88, -1.35]} rotation={[-0.3, 0, 0]}>
        <planeGeometry args={[1.45, 0.45]} />
        <meshPhysicalMaterial color="#8ab4f8" transparent opacity={0.3} metalness={0.1} roughness={0.1} side={THREE.DoubleSide} />
      </mesh>

      {/* Headlights */}
      {[-0.65, 0.65].map((x) => (
        <mesh key={`hl${x}`} position={[x, 0.45, 2.31]}>
          <boxGeometry args={[0.35, 0.15, 0.05]} />
          <meshStandardMaterial color="#fef3c7" emissive="#fbbf24" emissiveIntensity={2} toneMapped={false} />
        </mesh>
      ))}

      {/* Taillights */}
      {[-0.65, 0.65].map((x) => (
        <mesh key={`tl${x}`} position={[x, 0.45, -2.31]}>
          <boxGeometry args={[0.3, 0.12, 0.05]} />
          <meshStandardMaterial color="#fca5a5" emissive="#ef4444" emissiveIntensity={1.5} toneMapped={false} />
        </mesh>
      ))}

      {/* Wheels */}
      {[[-0.88, 0.22, 1.4], [0.88, 0.22, 1.4], [-0.88, 0.22, -1.4], [0.88, 0.22, -1.4]].map(([wx, wy, wz], i) => (
        <group key={`w${i}`} position={[wx, wy, wz]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[0.22, 0.08, 8, 16]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.95} />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.14, 0.14, 0.12, 12]} />
            <meshStandardMaterial color="#9ca3af" metalness={0.9} roughness={0.2} />
          </mesh>
        </group>
      ))}

      {/* Side mirrors */}
      {[-0.95, 0.95].map((x) => (
        <mesh key={`m${x}`} position={[x, 0.78, 0.8]}>
          <boxGeometry args={[0.12, 0.08, 0.18]} />
          <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.2} />
        </mesh>
      ))}

      {/* Roof LiDAR */}
      <mesh position={[0, 1.2, -0.1]}>
        <cylinderGeometry args={[0.12, 0.15, 0.12, 8]} />
        <meshStandardMaterial color="#374151" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0, 1.27, -0.1]}>
        <cylinderGeometry args={[0.08, 0.12, 0.04, 8]} />
        <meshStandardMaterial color="#60a5fa" emissive="#3b82f6" emissiveIntensity={0.5} />
      </mesh>

      <pointLight position={[0, 0.3, 0]} intensity={0.4} distance={5} color="#60a5fa" />
    </group>
  )
})
