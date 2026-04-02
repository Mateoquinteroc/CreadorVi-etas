"use client";

import React, { useRef, useEffect, useCallback } from 'react';
import type { PanelItem } from './GridPanel';

export type ExportFormat = 'png' | 'jpg';
export type BackgroundType = 'white' | 'transparent';

interface ExportCanvasProps {
  format: { width: number; height: number };
  columns: number;
  gapSize: number;
  cornerRadius: number;
  canvasMargin: number;
  strokeWidth: number;
  exportTrigger: number;
  exportFormat: ExportFormat;
  backgroundType: BackgroundType;
  panelItems: PanelItem[];
}

/**
 * Hidden canvas component that handles export only.
 * It reads the GridStack layout (panelItems) and renders them to a canvas
 * at full resolution for download.
 */
const ExportCanvas: React.FC<ExportCanvasProps> = ({
  format,
  columns,
  gapSize,
  cornerRadius,
  canvasMargin,
  strokeWidth,
  exportTrigger,
  exportFormat,
  backgroundType,
  panelItems,
}) => {
  const roundRect = useCallback(
    (
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
    },
    []
  );

  /**
   * Convert GridStack grid units to pixel coordinates on the canvas.
   * GridStack uses column-based positioning, so we need to map
   * grid units to actual pixel positions matching the export format.
   */
    const gridToPixels = useCallback(
      (items: PanelItem[]) => {
        const container = document.getElementById('export-canvas-container');
        if (!container) return [];

        const containerRect = container.getBoundingClientRect();
        // Since container width represents format.width, we find the global physical multiplier
        const scaleToFormat = format.width / containerRect.width;

        return items.map((item) => {
          const itemEl = document.querySelector(`.grid-stack-item[gs-id="${item.id}"] .panel-cell`);
          if (!itemEl) {
             // Fallback to internal math if DOM is temporarily missing
             const innerWidth = format.width - 2 * canvasMargin;
             const innerHeight = format.height - 2 * canvasMargin;
             const matrixWidth = innerWidth + gapSize;
             const matrixHeight = innerHeight + gapSize;
             const cellWidth = matrixWidth / columns;
             const cellHeight = matrixHeight / columns;
             return {
                x: canvasMargin + item.x * cellWidth,
                y: canvasMargin + item.y * cellHeight,
                width: Math.max(1, item.w * cellWidth - gapSize),
                height: Math.max(1, item.h * cellHeight - gapSize),
             };
          }

          const cellRect = itemEl.getBoundingClientRect();

          // Calculate offset relative to the container block
          const relativeX = cellRect.left - containerRect.left;
          const relativeY = cellRect.top - containerRect.top;

          return {
            x: relativeX * scaleToFormat,
            y: relativeY * scaleToFormat,
            width: cellRect.width * scaleToFormat,
            height: cellRect.height * scaleToFormat,
          };
        });
      },
    [format, columns, gapSize, canvasMargin]
  );

  const propRefs = useRef({ format, cornerRadius, strokeWidth, exportFormat, backgroundType, panelItems, gridToPixels });
  useEffect(() => {
    propRefs.current = { format, cornerRadius, strokeWidth, exportFormat, backgroundType, panelItems, gridToPixels };
  }, [format, cornerRadius, strokeWidth, exportFormat, backgroundType, panelItems, gridToPixels]);

  // Handle export when trigger changes
  useEffect(() => {
    if (exportTrigger === 0) return;

    const { format, cornerRadius, strokeWidth, exportFormat, backgroundType, panelItems, gridToPixels } = propRefs.current;

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = format.width;
    exportCanvas.height = format.height;
    const exportCtx = exportCanvas.getContext('2d');
    if (!exportCtx) return;

    const bg: BackgroundType =
      exportFormat === 'jpg' ? 'white' : backgroundType;

    // Draw background
    exportCtx.clearRect(0, 0, format.width, format.height);
    if (bg === 'white') {
      exportCtx.fillStyle = 'white';
      exportCtx.fillRect(0, 0, format.width, format.height);
    }

    // Convert grid positions to pixels and draw
    const pixelBullets = gridToPixels(panelItems);
    pixelBullets.forEach(({ x, y, width, height }) => {
      exportCtx.strokeStyle = 'black';
      exportCtx.lineWidth = strokeWidth;
      
      const halfStroke = strokeWidth / 2;
      const pathRadius = Math.max(0, cornerRadius - halfStroke);
      
      roundRect(
        exportCtx, 
        x + halfStroke, 
        y + halfStroke, 
        width - strokeWidth, 
        height - strokeWidth, 
        pathRadius
      );
    });

    const mimeType = exportFormat === 'jpg' ? 'image/jpeg' : 'image/png';
    const quality = exportFormat === 'jpg' ? 0.92 : undefined;
    const dataUrl = exportCanvas.toDataURL(mimeType, quality);

    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `comic_panels.${exportFormat}`;
    link.click();
  }, [exportTrigger]);

  // This component renders nothing visible
  return null;
};

export default ExportCanvas;
