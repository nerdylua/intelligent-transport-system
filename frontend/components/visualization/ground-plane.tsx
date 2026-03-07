"use client"

import { useMemo } from "react"
import * as THREE from "three"

interface GroundPlaneProps {
    visible: boolean
}

export function GroundPlane({ visible }: GroundPlaneProps) {
    const texture = useMemo(() => {
        // Create a subtle asphalt-like noise texture procedurally
        const size = 512
        const canvas = document.createElement("canvas")
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext("2d")!

        // Base dark gray
        ctx.fillStyle = "#2a2a2a"
        ctx.fillRect(0, 0, size, size)

        // Add noise speckles for asphalt grain
        const imageData = ctx.getImageData(0, 0, size, size)
        const data = imageData.data
        for (let i = 0; i < data.length; i += 4) {
            const noise = (Math.random() - 0.5) * 20
            data[i] = Math.max(0, Math.min(255, data[i] + noise))
            data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise))
            data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise))
        }
        ctx.putImageData(imageData, 0, 0)

        // Add some subtle line markings
        ctx.strokeStyle = "rgba(60, 60, 60, 0.3)"
        ctx.lineWidth = 2
        for (let x = 0; x < size; x += 64) {
            ctx.beginPath()
            ctx.moveTo(x + Math.random() * 4, 0)
            ctx.lineTo(x + Math.random() * 4, size)
            ctx.stroke()
        }

        const tex = new THREE.CanvasTexture(canvas)
        tex.wrapS = THREE.RepeatWrapping
        tex.wrapT = THREE.RepeatWrapping
        tex.repeat.set(40, 40)
        tex.anisotropy = 4
        return tex
    }, [])

    if (!visible) return null

    return (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
            <planeGeometry args={[500, 500]} />
            <meshStandardMaterial
                map={texture}
                color="#3a3a3a"
                roughness={0.95}
                metalness={0.05}
            />
        </mesh>
    )
}
