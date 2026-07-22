import React, { useState, useEffect, useMemo, useRef } from "react";
import { X, Save, Loader2, ChevronDown, ChevronUp, Upload, Pencil, Trash2, Smartphone, Phone, Camera, User, Tag, Hash, Mail, Users, Briefcase, Layers } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn, compressImage, getDbOverridesHeaders } from "../lib/utils";
import axios from "axios";
import { FOLDER_LOCATIONS } from "../FolderLocation";

interface EmployeePanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  onDelete: (row: any) => Promise<void>;
  initialData?: any;
  defaultData?: any;
  headers: string[];
  onDirtyChange?: (isDirty: boolean) => void;
  allData?: any[];
}

interface FloatingInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  isDark?: boolean;
}

function MultiSelectDropdown({ 
  label, 
  value, 
  onChange, 
  options,
  disabled,
  isDark
}: { 
  label: string; 
  value: string[]; 
  onChange: (val: string[]) => void; 
  options: string[];
  disabled?: boolean;
  isDark?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return options.filter(opt => opt.toLowerCase().includes(term));
  }, [options, searchTerm]);

  const toggleOption = (opt: string) => {
    if (value.includes(opt)) {
      onChange(value.filter(v => v !== opt));
    } else {
      onChange([...value, opt]);
    }
  };

  const removeOption = (opt: string) => {
    onChange(value.filter(v => v !== opt));
  };

  return (
    <div className="space-y-1 relative" ref={dropdownRef}>
      <label className={cn(
        "text-[10px] ml-1 transition-colors", 
        isDark ? "text-slate-500" : "text-gray-400",
        disabled && "opacity-50"
      )}>
        {label}
      </label>
      <div className="relative">
        <div
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={cn(
            "w-full border rounded px-3 py-1.5 text-xs transition-all pr-8 min-h-[32px] flex flex-wrap gap-1 items-center cursor-pointer", 
            isDark 
              ? "bg-white/40 border-teal-600/20 text-teal-950 focus-within:bg-white/60 focus-within:border-teal-600/20" 
              : "bg-white border-gray-200 text-gray-800 focus-within:border-gray-200",
            disabled && (isDark ? "opacity-40 bg-white/10 cursor-not-allowed" : "cursor-not-allowed bg-gray-50 text-gray-500"),
            isOpen && "border-teal-500 ring-1 ring-teal-500/20"
          )}
        >
          {value.length > 0 ? (
            value.map(v => (
              <span key={v} className="bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-md flex items-center gap-1 text-[9px] font-bold border border-teal-200/50">
                {v}
                {!disabled && (
                  <X 
                    className="w-2.5 h-2.5 hover:text-teal-900 cursor-pointer" 
                    onClick={(e) => {
                      e.stopPropagation();
                      removeOption(v);
                    }}
                  />
                )}
              </span>
            ))
          ) : (
            <span className="text-gray-400">Select...</span>
          )}
          <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
            <ChevronDown className={cn("w-3 h-3 transition-transform text-gray-400", isOpen && "rotate-180")} />
          </div>
        </div>
        
        <AnimatePresence>
          {isOpen && !disabled && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              className="absolute left-0 right-0 bottom-full mb-1 bg-white border border-gray-200 rounded shadow-xl z-[60] max-h-48 overflow-y-auto no-scrollbar"
            >
              <div className="p-2 sticky top-0 bg-white border-b border-gray-100">
                <input
                  type="text"
                  autoFocus
                  placeholder="Filter options..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && searchTerm && !options.includes(searchTerm)) {
                      e.preventDefault();
                      toggleOption(searchTerm);
                      setSearchTerm("");
                    }
                  }}
                  className="w-full text-[10px] px-2 py-1.5 border border-gray-100 rounded outline-none focus:border-teal-500 transition-colors"
                />
              </div>
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => toggleOption(opt)}
                    className={cn(
                      "w-full text-left px-3 py-2 text-[11px] hover:bg-teal-50 transition-colors border-b border-gray-50 last:border-0 flex items-center justify-between",
                      value.includes(opt) ? "bg-teal-50/30 text-teal-700 font-medium" : "text-gray-700"
                    )}
                  >
                    <span>{opt}</span>
                    {value.includes(opt) && <div className="w-1.5 h-1.5 rounded-full bg-teal-500" />}
                  </button>
                ))
              ) : (
                <div className="px-3 py-3 text-[10px] text-gray-400 italic text-center">
                  {searchTerm ? `Press Enter to add "${searchTerm}"` : "No existing options found"}
                </div>
              )}
              
              {searchTerm && !options.includes(searchTerm) && (
                <button
                  type="button"
                  onClick={() => {
                    toggleOption(searchTerm);
                    setSearchTerm("");
                  }}
                  className="w-full text-left px-3 py-2 text-[10px] text-teal-600 font-bold bg-teal-50/50 uppercase italic hover:bg-teal-100 transition-colors border-t border-teal-100"
                >
                  <div className="flex items-center justify-between">
                    <span>Add new: "{searchTerm}"</span>
                    <Save className="w-3 h-3" />
                  </div>
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function SearchableDropdown({ 
  label, 
  value, 
  onChange, 
  options,
  disabled,
  isDark
}: { 
  label: string; 
  value: string; 
  onChange: (val: string) => void; 
  options: string[];
  disabled?: boolean;
  isDark?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const filteredOptions = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return options.filter(opt => opt.toLowerCase().includes(term));
  }, [options, searchTerm]);

  return (
    <div className="space-y-1 relative">
      <label className={cn(
        "text-[10px] ml-1 transition-colors", 
        isDark ? "text-slate-500" : "text-gray-400",
        disabled && "opacity-50"
      )}>
        {label}
      </label>
      <div className="relative">
        <input
          type="text"
          disabled={disabled}
          value={isFocused ? searchTerm : value}
          placeholder={isFocused ? "Search or type new..." : (value || "Select...")}
          onFocus={() => {
            if (disabled) return;
            setIsFocused(true);
            setIsOpen(true);
            setSearchTerm(value);
          }}
          onBlur={() => {
            // Delay to allow clicking options
            setTimeout(() => {
              setIsFocused(false);
              setIsOpen(false);
            }, 200);
          }}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            onChange(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (searchTerm) {
                onChange(searchTerm);
                setIsOpen(false);
                setIsFocused(false);
              }
            }
          }}
          className={cn(
            "w-full border rounded px-3 py-1.5 text-xs transition-all pr-8 outline-none", 
            isDark 
              ? "bg-white/40 border-teal-600/20 text-teal-950 placeholder:text-teal-800/40 focus:bg-white/60 focus:border-teal-600/20" 
              : "bg-white border-gray-200 text-gray-800 focus:border-gray-200",
            disabled && (isDark ? "opacity-40 bg-white/10 cursor-not-allowed" : "cursor-not-allowed bg-gray-50 text-gray-500")
          )}
        />
        <div 
          className={cn(
            "absolute right-0 top-0 bottom-0 px-2 flex items-center transition-colors", 
            isDark ? "text-teal-800 hover:text-teal-950" : "text-gray-400 hover:text-gray-600",
            disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
          )}
          onClick={() => !disabled && setIsOpen(!isOpen)}
        >
          <ChevronDown className={cn("w-3 h-3 transition-transform", isOpen && "rotate-180")} />
        </div>
        
        <AnimatePresence>
          {isOpen && !disabled && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded shadow-xl z-[60] max-h-48 overflow-y-auto no-scrollbar"
            >
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onChange(opt);
                      setSearchTerm(opt);
                      setIsOpen(false);
                      setIsFocused(false);
                    }}
                    className="w-full text-left px-3 py-2.5 text-xs text-gray-700 hover:bg-teal-50 hover:text-teal-700 transition-colors border-b border-gray-50 last:border-0 flex items-center justify-between"
                  >
                    <span>{opt}</span>
                    {value === opt && <div className="w-1.5 h-1.5 rounded-full bg-teal-500" />}
                  </button>
                ))
              ) : (
                <div className="px-3 py-3 text-[10px] text-gray-400 italic text-center">
                  {searchTerm ? `Press Enter to add "${searchTerm}"` : "No existing options found"}
                </div>
              )}
              
              {searchTerm && !options.includes(searchTerm) && (
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onChange(searchTerm);
                    setIsOpen(false);
                    setIsFocused(false);
                  }}
                  className="w-full text-left px-3 py-2.5 text-[10px] text-teal-600 font-bold bg-teal-50/50 uppercase italic hover:bg-teal-100 transition-colors border-t border-teal-100"
                >
                  <div className="flex items-center justify-between">
                    <span>Add new: "{searchTerm}"</span>
                    <Save className="w-3 h-3" />
                  </div>
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function FloatingInput({ label, value, onChange, disabled, required, isDark }: FloatingInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  
  return (
    <div className="relative">
      <motion.label
        initial={false}
        animate={{
          top: (isFocused || value) ? -6 : 10,
          left: (isFocused || value) ? 8 : 12,
          fontSize: (isFocused || value) ? 9 : 11,
          color: isFocused 
            ? (isDark ? "#0f172a" : "#0d9488") 
            : (value ? (isDark ? "#0f172a" : "#9ca3af") : (isDark ? "#475569" : "#d1d5db")),
          backgroundColor: (isFocused || value) 
            ? (isDark ? "#99d5d5" : "#ffffff") 
            : "transparent",
          paddingLeft: (isFocused || value) ? 4 : 0,
          paddingRight: (isFocused || value) ? 4 : 0,
        }}
        className={cn(
          "absolute pointer-events-none z-10 transition-colors",
          disabled && "opacity-50"
        )}
      >
        {label}
      </motion.label>
      <input
        type="text"
        required={required}
        disabled={disabled}
        value={value}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-full border rounded px-3 py-2 text-xs transition-all outline-none",
          isDark 
            ? "bg-white/40 border-teal-600/20 text-teal-950 focus:bg-white/60 focus:border-teal-600/20" 
            : "bg-white border-gray-200 text-gray-800 focus:border-gray-200",
          disabled && (isDark ? "opacity-40 bg-white/10 cursor-not-allowed" : "cursor-not-allowed bg-gray-50 text-gray-500")
        )}
      />
    </div>
  );
}

function PhotoUploadInput({ 
  value, 
  onChange, 
  disabled, 
  isDark,
  employeeName,
  employeeId,
  onFileSelect
}: { 
  value: string, 
  onChange: (val: string) => void, 
  disabled?: boolean, 
  isDark?: boolean,
  employeeName?: string,
  employeeId?: string,
  onFileSelect?: (file: File | null, localUrl?: string) => void
}) {
  const [imgError, setImgError] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canUpload = !!(employeeName?.trim() && employeeId?.trim());

  const getDisplayUrl = (url: any) => {
    if (localPreview) return localPreview;
    if (!url || typeof url !== 'string') return "";
    if (url.includes('drive.google.com/thumbnail') || url.startsWith('data:') || url.startsWith('blob:')) return url;
    
    const fileIdMatch = url.match(/[-\w]{25,}/);
    if (fileIdMatch && url.includes('drive.google.com')) {
      return `https://drive.google.com/thumbnail?id=${fileIdMatch[0]}&sz=w1000`;
    }
    return url;
  };

  const displayUrl = getDisplayUrl(value);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Instant local preview for perceived speed
    const objectUrl = URL.createObjectURL(file);
    setLocalPreview(objectUrl);
    
    // Compress immediately in background
    try {
      const compressed = await compressImage(file);
      if (onFileSelect) onFileSelect(compressed, objectUrl);
    } catch (err) {
      console.error("Compression failed:", err);
      if (onFileSelect) onFileSelect(file, objectUrl);
    }
    
    // Reset file input so same file can be picked again
    e.target.value = '';
  };

  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);

  useEffect(() => {
    setImgError(false);
  }, [value]);

  const handleUploadClick = () => {
    if (!canUpload) {
      alert("Please enter Employee Name and Employee ID first.");
      return;
    }
    fileInputRef.current?.click();
  };

  return (
    <div className="relative group w-24 h-24 mx-auto mb-4">
      <div className={cn(
        "w-full h-full rounded-2xl overflow-hidden bg-teal-50 flex items-center justify-center relative transition-all",
        !disabled && "border-2 border-teal-100 shadow-sm group-hover:border-teal-300"
      )}>
        {displayUrl && !imgError ? (
          <img 
            src={displayUrl} 
            alt="Profile" 
            className="w-full h-full object-cover" 
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
          />
        ) : (
          <User className="w-10 h-10 text-teal-200" />
        )}
      </div>
      {!disabled && (
        <button
          type="button"
          onClick={handleUploadClick}
          disabled={!canUpload}
          className={cn(
            "absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center rounded-2xl text-white gap-1",
            !canUpload && "cursor-not-allowed opacity-50 bg-black/60"
          )}
        >
          <Camera className="w-5 h-5" />
          <span className="text-[8px] font-bold uppercase">{canUpload ? "Change" : "Name/ID Required"}</span>
        </button>
      )}
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
    </div>
  );
}

export default function EmployeePanel({ 
  isOpen, 
  onClose, 
  onSave, 
  onDelete, 
  initialData, 
  defaultData,
  headers, 
  onDirtyChange, 
  allData = [] 
}: EmployeePanelProps) {
  const [formData, setFormData] = useState<any>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(!initialData);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingFileUrl, setPendingFileUrl] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInputId, setDeleteInputId] = useState("");

  const idKey = useMemo(() => {
    return headers.find(h => {
      const cleaned = h.toLowerCase().trim();
      return cleaned === "id" || cleaned === "employee id" || cleaned === "employee-id" || cleaned === "emp id";
    }) || "Employee ID";
  }, [headers]);

  const handleDeleteClick = async () => {
    const actualId = String(initialData?.[idKey] || "");
    if (deleteInputId !== actualId) return;

    try {
      setIsSubmitting(true);
      await onDelete(initialData!);
      setShowDeleteConfirm(false);
      setDeleteInputId("");
      onClose();
    } catch (error) {
      console.error("Delete failed:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setShowDeleteConfirm(false);
      setDeleteInputId("");
    }
  }, [isOpen, initialData]);



  const idOptions = useMemo(() => {
    const idKey = headers.find(h => h.toLowerCase() === "id" || h.toLowerCase() === "employee id") || "Employee ID";
    const opts = new Set<string>();
    allData.forEach(row => {
      const val = row[idKey];
      if (val) opts.add(String(val));
    });
    return Array.from(opts).sort();
  }, [allData, headers]);

  const tagOptions = useMemo(() => {
    const opts = new Set<string>();
    allData.forEach(row => {
      const val = row["Tag"];
      if (val) {
        if (typeof val === 'string') {
          val.split(',').forEach(t => {
            const trimmed = t.trim();
            if (trimmed) opts.add(trimmed);
          });
        } else {
          opts.add(String(val));
        }
      }
    });
    return Array.from(opts).sort();
  }, [allData]);

  const designationOptions = useMemo(() => {
    const opts = new Set<string>();
    allData.forEach(row => {
      const val = row["Designation"] || row["Administrative Designation"] || row["Administrative"];
      if (val) opts.add(String(val));
    });
    return Array.from(opts).sort();
  }, [allData]);

  const departmentOptions = useMemo(() => {
    const opts = new Set<string>();
    allData.forEach(row => {
      const val = row["Department"];
      if (val) opts.add(String(val));
    });
    return Array.from(opts).sort();
  }, [allData]);

  const statusOptions = useMemo(() => {
    const opts = new Set<string>();
    allData.forEach(row => {
      const val = row["Status"];
      if (val) opts.add(String(val));
    });
    return Array.from(opts).sort();
  }, [allData]);

  const groupOptions = useMemo(() => {
    const opts = new Set<string>();
    allData.forEach(row => {
      const val = row["Group Name"];
      if (val) opts.add(String(val));
    });
    return Array.from(opts).sort();
  }, [allData]);

  useEffect(() => {
    if (isOpen) {
      const data = initialData ? { ...initialData } : (defaultData ? { ...defaultData } : {});
      
      // Fields to handle as arrays for multi-select
      const multiFields = ["Department", "Group Name", "Status", "Designation", "Administrative Designation", "Tag"];
      multiFields.forEach(field => {
        if (data[field]) {
          if (typeof data[field] === 'string') {
            data[field] = data[field].split(',').map((s: string) => s.trim()).filter(Boolean);
          }
        } else {
          data[field] = [];
        }
      });

      setFormData(data);
      setIsEditing(!initialData);
      if (onDirtyChange) onDirtyChange(false);
    }
  }, [initialData, onDirtyChange, isOpen]);

  useEffect(() => {
    if (onDirtyChange && isOpen) {
      const initial = initialData || {};
      const isDirty = headers.some(header => {
        const currentVal = formData[header];
        const initialVal = initial[header];

        // Handle array comparison for multi-select fields
        if (Array.isArray(currentVal)) {
          const currentStr = [...currentVal].sort().join(', ');
          const initialStr = typeof initialVal === 'string' 
            ? initialVal.split(',').map((s: string) => s.trim()).filter(Boolean).sort().join(', ')
            : "";
          return currentStr !== initialStr;
        }

        return String(currentVal || "") !== String(initialVal || "");
      });
      onDirtyChange(isDirty);
    }
  }, [formData, initialData, headers, onDirtyChange, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    let finalFormData = { ...formData };
    
    // Convert arrays back to comma-separated strings for storage
    const multiFields = ["Department", "Group Name", "Status", "Designation", "Administrative Designation", "Tag"];
    multiFields.forEach(field => {
      if (Array.isArray(finalFormData[field])) {
        finalFormData[field] = finalFormData[field].join(', ');
      }
    });

    const photoKey = headers.find(h => h.toLowerCase().includes("photo")) || "Photo";
    if (pendingFile && pendingFileUrl) {
       finalFormData[photoKey] = pendingFileUrl;
       setFormData(finalFormData); // Optimistic UI update
    }

    // Immediately exit edit mode or close panel for instant perceived performance
    if (initialData) {
      setIsEditing(false);
    } else {
      onClose();
    }
    if (onDirtyChange) onDirtyChange(false);
    
    // Background save process
    (async () => {
      try {
        if (pendingFile) {
          const nameKey = headers.find(h => h.toLowerCase().includes("name")) || "Name";
          const idKey = headers.find(h => h.toLowerCase() === "id" || h.toLowerCase() === "employee id") || "ID";
          
          const employeeName = String(formData[nameKey] || "Employee");
          const employeeId = String(formData[idKey] || "ID");
          const extension = pendingFile.name.split('.').pop();
          const customName = `${employeeId}-${employeeName}${extension ? '.' + extension : ''}`;
          
          const uploadForm = new FormData();
          // The file is already compressed by PhotoUploadInput
          uploadForm.append("file", pendingFile, customName);
          uploadForm.append("folderPath", FOLDER_LOCATIONS.EMPLOYEES_PHOTO);
          
          const uploadRes = await axios.post("/api/upload", uploadForm, {
            headers: { 
              "Content-Type": "multipart/form-data",
              ...getDbOverridesHeaders()
            }
          });
          
          finalFormData[photoKey] = uploadRes.data.url;
        }

        await onSave(finalFormData);
      } catch (error: any) {
        console.error("Save failed:", error);
      } finally {
        setIsSubmitting(false);
        setPendingFile(null);
        setPendingFileUrl(null);
      }
    })();
  };

  const handleIdChange = (key: string, id: string) => {
    const idKey = headers.find(h => h.toLowerCase() === "id" || h.toLowerCase() === "employee id") || "Employee ID";
    
    // Check if ID exists in allData
    const existingEmployee = allData.find(emp => String(emp[idKey]) === id);
    
    if (existingEmployee) {
      // Auto-fill existing data
      const data = { ...existingEmployee };
      
      // Fields to handle as arrays for multi-select
      const multiFields = ["Department", "Group Name", "Status", "Designation", "Administrative Designation", "Tag"];
      multiFields.forEach(field => {
        if (data[field]) {
          if (typeof data[field] === 'string') {
            data[field] = data[field].split(',').map((s: string) => s.trim()).filter(Boolean);
          }
        } else {
          data[field] = [];
        }
      });

      // Special case: If we are adding to MC Representatives, ensure it's in the tags
      if (defaultData && defaultData.Tag) {
        const defaultTags = Array.isArray(defaultData.Tag) ? defaultData.Tag : [defaultData.Tag];
        const currentTags = Array.isArray(data.Tag) ? data.Tag : [];
        const mergedTags = Array.from(new Set([...currentTags, ...defaultTags]));
        data.Tag = mergedTags;
      }

      setFormData(data);
    } else {
      // New employee with this ID
      setFormData(prev => ({ ...prev, [key]: id }));
    }
  };

  const handleChange = (key: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [key]: value }));
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: "100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="absolute top-0 right-0 bottom-0 w-80 bg-white shadow-2xl flex flex-col z-40"
        >
          <div className="flex items-center justify-between p-2.5 bg-gradient-to-r from-teal-600 to-teal-500">
            <h3 className="text-[11px] font-bold text-white uppercase tracking-widest">
              {initialData ? (isEditing ? "Edit Employee" : "View Employee") : "Add New Employee"}
            </h3>
            <div className="flex items-center gap-1">
              {initialData && !isEditing && (
                <>
                  <button onClick={() => setIsEditing(true)} className="text-teal-100 hover:text-white transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setShowDeleteConfirm(true)} 
                    className="text-teal-100 hover:text-white transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
              <button onClick={onClose} className="text-teal-100 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {showDeleteConfirm && (
            <div className="absolute inset-0 z-50 bg-teal-900/95 backdrop-blur-sm flex items-center justify-center p-6 text-center">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white rounded-2xl p-6 shadow-2xl max-w-xs w-full space-y-4"
              >
                <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto">
                  <Trash2 className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Confirm Deletion</h3>
                  <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                    Please type the Employee ID to confirm: <br/>
                    <span className="font-mono font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded border border-teal-100 inline-block mt-1">
                      {String(initialData?.[idKey] || "")}
                    </span>
                  </p>
                </div>
                <input
                  type="text"
                  value={deleteInputId}
                  onChange={(e) => setDeleteInputId(e.target.value)}
                  placeholder="Enter ID"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-center font-mono focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteInputId("");
                    }}
                    className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={deleteInputId !== String(initialData?.[idKey] || "") || isSubmitting}
                    onClick={handleDeleteClick}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors shadow-lg shadow-red-500/20 flex items-center justify-center gap-2"
                  >
                    {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    Delete
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
            <div className={cn("flex-1 overflow-y-auto no-scrollbar pb-24", isEditing ? "p-2.5 pt-3 space-y-5" : "p-4 pt-6 space-y-5")}>
              {initialData && !isEditing && (() => {
                const nameKey = headers.find(h => h.toLowerCase().includes("name")) || "Name";
                const designationKey = headers.find(h => h.toLowerCase().includes("designation")) || "Designation";
                const photoKey = headers.find(h => h.toLowerCase().includes("photo")) || "Photo";
                const mobileKey = headers.find(h => h.toLowerCase().includes("mobile")) || "Mobile";
                const ipExtKey = headers.find(h => h.toLowerCase().includes("ip-ext") || h.toLowerCase().includes("extension")) || "IP-Ext";
                const statusKey = headers.find(h => h.toLowerCase() === "status") || "Status";
                const statusValue = String(formData[statusKey] || "");
                
                return (
                  <div className="mb-8 text-center relative">
                    <PhotoUploadInput
                      value={String(formData[photoKey] || "")}
                      onChange={(val) => handleChange(photoKey, val)}
                      disabled={!isEditing}
                      onFileSelect={(file, url) => { setPendingFile(file); if (url) setPendingFileUrl(url); }}
                    />
                    <div className="space-y-1">
                      <h4 className="text-lg font-bold text-gray-900">{formData[nameKey] || "N/A"}</h4>
                      <p className="text-[11px] font-medium text-teal-600 uppercase tracking-wide">
                        {(() => {
                          const val = formData["Designation"] || formData["Administrative Designation"] || formData[designationKey];
                          return Array.isArray(val) ? val.join(", ") : (val || "No Designation");
                        })()}
                      </p>
                      <div className="mt-2 flex items-center justify-between px-2 py-1">
                        <div className="flex items-center gap-2">
                          <Smartphone className="w-3.5 h-3.5 text-teal-600" />
                          <span className="text-[11px] font-bold text-gray-700">{formData[mobileKey] || "N/A"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-teal-600" />
                          <span className="text-[11px] font-bold text-gray-700">{formData[ipExtKey] || "N/A"}</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 border-b border-teal-50" />
                  </div>
                );
              })()}

              {(() => {
                const renderedHeaders = new Set<string>();
                const viewElements: React.ReactNode[] = [];
                const editElements: React.ReactNode[] = [];

                if (initialData) {
                  const nameKey = headers.find(h => h.toLowerCase().includes("name")) || "Name";
                  const photoKey = headers.find(h => h.toLowerCase().includes("photo")) || "Photo";
                  const statusKey = headers.find(h => h.toLowerCase() === "status") || "Status";
                  const mobileKey = headers.find(h => h.toLowerCase().includes("mobile")) || "Mobile";
                  const ipExtKey = headers.find(h => h.toLowerCase().includes("ip-ext") || h.toLowerCase().includes("extension")) || "IP-Ext";
                  
                  renderedHeaders.add(photoKey);
                  renderedHeaders.add(nameKey);
                  
                  if (!isEditing) {
                    renderedHeaders.add(statusKey);
                    renderedHeaders.add(mobileKey);
                    renderedHeaders.add(ipExtKey);
                  }
                }

                // Photo and Name fields for edit mode
                if (isEditing) {
                  const nameKey = headers.find(h => h.toLowerCase().includes("name")) || "Name";
                  const idKey = headers.find(h => h.toLowerCase() === "id" || h.toLowerCase() === "employee id") || "ID";
                  const photoKey = headers.find(h => h.toLowerCase().includes("photo")) || "Photo";
                  
                  renderedHeaders.add(photoKey);
                  renderedHeaders.add(nameKey);
                  
                  const employeeName = String(formData[nameKey] || "");
                  const employeeId = String(formData[idKey] || "");
                  
                  // Add centered photo preview at the top
                  editElements.push(
                    <div key="photo-preview-section" className="text-center">
                      <PhotoUploadInput
                        value={String(formData[photoKey] || "")}
                        onChange={(val) => handleChange(photoKey, val)}
                        disabled={!isEditing}
                        employeeName={employeeName}
                        employeeId={employeeId}
                        onFileSelect={(file, url) => { setPendingFile(file); if (url) setPendingFileUrl(url); }}
                      />
                    </div>
                  );

                  editElements.push(
                    <div key="name-form-section">
                      <FloatingInput
                        label="Employee Name"
                        value={String(formData[nameKey] || "")}
                        onChange={(val) => handleChange(nameKey, val)}
                        isDark
                      />
                    </div>
                  );
                }

                // Helper for view mode stacked with icons
                const renderViewItem = (header: string) => {
                  let displayHeader = header;
                  if (header === "Administrative Designation" || header === "Designation") displayHeader = "Designation";
                  if (header === "Email") displayHeader = "E-mail";

                  // Select icon based on header
                  const h = header.toLowerCase();
                  let Icon = Tag;
                  if (h.includes("id")) Icon = Hash;
                  if (h.includes("mail")) Icon = Mail;
                  if (h.includes("group")) Icon = Users;
                  if (h.includes("department")) Icon = Briefcase;
                  if (h.includes("status")) Icon = Layers;

                  return (
                    <div key={header} className="py-2.5">
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="w-3 h-3 text-teal-600" />
                        <span className="text-[11px] font-bold text-gray-900 tracking-tight">{displayHeader}</span>
                      </div>
                      <span className="text-[12px] font-normal text-gray-600 break-words pl-5 block">
                        {Array.isArray(formData[header]) 
                          ? formData[header].join(", ") 
                          : String(formData[header] || "N/A")}
                      </span>
                    </div>
                  );
                };

                // Prepare elements
                headers.forEach((header) => {
                  if (renderedHeaders.has(header)) return;

                  // View mode
                  if (initialData && !isEditing) {
                    // Skip designations in view mode as requested
                    const isDesignation = header.toLowerCase().includes("designation");
                    if (!isDesignation) {
                      viewElements.push(renderViewItem(header));
                    }
                  }

                  // Group Mobile and IP-Ext side by side in edit mode
                  const isMobile = header.toLowerCase().includes("mobile");
                  const isIpExt = header.toLowerCase().includes("ip-ext") || header.toLowerCase().includes("extension");

                  if (isEditing && (isMobile || isIpExt)) {
                    if (renderedHeaders.has("mobile-group")) return;
                    renderedHeaders.add("mobile-group");
                    
                    const mobileKey = headers.find(h => h.toLowerCase().includes("mobile")) || "Mobile";
                    const ipExtKey = headers.find(h => h.toLowerCase().includes("ip-ext") || h.toLowerCase().includes("extension")) || "IP-Ext";
                    
                    renderedHeaders.add(mobileKey);
                    renderedHeaders.add(ipExtKey);

                    editElements.push(
                      <div className="grid grid-cols-12 gap-4" key="mobile-ip-group">
                        <div className="col-span-8">
                          <FloatingInput
                            label="Mobile"
                            value={String(formData[mobileKey] || "")}
                            onChange={(val) => handleChange(mobileKey, val)}
                            disabled={!isEditing}
                            isDark
                          />
                        </div>
                        <div className="col-span-4">
                          <FloatingInput
                            label="IP-Ext"
                            value={String(formData[ipExtKey] || "")}
                            onChange={(val) => handleChange(ipExtKey, val)}
                            disabled={!isEditing}
                            isDark
                          />
                        </div>
                      </div>
                    );
                    return;
                  }

                  // Edit mode logic
                  if (!isEditing) return;

                  if (header === "Status" && headers.includes("Group Name")) {
                    renderedHeaders.add("Status");
                    renderedHeaders.add("Group Name");
                    editElements.push(
                      <div className="grid grid-cols-2 gap-3" key="status-group-section">
                        <MultiSelectDropdown
                          label="Status"
                          value={Array.isArray(formData["Status"]) ? formData["Status"] : []}
                          onChange={(val) => handleChange("Status", val)}
                          options={statusOptions}
                          disabled={!isEditing}
                          isDark
                        />
                        <MultiSelectDropdown
                          label="Group Name"
                          value={Array.isArray(formData["Group Name"]) ? formData["Group Name"] : []}
                          onChange={(val) => handleChange("Group Name", val)}
                          options={groupOptions}
                          disabled={!isEditing}
                          isDark
                        />
                      </div>
                    );
                  } else if (header === "Administrative" || header === "Administrative Designation" || header === "Designation") {
                    const key = headers.includes("Designation") ? "Designation" : (headers.includes("Administrative Designation") ? "Administrative Designation" : "Administrative");
                    if (renderedHeaders.has(key)) return;
                    
                    renderedHeaders.add("Designation");
                    renderedHeaders.add("Administrative Designation");
                    renderedHeaders.add("Administrative");
                    
                    editElements.push(
                      <div key={key}>
                        <MultiSelectDropdown
                          label="Designation"
                          value={Array.isArray(formData[key]) ? formData[key] : []}
                          onChange={(val) => handleChange(key, val)}
                          options={designationOptions}
                          disabled={!isEditing}
                          isDark
                        />
                      </div>
                    );
                  } else if (header === "Academic" || header === "Academic Designation") {
                    // Removed Academic Designation
                    renderedHeaders.add(header);
                  } else if (header === "Department") {
                    renderedHeaders.add("Department");
                    editElements.push(
                      <div key="Department">
                        <MultiSelectDropdown
                          label="Department"
                          value={Array.isArray(formData["Department"]) ? formData["Department"] : []}
                          onChange={(val) => handleChange("Department", val)}
                          options={departmentOptions}
                          disabled={!isEditing}
                          isDark
                        />
                      </div>
                    );
                  } else if (header === "Tag") {
                    renderedHeaders.add("Tag");
                    editElements.push(
                      <div key="Tag">
                        <MultiSelectDropdown
                          label="Tag"
                          value={Array.isArray(formData["Tag"]) ? formData["Tag"] : []}
                          onChange={(val) => handleChange("Tag", val)}
                          options={tagOptions}
                          disabled={!isEditing}
                          isDark
                        />
                      </div>
                    );
                  } else {
                    // Hide Employee ID in edit form as requested, but keep it for New Employee
                    const isIdField = header.toLowerCase() === "id" || header.toLowerCase() === "employee id";
                    if (isEditing && isIdField && initialData) return;

                    renderedHeaders.add(header);
                    editElements.push(
                      <div key={header}>
                        {isIdField && !initialData ? (
                          <SearchableDropdown
                            label={header}
                            value={String(formData[header] || "")}
                            onChange={(val) => handleIdChange(header, val)}
                            options={idOptions}
                            disabled={!isEditing}
                            isDark
                          />
                        ) : (
                          <FloatingInput
                            label={header}
                            value={String(formData[header] || "")}
                            onChange={(val) => handleChange(header, val)}
                            required={isIdField}
                            disabled={!isEditing}
                            isDark
                          />
                        )}
                      </div>
                    );
                  }
                });

                return (
                  <AnimatePresence mode="wait">
                    {initialData && !isEditing ? (
                      <motion.div
                        key="view"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-0.5"
                      >
                        {viewElements}
                      </motion.div>
                    ) : (
                      <motion.div
                        key="edit"
                        initial={initialData ? { height: 0, opacity: 0 } : { opacity: 1 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="space-y-3.5 p-2 bg-[#99d5d5] rounded-xl shadow-[inset_0_2px_8px_rgba(0,0,0,0.1)] border border-[#7fbdbd]/30 overflow-hidden"
                      >
                        {editElements}
                      </motion.div>
                    )}
                  </AnimatePresence>
                );
              })()}
            </div>

            {isEditing && (
              <div className="p-1.5 border-t border-gray-100 bg-white grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (initialData) {
                      setIsEditing(false);
                      setFormData({ ...initialData });
                    } else {
                      onClose();
                    }
                  }}
                  className="px-2 py-1.5 text-[10px] font-bold text-gray-500 hover:text-gray-900 border border-gray-100 bg-white rounded transition-all uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center justify-center gap-2 px-2 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-[10px] font-bold rounded shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Save className="w-3 h-3" />
                  )}
                  {initialData ? "Update" : "Save"}
                </button>
              </div>
            )}
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
