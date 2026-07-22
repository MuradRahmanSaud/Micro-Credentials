import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Check } from 'lucide-react';

interface Employee {
  'Employee ID': string;
  'Employee Name': string;
  'Designation': string;
  'Photo'?: string;
  'Image'?: string;
  [key: string]: any;
}

interface EmployeeMultiSelectProps {
  label?: string;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  employees: Employee[];
  placement?: 'top' | 'bottom' | 'right-sidebar';
}

const getPhotoUrl = (emp: any) => {
  const photoKey = Object.keys(emp).find(k => k.toLowerCase().includes("photo") || k.toLowerCase() === "image");
  const rawUrl = photoKey ? emp[photoKey] : '';
  if (!rawUrl || typeof rawUrl !== 'string' || rawUrl.trim() === '') {
    return 'https://ui-avatars.com/api/?name=' + encodeURIComponent(emp['Employee Name'] || 'User');
  }
  
  // Handle Google Drive URL
  const fileIdMatch = rawUrl.match(/[-\w]{25,}/);
  if (fileIdMatch && rawUrl.includes('drive.google.com')) {
    return `https://drive.google.com/thumbnail?id=${fileIdMatch[0]}&sz=w200`;
  }
  return rawUrl;
};

export default function EmployeeMultiSelect({ label, selectedIds, onChange, employees, placement = 'bottom' }: EmployeeMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({ position: 'fixed', top: -9999, left: -9999, opacity: 0 });
  const searchInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        containerRef.current && !containerRef.current.contains(event.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      // Update position
      if (placement !== 'right-sidebar' && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDropdownStyle({
          position: 'fixed',
          top: placement === 'bottom' ? rect.bottom + 4 : 'auto',
          bottom: placement === 'top' ? window.innerHeight - rect.top + 4 : 'auto',
          left: rect.left,
          width: rect.width,
          zIndex: 99999,
          opacity: 1
        });
      }
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen, placement]);

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp =>
      emp['Employee Name']?.toLowerCase().includes(search.toLowerCase()) ||
      emp['Designation']?.toLowerCase().includes(search.toLowerCase()) ||
      emp['Employee ID']?.toLowerCase().includes(search.toLowerCase())
    );
  }, [employees, search]);

  const getBaseId = (idStr: string) => idStr.split('|')[0];

  const selectedEmployees = useMemo(() => {
    return employees.filter(emp => selectedIds.some(sid => getBaseId(sid) === String(emp['Employee ID'])));
  }, [employees, selectedIds]);

  const toggleEmployee = (id: string) => {
    const stringId = String(id);
    const existingIndex = selectedIds.findIndex(sid => getBaseId(sid) === stringId);
    
    if (existingIndex !== -1) {
      onChange(selectedIds.filter((_, idx) => idx !== existingIndex));
    } else {
      const today = new Date().toISOString().split('T')[0];
      onChange([...selectedIds, `${stringId}|${today}`]);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {label && <label className="text-[10px] font-bold text-teal-800 uppercase block mb-1">{label}</label>}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full border border-gray-200 rounded-md px-3 py-2 text-xs text-gray-800 flex justify-between items-center bg-white min-h-[34px]"
      >
        <div className="flex flex-wrap gap-1">
          {selectedEmployees.length > 0 ? (
            selectedEmployees.map((emp, index) => (
              <span key={`${emp['Employee ID']}-${index}`} className="bg-teal-50 text-teal-800 border border-teal-200/80 px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1">
                <img 
                  src={getPhotoUrl(emp)} 
                  alt={emp['Employee Name']}
                  className="w-3.5 h-3.5 rounded-full object-cover shrink-0 border border-teal-200"
                  onError={(e) => { (e.target as HTMLImageElement).src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(emp['Employee Name']); }}
                />
                <span>{emp['Employee Name']}</span>
              </span>
            ))
          ) : (
            <span className="text-gray-400">Select Employees</span>
          )}
        </div>
        <span className="text-gray-400 ml-2">▼</span>
      </button>

      {isOpen && createPortal(
        placement === 'right-sidebar' ? (
          <div ref={dropdownRef} data-portal-dropdown="true" className="absolute top-0 left-0 h-full w-[280px] bg-white border-r border-slate-200 shadow-2xl z-[100] flex flex-col overflow-hidden animate-in slide-in-from-left duration-200">
            {/* Header */}
            <div className="py-2 px-3 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
              <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">Assign Employees</span>
              <button 
                type="button" 
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-slate-200 rounded-full transition-colors text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Search */}
            <div className="p-3 border-b border-slate-100 shrink-0 bg-white">
              <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50/50">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search employee..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full text-xs outline-none bg-transparent"
                />
              </div>
            </div>
            {/* List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 bg-white">
              {filteredEmployees.map((emp, index) => {
                const isSelected = selectedIds.some(sid => getBaseId(sid) === String(emp['Employee ID']));
                return (
                  <div
                    key={`${emp['Employee ID']}-${index}`}
                    className={`p-3 flex items-center gap-3 cursor-pointer hover:bg-slate-50 transition-colors ${isSelected ? 'bg-teal-50/50' : ''}`}
                    onClick={() => toggleEmployee(String(emp['Employee ID']))}
                  >
                    <img 
                      src={getPhotoUrl(emp)} 
                      className="w-8 h-8 rounded-full object-cover bg-slate-100 border border-slate-200/50" 
                      alt={emp['Employee Name']}
                      onError={(e) => { (e.target as HTMLImageElement).src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(emp['Employee Name']); }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-slate-800 truncate">{emp['Employee Name']}</div>
                      <div className="text-[10px] text-slate-500 truncate mt-0.5">{emp.Designation}</div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-teal-600 shrink-0" />}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div ref={dropdownRef} data-portal-dropdown="true" style={dropdownStyle} className="bg-white border border-gray-200 rounded shadow-2xl overflow-hidden">
            <div className="p-2 border-b border-gray-100">
              <div className="flex items-center gap-2 border border-gray-200 rounded px-2 py-1">
                <Search className="w-3 h-3 text-gray-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full text-xs outline-none"
                />
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto">
              {filteredEmployees.map((emp, index) => {
                const isSelected = selectedIds.some(sid => getBaseId(sid) === String(emp['Employee ID']));
                return (
                  <div
                    key={`${emp['Employee ID']}-${index}`}
                    className={`p-2 flex items-center gap-2 cursor-pointer hover:bg-gray-50 ${isSelected ? 'bg-teal-50' : ''}`}
                    onClick={() => toggleEmployee(String(emp['Employee ID']))}
                  >
                    <img 
                      src={getPhotoUrl(emp)} 
                      className="w-8 h-8 rounded-full object-cover bg-gray-200" 
                      alt={emp['Employee Name']}
                      onError={(e) => { (e.target as HTMLImageElement).src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(emp['Employee Name']); }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-900 truncate">{emp['Employee Name']}</div>
                      <div className="text-[10px] text-gray-500 truncate">{emp.Designation}</div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-teal-600" />}
                  </div>
                );
              })}
            </div>
          </div>
        ),
        (placement === 'right-sidebar' ? (document.getElementById('batch-details-view-container') || document.body) : document.body)
      )}
    </div>
  );
}
