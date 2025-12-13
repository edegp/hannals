'use client'

import { Suspense, useState, useCallback, useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Environment } from '@react-three/drei'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js'
import * as THREE from 'three'

interface ModelProps {
  objUrl: string
  mtlUrl?: string
}

function Model({ objUrl, mtlUrl }: ModelProps) {
  const [obj, setObj] = useState<THREE.Group | null>(null)
  const { camera } = useThree()

  useEffect(() => {
    let cancelled = false

    const loadModel = async () => {
      console.log('[DEBUG] Starting model load...', { objUrl, mtlUrl })

      try {
        const objLoader = new OBJLoader()

        // MTLがある場合は先に読み込む
        if (mtlUrl) {
          try {
            console.log('[DEBUG] Loading MTL...')
            const mtlLoader = new MTLLoader()
            const materials = await mtlLoader.loadAsync(mtlUrl)
            console.log('[DEBUG] MTL loaded:', materials)
            materials.preload()
            objLoader.setMaterials(materials)
          } catch (e) {
            console.warn('[DEBUG] MTL load failed:', e)
          }
        }

        console.log('[DEBUG] Loading OBJ...')
        const loadedObj = await objLoader.loadAsync(objUrl)
        console.log('[DEBUG] OBJ loaded:', loadedObj)
        console.log('[DEBUG] Children count:', loadedObj.children.length)

        // 子オブジェクトの型を確認
        loadedObj.traverse((child) => {
          console.log('[DEBUG] Child type:', child.type, child.constructor.name, child)
        })

        let meshCount = 0
        let nanMeshCount = 0

        // 全てのメッシュにデフォルトマテリアルを適用
        loadedObj.traverse((child) => {
          // Meshの場合のみ処理
          if (child instanceof THREE.Mesh) {
            meshCount++
            const geometry = child.geometry as THREE.BufferGeometry
            console.log(`[DEBUG] Mesh ${meshCount}:`, {
              name: child.name,
              vertexCount: geometry.attributes.position?.count,
              hasNormals: !!geometry.attributes.normal,
              hasUVs: !!geometry.attributes.uv,
            })

            if (geometry.attributes.position) {
              const positions = geometry.attributes.position.array
              let hasNaN = false
              let nanIndex = -1
              for (let i = 0; i < positions.length; i++) {
                if (isNaN(positions[i])) {
                  hasNaN = true
                  nanIndex = i
                  break
                }
              }
              if (hasNaN) {
                nanMeshCount++
                console.warn(`[DEBUG] Found NaN at index ${nanIndex} in mesh ${meshCount}`)
                child.visible = false
                return
              }
            }

            // マテリアルを設定
            child.material = new THREE.MeshStandardMaterial({
              color: 0x888888,
              roughness: 0.5,
              metalness: 0.1,
              side: THREE.DoubleSide,
            })
          }
        })

        console.log(`[DEBUG] Total meshes: ${meshCount}, NaN meshes: ${nanMeshCount}`)

        // バウンディングボックスを計算
        loadedObj.updateMatrixWorld(true)
        const box = new THREE.Box3().setFromObject(loadedObj)

        console.log('[DEBUG] Bounding box:', {
          min: box.min,
          max: box.max,
          isEmpty: box.isEmpty(),
        })

        if (box.isEmpty() || !isFinite(box.min.x)) {
          console.error('[DEBUG] Invalid bounding box - aborting')
          return
        }

        const center = box.getCenter(new THREE.Vector3())
        const size = box.getSize(new THREE.Vector3())

        console.log('[DEBUG] Model stats:', { center, size })

        // 建築系座標(Y=奥行き)からThree.js座標(Y=上)へ変換
        // X軸で-90度回転
        loadedObj.rotation.x = -Math.PI / 2

        // 回転後にバウンディングボックスを再計算
        loadedObj.updateMatrixWorld(true)
        const rotatedBox = new THREE.Box3().setFromObject(loadedObj)
        const rotatedCenter = rotatedBox.getCenter(new THREE.Vector3())

        // モデルを原点に移動
        loadedObj.position.sub(rotatedCenter)

        // カメラを適切な距離に配置
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

    return () => {
      cancelled = true
    }
  }, [objUrl, mtlUrl, camera])

  if (!obj) return null

  return <primitive object={obj} />
}

function LoadingBox() {
  return (
    <mesh rotation={[0.5, 0.5, 0]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#666" wireframe />
    </mesh>
  )
}

function LoadingOverlay() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 z-10">
      <div className="text-white text-lg">Loading...</div>
    </div>
  )
}

interface ModelViewerProps {
  objUrl: string
  mtlUrl?: string
  className?: string
}

export function ModelViewer({ objUrl, mtlUrl, className = '' }: ModelViewerProps) {
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
          <Model objUrl={objUrl} mtlUrl={mtlUrl} />
        </Suspense>
        <OrbitControls makeDefault />
        <Environment preset="studio" />
      </Canvas>
    </div>
  )
}

// ファイルアップロード対応版
interface UploadableModelViewerProps {
  className?: string
}

export function UploadableModelViewer({ className = '' }: UploadableModelViewerProps) {
  const [objUrl, setObjUrl] = useState<string | null>(null)
  const [mtlUrl, setMtlUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [key, setKey] = useState(0)

  const handleObjUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setIsLoading(true)
      setError(null)
      if (objUrl) URL.revokeObjectURL(objUrl)
      const newUrl = URL.createObjectURL(file)
      setObjUrl(newUrl)
      setKey(prev => prev + 1)
      setTimeout(() => setIsLoading(false), 100)
    }
  }, [objUrl])

  const handleMtlUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (mtlUrl) URL.revokeObjectURL(mtlUrl)
      setMtlUrl(URL.createObjectURL(file))
      if (objUrl) {
        setKey(prev => prev + 1)
      }
    }
  }, [mtlUrl, objUrl])

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      <div className="flex flex-wrap gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">OBJ File (required)</span>
          <input
            type="file"
            accept=".obj"
            onChange={handleObjUpload}
            className="file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-blue-500 file:text-white hover:file:bg-blue-600 cursor-pointer"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">MTL File (optional)</span>
          <input
            type="file"
            accept=".mtl"
            onChange={handleMtlUpload}
            className="file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-gray-500 file:text-white hover:file:bg-gray-600 cursor-pointer"
          />
        </label>
      </div>

      {error && (
        <div className="text-red-500 text-sm">{error}</div>
      )}

      <div className="relative w-full h-[500px] bg-gray-900 rounded-lg overflow-hidden">
        {isLoading && <LoadingOverlay />}
        {objUrl ? (
          <Canvas
            key={key}
            camera={{ position: [0, 0, 5], fov: 50 }}
            gl={{ antialias: true, logarithmicDepthBuffer: true }}
          >
            <ambientLight intensity={0.7} />
            <directionalLight position={[10, 10, 5]} intensity={1} />
            <directionalLight position={[-10, -10, -5]} intensity={0.3} />
            <Suspense fallback={<LoadingBox />}>
              <Model objUrl={objUrl} mtlUrl={mtlUrl || undefined} />
            </Suspense>
            <OrbitControls makeDefault />
            <Environment preset="studio" />
          </Canvas>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            OBJファイルをアップロードしてください
          </div>
        )}
      </div>
    </div>
  )
}
