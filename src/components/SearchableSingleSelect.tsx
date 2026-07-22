import React, { useState, useEffect, useRef, useMemo } from "react";
import { Search, ChevronDown, Check, X } from "lucide-react";

interface SearchableSingleSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: string[];
  placeholder?: string;
}

export default function SearchableSingleSelect({
  value,
  onChange,
  options,
  placeholder = "Select an option",
}: SearchableSingleSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      searchInputRef.current?.focus();
    } else {
      setSearch("");
    }
  }, [isOpen]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isOpen]);

  const filteredOptions = useMemo(() => {
    const trimmed = search.trim().toLowerCase();
    if (!trimmed) return options;
    return options.filter((opt) => opt.toLowerCase().includes(trimmed));
  }, [options, search]);

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger Button */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 text-xs border border-gray-200 rounded focus:border-teal-500 outline-none bg-white cursor-pointer font-medium flex items-center justify-between shadow-3xs hover:border-gray-300 transition-colors"
      >
        <span className={value ? "text-gray-900" : "text-gray-400"}>
          {value || placeholder}
        </span>
        <div className="flex items-center gap-1 text-gray-400 shrink-0">
          {value && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              className="p-0.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
            >
              <X className="w-3 h-3" />
            </button>
          )}
          <ChevronDown className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 flex flex-col max-h-64 overflow-hidden">
          {/* Search Box */}
          <div className="p-2 border-b border-gray-100 flex items-center gap-1.5 shrink-0 bg-gray-50/50">
            <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent border-none outline-none text-xs text-gray-700 py-0.5"
            />
          </div>

          {/* Options List */}
          <div className="overflow-y-auto py-1 max-h-48 no-scrollbar flex-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt, idx) => {
                const isSelected = value === opt;
                return (
                  <div
                    key={idx}
                    onClick={() => {
                      onChange(opt);
                      setIsOpen(false);
                    }}
                    className={`px-3 py-2 text-xs cursor-pointer flex items-center justify-between transition-colors ${
                      isSelected
                        ? "bg-teal-50 text-teal-900 font-semibold"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <span className="truncate">{opt}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-teal-600 shrink-0" />}
                  </div>
                );
              })
            ) : (
              <div className="px-3 py-3 text-xs text-gray-400 text-center">
                No results found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
