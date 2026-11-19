'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

interface WeatherData {
  temperature: string;
  description: string;
  icon: string;
  wind: string;
  humidity: string;
  location: string;
}

// Weather background gradients based on conditions
const weatherGradients: Record<string, string> = {
  '晴': 'from-orange-300 via-yellow-200 to-blue-300',
  '多云': 'from-blue-300 via-gray-200 to-blue-400',
  '阴': 'from-gray-400 via-gray-300 to-gray-500',
  '小雨': 'from-blue-400 via-blue-300 to-gray-400',
  '中雨': 'from-blue-500 via-blue-400 to-gray-500',
  '大雨': 'from-blue-600 via-blue-500 to-gray-600',
  '雷阵雨': 'from-purple-500 via-blue-500 to-gray-600',
  '雪': 'from-blue-100 via-white to-blue-200',
  '雾': 'from-gray-300 via-gray-200 to-gray-400',
  'default': 'from-blue-300 via-cyan-200 to-teal-300',
};

// Weather emojis for different conditions
const weatherEmojis: Record<string, string> = {
  '晴': '☀️',
  '多云': '⛅',
  '阴': '☁️',
  '小雨': '🌦️',
  '中雨': '🌧️',
  '大雨': '⛈️',
  '雷阵雨': '⛈️',
  '雪': '🌨️',
  '雾': '🌫️',
  'default': '🌤️',
};

export default function WeatherPage() {
  const [city, setCity] = useState('广州');
  const [inputCity, setInputCity] = useState('');
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPoster, setShowPoster] = useState(false);

  useEffect(() => {
    fetchWeather(city);
  }, [city]);

  const fetchWeather = async (cityName: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/weather?city=${encodeURIComponent(cityName)}`);
      if (!res.ok) throw new Error('获取天气失败');
      const data = await res.json();
      setWeather(data);
      setShowPoster(true);
    } catch (err) {
      setError('获取天气失败，请稍后重试');
      setShowPoster(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputCity.trim()) {
      setCity(inputCity.trim());
      setInputCity('');
    }
  };

  const getGradient = () => {
    if (!weather) return weatherGradients['default'];
    for (const [key, gradient] of Object.entries(weatherGradients)) {
      if (weather.description.includes(key)) return gradient;
    }
    return weatherGradients['default'];
  };

  const getWeatherEmoji = () => {
    if (!weather) return weatherEmojis['default'];
    for (const [key, emoji] of Object.entries(weatherEmojis)) {
      if (weather.description.includes(key)) return emoji;
    }
    return weatherEmojis['default'];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-medium">返回</span>
          </Link>
          <h1 className="text-lg font-bold text-gray-800">天气 Live Photo</h1>
          <div className="w-12" />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* City Input */}
        <div className="mb-8">
          <form onSubmit={handleSubmit} className="flex gap-3">
            <div className="flex-1 relative">
              <svg
                className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={inputCity}
                onChange={(e) => setInputCity(e.target.value)}
                placeholder="输入城市名，如：北京、上海、广州..."
                className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-200 rounded-2xl text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !inputCity.trim()}
              className="px-6 py-3.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-medium rounded-2xl hover:shadow-lg hover:shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                '查询'
              )}
            </button>
          </form>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* Weather Poster / Live Photo */}
        {weather && showPoster && (
          <div className="animate-fade-in">
            {/* Main Poster Card */}
            <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${getGradient()} shadow-2xl shadow-blue-500/20`}>
              {/* Animated background elements */}
              <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-20 -right-20 w-60 h-60 bg-white/20 rounded-full blur-3xl animate-pulse" />
                <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-white/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
              </div>

              {/* Content */}
              <div className="relative z-10 p-8 sm:p-12">
                {/* Location & Time */}
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-white/90 font-medium">{weather.location}</span>
                  </div>
                  <div className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full">
                    <span className="text-white/90 text-sm font-medium">LIVE</span>
                  </div>
                </div>

                {/* Weather Icon & Temperature */}
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <div className="text-7xl sm:text-8xl font-black text-white mb-2">
                      {weather.temperature}
                    </div>
                    <div className="text-xl sm:text-2xl text-white/80 font-medium">
                      {weather.description}
                    </div>
                  </div>
                  <div className="text-8xl sm:text-9xl animate-float">
                    {getWeatherEmoji()}
                  </div>
                </div>

                {/* Weather Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <svg className="w-4 h-4 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                      <span className="text-white/70 text-sm">风力</span>
                    </div>
                    <div className="text-white font-bold text-lg">{weather.wind}</div>
                  </div>
                  <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <svg className="w-4 h-4 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                      </svg>
                      <span className="text-white/70 text-sm">湿度</span>
                    </div>
                    <div className="text-white font-bold text-lg">{weather.humidity}</div>
                  </div>
                </div>
              </div>

              {/* Live Photo indicator dots */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                <div className="w-2 h-2 bg-white/60 rounded-full" />
                <div className="w-2 h-2 bg-white/40 rounded-full" />
                <div className="w-2 h-2 bg-white/40 rounded-full" />
              </div>
            </div>

            {/* Quick Actions */}
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <button
                onClick={() => setCity('广州')}
                className="p-4 bg-white rounded-2xl border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all text-center"
              >
                <span className="text-2xl mb-1 block">🏫</span>
                <span className="text-sm text-gray-600 font-medium">仲恺海珠</span>
              </button>
              <button
                onClick={() => setCity('广州白云')}
                className="p-4 bg-white rounded-2xl border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all text-center"
              >
                <span className="text-2xl mb-1 block">🌳</span>
                <span className="text-sm text-gray-600 font-medium">仲恺白云</span>
              </button>
              <button
                onClick={() => setCity('北京')}
                className="p-4 bg-white rounded-2xl border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all text-center"
              >
                <span className="text-2xl mb-1 block">🏛️</span>
                <span className="text-sm text-gray-600 font-medium">北京</span>
              </button>
              <button
                onClick={() => setCity('上海')}
                className="p-4 bg-white rounded-2xl border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all text-center"
              >
                <span className="text-2xl mb-1 block">🌆</span>
                <span className="text-sm text-gray-600 font-medium">上海</span>
              </button>
            </div>

            {/* Share hint */}
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-400">
                长按海报可保存为 Live Photo 风格图片
              </p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!weather && !loading && !error && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🌤️</div>
            <h3 className="text-xl font-bold text-gray-700 mb-2">查看实时天气</h3>
            <p className="text-gray-500">输入城市名称，生成精美天气海报</p>
          </div>
        )}
      </main>
    </div>
  );
}
