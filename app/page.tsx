"use client";

import { useState, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import ExportCanvas from '@/components/BulletGenerator';
import ToolsBar from '@/components/ToolsBar';
import type { ExportFormat, BackgroundType } from '@/components/BulletGenerator';
import type { PanelItem } from '@/components/GridPanel';
import { Button } from '@/components/ui/button';
import {
  Plus,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
  X,
} from 'lucide-react';
import { PANEL_TEMPLATES } from '@/lib/panelTemplates';
import type { PanelCut } from '@/lib/panelCuts';

const VIRTUAL_GRID = 24;
const STORAGE_KEY = 'comic-panel-designer:v1';

interface PersistedState {
  format: { width: number; height: number };
  rows: number;
  columns: number;
  isSymmetrical: boolean;
  gapSize: number;
  cornerRadius: number;
  canvasMargin: number;
  strokeWidth: number;
  panelItems: PanelItem[];
  cuts: PanelCut[];
  editVertices: boolean;
  exportFormat: ExportFormat;
  backgroundType: BackgroundType;
}

const GridPanel = dynamic(() => import('@/components/GridPanel'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-muted-foreground">
      Cargando editor...
    </div>
  ),
});

/** Extracts the trailing numeric id (e.g. "panel-123-4" -> 4) used to order panels. */
function panelNum(id: string): number {
  const num = parseInt(id.split('-').pop() || '', 10);
  return isNaN(num) ? 0 : num;
}

/**
 * Splits a panel in half — vertically if it's wider than tall, horizontally
 * otherwise — to carve out space for a new panel next to it. The canvas is always
 * meant to be fully tiled, so a new panel can't just be dropped somewhere free —
 * there usually isn't any free space.
 *
 * If `preferredId` is given (e.g. "duplicate this panel"), that panel is tried
 * first; otherwise panels are tried most-recent-id first. Either way, if the
 * preferred target is too small to split (e.g. already 1 unit wide/tall), the
 * next candidate is tried. Returns null if nothing in the layout can be split.
 */
function splitPanel(items: PanelItem[], preferredId: string | undefined, newId: string): PanelItem[] | null {
  const rest = items.filter(i => i.id !== preferredId).sort((a, b) => panelNum(b.id) - panelNum(a.id));
  const preferred = items.find(i => i.id === preferredId);
  const order = preferred ? [preferred, ...rest] : rest;

  for (const target of order) {
    if (target.w >= target.h && target.w >= 2) {
      const leftW = Math.floor(target.w / 2);
      const rightW = target.w - leftW;
      const newPanel: PanelItem = { id: newId, x: target.x + leftW, y: target.y, w: rightW, h: target.h };
      return items.map(item => (item.id === target.id ? { ...item, w: leftW } : item)).concat(newPanel);
    }
    if (target.h > target.w && target.h >= 2) {
      const topH = Math.floor(target.h / 2);
      const bottomH = target.h - topH;
      const newPanel: PanelItem = { id: newId, x: target.x, y: target.y + topH, w: target.w, h: bottomH };
      return items.map(item => (item.id === target.id ? { ...item, h: topH } : item)).concat(newPanel);
    }
  }
  return null;
}

/** Generate default panel items for a given rows × columns grid */
function generateDefaultPanels(rows: number, columns: number): PanelItem[] {
  const items: PanelItem[] = [];
  let index = 1;
  const w = Math.max(1, Math.floor(VIRTUAL_GRID / columns));
  const h = Math.max(1, Math.floor(VIRTUAL_GRID / rows));

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      items.push({
        id: `panel-${Date.now()}-${index}`,
        x: col * w,
        y: row * h,
        w: w,
        h: h,
      });
      index++;
    }
  }
  return items;
}

export default function Home() {
  const [format, setFormat] = useState({ width: 1080, height: 1080 });
  const [rows, setRows] = useState(2);
  const [columns, setColumns] = useState(3);
  const [isSymmetrical, setIsSymmetrical] = useState(false);
  const [gapSize, setGapSize] = useState(10);
  const [cornerRadius, setCornerRadius] = useState(0);
  const [canvasMargin, setCanvasMargin] = useState(20);
  const [strokeWidth, setStrokeWidth] = useState(2);

  // Panel items state — initialized with default grid
  const [panelItems, setPanelItems] = useState<PanelItem[]>(() =>
    generateDefaultPanels(2, 3)
  );

  // Multi-selection for align/distribute. Pruned whenever panels are added/removed
  // so a deleted or replaced panel's id can't linger in the selection.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  useEffect(() => {
    setSelectedIds(prev => {
      const validIds = new Set(panelItems.map(p => p.id));
      const next = prev.filter(id => validIds.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [panelItems]);

  // Diagonal cuts between adjacent panel pairs. A cut stays "dormant" (not
  // rendered, but not deleted) if its two panels are resized apart and no
  // longer share a matching edge - only pruned outright when a referenced
  // panel is deleted entirely.
  const [cuts, setCuts] = useState<PanelCut[]>([]);
  useEffect(() => {
    setCuts(prev => {
      const validIds = new Set(panelItems.map(p => p.id));
      const next = prev.filter(c => validIds.has(c.panelAId) && validIds.has(c.panelBId));
      return next.length === prev.length ? prev : next;
    });
  }, [panelItems]);

  // When on, GridPanel shows draggable handles at every shared-edge endpoint
  // instead of the normal drag/resize handles.
  const [editVertices, setEditVertices] = useState(false);

  // Export state
  const [exportFormat, setExportFormat] = useState<ExportFormat>('png');
  const [backgroundType, setBackgroundType] = useState<BackgroundType>('white');
  const [exportTrigger, setExportTrigger] = useState(0);

  // Restore the last saved design on mount, if any. Uses the raw setters (not
  // handleSetRows/handleSetColumns) so restoring rows/columns doesn't also
  // regenerate panelItems and clobber the saved layout.
  const hasLoadedFromStorage = useRef(false);
  useEffect(() => {
    if (hasLoadedFromStorage.current) return;
    hasLoadedFromStorage.current = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved: Partial<PersistedState> = JSON.parse(raw);
      if (saved.format) setFormat(saved.format);
      if (typeof saved.rows === 'number') setRows(saved.rows);
      if (typeof saved.columns === 'number') setColumns(saved.columns);
      // isSymmetrical and editVertices are intentionally never restored - both
      // switches should always start off on page load, regardless of what was
      // saved in a previous session.
      if (typeof saved.gapSize === 'number') setGapSize(saved.gapSize);
      if (typeof saved.cornerRadius === 'number') setCornerRadius(saved.cornerRadius);
      if (typeof saved.canvasMargin === 'number') setCanvasMargin(saved.canvasMargin);
      if (typeof saved.strokeWidth === 'number') setStrokeWidth(saved.strokeWidth);
      if (saved.panelItems && saved.panelItems.length > 0) setPanelItems(saved.panelItems);
      if (Array.isArray(saved.cuts)) setCuts(saved.cuts);
      if (saved.exportFormat) setExportFormat(saved.exportFormat);
      if (saved.backgroundType) setBackgroundType(saved.backgroundType);
    } catch {
      // Corrupted or unavailable storage - just keep the defaults.
    }
  }, []);

  // Persist the design so a page reload doesn't lose it. Debounced since sliders
  // (gap/margin/corner/stroke) fire continuously while dragging.
  useEffect(() => {
    if (!hasLoadedFromStorage.current) return;
    const id = setTimeout(() => {
      const state: PersistedState = {
        format, rows, columns, isSymmetrical, gapSize, cornerRadius,
        canvasMargin, strokeWidth, panelItems, cuts, editVertices, exportFormat, backgroundType,
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        // Storage full/unavailable (e.g. private browsing) - not worth surfacing.
      }
    }, 400);
    return () => clearTimeout(id);
  }, [format, rows, columns, isSymmetrical, gapSize, cornerRadius, canvasMargin, strokeWidth, panelItems, cuts, editVertices, exportFormat, backgroundType]);

  const handleExport = useCallback(() => {
    setExportTrigger((prev) => prev + 1);
  }, []);

  // When rows/columns change from ToolsBar, regenerate the default grid
  const handleSetRows = useCallback(
    (value: React.SetStateAction<number>) => {
      setRows((prev) => {
        const newRows = typeof value === 'function' ? value(prev) : value;
        if (newRows > 0 && newRows <= 10) {
          setPanelItems(generateDefaultPanels(newRows, columns));
        }
        return newRows;
      });
    },
    [columns]
  );

  const handleSetColumns = useCallback(
    (value: React.SetStateAction<number>) => {
      setColumns((prev) => {
        const newCols = typeof value === 'function' ? value(prev) : value;
        if (newCols > 0 && newCols <= 12) {
          setPanelItems(generateDefaultPanels(rows, newCols));
        }
        return newCols;
      });
    },
    [rows]
  );

  // GridStack reports layout changes
  const handleLayoutChange = useCallback((items: PanelItem[]) => {
    setPanelItems(items);
  }, []);

  // Applies a predefined layout template, replacing the current panels entirely.
  const handleApplyTemplate = useCallback((templateId: string) => {
    const template = PANEL_TEMPLATES.find(t => t.id === templateId);
    if (!template) return;
    const timestamp = Date.now();
    setPanelItems(
      template.panels.map((shape, index) => ({ id: `panel-${timestamp}-${index + 1}`, ...shape }))
    );
  }, []);

  const handleAddPanel = useCallback(() => {
    setPanelItems(prev => {
      const maxNum = prev.reduce((max, item) => Math.max(max, panelNum(item.id)), 0);
      const newId = `panel-${maxNum + 1}`;
      return splitPanel(prev, undefined, newId) ?? prev;
    });
  }, []);

  const handleDuplicatePanel = useCallback((id: string) => {
    setPanelItems(prev => {
      const maxNum = prev.reduce((max, item) => Math.max(max, panelNum(item.id)), 0);
      const newId = `panel-${maxNum + 1}`;
      return splitPanel(prev, id, newId) ?? prev;
    });
  }, []);

  // Sets (creating the cut if needed) one endpoint's offset for a panel pair's
  // shared edge. `endpoint` is 'start'/'end' as determined by the adjacency
  // itself (top/left vs bottom/right) - both panels in the pair always read
  // this same cut object, so dragging one panel's corner automatically keeps
  // its neighbor's touching corner in perfect sync, no separate mirroring step.
  const handleUpdateCutEndpoint = useCallback(
    (panelAId: string, panelBId: string, endpoint: 'start' | 'end', offset: number) => {
      setCuts(prev => {
        const existing = prev.find(
          c => (c.panelAId === panelAId && c.panelBId === panelBId) || (c.panelAId === panelBId && c.panelBId === panelAId)
        );
        const key = endpoint === 'start' ? 'offsetStart' : 'offsetEnd';
        if (existing) {
          return prev.map(c => (c.id === existing.id ? { ...c, [key]: offset } : c));
        }
        return [...prev, { id: `cut-${panelAId}-${panelBId}`, panelAId, panelBId, offsetStart: 0, offsetEnd: 0, [key]: offset }];
      });
    },
    []
  );

  type AlignType = 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom';

  // Align/distribute only move the selected panels' x/y (never their size), but a
  // moved panel can still end up overlapping an UNSELECTED one, or - since that
  // overlap gets written into GridStack via grid.update() - trigger its native
  // collision push, which can shove the unselected panel out of the canvas
  // entirely (same class of bug fixed earlier for resize). Validating the full
  // result here, before committing, keeps the canvas always in a legal state.
  const isValidLayout = useCallback((items: PanelItem[]): boolean => {
    for (const p of items) {
      if (p.x < 0 || p.y < 0 || p.x + p.w > VIRTUAL_GRID || p.y + p.h > VIRTUAL_GRID) return false;
    }
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i], b = items[j];
        if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) return false;
      }
    }
    return true;
  }, []);

  const handleAlign = useCallback((type: AlignType) => {
    setPanelItems(prev => {
      const selected = prev.filter(p => selectedIds.includes(p.id));
      if (selected.length < 2) return prev;

      const minX = Math.min(...selected.map(p => p.x));
      const maxX = Math.max(...selected.map(p => p.x + p.w));
      const minY = Math.min(...selected.map(p => p.y));
      const maxY = Math.max(...selected.map(p => p.y + p.h));

      const next = prev.map(p => {
        if (!selectedIds.includes(p.id)) return p;
        switch (type) {
          case 'left': return { ...p, x: minX };
          case 'right': return { ...p, x: maxX - p.w };
          case 'centerX': return { ...p, x: Math.round((minX + maxX) / 2 - p.w / 2) };
          case 'top': return { ...p, y: minY };
          case 'bottom': return { ...p, y: maxY - p.h };
          case 'centerY': return { ...p, y: Math.round((minY + maxY) / 2 - p.h / 2) };
        }
      });
      return isValidLayout(next) ? next : prev;
    });
  }, [selectedIds, isValidLayout]);

  const handleDistribute = useCallback((axis: 'x' | 'y') => {
    setPanelItems(prev => {
      const selected = prev.filter(p => selectedIds.includes(p.id));
      if (selected.length < 3) return prev;

      const posKey = axis === 'x' ? 'x' : 'y';
      const sizeKey = axis === 'x' ? 'w' : 'h';
      const sorted = [...selected].sort((a, b) => a[posKey] - b[posKey]);
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const totalSpan = (last[posKey] + last[sizeKey]) - first[posKey];
      const totalSize = sorted.reduce((sum, p) => sum + p[sizeKey], 0);
      const gap = (totalSpan - totalSize) / (sorted.length - 1);

      const newPos = new Map<string, number>();
      let cursor = first[posKey];
      sorted.forEach(p => {
        newPos.set(p.id, Math.round(cursor));
        cursor += p[sizeKey] + gap;
      });

      const next = prev.map(p => (newPos.has(p.id) ? { ...p, [posKey]: newPos.get(p.id)! } : p));
      return isValidLayout(next) ? next : prev;
    });
  }, [selectedIds, isValidLayout]);

  return (
    <div className="flex flex-col md:flex-row h-screen">
      {/* Interactive grid area */}
      <div className="w-full md:w-2/3 p-2 md:p-4 bg-gray-50 flex flex-col min-h-[45vh] md:min-h-0">
        <h2 className="text-lg md:text-2xl font-bold mb-2 md:mb-4 text-center">
          Panel Preview
          <span className="text-xs font-normal text-muted-foreground ml-2">
            Arrastra y redimensiona las viñetas
          </span>
        </h2>

        {selectedIds.length >= 2 && (
          <div className="flex flex-wrap items-center justify-center gap-1 mb-2 p-2 bg-white border border-gray-200 rounded-md shadow-sm">
            <span className="text-xs text-muted-foreground mr-1">{selectedIds.length} seleccionadas</span>
            <Button size="icon" variant="ghost" className="h-8 w-8" title="Alinear izquierda" onClick={() => handleAlign('left')}>
              <AlignStartVertical className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" title="Centrar horizontal" onClick={() => handleAlign('centerX')}>
              <AlignCenterVertical className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" title="Alinear derecha" onClick={() => handleAlign('right')}>
              <AlignEndVertical className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" title="Alinear arriba" onClick={() => handleAlign('top')}>
              <AlignStartHorizontal className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" title="Centrar vertical" onClick={() => handleAlign('centerY')}>
              <AlignCenterHorizontal className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" title="Alinear abajo" onClick={() => handleAlign('bottom')}>
              <AlignEndHorizontal className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              title="Distribuir horizontalmente"
              disabled={selectedIds.length < 3}
              onClick={() => handleDistribute('x')}
            >
              <AlignHorizontalDistributeCenter className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              title="Distribuir verticalmente"
              disabled={selectedIds.length < 3}
              onClick={() => handleDistribute('y')}
            >
              <AlignVerticalDistributeCenter className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" title="Deseleccionar" onClick={() => setSelectedIds([])}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-auto">
          <GridPanel
            format={format}
            rows={rows}
            columns={columns}
            gapSize={gapSize}
            cornerRadius={cornerRadius}
            canvasMargin={canvasMargin}
            strokeWidth={strokeWidth}
            onLayoutChange={handleLayoutChange}
            onDuplicate={handleDuplicatePanel}
            panelItems={panelItems}
            cuts={cuts}
            onUpdateCutEndpoint={handleUpdateCutEndpoint}
            editVertices={editVertices}
            virtualGrid={VIRTUAL_GRID}
            isSymmetrical={isSymmetrical}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
          />
        </div>
        <div className="flex justify-center mt-4">
          <Button onClick={handleAddPanel} variant="outline" className="shadow-sm">
            <Plus className="mr-2 h-4 w-4" /> Agregar Viñeta
          </Button>
        </div>
        <div className="text-center mt-2 text-xs text-muted-foreground hidden md:block">
          {format.width} × {format.height}px · {panelItems.length} viñetas
        </div>
      </div>

      {/* Tools sidebar / bottom panel on mobile */}
      <div className="w-full md:w-1/3 p-3 md:p-4 bg-white border-t md:border-t-0 md:border-l border-gray-200 overflow-y-auto max-h-[55vh] md:max-h-none">
        <ToolsBar
          format={format}
          setFormat={setFormat}
          rows={rows}
          setRows={handleSetRows}
          columns={columns}
          setColumns={handleSetColumns}
          onApplyTemplate={handleApplyTemplate}
          isSymmetrical={isSymmetrical}
          setIsSymmetrical={setIsSymmetrical}
          gapSize={gapSize}
          setGapSize={setGapSize}
          cornerRadius={cornerRadius}
          setCornerRadius={setCornerRadius}
          canvasMargin={canvasMargin}
          setCanvasMargin={setCanvasMargin}
          strokeWidth={strokeWidth}
          setStrokeWidth={setStrokeWidth}
          editVertices={editVertices}
          setEditVertices={setEditVertices}
          exportFormat={exportFormat}
          setExportFormat={setExportFormat}
          backgroundType={backgroundType}
          setBackgroundType={setBackgroundType}
          onExport={handleExport}
        />
      </div>

      {/* Hidden export canvas */}
      <ExportCanvas
        format={format}
        columns={VIRTUAL_GRID}
        gapSize={gapSize}
        cornerRadius={cornerRadius}
        canvasMargin={canvasMargin}
        strokeWidth={strokeWidth}
        exportTrigger={exportTrigger}
        exportFormat={exportFormat}
        backgroundType={backgroundType}
        panelItems={panelItems}
        cuts={cuts}
      />
    </div>
  );
}