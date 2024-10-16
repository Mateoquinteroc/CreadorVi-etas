"use client";

import React, { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

interface BulletGeneratorProps {
  format: { width: number; height: number };
  rows: number;
  columns: number;
  isSymmetrical: boolean;
  gapSize: number;
  cornerRadius: number;
}

const BulletGenerator: React.FC<BulletGeneratorProps> = ({
  format,
  rows,
  columns,
  isSymmetrical,
  gapSize,
  cornerRadius,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions based on format
    canvas.width = format.width;
    canvas.height = format.height;

    // Calculate scaling based on container size
    const containerWidth = container.clientWidth * 0.9;
    const containerHeight = container.clientHeight * 0.9;
    const scaleX = containerWidth / format.width;
    const scaleY = containerHeight / format.height;
    const newScale = Math.min(scaleX, scaleY) * 0.9; // Reduce size by 10%
    setScale(newScale);

    // Clear the canvas
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const totalGapWidth = (columns + 1) * gapSize;
    const totalGapHeight = (rows + 1) * gapSize;
    const maxBulletWidth = (canvas.width - totalGapWidth) / columns;
    const maxBulletHeight = (canvas.height - totalGapHeight) / rows;

    // Draw bullets
    if (rows === 1) {
      // Ajustar para una sola fila
      const squareSize = (canvas.width - totalGapWidth) / columns; // Tamaño cuadrado basado en el ancho disponible
      for (let col = 0; col < columns; col++) {
        const x = gapSize + col * (squareSize + gapSize);
        const y = (canvas.height - squareSize) / 2; // Centrar verticalmente
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 2;
        roundRect(ctx, x, y, squareSize, squareSize, cornerRadius); // Dibuja el cuadrado
      }
    } else {
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < columns; col++) {
          let width = maxBulletWidth;
          let height = maxBulletHeight;

          if (!isSymmetrical) {
            width *= 0.7 + Math.random() * 0.3;
            height *= 0.7 + Math.random() * 0.3;
          }

          const x = gapSize + col * (maxBulletWidth + gapSize) + (maxBulletWidth - width) / 2;
          const y = gapSize + row * (maxBulletHeight + gapSize) + (maxBulletHeight - height) / 2;

          ctx.strokeStyle = 'black';
          ctx.lineWidth = 2;
          roundRect(ctx, x, y, width, height, cornerRadius);
        }
      }
    }
  }, [format, rows, columns, isSymmetrical, gapSize, cornerRadius]);

  const roundRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ) => {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
    ctx.stroke();
  };

  const handleExport = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = 'comic_bullets.png';
    link.click();
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen p-4">
      <h2 className="text-2xl font-bold mb-4">Bullet Preview</h2>
      <div className="relative w-full h-full max-w-full max-h-full flex items-center justify-center">
        <div ref={containerRef} className="overflow-hidden flex items-center justify-center w-full h-full">
          <canvas
            ref={canvasRef}
            className="border border-black"
            style={{
              width: `${format.width * scale}px`,
              height: `${format.height * scale}px`,
            }}
          />
        </div>
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 -translate-y-[70%] mt-2 text-sm">
          {format.width}px
        </div>
        <div className="absolute top-1/2 left-full transform -translate-y-1/2 ml-2 text-sm" style={{ writingMode: 'vertical-rl' }}>
          {format.height}px
        </div>
      </div>
      <Button onClick={handleExport} className="mt-4">
        Export Preview
      </Button>
    </div>
  );
};

export default BulletGenerator;
