"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// === Módulo Calificaciones: estado de planilla tipo Excel ===
// Selección activa + rango, navegación (flechas/Tab/Enter), Ctrl+C/Ctrl+V
// y autocompletar arrastrando el handle. Los valores viven en el padre
// (fuente única `${studentId}::${activityId}` → string).

export interface CellPos {
  row: number; // índice de estudiante
  col: number; // índice de actividad (sub-columna N*)
}

export interface GridApi {
  active: CellPos | null;
  range: { from: CellPos; to: CellPos } | null;
  setActive: (pos: CellPos | null) => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  beginDrag: (pos: CellPos) => void;
  overDrag: (pos: CellPos) => void;
  endDrag: () => void;
  isDragging: boolean;
}

export function useGradesGrid(opts: {
  rowCount: number;
  colCount: number;
  getCellValue: (pos: CellPos) => string;
  setCellValue: (pos: CellPos, value: string) => void;
}): GridApi {
  const { rowCount, colCount, getCellValue, setCellValue } = opts;
  const [active, setActiveState] = useState<CellPos | null>(null);
  const [range, setRange] = useState<{ from: CellPos; to: CellPos } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const clipboardRef = useRef<string>("");

  const clamp = useCallback(
    (pos: CellPos): CellPos => ({
      row: Math.max(0, Math.min(rowCount - 1, pos.row)),
      col: Math.max(0, Math.min(colCount - 1, pos.col)),
    }),
    [rowCount, colCount]
  );

  const setActive = useCallback(
    (pos: CellPos | null) => {
      setRange(null);
      setActiveState(pos ? clamp(pos) : null);
    },
    [clamp]
  );

  const move = useCallback(
    (dr: number, dc: number, extend = false) => {
      setActiveState((prev) => {
        if (!prev) return prev;
        const next = clamp({ row: prev.row + dr, col: prev.col + dc });
        if (extend) {
          setRange((r) => ({ from: r?.from ?? prev, to: next }));
        } else {
          setRange(null);
        }
        return next;
      });
    },
    [clamp]
  );

  const cellsInRange = useCallback(
    (r: { from: CellPos; to: CellPos }): CellPos[] => {
      const out: CellPos[] = [];
      const r1 = Math.min(r.from.row, r.to.row);
      const r2 = Math.max(r.from.row, r.to.row);
      const c1 = Math.min(r.from.col, r.to.col);
      const c2 = Math.max(r.from.col, r.to.col);
      for (let i = r1; i <= r2; i++)
        for (let j = c1; j <= c2; j++) out.push({ row: i, col: j });
      return out;
    },
    []
  );

  const copySelection = useCallback(() => {
    if (!active) return;
    clipboardRef.current = getCellValue(active);
  }, [active, getCellValue]);

  const pasteSelection = useCallback(() => {
    if (!active || clipboardRef.current === "") return;
    if (range) {
      for (const pos of cellsInRange(range)) setCellValue(pos, clipboardRef.current);
    } else {
      setCellValue(active, clipboardRef.current);
    }
  }, [active, range, cellsInRange, setCellValue]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!active) return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key.toLowerCase() === "c") {
        e.preventDefault();
        copySelection();
        return;
      }
      if (ctrl && e.key.toLowerCase() === "v") {
        e.preventDefault();
        pasteSelection();
        return;
      }
      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          move(-1, 0, e.shiftKey);
          break;
        case "ArrowDown":
        case "Enter":
          e.preventDefault();
          move(1, 0, e.shiftKey);
          break;
        case "ArrowLeft":
          e.preventDefault();
          move(0, -1, e.shiftKey);
          break;
        case "ArrowRight":
        case "Tab":
          e.preventDefault();
          move(0, 1, e.shiftKey);
          break;
      }
    },
    [active, copySelection, pasteSelection, move]
  );

  // Drag del handle: copia el valor de la celda origen a las celdas destino
  const beginDrag = useCallback((pos: CellPos) => {
    setIsDragging(true);
    setActiveState(clamp(pos));
  }, [clamp]);

  const overDrag = useCallback((pos: CellPos) => {
    // placeholder para feedback visual futuro
  }, []);

  const endDrag = useCallback(
    (pos: CellPos | null) => {
      setIsDragging(false);
      if (!pos || !active) return;
      const value = getCellValue(active);
      const target = clamp(pos);
      // autocompletar hacia abajo o derecha desde la celda activa
      const r1 = Math.min(active.row, target.row);
      const r2 = Math.max(active.row, target.row);
      const c1 = Math.min(active.col, target.col);
      const c2 = Math.max(active.col, target.col);
      for (let i = r1; i <= r2; i++)
        for (let j = c1; j <= c2; j++) setCellValue({ row: i, col: j }, value);
    },
    [active, clamp, getCellValue, setCellValue]
  );

  return {
    active,
    range,
    setActive,
    handleKeyDown,
    beginDrag,
    overDrag,
    endDrag,
    isDragging,
  };
}
