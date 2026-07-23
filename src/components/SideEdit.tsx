import React, { useState, useEffect, useRef, useMemo } from "react";
import { X, Save, Loader2, Camera, Image as ImageIcon, Workflow, Info, Calculator, GripVertical, Briefcase } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import EmployeeMultiSelect from "./EmployeeMultiSelect";
import SearchableSingleSelect from "./SearchableSingleSelect";
import { resolveNamesOrIdsToIds, resolveIdsToNames, compressImage, getDbOverridesHeaders, cn, parseWorkflowAndStages, serializeWorkflowAndStages, getStageAssignment, parseWorkflowTitle } from "../lib/utils";
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
}

export default function SideEdit({ isOpen, onClose, onSave, initialData, headers, title, employees = [], workflowData = [], saveButtonLabel = "Save", closeOnSave = true, isNew = false }: SideEditProps) {
  const [formData, setFormData] = useState<any>(initialData || {});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"info" | "workflow" | "accounting">("info");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [localStages, setLocalStages] = useState<any[]>([]);
  const [draggedStageIndex, setDraggedStageIndex] = useState<number | null>(null);

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
    return workflowData.map(row => {
      const idKey = Object.keys(row).find(h => {
        const cleaned = h.trim().toLowerCase();
        return cleaned === "workflow title" || cleaned === "title";
      }) || Object.keys(row)[0] || "Workflow Title";
      
      const rawText = String(row[idKey] || "");
      const structured = parseWorkflowTitle(rawText);
      return {
        title: structured.title || rawText || "",
        stages: structured.stages || [],
        rawText
      };
    }).filter(item => item.title.trim() !== "");
  }, [workflowData]);

  useEffect(() => {
    if (jobTitle) {
      const matchingWorkflow = parsedWorkflows.find(w => 
        w.title.trim().toLowerCase() === jobTitle.trim().toLowerCase()
      );
      
      if (matchingWorkflow && matchingWorkflow.stages.length > 0) {
        const mappedStages = matchingWorkflow.stages.map((stage, idx) => {
          let name = stage.stageName || "Unnamed Stage";
          if (!/^\d+\./.test(name)) {
            name = `${idx + 1}. ${name}`;
          }
          return {
            "ID": stage.id,
            "Job Title": jobTitle,
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

    return (
      <div key={header} className="space-y-1">
        <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">{header}</label>
        {header === "Workflow" || header === "Publication Workflow" ? (
          <SearchableSingleSelect
            value={parseWorkflowAndStages(formData[header] || "").jobTitle}
            onChange={(val) => {
              const currentVal = formData[header] || "";
              const parsed = parseWorkflowAndStages(currentVal);
              if (parsed.jobTitle === val) {
                handleChange(header, currentVal);
              } else {
                handleChange(header, val);
              }
            }}
            options={parsedWorkflows.map(w => w.title.trim())}
            placeholder="Select Job Title"
          />
        ) : ["Instractor", "Instructor"].includes(header) ? (
          <div className="space-y-2">
            <EmployeeMultiSelect
              selectedIds={resolveNamesOrIdsToIds(formData[header] || "", employees)}
              onChange={(ids) => handleChange(header, ids.join(','))}
              employees={employees}
            />
          </div>
        ) : ["Duration", "Class", "No. of Class", "Student Size", "Batches", "Enrolled", "Enrollments", "Student", "Batch Number", "Discount", "Expenses", "Net Profit"].includes(header) ? (
          <input
            type="number"
            value={formData[header] === undefined || formData[header] === "—" ? "" : formData[header]}
            onChange={(e) => handleChange(header, e.target.value)}
            className="w-full px-3 py-2 text-xs border border-gray-200 rounded focus:border-teal-500 outline-none bg-white"
          />
        ) : ["Start Date", "End Date"].includes(header) ? (
          <input
            type="date"
            value={formData[header] || ""}
            onChange={(e) => handleChange(header, e.target.value)}
            className="w-full px-3 py-2 text-xs border border-gray-200 rounded focus:border-teal-500 outline-none bg-white"
          />
        ) : ["Course Fee"].includes(header) ? (
          <div className="relative flex items-center">
            <span className="absolute left-3 text-xs font-semibold text-gray-500 pointer-events-none">৳</span>
            <input
              type="number"
              value={formData[header] === undefined || formData[header] === "—" ? "" : String(formData[header]).replace(/,/g, '')}
              onChange={(e) => handleChange(header, e.target.value)}
              className="w-full pl-7 pr-3 py-2 text-xs border border-gray-200 rounded focus:border-teal-500 outline-none bg-white"
            />
          </div>
        ) : header === "Gross Revenue" || header === "Net Revenue" || header === "Net Profit" || header === "Profit %" ? (
          <div className="relative flex items-center px-3 py-2 bg-gray-50/50 border border-gray-100 rounded">
            <span className={cn("text-xs font-semibold text-gray-500 mr-2", header === "Profit %" && "hidden")}>৳</span>
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
        ) : (
          <input
            type="text"
            value={formData[header] || ""}
            onChange={(e) => handleChange(header, e.target.value)}
            className="w-full px-3 py-2 text-xs border border-gray-200 rounded focus:border-teal-500 outline-none bg-white"
          />
        )}
      </div>
    );
  };

  const workflowHeaders = ["Workflow", "Publication Workflow"];
  const accountingHeaders = ["Course Fee", "Discount", "Expenses", "Gross Revenue", "Net Revenue", "Net Profit", "Profit %"];
  let infoHeaders = headers.filter(h => !workflowHeaders.includes(h) && !accountingHeaders.includes(h) && !["Banner", "Course Title", "Course Code", "Mode", "Workflow"].includes(h));

  if (title === "Edit Course" || title === "Add New Course") {
    const classHeader = headers.find(h => h === "Class" || h === "No. of Class") || "Class";
    infoHeaders = ["Duration", classHeader, "Student Size"];
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: "100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="absolute top-0 right-0 bottom-0 w-80 bg-white shadow-2xl flex flex-col z-40 overflow-hidden"
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
            </div>

            {/* Tab Selector */}
            <div className="flex overflow-x-auto no-scrollbar whitespace-nowrap border-b border-gray-100 bg-gray-50/50 p-1 gap-1 flex-shrink-0">
              {[
                { id: "info", label: "Info", icon: Info },
                { id: "workflow", label: "Workflow", icon: Workflow },
                { id: "accounting", label: "Accounting", icon: Calculator }
              ].map((tab) => (
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
            <div className="flex-1 overflow-y-auto p-4 space-y-5 no-scrollbar bg-slate-50/30">
              {activeTab === "info" && (
                <div className="space-y-4">
                  <div className="pb-2 border-b border-gray-100">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">Course Metadata</span>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    {infoHeaders.map(renderField)}
                  </div>
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
                        value={jobTitle}
                        onChange={(val) => {
                          const currentVal = formData["Workflow"] || formData["Publication Workflow"] || "";
                          const parsed = parseWorkflowAndStages(currentVal);
                          if (parsed.jobTitle !== val) {
                            // If a new jobTitle is selected, serialize it with empty stage assignments or matching ones
                            const serialized = serializeWorkflowAndStages(val, {});
                            handleChange("Workflow", serialized);
                            handleChange("Publication Workflow", serialized);
                          }
                        }}
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
                      <div className="flex justify-between items-center gap-4">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Course Fee</span>
                        <div className="relative flex items-center w-32 shrink-0">
                          <span className="absolute left-2.5 text-[11px] font-bold text-slate-400">৳</span>
                          <input
                            type="number"
                            value={formData["Course Fee"] === undefined || formData["Course Fee"] === "—" ? "" : String(formData["Course Fee"]).replace(/,/g, '')}
                            onChange={(e) => handleChange("Course Fee", e.target.value)}
                            className="w-full pl-6 pr-2 py-1.5 text-[11px] font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-teal-500 outline-none text-right transition-all"
                          />
                        </div>
                      </div>

                      {/* Enrolled */}
                      <div className="flex justify-between items-center gap-4">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Enrolled</span>
                        <div className="w-32 shrink-0">
                          <input
                            type="number"
                            value={formData["Enrolled"] || formData["Enrollments"] || ""}
                            onChange={(e) => handleChange("Enrolled", e.target.value)}
                            className="w-full px-2.5 py-1.5 text-[11px] font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-teal-500 outline-none text-right transition-all"
                          />
                        </div>
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
                      <div className="flex justify-between items-center gap-4">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Discount Allowed</span>
                        <div className="relative flex items-center w-32 shrink-0">
                          <span className="absolute left-2.5 text-[11px] font-bold text-rose-400">- ৳</span>
                          <input
                            type="number"
                            value={formData["Discount"] === undefined || formData["Discount"] === "—" ? "" : String(formData["Discount"]).replace(/,/g, '')}
                            onChange={(e) => handleChange("Discount", e.target.value)}
                            className="w-full pl-8 pr-2 py-1.5 text-[11px] font-bold text-rose-600 bg-rose-50/30 border border-rose-100 rounded-lg focus:bg-white focus:border-rose-500 outline-none text-right transition-all"
                          />
                        </div>
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
                      <div className="flex justify-between items-center gap-4">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Expenses</span>
                        <div className="relative flex items-center w-32 shrink-0">
                          <span className="absolute left-2.5 text-[11px] font-bold text-amber-400">- ৳</span>
                          <input
                            type="number"
                            value={formData["Expenses"] === undefined || formData["Expenses"] === "—" ? "" : String(formData["Expenses"]).replace(/,/g, '')}
                            onChange={(e) => handleChange("Expenses", e.target.value)}
                            className="w-full pl-8 pr-2 py-1.5 text-[11px] font-bold text-amber-600 bg-amber-50/30 border border-amber-100 rounded-lg focus:bg-white focus:border-amber-500 outline-none text-right transition-all"
                          />
                        </div>
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
