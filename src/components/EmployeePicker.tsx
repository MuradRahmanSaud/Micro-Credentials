import React, { useState, useMemo } from "react";
import { Search, X, Check, User } from "lucide-react";
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";

interface EmployeePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (selectedEmployees: any[]) => Promise<void>;
  employees: any[];
  headers: string[];
}

export default function EmployeePicker({
  isOpen,
  onClose,
  onSave,
  employees,
  headers
}: EmployeePickerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  const idKey = useMemo(() => 
    headers.find(h => h.toLowerCase() === "employee id" || h.toLowerCase() === "id") || "Employee ID"
  , [headers]);

  // Initialize selected IDs based on current tags when picker opens
  React.useEffect(() => {
    if (isOpen) {
      const initial = new Set<string>();
      employees.forEach(emp => {
        const currentTags = emp["Tag"] || "";
        let tags: string[] = [];
        if (Array.isArray(currentTags)) {
          tags = currentTags;
        } else if (typeof currentTags === 'string') {
          tags = currentTags.split(',').map(s => s.trim()).filter(Boolean);
        }
        
        if (tags.includes("MC Representatives")) {
          initial.add(String(emp[idKey]));
        }
      });
      setSelectedIds(initial);
    }
  }, [isOpen, employees, idKey]);
  
  const nameKey = useMemo(() => 
    headers.find(h => h.toLowerCase() === "employee name" || h.toLowerCase() === "name") || "Employee Name"
  , [headers]);
  
  const designationKey = useMemo(() => 
    headers.find(h => h.toLowerCase() === "designation") || "Designation"
  , [headers]);

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const name = String(emp[nameKey] || "").toLowerCase();
      const id = String(emp[idKey] || "").toLowerCase();
      const designation = String(emp[designationKey] || "").toLowerCase();
      const search = searchTerm.toLowerCase();
      return name.includes(search) || id.includes(search) || designation.includes(search);
    });
  }, [employees, searchTerm, nameKey, idKey, designationKey]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const selectedEmployees = employees.filter(emp => selectedIds.has(String(emp[idKey])));
      await onSave(selectedEmployees);
      onClose();
    } catch (error) {
      console.error("Error saving selected employees:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const getThumbnail = (photoUrl: string) => {
    if (!photoUrl) return null;
    const fileIdMatch = photoUrl.match(/[-\w]{25,}/);
    if (fileIdMatch) {
      return `https://drive.google.com/thumbnail?id=${fileIdMatch[0]}&sz=w200`;
    }
    return photoUrl;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="absolute top-0 right-0 bottom-0 w-80 bg-white shadow-2xl flex flex-col z-40"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-2.5 bg-gradient-to-r from-teal-600 to-teal-500">
              <h3 className="text-[11px] font-bold text-white uppercase tracking-widest">
                Add MC Representatives
              </h3>
              <button
                onClick={onClose}
                className="text-teal-100 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Section */}
            <div className="p-2.5 bg-gray-50/50 border-b border-gray-100">
              <div className="relative group">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 group-focus-within:text-teal-600 transition-colors" />
                <input
                  type="text"
                  placeholder="Search employees..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-gray-200 rounded text-[11px] focus:outline-none focus:border-teal-500 transition-all placeholder:text-gray-400"
                  autoFocus
                />
              </div>
            </div>

            {/* Employee List */}
            <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 no-scrollbar">
              {filteredEmployees.length > 0 ? (
                filteredEmployees.map((emp, idx) => {
                  const id = String(emp[idKey]);
                  const isSelected = selectedIds.has(id);
                  const photo = emp["Photo"];

                  return (
                    <motion.div
                      layout
                      key={`${id}-${idx}`}
                      onClick={() => toggleSelect(id)}
                      className={cn(
                        "flex items-center gap-3 p-2 rounded cursor-pointer transition-all border group",
                        isSelected 
                          ? "bg-teal-50 border-teal-200" 
                          : "bg-white border-transparent hover:bg-gray-50 hover:border-gray-100"
                      )}
                    >
                      <div className="relative shrink-0">
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 flex items-center justify-center">
                          {photo ? (
                            <img 
                              src={getThumbnail(photo)} 
                              alt="" 
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                                (e.target as HTMLImageElement).parentElement?.classList.add('bg-teal-50');
                              }}
                            />
                          ) : (
                            <User className="w-5 h-5 text-gray-300" />
                          )}
                        </div>
                        {isSelected && (
                          <motion.div 
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute -right-1 -bottom-1 w-4 h-4 bg-teal-600 rounded-full flex items-center justify-center border border-white shadow-sm"
                          >
                            <Check className="w-2.5 h-2.5 text-white stroke-[3px]" />
                          </motion.div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-bold text-gray-900 truncate leading-tight group-hover:text-teal-700 transition-colors">
                          {emp[nameKey]}
                        </div>
                        <div className="text-[10px] text-gray-500 truncate">
                          {emp[designationKey]}
                        </div>
                        <div className="mt-0.5">
                          <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono font-bold">
                            {id}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              ) : (
                <div className="py-10 flex flex-col items-center justify-center text-gray-400 text-center">
                  <Search className="w-6 h-6 opacity-20 mb-2" />
                  <p className="text-[11px] font-medium">No results found</p>
                </div>
              )}
            </div>

            {/* Sticky Footer */}
            <div className="p-1.5 border-t border-gray-100 bg-white">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between px-1">
                  <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                    Selection
                  </div>
                  <div className="text-[10px] font-bold text-teal-600">
                    {selectedIds.size} selected
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={onClose}
                    className="px-2 py-1.5 text-[10px] font-bold text-gray-500 hover:text-gray-900 border border-gray-100 bg-white rounded transition-all uppercase"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className={cn(
                      "flex items-center justify-center px-2 py-1.5 rounded text-[10px] font-bold text-white transition-all uppercase tracking-wider",
                      !isSaving
                        ? "bg-teal-600 hover:bg-teal-700 active:scale-[0.98]"
                        : "bg-gray-200 text-gray-400 cursor-not-allowed shadow-none"
                    )}
                  >
                    {isSaving ? "Updating..." : "Update List"}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
