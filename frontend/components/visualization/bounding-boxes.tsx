"use client"

import { memo, useMemo } from "react"
import { Html } from "@react-three/drei"
import * as THREE from "three"
import type { SceneObject } from "@/hooks/use-scene-data"

interface BoundingBoxesProps {
  boxes: SceneObject[]
  visible: boolean
  showLabels: boolean
}

const LABEL_COLORS: Record<string, string> = {
  Car: "#22c55e",
  Van: "#22d3ee",
  Truck: "#f59e0b",
  Pedestrian: "#ef4444",
  Cyclist: "#8b5cf6",
  Person: "#ef4444",
  Tram: "#06b6d4",
  Misc: "#6b7280",
}

const CAR_COLORS = ["#4ade80", "#38bdf8", "#818cf8", "#fb923c", "#f472b6", "#a78bfa"]

// ── Shared geometries (created once, reused across all instances) ──
const BODY_GEO = new THREE.BoxGeometry(1.8, 0.6, 4.2)
const CABIN_GEO = new THREE.BoxGeometry(1.5, 0.35, 2.2)
const WINDSHIELD_GEO = new THREE.PlaneGeometry(1.4, 0.4)
const TRUCK_CAB_GEO = new THREE.BoxGeometry(2.2, 1.2, 2.2)
const TRUCK_CARGO_GEO = new THREE.BoxGeometry(2.3, 1.6, 5)
const PED_BODY_GEO = new THREE.CapsuleGeometry(0.18, 0.7, 4, 8)
const PED_HEAD_GEO = new THREE.SphereGeometry(0.14, 8, 6)
const CYCLIST_BODY_GEO = new THREE.CapsuleGeometry(0.15, 0.6, 4, 8)
const CYCLIST_HEAD_GEO = new THREE.SphereGeometry(0.12, 8, 6)
const BIKE_FRAME_GEO = new THREE.CylinderGeometry(0.02, 0.02, 1.0, 6)
const BIKE_WHEEL_GEO = new THREE.TorusGeometry(0.2, 0.025, 6, 12)

// ── Shared materials ──
const WINDSHIELD_MAT = new THREE.MeshStandardMaterial({ color: "#93c5fd", transparent: true, opacity: 0.3, side: THREE.DoubleSide })
const TRUCK_CAB_MAT = new THREE.MeshStandardMaterial({ color: "#dc2626", metalness: 0.5, roughness: 0.4 })
const TRUCK_CARGO_MAT = new THREE.MeshStandardMaterial({ color: "#e5e7eb", metalness: 0.3, roughness: 0.6 })
const PED_BODY_MAT = new THREE.MeshStandardMaterial({ color: "#f97316", roughness: 0.7 })
const PED_HEAD_MAT = new THREE.MeshStandardMaterial({ color: "#fed7aa", roughness: 0.6 })
const CYCLIST_BODY_MAT = new THREE.MeshStandardMaterial({ color: "#8b5cf6", roughness: 0.6 })
const CYCLIST_HEAD_MAT = new THREE.MeshStandardMaterial({ color: "#fde68a", roughness: 0.5 })
const BIKE_FRAME_MAT = new THREE.MeshStandardMaterial({ color: "#374151", metalness: 0.8, roughness: 0.2 })
const BIKE_WHEEL_MAT = new THREE.MeshStandardMaterial({ color: "#1f2937", roughness: 0.8 })

// Pre-create car materials for the color palette
const CAR_MATS = CAR_COLORS.map(c => new THREE.MeshStandardMaterial({ color: c, metalness: 0.6, roughness: 0.35 }))

const PI_HALF = Math.PI / 2

function CarMesh({ colorIndex }: { colorIndex: number }) {
  const mat = CAR_MATS[colorIndex % CAR_MATS.length]
  return (
    <group>
      <mesh position={[0, 0, 0]} castShadow geometry={BODY_GEO} material={mat} />
      <mesh position={[0, 0.4, -0.2]} geometry={CABIN_GEO} material={mat} />
      <mesh position={[0, 0.28, 0.85]} rotation={[0.25, 0, 0]} geometry={WINDSHIELD_GEO} material={WINDSHIELD_MAT} />
    </group>
  )
}

function TruckMesh() {
  return (
    <group>
      <mesh position={[0, 0.1, 1.8]} castShadow geometry={TRUCK_CAB_GEO} material={TRUCK_CAB_MAT} />
      <mesh position={[0, 0.3, -1]} castShadow geometry={TRUCK_CARGO_GEO} material={TRUCK_CARGO_MAT} />
    </group>
  )
}

function PedestrianMesh() {
  return (
    <group>
      <mesh position={[0, 0, 0]} geometry={PED_BODY_GEO} material={PED_BODY_MAT} />
      <mesh position={[0, 0.6, 0]} geometry={PED_HEAD_GEO} material={PED_HEAD_MAT} />
    </group>
  )
}

function CyclistMesh() {
  return (
    <group>
      <mesh position={[0, 0.15, 0]} geometry={CYCLIST_BODY_GEO} material={CYCLIST_BODY_MAT} />
      <mesh position={[0, 0.65, 0]} geometry={CYCLIST_HEAD_GEO} material={CYCLIST_HEAD_MAT} />
      <mesh position={[0, -0.3, 0]} rotation={[0, 0, PI_HALF]} geometry={BIKE_FRAME_GEO} material={BIKE_FRAME_MAT} />
      <mesh position={[0, -0.35, 0.4]} rotation={[0, 0, PI_HALF]} geometry={BIKE_WHEEL_GEO} material={BIKE_WHEEL_MAT} />
      <mesh position={[0, -0.35, -0.4]} rotation={[0, 0, PI_HALF]} geometry={BIKE_WHEEL_GEO} material={BIKE_WHEEL_MAT} />
    </group>
  )
}

function ObjectMesh({ obj, index }: { obj: SceneObject; index: number }) {
  const type = obj.label
  if (type === "Car" || type === "Van") return <CarMesh colorIndex={index} />
  if (type === "Truck") return <TruckMesh />
  if (type === "Pedestrian" || type === "Person") return <PedestrianMesh />
  if (type === "Cyclist") return <CyclistMesh />

  const color = LABEL_COLORS[type] ?? "#6b7280"
  return (
    <mesh>
      <boxGeometry args={[obj.w, obj.h, obj.l]} />
      <meshBasicMaterial color={color} wireframe transparent opacity={0.6} />
    </mesh>
  )
}

// Pre-create wireframe materials for each label type to avoid per-frame allocation
const WIRE_MATS: Record<string, THREE.MeshBasicMaterial> = {}
function getWireMat(label: string): THREE.MeshBasicMaterial {
  if (!WIRE_MATS[label]) {
    const color = LABEL_COLORS[label] ?? "#6b7280"
    WIRE_MATS[label] = new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.25 })
  }
  return WIRE_MATS[label]
}

export const BoundingBoxes = memo(function BoundingBoxes({ boxes, visible, showLabels }: BoundingBoxesProps) {
  if (!visible || boxes.length === 0) return null

  return (
    <group>
      {boxes.map((b, i) => (
        <group
          key={`${b.label}_${i}`}
          position={[b.x, b.y, b.z]}
          rotation={[0, b.yaw || 0, 0]}
        >
          <ObjectMesh obj={b} index={i} />

          {/* Wireframe outline */}
          <mesh>
            <boxGeometry args={[b.w + 0.05, b.h + 0.05, b.l + 0.05]} />
            <primitive object={getWireMat(b.label)} attach="material" />
          </mesh>

          {/* Floating label — only rendered when labels toggle is on */}
          {showLabels && (
            <Html
              position={[0, b.h / 2 + 0.5, 0]}
              center
              distanceFactor={15}
              style={{
                pointerEvents: "none",
                userSelect: "none",
              }}
            >
              <div
                className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold whitespace-nowrap"
                style={{
                  background: `${LABEL_COLORS[b.label] ?? "#6b7280"}22`,
                  color: LABEL_COLORS[b.label] ?? "#6b7280",
                  border: `1px solid ${LABEL_COLORS[b.label] ?? "#6b7280"}44`,
                  backdropFilter: "blur(4px)",
                }}
              >
                {b.label}
              </div>
            </Html>
          )}
        </group>
      ))}
    </group>
  )
})
