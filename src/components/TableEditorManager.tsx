import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';

interface TableEditorManagerProps {
  editorRef: React.RefObject<HTMLDivElement | null>;
  onContentChange: () => void;
}

export type SelectedLine =
  | {
      type: 'col';
      table: HTMLTableElement;
      colIndex: number; // -1 for leftmost table border, 0..N for right border of colIndex
      x: number; // exact pixel relative to containerRef
      top: number;
      height: number;
    }
  | {
      type: 'row';
      table: HTMLTableElement;
      rowIndex: number; // -1 for topmost table border, 0..N for bottom border of rowIndex
      y: number; // exact pixel relative to containerRef
      left: number;
      width: number;
    };

interface TableLineMatch {
  table: HTMLTableElement;
  type: 'col' | 'row';
  colIndex?: number;
  rowIndex?: number;
  linePos: number; // absolute client X or Y
  targetCell?: HTMLTableCellElement;
  targetRow?: HTMLTableRowElement;
  distance: number;
}

export const TableEditorManager: React.FC<TableEditorManagerProps> = ({
  editorRef,
  onContentChange,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Persistent selected line when user clicks on any table border
  const [selectedLine, setSelectedLine] = useState<SelectedLine | null>(null);

  // Active resize state
  const [isResizing, setIsResizing] = useState<{
    type: 'col' | 'row';
    x?: number;
    y?: number;
    tableTop?: number;
    tableLeft?: number;
    tableHeight?: number;
    tableWidth?: number;
  } | null>(null);

  // Resize drag ref
  const isResizingRef = useRef<{
    type: 'col' | 'row';
    table: HTMLTableElement;
    targetRow: HTMLTableRowElement | null;
    targetCell: HTMLTableCellElement | null;
    colIndex: number;
    rowIndex: number;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    hasMoved: boolean;
  } | null>(null);

  // Normalize styling so table has clean, uniform 1px solid borders
  const normalizeTableStyles = useCallback((table: HTMLTableElement) => {
    if (!table) return;
    table.style.borderCollapse = 'collapse';
    if (!table.style.border) {
      table.style.border = '1px solid #1c1917';
    }
    const rows = Array.from(table.rows);
    rows.forEach((row) => {
      if (!row) return;
      Array.from(row.cells).forEach((cell) => {
        if (!cell) return;
        if (!cell.style.border) {
          cell.style.border = '1px solid #1c1917';
        }
        if (!cell.style.padding) {
          cell.style.padding = '6px 10px';
        }
        if (!cell.style.minWidth) {
          cell.style.minWidth = '36px';
        }
      });
    });
  }, []);

  // Precise deterministic table grid line detector
  const findClosestTableLine = useCallback(
    (clientX: number, clientY: number, tolerance: number): TableLineMatch | null => {
      const editor = editorRef.current;
      if (!editor) return null;

      const tables = Array.from(editor.querySelectorAll('table')) as HTMLTableElement[];
      if (tables.length === 0) return null;

      let bestMatch: TableLineMatch | null = null;
      let minDistance = tolerance;

      for (const table of tables) {
        if (!editor.contains(table)) continue;
        normalizeTableStyles(table);
        const tRect = table.getBoundingClientRect();

        // Check if cursor is within bounding area of table + margin
        if (
          clientX < tRect.left - tolerance - 5 ||
          clientX > tRect.right + tolerance + 5 ||
          clientY < tRect.top - tolerance - 5 ||
          clientY > tRect.bottom + tolerance + 5
        ) {
          continue;
        }

        const firstRow = table.rows[0];
        if (!firstRow) continue;

        // 1. Check all vertical column lines
        // Leftmost edge (colIndex: -1)
        if (clientY >= tRect.top - 4 && clientY <= tRect.bottom + 4) {
          const distLeft = Math.abs(clientX - tRect.left);
          if (distLeft <= minDistance) {
            minDistance = distLeft;
            bestMatch = {
              table,
              type: 'col',
              colIndex: -1,
              linePos: tRect.left,
              targetCell: firstRow.cells[0],
              distance: distLeft,
            };
          }

          // Right borders of each column
          for (let c = 0; c < firstRow.cells.length; c++) {
            const cell = firstRow.cells[c];
            const cRect = cell.getBoundingClientRect();
            const distCol = Math.abs(clientX - cRect.right);
            if (distCol <= minDistance) {
              minDistance = distCol;
              bestMatch = {
                table,
                type: 'col',
                colIndex: c,
                linePos: cRect.right,
                targetCell: cell,
                distance: distCol,
              };
            }
          }
        }

        // 2. Check all horizontal row lines
        // Topmost edge (rowIndex: -1)
        if (clientX >= tRect.left - 4 && clientX <= tRect.right + 4) {
          const distTop = Math.abs(clientY - tRect.top);
          if (distTop <= minDistance) {
            minDistance = distTop;
            bestMatch = {
              table,
              type: 'row',
              rowIndex: -1,
              linePos: tRect.top,
              targetRow: table.rows[0],
              distance: distTop,
            };
          }

          // Bottom borders of each row
          for (let r = 0; r < table.rows.length; r++) {
            const row = table.rows[r];
            const rRect = row.getBoundingClientRect();
            const distRow = Math.abs(clientY - rRect.bottom);
            if (distRow <= minDistance) {
              minDistance = distRow;
              bestMatch = {
                table,
                type: 'row',
                rowIndex: r,
                linePos: rRect.bottom,
                targetRow: row,
                distance: distRow,
              };
            }
          }
        }
      }

      return bestMatch;
    },
    [editorRef, normalizeTableStyles]
  );

  // Helper to re-calculate selected line coordinates with 100% pixel precision relative to container
  const refreshSelectedLineCoords = useCallback(
    (line: SelectedLine | null): SelectedLine | null => {
      if (!line || !containerRef.current || !document.contains(line.table)) {
        return null;
      }
      const containerRect = containerRef.current.getBoundingClientRect();
      const tRect = line.table.getBoundingClientRect();

      if (line.type === 'col') {
        let x = tRect.left - containerRect.left;
        if (line.colIndex >= 0) {
          const firstRow = line.table.rows[0];
          const cell = firstRow?.cells[line.colIndex];
          if (cell) {
            const cRect = cell.getBoundingClientRect();
            x = cRect.right - containerRect.left;
          } else {
            x = tRect.right - containerRect.left;
          }
        }
        return {
          ...line,
          x,
          top: tRect.top - containerRect.top,
          height: tRect.height,
        };
      } else {
        let y = tRect.top - containerRect.top;
        if (line.rowIndex >= 0) {
          const row = line.table.rows[line.rowIndex];
          if (row) {
            const rRect = row.getBoundingClientRect();
            y = rRect.bottom - containerRect.top;
          } else {
            y = tRect.bottom - containerRect.top;
          }
        }
        return {
          ...line,
          y,
          left: tRect.left - containerRect.left,
          width: tRect.width,
        };
      }
    },
    []
  );

  // Keep selected line pinned during scrolling or window resize
  useEffect(() => {
    const handleScrollOrResize = () => {
      setSelectedLine((prev) => (prev ? refreshSelectedLineCoords(prev) : null));
    };

    window.addEventListener('scroll', handleScrollOrResize, { passive: true, capture: true });
    window.addEventListener('resize', handleScrollOrResize, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, { capture: true });
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [refreshSelectedLineCoords]);

  // Insert Row Function
  const handleInsertRow = (table: HTMLTableElement, atIndex: number) => {
    if (!table) return;
    normalizeTableStyles(table);
    const rowCount = table.rows.length;
    let targetIndex = atIndex === -1 ? 0 : atIndex + 1;
    if (targetIndex < 0) targetIndex = 0;
    if (targetIndex > rowCount) targetIndex = rowCount;

    let maxCols = 0;
    Array.from(table.rows).forEach((r) => {
      if (!r) return;
      let count = 0;
      Array.from(r.cells).forEach((c) => {
        if (c) count += c.colSpan || 1;
      });
      if (count > maxCols) maxCols = count;
    });
    if (maxCols === 0) maxCols = 3;

    const newRow = table.insertRow(targetIndex);
    for (let i = 0; i < maxCols; i++) {
      const newCell = newRow.insertCell(i);
      newCell.innerHTML = '&nbsp;';
      newCell.style.border = '1px solid #1c1917';
      newCell.style.padding = '6px 10px';
      newCell.style.minWidth = '36px';
      newCell.style.verticalAlign = 'top';

      const firstRow = table.rows[0];
      if (firstRow && firstRow.cells[i] && firstRow.cells[i].style?.width) {
        newCell.style.width = firstRow.cells[i].style.width;
      }
    }
    // Update selected line position to match the newly inserted boundary
    setTimeout(() => {
      setSelectedLine((prev) => (prev ? refreshSelectedLineCoords({ ...prev, rowIndex: targetIndex }) : null));
    }, 10);
    onContentChange();
  };

  // Insert Column Function
  const handleInsertColumn = (table: HTMLTableElement, atColIndex: number) => {
    if (!table) return;
    normalizeTableStyles(table);
    const rows = Array.from(table.rows);
    if (rows.length === 0) return;

    rows.forEach((row) => {
      if (!row) return;
      const colCount = row.cells.length;
      let targetCol = atColIndex === -1 ? 0 : atColIndex + 1;
      if (targetCol < 0) targetCol = 0;
      if (targetCol > colCount) targetCol = colCount;

      const isHeader = row.cells[0]?.tagName.toLowerCase() === 'th';
      const newCell = document.createElement(isHeader ? 'th' : 'td') as HTMLTableCellElement;
      newCell.innerHTML = '&nbsp;';
      newCell.style.border = '1px solid #1c1917';
      newCell.style.padding = '6px 10px';
      newCell.style.minWidth = '40px';
      newCell.style.width = '90px';
      newCell.style.verticalAlign = 'top';
      if (isHeader) {
        newCell.style.fontWeight = 'bold';
        newCell.style.backgroundColor = '#f9fafb';
      }

      if (targetCol >= colCount) {
        row.appendChild(newCell);
      } else {
        row.insertBefore(newCell, row.cells[targetCol]);
      }
    });
    table.style.width = 'max-content';
    table.style.maxWidth = '100%';

    // Update selected line position
    setTimeout(() => {
      setSelectedLine((prev) =>
        prev ? refreshSelectedLineCoords({ ...prev, colIndex: atColIndex === -1 ? 0 : atColIndex + 1 }) : null
      );
    }, 10);
    onContentChange();
  };

  // Delete Row Function
  const handleDeleteRow = (table: HTMLTableElement, rowIndex: number) => {
    if (!table || table.rows.length === 0) return;
    const targetIdx = rowIndex === -1 ? 0 : rowIndex;
    if (table.rows.length <= 1) {
      table.remove();
      setSelectedLine(null);
    } else {
      table.deleteRow(Math.min(targetIdx, table.rows.length - 1));
      setSelectedLine(null);
    }
    onContentChange();
  };

  // Delete Column Function
  const handleDeleteColumn = (table: HTMLTableElement, colIndex: number) => {
    if (!table || table.rows.length === 0) return;
    const rows = Array.from(table.rows);
    const targetCol = colIndex === -1 ? 0 : colIndex;
    if (rows[0] && rows[0].cells.length <= 1) {
      table.remove();
      setSelectedLine(null);
    } else {
      rows.forEach((row) => {
        if (row && row.cells && row.cells[targetCol]) {
          row.deleteCell(targetCol);
        }
      });
      setSelectedLine(null);
    }
    onContentChange();
  };

  // Listeners for mouse move, resize dragging, and exact border line clicking
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const handleMouseMove = (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;

      // 1. If actively dragging to resize
      if (isResizingRef.current) {
        const resize = isResizingRef.current;
        const deltaMove = Math.abs(e.clientX - resize.startX) + Math.abs(e.clientY - resize.startY);
        if (deltaMove > 3) {
          resize.hasMoved = true;
        }

        const containerRect = container.getBoundingClientRect();
        const tRect = resize.table.getBoundingClientRect();

        if (resize.type === 'col') {
          const deltaX = e.clientX - resize.startX;
          const targetColIndex = resize.colIndex === -1 ? 0 : resize.colIndex;
          const newWidth = Math.max(30, resize.startWidth + (resize.colIndex === -1 ? -deltaX : deltaX));

          const rows = Array.from(resize.table.rows) as HTMLTableRowElement[];
          rows.forEach((r: HTMLTableRowElement) => {
            const cell = r.cells[targetColIndex] as HTMLTableCellElement | undefined;
            if (cell) {
              cell.style.width = `${newWidth}px`;
              cell.style.minWidth = `${newWidth}px`;
            }
          });
          resize.table.style.width = 'max-content';
          resize.table.style.maxWidth = '100%';

          setIsResizing({
            type: 'col',
            x: e.clientX - containerRect.left,
            tableTop: tRect.top - containerRect.top,
            tableHeight: tRect.height,
          });
        } else if (resize.type === 'row') {
          const deltaY = e.clientY - resize.startY;
          const targetRowIndex = resize.rowIndex === -1 ? 0 : resize.rowIndex;
          const targetRow = resize.table.rows[targetRowIndex];
          if (targetRow) {
            const newHeight = Math.max(22, resize.startHeight + (resize.rowIndex === -1 ? -deltaY : deltaY));
            targetRow.style.height = `${newHeight}px`;
            (Array.from(targetRow.cells) as HTMLTableCellElement[]).forEach((c: HTMLTableCellElement) => {
              if (c) c.style.height = `${newHeight}px`;
            });
          }

          setIsResizing({
            type: 'row',
            y: e.clientY - containerRect.top,
            tableLeft: tRect.left - containerRect.left,
            tableWidth: tRect.width,
          });
        }
        onContentChange();
        return;
      }

      // 2. Cursor hover detection via exact grid line match (precise 4px border tolerance)
      const lineMatch = findClosestTableLine(e.clientX, e.clientY, 4);
      if (lineMatch) {
        document.body.style.cursor = lineMatch.type === 'col' ? 'col-resize' : 'row-resize';
      } else {
        document.body.style.cursor = '';
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;

      const target = e.target as HTMLElement | null;
      if (!target) return;

      // If clicked on the UI buttons (+ or trash), do not start dragging or dismiss
      if (target.closest('.table-editor-ui-control')) {
        return;
      }

      // Check if mouse down is on a table line with precise 4px tolerance
      const lineMatch = findClosestTableLine(e.clientX, e.clientY, 4);

      if (lineMatch) {
        const targetColIdx = lineMatch.colIndex ?? -1;
        const targetRowIdx = lineMatch.rowIndex ?? -1;

        let startWidth = 60;
        if (lineMatch.type === 'col') {
          const colToMeasure = targetColIdx === -1 ? 0 : targetColIdx;
          const cell = lineMatch.table.rows[0]?.cells[colToMeasure];
          if (cell) startWidth = cell.offsetWidth;
        }

        let startHeight = 28;
        if (lineMatch.type === 'row') {
          const rowToMeasure = targetRowIdx === -1 ? 0 : targetRowIdx;
          const row = lineMatch.table.rows[rowToMeasure];
          if (row) startHeight = row.offsetHeight;
        }

        isResizingRef.current = {
          type: lineMatch.type,
          table: lineMatch.table,
          targetRow: lineMatch.targetRow || null,
          targetCell: lineMatch.targetCell || null,
          colIndex: targetColIdx,
          rowIndex: targetRowIdx,
          startX: e.clientX,
          startY: e.clientY,
          startWidth,
          startHeight,
          hasMoved: false,
        };
      } else {
        // Clicked outside any line or inside cell body -> deselect line overlay
        setSelectedLine(null);
      }
    };

    const handleMouseUp = () => {
      const container = containerRef.current;
      if (isResizingRef.current && container) {
        const resize = isResizingRef.current;
        const containerRect = container.getBoundingClientRect();
        const tRect = resize.table.getBoundingClientRect();

        // If mouse didn't drag, this is a CLICK ON THE EXACT LINE!
        if (!resize.hasMoved) {
          if (resize.type === 'col') {
            let lineX = tRect.left - containerRect.left;
            if (resize.colIndex >= 0) {
              const firstRow = resize.table.rows[0];
              const cell = firstRow?.cells[resize.colIndex] || resize.targetCell;
              if (cell) {
                const cellRect = cell.getBoundingClientRect();
                lineX = cellRect.right - containerRect.left;
              } else {
                lineX = tRect.right - containerRect.left;
              }
            }
            setSelectedLine({
              type: 'col',
              table: resize.table,
              colIndex: resize.colIndex,
              x: lineX,
              top: tRect.top - containerRect.top,
              height: tRect.height,
            });
          } else if (resize.type === 'row') {
            let lineY = tRect.top - containerRect.top;
            if (resize.rowIndex >= 0) {
              const row = resize.table.rows[resize.rowIndex] || resize.targetRow;
              if (row) {
                const rowRect = row.getBoundingClientRect();
                lineY = rowRect.bottom - containerRect.top;
              } else {
                lineY = tRect.bottom - containerRect.top;
              }
            }
            setSelectedLine({
              type: 'row',
              table: resize.table,
              rowIndex: resize.rowIndex,
              y: lineY,
              left: tRect.left - containerRect.left,
              width: tRect.width,
            });
          }
        } else {
          // If resized, recalculate line coords
          setSelectedLine((prev) => refreshSelectedLineCoords(prev));
        }

        isResizingRef.current = null;
        setIsResizing(null);
        document.body.style.cursor = '';
        onContentChange();
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    editor.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      editor.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
    };
  }, [editorRef, findClosestTableLine, refreshSelectedLineCoords, onContentChange]);

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0 z-10">
      {/* Active resize guideline during column drag */}
      {isResizing && isResizing.type === 'col' && isResizing.x !== undefined && (
        <div
          style={{
            left: `${isResizing.x}px`,
            top: `${isResizing.tableTop || 0}px`,
            height: `${isResizing.tableHeight || 0}px`,
          }}
          className="absolute w-[1.5px] bg-black pointer-events-none z-30 opacity-90"
        />
      )}

      {/* Active resize guideline during row drag */}
      {isResizing && isResizing.type === 'row' && isResizing.y !== undefined && (
        <div
          style={{
            top: `${isResizing.y}px`,
            left: `${isResizing.tableLeft || 0}px`,
            width: `${isResizing.tableWidth || 0}px`,
          }}
          className="absolute h-[1.5px] bg-black pointer-events-none z-30 opacity-90"
        />
      )}

      {/* PERSISTENT SELECTED COLUMN LINE: Clean 1.5px Solid Black line & Minimal Black Button */}
      {selectedLine && selectedLine.type === 'col' && (
        <div className="table-editor-ui-control">
          {/* Subtle 1.5px clean black line spanning entire table height */}
          <div
            style={{
              left: `${selectedLine.x - 0.75}px`,
              top: `${selectedLine.top}px`,
              height: `${selectedLine.height}px`,
            }}
            className="absolute w-[1.5px] bg-black pointer-events-none z-20"
          />

          {/* Plus Button anchored at the TOP of the column line */}
          <div
            style={{
              top: `${selectedLine.top - 24}px`,
              left: `${selectedLine.x - 10}px`,
            }}
            className="pointer-events-auto absolute z-30 flex items-center gap-1"
          >
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleInsertColumn(selectedLine.table, selectedLine.colIndex);
              }}
              className="w-5 h-5 rounded-full bg-neutral-900 hover:bg-black active:scale-95 text-white flex items-center justify-center shadow transition-all duration-150 ring-1 ring-white cursor-pointer"
              title="Вставити стовпчик"
              aria-label="Вставити стовпчик"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={1.75} />
            </button>

            {/* Quick delete for this column if table has multiple columns */}
            {selectedLine.colIndex >= 0 && selectedLine.table.rows[0]?.cells.length > 1 && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDeleteColumn(selectedLine.table, selectedLine.colIndex);
                }}
                className="w-5 h-5 rounded-full bg-white hover:bg-red-50 text-neutral-500 hover:text-red-600 border border-neutral-300 flex items-center justify-center shadow-sm transition-all duration-150 cursor-pointer"
                title="Видалити цей стовпчик"
                aria-label="Видалити стовпчик"
              >
                <Trash2 className="w-3 h-3" strokeWidth={1.75} />
              </button>
            )}
          </div>

          {/* Plus Button also anchored at the BOTTOM of the column line */}
          <div
            style={{
              top: `${selectedLine.top + selectedLine.height + 4}px`,
              left: `${selectedLine.x - 10}px`,
            }}
            className="pointer-events-auto absolute z-30"
          >
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleInsertColumn(selectedLine.table, selectedLine.colIndex);
              }}
              className="w-5 h-5 rounded-full bg-neutral-900 hover:bg-black active:scale-95 text-white flex items-center justify-center shadow transition-all duration-150 ring-1 ring-white cursor-pointer"
              title="Вставити стовпчик"
              aria-label="Вставити стовпчик"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      )}

      {/* PERSISTENT SELECTED ROW LINE: Clean 1.5px Solid Black line & Minimal Black Button */}
      {selectedLine && selectedLine.type === 'row' && (
        <div className="table-editor-ui-control">
          {/* Subtle 1.5px clean black line spanning entire table width */}
          <div
            style={{
              top: `${selectedLine.y - 0.75}px`,
              left: `${selectedLine.left}px`,
              width: `${selectedLine.width}px`,
            }}
            className="absolute h-[1.5px] bg-black pointer-events-none z-20"
          />

          {/* Plus Button anchored at the LEFT of the row line */}
          <div
            style={{
              top: `${selectedLine.y - 10}px`,
              left: `${selectedLine.left - 24}px`,
            }}
            className="pointer-events-auto absolute z-30 flex items-center gap-1"
          >
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleInsertRow(selectedLine.table, selectedLine.rowIndex);
              }}
              className="w-5 h-5 rounded-full bg-neutral-900 hover:bg-black active:scale-95 text-white flex items-center justify-center shadow transition-all duration-150 ring-1 ring-white cursor-pointer"
              title="Вставити рядок"
              aria-label="Вставити рядок"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={1.75} />
            </button>

            {/* Quick delete for this row if table has multiple rows */}
            {selectedLine.rowIndex >= 0 && selectedLine.table.rows.length > 1 && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDeleteRow(selectedLine.table, selectedLine.rowIndex);
                }}
                className="w-5 h-5 rounded-full bg-white hover:bg-red-50 text-neutral-500 hover:text-red-600 border border-neutral-300 flex items-center justify-center shadow-sm transition-all duration-150 cursor-pointer"
                title="Видалити цей рядок"
                aria-label="Видалити рядок"
              >
                <Trash2 className="w-3 h-3" strokeWidth={1.75} />
              </button>
            )}
          </div>

          {/* Plus Button also anchored at the RIGHT of the row line */}
          <div
            style={{
              top: `${selectedLine.y - 10}px`,
              left: `${selectedLine.left + selectedLine.width + 4}px`,
            }}
            className="pointer-events-auto absolute z-30"
          >
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleInsertRow(selectedLine.table, selectedLine.rowIndex);
              }}
              className="w-5 h-5 rounded-full bg-neutral-900 hover:bg-black active:scale-95 text-white flex items-center justify-center shadow transition-all duration-150 ring-1 ring-white cursor-pointer"
              title="Вставити рядок"
              aria-label="Вставити рядок"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
