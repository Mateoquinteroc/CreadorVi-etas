"use client";

import React, { useRef, useEffect, useCallback } from 'react';
import type { PanelItem } from './GridPanel';
import { panelPolygon, roundedPolygonPath, type PanelCut, type GridPoint } from '@/lib/panelCuts';

export type ExportFormat = 'png' | 'jpg' | 'svg';
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
  cuts: PanelCut[];
}

interface PixelBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

type PanelShape =
  | { type: 'rect'; box: PixelBox }
  | { type: 'polygon'; points: GridPoint[] };

/**
 * Panels not involved in any cut are drawn as plain (rounded) rects, using
 * their own DOM-measured box exactly as before. Panels that ARE cut need a
 * polygon that reaches past their own box (a cut always makes one panel gain
 * area at its neighbor's expense) - their own measured box can't be used as
 * the conversion basis for that, so cut points are placed with `toPixel`, a
 * single global grid-to-pixel formula shared by both panels in a cut. That
 * guarantees the two panels' shared edge lands on the exact same pixels no
 * matter how each one's own box happens to be measured/rounded.
 *
 * No stroke inset for cut polygons - offsetting an arbitrary polygon inward
 * is a lot more work than this feature warrants right now. Corner rounding
 * IS applied (via roundedPolygonPath at draw time), same radius as plain
 * rects, so a cut panel's un-cut corners still match the rest of the layout.
 */
function buildPanelShapes(
  panelItems: PanelItem[],
  cuts: PanelCut[],
  boxes: PixelBox[],
  toPixel: (gx: number, gy: number) => GridPoint,
  gapGrid: { x: number; y: number }
): PanelShape[] {
  const relevantIds = new Set(cuts.flatMap(c => [c.panelAId, c.panelBId]));
  return panelItems.map((item, i) => {
    const box = boxes[i];
    if (!relevantIds.has(item.id) || !box) return { type: 'rect', box };

    const points = panelPolygon(item, panelItems, cuts, gapGrid).map(p => toPixel(p.x, p.y));
    return { type: 'polygon', points };
  });
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
  cuts,
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

  const propRefs = useRef({ format, columns, gapSize, canvasMargin, cornerRadius, strokeWidth, exportFormat, backgroundType, panelItems, cuts, gridToPixels });
  useEffect(() => {
    propRefs.current = { format, columns, gapSize, canvasMargin, cornerRadius, strokeWidth, exportFormat, backgroundType, panelItems, cuts, gridToPixels };
  }, [format, columns, gapSize, canvasMargin, cornerRadius, strokeWidth, exportFormat, backgroundType, panelItems, cuts, gridToPixels]);

  // Handle export when trigger changes
  useEffect(() => {
    if (exportTrigger === 0) return;

    const { format, columns, gapSize, canvasMargin, cornerRadius, strokeWidth, exportFormat, backgroundType, panelItems, cuts, gridToPixels } = propRefs.current;
    // Single grid-to-pixel formula for cut points (see buildPanelShapes) - not
    // tied to any one panel's own measured box, so both panels in a cut always
    // agree on the exact same shared pixel coordinates.
    const toPixel = (gx: number, gy: number) => ({
      x: canvasMargin + (gx * (format.width - 2 * canvasMargin)) / columns,
      y: canvasMargin + (gy * (format.height - 2 * canvasMargin)) / columns,
    });
    // Same visual gutter used between every other pair of panels (GridStack's
    // margin), expressed in grid units so a cut's shared line gets a centered
    // gap too instead of the two panels touching with zero space between them.
    const innerExportW = format.width - 2 * canvasMargin;
    const innerExportH = format.height - 2 * canvasMargin;
    const gapGrid = {
      x: columns > 0 && innerExportW > 0 ? (gapSize * columns) / innerExportW : 0,
      y: columns > 0 && innerExportH > 0 ? (gapSize * columns) / innerExportH : 0,
    };

    if (exportFormat === 'svg') {
      const halfStroke = strokeWidth / 2;
      const pathRadius = Math.max(0, cornerRadius - halfStroke);

      const rects = buildPanelShapes(panelItems, cuts, gridToPixels(panelItems), toPixel, gapGrid)
        .map((shape) => {
          if (shape.type === 'polygon') {
            const d = roundedPolygonPath(shape.points, pathRadius);
            return `  <path d="${d}" fill="none" stroke="black" stroke-width="${strokeWidth}" />`;
          }
          const { x, y, width, height } = shape.box;
          const w = Math.max(0, width - strokeWidth);
          const h = Math.max(0, height - strokeWidth);
          return `  <rect x="${(x + halfStroke).toFixed(2)}" y="${(y + halfStroke).toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" rx="${pathRadius.toFixed(2)}" fill="none" stroke="black" stroke-width="${strokeWidth}" />`;
        })
        .join('\n');

      const backgroundRect =
        backgroundType === 'white'
          ? `  <rect x="0" y="0" width="${format.width}" height="${format.height}" fill="white" />\n`
          : '';

      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${format.width}" height="${format.height}" viewBox="0 0 ${format.width} ${format.height}">\n${backgroundRect}${rects}\n</svg>`;

      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'comic_panels.svg';
      link.click();
      URL.revokeObjectURL(url);
      return;
    }

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
    const shapes = buildPanelShapes(panelItems, cuts, gridToPixels(panelItems), toPixel, gapGrid);
    const halfStroke = strokeWidth / 2;
    const pathRadius = Math.max(0, cornerRadius - halfStroke);

    shapes.forEach((shape) => {
      exportCtx.strokeStyle = 'black';
      exportCtx.lineWidth = strokeWidth;

      if (shape.type === 'polygon') {
        const d = roundedPolygonPath(shape.points, pathRadius);
        if (!d) return;
        exportCtx.stroke(new Path2D(d));
        return;
      }

      const { x, y, width, height } = shape.box;

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
