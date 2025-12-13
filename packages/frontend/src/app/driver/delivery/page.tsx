'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function DeliveryIndexPage() {
  const router = useRouter()

  useEffect(() => {
    // 便一覧ページへリダイレクト
    router.push('/driver/departures')
  }, [router])

  return (
    <div className="h-screen flex items-center justify-center bg-gray-900">
      <div className="text-center">
        <div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-gray-400">便一覧へリダイレクト中...</p>
      </div>
    </div>
  )
}

