import { useState, useEffect } from "react";
import {
  WiDaySunny, WiNightClear, WiDayCloudy, WiNightAltCloudy, WiCloudy,
  WiFog, WiSprinkle, WiRain, WiSnow, WiShowers, WiThunderstorm, WiCloud,
} from "react-icons/wi";
import { LOGOS } from "../../constants";

const PODGORICA = { lat: 42.4411, lon: 19.2636 };
const WEATHER_CACHE_KEY = "weather:podgorica";
const WEATHER_MAX_AGE_MS = 30 * 60 * 1000;

const WEATHER_URL =
  `https://api.open-meteo.com/v1/forecast?latitude=${PODGORICA.lat}&longitude=${PODGORICA.lon}` +
  "&timezone=Europe/Podgorica&forecast_days=1&wind_speed_unit=ms" +
  "&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day" +
  "&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max";

interface WeatherData {
  tempC: number;
  feelsC: number;
  code: number;
  windMs: number;
  isDay: boolean;
  maxC: number;
  minC: number;
  precipProb: number | null;
  uvIndex: number | null;
}

interface WeatherCache {
  fetchedAt: number;
  data: WeatherData;
}

interface OpenMeteoResponse {
  current: {
    temperature_2m: number;
    apparent_temperature: number;
    weather_code: number;
    wind_speed_10m: number;
    is_day: number;
  };
  daily: {
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: (number | null)[];
    uv_index_max: (number | null)[];
  };
}

function parseWeather(json: OpenMeteoResponse): WeatherData {
  const c = json.current;
  const d = json.daily;
  return {
    tempC: c.temperature_2m,
    feelsC: c.apparent_temperature,
    code: c.weather_code,
    windMs: c.wind_speed_10m,
    isDay: c.is_day === 1,
    maxC: d.temperature_2m_max[0],
    minC: d.temperature_2m_min[0],
    precipProb: d.precipitation_probability_max?.[0] ?? null,
    uvIndex: d.uv_index_max?.[0] ?? null,
  };
}

function readCache(): WeatherCache | null {
  try {
    const raw = localStorage.getItem(WEATHER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WeatherCache;
    if (!parsed?.data || typeof parsed.fetchedAt !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function weatherLabel(code: number): string {
  if (code === 0) return "Ясно";
  if (code <= 2) return "Малооблачно";
  if (code === 3) return "Пасмурно";
  if (code === 45 || code === 48) return "Туман";
  if (code >= 51 && code <= 57) return "Морось";
  if (code >= 61 && code <= 67) return "Дождь";
  if (code >= 71 && code <= 77) return "Снег";
  if (code >= 80 && code <= 82) return "Ливень";
  if (code >= 85 && code <= 86) return "Снегопад";
  if (code >= 95) return "Гроза";
  return "—";
}

function WeatherIcon({ code, isDay }: { code: number; isDay: boolean }) {
  const cls = "weather-strip-icon";
  if (code === 0) return isDay ? <WiDaySunny className={cls} /> : <WiNightClear className={cls} />;
  if (code <= 2) return isDay ? <WiDayCloudy className={cls} /> : <WiNightAltCloudy className={cls} />;
  if (code === 3) return <WiCloudy className={cls} />;
  if (code === 45 || code === 48) return <WiFog className={cls} />;
  if (code >= 51 && code <= 57) return <WiSprinkle className={cls} />;
  if (code >= 61 && code <= 67) return <WiRain className={cls} />;
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return <WiSnow className={cls} />;
  if (code >= 80 && code <= 82) return <WiShowers className={cls} />;
  if (code >= 95) return <WiThunderstorm className={cls} />;
  return <WiCloud className={cls} />;
}

const rnd = (n: number) => Math.round(n);

function WeatherStrip() {
  const [weather, setWeather] = useState<WeatherData | null>(() => readCache()?.data ?? null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const cached = readCache();
    if (cached && Date.now() - cached.fetchedAt < WEATHER_MAX_AGE_MS) return;

    let cancelled = false;
    fetch(WEATHER_URL, { signal: AbortSignal.timeout(8000) })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((json) => {
        if (cancelled) return;
        const data = parseWeather(json);
        setWeather(data);
        try {
          localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), data }));
        } catch { /* quota — ignore */ }
      })
      .catch(() => { if (!cancelled) setFailed(true); });

    return () => { cancelled = true; };
  }, []);

  if (!weather) {
    if (failed) return null;
    return (
      <div className="weather-strip weather-strip--loading" aria-hidden="true">
        <span className="weather-strip-temp">—°</span>
        <span className="weather-strip-meta">Подгорица · сегодня</span>
      </div>
    );
  }

  return (
    <div className="weather-strip">
      <WeatherIcon code={weather.code} isDay={weather.isDay} />
      <span className="weather-strip-temp">{rnd(weather.tempC)}°</span>
      <span className="weather-strip-feels">ощущается {rnd(weather.feelsC)}°</span>
      <span className="weather-strip-chips">
        <span className="weather-chip">↑ {rnd(weather.maxC)}° ↓ {rnd(weather.minC)}°</span>
        {weather.precipProb != null && <span className="weather-chip">💧 {weather.precipProb}%</span>}
        <span className="weather-chip">🌬 {rnd(weather.windMs)} м/с</span>
        {weather.uvIndex != null && <span className="weather-chip">UV {rnd(weather.uvIndex)}</span>}
      </span>
      <span className="weather-strip-meta">{weatherLabel(weather.code)} · Подгорица</span>
    </div>
  );
}

export default function HomeTab() {
  const [logoIdx, setLogoIdx] = useState(0);
  const cycleLogo = () => setLogoIdx((i) => (i + 1) % LOGOS.length);

  return (
    <div className="home">
      <div className="home-card">
        <div className="photo-carousel"
          onClick={(e) => { cycleLogo(); (e.currentTarget as HTMLElement).blur(); }}>
          {LOGOS.map((src, i) => (
            <img key={src} src={src} alt="McRun"
              className={`home-photo${i === logoIdx ? " home-photo--active" : ""}`} />
          ))}
        </div>
        <blockquote className="home-quote">
          <p className="home-quote-text">&ldquo;Pain is inevitable.<br />Suffering is optional.&rdquo;</p>
          <footer className="home-quote-author">&mdash; Haruki Murakami</footer>
        </blockquote>
      </div>
      <WeatherStrip />
    </div>
  );
}
