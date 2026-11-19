import { NextResponse } from 'next/server';

interface WeatherData {
  temperature: string;
  description: string;
  icon: string;
  wind: string;
  humidity: string;
  location: string;
}

// Open-Meteo weather codes to Chinese descriptions
const WEATHER_CODE_MAP: Record<number, { desc: string; icon: string }> = {
  0: { desc: '晴', icon: '☀️' },
  1: { desc: '大部晴朗', icon: '🌤️' },
  2: { desc: '多云', icon: '⛅' },
  3: { desc: '阴', icon: '☁️' },
  45: { desc: '雾', icon: '🌫️' },
  48: { desc: '冻雾', icon: '🌫️' },
  51: { desc: '毛毛雨', icon: '🌦️' },
  53: { desc: '毛毛雨', icon: '🌦️' },
  55: { desc: '毛毛雨', icon: '🌦️' },
  61: { desc: '小雨', icon: '🌦️' },
  63: { desc: '中雨', icon: '🌧️' },
  65: { desc: '大雨', icon: '🌧️' },
  66: { desc: '冻雨', icon: '🌧️' },
  67: { desc: '冻雨', icon: '🌧️' },
  71: { desc: '小雪', icon: '🌨️' },
  73: { desc: '中雪', icon: '❄️' },
  75: { desc: '大雪', icon: '❄️' },
  77: { desc: '雪粒', icon: '🌨️' },
  80: { desc: '阵雨', icon: '🌦️' },
  81: { desc: '阵雨', icon: '🌧️' },
  82: { desc: '暴雨', icon: '🌧️' },
  85: { desc: '阵雪', icon: '🌨️' },
  86: { desc: '阵雪', icon: '❄️' },
  95: { desc: '雷阵雨', icon: '⛈️' },
  96: { desc: '雷阵雨', icon: '⛈️' },
  99: { desc: '雷暴', icon: '⛈️' },
};

function getWindDirection(deg: number): string {
  const dirs = ['北风', '东北风', '东风', '东南风', '南风', '西南风', '西风', '西北风'];
  return dirs[Math.round(deg / 45) % 8];
}

function getWindLevel(speedKmh: number): string {
  if (speedKmh < 2) return '无风';
  if (speedKmh < 6) return '微风';
  if (speedKmh < 12) return '轻风';
  if (speedKmh < 20) return '微风';
  if (speedKmh < 29) return '和风';
  if (speedKmh < 39) return '清风';
  if (speedKmh < 50) return '强风';
  return '大风';
}

// Guangzhou coordinates (Zhongkai University)
const GUANGZHOU_LAT = 23.1291;
const GUANGZHOU_LON = 113.2644;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const city = searchParams.get('city') || 'Guangzhou';
  const displayName = city === '广州白云' ? '仲恺·广州' : city.includes('广州') ? '仲恺·广州' : city;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    // Use Open-Meteo API (free, no API key required)
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${GUANGZHOU_LAT}&longitude=${GUANGZHOU_LON}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m&timezone=Asia/Shanghai`;

    const response = await fetch(url, {
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Weather API returned ${response.status}`);
    }

    const data = await response.json();
    const current = data.current;

    if (!current) {
      throw new Error('No weather data available');
    }

    const weatherCode = current.weather_code ?? 2;
    const weatherInfo = WEATHER_CODE_MAP[weatherCode] || { desc: '多云', icon: '⛅' };
    const windDeg = current.wind_direction_10m ?? 0;
    const windSpeed = current.wind_speed_10m ?? 0;
    const windDir = getWindDirection(windDeg);
    const windLevel = getWindLevel(windSpeed);

    const result: WeatherData = {
      temperature: `${Math.round(current.temperature_2m)}°C`,
      description: weatherInfo.desc,
      icon: weatherInfo.icon,
      wind: `${windDir} ${windLevel}`,
      humidity: `${current.relative_humidity_2m}%`,
      location: displayName,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Weather API error:', error);
    return NextResponse.json(
      {
        temperature: '--',
        description: '获取失败',
        icon: '🌐',
        wind: '--',
        humidity: '--',
        location: displayName,
      },
      { status: 500 }
    );
  }
}
