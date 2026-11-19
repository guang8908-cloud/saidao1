'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const CampusMap = dynamic(() => import('@/components/campus-map'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full rounded-2xl bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center">
      <span className="text-gray-400 text-sm">加载地图中...</span>
    </div>
  ),
});

type CampusId = 'haizhu' | 'baiyun' | 'all';

export default function HomePage() {
  const router = useRouter();
  const [selectedCampus, setSelectedCampus] = useState<CampusId | null>(null);
  const [showTip, setShowTip] = useState(false);

  const campusOptions: { id: CampusId; label: string; icon: string }[] = [
    { id: 'haizhu', label: '海珠校区', icon: '🏛' },
    { id: 'baiyun', label: '白云校区', icon: '🏔' },
    { id: 'all', label: '全部校区', icon: '🌍' },
  ];

  const handleCampusSelect = (campusId: CampusId) => {
    setSelectedCampus(campusId);
    setShowTip(false);
  };

  const handleNext = () => {
    if (!selectedCampus) {
      setShowTip(true);
      return;
    }
    router.push(`/select?campus=${selectedCampus}`);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#FAFBFE] via-[#F5F7FB] to-[#F0F4F8]">
      {/* Background Decorations */}
      <div className="bg-decoration bg-circle bg-[#7EB3E0]/20 w-[400px] h-[400px] -top-[150px] -left-[100px]" />
      <div className="bg-decoration bg-circle bg-[#6DD5A8]/15 w-[300px] h-[300px] bottom-[10%] right-[5%]" />

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center min-h-screen px-4 py-8 sm:px-6">
        {/* Header */}
        <div className="text-center mb-6 animate-fade-in-up">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1a1a2e] tracking-tight">
            仲恺校园
            <span className="relative inline-block">
              <span className="relative z-10">百事通</span>
              <span className="absolute bottom-0.5 left-0 right-0 h-2 bg-[#6DD5A8]/25 rounded-sm -z-0" />
            </span>
          </h1>
          <p className="mt-2 text-sm text-gray-500">选择校区，开始探索</p>
        </div>

        {/* Campus Selector */}
        <div className="w-full max-w-md mb-4 animate-fade-in-up">
          <div className="flex items-center justify-center gap-3">
            {campusOptions.map((option) => {
              const isSelected = selectedCampus === option.id;
              return (
                <button
                  key={option.id}
                  onClick={() => handleCampusSelect(option.id)}
                  className={`
                    flex-1 flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl text-sm font-medium
                    transition-all duration-300 border-2
                    ${isSelected
                      ? 'bg-[#1E3A5F] text-white border-[#1E3A5F] shadow-lg shadow-[#1E3A5F]/20 scale-[1.02]'
                      : 'bg-white/80 text-gray-700 border-gray-200 hover:border-[#1E3A5F]/50 hover:bg-white hover:shadow-md'
                    }
                    active:scale-[0.97]
                  `}
                >
                  <span className="text-lg">{option.icon}</span>
                  <span>{option.label}</span>
                  {isSelected && <span className="ml-1">✓</span>}
                </button>
              );
            })}
          </div>
          {/* Tip message */}
          {showTip && (
            <p className="mt-2 text-center text-sm text-[#E8567F] animate-fade-in">
              请先选择校区
            </p>
          )}
        </div>

        {/* Campus Map - Shows selected campus or default haizhu */}
        <div className="w-full max-w-md sm:max-w-lg lg:max-w-2xl flex-1 min-h-0 animate-fade-in-up">
          <div className="relative w-full h-full min-h-[300px] sm:min-h-[350px] lg:min-h-[450px] rounded-2xl overflow-hidden border border-gray-200/50 shadow-lg">
            <CampusMap campus={selectedCampus || 'haizhu'} />
          </div>
        </div>

        {/* Next Button */}
        <div className="w-full max-w-md mt-4 animate-fade-in-up">
          <button
            onClick={handleNext}
            className="
              w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl text-base font-semibold
              transition-all duration-300
              bg-gradient-to-r from-[#1E3A5F] to-[#3B6CB4] text-white
              hover:shadow-xl hover:shadow-[#1E3A5F]/30 hover:scale-[1.02]
              active:scale-[0.98]
            "
          >
            <span>选择校园助手</span>
            <span>→</span>
          </button>
        </div>

        {/* Footer */}
        <p className="mt-4 text-xs text-gray-400">
          仲恺农业工程学院 &middot; 校园智能助手
        </p>
      </div>
    </div>
  );
}
