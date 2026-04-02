"use client";

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Download, Image, FileImage } from 'lucide-react';
import type { ExportFormat, BackgroundType } from './BulletGenerator';

const FORMAT_PRESETS: Record<string, { width: number; height: number } | null> = {
  'square': { width: 1080, height: 1080 },
  'story': { width: 1080, height: 1920 },
  'a4-v': { width: 2480, height: 3508 },
  'a4-h': { width: 3508, height: 2480 },
  'comic-usa': { width: 2063, height: 3131 },
  'manga-b5': { width: 2079, height: 2953 },
  'webtoon': { width: 800, height: 1280 },
  'custom': null,
};

const PRESET_LABELS: Record<string, string> = {
  'square': '📐 Cuadrado (1080×1080)',
  'story': '📱 Story (1080×1920)',
  'a4-v': '📄 A4 Vertical',
  'a4-h': '📄 A4 Horizontal',
  'comic-usa': '🦸 Cómic USA',
  'manga-b5': '🎌 Manga B5',
  'webtoon': '📜 Webtoon Strip',
  'custom': '✏️ Personalizado',
};

interface ToolsBarProps {
  format: { width: number; height: number };
  setFormat: React.Dispatch<React.SetStateAction<{ width: number; height: number }>>;
  rows: number;
  setRows: React.Dispatch<React.SetStateAction<number>>;
  columns: number;
  setColumns: React.Dispatch<React.SetStateAction<number>>;
  isSymmetrical: boolean;
  setIsSymmetrical: React.Dispatch<React.SetStateAction<boolean>>;
  gapSize: number;
  setGapSize: React.Dispatch<React.SetStateAction<number>>;
  cornerRadius: number;
  setCornerRadius: React.Dispatch<React.SetStateAction<number>>;
  canvasMargin: number;
  setCanvasMargin: React.Dispatch<React.SetStateAction<number>>;
  strokeWidth: number;
  setStrokeWidth: React.Dispatch<React.SetStateAction<number>>;
  exportFormat: ExportFormat;
  setExportFormat: React.Dispatch<React.SetStateAction<ExportFormat>>;
  backgroundType: BackgroundType;
  setBackgroundType: React.Dispatch<React.SetStateAction<BackgroundType>>;
  onExport: () => void;
}

const ToolsBar: React.FC<ToolsBarProps> = ({
  format,
  setFormat,
  rows,
  setRows,
  columns,
  setColumns,
  isSymmetrical,
  setIsSymmetrical,
  gapSize,
  setGapSize,
  cornerRadius,
  setCornerRadius,
  canvasMargin,
  setCanvasMargin,
  strokeWidth,
  setStrokeWidth,
  exportFormat,
  setExportFormat,
  backgroundType,
  setBackgroundType,
  onExport,
}) => {
  const [selectedPreset, setSelectedPreset] = React.useState('square');

  const handlePresetChange = (value: string) => {
    setSelectedPreset(value);
    const preset = FORMAT_PRESETS[value];
    if (preset) {
      setFormat(preset);
    }
  };

  const handleNumberInput = (
    value: string,
    setter: React.Dispatch<React.SetStateAction<number>>
  ) => {
    const num = value === '' ? 0 : Number(value);
    setter(num);
  };

  const handleWidthChange = (value: string) => {
    setSelectedPreset('custom');
    setFormat((prev) => ({ ...prev, width: Number(value) || 0 }));
  };

  const handleHeightChange = (value: string) => {
    setSelectedPreset('custom');
    setFormat((prev) => ({ ...prev, height: Number(value) || 0 }));
  };

  return (
    <div className="space-y-5">
      <h2 className="text-xl md:text-2xl font-bold">🛠 Herramientas</h2>

      {/* ═══ FORMAT PRESETS ═══ */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Formato
        </Label>
        <Select value={selectedPreset} onValueChange={handlePresetChange}>
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar formato" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PRESET_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="width" className="text-xs">Ancho (px)</Label>
          <Input
            id="width"
            type="number"
            value={format.width || ''}
            onChange={(e) => handleWidthChange(e.target.value)}
            className="h-9"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="height" className="text-xs">Alto (px)</Label>
          <Input
            id="height"
            type="number"
            value={format.height || ''}
            onChange={(e) => handleHeightChange(e.target.value)}
            className="h-9"
          />
        </div>
      </div>

      <Separator />

      {/* ═══ GRID SETTINGS ═══ */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Grilla
        </Label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="rows" className="text-xs">Filas</Label>
          <Input
            id="rows"
            type="number"
            min={1}
            max={10}
            value={rows || ''}
            onChange={(e) => handleNumberInput(e.target.value, setRows)}
            className="h-9"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="columns" className="text-xs">Columnas</Label>
          <Input
            id="columns"
            type="number"
            min={1}
            max={10}
            value={columns || ''}
            onChange={(e) => handleNumberInput(e.target.value, setColumns)}
            className="h-9"
          />
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="symmetrical"
          checked={isSymmetrical}
          onCheckedChange={setIsSymmetrical}
        />
        <Label htmlFor="symmetrical" className="text-sm">Viñetas simétricas</Label>
      </div>

      <div className="space-y-2">
        <Label htmlFor="gapSize" className="text-xs">
          Espacio entre viñetas: <span className="font-mono text-muted-foreground">{gapSize}px</span>
        </Label>
        <Slider
          id="gapSize"
          min={0}
          max={50}
          step={1}
          value={[gapSize]}
          onValueChange={(value) => setGapSize(value[0])}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="canvasMargin" className="text-xs">
          Márgenes del formato: <span className="font-mono text-muted-foreground">{canvasMargin}px</span>
        </Label>
        <Slider
          id="canvasMargin"
          min={0}
          max={200}
          step={5}
          value={[canvasMargin]}
          onValueChange={(value) => setCanvasMargin(value[0])}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="cornerRadius" className="text-xs">
          Radio de esquinas: <span className="font-mono text-muted-foreground">{cornerRadius}px</span>
        </Label>
        <Slider
          id="cornerRadius"
          min={0}
          max={50}
          step={1}
          value={[cornerRadius]}
          onValueChange={(value) => setCornerRadius(value[0])}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="strokeWidth" className="text-xs">
          Grosor de línea: <span className="font-mono text-muted-foreground">{strokeWidth}px</span>
        </Label>
        <Slider
          id="strokeWidth"
          min={0}
          max={20}
          step={1}
          value={[strokeWidth]}
          onValueChange={(value) => setStrokeWidth(value[0])}
        />
      </div>

      <Separator />

      {/* ═══ EXPORT ═══ */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Exportar
        </Label>

        <div className="space-y-2">
          <Label className="text-xs">Formato de archivo</Label>
          <RadioGroup
            value={exportFormat}
            onValueChange={(v) => setExportFormat(v as ExportFormat)}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="png" id="fmt-png" />
              <Label htmlFor="fmt-png" className="text-sm flex items-center gap-1 cursor-pointer">
                <Image className="h-3.5 w-3.5" /> PNG
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="jpg" id="fmt-jpg" />
              <Label htmlFor="fmt-jpg" className="text-sm flex items-center gap-1 cursor-pointer">
                <FileImage className="h-3.5 w-3.5" /> JPG
              </Label>
            </div>
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Fondo</Label>
          <RadioGroup
            value={exportFormat === 'jpg' ? 'white' : backgroundType}
            onValueChange={(v) => setBackgroundType(v as BackgroundType)}
            className="flex gap-4"
            disabled={exportFormat === 'jpg'}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="white" id="bg-white" />
              <Label htmlFor="bg-white" className="text-sm cursor-pointer">⬜ Blanco</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="transparent" id="bg-transparent" />
              <Label
                htmlFor="bg-transparent"
                className={`text-sm cursor-pointer ${exportFormat === 'jpg' ? 'opacity-50' : ''}`}
              >
                🏁 Transparente
              </Label>
            </div>
          </RadioGroup>
          {exportFormat === 'jpg' && (
            <p className="text-xs text-muted-foreground italic">
              JPG no admite transparencia, se usará fondo blanco.
            </p>
          )}
        </div>

        <Button onClick={onExport} className="w-full" size="lg">
          <Download className="mr-2 h-4 w-4" />
          Descargar {exportFormat.toUpperCase()}
        </Button>
      </div>
    </div>
  );
};

export default ToolsBar;
