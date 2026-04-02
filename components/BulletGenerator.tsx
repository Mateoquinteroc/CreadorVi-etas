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
        // Enforce the canvas virtual grid ratio for vertical sizing
        const maxRow = columns; 

        const innerWidth = format.width - 2 * canvasMargin;
        const innerHeight = format.height - 2 * canvasMargin;

        const cellWidth = (innerWidth - (columns + 1) * gapSize) / columns;
        const cellHeight = (innerHeight - (maxRow + 1) * gapSize) / maxRow;

      return items.map((item) => ({
        x: canvasMargin + gapSize + item.x * (cellWidth + gapSize),
        y: canvasMargin + gapSize + item.y * (cellHeight + gapSize),
        width: item.w * cellWidth + (item.w - 1) * gapSize,
        height: item.h * cellHeight + (item.h - 1) * gapSize,
      }));
    },
    [format, columns, gapSize, canvasMargin]
  );

  // Handle export when trigger changes
  useEffect(() => {
    if (exportTrigger === 0) return;

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
      roundRect(exportCtx, x, y, width, height, cornerRadius);
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
