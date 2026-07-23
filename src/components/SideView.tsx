import React, { useState, useMemo } from "react";
import { X, Pencil, Lightbulb, PenTool, ShieldCheck, CheckCircle2, Clock, Calendar, Users, Award, BookOpen, ChevronDown, ChevronUp, Plus, Save, Loader2, TrendingUp, FileText, Link as LinkIcon, Tag as TagIcon, Upload, Eye, Briefcase, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { resolveNamesOrIdsToIds, formatToMmmDdYyyy, isBatchRunning, parseWorkflowAndStages, getStageAssignment, parseWorkflowTitle } from "../lib/utils";
import EmployeeMultiSelect from "./EmployeeMultiSelect";
import axios from "axios";
import { FOLDER_LOCATIONS } from "../FolderLocation";

export interface SideViewProps {
  isOpen: boolean;
  onClose: () => void;
  onEdit?: () => void;
  data: any;
  headers: string[];
  title: string;
  employees?: any[];
  allBatches?: any[];
  onSaveBatch?: (formData: any, editingRow: any | null) => Promise<void>;
  allDocuments?: any[];
  onSaveDocument?: (formData: any, editingRow: any | null) => Promise<void>;
  workflowData?: any[];
}

export default function SideView({ isOpen, onClose, onEdit, data, headers, title, employees, allBatches, onSaveBatch, allDocuments, onSaveDocument, workflowData = [] }: SideViewProps) {
  const [activeTab, setActiveTab] = useState<"workflow" | "batches" | "info" | "accounting" | "documents">("workflow");
  const [expandedBatchIndex, setExpandedBatchIndex] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSavingBatch, setIsSavingBatch] = useState(false);
  const [newBatchData, setNewBatchData] = useState<any>({});

  const [showAddDocForm, setShowAddDocForm] = useState(false);
  const [isSavingDoc, setIsSavingDoc] = useState(false);
  const [newDocData, setNewDocData] = useState<any>({});
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const formatValue = (header: string, val: any) => {
    if (val == null) return "N/A";
    const headerLower = header.toLowerCase();
    
    // Format dates
    if (headerLower.includes("date")) {
      return formatToMmmDdYyyy(val);
    }

    if (["publication workflow", "instractor", "instructor"].includes(headerLower) && employees && employees.length > 0) {
      const ids = String(val).split(',').map(s => s.trim()).filter(Boolean);
      return ids.map(id => {
        const emp = employees.find(e => String(e['Employee ID'] || '').trim() === id || String(e['Employee Name'] || '').trim().toLowerCase() === id.toLowerCase());
        return emp ? emp['Employee Name'] : id;
      }).join(', ');
    }

    const dateFormatted = formatToMmmDdYyyy(val);
    if (dateFormatted !== String(val) && /^\d{4}[-/]\d{2}[-/]\d{2}$/.test(String(val).trim())) {
      return dateFormatted;
    }

    return String(val);
  };

  const isCourseView = title === "View Course" || headers.includes("Course Title");

  const getBannerUrl = (url: any) => {
    if (!url || typeof url !== "string") return "";
    if (url.includes("drive.google.com/uc") && url.includes("id=")) {
      try {
        const id = new URL(url).searchParams.get("id");
        return `https://drive.google.com/thumbnail?id=${id}&sz=w1000`;
      } catch (e) {
        return url;
      }
    }
    return url;
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

  const getWorkflowStageTitle = (index: number, defaultTitle: string) => {
    // Get Course's current Workflow Job Title
    const courseWorkflow = data?.['Workflow'] || data?.['Publication Workflow'] || '';
    if (!courseWorkflow) return defaultTitle;

    const { jobTitle } = parseWorkflowAndStages(courseWorkflow);

    const matchingWorkflow = parsedWorkflows.find(w => 
      w.title.trim().toLowerCase() === jobTitle.trim().toLowerCase()
    );

    if (matchingWorkflow && matchingWorkflow.stages.length > 0) {
      const stage = matchingWorkflow.stages[index];
      if (stage) {
        let name = stage.stageName || "Unnamed Stage";
        if (!/^\d+\./.test(name)) {
          name = `${index + 1}. ${name}`;
        }
        return name;
      }
    }

    return defaultTitle;
  };

  const getPhotoUrl = (emp: any) => {
    if (!emp) return 'https://ui-avatars.com/api/?name=User';
    const photoKey = Object.keys(emp).find(k => k.toLowerCase().includes("photo") || k.toLowerCase() === "image");
    const rawUrl = photoKey ? emp[photoKey] : '';
    if (rawUrl && typeof rawUrl === 'string' && rawUrl.trim() !== '') {
      const fileIdMatch = rawUrl.match(/[-\w]{25,}/);
      if (fileIdMatch && rawUrl.includes('drive.google.com')) {
        return `https://drive.google.com/thumbnail?id=${fileIdMatch[0]}&sz=w200`;
      } else {
        return rawUrl;
      }
    }
    return 'https://ui-avatars.com/api/?name=' + encodeURIComponent(emp['Employee Name'] || 'User');
  };

  const getInstructorEmp = (val: any) => {
    if (!val || !employees) return null;
    return employees.find(e => String(e['Employee ID'] || '').trim() === String(val).trim() || String(e['Employee Name'] || '').trim().toLowerCase() === String(val).trim().toLowerCase());
  };

  const safeData = data || {};

  return (
    <AnimatePresence>
      {isOpen && data && (
        <motion.div
          initial={{ x: "100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="absolute top-0 right-0 bottom-0 w-80 bg-white shadow-2xl flex flex-col z-40"
        >
          {isCourseView ? (
            <div className="flex flex-col shrink-0 border-b border-gray-100">
              {/* Top Banner Image with overlay action buttons, title, and code */}
              <div className="relative w-full h-44 bg-teal-900 shrink-0 overflow-hidden">
                {safeData["Banner"] ? (
                  <img
                    src={getBannerUrl(safeData["Banner"])}
                    alt="Course Banner"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-teal-800 to-teal-700" />
                )}
                
                {/* Dark gradient overlay for readability of bottom text */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />

                {/* Top Action Buttons - Shown on hover near top-right corner */}
                <div className="absolute top-0 right-0 p-10 z-20 group/actions pointer-events-none">
                  <div className="flex items-center gap-1.5 opacity-0 group-hover/actions:opacity-100 transition-opacity duration-200 pointer-events-auto absolute top-2.5 right-2.5">
                    {onEdit && (
                      <button 
                        onClick={onEdit} 
                        className="p-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-xs transition-colors border border-white/10 cursor-pointer shadow-sm"
                        title="Edit Course"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    )}
                    <button 
                      onClick={onClose} 
                      className="p-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-xs transition-colors border border-white/10 cursor-pointer shadow-sm"
                      title="Close"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Bottom aligned content: Title & Code (left) */}
                <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3 z-10">
                  {/* Left: Course Title and Course Code */}
                  <div className="flex flex-col items-start text-left min-w-0">
                    <h3 className="text-xs font-bold text-white leading-snug tracking-wide line-clamp-2 drop-shadow-md uppercase">
                      {data["Course Title"] || "N/A"}
                    </h3>
                    {data["Course Code"] && (
                      <span className="text-[8px] font-bold text-teal-200 bg-teal-950/80 px-2 py-0.5 rounded-md mt-1.5 border border-teal-500/30 uppercase tracking-wider font-mono">
                        {data["Course Code"]}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Mode indicator below banner in right corner */}
              {data["Mode"] && (
                <div className="relative h-0">
                  <div className="absolute right-3 -top-3.5 z-30">
                    <div className="bg-teal-600 text-white px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest shadow-lg border border-teal-500/50">
                      {data["Mode"]}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab Selector below the banner */}
              <div className="flex overflow-x-auto no-scrollbar whitespace-nowrap border-t border-gray-100 bg-gray-50/50 p-1 gap-1 relative">
                {[
                  { id: "workflow", label: "Workflow" },
                  { id: "batches", label: "Batches" },
                  { id: "info", label: "Info" },
                  { id: "accounting", label: "Accounting" },
                  { id: "documents", label: "Documents" }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`shrink-0 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all cursor-pointer relative z-10 ${
                      activeTab === tab.id
                        ? "text-teal-800"
                        : "text-gray-500 hover:text-gray-800"
                    }`}
                  >
                    {tab.label}
                    {activeTab === tab.id && (
                      <motion.div
                        layoutId="sideViewTab"
                        className="absolute inset-0 bg-white shadow-3xs border border-gray-200/40 rounded-md -z-10"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between p-2.5 bg-gradient-to-r from-teal-600 to-teal-500">
              <h3 className="text-[11px] font-bold text-white uppercase tracking-widest">{title}</h3>
              <div className="flex items-center gap-1">
                {onSaveBatch && !isCourseView && (
                  <button 
                    onClick={() => {
                      setActiveTab("batches");
                      setShowAddForm(true);
                      const nextBatchNum = parseInt(data["Batch Number"] || "0", 10) + 1;
                      setNewBatchData({
                        "Course Code": data["Course Code"] || "",
                        "Batch Number": String(nextBatchNum),
                        "Start Date": "",
                        "End Date": "",
                        "Student": "",
                        "Instractor": data["Instractor"] || ""
                      });
                    }}
                    className="text-teal-100 hover:text-white transition-colors cursor-pointer mr-2"
                    title="Create New Batch"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
                {onEdit && (
                  <button onClick={onEdit} className="text-teal-100 hover:text-white transition-colors cursor-pointer">
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
                <button onClick={onClose} className="text-teal-100 hover:text-white transition-colors cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto no-scrollbar p-3 pt-4">
            {isCourseView ? (
              <div className="space-y-4">

                {activeTab === "workflow" && (() => {
                  const courseWorkflow = data["Workflow"] || data["Publication Workflow"] || "";
                  const { jobTitle, stageAssignments } = parseWorkflowAndStages(courseWorkflow);

                  if (!jobTitle) {
                    return (
                      <div className="flex flex-col items-center justify-center p-6 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                        <Briefcase className="w-8 h-8 text-slate-300 mb-2" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">No Workflow Assigned</span>
                        <p className="text-[9px] text-slate-400 mt-1">Please edit this course to assign a Publication Workflow / Job Title.</p>
                      </div>
                    );
                  }

                  const matchingWorkflow = parsedWorkflows.find(w => 
                    w.title.trim().toLowerCase() === jobTitle.trim().toLowerCase()
                  );

                  let matchingStages = [];
                  if (matchingWorkflow && matchingWorkflow.stages.length > 0) {
                    matchingStages = matchingWorkflow.stages.map((stage, idx) => {
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
                  }

                  if (matchingStages.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center p-6 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                        <Briefcase className="w-8 h-8 text-slate-300 mb-2" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">No Stages Found</span>
                        <p className="text-[9px] text-slate-400 mt-1">No workflow stages defined for "{jobTitle}".</p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      <div className="relative pl-1 pt-1 space-y-4">
                        {/* Vertical timeline line */}
                        <div className="absolute left-[13px] top-[14px] bottom-4 w-0.5 bg-slate-100" />

                        {matchingStages.map((stage, idx) => {
                          const stageName = stage["Workflow Stage"] || "Unnamed Stage";
                          const currentSelectedEmployeeIds = getStageAssignment(stageAssignments, stageName);
                          
                          return (
                            <div key={idx} className="relative flex gap-3.5 items-start">
                              {/* Timeline bullet */}
                              <div className="relative shrink-0 z-10 pt-0.5">
                                <div className="w-5 h-5 rounded-full border-2 border-teal-600 bg-white flex items-center justify-center font-mono text-[9px] font-bold text-teal-600 shadow-3xs">
                                  {idx + 1}
                                </div>
                              </div>

                              {/* Step Content */}
                              <div className="flex-1 min-w-0 pt-0.5 bg-slate-50/50 border border-slate-100/60 p-2.5 rounded-xl">
                                <span className="text-[10px] font-bold text-slate-800 uppercase tracking-wider block">
                                  {stageName.replace(/^\d+\.\s*/, '')}
                                </span>
                                {currentSelectedEmployeeIds.length > 0 ? (
                                  <div className="mt-2 space-y-1.5">
                                    {currentSelectedEmployeeIds.map((id) => {
                                      const emp = (employees || []).find(e => String(e['Employee ID'] || '').trim() === String(id).split('|')[0].trim());
                                      if (!emp) return null;
                                      const designation = emp['Designation'] || emp['Administrative Designation'] || emp['Administrative'] || 'Employee';
                                      return (
                                        <div key={id} className="flex items-center gap-2 bg-white p-1.5 rounded-lg border border-slate-100/60" title={emp['Employee Name']}>
                                          <img 
                                            src={getPhotoUrl(emp)} 
                                            alt={emp['Employee Name']}
                                            className="w-6 h-6 rounded-full object-cover shrink-0 border border-slate-200/50"
                                            onError={(e) => {
                                              const target = e.target as HTMLImageElement;
                                              target.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(emp['Employee Name'] || 'User');
                                            }}
                                          />
                                          <div className="flex-1 min-w-0">
                                            <span className="text-[9px] font-bold text-slate-700 block truncate leading-snug">
                                              {emp['Employee Name']}
                                            </span>
                                            <span className="text-[7.5px] font-medium text-slate-400 block truncate leading-tight mt-0.5">
                                              {designation}
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <span className="text-[8px] text-slate-400 italic block mt-1">No employee assigned</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {activeTab === "batches" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100">
                      <span className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">Active & Scheduled Batches</span>
                      {onSaveBatch && (
                        <button
                          onClick={() => {
                            const courseCode = data["Course Code"];
                            const courseBatches = (allBatches || []).filter(
                              (b: any) => String(b["Course Code"] || "").trim() === String(courseCode || "").trim()
                            );
                            const batchNumbers = courseBatches
                              .map((b: any) => parseInt(b["Batch Number"], 10))
                              .filter((num: number) => !isNaN(num));
                            const nextBatchNum = batchNumbers.length > 0 ? Math.max(...batchNumbers) + 1 : 1;

                            setShowAddForm(!showAddForm);
                            setNewBatchData({
                              "Course Code": courseCode || "",
                              "Batch Number": String(nextBatchNum),
                              "Start Date": "",
                              "End Date": "",
                              "Student": "",
                              "Instractor": data["Industry Expert"] || ""
                            });
                          }}
                          className="p-1 px-2 rounded-md hover:bg-slate-100 text-teal-600 hover:text-teal-700 transition-colors cursor-pointer flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider border border-teal-100 bg-teal-50/50"
                          title="Add New Batch"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add</span>
                        </button>
                      )}
                    </div>

                    {/* Expandable Add Batch Form */}
                    <AnimatePresence initial={false}>
                      {showAddForm && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.2 }}
                          className="relative z-[99] bg-slate-50/50 border border-slate-200/60 rounded-xl p-3 space-y-2.5 overflow-visible"
                        >
                          <span className="text-[8.5px] font-bold text-teal-800 uppercase tracking-wider block">New Batch Information</span>
                          
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[7.5px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Batch Number</label>
                              <input
                                type="number"
                                value={newBatchData["Batch Number"] || ""}
                                onChange={(e) => setNewBatchData({ ...newBatchData, "Batch Number": e.target.value })}
                                placeholder="e.g. 1"
                                className="w-full px-2.5 py-1.5 text-[10.5px] border border-slate-200 rounded-lg focus:border-teal-500 bg-white outline-none"
                                required
                              />
                            </div>
                            <div>
                              <label className="text-[7.5px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Students Count</label>
                              <input
                                type="number"
                                value={newBatchData["Student"] || ""}
                                onChange={(e) => setNewBatchData({ ...newBatchData, "Student": e.target.value })}
                                placeholder="e.g. 25"
                                className="w-full px-2.5 py-1.5 text-[10.5px] border border-slate-200 rounded-lg focus:border-teal-500 bg-white outline-none"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[7.5px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Start Date</label>
                              <input
                                type="date"
                                value={newBatchData["Start Date"] || ""}
                                onChange={(e) => setNewBatchData({ ...newBatchData, "Start Date": e.target.value })}
                                className="w-full px-2.5 py-1.5 text-[10.5px] border border-slate-200 rounded-lg focus:border-teal-500 bg-white outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[7.5px] font-bold text-slate-400 uppercase tracking-wider block mb-1">End Date</label>
                              <input
                                type="date"
                                value={newBatchData["End Date"] || ""}
                                onChange={(e) => setNewBatchData({ ...newBatchData, "End Date": e.target.value })}
                                className="w-full px-2.5 py-1.5 text-[10.5px] border border-slate-200 rounded-lg focus:border-teal-500 bg-white outline-none"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-[7.5px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Instructor</label>
                            <EmployeeMultiSelect
                              selectedIds={resolveNamesOrIdsToIds(newBatchData["Instractor"] || "", employees || [])}
                              onChange={(ids) => setNewBatchData({ ...newBatchData, "Instractor": ids.join(',') })}
                              employees={employees || []}
                              placement="bottom"
                            />
                          </div>

                          <div className="flex gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setShowAddForm(false)}
                              className="flex-1 py-1.5 bg-white text-slate-600 text-[10px] font-bold uppercase rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={isSavingBatch}
                              onClick={async () => {
                                if (!newBatchData["Batch Number"]) {
                                  alert("Please specify a Batch Number.");
                                  return;
                                }
                                setIsSavingBatch(true);
                                try {
                                  if (onSaveBatch) {
                                    await onSaveBatch(newBatchData, null);
                                    setShowAddForm(false);
                                  }
                                } catch (err) {
                                  console.error("Failed to save batch:", err);
                                  alert("Failed to save batch. Please try again.");
                                } finally {
                                  setIsSavingBatch(false);
                                }
                              }}
                              className="flex-1 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-[10px] font-bold uppercase rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-70"
                            >
                              {isSavingBatch ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Save className="w-3.5 h-3.5" />
                              )}
                              <span>Save</span>
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {(() => {
                      const courseCode = data["Course Code"];
                      const courseBatches = (allBatches || []).filter(
                        (b: any) => String(b["Course Code"] || "").trim().toLowerCase() === String(courseCode || "").trim().toLowerCase()
                      );

                      if (courseBatches.length === 0) {
                        return (
                          <div className="py-8 px-4 text-center rounded-xl border border-dashed border-slate-100 bg-slate-50/30">
                            <span className="text-gray-400 text-[10px] font-bold block mb-1">NO BATCHES FOUND</span>
                            <p className="text-gray-400/70 text-[9px] italic">There are no batches configured for this course yet.</p>
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-2.5">
                          {courseBatches.map((batch: any, index: number) => {
                            const isExpanded = expandedBatchIndex === index;
                            
                            // Resolve potential multiple instructors
                            const instructorVal = batch["Instractor"] || batch["Instructor"];
                            const instructorIds = instructorVal ? resolveNamesOrIdsToIds(String(instructorVal), employees || []) : [];
                            const instructorEmployees = instructorIds.map(id => (employees || []).find(e => String(e['Employee ID'] || '').trim() === String(id).split('|')[0].trim() || String(e['Employee Name'] || '').trim().toLowerCase() === String(id).split('|')[0].trim().toLowerCase())).filter(Boolean);
                            
                            const getInstructorList = () => {
                              if (instructorEmployees.length > 0) return instructorEmployees;
                              if (!instructorVal || String(instructorVal).trim() === "") return [];
                              return String(instructorVal).split(',').map(name => ({
                                'Employee Name': name.trim(),
                                Designation: "External Expert"
                              }));
                            };
                            
                            const instructorsToRender = getInstructorList();

                            return (
                              <div 
                                key={index} 
                                className="bg-white border border-slate-150/60 rounded-xl shadow-3xs overflow-hidden hover:shadow-2xs transition-all duration-200"
                              >
                                {/* Clickable Header Item */}
                                <button
                                  onClick={() => setExpandedBatchIndex(isExpanded ? null : index)}
                                  className="w-full text-left p-3 hover:bg-slate-50/50 active:bg-slate-100 flex flex-col gap-1.5 transition-all duration-150 cursor-pointer focus:outline-none"
                                >
                                  <div className="flex items-center justify-between w-full">
                                    <div className="flex items-center gap-1.5">
                                      <span className={`text-[10.5px] font-bold tracking-wider flex items-center gap-1.5 ${isBatchRunning(batch) ? 'text-amber-700 bg-amber-50/70 border border-amber-200/50 px-1.5 py-0.5 rounded-md' : 'text-slate-800'}`} title={isBatchRunning(batch) ? "Active Running Batch" : undefined}>
                                        Batch {batch["Batch Number"] || "N/A"}
                                        {isBatchRunning(batch) && (
                                          <span className="inline-flex items-center gap-0.5">
                                            <AlertCircle className="w-3 h-3 text-amber-500 animate-pulse shrink-0" />
                                            <span className="relative flex h-1 w-1">
                                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                              <span className="relative inline-flex rounded-full h-1 w-1 bg-amber-500"></span>
                                            </span>
                                          </span>
                                        )}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      {batch["Student"] && (
                                        <span className="text-[9px] font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-100/50">
                                          {batch["Student"]} Students
                                        </span>
                                      )}
                                      {isExpanded ? (
                                        <ChevronUp className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                      ) : (
                                        <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1 text-[8.5px] text-slate-500 font-mono font-bold mt-0.5">
                                    <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                                    <span>
                                      {batch["Start Date"] ? formatToMmmDdYyyy(batch["Start Date"]) : "—"}
                                      {" — "}
                                      {batch["End Date"] ? formatToMmmDdYyyy(batch["End Date"]) : "—"}
                                    </span>
                                  </div>
                                </button>

                                {/* Expanded Instructor section */}
                                <AnimatePresence initial={false}>
                                  {isExpanded && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: "auto", opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{ duration: 0.15 }}
                                      className="overflow-hidden border-t border-slate-100 bg-slate-50/30"
                                    >
                                      <div className="p-3 pt-2.5 space-y-2">
                                        <div className="flex items-center gap-1">
                                          <Users className="w-3 h-3 text-slate-400" />
                                          <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Instructor List</span>
                                        </div>
                                        <div className="space-y-1.5">
                                          {instructorsToRender.map((emp: any, empIdx: number) => {
                                            const photoUrl = getPhotoUrl(emp);
                                            return (
                                              <div 
                                                key={empIdx} 
                                                className="flex items-center gap-2 bg-white p-1.5 rounded-lg border border-slate-150/50 hover:border-slate-200 transition-colors"
                                              >
                                                <img 
                                                  src={photoUrl} 
                                                  className="w-5.5 h-5.5 rounded-full object-cover bg-slate-100 border border-slate-200/50 shrink-0"
                                                  onError={(e) => { (e.target as HTMLImageElement).src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(emp['Employee Name'] || 'User'); }} 
                                                  referrerPolicy="no-referrer"
                                                />
                                                <div className="flex flex-col min-w-0">
                                                  <span className="text-[9.5px] text-slate-700 font-bold truncate leading-tight">
                                                    {emp['Employee Name']}
                                                  </span>
                                                  <span className="text-[8px] text-slate-400 font-bold leading-none truncate mt-0.5">
                                                    {emp.Designation || "External Expert"}
                                                  </span>
                                                </div>
                                              </div>
                                            );
                                          })}

                                          {instructorsToRender.length === 0 && (
                                            <div className="flex items-center gap-1.5 py-1 px-1.5 rounded-md border border-dashed border-slate-100 text-slate-400 bg-slate-50/20">
                                              <div className="w-3.5 h-3.5 rounded-full border border-dashed border-slate-200 flex items-center justify-center shrink-0">
                                                <span className="text-[7.5px] font-bold text-slate-300">?</span>
                                              </div>
                                              <span className="text-[8px] font-semibold italic text-slate-400/70">No Instructor assigned</span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {activeTab === "info" && (() => {
                  const standardKeys = [
                    "Course Title", "Course Code", "Banner", "Status", "Duration", 
                    "No. of Class", "Student Size", "Batches", "Enrolled", "Enrollments", 
                    "Discount", "Expenses", "Remarks", "Received By", 
                    "Gross Revenue", "Net Revenue", "Net Profit", "Profit %", "Course Fee", 
                    "id", "rowId", "rowIndex"
                  ];
                  
                  const extraFields = Object.keys(data || {}).filter(key => {
                    return !standardKeys.includes(key) && data[key] && String(data[key]).trim() !== "" && String(data[key]).trim() !== "—";
                  });

                  return (
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center gap-1.5 pb-2 mb-1 border-b border-gray-100">
                          <span className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">Key Course Information</span>
                        </div>

                        <div className="grid grid-cols-1 gap-2.5">
                          {[
                            { key: "Duration", label: "Duration", value: data["Duration"] ? `${data["Duration"]} Days` : "—", icon: Clock, color: "text-blue-500 bg-blue-50/50 border-blue-100/60" },
                            { key: "No. of Class", label: "No. of Class", value: data["No. of Class"] ? `${data["No. of Class"]} Classes` : "—", icon: Calendar, color: "text-indigo-500 bg-indigo-50/50 border-indigo-100/60" },
                            { key: "Student Size", label: "Student Size", value: data["Student Size"] ? `${data["Student Size"]} Students` : "—", icon: Users, color: "text-teal-500 bg-teal-50/50 border-teal-100/60" },
                            { key: "Status", label: "Current Status", value: data["Status"] || "—", icon: Award, color: "text-emerald-500 bg-emerald-50/50 border-emerald-100/60" },
                          ].map((item, idx) => {
                            const ItemIcon = item.icon;
                            return (
                              <div 
                                key={idx} 
                                className="flex items-center gap-3 p-3 bg-white border border-slate-150/60 rounded-xl shadow-3xs"
                              >
                                <div className={`p-2 rounded-lg border ${item.color} shrink-0`}>
                                  <ItemIcon className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">{item.label}</span>
                                  <span className="text-[11px] font-bold text-slate-800 block mt-0.5">{item.value}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {extraFields.length > 0 && (
                        <div>
                          <div className="flex items-center gap-1.5 pb-2 mt-4 mb-1 border-b border-gray-100">
                            <span className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">Additional Information</span>
                          </div>
                          <div className="grid grid-cols-1 gap-2.5">
                            {extraFields.map((field) => (
                              <div 
                                key={field} 
                                className="flex items-center gap-3 p-3 bg-white border border-slate-150/60 rounded-xl shadow-3xs"
                              >
                                <div className="p-2 rounded-lg border text-amber-500 bg-amber-50/50 border-amber-100/60 shrink-0">
                                  <Lightbulb className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">{field}</span>
                                  <span className="text-[11px] font-bold text-slate-800 block mt-0.5">{data[field]}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {activeTab === "accounting" && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-1.5 pb-2 mb-1 border-b border-gray-100">
                      <TrendingUp className="w-3 h-3 text-teal-600" />
                      <span className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">Accounting Report</span>
                    </div>

                    <div className="bg-white border border-slate-150/60 rounded-xl shadow-sm overflow-hidden">
                      <div className="p-4 space-y-4">
                        {/* Course Fee & Enrolled */}
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Course Fee</span>
                            <span className="text-xs font-bold text-slate-700">৳ {Number(String(data["Course Fee"] || 0).replace(/[^0-9.]/g, '')).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Enrolled</span>
                            <span className="text-xs font-bold text-slate-700">{data["Enrolled"] || data["Enrollments"] || 0}</span>
                          </div>
                        </div>

                        <div className="h-px bg-slate-100" />

                        {/* Gross Revenue */}
                        <div className="flex justify-between items-center py-1">
                          <span className="text-[10px] font-bold text-slate-800 uppercase">Gross Revenue</span>
                          <span className="text-xs font-bold text-teal-700">
                            {(() => {
                              const fee = parseFloat(String(data["Course Fee"] || "0").replace(/[^0-9.]/g, ""));
                              const enrolled = parseInt(String(data["Enrolled"] || data["Enrollments"] || "0").replace(/[^0-9.]/g, ""), 10);
                              const gross = isNaN(fee) || isNaN(enrolled) ? 0 : fee * enrolled;
                              return `৳ ${gross.toLocaleString()}`;
                            })()}
                          </span>
                        </div>

                        {/* Discount */}
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">Discount</span>
                          <span className="text-xs font-bold text-rose-600">
                            - ৳ {Number(String(data["Discount"] || 0).replace(/[^0-9.]/g, '')).toLocaleString()}
                          </span>
                        </div>

                        <div className="h-px bg-slate-100" />

                        {/* Net Revenue */}
                        <div className="flex justify-between items-center py-1">
                          <span className="text-[10px] font-bold text-slate-800 uppercase">Net Revenue</span>
                          <span className="text-xs font-bold text-indigo-700">
                            {(() => {
                              const fee = parseFloat(String(data["Course Fee"] || "0").replace(/[^0-9.]/g, ""));
                              const enrolled = parseInt(String(data["Enrolled"] || data["Enrollments"] || "0").replace(/[^0-9.]/g, ""), 10);
                              const discount = parseFloat(String(data["Discount"] || "0").replace(/[^0-9.]/g, ""));
                              const gross = isNaN(fee) || isNaN(enrolled) ? 0 : fee * enrolled;
                              const net = gross - (isNaN(discount) ? 0 : discount);
                              return `৳ ${net.toLocaleString()}`;
                            })()}
                          </span>
                        </div>

                        {/* Expenses */}
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">Expenses</span>
                          <span className="text-xs font-bold text-amber-600">
                            - ৳ {Number(String(data["Expenses"] || 0).replace(/[^0-9.]/g, '')).toLocaleString()}
                          </span>
                        </div>

                        <div className="border-t-2 border-double border-slate-200 mt-2 pt-3">
                          <div className="flex justify-between items-center">
                            <span className="text-[11px] font-bold text-slate-900 uppercase tracking-wider">Net Profit</span>
                            <div className="text-right">
                              <span className="text-sm font-bold text-emerald-700">
                                {(() => {
                                  const fee = parseFloat(String(data["Course Fee"] || "0").replace(/[^0-9.]/g, ""));
                                  const enrolled = parseInt(String(data["Enrolled"] || data["Enrollments"] || "0").replace(/[^0-9.]/g, ""), 10);
                                  const discount = parseFloat(String(data["Discount"] || "0").replace(/[^0-9.]/g, ""));
                                  const expenses = parseFloat(String(data["Expenses"] || "0").replace(/[^0-9.]/g, ""));
                                  const gross = isNaN(fee) || isNaN(enrolled) ? 0 : fee * enrolled;
                                  const net = gross - (isNaN(discount) ? 0 : discount);
                                  const profit = net - (isNaN(expenses) ? 0 : expenses);
                                  return `৳ ${profit.toLocaleString()}`;
                                })()}
                              </span>
                            </div>
                          </div>
                          <div className="flex justify-between items-center mt-1">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Profit Margin</span>
                            <span className="text-[10px] font-bold text-slate-600">
                              {(() => {
                                const fee = parseFloat(String(data["Course Fee"] || "0").replace(/[^0-9.]/g, ""));
                                const enrolled = parseInt(String(data["Enrolled"] || data["Enrollments"] || "0").replace(/[^0-9.]/g, ""), 10);
                                const discount = parseFloat(String(data["Discount"] || "0").replace(/[^0-9.]/g, ""));
                                const expenses = parseFloat(String(data["Expenses"] || "0").replace(/[^0-9.]/g, ""));
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
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Calculated dynamically</span>
                        <div className="flex items-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-[8px] font-bold text-emerald-600 uppercase">Live Data</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "documents" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100">
                      <span className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">Course Documents</span>
                      {onSaveDocument && (
                        <button
                          onClick={() => {
                            setShowAddDocForm(!showAddDocForm);
                            setNewDocData({
                              "Date": new Date().toISOString().split('T')[0],
                              "Documents Title": "",
                              "File Link": "",
                              "Tag": data["Course Code"] || ""
                            });
                          }}
                          className="p-1 px-2 rounded-md hover:bg-slate-100 text-teal-600 hover:text-teal-700 transition-colors cursor-pointer flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider border border-teal-100 bg-teal-50/50"
                          title="Add New Document"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add</span>
                        </button>
                      )}
                    </div>

                    {/* Expandable Add Document Form */}
                    <AnimatePresence initial={false}>
                      {showAddDocForm && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.2 }}
                          className="bg-slate-50/50 border border-slate-200/60 rounded-xl p-3 space-y-2.5"
                        >
                          <span className="text-[8.5px] font-bold text-teal-800 uppercase tracking-wider block">New Document Information</span>
                          
                          <div className="space-y-2.5">
                            <div>
                              <label className="text-[7.5px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Document Title</label>
                              <input
                                type="text"
                                value={newDocData["Documents Title"] || ""}
                                onChange={(e) => setNewDocData({ ...newDocData, "Documents Title": e.target.value })}
                                placeholder="e.g. Course Syllabus"
                                className="w-full px-2.5 py-1.5 text-[10.5px] border border-slate-200 rounded-lg focus:border-teal-500 bg-white outline-none"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[7.5px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Date</label>
                                <input
                                  type="date"
                                  value={newDocData["Date"] || ""}
                                  onChange={(e) => setNewDocData({ ...newDocData, "Date": e.target.value })}
                                  className="w-full px-2.5 py-1.5 text-[10.5px] border border-slate-200 rounded-lg focus:border-teal-500 bg-white outline-none"
                                />
                              </div>
                              <div>
                                <label className="text-[7.5px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Tag (Auto)</label>
                                <input
                                  type="text"
                                  value={newDocData["Tag"] || ""}
                                  readOnly
                                  className="w-full px-2.5 py-1.5 text-[10.5px] border border-slate-200 rounded-lg bg-gray-100 text-gray-500 outline-none"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="text-[7.5px] font-bold text-slate-400 uppercase tracking-wider block mb-1">File Link / Upload</label>
                              <div className="flex gap-1.5">
                                <input
                                  type="text"
                                  value={newDocData["File Link"] || ""}
                                  onChange={(e) => setNewDocData({ ...newDocData, "File Link": e.target.value })}
                                  placeholder="Paste link or upload..."
                                  className="flex-1 px-2.5 py-1.5 text-[10.5px] border border-slate-200 rounded-lg focus:border-teal-500 bg-white outline-none"
                                />
                                <input
                                  type="file"
                                  ref={fileInputRef}
                                  className="hidden"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    setIsUploading(true);
                                    const formDataUpload = new FormData();
                                    formDataUpload.append("file", file);
                                    formDataUpload.append("folderPath", FOLDER_LOCATIONS.DOCUMENTS);
                                    formDataUpload.append("departmentName", file.name.replace(/\.[^/.]+$/, ""));

                                    try {
                                      const res = await axios.post("/api/upload", formDataUpload);
                                      if (res.data.url) {
                                        let viewUrl = res.data.url;
                                        if (viewUrl.includes("drive.google.com/uc") || viewUrl.includes("export=download")) {
                                          const fileIdMatch = viewUrl.match(/[?&]id=([^&]+)/);
                                          if (fileIdMatch && fileIdMatch[1]) {
                                            viewUrl = `https://drive.google.com/file/d/${fileIdMatch[1]}/view`;
                                          }
                                        }
                                        setNewDocData({ ...newDocData, "File Link": viewUrl });
                                      }
                                    } catch (err) {
                                      console.error("Upload failed:", err);
                                      alert("Upload failed.");
                                    } finally {
                                      setIsUploading(false);
                                    }
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => fileInputRef.current?.click()}
                                  disabled={isUploading}
                                  className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg border border-gray-200 transition-colors disabled:opacity-50"
                                >
                                  {isUploading ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Upload className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setShowAddDocForm(false)}
                              className="flex-1 py-1.5 bg-white text-slate-600 text-[10px] font-bold uppercase rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={isSavingDoc}
                              onClick={async () => {
                                if (!newDocData["Documents Title"]) {
                                  alert("Please specify a document title.");
                                  return;
                                }
                                setIsSavingDoc(true);
                                try {
                                  if (onSaveDocument) {
                                    await onSaveDocument(newDocData, null);
                                    setShowAddDocForm(false);
                                  }
                                } catch (err) {
                                  console.error("Failed to save document:", err);
                                } finally {
                                  setIsSavingDoc(false);
                                }
                              }}
                              className="flex-1 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-[10px] font-bold uppercase rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-70"
                            >
                              {isSavingDoc ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Save className="w-3.5 h-3.5" />
                              )}
                              <span>Save</span>
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {(() => {
                      const courseCode = data["Course Code"];
                      const courseDocs = (allDocuments || []).filter(
                        (doc: any) => String(doc["Tag"] || "").trim().toLowerCase() === String(courseCode || "").trim().toLowerCase()
                      );

                      if (courseDocs.length === 0) {
                        return (
                          <div className="py-8 px-4 text-center rounded-xl border border-dashed border-slate-100 bg-slate-50/30">
                            <span className="text-gray-400 text-[10px] font-bold block mb-1">NO DOCUMENTS FOUND</span>
                            <p className="text-gray-400/70 text-[9px] italic">No documents tagged with this course code yet.</p>
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-2">
                          {courseDocs.map((doc: any, index: number) => (
                            <div 
                              key={index}
                              className="bg-white border border-slate-150/60 rounded-xl p-3 shadow-3xs hover:shadow-2xs transition-all duration-200"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-[10px] font-bold text-slate-800 truncate uppercase tracking-tight">
                                    {doc["Documents Title"] || "Untitled Document"}
                                  </h4>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[8px] font-bold text-slate-400 flex items-center gap-1">
                                      <Calendar className="w-2.5 h-2.5" />
                                      {doc["Date"] ? formatToMmmDdYyyy(doc["Date"]) : "—"}
                                    </span>
                                    <span className="text-[8px] font-bold text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-100/50 uppercase tracking-widest">
                                      {doc["Tag"]}
                                    </span>
                                  </div>
                                </div>
                                {doc["File Link"] && (
                                  <a 
                                    href={doc["File Link"]} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="p-2 bg-teal-50 text-teal-600 rounded-lg hover:bg-teal-100 transition-colors border border-teal-100/50"
                                    title="View File"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}

              </div>
            ) : (
              <div className="space-y-4">
                {headers
                  .map((header) => (
                    <div key={header} className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">{header}</label>
                      <div className="text-xs text-gray-900 ml-1">
                        {formatValue(header, data[header])}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
