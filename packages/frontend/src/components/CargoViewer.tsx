'use client'

import { Suspense, useState, useCallback, useEffect } from 'react'
import { Canvas, useThree, ThreeEvent } from '@react-three/fiber'
import { OrbitControls, Environment, Line, Html, Edges } from '@react-three/drei'
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
              transparent: true,
              opacity: 0.3,
              depthWrite: false,
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

        // 原点（0,0,0）を基準に配置（配置座標と一致させるため）
        loadedObj.position.set(
          -rotatedBox.min.x,  // X=0を基準に
          -rotatedBox.min.y,  // 底面をY=0に
          -rotatedBox.min.z   // Z=0を基準に
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

// アイテムの3Dモデルを表示するコンポーネント
function ItemModel({ objData, mtlData, scale: modelScale }: { objData: string, mtlData?: string | null, scale: number }) {
  const [obj, setObj] = useState<THREE.Group | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadModel = async () => {
      try {
        const objLoader = new OBJLoader()

        if (mtlData) {
          try {
            const mtlLoader = new MTLLoader()
            // MTLデータをBlobとして読み込み
            const mtlBlob = new Blob([mtlData], { type: 'text/plain' })
            const mtlUrl = URL.createObjectURL(mtlBlob)
            const materials = await mtlLoader.loadAsync(mtlUrl)
            materials.preload()
            objLoader.setMaterials(materials)
            URL.revokeObjectURL(mtlUrl)
          } catch (e) {
            console.warn('MTL parse failed:', e)
          }
        }

        // OBJデータをBlobとして読み込み
        const objBlob = new Blob([objData], { type: 'text/plain' })
        const objUrl = URL.createObjectURL(objBlob)
        const loadedObj = await objLoader.loadAsync(objUrl)
        URL.revokeObjectURL(objUrl)

        // マテリアルを設定
        loadedObj.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            if (!child.material || (child.material as THREE.Material).type === 'MeshBasicMaterial') {
              child.material = new THREE.MeshStandardMaterial({
                color: 0x8888ff,
                roughness: 0.5,
                metalness: 0.1,
                side: THREE.DoubleSide,
              })
            }
          }
        })

        // 建築系座標変換（Z-up → Y-up）
        loadedObj.rotation.x = -Math.PI / 2

        // スケール調整（m → Three.js単位）
        loadedObj.scale.set(modelScale, modelScale, modelScale)

        // バウンディングボックスを取得して中心に配置
        loadedObj.updateMatrixWorld(true)
        const box = new THREE.Box3().setFromObject(loadedObj)
        const center = box.getCenter(new THREE.Vector3())
        loadedObj.position.sub(center)

        if (!cancelled) {
          setObj(loadedObj)
        }
      } catch (error) {
        console.error('Failed to load item model:', error)
      }
    }

    loadModel()
    return () => { cancelled = true }
  }, [objData, mtlData, modelScale])

  if (!obj) return null

  return <primitive object={obj} />
}

function PlacedItemBox({ item, isSelected, onClick, visible }: PlacedItemBoxProps) {
  const [isHovered, setIsHovered] = useState(false)

  if (!visible) return null

  // mm → m変換（Three.jsの単位）
  const scale = 0.001
  const width = item.x_mm * scale
  const depth = item.y_mm * scale
  const height = item.z_mm * scale
  const posX = item.posX * scale
  const posY = item.posY * scale
  const posZ = item.posZ * scale

  // 色設定（より見やすい色）
  const edgeColor = item.fragile ? '#ff0000' : isSelected ? '#00ff00' : isHovered ? '#00aaff' : '#0066ff'

  return (
    <group
      position={[posX + width / 2, posZ + height / 2, posY + depth / 2]}
      rotation={[0, (item.rotation * Math.PI) / 180, 0]}
    >
      {/* objDataがある場合は3Dモデルを表示、ない場合はワイヤーフレーム */}
      {item.objData ? (
        <group
          onClick={(e) => { e.stopPropagation(); onClick() }}
          onPointerOver={(e) => { e.stopPropagation(); setIsHovered(true) }}
          onPointerOut={() => setIsHovered(false)}
        >
          <ItemModel objData={item.objData} mtlData={item.mtlData} scale={scale} />
          {/* 選択時のアウトライン */}
          {(isSelected || isHovered) && (
            <mesh>
              <boxGeometry args={[width * 1.02, height * 1.02, depth * 1.02]} />
              <meshBasicMaterial
                wireframe={true}
                color={edgeColor}
                transparent={true}
                opacity={0.8}
              />
            </mesh>
          )}
        </group>
      ) : (
        /* ワイヤーフレーム表示（クリック可能） */
        <mesh
          onClick={(e) => { e.stopPropagation(); onClick() }}
          onPointerOver={(e) => { e.stopPropagation(); setIsHovered(true) }}
          onPointerOut={() => setIsHovered(false)}
        >
          <boxGeometry args={[width, height, depth]} />
          <meshBasicMaterial
            wireframe={true}
            color={edgeColor}
            transparent={false}
          />
        </mesh>
      )}

      {/* ホバー時のツールチップ */}
      {isHovered && !isSelected && (
        <Html center distanceFactor={8}>
          <div className="bg-gray-800/90 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap pointer-events-none">
            <div className="font-medium">{item.name || item.id}</div>
            <div className="text-gray-300">{item.x_mm}×{item.y_mm}×{item.z_mm}mm</div>
            {item.destination && <div className="text-yellow-400">{item.destination}</div>}
          </div>
        </Html>
      )}

      {/* 選択されたアイテムのみラベル表示 */}
      {isSelected && (
        <Html center distanceFactor={10}>
          <div className="bg-black/70 text-white text-xs px-1 rounded whitespace-nowrap">
            {item.id}
          </div>
        </Html>
      )}
    </group>
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
      <mesh position={[posX + width / 2, posZ + height / 2, posY + depth / 2]} raycast={() => null}>
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
      <mesh position={[minX + width / 2, minZ + height / 2, minY + depth / 2]} raycast={() => null}>
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

interface EntranceIndicatorProps {
  cargoArea: CargoArea | null
  entranceDirection: string | null
}

function EntranceIndicator({ cargoArea, entranceDirection }: EntranceIndicatorProps) {
  if (!cargoArea || !entranceDirection) return null

  const scale = 0.001
  const width = (cargoArea.maxX - cargoArea.minX) * scale
  const depth = (cargoArea.maxY - cargoArea.minY) * scale
  const height = (cargoArea.maxZ - cargoArea.minZ) * scale
  const centerX = (cargoArea.minX + cargoArea.maxX) / 2 * scale
  const centerY = (cargoArea.minY + cargoArea.maxY) / 2 * scale
  const centerZ = (cargoArea.minZ + cargoArea.maxZ) / 2 * scale

  // 入口の位置と矢印の方向を計算
  let entrancePos: [number, number, number] = [0, 0, 0]
  let arrowEnd: [number, number, number] = [0, 0, 0]
  let labelOffset: [number, number, number] = [0, 0, 0]
  const arrowLength = Math.min(width, depth) * 0.3

  switch (entranceDirection) {
    case 'front': // Y方向+（手前）
      entrancePos = [centerX, height * 0.1, cargoArea.maxY * scale]
      arrowEnd = [centerX, height * 0.1, cargoArea.maxY * scale + arrowLength]
      labelOffset = [0, 0.2, 0.3]
      break
    case 'back': // Y方向-（奥）
      entrancePos = [centerX, height * 0.1, cargoArea.minY * scale]
      arrowEnd = [centerX, height * 0.1, cargoArea.minY * scale - arrowLength]
      labelOffset = [0, 0.2, -0.3]
      break
    case 'left': // X方向-
      entrancePos = [cargoArea.minX * scale, height * 0.1, centerY]
      arrowEnd = [cargoArea.minX * scale - arrowLength, height * 0.1, centerY]
      labelOffset = [-0.3, 0.2, 0]
      break
    case 'right': // X方向+
      entrancePos = [cargoArea.maxX * scale, height * 0.1, centerY]
      arrowEnd = [cargoArea.maxX * scale + arrowLength, height * 0.1, centerY]
      labelOffset = [0.3, 0.2, 0]
      break
  }

  // 矢印の先端（三角形）を作成
  const arrowHeadSize = arrowLength * 0.3

  // コーンの回転を計算（デフォルトはY+方向）
  let coneRotation: [number, number, number] = [0, 0, 0]
  switch (entranceDirection) {
    case 'front': // Z+方向
      coneRotation = [Math.PI / 2, 0, 0]
      break
    case 'back': // Z-方向
      coneRotation = [-Math.PI / 2, 0, 0]
      break
    case 'left': // X-方向
      coneRotation = [0, 0, Math.PI / 2]
      break
    case 'right': // X+方向
      coneRotation = [0, 0, -Math.PI / 2]
      break
  }

  return (
    <group>
      {/* 入口を示す線 */}
      <Line
        points={[entrancePos, arrowEnd]}
        color="#22c55e"
        lineWidth={4}
      />

      {/* 矢印の先端（コーン） */}
      <mesh position={arrowEnd} rotation={coneRotation}>
        <coneGeometry args={[arrowHeadSize * 0.5, arrowHeadSize, 8]} />
        <meshBasicMaterial color="#22c55e" />
      </mesh>

      {/* 入口ラベル */}
      <Html
        position={[
          arrowEnd[0] + labelOffset[0],
          arrowEnd[1] + labelOffset[1],
          arrowEnd[2] + labelOffset[2]
        ]}
        center
        distanceFactor={8}
      >
        <div className="bg-green-600 text-white text-sm px-2 py-1 rounded font-bold whitespace-nowrap shadow-lg">
          入口 ↓
        </div>
      </Html>

      {/* 奥側ラベル */}
      <Html
        position={[
          entranceDirection === 'front' ? centerX : entranceDirection === 'back' ? centerX : entranceDirection === 'left' ? cargoArea.maxX * scale : cargoArea.minX * scale,
          height * 0.8,
          entranceDirection === 'front' ? cargoArea.minY * scale : entranceDirection === 'back' ? cargoArea.maxY * scale : centerY
        ]}
        center
        distanceFactor={8}
      >
        <div className="bg-gray-700 text-gray-300 text-xs px-2 py-1 rounded whitespace-nowrap">
          奥
        </div>
      </Html>
    </group>
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
          {/* CargoAreaBox removed - OBJ model shows cargo area */}
          <EntranceIndicator cargoArea={cargoArea} entranceDirection={entranceDirection} />
          {placedItems.map((item) => (
            <PlacedItemBox
              key={item.id}
              item={item}
              isSelected={item.id === selectedItemId}
              onClick={() => onItemSelect(item.id)}
              visible={(item.loadOrder ?? item.order) <= maxOrder}
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
