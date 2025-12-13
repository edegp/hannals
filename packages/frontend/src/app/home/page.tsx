'use client'

export default function HomePage() {
  const navigateTo = (path: string) => {
    window.location.href = path
  }

  const menuItems = [
    {
      category: '倉庫スタッフ向け',
      icon: '📦',
      color: 'blue',
      items: [
        {
          title: '積み込み計画生成',
          path: '/warehouse/loading-plan',
          description: '商品CSVをアップロードし、車両を選択して積み込み計画を生成します',
          features: ['商品CSVアップロード', '車両選択', '3D表示'],
        },
        {
          title: '積み込み作業支援（3D）',
          path: '/warehouse/loading-work',
          description: '積み込み順序に従って、荷物の配置位置を3Dで確認しながら作業できます',
          features: ['荷物リスト', '3D配置指示', '進捗管理'],
        },
      ],
    },
    {
      category: 'ドライバー向け',
      icon: '🚚',
      color: 'green',
      items: [
        {
          title: '出発便一覧（本日の担当）',
          path: '/driver/departures',
          description: '本日の担当便を確認し、配送画面へ遷移できます',
          features: ['便一覧', 'ステータス確認', '出発管理'],
        },
        {
          title: '配送・取り出し支援（3D）',
          path: '/driver/delivery/BIN-20251213-001',
          description: 'Stop単位で荷物の位置を確認し、取り出しを支援します',
          features: ['Stop選択', '荷物ハイライト', '配送進捗'],
        },
      ],
    },
  ]

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'blue':
        return {
          bg: 'bg-blue-900',
          border: 'border-blue-700',
          text: 'text-blue-400',
          button: 'bg-blue-600 hover:bg-blue-500',
        }
      case 'green':
        return {
          bg: 'bg-green-900',
          border: 'border-green-700',
          text: 'text-green-400',
          button: 'bg-green-600 hover:bg-green-500',
        }
      default:
        return {
          bg: 'bg-gray-900',
          border: 'border-gray-700',
          text: 'text-gray-400',
          button: 'bg-gray-600 hover:bg-gray-500',
        }
    }
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* ヘッダー */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-white mb-2">積み込み最適化支援ツール</h1>
          <p className="text-gray-400">配送順×積載レイアウト - 物流現場の作業効率化</p>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* システム概要 */}
        <section className="mb-12">
          <div className="bg-gradient-to-r from-blue-900 to-purple-900 border border-blue-700 rounded-lg p-6">
            <h2 className="text-2xl font-bold text-white mb-4">🎯 システム概要</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-white">
              <div className="bg-black bg-opacity-30 rounded-lg p-4">
                <div className="text-3xl mb-2">📊</div>
                <h3 className="font-semibold mb-2">計画生成</h3>
                <p className="text-sm text-gray-300">
                  配送順に沿った積み込み計画を自動生成し、3Dで可視化
                </p>
              </div>
              <div className="bg-black bg-opacity-30 rounded-lg p-4">
                <div className="text-3xl mb-2">🏗️</div>
                <h3 className="font-semibold mb-2">作業支援</h3>
                <p className="text-sm text-gray-300">
                  積み込み順序を表示し、現場スタッフの作業を支援
                </p>
              </div>
              <div className="bg-black bg-opacity-30 rounded-lg p-4">
                <div className="text-3xl mb-2">🚛</div>
                <h3 className="font-semibold mb-2">配送支援</h3>
                <p className="text-sm text-gray-300">
                  ドライバーがStop単位で荷物位置を確認可能
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* メニュー */}
        {menuItems.map((category) => {
          const colors = getColorClasses(category.color)
          return (
            <section key={category.category} className="mb-12">
              <div className="flex items-center gap-3 mb-6">
                <div className="text-4xl">{category.icon}</div>
                <h2 className="text-2xl font-bold text-white">{category.category}</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {category.items.map((item) => (
                  <div
                    key={item.path}
                    className={`${colors.bg} border ${colors.border} rounded-lg p-6 hover:border-opacity-100 transition-all`}
                  >
                    <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                    <p className="text-gray-300 text-sm mb-4">{item.description}</p>

                    <div className="mb-4">
                      <div className="text-xs text-gray-400 mb-2">主な機能:</div>
                      <div className="flex flex-wrap gap-2">
                        {item.features.map((feature) => (
                          <span
                            key={feature}
                            className="px-3 py-1 bg-gray-800 text-gray-300 rounded-full text-xs"
                          >
                            {feature}
                          </span>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => navigateTo(item.path)}
                      className={`w-full px-6 py-3 ${colors.button} text-white rounded-lg font-semibold transition-colors`}
                    >
                      画面を開く →
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )
        })}

        {/* その他のリンク */}
        <section className="mt-12">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h2 className="text-xl font-bold text-white mb-4">その他</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => navigateTo('/')}
                className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 font-semibold"
              >
                📊 デモ画面（旧）
              </button>
              <button
                onClick={() => window.open('https://github.com', '_blank')}
                className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 font-semibold"
              >
                📖 ドキュメント
              </button>
              <button
                onClick={() => alert('設定画面は未実装です')}
                className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 font-semibold"
              >
                ⚙️ 設定
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* フッター */}
      <footer className="bg-gray-800 border-t border-gray-700 px-6 py-4 mt-12">
        <div className="max-w-7xl mx-auto text-center text-gray-400 text-sm">
          <p>積み込み最適化支援ツール © 2025</p>
          <p className="mt-1">配送現場の作業効率化を支援します</p>
        </div>
      </footer>
    </div>
  )
}


