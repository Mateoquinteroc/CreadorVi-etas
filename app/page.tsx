"use client";

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import ExportCanvas from '@/components/BulletGenerator';
import ToolsBar from '@/components/ToolsBar';
import type { ExportFormat, BackgroundType } from '@/components/BulletGenerator';
import type { PanelItem } from '@/components/GridPanel';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

const VIRTUAL_GRID = 24;

const GridPanel = dynamic(() => import('@/components/GridPanel'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-muted-foreground">
      Cargando editor...
    </div>
  ),
});

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
  const [isSymmetrical, setIsSymmetrical] = useState(true);
  const [gapSize, setGapSize] = useState(10);
  const [cornerRadius, setCornerRadius] = useState(0);

  // Panel items state — initialized with default grid
  const [panelItems, setPanelItems] = useState<PanelItem[]>(() =>
    generateDefaultPanels(2, 3)
  );

  // Export state
  const [exportFormat, setExportFormat] = useState<ExportFormat>('png');
  const [backgroundType, setBackgroundType] = useState<BackgroundType>('white');
  const [exportTrigger, setExportTrigger] = useState(0);

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

  const handleAddPanel = useCallback(() => {
    const w = Math.max(1, Math.floor(VIRTUAL_GRID / columns));
    const h = Math.max(1, Math.floor(VIRTUAL_GRID / rows));
    const newPanel: PanelItem = {
      id: `panel-${Date.now()}`,
      x: 0,
      y: VIRTUAL_GRID, // Place at the bottom, gridstack will auto position
      w,
      h,
    };
    setPanelItems(prev => [...prev, newPanel]);
  }, [columns, rows]);

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
        <div className="flex-1 min-h-0 overflow-auto">
          <GridPanel
            format={format}
            rows={rows}
            columns={columns}
            gapSize={gapSize}
            cornerRadius={cornerRadius}
            onLayoutChange={handleLayoutChange}
            panelItems={panelItems}
            virtualGrid={VIRTUAL_GRID}
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
          isSymmetrical={isSymmetrical}
          setIsSymmetrical={setIsSymmetrical}
          gapSize={gapSize}
          setGapSize={setGapSize}
          cornerRadius={cornerRadius}
          setCornerRadius={setCornerRadius}
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
        exportTrigger={exportTrigger}
        exportFormat={exportFormat}
        backgroundType={backgroundType}
        panelItems={panelItems}
      />
    </div>
  );
}