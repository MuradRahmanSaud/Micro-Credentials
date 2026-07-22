import React, { useState, useEffect, useRef, useMemo } from "react";
import { X, Save, Loader2, Type, FileText, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  onDelete?: (row: any) => Promise<void>;
  initialData?: any;
  defaultData?: any;
  headers: string[];
  onDirtyChange?: (isDirty: boolean) => void;
  allData?: any[];
}

export default function SettingsPanel({
  isOpen,
  onClose,
  onSave,
  initialData,
  onDirtyChange,
  allData
}: SettingsPanelProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTitleFocused, setIsTitleFocused] = useState(false);
  const [isContentFocused, setIsContentFocused] = useState(false);

  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Extract unique Title values from allData
  const existingTitles = useMemo(() => {
    if (!allData || !Array.isArray(allData)) return [];
    const titles = allData
      .map((item) => item["Title"] || "")
      .filter((t) => typeof t === "string" && t.trim() !== "");
    return Array.from(new Set(titles)).sort();
  }, [allData]);

  const filteredTitles = useMemo(() => {
    const query = title.trim().toLowerCase();
    if (!query) return existingTitles;
    return existingTitles.filter(t => t.toLowerCase().includes(query));
  }, [existingTitles, title]);

  const hasExactMatch = useMemo(() => {
    return existingTitles.some(t => t.toLowerCase() === title.trim().toLowerCase());
  }, [existingTitles, title]);

  const dropdownOptions = useMemo(() => {
    const opts = [...filteredTitles];
    if (title.trim() && !hasExactMatch) {
      opts.push(`+ Add "${title.trim()}"`);
    }
    return opts;
  }, [filteredTitles, title, hasExactMatch]);

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectOption = (option: string) => {
    if (option.startsWith('+ Add "')) {
      setTitle(title.trim());
    } else {
      setTitle(option);
    }
    setShowDropdown(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!showDropdown) {
        setShowDropdown(true);
        setHighlightedIndex(0);
      } else if (dropdownOptions.length > 0) {
        setHighlightedIndex(prev => (prev + 1) % dropdownOptions.length);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (showDropdown && dropdownOptions.length > 0) {
        setHighlightedIndex(prev => (prev - 1 + dropdownOptions.length) % dropdownOptions.length);
      }
    } else if (e.key === "Enter") {
      if (showDropdown && highlightedIndex >= 0 && highlightedIndex < dropdownOptions.length) {
        e.preventDefault();
        handleSelectOption(dropdownOptions[highlightedIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setShowDropdown(false);
      setHighlightedIndex(-1);
    }
  };

  useEffect(() => {
    if (initialData) {
      setTitle(initialData["Title"] || "");
      setContent(initialData["Content"] || "");
    } else {
      setTitle("");
      setContent("");
    }
  }, [initialData, isOpen]);

  // Track dirty state
  useEffect(() => {
    const isDirty = initialData 
      ? title !== (initialData["Title"] || "") || content !== (initialData["Content"] || "")
      : title !== "" || content !== "";
    onDirtyChange?.(isDirty);
  }, [title, content, initialData, onDirtyChange]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      await onSave({
        Title: title.trim(),
        Content: content.trim()
      });
      onClose();
    } catch (error) {
      console.error("Failed to save settings entry:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900 z-50 transition-opacity"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col h-full border-l border-gray-150"
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-teal-800 text-white">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider">
                  {initialData ? "Edit Settings Item" : "Add Settings Item"}
                </h3>
                <p className="text-[10px] text-teal-200/80 font-mono mt-1">
                  CONFIGURE INFORMATION KEY-VALUES
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-teal-100 hover:text-white hover:bg-teal-700/50 p-1.5 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Title Field */}
              <div className="relative" ref={dropdownRef}>
                <motion.label
                  initial={false}
                  animate={{
                    top: (isTitleFocused || title || showDropdown) ? -6 : 10,
                    left: (isTitleFocused || title || showDropdown) ? 8 : 12,
                    fontSize: (isTitleFocused || title || showDropdown) ? 9 : 11,
                    color: (isTitleFocused || showDropdown) ? "#0d9488" : "#9ca3af",
                    backgroundColor: (isTitleFocused || title || showDropdown) ? "#ffffff" : "transparent",
                    paddingLeft: (isTitleFocused || title || showDropdown) ? 4 : 0,
                    paddingRight: (isTitleFocused || title || showDropdown) ? 4 : 0,
                  }}
                  className="absolute pointer-events-none z-10 transition-colors font-semibold"
                >
                  TITLE
                </motion.label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    required
                    value={title}
                    onFocus={() => {
                      setIsTitleFocused(true);
                      setShowDropdown(true);
                    }}
                    onBlur={() => setIsTitleFocused(false)}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      setShowDropdown(true);
                      setHighlightedIndex(-1);
                    }}
                    onKeyDown={handleKeyDown}
                    className="w-full border border-gray-200 rounded pl-3 pr-8 py-2 text-xs transition-all outline-none focus:border-teal-500 text-gray-800"
                  />
                  <button
                    type="button"
                    onClick={() => setShowDropdown(!showDropdown)}
                    className="absolute right-2 p-1 text-gray-400 hover:text-gray-600 focus:outline-none flex items-center"
                  >
                    <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", showDropdown && "rotate-180")} />
                  </button>
                </div>

                {/* Dropdown list */}
                <AnimatePresence>
                  {showDropdown && dropdownOptions.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-y-auto z-40"
                    >
                      {dropdownOptions.map((option, idx) => {
                        const isHighlighted = idx === highlightedIndex;
                        const isNewOption = option.startsWith('+ Add "');
                        
                        return (
                          <div
                            key={option}
                            onClick={() => handleSelectOption(option)}
                            onMouseEnter={() => setHighlightedIndex(idx)}
                            className={cn(
                              "px-3 py-2 text-xs cursor-pointer transition-colors text-left",
                              isHighlighted ? "bg-teal-50 text-teal-900 font-medium" : "text-gray-700",
                              isNewOption ? "text-teal-600 font-semibold border-t border-gray-100 bg-teal-50/20" : ""
                            )}
                          >
                            {option}
                          </div>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Content Field */}
              <div className="relative">
                <motion.label
                  initial={false}
                  animate={{
                    top: (isContentFocused || content) ? -6 : 10,
                    left: (isContentFocused || content) ? 8 : 12,
                    fontSize: (isContentFocused || content) ? 9 : 11,
                    color: isContentFocused ? "#0d9488" : "#9ca3af",
                    backgroundColor: (isContentFocused || content) ? "#ffffff" : "transparent",
                    paddingLeft: (isContentFocused || content) ? 4 : 0,
                    paddingRight: (isContentFocused || content) ? 4 : 0,
                  }}
                  className="absolute pointer-events-none z-10 transition-colors font-semibold"
                >
                  CONTENT / VALUE
                </motion.label>
                <div className="relative flex items-start">
                  <textarea
                    rows={6}
                    value={content}
                    onFocus={() => setIsContentFocused(true)}
                    onBlur={() => setIsContentFocused(false)}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full border border-gray-200 rounded px-3 py-2.5 text-xs transition-all outline-none focus:border-teal-500 text-gray-800 resize-none"
                  />
                  <FileText className="absolute right-3 top-3 w-4 h-4 text-gray-300 pointer-events-none" />
                </div>
              </div>
            </form>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 border border-gray-200 rounded text-xs font-bold text-gray-500 hover:bg-gray-100 transition-colors uppercase tracking-wider"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || !title.trim()}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-bold text-white transition-all uppercase tracking-wider",
                  title.trim() && !isSubmitting
                    ? "bg-teal-600 hover:bg-teal-700 active:scale-[0.98]"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                )}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
