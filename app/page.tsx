"use client";

import { useState } from 'react';
import BulletGenerator from '@/components/BulletGenerator';
import ToolsBar from '@/components/ToolsBar';

export default function Home() {
  const [format, setFormat] = useState({ width: 1080, height: 1080 });
  const [rows, setRows] = useState(1);
  const [columns, setColumns] = useState(3);
  const [isSymmetrical, setIsSymmetrical] = useState(true);
  const [gapSize, setGapSize] = useState(10);
  const [cornerRadius, setCornerRadius] = useState(0);

  return (
    <div className="flex h-screen">
      <div className="w-2/3 p-4 bg-gray-100 flex flex-col">
        <BulletGenerator
          format={format}
          rows={rows}
          columns={columns}
          isSymmetrical={isSymmetrical}
          gapSize={gapSize}
          cornerRadius={cornerRadius}
        />
      </div>
      <div className="w-1/3 p-4 bg-white overflow-y-auto">
        <ToolsBar
          format={format}
          setFormat={setFormat}
          rows={rows}
          setRows={setRows}
          columns={columns}
          setColumns={setColumns}
          isSymmetrical={isSymmetrical}
          setIsSymmetrical={setIsSymmetrical}
          gapSize={gapSize}
          setGapSize={setGapSize}
          cornerRadius={cornerRadius}
          setCornerRadius={setCornerRadius}
        />
      </div>
    </div>
  );
}