'use client'

import { Suspense, useState, useCallback, useEffect, useRef } from 'react'
import { Canvas, useThree, ThreeEvent } from '@react-three/fiber'
import { OrbitControls, Environment, Line, Html } from '@react-three/drei'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js'
import * as THREE from 'three'
import { PlacedItem, ClickPoint, CargoArea } from '@/types'

interface CargoModelProps {
  objUrl: string
  mtlUrl?: string
  onPointClick?: (point: ClickPoint) => void
  isSelectingArea: boolean
}

function CargoModel({ objUrl, mtlUrl, onPointClick, isSelectingArea }: CargoModelProps) {
  const [obj, setObj] = useState<THREE.Group | null>(null)
  const { camera, raycaster, pointer, scene } = useThree()

  useEffect(() => {
    let cancelled = false

    const loadModel = async () => {
      try {
        const objLoader = new OBJLoader()

        if (mtlUrl) {
          try {
            const mtlLoader = new MTLLoader()
            const materials = await mtlLoader.loadAsync(mtlUrl)
            materials.preload()
            objLoader.setMaterials(materials)
          } catch (e) {
            console.warn('MTL load failed:', e)
          }
        }

        const loadedObj = await objLoader.loadAsync(objUrl)

        loadedObj.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.material = new THREE.MeshStandardMaterial({
              color: 0x888888,
              roughness: 0.5,
              metalness: 0.1,
              side: THREE.DoubleSide,
            })
          }
        })

        loadedObj.updateMatrixWorld(true)
        const box = new THREE.Box3().setFromObject(loadedObj)
        const size = box.getSize(new THREE.Vector3())

        // 建築系座標変換（Z-up → Y-up）
        loadedObj.rotation.x = -Math.PI / 2
        loadedObj.updateMatrixWorld(true)
        const rotatedBox = new THREE.Box3().setFromObject(loadedObj)
        const rotatedCenter = rotatedBox.getCenter(new THREE.Vector3())

        // 水平方向（X, Z）は中央に、垂直方向（Y）は底面をY=0に配置
        loadedObj.position.set(
          -rotatedCenter.x,
          -rotatedBox.min.y,  // 底面をY=0に
          -rotatedCenter.z
        )

        const maxDim = Math.max(size.x, size.y, size.z)
        const distance = maxDim * 1.5

        if (camera instanceof THREE.PerspectiveCamera) {
          camera.position.set(distance * 0.5, distance * 0.5, distance)
          camera.near = 0.1
          camera.far = distance * 10
          camera.lookAt(0, 0, 0)
          camera.updateProjectionMatrix()
        }

        if (!cancelled) {
          setObj(loadedObj)
        }
      } catch (error) {
        console.error('Failed to load model:', error)
      }
    }

    loadModel()
    return () => { cancelled = true }
  }, [objUrl, mtlUrl, camera])

  const handleClick = useCallback((event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    if (!isSelectingArea || !onPointClick) return

    const point = event.point
    console.log('Clicked point:', point)
    onPointClick({ x: point.x, y: point.y, z: point.z })
  }, [isSelectingArea, onPointClick])

  if (!obj) return null

  return (
    <primitive
      object={obj}
      onClick={handleClick}
      onPointerOver={() => isSelectingArea && (document.body.style.cursor = 'crosshair')}
      onPointerOut={() => document.body.style.cursor = 'auto'}
    />
  )
}

interface PlacedItemBoxProps {
  item: PlacedItem
  isSelected: boolean
  onClick: () => void
  visible: boolean
}

function PlacedItemBox({ item, isSelected, onClick, visible }: PlacedItemBoxProps) {
  if (!visible) return null

  // mm → m変換（Three.jsの単位）
  const scale = 0.001
  const width = item.x_mm * scale
  const depth = item.y_mm * scale
  const height = item.z_mm * scale
  const posX = item.posX * scale
  const posY = item.posY * scale
  const posZ = item.posZ * scale

  // 色設定
  const color = item.fragile ? '#ff6b6b' : isSelected ? '#4ecdc4' : '#45b7d1'

  return (
    <mesh
      position={[posX + width/2, posZ + height/2, posY + depth/2]}
      rotation={[0, (item.rotation * Math.PI) / 180, 0]}
      onClick={(e) => { e.stopPropagation(); onClick() }}
    >
      <boxGeometry args={[width, height, depth]} />
      <meshStandardMaterial 
        color={color} 
        transparent 
        opacity={isSelected ? 0.9 : 0.7}
      />
      <Html center distanceFactor={10}>
        <div className="bg-black/70 text-white text-xs px-1 rounded whitespace-nowrap">
          {item.itemId}
        </div>
      </Html>
    </mesh>
  )
}

interface CargoAreaBoxProps {
  area: CargoArea | null
  points: ClickPoint[]
}

function CargoAreaBox({ area, points }: CargoAreaBoxProps) {
  if (area) {
    const scale = 0.001
    const width = (area.maxX - area.minX) * scale
    const depth = (area.maxY - area.minY) * scale
    const height = (area.maxZ - area.minZ) * scale
    const posX = area.minX * scale
    const posY = area.minY * scale
    const posZ = area.minZ * scale

    return (
      <mesh position={[posX + width/2, posZ + height/2, posY + depth/2]} raycast={() => null}>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color="#22c55e" transparent opacity={0.2} wireframe />
      </mesh>
    )
  }

  if (points && points.length === 2) {
    const scale = 0.001
    const minX = Math.min(points[0].x, points[1].x) * scale
    const maxX = Math.max(points[0].x, points[1].x) * scale
    const minY = Math.min(points[0].y, points[1].y) * scale
    const maxY = Math.max(points[0].y, points[1].y) * scale
    const minZ = Math.min(points[0].z, points[1].z) * scale
    const maxZ = Math.max(points[0].z, points[1].z) * scale

    const width = maxX - minX
    const depth = maxY - minY
    const height = maxZ - minZ

    return (
      <mesh position={[minX + width/2, minZ + height/2, minY + depth/2]} raycast={() => null}>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color="#fbbf24" transparent opacity={0.3} />
      </mesh>
    )
  }

  return null
}

function LoadingBox() {
  return (
    <mesh rotation={[0.5, 0.5, 0]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#666" wireframe />
    </mesh>
  )
}

interface CargoViewerProps {
  objUrl: string
  mtlUrl?: string
  placedItems: PlacedItem[]
  selectedItemId: string | null
  onItemSelect: (id: string | null) => void
  maxOrder: number
  cargoArea: CargoArea | null
  entrancePoint: ClickPoint | null
  entranceDirection: string | null
  isSelectingEntrance: boolean
  onEntranceClick: (point: ClickPoint) => void
  onCargoAreaDetected: (area: CargoArea) => void
  className?: string
}

export function CargoViewer({
  objUrl,
  mtlUrl,
  placedItems,
  selectedItemId,
  onItemSelect,
  maxOrder,
  cargoArea,
  entrancePoint,
  entranceDirection,
  isSelectingEntrance,
  onEntranceClick,
  onCargoAreaDetected,
  className = ''
}: CargoViewerProps) {
  return (
    <div className={`w-full h-full ${className}`}>
      <Canvas
        camera={{ position: [0, 0, 5], fov: 50 }}
        gl={{ antialias: true, logarithmicDepthBuffer: true }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <directionalLight position={[-10, -10, -5]} intensity={0.3} />
        <Suspense fallback={<LoadingBox />}>
          <CargoModel
            objUrl={objUrl}
            mtlUrl={mtlUrl}
            onPointClick={onEntranceClick}
            isSelectingArea={isSelectingEntrance}
          />
          <CargoAreaBox area={cargoArea} points={[]} />
          {placedItems.map((item) => (
            <PlacedItemBox
              key={item.itemId}
              item={item}
              isSelected={item.itemId === selectedItemId}
              onClick={() => onItemSelect(item.itemId)}
              visible={item.order <= maxOrder}
            />
          ))}
        </Suspense>
        <OrbitControls makeDefault />
        <Environment preset="studio" />
        <gridHelper args={[100, 100, '#666', '#444']} raycast={() => null} />
      </Canvas>
    </div>
  )
}
