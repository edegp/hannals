'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function Home() {
  const router = useRouter()

  // 自動的に積み込み画面にリダイレクト
  useEffect(() => {
    router.push('/loading')
  }, [router])

  return (
    <div className="h-screen flex items-center justify-center bg-gray-900">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white mb-8">荷台3Dビューアー</h1>
        <div className="flex gap-4 justify-center">
          <Link
            href="/loading"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
          >
            積み込み画面
          </Link>
          <Link
            href="/delivery"
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-500 transition-colors"
          >
            配送画面
          </Link>
        </div>
        <p className="text-gray-500 mt-4">リダイレクト中...</p>
      </div>
    </div>
  )
}
