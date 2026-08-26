'use client';

import { motion } from 'framer-motion';
import React, { useState, useEffect } from 'react';

interface OceanCurrentBackgroundProps {
  className?: string;
  intensity?: 'subtle' | 'normal' | 'dark';
}

interface ContourLine {
  d: string;
  strokeWidth: number;
  opacity: number;
  duration: number;
  delay: number;
  xDrift: number[];
  yDrift: number[];
}

// Organic bathymetric / ocean current contour lines with non-uniform spacing & opacities
const CONTOUR_LINES: ContourLine[] = [
  {
    d: 'M -150 140 C 120 90, 420 190, 750 110 C 950 60, 1150 150, 1350 100',
    strokeWidth: 0.8,
    opacity: 0.03,
    duration: 24,
    delay: 0,
    xDrift: [0, 30, 0],
    yDrift: [0, -8, 0],
  },
  {
    d: 'M -150 220 C 180 180, 380 270, 680 200 C 920 145, 1180 240, 1350 180',
    strokeWidth: 1.0,
    opacity: 0.05,
    duration: 28,
    delay: 2,
    xDrift: [0, -25, 0],
    yDrift: [0, 12, 0],
  },
  // Key main current line — brighter
  {
    d: 'M -150 310 C 220 250, 480 360, 780 280 C 1020 210, 1200 330, 1350 270',
    strokeWidth: 1.4,
    opacity: 0.15,
    duration: 22,
    delay: 1,
    xDrift: [0, 40, 0],
    yDrift: [0, -14, 0],
  },
  {
    d: 'M -150 390 C 150 350, 410 420, 710 370 C 940 330, 1140 410, 1350 360',
    strokeWidth: 0.9,
    opacity: 0.04,
    duration: 26,
    delay: 4,
    xDrift: [0, -35, 0],
    yDrift: [0, 8, 0],
  },
  {
    d: 'M -150 490 C 260 430, 520 540, 820 450 C 1060 380, 1240 500, 1350 440',
    strokeWidth: 1.2,
    opacity: 0.08,
    duration: 20,
    delay: 3,
    xDrift: [0, 35, 0],
    yDrift: [0, -10, 0],
  },
  {
    d: 'M -150 590 C 190 530, 440 630, 740 560 C 980 500, 1160 600, 1350 550',
    strokeWidth: 0.8,
    opacity: 0.03,
    duration: 30,
    delay: 5,
    xDrift: [0, -20, 0],
    yDrift: [0, 14, 0],
  },
  {
    d: 'M -150 700 C 240 630, 500 740, 800 660 C 1040 600, 1220 710, 1350 650',
    strokeWidth: 1.1,
    opacity: 0.07,
    duration: 25,
    delay: 1.5,
    xDrift: [0, 25, 0],
    yDrift: [0, -12, 0],
  },
  {
    d: 'M -150 820 C 170 770, 430 850, 730 790 C 970 740, 1150 830, 1350 780',
    strokeWidth: 0.8,
    opacity: 0.03,
    duration: 32,
    delay: 6,
    xDrift: [0, -30, 0],
    yDrift: [0, 10, 0],
  },
];

export function OceanCurrentBackground({ className = '', intensity = 'normal' }: OceanCurrentBackgroundProps) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Extremely weak mouse responsiveness
      const x = (e.clientX / window.innerWidth - 0.5) * 8;
      const y = (e.clientY / window.innerHeight - 0.5) * 8;
      setMousePos({ x, y });
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const intensityMultiplier = intensity === 'subtle' ? 0.6 : intensity === 'dark' ? 1.4 : 1.0;

  return (
    <div className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`}>
      <motion.svg
        className="w-full h-full"
        viewBox="0 0 1200 900"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
        animate={{
          x: mousePos.x,
          y: mousePos.y,
        }}
        transition={{ type: 'spring', stiffness: 20, damping: 30 }}
      >
        {CONTOUR_LINES.map((line, i) => (
          <motion.path
            key={i}
            d={line.d}
            stroke="white"
            strokeWidth={line.strokeWidth}
            strokeOpacity={line.opacity * intensityMultiplier}
            fill="none"
            strokeLinecap="round"
            animate={{
              x: line.xDrift,
              y: line.yDrift,
            }}
            transition={{
              duration: line.duration,
              delay: line.delay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </motion.svg>
    </div>
  );
}
