"use client";

import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { GridStack, GridStackNode } from 'gridstack';
import 'gridstack/dist/gridstack.min.css';
import {
  panelPolygon,
  roundedPolygonPath,
  findAllAdjacencies,
  cutEndpoints,
  maxCutOffset,
  type PanelCut,
  type Adjacency,
} from '@/lib/panelCuts';

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
  onDuplicate: (id: string) => void;
  panelItems: PanelItem[];
  cuts: PanelCut[];
  onUpdateCutEndpoint: (panelAId: string, panelBId: string, endpoint: 'start' | 'end', offset: number) => void;
  editVertices: boolean;
  virtualGrid: number;
  isSymmetrical: boolean;
  selectedIds: string[];
  onSelectionChange: React.Dispatch<React.SetStateAction<string[]>>;
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
  onDuplicate,
  panelItems,
  cuts,
  onUpdateCutEndpoint,
  editVertices,
  virtualGrid,
  isSymmetrical,
  selectedIds,
  onSelectionChange,
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const gridInstance = useRef<GridStack | null>(null);
  const isUpdatingFromProps = useRef(false);
  const [isReady, setIsReady] = useState(false);
  const [dimensions, setDimensions] = useState({ w: 0, h: 0 });

  const scale = format.width > 0 ? dimensions.w / format.width : 1;
  const paddingPx = canvasMargin * scale;
  const innerW = Math.max(0, dimensions.w - 2 * paddingPx);
  const innerH = Math.max(0, dimensions.h - 2 * paddingPx);

  // Same visual gutter GridStack's own margin applies between every other
  // pair of panels, expressed in grid units so panelPolygon can center a cut
  // line's gap the same way (see its own doc comment).
  const gapGrid = useMemo(() => {
    const innerExportW = format.width - 2 * canvasMargin;
    const innerExportH = format.height - 2 * canvasMargin;
    return {
      x: virtualGrid > 0 && innerExportW > 0 ? (gapSize * virtualGrid) / innerExportW : 0,
      y: virtualGrid > 0 && innerExportH > 0 ? (gapSize * virtualGrid) / innerExportH : 0,
    };
  }, [format.width, format.height, canvasMargin, virtualGrid, gapSize]);

  const propRefs = useRef({
    cornerRadius, strokeWidth, scale, isSymmetrical, onDuplicate, selectedIds, onSelectionChange,
    innerW, innerH, onUpdateCutEndpoint,
  });
  useEffect(() => {
    propRefs.current = {
      cornerRadius, strokeWidth, scale, isSymmetrical, onDuplicate, selectedIds, onSelectionChange,
      innerW, innerH, onUpdateCutEndpoint,
    };
  }, [cornerRadius, strokeWidth, scale, isSymmetrical, onDuplicate, selectedIds, onSelectionChange, innerW, innerH, onUpdateCutEndpoint]);

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
      // Let the parent decide where the copy fits (it splits this panel's own
      // space in state) instead of adding a raw widget straight into GridStack,
      // which used to drop the copy exactly on top of the original and could
      // send the whole layout into a broken, overlapping cascade.
      propRefs.current.onDuplicate(item.id);
    };
    content.appendChild(dupBtn);

    // Selection: plain click selects just this panel (or deselects if it was the
    // only one selected); shift/ctrl/cmd+click toggles it into/out of a multi-
    // selection. The actual visual state (ring + button visibility) is applied by
    // a separate effect driven by the `selectedIds` prop, not here - this only
    // reports the intent up to the parent.
    content.onmousedown = (e: MouseEvent) => {
      const isMulti = e.shiftKey || e.ctrlKey || e.metaKey;
      // Functional update: always resolves against the latest state, never a
      // possibly-stale propRefs snapshot (matters when clicks land in the same
      // batch, e.g. rapid shift-clicking before a re-render lands).
      propRefs.current.onSelectionChange((current) => {
        if (isMulti) {
          return current.includes(item.id)
            ? current.filter(id => id !== item.id)
            : [...current, item.id];
        }
        return current.length === 1 && current[0] === item.id ? [] : [item.id];
      });
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

    grid.on('added change removed', handleChange as any);

    // Auto-shrink logic when a panel is resized and pushes other panels.
    // Also doubles as the "before" snapshot for mirror-symmetric editing.
    let preActionState: Record<string, any> = {};

    const capturePreActionState = () => {
      preActionState = {};
      grid.engine.nodes.forEach(n => {
        if (n.el) {
          preActionState[n.id as string] = {
            id: n.id,
            x: n.x, y: n.y, w: n.w, h: n.h
          };
        }
      });
    };

    grid.on('dragstart resizestart', capturePreActionState);

    // A layout is valid only if every panel stays within the virtual grid bounds
    // and no two panels overlap. GridStack's own collision engine can still leave
    // things in a bad state after a large/fast resize pushes several neighbors at
    // once, so we double-check afterwards instead of trusting it blindly.
    const isLayoutValid = (): boolean => {
      const nodes = grid.engine.nodes;
      for (const n of nodes) {
        const x = n.x ?? 0, y = n.y ?? 0, w = n.w ?? 1, h = n.h ?? 1;
        if (x < 0 || y < 0 || x + w > virtualGrid || y + h > virtualGrid) return false;
      }
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const ax = a.x ?? 0, ay = a.y ?? 0, aw = a.w ?? 1, ah = a.h ?? 1;
          const bx = b.x ?? 0, by = b.y ?? 0, bw = b.w ?? 1, bh = b.h ?? 1;
          if (ax < bx + bw && bx < ax + aw && ay < by + bh && by < ay + ah) return false;
        }
      }
      return true;
    };

    // Last-resort safety net: if a drag/resize (plus any shrink/mirror follow-up)
    // left panels overlapping or outside the canvas, undo the whole action instead
    // of shipping a broken layout.
    const revertToPreAction = () => {
      grid.engine.nodes.forEach(n => {
        const before = preActionState[n.id as string];
        if (before && n.el) {
          grid.update(n.el, { x: before.x, y: before.y, w: before.w, h: before.h });
        }
      });
    };

    // Mirrors a drag/resize onto the panel that was symmetrically opposite
    // (point-mirrored through the grid center) before the action started.
    const applyMirror = (el: HTMLElement): boolean => {
      const id = el.getAttribute('gs-id');
      if (!id) return false;
      const oldSelf = preActionState[id];
      const node = (el as any).gridstackNode;
      if (!oldSelf || !node) return false;

      const mirrorOldX = virtualGrid - oldSelf.x - oldSelf.w;
      const mirrorOldY = virtualGrid - oldSelf.y - oldSelf.h;

      const partnerEntry = Object.entries(preActionState).find(
        ([pid, p]: [string, any]) =>
          pid !== id &&
          p.x === mirrorOldX &&
          p.y === mirrorOldY &&
          p.w === oldSelf.w &&
          p.h === oldSelf.h
      );
      if (!partnerEntry) return false;

      const partnerNode = grid.engine.nodes.find(n => n.id === partnerEntry[0]);
      if (!partnerNode || !partnerNode.el) return false;

      const newW = node.w ?? oldSelf.w;
      const newH = node.h ?? oldSelf.h;
      const newX = Math.max(0, virtualGrid - (node.x ?? oldSelf.x) - newW);
      const newY = Math.max(0, virtualGrid - (node.y ?? oldSelf.y) - newH);

      if (
        partnerNode.x === newX &&
        partnerNode.y === newY &&
        partnerNode.w === newW &&
        partnerNode.h === newH
      ) {
        return false;
      }

      grid.update(partnerNode.el, { x: newX, y: newY, w: newW, h: newH });
      return true;
    };

    grid.on('dragstop', (e, el) => {
      isUpdatingFromProps.current = true;
      if (propRefs.current.isSymmetrical) {
        applyMirror(el);
      }
      if (!isLayoutValid()) {
        revertToPreAction();
      }
      isUpdatingFromProps.current = false;
      handleChange();
    });

    grid.on('resizestop', (e, el) => {
      const updates: GridStackNode[] = [];

      // Compute compensation from geometry directly (resized panel's OLD vs NEW rect
      // vs each neighbor's OLD rect), instead of trusting whether GridStack's own
      // collision engine actually moved the neighbor. When the canvas is fully packed
      // (no free rows/cols left), `maxRow` blocks GridStack from pushing a neighbor at
      // all rather than moving it - so "did it move" is not a reliable signal that a
      // neighbor now overlaps the resized panel.
      const selfId = el.getAttribute('gs-id');
      const oldSelf = selfId ? preActionState[selfId] : undefined;
      const selfNode = (el as any).gridstackNode;

      if (oldSelf && selfNode) {
        const newSelf = {
          x: selfNode.x ?? oldSelf.x, y: selfNode.y ?? oldSelf.y,
          w: selfNode.w ?? oldSelf.w, h: selfNode.h ?? oldSelf.h,
        };

        grid.engine.nodes.forEach(n => {
          if (n.el === el) return; // Skip the one resized

          const oldNode = preActionState[n.id as string];
          if (!oldNode) return;

          let newX = oldNode.x;
          let newY = oldNode.y;
          let newW = oldNode.w;
          let newH = oldNode.h;
          let updated = false;

          // Neighbor was to the right -> growing right can push into it; shrink its
          // near (left) edge to the resized panel's new right edge, far edge fixed.
          if (oldNode.x >= oldSelf.x + oldSelf.w && newSelf.x + newSelf.w > oldNode.x) {
            const farEdge = oldNode.x + oldNode.w;
            newX = newSelf.x + newSelf.w;
            newW = farEdge - newX;
            updated = true;
          }
          // Neighbor was to the left -> growing left can push into it; shrink its
          // near (right) edge to the resized panel's new left edge, far edge fixed.
          if (oldNode.x + oldNode.w <= oldSelf.x && newSelf.x < oldNode.x + oldNode.w) {
            newW = newSelf.x - oldNode.x;
            updated = true;
          }
          // Neighbor was below -> growing down can push into it; shrink its near (top)
          // edge to the resized panel's new bottom edge, far edge fixed.
          if (oldNode.y >= oldSelf.y + oldSelf.h && newSelf.y + newSelf.h > oldNode.y) {
            const farEdge = oldNode.y + oldNode.h;
            newY = newSelf.y + newSelf.h;
            newH = farEdge - newY;
            updated = true;
          }

          const MIN_SIZE = 2; // El punto de control: tamaño mínimo permitido antes de sobreponerse (escapar)

          if (updated) {
            if (newW >= MIN_SIZE && newH >= MIN_SIZE) {
              updates.push({ el: n.el, x: newX, y: newY, w: newW, h: newH });
            }
            // Si el bloque se haría más pequeño que MIN_SIZE, no hacemos nada.
            // El validador final (isLayoutValid) revertirá toda la acción si esto
            // deja una superposición o algo fuera de los límites del lienzo.
          }
        });
      }

      isUpdatingFromProps.current = true;
      if (updates.length > 0) {
        updates.forEach(u => {
          grid.update(u.el!, { x: u.x, y: u.y, w: u.w, h: u.h });
        });
      }
      if (propRefs.current.isSymmetrical) {
        applyMirror(el);
      }
      if (!isLayoutValid()) {
        revertToPreAction();
      }
      isUpdatingFromProps.current = false;

      handleChange();
    });

    return () => {
      grid.off('change');
      grid.destroy(false);
      gridInstance.current = null;
      setIsReady(false);
    };
  }, [virtualGrid, rows]); // Re-init strictly when dimensions change or structural rows change

  // Sync added, removed, or externally-resized panels (e.g. user clicked Add Panel,
  // changed rows/cols, or a panel got shrunk in state to make room for a new one).
  useEffect(() => {
    if (!gridInstance.current || !isReady) return;
    const grid = gridInstance.current;
    const existingElements = grid.getGridItems();
    const existingIds = existingElements.map(el => el.getAttribute('gs-id'));
    const newItemsIds = panelItems.map(item => item.id);

    // Remove panels that are no longer in state, add new ones, and update existing
    // ones whose position/size changed externally (processed in array order so a
    // panel that got shrunk to make room is resized BEFORE the new panel is dropped
    // into it). All guarded together: GridStack fires 'removed'/'added' for each
    // individual change, and without the guard each of those intermediate events
    // would flow back through handleChange and briefly overwrite React state with
    // a half-updated (e.g. empty, mid-removal) list.
    isUpdatingFromProps.current = true;
    existingElements.forEach(el => {
      const id = el.getAttribute('gs-id');
      if (id && !newItemsIds.includes(id)) {
        grid.removeWidget(el, true); // true = remove DOM node
      }
    });

    panelItems.forEach(item => {
      if (!existingIds.includes(item.id)) {
        const el = createPanelDOM(item);
        grid.addWidget(el);
      } else {
        const el = existingElements.find(e => e.getAttribute('gs-id') === item.id);
        const node = el && (el as any).gridstackNode;
        if (el && node && (node.x !== item.x || node.y !== item.y || node.w !== item.w || node.h !== item.h)) {
          grid.update(el, { x: item.x, y: item.y, w: item.w, h: item.h });
        }
      }
    });
    isUpdatingFromProps.current = false;
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

  // Update stroke width on existing items without re-init. Panels with an
  // active cut get their CSS border zeroed out instead - a plain box border
  // can only ever be drawn along the element's original rectangular edges, so
  // it can't trace a clip-path's diagonal edge. The SVG overlay (below) draws
  // their entire outline - straight edges included - so there's one single
  // source of the visible stroke instead of two disagreeing ones.
  useEffect(() => {
    if (!gridRef.current) return;
    const relevantIds = new Set(cuts.flatMap(c => [c.panelAId, c.panelBId]));
    gridRef.current.querySelectorAll('.grid-stack-item').forEach((el) => {
      const id = el.getAttribute('gs-id');
      const cell = el.querySelector('.panel-cell') as HTMLElement | null;
      if (!cell) return;
      cell.style.borderWidth = relevantIds.has(id || '') ? '0px' : `${Math.max(1, strokeWidth * scale)}px`;
    });
  }, [strokeWidth, scale, cuts]);

  // Apply the selection ring + delete/duplicate button visibility for whichever
  // panels are in `selectedIds`. Panels are plain DOM nodes (not React-rendered),
  // so selection state is pushed onto them imperatively rather than via props.
  useEffect(() => {
    if (!gridRef.current) return;
    gridRef.current.querySelectorAll('.grid-stack-item').forEach((el) => {
      const id = el.getAttribute('gs-id');
      const content = el.querySelector('.panel-cell');
      if (!content) return;
      const isSelected = !!id && selectedIds.includes(id);
      content.classList.toggle('ring-4', isSelected);
      content.classList.toggle('ring-blue-500', isSelected);
      content.querySelectorAll('button').forEach((btn) => {
        btn.classList.toggle('opacity-100', isSelected);
        btn.classList.toggle('opacity-0', !isSelected);
      });
    });
  }, [selectedIds, panelItems]);

  // Apply diagonal-cut clip-paths. A CSS clip-path can only ever SUBTRACT from
  // an element's own box - it can't reveal paint beyond it. Since a cut always
  // makes one panel's shape reach past its own rectangle (into whatever the
  // neighbor - or the gap between them - used to occupy), that panel's DOM box
  // has to actually be enlarged to cover its polygon's bounding box first; only
  // then does clip-path have real pixels to shape within that larger box.
  //
  // Panels not referenced by any cut are left alone (a polygon clip-path, even
  // a plain-rectangle one, would flatten rounded corners, so untouched panels
  // keep using border-radius normally).
  useEffect(() => {
    if (!gridRef.current) return;
    const relevantIds = new Set(cuts.flatMap(c => [c.panelAId, c.panelBId]));

    gridRef.current.querySelectorAll('.grid-stack-item').forEach((el) => {
      const id = el.getAttribute('gs-id');
      const content = el.querySelector('.panel-cell') as HTMLElement | null;
      if (!content || !id) return;

      // Clear any previous override before measuring, so the box we read below
      // reflects GridStack's normal (un-enlarged) placement for this panel.
      content.style.position = '';
      content.style.left = '';
      content.style.top = '';
      content.style.width = '';
      content.style.height = '';
      content.style.clipPath = '';

      if (!relevantIds.has(id)) return;
      const panel = panelItems.find(p => p.id === id);
      if (!panel) return;

      const points = panelPolygon(panel, panelItems, cuts, gapGrid);
      const minX = Math.min(panel.x, ...points.map(p => p.x));
      const maxX = Math.max(panel.x + panel.w, ...points.map(p => p.x));
      const minY = Math.min(panel.y, ...points.map(p => p.y));
      const maxY = Math.max(panel.y + panel.h, ...points.map(p => p.y));

      // The panel that GAINS area needs its box enlarged to the polygon's
      // bounding box before clip-path has anything to shape there. The panel
      // that LOSES area (shrinks inward) doesn't - its bounding box never
      // exceeds its own rect - but it still needs the clip-path applied, just
      // relative to its normal, unenlarged box.
      const needsExpansion = minX < panel.x || maxX > panel.x + panel.w || minY < panel.y || maxY > panel.y + panel.h;

      const rect = content.getBoundingClientRect();
      const pxPerUnitX = panel.w > 0 ? rect.width / panel.w : 0;
      const pxPerUnitY = panel.h > 0 ? rect.height / panel.h : 0;

      let originX = panel.x, originY = panel.y;

      if (needsExpansion) {
        content.style.position = 'absolute';
        content.style.left = `${-(panel.x - minX) * pxPerUnitX}px`;
        content.style.top = `${-(panel.y - minY) * pxPerUnitY}px`;
        content.style.width = `${(maxX - minX) * pxPerUnitX}px`;
        content.style.height = `${(maxY - minY) * pxPerUnitY}px`;
        originX = minX; originY = minY;
      }

      // clip-path's path() takes absolute pixel coordinates (unlike
      // polygon(), it has no percentage form), so points are converted into
      // the box's own local pixel space rather than left as fractions - that
      // in turn is what lets roundedPolygonPath round every vertex by an
      // actual pixel radius instead of a shape-distorting percentage one.
      const localPoints = points.map(p => ({
        x: (p.x - originX) * pxPerUnitX,
        y: (p.y - originY) * pxPerUnitY,
      }));
      const d = roundedPolygonPath(localPoints, cornerRadius * scale);
      content.style.clipPath = `path('${d}')`;
    });
  }, [cuts, panelItems, gapGrid, cornerRadius, scale]);

  // Disable normal drag/resize entirely while editing vertices, so grabbing a
  // corner handle can never also start dragging the whole panel underneath it.
  useEffect(() => {
    if (gridInstance.current && isReady) {
      gridInstance.current.setStatic(editVertices);
    }
  }, [editVertices, isReady]);

  const gridToDisplayPixel = useCallback(
    (gx: number, gy: number) => ({
      x: paddingPx + (gx / virtualGrid) * innerW,
      y: paddingPx + (gy / virtualGrid) * innerH,
    }),
    [paddingPx, innerW, innerH, virtualGrid]
  );

  // Drag a shared-edge endpoint: computes the delta in grid units from the
  // starting mouse position (not the live pointer position each frame), so it
  // stays correct even as re-renders happen mid-drag.
  const handleVertexMouseDown = useCallback(
    (e: React.MouseEvent, adjacency: Adjacency, endpoint: 'start' | 'end', startOffset: number) => {
      e.stopPropagation();
      e.preventDefault();
      const startClientX = e.clientX;
      const startClientY = e.clientY;
      const axis = adjacency.edge === 'vertical' ? 'x' : 'y';
      const max = maxCutOffset(adjacency);
      const panelAId = adjacency.first.id;
      const panelBId = adjacency.second.id;

      const onMove = (ev: MouseEvent) => {
        const { innerW: iw, innerH: ih, onUpdateCutEndpoint: update } = propRefs.current;
        const deltaPx = axis === 'x' ? ev.clientX - startClientX : ev.clientY - startClientY;
        const span = axis === 'x' ? iw : ih;
        const deltaGrid = span > 0 ? (deltaPx / span) * virtualGrid : 0;
        const next = Math.max(-max, Math.min(max, Math.round(startOffset + deltaGrid)));
        update(panelAId, panelBId, endpoint, next);
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [virtualGrid]
  );

  const vertexHandles = editVertices
    ? findAllAdjacencies(panelItems).flatMap((adjacency) => {
        const cut = cuts.find(
          c => (c.panelAId === adjacency.first.id && c.panelBId === adjacency.second.id) ||
               (c.panelAId === adjacency.second.id && c.panelBId === adjacency.first.id)
        );
        const offsetStart = cut?.offsetStart ?? 0;
        const offsetEnd = cut?.offsetEnd ?? 0;
        const { p1, p2 } = cutEndpoints(adjacency, offsetStart, offsetEnd);
        const startPx = gridToDisplayPixel(p1.x, p1.y);
        const endPx = gridToDisplayPixel(p2.x, p2.y);
        const key = `${adjacency.first.id}-${adjacency.second.id}`;
        return [
          { key: `${key}-start`, x: startPx.x, y: startPx.y, adjacency, endpoint: 'start' as const, offset: offsetStart },
          { key: `${key}-end`, x: endPx.x, y: endPx.y, adjacency, endpoint: 'end' as const, offset: offsetEnd },
        ];
      })
    : [];

  // Full outline (straight edges + diagonal cut edges alike) for every panel
  // that has an active cut, drawn as one continuous stroked polygon since a
  // plain CSS border can't follow a clip-path's diagonal edge (see the stroke
  // width effect above).
  const cutOutlines = (() => {
    const relevantIds = new Set(cuts.flatMap(c => [c.panelAId, c.panelBId]));
    if (relevantIds.size === 0) return [];
    return panelItems
      .filter(p => relevantIds.has(p.id))
      .map(panel => {
        const points = panelPolygon(panel, panelItems, cuts, gapGrid).map(p => gridToDisplayPixel(p.x, p.y));
        return { id: panel.id, d: roundedPolygonPath(points, cornerRadius * scale) };
      });
  })();

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
        {cutOutlines.length > 0 && (
          <svg
            className="absolute inset-0 w-full h-full"
            style={{ pointerEvents: 'none', zIndex: 55 }}
            viewBox={`0 0 ${dimensions.w} ${dimensions.h}`}
          >
            {cutOutlines.map(outline => (
              <path
                key={outline.id}
                d={outline.d}
                fill="none"
                stroke="#1a1a1a"
                strokeWidth={Math.max(1, strokeWidth * scale)}
                strokeLinejoin="round"
              />
            ))}
          </svg>
        )}
        {vertexHandles.map((handle) => (
          <div
            key={handle.key}
            onMouseDown={(e) => handleVertexMouseDown(e, handle.adjacency, handle.endpoint, handle.offset)}
            title="Arrastra para cortar en diagonal"
            className="vertex-handle"
            style={{ left: handle.x, top: handle.y }}
          />
        ))}
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

        .vertex-handle {
          position: absolute;
          width: 14px;
          height: 14px;
          margin-left: -7px;
          margin-top: -7px;
          border-radius: 9999px;
          background: #f97316;
          border: 2px solid white;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
          cursor: move;
          z-index: 60;
        }

        .vertex-handle:hover {
          background: #ea580c;
          transform: scale(1.2);
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
