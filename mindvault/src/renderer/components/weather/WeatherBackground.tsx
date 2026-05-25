import React, { useRef, useEffect, useCallback } from 'react';
import { useWeatherStore } from '../../stores/weatherStore';
import { getWeatherCategory, type WeatherCategory } from '../../../shared/weather-constants';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  life: number;
  maxLife: number;
}

interface WeatherBackgroundProps {
  intensity?: number;
  enabled?: boolean;
}

const WeatherBackground: React.FC<WeatherBackgroundProps> = ({
  intensity = 0.6,
  enabled = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number>(0);
  const weather = useWeatherStore((s) => s.weather);

  const category = weather
    ? getWeatherCategory(weather.weatherCode, weather.isDay)
    : 'cloud';

  const isRaining = category === 'rain' || category === 'heavyRain' || category === 'nightRain' || category === 'nightHeavyRain';
  const isSnowing = category === 'snow' || category === 'nightSnow';
  const isThunder = category === 'thunder';
  const isSunny = category === 'sun';
  const isFoggy = category === 'fog' || category === 'nightFog';
  const isNight = !weather?.isDay;

  const createRainDrop = useCallback((w: number, h: number): Particle => ({
    x: Math.random() * w,
    y: Math.random() * -h,
    vx: -1 - Math.random(),
    vy: 8 + Math.random() * 8,
    size: 1 + Math.random() * 1.5,
    opacity: 0.2 + Math.random() * 0.4,
    life: 0,
    maxLife: h / 10,
  }), []);

  const createSnowFlake = useCallback((w: number, _h: number): Particle => ({
    x: Math.random() * w,
    y: -10,
    vx: -0.5 + Math.random(),
    vy: 0.5 + Math.random() * 1.5,
    size: 1 + Math.random() * 3,
    opacity: 0.3 + Math.random() * 0.5,
    life: 0,
    maxLife: 300 + Math.random() * 200,
  }), []);

  const createSunParticle = useCallback((w: number, h: number): Particle => ({
    x: Math.random() * w,
    y: Math.random() * h,
    vx: 0,
    vy: -0.1 - Math.random() * 0.3,
    size: 1 + Math.random() * 2,
    opacity: 0.05 + Math.random() * 0.1,
    life: 0,
    maxLife: 200 + Math.random() * 200,
  }), []);

  useEffect(() => {
    if (!enabled) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    let thunderTimer = 0;
    let thunderOpacity = 0;

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const particles = particlesRef.current;
      const maxParticles = isRaining ? Math.floor(80 * intensity)
        : isSnowing ? Math.floor(50 * intensity)
        : isSunny ? Math.floor(20 * intensity)
        : 0;

      while (particles.length < maxParticles) {
        if (isRaining) particles.push(createRainDrop(w, h));
        else if (isSnowing) particles.push(createSnowFlake(w, h));
        else if (isSunny) particles.push(createSunParticle(w, h));
        else break;
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life++;

        if (isRaining) {
          if (p.y > h || p.life > p.maxLife) {
            particles[i] = createRainDrop(w, h);
            continue;
          }
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + p.vx * 2, p.y + p.vy * 2);
          ctx.strokeStyle = `rgba(120, 180, 255, ${p.opacity * intensity})`;
          ctx.lineWidth = p.size * 0.5;
          ctx.stroke();
        } else if (isSnowing) {
          if (p.y > h || p.life > p.maxLife) {
            particles[i] = createSnowFlake(w, h);
            continue;
          }
          p.vx += (Math.random() - 0.5) * 0.1;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(220, 230, 255, ${p.opacity * intensity})`;
          ctx.fill();
        } else if (isSunny) {
          if (p.life > p.maxLife || p.y < -10) {
            particles[i] = createSunParticle(w, h);
            continue;
          }
          const fade = 1 - p.life / p.maxLife;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 220, 100, ${p.opacity * fade * intensity})`;
          ctx.fill();
        }
      }

      if (isFoggy) {
        const fogOpacity = 0.03 * intensity;
        for (let i = 0; i < 3; i++) {
          const y = h * 0.3 + i * h * 0.2;
          const gradient = ctx.createLinearGradient(0, y - 60, 0, y + 60);
          gradient.addColorStop(0, `rgba(180, 190, 210, 0)`);
          gradient.addColorStop(0.5, `rgba(180, 190, 210, ${fogOpacity})`);
          gradient.addColorStop(1, `rgba(180, 190, 210, 0)`);
          ctx.fillStyle = gradient;
          ctx.fillRect(0, y - 60, w, 120);
        }
      }

      if (isThunder) {
        thunderTimer++;
        if (thunderTimer > 120 + Math.random() * 180) {
          thunderOpacity = 0.3 + Math.random() * 0.3;
          thunderTimer = 0;
        }
        if (thunderOpacity > 0) {
          ctx.fillStyle = `rgba(255, 255, 240, ${thunderOpacity * intensity})`;
          ctx.fillRect(0, 0, w, h);
          thunderOpacity *= 0.85;
          if (thunderOpacity < 0.01) thunderOpacity = 0;
        }
      }

      if (isNight) {
        ctx.fillStyle = `rgba(10, 15, 40, ${0.05 * intensity})`;
        ctx.fillRect(0, 0, w, h);
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animFrameRef.current);
      particlesRef.current = [];
    };
  }, [category, intensity, enabled, isRaining, isSnowing, isSunny, isFoggy, isThunder, isNight, createRainDrop, createSnowFlake, createSunParticle]);

  if (!enabled) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
        opacity: 0.8,
      }}
    />
  );
};

export default WeatherBackground;
