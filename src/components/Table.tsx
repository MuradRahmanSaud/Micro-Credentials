import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Search, Pencil, Trash2, RefreshCw, Plus, Filter, CheckCircle2, AlertCircle, Download, Type, RotateCcw, User } from "lucide-react";
import { cn, formatToMmmDdYyyy, isBatchRunning } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import ConfirmModal from "./ConfirmModal";

interface TableProps {
  data: any[];
  headers: string[];
  formHeaders?: string[];
  isLoading: boolean;
  onSave: (formData: any, editingRow: any | null) => Promise<void>;
  onDelete: (row: any) => Promise<void>;
  onRefresh?: () => void;
  onRowClick?: (row: any) => void;
  rowSpans?: Record<number, Record<string, number>>;
  mergeGroups?: {
    groupBy: string[];
    mergeColumns: string[];
  };
  columnStyles?: Record<string, string>;
  FormPanel: React.ComponentType<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (formData: any) => Promise<void>;
    onDelete: (row: any) => Promise<void>;
    initialData: any | null;
    defaultData?: any | null;
    headers: string[];
    onDirtyChange: (isDirty: boolean) => void;
    allData: any[];
    employees?: any[];
  }>;
  employees?: any[];
  entityName?: string;
  initialFilter?: Record<string, string>;
  defaultNewValues?: Record<string, any>;
  title?: React.ReactNode;
  onAddClick?: () => void;
  renderActions?: (row: any) => React.ReactNode;
  children?: React.ReactNode;
  extraFormProps?: any;
  hideAddButton?: boolean;
  customHeaderButton?: React.ReactNode;
  renderCell?: (header: string, val: any, row: any) => React.ReactNode;
  isActiveRow?: (row: any) => boolean;
}

export default function Table({ 
  data, 
  headers, 
  formHeaders,
  isLoading, 
  onSave, 
  onDelete, 
  onRefresh,
  onRowClick,
  rowSpans: externalRowSpans,
  mergeGroups,
  columnStyles,
  FormPanel,
  employees,
  entityName = "Entry",
  initialFilter,
  defaultNewValues,
  title,
  onAddClick,
  renderActions,
  children,
  extraFormProps,
  hideAddButton = false,
  customHeaderButton,
  renderCell,
  isActiveRow
}: TableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(19);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  
  // Set initial filters if provided
  useEffect(() => {
    if (initialFilter) {
      setActiveFilters(prev => ({ ...prev, ...initialFilter }));
    }
  }, [initialFilter]);
  
  const [isDownloadOpen, setIsDownloadOpen] = useState(false);
  const [selectedDownloadColumns, setSelectedDownloadColumns] = useState<string[]>(headers);
  
  // Update selected columns when headers change
  useEffect(() => {
    setSelectedDownloadColumns(headers);
  }, [headers]);

  // Modal & Notification State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<any>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [rowToDelete, setRowToDelete] = useState<any>(null);
  const [fontSize, setFontSize] = useState<number>(13);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isFormDirty, setIsFormDirty] = useState(false);
  const [isDirtyModalOpen, setIsDirtyModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Column freezing state
  const [frozenColumnIndex, setFrozenColumnIndex] = useState<number>(-1);

  // Group hover state
  const [hoveredGroupKey, setHoveredGroupKey] = useState<string | null>(null);

  const photoKey = useMemo(() => {
    return headers.find(h => h.toLowerCase().includes("photo"));
  }, [headers]);

  const minFrozenIndex = useMemo(() => {
    if (renderActions) {
      return photoKey ? 1 : 0;
    }
    return -1;
  }, [renderActions, photoKey]);

  const effectiveFrozenIndex = Math.max(frozenColumnIndex, minFrozenIndex);

  // Initialize frozen column if Photo exists
  useEffect(() => {
    if (photoKey && frozenColumnIndex === -1) {
      setFrozenColumnIndex(0);
    }
  }, [photoKey]);

  const [columnWidths, setColumnWidths] = useState<number[]>([]);
  const tableRef = useRef<HTMLTableElement>(null);

  const updateColumnWidths = useCallback(() => {
    if (tableRef.current) {
      const ths = tableRef.current.querySelectorAll('thead th');
      const widths: number[] = [];
      ths.forEach(th => widths.push((th as HTMLElement).offsetWidth));
      setColumnWidths(prev => {
        if (prev.length === widths.length && prev.every((w, i) => Math.abs(w - widths[i]) < 1)) {
          return prev;
        }
        return widths;
      });
    }
  }, []);

  const filterRef = useRef<HTMLDivElement>(null);
  const downloadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
      if (downloadRef.current && !downloadRef.current.contains(event.target as Node)) {
        setIsDownloadOpen(false);
      }
    };

    if (isFilterOpen || isDownloadOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFilterOpen, isDownloadOpen]);

  const handleDownloadExcel = async () => {
    if (selectedDownloadColumns.length === 0) {
      showNotification("error", "Please select at least one column to download.");
      return;
    }

    const XLSX = await import('xlsx');

    const dataToExport = filteredData.map(row => {
      const exportedRow: any = {};
      selectedDownloadColumns.forEach(col => {
        let val = row[col];
        // Force ID and Mobile columns to be strings to prevent Excel from removing leading zeros or using scientific notation
        const lowerCol = col.toLowerCase();
        if (lowerCol === "employee id" || lowerCol === "mobile" || lowerCol === "mobile number" || lowerCol.includes("phone")) {
          val = val != null ? String(val) : "";
        }
        exportedRow[col] = val;
      });
      return exportedRow;
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);

    // Calculate maximum width for each column
    const colWidths = selectedDownloadColumns.map(col => {
      let maxLen = col.length; // Include header length
      dataToExport.forEach((row: any) => {
        const val = row[col];
        if (val !== undefined && val !== null) {
          const valLen = String(val).length;
          if (valLen > maxLen) {
            maxLen = valLen;
          }
        }
      });
      // Add padding to the maximum length (max out at 100 characters to prevent overly wide columns)
      return { wch: Math.min(maxLen + 2, 100) };
    });
    
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, entityName);
    
    // Generate buffer and trigger download
    XLSX.writeFile(workbook, `${entityName}_Data.xlsx`);
    
    setIsDownloadOpen(false);
    showNotification("success", "Download started successfully.");
  };

  useEffect(() => {
    const timer = setTimeout(() => updateColumnWidths(), 100);
    return () => clearTimeout(timer);
  }, [updateColumnWidths, data, headers, isFilterOpen]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setItemsPerPage(7);
      } else {
        setItemsPerPage(19);
      }
      updateColumnWidths();
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [updateColumnWidths]);

  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const safeData = useMemo(() => Array.isArray(data) ? data : [], [data]);

  const filteredData = useMemo(() => {
    return safeData.filter((row) => {
      const matchesSearch = Object.values(row).some((val) =>
        String(val).toLowerCase().includes(searchTerm.toLowerCase())
      );

      const matchesFilters = Object.entries(activeFilters).every(([key, value]) => {
        const filterValue = String(value);
        if (!filterValue) return true;
        return String(row[key] || "").toLowerCase().includes(filterValue.toLowerCase());
      });

      return matchesSearch && matchesFilters;
    });
  }, [safeData, searchTerm, activeFilters]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, currentPage, itemsPerPage]);

  const rowSpans = useMemo(() => {
    const spans = { ...externalRowSpans };
    if (!mergeGroups || !paginatedData.length) return spans;

    const { groupBy, mergeColumns } = mergeGroups;
    let i = 0;
    while (i < paginatedData.length) {
      let j = i + 1;
      while (j < paginatedData.length) {
        const matches = groupBy.every(col => paginatedData[i][col] === paginatedData[j][col]);
        if (!matches) break;
        j++;
      }
      
      const span = j - i;
      for (let k = i; k < j; k++) {
        if (!spans[k]) spans[k] = {};
        mergeColumns.forEach(col => {
          spans[k][col] = k === i ? span : 0;
        });
      }
      i = j;
    }
    return spans;
  }, [paginatedData, mergeGroups, externalRowSpans]);

  const handleOpenAdd = () => {
    if (onAddClick) {
      onAddClick();
      return;
    }
    const action = () => {
      setEditingRow(null);
      setIsModalOpen(true);
      setIsFormDirty(false);
    };

    if (isFormDirty) {
      setPendingAction(() => action);
      setIsDirtyModalOpen(true);
    } else {
      action();
    }
  };

  const handleOpenEdit = (row: any) => {
    const action = () => {
      setEditingRow(row);
      setIsModalOpen(true);
      setIsFormDirty(false);
    };

    if (isFormDirty) {
      setPendingAction(() => action);
      setIsDirtyModalOpen(true);
    } else {
      action();
    }
  };

  const handleConfirmDelete = async () => {
    if (!rowToDelete) return;
    const targetRow = rowToDelete;
    
    // Close modal immediately for instant feedback
    setIsDeleteModalOpen(false);
    setRowToDelete(null);
    
    try {
      await onDelete(targetRow);
      showNotification("success", `${entityName} removed successfully.`);
    } catch (error) {
      showNotification("error", `Failed to remove ${entityName.toLowerCase()}.`);
    }
  };

  const handleSaveWrapper = async (formData: any) => {
    // Show success immediately for better perceived performance
    const isEditing = !!editingRow;
    
    try {
      const savePromise = onSave(formData, editingRow);
      
      showNotification("success", `${entityName} ${isEditing ? "updated" : "added"} successfully.`);
      
      if (isEditing) {
        setEditingRow(formData);
        setIsFormDirty(false);
      } else {
        setIsModalOpen(false);
        setEditingRow(null);
        setIsFormDirty(false);
      }
      
      // Still await it in the background
      await savePromise;
    } catch (error) {
      showNotification("error", `Failed to save ${entityName.toLowerCase()}. Changes reverted.`);
      // We might need to re-open the modal or just let the revert handle it
      throw error;
    }
  };

  const getColumnStyle = (idx: number, isHeader: boolean) => {
    const isFrozen = idx <= effectiveFrozenIndex;
    let leftOffset = 0;
    if (isFrozen && columnWidths.length > idx) {
      for (let i = 0; i < idx; i++) {
        leftOffset += columnWidths[i] || 0;
      }
    }
    
    if (isFrozen) {
      return {
        position: 'sticky' as const,
        left: `${leftOffset}px`,
        top: isHeader ? 0 : undefined,
        zIndex: isHeader ? 30 : 20,
        boxShadow: idx === effectiveFrozenIndex ? '2px 0 5px -2px rgba(0,0,0,0.1)' : 'none',
        fontSize: `${fontSize}px`
      };
    }
    
    if (isHeader) {
      return {
        position: 'sticky' as const,
        top: 0,
        zIndex: 10,
        fontSize: `${fontSize}px`
      };
    }
    
    return {
      fontSize: `${fontSize}px`
    };
  };

  const formatCellValue = (header: string, val: any) => {
    if (val == null) return "";
    if (React.isValidElement(val)) return val;
    
    const headerLower = header.toLowerCase();

    // Format if the column name implies a date, or if it parses successfully as one
    if (headerLower.includes("date") || headerLower.includes("deadline")) {
      return formatToMmmDdYyyy(val);
    }

    if (["publication workflow", "instractor", "instructor"].includes(headerLower) && employees && employees.length > 0) {
      const ids = String(val).split(',').map(s => s.trim()).filter(Boolean);
      return ids.map(id => {
        const emp = employees.find(e => String(e['Employee ID'] || '').trim() === id || String(e['Employee Name'] || '').trim().toLowerCase() === id.toLowerCase());
        return emp ? emp['Employee Name'] : id;
      }).join(', ');
    }

    // Check if the value is formatted as YYYY-MM-DD or is another date form
    const dateFormatted = formatToMmmDdYyyy(val);
    if (dateFormatted !== String(val) && /^\d{4}[-/]\d{2}[-/]\d{2}$/.test(String(val).trim())) {
      return dateFormatted;
    }

    return String(val);
  };

  return (
    <div className="flex flex-col h-full w-full flex-1 min-w-0 bg-white overflow-hidden relative">
      {/* Table Header / Search */}
      <div className="p-2 border-b border-gray-200 flex items-center justify-between bg-gray-50/50 relative z-50">
        <div className="text-xs font-bold text-gray-700 uppercase tracking-wider px-2">
          {title || "Employee List"}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-64" ref={filterRef}>
            <div className="absolute left-1 top-1/2 -translate-y-1/2 flex items-center gap-1 z-10">
              <button 
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className={cn(
                  "p-1.5 transition-colors",
                  isFilterOpen ? "text-teal-600" : "text-gray-400 hover:text-yellow-500"
                )}
                title="Toggle Filters"
              >
                <Filter className="w-3.5 h-3.5" />
              </button>
              <Search className="w-3.5 h-3.5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder={`Search ${entityName.toLowerCase()}s...`}
              className="w-full pl-14 pr-3 py-1 text-[11px] bg-white border border-gray-200 text-gray-800 rounded focus:outline-none focus:border-teal-500 transition-all placeholder:text-gray-400"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />

            <AnimatePresence>
              {isFilterOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0, y: -10 }}
                  animate={{ height: "auto", opacity: 1, y: 0 }}
                  exit={{ height: 0, opacity: 0, y: -10 }}
                  className="absolute top-full left-0 right-0 mt-1 overflow-hidden border border-gray-200 bg-white shadow-lg rounded-md z-40 origin-top"
                >
                  <div className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-[9px] font-bold text-gray-900 uppercase tracking-widest">Column Filters</h3>
                      <button 
                        onClick={() => setActiveFilters({})}
                        className="text-[9px] font-bold text-teal-600 hover:text-teal-800 uppercase"
                      >
                        Reset
                      </button>
                    </div>
                    <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto no-scrollbar pr-1">
                      {headers.slice(0, 15).map((header) => (
                        <div key={header} className="flex flex-col gap-0.5">
                          <label className="text-[8px] font-bold text-gray-400 uppercase">{header}</label>
                          <input
                            type="text"
                            placeholder={`Filter ${header}...`}
                            className="w-full px-2 py-1 text-[10px] bg-gray-50 border border-gray-100 rounded focus:outline-none focus:border-teal-500"
                            value={activeFilters[header] || ""}
                            onChange={(e) => {
                              setActiveFilters(prev => ({ ...prev, [header]: e.target.value }));
                              setCurrentPage(1);
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-1.5 ml-1">
            <div className="relative" ref={downloadRef}>
              <button
                onClick={() => setIsDownloadOpen(!isDownloadOpen)}
                className={cn(
                  "p-1.5 bg-white border border-gray-200 hover:border-gray-400 rounded transition-all active:scale-95",
                  isDownloadOpen ? "text-teal-600 border-teal-600" : "text-gray-600 hover:text-gray-900"
                )}
                title="Download Excel"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
              
              <AnimatePresence>
                {isDownloadOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0, y: -10 }}
                    animate={{ height: "auto", opacity: 1, y: 0 }}
                    exit={{ height: 0, opacity: 0, y: -10 }}
                    className="absolute top-full right-0 mt-1 w-56 overflow-hidden border border-gray-200 bg-white shadow-lg rounded-md z-40 origin-top-right"
                  >
                    <div className="p-3">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-[9px] font-bold text-gray-900 uppercase tracking-widest">Select Columns</h3>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => setSelectedDownloadColumns(headers)}
                            className="text-[9px] font-bold text-teal-600 hover:text-teal-800 uppercase"
                          >
                            All
                          </button>
                          <button 
                            onClick={() => setSelectedDownloadColumns([])}
                            className="text-[9px] font-bold text-gray-400 hover:text-gray-600 uppercase"
                          >
                            None
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto no-scrollbar mb-3">
                        {headers.map((header) => (
                          <label key={header} className="flex items-center gap-2 cursor-pointer group">
                            <div className="relative flex items-center">
                              <input
                                type="checkbox"
                                className="peer sr-only"
                                checked={selectedDownloadColumns.includes(header)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedDownloadColumns(prev => [...prev, header]);
                                  } else {
                                    setSelectedDownloadColumns(prev => prev.filter(c => c !== header));
                                  }
                                }}
                              />
                              <div className="w-3.5 h-3.5 border border-gray-300 rounded bg-white peer-checked:bg-teal-600 peer-checked:border-teal-600 transition-colors flex items-center justify-center">
                                {selectedDownloadColumns.includes(header) && <CheckCircle2 className="w-2.5 h-2.5 text-white" />}
                              </div>
                            </div>
                            <span className="text-[10px] text-gray-600 group-hover:text-gray-900 truncate">
                              {header}
                            </span>
                          </label>
                        ))}
                      </div>
                      <button
                        onClick={handleDownloadExcel}
                        disabled={selectedDownloadColumns.length === 0}
                        className="w-full py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-[10px] font-bold uppercase rounded transition-colors disabled:opacity-50"
                      >
                        Download Excel
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {onRefresh && (
              <button 
                onClick={onRefresh}
                disabled={isLoading}
                className="relative p-1.5 bg-white border border-gray-200 hover:border-gray-400 rounded text-gray-600 hover:text-gray-900 transition-all active:scale-95 disabled:opacity-70"
                title="Refresh Data"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
                <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                  <span className={cn(
                    "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                    isLoading ? "bg-yellow-400" : "bg-green-400"
                  )}></span>
                  <span className={cn(
                    "relative inline-flex rounded-full h-2 w-2",
                    isLoading ? "bg-yellow-500" : "bg-green-500"
                  )}></span>
                </span>
              </button>
            )}
            {!hideAddButton && (
              <button 
                onClick={handleOpenAdd}
                className="p-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded transition-all active:scale-95"
                title={`Add New ${entityName}`}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
            {customHeaderButton}
          </div>
        </div>
      </div>

      {/* Table Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 overflow-auto no-scrollbar relative">
          {isLoading && safeData.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-white z-20">
              <div className="flex flex-col items-center gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
                <p className="text-[10px] text-gray-400 font-mono tracking-widest animate-pulse uppercase">Syncing Database...</p>
              </div>
            </div>
          )}
          
          <table ref={tableRef} className="w-full text-left border-collapse min-w-full">
            <thead className="bg-gray-50 shadow-sm">
              <tr>
                {photoKey && (
                  <th
                    className={cn(
                      "px-1 py-1 text-xs font-bold text-gray-500 uppercase tracking-tighter border-b border-gray-200 border-r border-gray-100 w-10 cursor-pointer hover:bg-gray-200 transition-colors bg-gray-50 whitespace-nowrap text-center",
                      0 <= effectiveFrozenIndex && "bg-gray-50"
                    )}
                    style={getColumnStyle(0, true)}
                    onClick={() => setFrozenColumnIndex(frozenColumnIndex === 0 ? -1 : 0)}
                    title="Click to freeze/unfreeze up to this column"
                  >
                    PHOTO
                  </th>
                )}
                {renderActions && (
                  <th
                    className={cn(
                      "px-2 py-1 text-xs font-bold text-gray-500 uppercase tracking-tighter border-b border-gray-200 border-r border-gray-100 whitespace-nowrap bg-gray-50 text-center",
                      (photoKey ? 1 : 0) <= effectiveFrozenIndex && "bg-gray-50"
                    )}
                    style={getColumnStyle(photoKey ? 1 : 0, true)}
                  >
                    ACTION
                  </th>
                )}
                {headers.filter(h => h !== photoKey).map((header, idx) => {
                  const actualIdx = (photoKey ? 1 : 0) + (renderActions ? 1 : 0) + idx;
                  const isNormal = columnStyles?.[header] && columnStyles[header].includes("normal");
                  return (
                  <th
                    key={header}
                    className={cn(
                      "px-2 py-1 text-xs font-bold text-gray-500 uppercase tracking-tighter border-b border-gray-200 border-r border-gray-100 last:border-r-0 cursor-pointer hover:bg-gray-200 transition-colors bg-gray-50",
                      !isNormal && "whitespace-nowrap",
                      ["id", "status", "ip-ext", "extension", "tag"].some(s => header.toLowerCase().includes(s)) ? "w-16" : 
                      header.toLowerCase().includes("mobile") ? "w-28" : 
                      header.toLowerCase() === "date" ? "w-24" :
                      isNormal ? "w-auto" : "w-min max-w-[300px] truncate",
                      ["employee id", "mobile", "ip-ext", "status", "mode", "duration", "class", "no. of class", "course fee", "student size", "enrolled", "discount", "expenses", "net profit", "batches", "profit %", "date", "action", "assigned date", "deadline"].includes(header.toLowerCase()) && "text-center",
                      actualIdx <= effectiveFrozenIndex && "bg-gray-50",
                      columnStyles?.[header]
                    )}
                    style={getColumnStyle(actualIdx, true)}
                    onClick={() => setFrozenColumnIndex(frozenColumnIndex === actualIdx ? -1 : actualIdx)}
                    title="Click to freeze/unfreeze up to this column"
                  >
                    {header}
                  </th>
                )})}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs text-gray-600">
              {paginatedData.map((row, idx) => {
                const rowId = row["Employee ID"] || row["ID"] || idx;
                const rowGroupKey = mergeGroups ? mergeGroups.groupBy.map(col => String(row[col] || "")).join("|||") : null;
                const isRowHovered = hoveredGroupKey !== null && rowGroupKey === hoveredGroupKey;

                return (
                  <tr 
                  key={`row-${rowId}-${idx}`} 
                  className={cn(
                    "hover:bg-teal-100 transition-colors group cursor-pointer",
                    isActiveRow?.(row) ? "bg-teal-100 text-teal-950 font-semibold" : "",
                    isRowHovered ? "bg-teal-100/60" : ""
                  )}
                  onMouseEnter={() => {
                    if (rowGroupKey) {
                      setHoveredGroupKey(rowGroupKey);
                    }
                  }}
                  onMouseLeave={() => {
                    if (rowGroupKey) {
                      setHoveredGroupKey(null);
                    }
                  }}
                  onClick={() => onRowClick ? onRowClick(row) : handleOpenEdit(row)}
                >
                    {photoKey && (
                      <td
                        className={cn(
                          "px-1 py-1 border-r border-gray-100 whitespace-nowrap text-center",
                          0 <= effectiveFrozenIndex ? (isActiveRow?.(row) ? "bg-teal-100" : (isRowHovered ? "bg-teal-100/60" : "bg-white group-hover:bg-teal-100")) : ""
                        )}
                        style={getColumnStyle(0, false)}
                      >
                        {row[photoKey] ? (
                          <div className="w-7 h-7 mx-auto rounded-full overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center">
                            <img 
                              src={
                                typeof row[photoKey] === 'string' && row[photoKey].includes('drive.google.com/uc') && row[photoKey].includes('id=')
                                  ? `https://drive.google.com/thumbnail?id=${new URL(row[photoKey]).searchParams.get('id')}&sz=w1000`
                                  : row[photoKey]
                              } 
                              alt="Photo" 
                              className="w-full h-full object-cover rounded-full" 
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjY2JkNWUxIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHJlY3QgeD0iMyIgeT0iMyIgd2lkdGg9IjE4IiBoZWlnaHQ9IjE4IiByeD0iMiIgcnk9IjIiPjwvcmVjdD48Y2lyY2xlIGN4PSI4LjUiIGN5PSI4LjUiIHI9IjEuNSI+PC9jaXJybGU+PHBvbHlsaW5lIHBvaW50cz0iMjEgMTUgMTYgMTAgNSAyMSI+PC9wb2x5bGluZT48L3N2Zz4=';
                              }}
                            />
                          </div>
                        ) : (
                          <div className="w-7 h-7 mx-auto rounded-full overflow-hidden border border-gray-200 bg-gray-100 flex items-center justify-center">
                            <User className="w-4 h-4 text-gray-400" />
                          </div>
                        )}
                      </td>
                    )}
                    {renderActions && (
                      <td 
                        className={cn(
                          "px-2 py-1 border-r border-gray-100 whitespace-nowrap text-center",
                          (photoKey ? 1 : 0) <= effectiveFrozenIndex ? (isActiveRow?.(row) ? "bg-teal-100" : (isRowHovered ? "bg-teal-100/60" : "bg-white group-hover:bg-teal-100")) : ""
                        )}
                        style={getColumnStyle(photoKey ? 1 : 0, false)}
                      >
                        {renderActions(row)}
                      </td>
                    )}
                    {headers.filter(h => h !== photoKey).map((header, colIdx) => {
                      const actualIdx = (photoKey ? 1 : 0) + (renderActions ? 1 : 0) + colIdx;
                      
                      const spanValue = rowSpans?.[idx]?.[header];
                      if (spanValue === 0) return null;
                      
                      const headerLower = header.toLowerCase();
                      const isClipped = ["status", "group name", "department", "tag"].includes(headerLower);
                      const renderedCustomCell = renderCell ? renderCell(header, row[header], row) : undefined;
                      
                      if (headerLower === "banner") {
                        const bannerUrl = row[header];
                        return (
                          <td 
                            key={`${rowId}-${header}`} 
                            rowSpan={spanValue > 1 ? spanValue : undefined}
                            className={cn(
                              "px-2 py-1 border-r border-gray-100 last:border-r-0 group-hover:text-gray-900 whitespace-nowrap text-center",
                              actualIdx <= effectiveFrozenIndex ? (isActiveRow?.(row) ? "bg-teal-100" : (isRowHovered ? "bg-teal-100/60" : "bg-white group-hover:bg-teal-100")) : ""
                            )}
                            style={getColumnStyle(actualIdx, false)}
                            title={formatCellValue(header, row[header])}
                          >
                            {bannerUrl ? (
                              <div className="w-12 h-6 mx-auto rounded overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center">
                                <img 
                                  src={
                                    typeof bannerUrl === 'string' && bannerUrl.includes('drive.google.com/uc') && bannerUrl.includes('id=')
                                      ? `https://drive.google.com/thumbnail?id=${new URL(bannerUrl).searchParams.get('id')}&sz=w200`
                                      : bannerUrl
                                  } 
                                  alt="Banner" 
                                  className="w-full h-full object-cover" 
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdib3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjY2JkNWUxIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHJlY3QgeD0iMyIgeT0iMyIgd2lkdGg9IjE4IiBoZWlnaHQ9IjE4IiByeD0iMiIgcnk9IjIiPjwvcmVjdD48Y2lyY2xlIGN4PSI4LjUiIGN5PSI4LjUiIHI9IjEuNSI+PC9jaXJybGU+PHBvbHlsaW5lIHBvaW50cz0iMjEgMTUgMTYgMTAgNSAyMSI+PC9wb2x5bGluZT48L3N2Zz4=';
                                  }}
                                />
                              </div>
                            ) : (
                              <span className="text-gray-400 text-[10px] italic">No Banner</span>
                            )}
                          </td>
                        );
                      }

                      const isNormalCell = columnStyles?.[header] && columnStyles[header].includes("normal");
                      return (
                      <td 
                        key={`${rowId}-${header}`} 
                        rowSpan={spanValue > 1 ? spanValue : undefined}
                        className={cn(
                          "px-2 py-1 border-r border-gray-100 last:border-r-0 group-hover:text-gray-900",
                          !isNormalCell && "whitespace-nowrap",
                          (headerLower === "employee name" || isNormalCell) ? "overflow-visible relative" : "overflow-hidden text-ellipsis",
                          ["employee id", "mobile", "ip-ext", "status", "mode", "duration", "class", "no. of class", "course fee", "student size", "batch number", "enrolled", "discount", "expenses", "net profit", "batches", "profit %", "date", "action", "assigned date", "deadline"].includes(headerLower) && "text-center",
                          actualIdx <= effectiveFrozenIndex ? (isActiveRow?.(row) ? "bg-teal-100" : (isRowHovered ? "bg-teal-100/60" : "bg-white group-hover:bg-teal-100")) : "",
                          columnStyles?.[header]
                        )}
                        style={getColumnStyle(actualIdx, false)}
                        title={React.isValidElement(row[header]) ? undefined : String(formatCellValue(header, row[header]))}
                      >
                        {isClipped ? (
                          <div className="mx-auto">
                            {renderedCustomCell !== undefined ? renderedCustomCell : formatCellValue(header, row[header])}
                          </div>
                        ) : (
                          <div className={cn("flex items-center gap-1.5", ["employee id", "mobile", "ip-ext", "status", "mode", "duration", "class", "no. of class", "course fee", "student size", "batch number", "enrolled", "discount", "expenses", "net profit", "batches", "profit %", "assigned date", "deadline"].includes(headerLower) ? "justify-center w-full" : "")}>
                            {renderedCustomCell !== undefined ? (
                              renderedCustomCell
                            ) : (headerLower === "employee" || headerLower === "employee name") && row["Designation"] ? (
                              <div className="flex flex-col text-left">
                                <span className="font-medium text-gray-900">{formatCellValue(header, row[header])}</span>
                                <span className="text-[10px] text-gray-500 font-normal leading-tight">{row["Designation"]}</span>
                              </div>
                            ) : headerLower === "status" && entityName === "Course" ? (
                              (() => {
                                const status = String(row[header]);
                                let badgeColors = "bg-gray-100 text-gray-600 border-gray-200";
                                if (status === "100%" || status.includes("100%")) badgeColors = "bg-emerald-50 text-emerald-700 border-emerald-200/50";
                                else if (status === "0%" || status.includes("0%")) badgeColors = "bg-slate-100 text-slate-600 border-slate-200";
                                else if (status.endsWith("%")) badgeColors = "bg-sky-50 text-sky-700 border-sky-200/50";
                                else if (status === "Proposed") badgeColors = "bg-indigo-50 text-indigo-700 border-indigo-200/50";
                                else if (status === "Developed") badgeColors = "bg-amber-50 text-amber-700 border-amber-200/50";
                                else if (status === "Reviewed") badgeColors = "bg-sky-50 text-sky-700 border-sky-200/50";
                                else if (status === "Approved") badgeColors = "bg-emerald-50 text-emerald-700 border-emerald-200/50";
                                else if (status === "Published") badgeColors = "bg-teal-50 text-teal-700 border-teal-200/50";
                                else if (status === "Active") badgeColors = "bg-green-100 text-green-800 border-green-300/50";
                                
                                return (
                                  <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border", badgeColors)}>
                                    {status}
                                  </span>
                                );
                              })()
                            ) : (
                              <span>{formatCellValue(header, row[header])}</span>
                            )}
                            {entityName === "Batch" && headerLower === "batch number" && isBatchRunning(row) && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8.5px] font-bold uppercase tracking-widest bg-emerald-50 text-emerald-700 border border-emerald-200/50">
                                <span className="relative flex h-1.5 w-1.5 mr-0.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                                </span>
                                Running
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    )})}
                  </tr>
                );
              })}
              {paginatedData.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={headers.length} className="px-3 py-10 text-center text-xs text-gray-600 italic">
                    NO DATA ENTRIES FOUND
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Render FormPanel as a side panel */}
        <FormPanel 
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveWrapper}
          onDelete={onDelete}
          initialData={editingRow}
          defaultData={defaultNewValues}
          headers={formHeaders || headers}
          onDirtyChange={setIsFormDirty}
          allData={safeData}
          employees={employees}
          {...(extraFormProps || {})}
        />

        {children}
      </div>

      {/* Pagination Footer */}
      <div className="p-2 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
        <div className="text-[10px] text-gray-500 font-mono">
          PAGE {currentPage} / {Math.max(1, totalPages)}
        </div>

        {/* Font Size Adjuster */}
        <div className="flex items-center gap-2 px-4 border-x border-gray-200">
          <Type className="w-3 h-3 text-gray-400" />
          <input
            type="range"
            min="8"
            max="20"
            step="1"
            value={fontSize}
            onChange={(e) => setFontSize(parseInt(e.target.value))}
            className="w-20 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-500"
          />
          <span className="text-[9px] text-gray-400 font-mono w-6">{fontSize}px</span>
          <button 
            onClick={() => setFontSize(12)}
            className="p-1 hover:bg-gray-200 rounded transition-colors text-gray-400 hover:text-gray-600"
            title="Reset Font Size"
          >
            <RotateCcw className="w-2.5 h-2.5" />
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-[10px] text-gray-400 font-mono border-r border-gray-200 pr-4 hidden sm:block">
            {filteredData.length} RECORDS FOUND
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-2 py-1 text-[10px] rounded border border-gray-200 bg-white text-gray-500 hover:text-gray-900 disabled:opacity-30 transition-colors"
            >
              PREV
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="px-2 py-1 text-[10px] rounded border border-gray-200 bg-white text-gray-500 hover:text-gray-900 disabled:opacity-30 transition-colors"
            >
              NEXT
            </button>
          </div>
        </div>
      </div>

      {/* Internal Modals */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Confirm Deletion"
        message={`Are you sure you want to remove this ${entityName.toLowerCase()} entry? This action is irreversible.`}
        confirmText="Delete"
        variant="danger"
      />

      <ConfirmModal
        isOpen={isDirtyModalOpen}
        onClose={() => setIsDirtyModalOpen(false)}
        onConfirm={() => {
          if (pendingAction) {
            pendingAction();
            setPendingAction(null);
          }
          setIsDirtyModalOpen(false);
        }}
        title="Unsaved Changes"
        message="You have unsaved changes. Do you want to discard them?"
        confirmText="Discard"
        cancelText="Keep Editing"
        variant="warning"
      />

      {/* Internal Notifications */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={cn(
              "fixed bottom-4 right-4 z-[100] flex items-center gap-3 px-4 py-2.5 rounded-lg border shadow-lg bg-white",
              notification.type === "success" ? "border-green-200 text-green-700" : "border-red-200 text-red-700"
            )}
          >
            {notification.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span className="text-[11px] font-bold uppercase tracking-wider">{notification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
