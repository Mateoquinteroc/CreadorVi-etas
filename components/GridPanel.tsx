"use client";

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { GridStack, GridStackNode } from 'gridstack';
import 'gridstack/dist/gridstack.min.css';

export interface PanelItem {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface GridPanelProps {
  format: { width: number; height: number };
  rows: number;
  columns: number;
  gapSize: number;
  cornerRadius: number;
  canvasMargin: number;
  strokeWidth: number;
  onLayoutChange: (items: PanelItem[]) => void;
  panelItems: PanelItem[];
  virtualGrid: number;
}

const GridPanel: React.FC<GridPanelProps> = ({
  format,
  rows,
  columns,
  gapSize,
  cornerRadius,
  canvasMargin,
  strokeWidth,
  onLayoutChange,
  panelItems,
  virtualGrid,
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const gridInstance = useRef<GridStack | null>(null);
  const isUpdatingFromProps = useRef(false);
  const [isReady, setIsReady] = useState(false);
  const [dimensions, setDimensions] = useState({ w: 0, h: 0 });

  const scale = format.width > 0 ? dimensions.w / format.width : 1;

  const propRefs = useRef({ cornerRadius, strokeWidth, scale });
  useEffect(() => {
    propRefs.current = { cornerRadius, strokeWidth, scale };
  }, [cornerRadius, strokeWidth, scale]);

  // Update layout dimensions safely
  useEffect(() => {
    if (!wrapperRef.current) return;
    
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      const { width, height } = entry.contentRect;
      if (width === 0 || height === 0) return;
      
      const targetRatio = format.width / format.height;
      const spaceRatio = width / height;

      if (spaceRatio > targetRatio) {
        // Height is the limit
        setDimensions({ w: height * targetRatio, h: height });
      } else {
        // Width is the limit
        setDimensions({ w: width, h: width / targetRatio });
      }
    });

    observer.observe(wrapperRef.current);
    return () => observer.disconnect();
  }, [format.width, format.height]);

  const createPanelDOM = useCallback((item: PanelItem) => {
    const el = document.createElement('div');
    el.className = 'grid-stack-item';
    el.setAttribute('gs-id', item.id);
    el.setAttribute('gs-x', String(item.x));
    el.setAttribute('gs-y', String(item.y));
    el.setAttribute('gs-w', String(item.w));
    el.setAttribute('gs-h', String(item.h));
    el.setAttribute('gs-min-w', '1');
    el.setAttribute('gs-min-h', '1');

    const content = document.createElement('div');
    content.className = 'grid-stack-item-content panel-cell group cursor-pointer';
    content.style.borderRadius = `${propRefs.current.cornerRadius * propRefs.current.scale}px`;
    content.style.borderWidth = `${propRefs.current.strokeWidth * propRefs.current.scale}px`;

    // Panel number label
    const label = document.createElement('span');
    label.className = 'panel-label';
    label.textContent = item.id.replace('panel-', '').split('-').pop() || '';
    content.appendChild(label);

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.innerHTML = '×';
    deleteBtn.title = 'Eliminar';
    deleteBtn.className = 'absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center font-bold shadow-md hover:bg-red-600 z-50 opacity-0 transition-opacity cursor-pointer text-sm leading-none';
    deleteBtn.onmousedown = (e) => { e.stopPropagation(); };
    deleteBtn.onclick = (e) => {
      e.preventDefault(); e.stopPropagation();
      if (gridInstance.current) { gridInstance.current.removeWidget(el); }
    };
    content.appendChild(deleteBtn);

    // Duplicate button
    const dupBtn = document.createElement('button');
    dupBtn.innerHTML = '⧉';
    dupBtn.title = 'Duplicar';
    dupBtn.className = 'absolute top-2 right-10 bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center font-bold shadow-md hover:bg-blue-600 z-50 opacity-0 transition-opacity cursor-pointer text-sm leading-none';
    dupBtn.onmousedown = (e) => { e.stopPropagation(); };
    dupBtn.onclick = (e) => {
      e.preventDefault(); e.stopPropagation();
      if (gridInstance.current) {
        const node = (el as any).gridstackNode;
        const w = node?.w || parseInt(el.getAttribute('gs-w') || '1', 10);
        const h = node?.h || parseInt(el.getAttribute('gs-h') || '1', 10);
        const x = node?.x ?? parseInt(el.getAttribute('gs-x') || '0', 10);
        const y = node?.y ?? parseInt(el.getAttribute('gs-y') || '0', 10);
        let maxNum = 0;
        gridInstance.current.getGridItems().forEach(elNode => {
           const id = elNode.getAttribute('gs-id');
           if (id && typeof id === 'string') {
               const num = parseInt(id.replace('panel-', ''), 10);
               if (!isNaN(num) && num > maxNum) maxNum = num;
           }
        });
        const newId = `panel-${maxNum + 1}`;
        const newEl = createPanelDOM({ id: newId, x, y, w, h });
        gridInstance.current.addWidget(newEl);
      }
    };
    content.appendChild(dupBtn);

    // Explicit JS selection
    content.onmousedown = () => {
      const isSelected = content.classList.contains('ring-4');
      document.querySelectorAll('.panel-cell').forEach(cell => {
        cell.classList.remove('ring-4', 'ring-blue-500');
        cell.querySelectorAll('button').forEach(btn => btn.classList.replace('opacity-100', 'opacity-0'));
      });
      if (!isSelected) {
        content.classList.add('ring-4', 'ring-blue-500');
        deleteBtn.classList.replace('opacity-0', 'opacity-100');
        dupBtn.classList.replace('opacity-0', 'opacity-100');
      }
    };

    el.appendChild(content);
    return el;
  }, [cornerRadius, strokeWidth]);

  // Initialize GridStack
  useEffect(() => {
    if (!gridRef.current) return;

    // Destroy previous instance if it exists
    if (gridInstance.current) {
      gridInstance.current.destroy(false);
      gridInstance.current = null;
    }

    // Clear the container
    gridRef.current.innerHTML = '';

    // Create grid items in the DOM
    panelItems.forEach((item) => {
      const el = createPanelDOM(item);
      gridRef.current!.appendChild(el);
    });

    // Calculate scaled padding and inner height
    const scale = format.width > 0 ? dimensions.w / format.width : 1;
    const paddingPx = canvasMargin * scale;
    const innerHeight = dimensions.h - 2 * paddingPx;

    // Initialize GridStack logic
    const grid = GridStack.init(
      {
        column: virtualGrid,
        maxRow: 0,
        row: 0,
        cellHeight: innerHeight > 0 ? (innerHeight / virtualGrid) : 'auto',
        margin: gapSize * scale,
        float: true,
        animate: true,
        resizable: {
          handles: 'e,se,s,sw,w',
        },
        draggable: {
          handle: '.panel-cell',
        },
        removable: false,
      },
      gridRef.current!
    );

    gridInstance.current = grid;
    setIsReady(true);

    const handleChange = () => {
      if (isUpdatingFromProps.current) return;

      const allNodes = grid.getGridItems().map((el) => {
        const node = (el as any).gridstackNode;
        return {
          id: el.getAttribute('gs-id') || '',
          x: node?.x ?? parseInt(el.getAttribute('gs-x') || '0', 10),
          y: node?.y ?? parseInt(el.getAttribute('gs-y') || '0', 10),
          w: node?.w ?? parseInt(el.getAttribute('gs-w') || '1', 10),
          h: node?.h ?? parseInt(el.getAttribute('gs-h') || '1', 10),
        };
      });

      onLayoutChange(allNodes);
    };

    grid.on('added change removed dragstop', handleChange as any);

    // Auto-shrink logic when a panel is resized and pushes other panels
    let preResizeState: Record<string, any> = {};

    grid.on('resizestart', () => {
      preResizeState = {};
      grid.engine.nodes.forEach(n => {
        if (n.el) {
          preResizeState[n.id as string] = {
            id: n.id,
            x: n.x, y: n.y, w: n.w, h: n.h
          };
        }
      });
    });

    grid.on('resizestop', (e, el) => {
      const updates: GridStackNode[] = [];
      
      grid.engine.nodes.forEach(n => {
        if (n.el === el) return; // Skip the one resized

        const oldNode = preResizeState[n.id as string];
        if (oldNode) {
          let updated = false;
          let newX = n.x ?? 0;
          let newY = n.y ?? 0;
          let newW = n.w ?? 1;
          let newH = n.h ?? 1;

          if (newX > oldNode.x) { // Pushed right
            const diff = newX - oldNode.x;
            newW = newW - diff;
            newX = oldNode.x;
            updated = true;
          }
          if (newY > oldNode.y) { // Pushed down
            const diff = newY - oldNode.y;
            newH = newH - diff;
            newY = oldNode.y;
            updated = true;
          }

          const MIN_SIZE = 2; // El punto de control: tamaño mínimo permitido antes de sobreponerse (escapar)

          if (updated) {
            if (newW >= MIN_SIZE && newH >= MIN_SIZE) {
              updates.push({ el: n.el, x: newX, y: newY, w: newW, h: newH });
            }
            // Si el bloque se haría más pequeño que MIN_SIZE, no hacemos nada.
            // Esto permite que GridStack lo mantenga en su nueva posición desplazada
            // (habrá saltado por encima de la viñeta que lo oprimía).
          }
        }
      });
      
      if (updates.length > 0) {
         isUpdatingFromProps.current = true;
         // (grid as any).batchUpdate(); // Optionally batch updates
         updates.forEach(u => {
             grid.update(u.el!, { x: u.x, y: u.y, w: u.w, h: u.h });
         });
         // (grid as any).commit();
         isUpdatingFromProps.current = false;
         
         // Trigger state update
         handleChange();
      }
    });

    return () => {
      grid.off('change');
      grid.destroy(false);
      gridInstance.current = null;
      setIsReady(false);
    };
  }, [virtualGrid, rows]); // Re-init strictly when dimensions change or structural rows change

  // Sync added or removed panels from outside (e.g. user clicked Add Panel, changed rows/cols)
  useEffect(() => {
    if (!gridInstance.current || !isReady) return;
    const grid = gridInstance.current;
    const existingElements = grid.getGridItems();
    const existingIds = existingElements.map(el => el.getAttribute('gs-id'));
    const newItemsIds = panelItems.map(item => item.id);
    
    // Remove panels that are no longer in state
    existingElements.forEach(el => {
      const id = el.getAttribute('gs-id');
      if (id && !newItemsIds.includes(id)) {
        grid.removeWidget(el, true); // true = remove DOM node
      }
    });

    // Add new panels that are in state but not in grid
    panelItems.forEach(item => {
      if (!existingIds.includes(item.id)) {
        const el = createPanelDOM(item);
        grid.addWidget(el);
      }
    });
  }, [panelItems, createPanelDOM, isReady]);

  // Dynamically update margins
  useEffect(() => {
    if (gridInstance.current && isReady) {
      gridInstance.current.margin((gapSize * scale) as any);
    }
  }, [gapSize, scale, isReady]);

  // Dynamically update cell height
  useEffect(() => {
    if (gridInstance.current && isReady && dimensions.h > 0) {
      const paddingPx = canvasMargin * scale;
      const innerHeight = dimensions.h - 2 * paddingPx;
      gridInstance.current.cellHeight(Math.max(1, innerHeight / virtualGrid));
    }
  }, [dimensions.h, dimensions.w, format.width, virtualGrid, canvasMargin, isReady]);

  // Update corner radius on existing items without re-init
  useEffect(() => {
    if (!gridRef.current) return;
    const cells = gridRef.current.querySelectorAll('.panel-cell');
    cells.forEach((cell) => {
      (cell as HTMLElement).style.borderRadius = `${cornerRadius * scale}px`;
    });
  }, [cornerRadius, scale]);

  // Update stroke width on existing items without re-init
  useEffect(() => {
    if (!gridRef.current) return;
    const cells = gridRef.current.querySelectorAll('.panel-cell');
    cells.forEach((cell) => {
      (cell as HTMLElement).style.borderWidth = `${Math.max(1, strokeWidth * scale)}px`;
    });
  }, [strokeWidth, scale]);

  const paddingPx = canvasMargin * scale;

  return (
    <div className="grid-panel-wrapper" ref={wrapperRef}>
      <div 
        id="export-canvas-container"
        className="canvas-container relative"
        style={{ 
          width: dimensions.w, 
          height: dimensions.h,
          padding: `${paddingPx}px`,
          boxSizing: 'border-box'
        }}
      >
        <div ref={gridRef} className="grid-stack w-full h-full relative" />
      </div>
      <style jsx global>{`
        .grid-panel-wrapper {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 8px; /* Safe padding */
        }

        .canvas-container {
          background: white;
          border: 1px solid #e5e7eb;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1);
          border-radius: 4px;
          position: relative;
        }

        .grid-panel-wrapper .grid-stack {
          width: 100%;
          height: 100%;
        }

        .grid-panel-wrapper .grid-stack-item-content.panel-cell {
          background: white;
          border: 2px solid #1a1a1a;
          cursor: grab;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: box-shadow 0.2s ease, border-color 0.2s ease;
        }

        .grid-panel-wrapper .grid-stack-item-content.panel-cell:hover {
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
        }

        .grid-panel-wrapper .grid-stack-item-content.panel-cell:active {
          cursor: grabbing;
        }

        .panel-label {
          font-size: 1.5rem;
          font-weight: 700;
          color: #d1d5db;
          user-select: none;
          pointer-events: none;
        }

        /* Resize handle styling */
        .grid-panel-wrapper .ui-resizable-handle {
          z-index: 10;
        }

        .grid-panel-wrapper .ui-resizable-se {
          width: 16px;
          height: 16px;
          right: 2px;
          bottom: 2px;
          background: #3b82f6;
          border-radius: 2px;
          opacity: 0;
          transition: opacity 0.2s ease;
        }

        .grid-panel-wrapper .ui-resizable-e {
          width: 8px;
          right: 0;
          background: transparent;
          cursor: e-resize;
        }

        .grid-panel-wrapper .ui-resizable-s {
          height: 8px;
          bottom: 0;
          background: transparent;
          cursor: s-resize;
        }

        .grid-panel-wrapper .ui-resizable-w {
          width: 8px;
          left: 0;
          background: transparent;
          cursor: w-resize;
        }

        .grid-panel-wrapper .ui-resizable-sw {
          width: 16px;
          height: 16px;
          left: 2px;
          bottom: 2px;
          background: transparent;
          cursor: sw-resize;
        }

        .grid-panel-wrapper .grid-stack-item:hover .ui-resizable-se {
          opacity: 1;
        }

        /* Placeholder styling */
        .grid-panel-wrapper .grid-stack-placeholder > .placeholder-content {
          background: rgba(59, 130, 246, 0.1) !important;
          border: 2px dashed #3b82f6 !important;
          border-radius: 4px;
        }

        /* Mobile touch enhancements */
        @media (max-width: 768px) {
          .grid-panel-wrapper .ui-resizable-se {
            width: 24px;
            height: 24px;
            opacity: 0.7;
          }

          .grid-panel-wrapper .ui-resizable-e {
            width: 14px;
          }

          .grid-panel-wrapper .ui-resizable-s {
            height: 14px;
          }

          .panel-label {
            font-size: 1rem;
          }
        }
      `}</style>
    </div>
  );
};

export default GridPanel;
