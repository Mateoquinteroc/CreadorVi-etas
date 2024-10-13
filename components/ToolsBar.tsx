"use client";

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';

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
}) => {
  const handleNumberInput = (
    value: string,
    setter: React.Dispatch<React.SetStateAction<number>>
  ) => {
    const num = value === '' ? 0 : Number(value);
    setter(num);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold mb-4">Tools</h2>
      
      <div className="space-y-2">
        <Label htmlFor="width">Canvas Width (px)</Label>
        <Input
          id="width"
          type="number"
          value={format.width || ''}
          onChange={(e) => setFormat({ ...format, width: Number(e.target.value) })}
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="height">Canvas Height (px)</Label>
        <Input
          id="height"
          type="number"
          value={format.height || ''}
          onChange={(e) => setFormat({ ...format, height: Number(e.target.value) })}
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="rows">Number of Rows</Label>
        <Input
          id="rows"
          type="number"
          value={rows || ''}
          onChange={(e) => handleNumberInput(e.target.value, setRows)}
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="columns">Number of Columns</Label>
        <Input
          id="columns"
          type="number"
          value={columns || ''}
          onChange={(e) => handleNumberInput(e.target.value, setColumns)}
        />
      </div>
      
      <div className="flex items-center space-x-2">
        <Switch
          id="symmetrical"
          checked={isSymmetrical}
          onCheckedChange={setIsSymmetrical}
        />
        <Label htmlFor="symmetrical">Symmetrical Bullets</Label>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="gapSize">Gap Size (px)</Label>
        <Slider
          id="gapSize"
          min={0}
          max={50}
          step={1}
          value={[gapSize]}
          onValueChange={(value) => setGapSize(value[0])}
        />
        <span>{gapSize}px</span>
      </div>

      <div className="space-y-2">
        <Label htmlFor="cornerRadius">Corner Radius (px)</Label>
        <Slider
          id="cornerRadius"
          min={0}
          max={50}
          step={1}
          value={[cornerRadius]}
          onValueChange={(value) => setCornerRadius(value[0])}
        />
        <span>{cornerRadius}px</span>
      </div>
    </div>
  );
};

export default ToolsBar;