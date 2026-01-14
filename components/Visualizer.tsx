import React, { useEffect, useRef } from 'react';
import { AudioVisualizerProps } from '../types';

export const Visualizer: React.FC<AudioVisualizerProps> = ({ isPlaying, volume, barColor = '#4ade80' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let targetHeight = 0;
    
    // Number of bars
    const barCount = 5;
    const bars: number[] = new Array(barCount).fill(0);
    
    const animate = () => {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const maxHeight = canvas.height * 0.8;
      const spacing = 12;
      const barWidth = 8;
      
      // Smoothly interpolate volume
      targetHeight = Math.max(5, volume * maxHeight);

      // Draw bars radiating from center
      bars.forEach((_, i) => {
        // Create a wave effect
        const offset = Math.abs(i - Math.floor(barCount / 2));
        const currentHeight = Math.max(5, targetHeight - (offset * (targetHeight * 0.3)));
        
        // Add some jitter if playing
        const jitter = isPlaying ? Math.random() * 5 : 0;
        const finalHeight = currentHeight + jitter;

        const x = centerX + (i - Math.floor(barCount / 2)) * (barWidth + spacing);
        const y = (canvas.height - finalHeight) / 2;

        ctx.fillStyle = barColor;
        ctx.beginPath();
        // @ts-ignore - roundRect might not be in all TS definitions yet
        if (ctx.roundRect) {
            ctx.roundRect(x - barWidth/2, y, barWidth, finalHeight, 10);
        } else {
            ctx.rect(x - barWidth/2, y, barWidth, finalHeight);
        }
        ctx.fill();
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [volume, isPlaying, barColor]);

  return (
    <canvas 
      ref={canvasRef} 
      width={200} 
      height={100} 
      className="w-full h-24 object-contain"
    />
  );
};