import React, { useState, useEffect, useRef, useMemo } from "react";
import { X, Save, Loader2, Camera, Image as ImageIcon, Workflow, Info, Calculator, GripVertical, Briefcase, Layers, Plus } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import EmployeeMultiSelect from "./EmployeeMultiSelect";
import SearchableSingleSelect from "./SearchableSingleSelect";
import { resolveNamesOrIdsToIds, resolveIdsToNames, compressImage, getDbOverridesHeaders, cn, parseWorkflowAndStages, serializeWorkflowAndStages, getStageAssignment, parseWorkflowTitle, formatToMmmDdYyyy, isBatchRunning } from "../lib/utils";
import axios from "axios";
import { FOLDER_LOCATIONS } from "../FolderLocation";

export interface SideEditProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  initialData?: any;
  headers: string[];
  title: string;
  employees?: any[];
  workflowData?: any[];
  saveButtonLabel?: string;
  closeOnSave?: boolean;
  isNew?: boolean;
  allBatches?: any[];
  onSaveBatch?: (formData: any, editingRow: any | null) => Promise<void>;
}

export function FloatingInput({
  label,
  value,
  onChange,
  type = "text",
  prefix,
  placeholder = " ",
  className = "",
  ...props
}: {
  label: string;
  value: any;
  onChange: (e: any) => void;
  type?: string;
  prefix?: string;
  placeholder?: string;
  className?: string;
  [key: string]: any;
}) {
  const [isFocused, setIsFocused] = useState(false);
  const hasValue = value !== undefined && value !== null && String(value).trim() !== "";
  const isFloating = isFocused || hasValue || type === "date";

  return (
    <div className={`relative flex items-center ${className}`}>
      {prefix && (
        <span className="absolute left-3 text-xs font-semibold text-gray-500 pointer-events-none z-10">
          {prefix}
        </span>
      )}
      <input
        type={type}
        value={value === undefined || value === "—" ? "" : value}
        onChange={onChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        className={cn(
          "peer w-full pt-4 pb-1.5 text-xs border border-gray-200 rounded-lg focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none bg-white transition-all text-gray-800 font-medium",
          prefix ? "pl-7 pr-3" : "px-3"
        )}
        {...props}
      />
      <label
        className={cn(
          "absolute transition-all duration-200 pointer-events-none uppercase tracking-wider font-bold select-none",
          prefix ? "left-7" : "left-3",
          isFloating
            ? "top-1 text-[8.5px] text-teal-600 bg-white px-1 ml-[-4px] font-extrabold z-10"
            : "top-3 text-xs text-gray-400 font-normal"
        )}
      >
        {label}
      </label>
    </div>
  );
}

export default function SideEdit({ 
  isOpen, 
  onClose, 
  onSave, 
  initialData, 
  headers, 
  title, 
  employees = [], 
  workflowData = [], 
  saveButtonLabel = "Save", 
  closeOnSave = true, 
  isNew = false,
  allBatches,
  onSaveBatch
}: SideEditProps) {
  const [formData, setFormData] = useState<any>(initialData || {});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"info" | "batches" | "workflow" | "accounting">("info");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [localStages, setLocalStages] = useState<any[]>([]);
  const [draggedStageIndex, setDraggedStageIndex] = useState<number | null>(null);

  const [showAddBatch, setShowAddBatch] = useState(false);
  const [editingBatch, setEditingBatch] = useState<any | null>(null);
  const [newBatch, setNewBatch] = useState({
    "Batch Number": "",
    "Start Date": "",
    "End Date": "",
    "Student": "",
    "Instractor": ""
  });
  const [isSavingBatch, setIsSavingBatch] = useState(false);
  const [localCreatedBatches, setLocalCreatedBatches] = useState<any[]>([]);

  const currentCourseCode = formData["Course Code"] || "";
  const currentCourseTitle = formData["Course Title"] || "";
  
  const courseBatches = useMemo(() => {
    if (!currentCourseCode) return [];
    const fromProps = allBatches ? allBatches.filter(b => 
      (b['Course Code'] && String(b['Course Code']).trim().toLowerCase() === String(currentCourseCode).trim().toLowerCase()) ||
      (b['Course Name'] && String(b['Course Name']).trim().toLowerCase() === String(currentCourseTitle).trim().toLowerCase())
    ) : [];
    
    const merged = [...fromProps];
    localCreatedBatches.forEach(lb => {
      if (!merged.some(mb => mb["Batch Number"] === lb["Batch Number"])) {
        merged.push(lb);
      }
    });

    merged.sort((a, b) => {
      const getNum = (val: string) => {
        const m = String(val || '').match(/(\d+)/);
        return m ? parseInt(m[1], 10) : 0;
      };
      return getNum(a["Batch Number"]) - getNum(b["Batch Number"]);
    });

    return merged;
  }, [allBatches, currentCourseCode, currentCourseTitle, localCreatedBatches]);

  const getNextBatchNumber = () => {
    const maxBatchNum = courseBatches.reduce((max, b) => {
      const match = String(b['Batch Number'] || '').match(/Batch-(\d+)/) || String(b['Batch Number'] || '').match(/(\d+)/);
      const num = match ? parseInt(match[1], 10) : 0;
      return Math.max(max, num);
    }, 0);
    return `Batch-${String(maxBatchNum + 1).padStart(2, '0')}`;
  };

  const handleOpenAddBatch = () => {
    const nextNum = getNextBatchNumber();
    setNewBatch({
      "Batch Number": nextNum,
      "Start Date": "",
      "End Date": "",
      "Student": "",
      "Instractor": ""
    });
    setEditingBatch(null);
    setShowAddBatch(true);
  };

  const handleOpenEditBatch = (batch: any) => {
    const formatDateForInput = (val: any) => {
      if (!val) return "";
      // Handle timestamp / standard date string to get YYYY-MM-DD
      const d = new Date(val);
      if (isNaN(d.getTime())) return "";
      return d.toISOString().split('T')[0];
    };

    setNewBatch({
      "Batch Number": batch["Batch Number"] || "",
      "Start Date": formatDateForInput(batch["Start Date"]),
      "End Date": formatDateForInput(batch["End Date"]),
      "Student": batch["Student"] || "",
      "Instractor": batch["Instractor"] || batch["Instructor"] || ""
    });
    setEditingBatch(batch);
    setShowAddBatch(true);
  };

  const handleSaveBatchClick = async () => {
    if (!newBatch["Batch Number"]) {
      alert("Batch Number is required.");
      return;
    }
    if (!newBatch["Start Date"] || !newBatch["End Date"]) {
      alert("Start and End dates are required.");
      return;
    }
    
    setIsSavingBatch(true);
    try {
      const batchToSave = {
        ...newBatch,
        "Course Code": currentCourseCode,
        "Course Name": currentCourseTitle
      };
      
      if (onSaveBatch) {
        await onSaveBatch(batchToSave, editingBatch);
      } else {
        const payload = {
          action: editingBatch ? "UPDATE" : "ADD",
          gid: "1111164355", // default MC Batch GID
          data: batchToSave
        };
        await axios.post("/api/proxy", payload);
      }
      
      if (editingBatch) {
        setLocalCreatedBatches(prev => prev.map(lb => 
          lb["Batch Number"] === editingBatch["Batch Number"] ? batchToSave : lb
        ));
      } else {
        setLocalCreatedBatches(prev => [...prev, batchToSave]);
      }
      
      setShowAddBatch(false);
      setEditingBatch(null);
      setNewBatch({
        "Batch Number": "",
        "Start Date": "",
        "End Date": "",
        "Student": "",
        "Instractor": ""
      });
    } catch (err: any) {
      console.error("Failed to save batch:", err);
      alert("Error saving batch: " + (err.message || "Unknown error"));
    } finally {
      setIsSavingBatch(false);
    }
  };

  const courseWorkflow = formData["Workflow"] || formData["Publication Workflow"] || "";
  const { jobTitle, stageAssignments } = parseWorkflowAndStages(courseWorkflow);

  const getPhotoUrl = (emp: any) => {
    const photoKey = Object.keys(emp).find(k => k.toLowerCase().includes("photo") || k.toLowerCase() === "image");
    const rawUrl = photoKey ? emp[photoKey] : '';
    if (!rawUrl || typeof rawUrl !== 'string' || rawUrl.trim() === '') {
      return 'https://ui-avatars.com/api/?name=' + encodeURIComponent(emp['Employee Name'] || 'User');
    }
    const fileIdMatch = rawUrl.match(/[-\w]{25,}/);
    if (fileIdMatch && rawUrl.includes('drive.google.com')) {
      return `https://drive.google.com/thumbnail?id=${fileIdMatch[0]}&sz=w200`;
    }
    return rawUrl;
  };

  const parsedWorkflows = useMemo(() => {
    if (!Array.isArray(workflowData)) return [];
    return workflowData.map((row, idx) => {
      const idKey = Object.keys(row).find(h => {
        const cleaned = h.trim().toLowerCase();
        return cleaned === "workflow title" || cleaned === "title";
      }) || Object.keys(row)[0] || "Workflow Title";
      
      const rawText = String(row[idKey] || "");
      const rowId = row["ID"] || row["id"] || row["Workflow ID"] || `row-${idx}`;
      const structured = parseWorkflowTitle(rawText, String(rowId));
      return {
        id: structured.id,
        title: structured.title || rawText || "",
        stages: structured.stages || [],
        rawText
      };
    }).filter(item => item.title.trim() !== "");
  }, [workflowData]);

  const matchingWorkflow = parsedWorkflows.find(w => w.id === jobTitle || w.title.trim().toLowerCase() === jobTitle.trim().toLowerCase());
  const displayWorkflowTitle = matchingWorkflow ? matchingWorkflow.title : jobTitle;

  const handleWorkflowChange = (selectedTitle: string, headerKey: string = "Workflow") => {
    const found = parsedWorkflows.find(w => w.title.trim().toLowerCase() === selectedTitle.trim().toLowerCase());
    const saveId = found ? found.id : selectedTitle;
    const currentVal = formData[headerKey] || "";
    const parsed = parseWorkflowAndStages(currentVal);
    if (parsed.jobTitle !== saveId) {
      const serialized = serializeWorkflowAndStages(saveId, parsed.stageAssignments);
      handleChange("Workflow", serialized);
      handleChange("Publication Workflow", serialized);
    }
  };

  useEffect(() => {
    if (jobTitle) {
      const matchingWorkflow = parsedWorkflows.find(w => 
        w.id === jobTitle || w.title.trim().toLowerCase() === jobTitle.trim().toLowerCase()
      );
      
      if (matchingWorkflow && matchingWorkflow.stages.length > 0) {
        const mappedStages = matchingWorkflow.stages.map((stage, idx) => {
          let name = stage.stageName || "Unnamed Stage";
          if (!/^\d+\./.test(name)) {
            name = `${idx + 1}. ${name}`;
          }
          return {
            "ID": stage.id,
            "Job Title": matchingWorkflow.title,
            "Workflow Stage": name,
            "Key Responsibilities": stage.tasks.join(', '),
            "Deliverables": stage.deliverables.join(', ')
          };
        });
        setLocalStages(mappedStages);
      } else {
        setLocalStages([]);
      }
    } else {
      setLocalStages([]);
    }
  }, [jobTitle, parsedWorkflows]);

  const handleStageDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData("text/plain", index.toString());
    setDraggedStageIndex(index);
  };

  const handleStageDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleStageDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const sourceIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
    if (isNaN(sourceIndex) || sourceIndex === targetIndex) return;

    const newStages = [...localStages];
    const [movedStage] = newStages.splice(sourceIndex, 1);
    newStages.splice(targetIndex, 0, movedStage);
    setLocalStages(newStages);
    setDraggedStageIndex(null);

    // Update course's serialized workflow with the new order of stages
    const updatedAssignments: Record<string, string[]> = {};
    newStages.forEach(stg => {
      const originalName = stg["Workflow Stage"] || "Unnamed Stage";
      updatedAssignments[originalName] = getStageAssignment(stageAssignments, originalName);
    });

    const serialized = serializeWorkflowAndStages(jobTitle, updatedAssignments);
    setFormData((prev: any) => ({
      ...prev,
      'Workflow': serialized,
      'Publication Workflow': serialized
    }));
  };

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        if (isNew) {
           setFormData(prev => ({ ...prev, ...initialData }));
        } else {
           setFormData(initialData);
        }
      }
      setPendingFile(null);
      setLocalPreview(null);
    }
  }, [isOpen, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      let finalFormData = { ...formData };
      if (pendingFile) {
        const courseCode = String(formData["Course Code"] || "").trim();
        if (!courseCode) {
          alert("Course Code is required to upload the banner.");
          setIsSubmitting(false);
          return;
        }
        const extension = pendingFile.name.split('.').pop() || "jpg";
        const customName = `${courseCode}.${extension}`;

        const uploadForm = new FormData();
        uploadForm.append("file", pendingFile, customName);
        uploadForm.append("folderPath", FOLDER_LOCATIONS.BANNER);

        const uploadRes = await axios.post("/api/upload", uploadForm, {
          headers: { 
            "Content-Type": "multipart/form-data",
            ...getDbOverridesHeaders()
          }
        });

        if (uploadRes.data && uploadRes.data.url) {
          finalFormData["Banner"] = uploadRes.data.url;
        } else {
          throw new Error("Failed to get uploaded banner URL");
        }
      }

      // Re-serialize the course workflow with the new prefixed stage names to keep everything fully synced!
      if (jobTitle && localStages && localStages.length > 0) {
        const updatedAssignments: Record<string, string[]> = {};
        localStages.forEach((stage, idx) => {
          const originalStageName = stage["Workflow Stage"] || "Unnamed Stage";
          const cleanName = originalStageName.replace(/^\d+\.\s*/, '').trim();
          const newStageName = `${idx + 1}. ${cleanName}`;
          
          // Get the employee assignments of the original stage name
          const assignedIds = getStageAssignment(stageAssignments, originalStageName);
          updatedAssignments[newStageName] = assignedIds;
        });

        const serialized = serializeWorkflowAndStages(jobTitle, updatedAssignments);
        finalFormData["Workflow"] = serialized;
        finalFormData["Publication Workflow"] = serialized;
      }

      await onSave(finalFormData);

      // Save the updated Job Description sequences to Google Sheet
      if (jobTitle && localStages && localStages.length > 0) {
        for (let i = 0; i < localStages.length; i++) {
          const stage = localStages[i];
          const cleanName = stage["Workflow Stage"].replace(/^\d+\.\s*/, '').trim();
          const newStageName = `${i + 1}. ${cleanName}`;
          
          if (stage["Workflow Stage"] !== newStageName) {
            const payload = {
              action: "UPDATE",
              gid: "523062723",
              idKey: "Workflow Stage",
              idValue: stage["Workflow Stage"],
              data: {
                ...stage,
                "Workflow Stage": newStageName
              }
            };
            await axios.post("/api/proxy", payload);
          }
        }
      }

      if (closeOnSave) {
        onClose();
      }
    } catch (error: any) {
      console.error("Save failed:", error);
      alert("Error saving course: " + (error.response?.data?.details || error.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (key: string, value: any) => {
    setFormData((prev: any) => {
      const updated = { ...prev, [key]: value };
      if (key === "Publication Workflow") {
        updated["Workflow"] = value;
      } else if (key === "Workflow") {
        updated["Publication Workflow"] = value;
      }
      return updated;
    });
  };

  const renderField = (header: string) => {
    if (["Banner", "Course Title", "Course Code", "Mode"].includes(header)) return null;

    if (header === "Workflow" || header === "Publication Workflow") {
      return (
        <div key={header} className="space-y-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">{header}</label>
          <SearchableSingleSelect
            value={displayWorkflowTitle}
            onChange={(val) => handleWorkflowChange(val, header)}
            options={parsedWorkflows.map(w => w.title.trim())}
            placeholder="Select Job Title"
          />
        </div>
      );
    }
    if (["Instractor", "Instructor"].includes(header)) {
      return (
        <div key={header} className="space-y-2">
          <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">{header}</label>
          <EmployeeMultiSelect
            selectedIds={resolveNamesOrIdsToIds(formData[header] || "", employees)}
            onChange={(ids) => handleChange(header, ids.join(','))}
            employees={employees}
          />
        </div>
      );
    }
    if (["Duration", "Class", "No. of Class", "Student Size", "Batches", "Enrolled", "Enrollments", "Student", "Batch Number", "Discount", "Expenses", "Net Profit"].includes(header)) {
      return (
        <FloatingInput
          key={header}
          label={header}
          type="number"
          value={formData[header] === undefined || formData[header] === "—" ? "" : formData[header]}
          onChange={(e: any) => handleChange(header, e.target.value)}
        />
      );
    }
    if (["Start Date", "End Date"].includes(header)) {
      return (
        <FloatingInput
          key={header}
          label={header}
          type="date"
          value={formData[header] || ""}
          onChange={(e: any) => handleChange(header, e.target.value)}
        />
      );
    }
    if (["Course Fee"].includes(header)) {
      return (
        <FloatingInput
          key={header}
          label={header}
          type="number"
          prefix="৳"
          value={formData[header] === undefined || formData[header] === "—" ? "" : String(formData[header]).replace(/,/g, '')}
          onChange={(e: any) => handleChange(header, e.target.value)}
        />
      );
    }
    if (header === "Gross Revenue" || header === "Net Revenue" || header === "Net Profit" || header === "Profit %") {
      return (
        <div key={header} className="relative flex items-center px-3 py-3 bg-gray-50/50 border border-gray-100 rounded-lg">
          <span className={cn("text-xs font-semibold text-gray-500 mr-2", header === "Profit %" && "hidden")}>৳</span>
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">{header}</span>
            <span className="text-xs font-bold text-gray-900">
              {(() => {
                const fee = parseFloat(String(formData["Course Fee"] || "0").replace(/[^0-9.]/g, ""));
                const enrolled = parseInt(String(formData["Enrolled"] || formData["Enrollments"] || "0").replace(/[^0-9.]/g, ""), 10);
                const discount = parseFloat(String(formData["Discount"] || "0").replace(/[^0-9.]/g, ""));
                const expenses = parseFloat(String(formData["Expenses"] || "0").replace(/[^0-9.]/g, ""));
                const gross = isNaN(fee) || isNaN(enrolled) ? 0 : fee * enrolled;
                
                if (header === "Gross Revenue") return gross.toLocaleString();
                const net = gross - (isNaN(discount) ? 0 : discount);
                if (header === "Net Revenue") return net.toLocaleString();
                
                const profit = net - (isNaN(expenses) ? 0 : expenses);
                if (header === "Net Profit") return profit.toLocaleString();

                const margin = net > 0 ? (profit / net) * 100 : 0;
                return `${margin.toFixed(1)}%`;
              })()}
            </span>
          </div>
        </div>
      );
    }

    return (
      <FloatingInput
        key={header}
        label={header}
        type="text"
        value={formData[header] || ""}
        onChange={(e: any) => handleChange(header, e.target.value)}
      />
    );
  };

  const workflowHeaders = ["Workflow", "Publication Workflow"];
  const accountingHeaders = ["Course Fee", "Discount", "Expenses", "Gross Revenue", "Net Revenue", "Net Profit", "Profit %"];
  let infoHeaders = headers.filter(h => !workflowHeaders.includes(h) && !accountingHeaders.includes(h) && !["Banner", "Course Title", "Course Code", "Mode", "Workflow", "Student Size", "Student"].includes(h));

  const classHeader = headers.find(h => h === "Class" || h === "No. of Class") || "Class";
  const studentSizeHeader = headers.find(h => h === "Student Size" || h === "Student" || h.toLowerCase().includes("student") || h.toLowerCase().includes("size")) || "Student Size";

  if (title === "Edit Course" || title === "Add New Course") {
    infoHeaders = ["Duration", classHeader];
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: "100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="absolute top-0 right-0 bottom-0 w-[420px] bg-white shadow-2xl flex flex-col z-40 overflow-hidden"
        >
          <form onSubmit={handleSubmit} className="h-full flex flex-col">
            {/* Banner Section (Identity) */}
            <div className="relative h-40 flex-shrink-0 group">
              <div className="absolute inset-0 bg-slate-100">
                {(() => {
                  const displayUrl = localPreview || formData["Banner"];
                  if (displayUrl) {
                    return (
                      <img
                        src={
                          typeof displayUrl === 'string' && displayUrl.includes('drive.google.com/uc') && displayUrl.includes('id=')
                            ? `https://drive.google.com/thumbnail?id=${new URL(displayUrl).searchParams.get('id')}&sz=w1000`
                            : displayUrl
                        }
                        alt="Banner Preview"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    );
                  }
                  return (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-300">
                      <ImageIcon className="w-8 h-8 opacity-20" />
                      <span className="text-[9px] font-bold uppercase tracking-widest opacity-30">Course Banner</span>
                    </div>
                  );
                })()}
              </div>

              {/* Overlays */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
              
              {/* Close Button */}
              <button 
                type="button"
                onClick={onClose} 
                className="absolute top-2.5 right-2.5 p-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-xs transition-all border border-white/10 z-20"
              >
                <X className="w-3.5 h-3.5" />
              </button>

              {/* Upload Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute top-2.5 left-2.5 p-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-xs transition-all border border-white/10 z-20 group"
              >
                <Camera className="w-3.5 h-3.5" />
                <span className="absolute left-full ml-2 px-2 py-0.5 bg-black/80 text-[8px] font-bold uppercase rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">Change Banner</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const previewUrl = URL.createObjectURL(file);
                  setLocalPreview(previewUrl);
                  try {
                    const compressed = await compressImage(file, 1200);
                    setPendingFile(compressed);
                  } catch (err) {
                    setPendingFile(file);
                  }
                }}
              />

              {/* Identity Fields */}
              {(title === "Edit Course" || title === "Add New Course") ? (
                <div className="absolute bottom-3 right-3 flex bg-black/40 backdrop-blur-md rounded-lg border border-white/10 p-1 gap-1">
                  {["Online", "Offline", "Hybrid"].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleChange("Mode", m)}
                      className={cn(
                        "px-2 py-1 text-[8px] font-bold uppercase tracking-wider rounded transition-all",
                        (formData["Mode"] || "Hybrid").toLowerCase() === m.toLowerCase()
                          ? "bg-teal-500 text-white shadow-sm"
                          : "text-white/60 hover:text-white"
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="absolute bottom-3 left-3 right-3 space-y-2">
                  <input
                    type="text"
                    value={formData["Course Title"] || ""}
                    onChange={(e) => handleChange("Course Title", e.target.value)}
                    placeholder="Enter Course Title..."
                    className="w-full bg-transparent text-white text-xs font-bold uppercase tracking-widest outline-none placeholder:text-white/30 drop-shadow-lg"
                  />
                  
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={formData["Course Code"] || ""}
                        onChange={(e) => handleChange("Course Code", e.target.value)}
                        placeholder="CODE"
                        className="w-16 px-1.5 py-0.5 bg-black/30 backdrop-blur-md rounded border border-white/10 text-[9px] font-bold text-white/90 uppercase tracking-tighter outline-none focus:border-white/40"
                      />
                    </div>
                    
                    <div className="flex bg-black/30 backdrop-blur-md rounded border border-white/10 p-0.5 gap-0.5">
                      {["Online", "Offline", "Hybrid"].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => handleChange("Mode", m)}
                          className={cn(
                            "px-1.5 py-0.5 text-[7.5px] font-bold uppercase tracking-wider rounded transition-all",
                            (formData["Mode"] || "Hybrid").toLowerCase() === m.toLowerCase()
                              ? "bg-teal-500 text-white"
                              : "text-white/40 hover:text-white/60"
                          )}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Tab Selector */}
            <div className="flex overflow-x-auto no-scrollbar whitespace-nowrap border-b border-gray-100 bg-gray-50/50 p-1 gap-1 flex-shrink-0">
              {(title === "Edit Course" || title === "Add New Course" || "Course Code" in formData ? [
                { id: "info", label: "Info", icon: Info },
                { id: "batches", label: "Batches", icon: Layers },
                { id: "workflow", label: "Workflow", icon: Workflow },
                { id: "accounting", label: "Accounting", icon: Calculator }
              ] : [
                { id: "info", label: "Info", icon: Info },
                { id: "workflow", label: "Workflow", icon: Workflow },
                { id: "accounting", label: "Accounting", icon: Calculator }
              ]).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={cn(
                    "shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all cursor-pointer",
                    activeTab === tab.id
                      ? "bg-white text-teal-800 shadow-sm border border-gray-200"
                      : "text-gray-500 hover:text-gray-800"
                  )}
                >
                  <tab.icon className="w-3 h-3" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Scrollable Form Content */}
            <div className="flex-1 overflow-y-auto px-4 pt-5 pb-6 space-y-5 no-scrollbar bg-slate-50/30">
              {activeTab === "info" && (
                <div className="space-y-4">
                  <div className="pb-2 border-b border-gray-100">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">Course Metadata</span>
                  </div>
                  {(title === "Edit Course" || title === "Add New Course") ? (
                    <div className="space-y-4">
                      {/* 1. Course Code */}
                      <FloatingInput
                        label="Course Code"
                        type="text"
                        value={formData["Course Code"] || ""}
                        onChange={(e: any) => handleChange("Course Code", e.target.value)}
                        className="font-bold uppercase"
                      />

                      {/* 2. Course Title */}
                      <FloatingInput
                        label="Course Title"
                        type="text"
                        value={formData["Course Title"] || ""}
                        onChange={(e: any) => handleChange("Course Title", e.target.value)}
                      />

                      {/* 3. Duration, Class & Student Size side by side */}
                      <div className="grid grid-cols-3 gap-2">
                        <FloatingInput
                          label="Duration"
                          type="text"
                          value={formData["Duration"] === undefined || formData["Duration"] === "—" ? "" : formData["Duration"]}
                          onChange={(e: any) => handleChange("Duration", e.target.value)}
                        />
                        <FloatingInput
                          label={classHeader}
                          type="number"
                          value={formData[classHeader] === undefined || formData[classHeader] === "—" ? "" : formData[classHeader]}
                          onChange={(e: any) => handleChange(classHeader, e.target.value)}
                        />
                        <FloatingInput
                          label={studentSizeHeader}
                          type="number"
                          value={formData[studentSizeHeader] === undefined || formData[studentSizeHeader] === "—" ? "" : formData[studentSizeHeader]}
                          onChange={(e: any) => handleChange(studentSizeHeader, e.target.value)}
                        />
                      </div>

                      {/* 5. Course Fee & Discount side by side */}
                      <div className="grid grid-cols-2 gap-2">
                        <FloatingInput
                          label="Course Fee"
                          type="number"
                          prefix="৳"
                          value={formData["Course Fee"] === undefined || formData["Course Fee"] === "—" ? "" : String(formData["Course Fee"]).replace(/,/g, '')}
                          onChange={(e: any) => handleChange("Course Fee", e.target.value)}
                        />
                        <FloatingInput
                          label="Discount"
                          type="number"
                          prefix="৳"
                          value={formData["Discount"] === undefined || formData["Discount"] === "—" ? "" : String(formData["Discount"]).replace(/,/g, '')}
                          onChange={(e: any) => handleChange("Discount", e.target.value)}
                        />
                      </div>

                      {/* 5. Select Workflow */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Select Workflow</label>
                        <SearchableSingleSelect
                          value={displayWorkflowTitle}
                          onChange={(val) => handleWorkflowChange(val)}
                          options={parsedWorkflows.map(w => w.title.trim())}
                          placeholder="Select Job Title / Workflow"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      {infoHeaders.map(renderField)}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "batches" && (
                <div className="space-y-4">
                  <div className="pb-2 border-b border-gray-100 flex items-center justify-between">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">Course Batches ({courseBatches.length})</span>
                    {!showAddBatch && currentCourseCode && (
                      <button
                        type="button"
                        onClick={handleOpenAddBatch}
                        className="flex items-center gap-1 px-2 py-1 bg-teal-50 hover:bg-teal-100 text-teal-600 rounded-md border border-teal-100 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        Create Batch
                      </button>
                    )}
                  </div>

                  {showAddBatch ? (
                    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4 shadow-xs relative">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider">
                          {editingBatch ? "Edit Batch" : "Create New Batch"}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddBatch(false);
                            setEditingBatch(null);
                          }}
                          className="text-gray-400 hover:text-gray-600 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      
                      <div className="space-y-3.5">
                        <FloatingInput
                          label="Batch Number"
                          type="text"
                          value={newBatch["Batch Number"]}
                          onChange={(e: any) => setNewBatch(prev => ({ ...prev, "Batch Number": e.target.value }))}
                        />

                        <div className="grid grid-cols-2 gap-2">
                          <FloatingInput
                            label="Start Date"
                            type="date"
                            value={newBatch["Start Date"]}
                            onChange={(e: any) => setNewBatch(prev => ({ ...prev, "Start Date": e.target.value }))}
                          />
                          <FloatingInput
                            label="End Date"
                            type="date"
                            value={newBatch["End Date"]}
                            onChange={(e: any) => setNewBatch(prev => ({ ...prev, "End Date": e.target.value }))}
                          />
                        </div>

                        <FloatingInput
                          label="Student Count"
                          type="number"
                          value={newBatch["Student"]}
                          onChange={(e: any) => setNewBatch(prev => ({ ...prev, "Student": e.target.value }))}
                        />

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Instructor</label>
                          <EmployeeMultiSelect
                            selectedIds={resolveNamesOrIdsToIds(newBatch["Instractor"] || "", employees)}
                            onChange={(ids) => setNewBatch(prev => ({ ...prev, "Instractor": ids.join(',') }))}
                            employees={employees}
                          />
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddBatch(false);
                            setEditingBatch(null);
                          }}
                          className="flex-1 py-2 bg-slate-50 text-slate-600 text-[10px] font-bold uppercase tracking-widest rounded-lg border border-slate-200 hover:bg-slate-100 transition-all cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveBatchClick}
                          disabled={isSavingBatch}
                          className="flex-1 py-2 bg-teal-600 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-teal-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-70 shadow-sm"
                        >
                          {isSavingBatch ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                          {editingBatch ? "Save" : "Create"}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {/* Batch List */}
                  {!currentCourseCode ? (
                    <div className="flex flex-col items-center justify-center p-6 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                      <Info className="w-8 h-8 text-slate-300 mb-2" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Course Code Required</span>
                      <p className="text-[8px] text-slate-400 mt-1">Please enter a Course Code in the Info tab first to manage batches.</p>
                    </div>
                  ) : courseBatches.length === 0 && !showAddBatch ? (
                    <div className="flex flex-col items-center justify-center p-6 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                      <Layers className="w-8 h-8 text-slate-300 mb-2" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">No Batches Created Yet</span>
                      <p className="text-[8px] text-slate-400 mt-1">Click "Create Batch" above to create the first batch for this course.</p>
                    </div>
                  ) : (
                    <div className="overflow-hidden border border-slate-150 rounded-xl bg-white shadow-3xs">
                      <table className="w-full text-left border-collapse text-[10px]">
                        <thead>
                          <tr className="border-b border-slate-150 bg-slate-50/70 text-slate-500 uppercase tracking-wider font-bold">
                            <th className="py-2.5 px-3 text-[9px]">Batch No</th>
                            <th className="py-2.5 px-2 text-[9px]">Start Date</th>
                            <th className="py-2.5 px-2 text-[9px]">End Date</th>
                            <th className="py-2.5 px-3 text-[9px] text-right">Student</th>
                          </tr>
                        </thead>
                        <tbody>
                          {courseBatches.map((batch, idx) => {
                            const batchNumber = batch["Batch Number"] || "Batch-00";
                            const startDate = batch["Start Date"] ? formatToMmmDdYyyy(batch["Start Date"]) : "—";
                            const endDate = batch["End Date"] ? formatToMmmDdYyyy(batch["End Date"]) : "—";
                            const studentCount = batch["Student"] || "0";

                            return (
                              <tr
                                key={idx}
                                onClick={() => handleOpenEditBatch(batch)}
                                className="border-b border-slate-100 hover:bg-slate-50/60 cursor-pointer transition-colors"
                                title="Click to edit batch information"
                              >
                                <td className="py-3 px-3 font-semibold text-slate-800">
                                  <div className="flex items-center gap-1">
                                    <span className={isBatchRunning(batch) ? 'text-amber-800 bg-amber-50/80 px-1.5 py-0.5 rounded border border-amber-200/50 font-bold' : 'text-slate-800'}>
                                      {batchNumber}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-3 px-2 text-slate-500 font-medium">
                                  {startDate}
                                </td>
                                <td className="py-3 px-2 text-slate-500 font-medium">
                                  {endDate}
                                </td>
                                <td className="py-3 px-3 text-right font-semibold text-slate-700">
                                  {studentCount}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "workflow" && (
                <div className="space-y-4">
                  <div className="pb-2 border-b border-gray-100">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">Team & Process</span>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Select Workflow</label>
                      <SearchableSingleSelect
                        value={displayWorkflowTitle}
                        onChange={(val) => handleWorkflowChange(val)}
                        options={parsedWorkflows.map(w => w.title.trim())}
                        placeholder="Select Job Title / Workflow"
                      />
                    </div>

                    {/* Timeline of stages with Drag & Drop and Employee MultiSelect */}
                    {jobTitle && (
                      <div className="space-y-3 pt-2">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] block">Workflow Stages & Assignments</span>
                        
                        {localStages.length === 0 ? (
                          <div className="flex flex-col items-center justify-center p-6 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                            <Briefcase className="w-8 h-8 text-slate-300 mb-2" />
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">No Stages Found</span>
                            <p className="text-[8px] text-slate-400 mt-1">No stages defined for "{jobTitle}" in Job Description list.</p>
                          </div>
                        ) : (
                          <div className="relative pl-1 pt-1 space-y-3.5">
                            {/* Vertical timeline line */}
                            <div className="absolute left-[11px] top-[12px] bottom-4 w-0.5 bg-slate-200/60" />

                            {localStages.map((stage, idx) => {
                              const stageName = stage["Workflow Stage"] || "Unnamed Stage";
                              const currentSelectedEmployeeIds = getStageAssignment(stageAssignments, stageName);
                              const isDragged = draggedStageIndex === idx;

                              return (
                                <div 
                                  key={idx} 
                                  className={`relative flex gap-3 items-start transition-all duration-150 border border-dashed border-slate-100 rounded-xl p-1 bg-slate-50/10 ${isDragged ? 'opacity-40 scale-95 border-teal-200 bg-teal-50/10' : ''}`}
                                  draggable
                                  onDragStart={(e) => handleStageDragStart(e, idx)}
                                  onDragOver={handleStageDragOver}
                                  onDrop={(e) => handleStageDrop(e, idx)}
                                  onDragEnd={() => setDraggedStageIndex(null)}
                                >
                                  {/* Timeline bullet & Drag handle */}
                                  <div className="relative shrink-0 z-10 pt-1.5 flex items-center gap-1 select-none">
                                    <div className="cursor-grab active:cursor-grabbing p-0.5 text-slate-400 hover:text-slate-600 transition-colors">
                                      <GripVertical className="w-3.5 h-3.5" />
                                    </div>
                                    <div className="w-4.5 h-4.5 rounded-full border-2 border-teal-600 bg-white flex items-center justify-center font-mono text-[8.5px] font-bold text-teal-600 shadow-3xs">
                                      {idx + 1}
                                    </div>
                                  </div>

                                  {/* Step Content */}
                                  <div className="flex-1 min-w-0 pt-0.5 bg-white border border-slate-100 p-2.5 rounded-xl shadow-3xs">
                                    <span className="text-[9px] font-bold text-slate-800 uppercase tracking-wider block mb-1">
                                      {stageName.replace(/^\d+\.\s*/, '')}
                                    </span>
                                    
                                    <div className="space-y-2 relative">
                                      <EmployeeMultiSelect
                                        selectedIds={currentSelectedEmployeeIds}
                                        onChange={(ids) => {
                                          const updatedAssignments = {
                                            ...stageAssignments,
                                            [stageName]: ids
                                          };
                                          const serialized = serializeWorkflowAndStages(jobTitle, updatedAssignments);
                                          handleChange("Workflow", serialized);
                                          handleChange("Publication Workflow", serialized);
                                        }}
                                        employees={employees || []}
                                        placement="bottom"
                                      />
                                      {currentSelectedEmployeeIds.length > 0 && (
                                        <div className="mt-2 space-y-1.5 border-t border-slate-100 pt-2">
                                          <span className="text-[7.5px] font-bold text-slate-400 uppercase tracking-wider block">Selected Employees:</span>
                                          <div className="space-y-1.5">
                                            {currentSelectedEmployeeIds.map((id) => {
                                              const emp = (employees || []).find(e => String(e['Employee ID'] || '').trim() === String(id).split('|')[0].trim());
                                              if (!emp) return null;
                                              const designation = emp['Designation'] || emp['Administrative Designation'] || emp['Administrative'] || 'Employee';
                                              return (
                                                <div key={id} className="flex items-center gap-2 bg-slate-50/50 p-1 rounded-lg border border-slate-100/60" title={emp['Employee Name']}>
                                                  <img 
                                                    src={getPhotoUrl(emp)} 
                                                    alt={emp['Employee Name']}
                                                    className="w-5 h-5 rounded-full object-cover shrink-0 border border-slate-200/50"
                                                    onError={(e) => {
                                                      const target = e.target as HTMLImageElement;
                                                      target.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(emp['Employee Name'] || 'User');
                                                    }}
                                                  />
                                                  <div className="flex-1 min-w-0">
                                                    <span className="text-[8.5px] font-bold text-slate-700 block truncate leading-snug">
                                                      {emp['Employee Name']}
                                                    </span>
                                                    <span className="text-[7px] font-medium text-slate-400 block truncate leading-tight mt-0.5">
                                                      {designation}
                                                    </span>
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === "accounting" && (
                <div className="space-y-4">
                  <div className="pb-2 border-b border-gray-100">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">Financial Report</span>
                  </div>
                  
                  <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                    <div className="p-4 space-y-3.5">
                      {/* Course Fee */}
                      <div className="w-full">
                        <FloatingInput
                          label="Course Fee"
                          type="number"
                          prefix="৳"
                          value={formData["Course Fee"] === undefined || formData["Course Fee"] === "—" ? "" : String(formData["Course Fee"]).replace(/,/g, '')}
                          onChange={(e: any) => handleChange("Course Fee", e.target.value)}
                        />
                      </div>

                      {/* Enrolled */}
                      <div className="w-full">
                        <FloatingInput
                          label="Total Enrolled"
                          type="number"
                          value={formData["Enrolled"] || formData["Enrollments"] || ""}
                          onChange={(e: any) => handleChange("Enrolled", e.target.value)}
                        />
                      </div>

                      <div className="h-px bg-slate-100" />

                      {/* Gross Revenue */}
                      <div className="flex justify-between items-center py-1">
                        <span className="text-[10px] font-bold text-slate-800 uppercase tracking-widest">Gross Revenue</span>
                        <span className="text-xs font-bold text-teal-700">
                          {(() => {
                            const fee = parseFloat(String(formData["Course Fee"] || "0").replace(/[^0-9.]/g, ""));
                            const enrolled = parseInt(String(formData["Enrolled"] || formData["Enrollments"] || "0").replace(/[^0-9.]/g, ""), 10);
                            const gross = isNaN(fee) || isNaN(enrolled) ? 0 : fee * enrolled;
                            return `৳ ${gross.toLocaleString()}`;
                          })()}
                        </span>
                      </div>

                      {/* Discount */}
                      <div className="w-full">
                        <FloatingInput
                          label="Discount Allowed"
                          type="number"
                          prefix="- ৳"
                          value={formData["Discount"] === undefined || formData["Discount"] === "—" ? "" : String(formData["Discount"]).replace(/,/g, '')}
                          onChange={(e: any) => handleChange("Discount", e.target.value)}
                        />
                      </div>

                      <div className="h-px bg-slate-100" />

                      {/* Net Revenue */}
                      <div className="flex justify-between items-center py-1">
                        <span className="text-[10px] font-bold text-slate-800 uppercase tracking-widest">Net Revenue</span>
                        <span className="text-xs font-bold text-indigo-700">
                          {(() => {
                            const fee = parseFloat(String(formData["Course Fee"] || "0").replace(/[^0-9.]/g, ""));
                            const enrolled = parseInt(String(formData["Enrolled"] || formData["Enrollments"] || "0").replace(/[^0-9.]/g, ""), 10);
                            const discount = parseFloat(String(formData["Discount"] || "0").replace(/[^0-9.]/g, ""));
                            const gross = isNaN(fee) || isNaN(enrolled) ? 0 : fee * enrolled;
                            const net = gross - (isNaN(discount) ? 0 : discount);
                            return `৳ ${net.toLocaleString()}`;
                          })()}
                        </span>
                      </div>

                      {/* Expenses */}
                      <div className="w-full">
                        <FloatingInput
                          label="Total Expenses"
                          type="number"
                          prefix="- ৳"
                          value={formData["Expenses"] === undefined || formData["Expenses"] === "—" ? "" : String(formData["Expenses"]).replace(/,/g, '')}
                          onChange={(e: any) => handleChange("Expenses", e.target.value)}
                        />
                      </div>

                      <div className="border-t-2 border-double border-slate-200 mt-2 pt-3">
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] font-bold text-slate-900 uppercase tracking-widest">Est. Net Profit</span>
                          <div className="text-right">
                            <span className="text-sm font-bold text-emerald-700">
                              {(() => {
                                const fee = parseFloat(String(formData["Course Fee"] || "0").replace(/[^0-9.]/g, ""));
                                const enrolled = parseInt(String(formData["Enrolled"] || formData["Enrollments"] || "0").replace(/[^0-9.]/g, ""), 10);
                                const discount = parseFloat(String(formData["Discount"] || "0").replace(/[^0-9.]/g, ""));
                                const expenses = parseFloat(String(formData["Expenses"] || "0").replace(/[^0-9.]/g, ""));
                                const gross = isNaN(fee) || isNaN(enrolled) ? 0 : fee * enrolled;
                                const net = gross - (isNaN(discount) ? 0 : discount);
                                const profit = net - (isNaN(expenses) ? 0 : expenses);
                                return `৳ ${profit.toLocaleString()}`;
                              })()}
                            </span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Profit Margin</span>
                          <span className="text-[10px] font-bold text-slate-600">
                            {(() => {
                              const fee = parseFloat(String(formData["Course Fee"] || "0").replace(/[^0-9.]/g, ""));
                              const enrolled = parseInt(String(formData["Enrolled"] || formData["Enrollments"] || "0").replace(/[^0-9.]/g, ""), 10);
                              const discount = parseFloat(String(formData["Discount"] || "0").replace(/[^0-9.]/g, ""));
                              const expenses = parseFloat(String(formData["Expenses"] || "0").replace(/[^0-9.]/g, ""));
                              const gross = isNaN(fee) || isNaN(enrolled) ? 0 : fee * enrolled;
                              const net = gross - (isNaN(discount) ? 0 : discount);
                              const profit = net - (isNaN(expenses) ? 0 : expenses);
                              const margin = net > 0 ? (profit / net) * 100 : 0;
                              return `${margin.toFixed(1)}%`;
                            })()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="bg-slate-50 px-4 py-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.2em]">Real-time Calculation</span>
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
                        <span className="text-[8px] font-bold text-teal-600 uppercase">Live Update</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="p-3 border-t border-gray-100 bg-white flex gap-2 shrink-0 shadow-lg">
                <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-2.5 bg-slate-50 text-slate-600 text-[10px] font-bold uppercase tracking-widest rounded-xl border border-slate-200 hover:bg-slate-100 transition-all active:scale-95 cursor-pointer"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-2 py-2.5 bg-teal-600 text-white text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-teal-700 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed shadow-md shadow-teal-100"
                >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {saveButtonLabel}
                </button>
            </div>
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
