/**
 * Predefined comic-page layouts, expressed as panel rectangles in a fixed
 * 24×24 virtual grid (matches VIRTUAL_GRID in app/page.tsx). Each template's
 * panels must exactly tile the 24×24 area with no gaps or overlaps.
 */

export interface TemplateShape {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PanelTemplate {
  id: string;
  label: string;
  panels: TemplateShape[];
}

export const PANEL_TEMPLATES: PanelTemplate[] = [
  {
    id: 'grid-2x2',
    label: '▦ Grilla 2×2',
    panels: [
      { x: 0, y: 0, w: 12, h: 12 }, { x: 12, y: 0, w: 12, h: 12 },
      { x: 0, y: 12, w: 12, h: 12 }, { x: 12, y: 12, w: 12, h: 12 },
    ],
  },
  {
    id: 'grid-2x3',
    label: '▦ Grilla 2×3',
    panels: [
      { x: 0, y: 0, w: 8, h: 12 }, { x: 8, y: 0, w: 8, h: 12 }, { x: 16, y: 0, w: 8, h: 12 },
      { x: 0, y: 12, w: 8, h: 12 }, { x: 8, y: 12, w: 8, h: 12 }, { x: 16, y: 12, w: 8, h: 12 },
    ],
  },
  {
    id: 'grid-3x3',
    label: '▦ Grilla 3×3',
    panels: [
      { x: 0, y: 0, w: 8, h: 8 }, { x: 8, y: 0, w: 8, h: 8 }, { x: 16, y: 0, w: 8, h: 8 },
      { x: 0, y: 8, w: 8, h: 8 }, { x: 8, y: 8, w: 8, h: 8 }, { x: 16, y: 8, w: 8, h: 8 },
      { x: 0, y: 16, w: 8, h: 8 }, { x: 8, y: 16, w: 8, h: 8 }, { x: 16, y: 16, w: 8, h: 8 },
    ],
  },
  {
    id: 'splash-full',
    label: '🖼️ Página completa',
    panels: [{ x: 0, y: 0, w: 24, h: 24 }],
  },
  {
    id: 'splash-top',
    label: '🖼️ Splash superior + 3',
    panels: [
      { x: 0, y: 0, w: 24, h: 12 },
      { x: 0, y: 12, w: 8, h: 12 }, { x: 8, y: 12, w: 8, h: 12 }, { x: 16, y: 12, w: 8, h: 12 },
    ],
  },
  {
    id: 'splash-bottom',
    label: '🖼️ Splash inferior + 3',
    panels: [
      { x: 0, y: 0, w: 8, h: 12 }, { x: 8, y: 0, w: 8, h: 12 }, { x: 16, y: 0, w: 8, h: 12 },
      { x: 0, y: 12, w: 24, h: 12 },
    ],
  },
  {
    id: 'hero-left',
    label: '🦸 Héroe izquierda + 2',
    panels: [
      { x: 0, y: 0, w: 14, h: 24 },
      { x: 14, y: 0, w: 10, h: 12 }, { x: 14, y: 12, w: 10, h: 12 },
    ],
  },
  {
    id: 'hero-right',
    label: '🦸 Héroe derecha + 2',
    panels: [
      { x: 0, y: 0, w: 10, h: 12 }, { x: 0, y: 12, w: 10, h: 12 },
      { x: 10, y: 0, w: 14, h: 24 },
    ],
  },
  {
    id: 'manga-action',
    label: '⚡ Acción dinámica',
    panels: [
      { x: 0, y: 0, w: 16, h: 9 }, { x: 16, y: 0, w: 8, h: 9 },
      { x: 0, y: 9, w: 8, h: 15 }, { x: 8, y: 9, w: 16, h: 8 }, { x: 8, y: 17, w: 16, h: 7 },
    ],
  },
  {
    id: 'strip-3v',
    label: '📜 Tira vertical (3 columnas)',
    panels: [
      { x: 0, y: 0, w: 8, h: 24 }, { x: 8, y: 0, w: 8, h: 24 }, { x: 16, y: 0, w: 8, h: 24 },
    ],
  },
  {
    id: 'strip-4h',
    label: '📜 Tira horizontal (4 filas)',
    panels: [
      { x: 0, y: 0, w: 24, h: 6 }, { x: 0, y: 6, w: 24, h: 6 },
      { x: 0, y: 12, w: 24, h: 6 }, { x: 0, y: 18, w: 24, h: 6 },
    ],
  },
];
