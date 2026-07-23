import React, { useState, useMemo } from "react";
import { Briefcase, Layers, Upload, X, Loader2, FileText, Plus, Paperclip } from "lucide-react";
import EmployeeMultiSelect from "./EmployeeMultiSelect";
import { FOLDER_LOCATIONS } from "../FolderLocation";
import axios from "axios";
import { motion, AnimatePresence } from "motion/react";
import { getStageAssignment } from "../lib/utils";

const getPhotoUrl = (emp: any) => {
  if (!emp) return 'https://ui-avatars.com/api/?name=User';
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

interface WorkflowStage {
  "Workflow Stage"?: string;
  "Deliverables"?: string;
  [key: string]: any;
}

interface WorkflowTimelineProps {
  stages: WorkflowStage[];
  stageAssignments: Record<string, string[]>;
  isEditing?: boolean;
  employees?: any[];
  onStageAssignmentChange: (stageName: string, selectedEmployeeIds: string[]) => void;
  placement?: 'bottom' | 'top' | 'right-sidebar';
  jobTitle?: string;
  batch?: any;
  courseCode?: string;
  documents?: any[];
  onSaveDocument?: (formData: any, editingRow: any | null) => Promise<void>;
  viewType?: 'course' | 'batch';
  onViewDocuments?: (filter: string) => void;
}

export default function WorkflowTimeline({
  stages,
  stageAssignments,
  isEditing = false,
  employees = [],
  onStageAssignmentChange,
  placement = "bottom",
  jobTitle = "",
  batch,
  courseCode,
  documents = [],
  onSaveDocument,
  viewType = 'batch',
  onViewDocuments
}: WorkflowTimelineProps) {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedDeliverable, setSelectedDeliverable] = useState("");
  const [selectedStageName, setSelectedStageName] = useState("");
  const [docTitle, setDocTitle] = useState("");
  const [fileLink, setFileLink] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setErrorMsg("");
    const formDataUpload = new FormData();
    formDataUpload.append("file", file);
    formDataUpload.append("folderPath", FOLDER_LOCATIONS.DOCUMENTS);
    try {
      const response = await axios.post("/api/upload", formDataUpload);
      if (response.data.url) {
        let viewUrl = response.data.url;
        if (viewUrl.includes("drive.google.com/uc") || viewUrl.includes("export=download")) {
          const fileIdMatch = viewUrl.match(/[?&]id=([^&]+)/);
          if (fileIdMatch && fileIdMatch[1]) {
            viewUrl = `https://drive.google.com/file/d/${fileIdMatch[1]}/view`;
          }
        }
        setFileLink(viewUrl);
        // Pre-fill a good default title if empty
        if (!docTitle) {
          const cleanFileName = file.name.split('.').slice(0, -1).join('.') || file.name;
          setDocTitle(cleanFileName);
        }
      } else {
        setErrorMsg("Failed to upload file. No URL returned.");
      }
    } catch (err) {
      setErrorMsg("Failed to upload file.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveDocument = async () => {
    if (!docTitle.trim()) {
      setErrorMsg("Document Title is required");
      return;
    }
    if (!fileLink.trim()) {
      setErrorMsg("File Link/Upload is required");
      return;
    }
    setErrorMsg("");
    setIsSubmitting(true);
    try {
      const tag = viewType === 'batch'
        ? `${batch["Course Code"] || ""}-${batch["Batch Number"] || ""}-${selectedStageName}-${selectedDeliverable}`
        : `${batch["Course Code"] || ""}-${selectedStageName}-${selectedDeliverable}`;

      const docToSave = {
        "Documents Title": docTitle.trim(),
        "File Link": fileLink.trim(),
        "Date": new Date().toISOString().split('T')[0],
        "Tag": tag,
        "Course Code": batch["Course Code"] || "",
        "Course Name": batch["Course Title"] || ""
      };
      if (onSaveDocument) {
        await onSaveDocument(docToSave, null);
      }
      setIsUploadModalOpen(false);
      setFileLink("");
      setDocTitle("");
    } catch (err) {
      setErrorMsg("Failed to save document. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatToMmmDdYyyy = (dateStr: string) => {
    try {
      if (!dateStr) return "";
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const monthIndex = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const date = new Date(year, monthIndex, day);
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString("en-US", {
            month: "short",
            day: "2-digit",
            year: "numeric"
          });
        }
      }
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric"
      });
    } catch (e) {
      return dateStr;
    }
  };

  if (stages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center border border-dashed border-slate-200 rounded-md bg-slate-50/50">
        <Briefcase className="w-8 h-8 text-slate-300 mb-2" />
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">No Stages Found</span>
        <p className="text-[9px] text-slate-400 mt-1">
          {jobTitle ? `No workflow stages defined for "${jobTitle}".` : "No workflow stages defined."}
        </p>
      </div>
    );
  }

  return (
    <div className="relative pl-1 pt-1 space-y-4">
      {/* Timeline line */}
      <div className="absolute left-[13px] top-[14px] bottom-4 w-0.5 bg-slate-200" />
      
      {stages.map((stage, idx) => {
        const stageName = stage["Workflow Stage"] || "Unnamed Stage";
        const currentSelectedEmployeeIds = stageAssignments[stage["ID"]] || getStageAssignment(stageAssignments, stageName) || [];
        
        return (
          <div key={idx} className="relative flex gap-3.5 items-start">
            {/* Timeline bullet */}
            <div className="relative shrink-0 z-10 pt-0.5">
              <div className="w-5 h-5 rounded-full border-2 border-teal-600 bg-white flex items-center justify-center font-mono text-[9px] font-bold text-teal-600 shadow-3xs">
                {idx + 1}
              </div>
            </div>

            {/* Stage Box */}
            <div className="flex-1 min-w-0 pt-0.5 bg-white border border-slate-200 pt-3.5 pb-2.5 px-2.5 rounded-md">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  <span>{(stage["Workflow Stage"] || "Unnamed Stage").replace(/^\d+\.\s*/, '')}</span>
                </span>
                
                {(() => {
                  const deliverablesList = (() => {
                    const str = String(stage["Deliverables"] || "");
                    let items = str.split(/[\n|;]+/);
                    if (items.length === 1 && str.includes(',')) {
                      items = str.split(',');
                    }
                    return items.map(item => item.trim()).filter(item => item.length > 0);
                  })();
                  
                  if (deliverablesList.length === 0) return null;

                  const stageName = stage["Workflow Stage"] || "";
                  const cleanStageName = stageName.replace(/^\d+\.\s*/, '');

                  const targetCourseCode = String(courseCode || batch?.["Course Code"] || "").trim().toUpperCase();
                  const targetBatchNum = String(batch?.["Batch Number"] || batch?.["Batch"] || "").trim().toUpperCase();

                  const submittedCount = deliverablesList.filter(item => {
                    const normItem = item.trim().toUpperCase();
                    return documents.some(doc => {
                      const tag = String(doc["Tag"] || "").toUpperCase();
                      const title = String(doc["Documents Title"] || doc["Document Title"] || doc["Title"] || "").toUpperCase();
                      const docCourseCode = String(doc["Course Code"] || "").trim().toUpperCase();
                      const docBatchNum = String(doc["Batch Number"] || doc["Batch"] || "").trim().toUpperCase();

                      if (targetCourseCode) {
                        const matchesCourse = 
                          docCourseCode === targetCourseCode || 
                          tag.includes(targetCourseCode) || 
                          title.includes(targetCourseCode);
                        if (!matchesCourse) return false;
                      }

                      if (viewType === 'batch' && targetBatchNum) {
                        const matchesBatch = 
                          docBatchNum === targetBatchNum || 
                          tag.includes(`BATCH ${targetBatchNum}`) || 
                          tag.includes(`BATCH-${targetBatchNum}`) || 
                          tag.includes(`BATCH:${targetBatchNum}`) || 
                          tag.includes(`BATCH ${targetBatchNum},`) || 
                          tag.includes(`BATCH ${targetBatchNum} `) ||
                          title.includes(`BATCH ${targetBatchNum}`) ||
                          title.includes(`BATCH-${targetBatchNum}`);
                        if (!matchesBatch) return false;
                      }

                      if (targetCourseCode) {
                        const cPrefix = `${targetCourseCode}-${stageName}-${item}`.toUpperCase();
                        if (tag.startsWith(cPrefix)) return true;
                        if (targetBatchNum) {
                          const bPrefix = `${targetCourseCode}-${targetBatchNum}-${stageName}-${item}`.toUpperCase();
                          if (tag.startsWith(bPrefix)) return true;
                        }
                      }

                      const normStage = stageName.trim().toUpperCase();
                      const normCleanStage = cleanStageName.trim().toUpperCase();

                      const titleMatches = title === normItem || title.includes(normItem) || tag.includes(normItem);
                      const stageMatches = !normStage || tag.includes(normStage) || tag.includes(normCleanStage) || title.includes(normStage) || title.includes(normCleanStage);

                      return titleMatches && stageMatches;
                    });
                  }).length;

                  const allSubmitted = submittedCount === deliverablesList.length;
                  const someSubmitted = submittedCount > 0;

                  return (
                    <button
                      type="button"
                      onClick={() => {
                        if (onViewDocuments) {
                          const cleanStage = (stage["Workflow Stage"] || "").replace(/^\d+\.\s*/, '');
                          const fullStage = stage["Workflow Stage"] || "";
                          onViewDocuments(cleanStage || fullStage);
                        }
                      }}
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full cursor-pointer transition-colors ${allSubmitted ? 'bg-teal-100 text-teal-700 hover:bg-teal-200' : someSubmitted ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                    >
                      {submittedCount}/{deliverablesList.length}
                    </button>
                  );
                })()}
              </div>

              {/* Deliverables */}
              {stage["Deliverables"] && (() => {
                const deliverablesList = (() => {
                  const str = String(stage["Deliverables"] || "");
                  let items = str.split(/[\n|;]+/);
                  if (items.length === 1 && str.includes(',')) {
                    items = str.split(',');
                  }
                  return items.map(item => item.trim()).filter(item => item.length > 0);
                })();

                if (deliverablesList.length === 0) return null;

                return (
                  <div className="mt-1.5 text-[9px] leading-relaxed pl-5">
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                      {deliverablesList.map((item, index) => (
                        <React.Fragment key={index}>
                          {index > 0 && <span className="text-slate-300 font-light select-none">|</span>}
                          <button
                            type="button"
                            onClick={() => {
                              if (batch && onSaveDocument) {
                                setSelectedDeliverable(item);
                                setSelectedStageName(stage["Workflow Stage"] || "");
                                setDocTitle(`${item} - ${batch["Batch Number"]}`);
                                setFileLink("");
                                setErrorMsg("");
                                setIsUploadModalOpen(true);
                              }
                            }}
                            className="text-teal-600 hover:text-teal-800 hover:underline transition-colors cursor-pointer font-semibold inline-flex items-center gap-0.5"
                            title="Click to upload or view documents"
                          >
                            <span>{item}</span>
                            <Plus className="w-2 h-2 text-teal-400 shrink-0" />
                          </button>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                );
              })()}
              
              
              {/* Assignees */}
              {(() => {
                const assignedIds = stageAssignments[stage["ID"]] || getStageAssignment(stageAssignments, stage["Workflow Stage"] || "Unnamed Stage") || [];
                
                return isEditing ? (
                  <div className="mt-2 space-y-2">
                    <EmployeeMultiSelect
                      selectedIds={assignedIds}
                      onChange={(ids) => onStageAssignmentChange(stage["ID"], ids)}
                      employees={employees}
                      placement={placement}
                    />
                    {assignedIds.length > 0 && (
                      <div className="pt-2 border-t border-slate-100 space-y-1.5 mt-2">
                        {assignedIds.map((id) => {
                          const [empIdStr, assignedDate] = String(id).split('|');
                          const emp = employees.find(e => String(e['Employee ID'] || '').trim() === empIdStr.trim());
                          if (!emp) return null;
                          const designation = emp['Designation'] || emp['Administrative Designation'] || emp['Administrative'] || '';
                          return (
                            <div key={id} className="flex items-center gap-2 bg-slate-50 p-1.5 rounded border border-slate-100" title={emp['Employee Name']}>
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
                                <div className="flex justify-between items-center">
                                  <span className="text-[11px] font-bold text-slate-800 block truncate leading-snug">
                                    {emp['Employee Name']}
                                  </span>
                                  {assignedDate && (
                                    <span className="text-[9px] text-teal-600 bg-teal-50 px-1 py-0.5 rounded border border-teal-100 whitespace-nowrap ml-1">
                                      {formatToMmmDdYyyy(assignedDate)}
                                    </span>
                                  )}
                                </div>
                                {designation && (
                                  <span className="text-[9px] text-slate-500 block truncate leading-none mt-0.5">
                                    {designation}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  assignedIds.length > 0 ? (
                    <div className="mt-2 space-y-1.5">
                      {assignedIds.map((id) => {
                        const [empIdStr, assignedDate] = String(id).split('|');
                        const emp = employees.find(e => String(e['Employee ID'] || '').trim() === empIdStr.trim());
                        if (!emp) return null;
                        const designation = emp['Designation'] || emp['Administrative Designation'] || emp['Administrative'] || '';
                        return (
                          <div key={id} className="flex items-center gap-2 bg-slate-50 p-1.5 rounded border border-slate-100" title={emp['Employee Name']}>
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
                              <div className="flex justify-between items-center">
                                <span className="text-[11px] font-bold text-slate-800 block truncate leading-snug">
                                  {emp['Employee Name']}
                                </span>
                                {assignedDate && (
                                  <span className="text-[9px] text-teal-600 bg-teal-50 px-1 py-0.5 rounded border border-teal-100 whitespace-nowrap ml-1">
                                    {formatToMmmDdYyyy(assignedDate)}
                                  </span>
                                )}
                              </div>
                              {designation && (
                                <span className="text-[9px] text-slate-500 block truncate leading-none mt-0.5">
                                  {designation}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <span className="text-[8px] text-slate-400 italic block mt-1">No employee assigned</span>
                  )
                );
              })()}
            </div>
          </div>
        );
      })}

      <AnimatePresence>
        {isUploadModalOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="w-full max-w-md bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    Add Document
                  </h3>
                  <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                    Stage: {selectedStageName.replace(/^\d+\.\s*/, '')} | {selectedDeliverable}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors p-1 hover:bg-slate-100 rounded-full cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-4 space-y-4 text-left">
                {errorMsg && (
                  <div className="bg-red-50 text-red-600 text-[10px] font-semibold px-3 py-2 rounded-lg border border-red-200">
                    {errorMsg}
                  </div>
                )}

                {/* Document Title */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Document Title
                  </label>
                  <input
                    type="text"
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                    placeholder="Enter document title"
                    className="w-full text-xs font-medium p-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-teal-500"
                  />
                </div>

                {/* File Upload or Link */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    File Upload
                  </label>
                  
                  <div className="flex gap-2">
                    {/* Upload File button */}
                    <label className="flex items-center justify-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg border border-slate-200 cursor-pointer transition-all flex-1">
                      {isUploading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600" />
                          <span className="text-teal-600">Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5 text-slate-500" />
                          <span>Choose File</span>
                        </>
                      )}
                      <input
                        type="file"
                        className="hidden"
                        onChange={handleFileUpload}
                        disabled={isUploading}
                      />
                    </label>
                  </div>

                  <div className="relative mt-2">
                    <div className="absolute left-2.5 top-2.5 text-slate-400">
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type="url"
                      value={fileLink}
                      onChange={(e) => setFileLink(e.target.value)}
                      placeholder="Or enter File Link / URL"
                      className="w-full text-xs font-medium pl-8 pr-2 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-teal-500"
                    />
                  </div>

                  {fileLink && (
                    <div className="bg-teal-50/50 border border-teal-100 rounded-lg p-2 flex items-center justify-between mt-1">
                      <span className="text-[10px] text-teal-700 font-medium truncate max-w-[280px]">
                        Link: {fileLink}
                      </span>
                      <button
                        type="button"
                        onClick={() => setFileLink("")}
                        className="text-teal-600 hover:text-teal-800 text-[10px] font-bold cursor-pointer hover:underline"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-bold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveDocument}
                  disabled={isSubmitting || isUploading}
                  className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Document</span>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
