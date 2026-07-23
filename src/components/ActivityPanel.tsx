import React, { useMemo, useState, useEffect, useRef } from "react";
import Table from "./Table";
import { parseWorkflowAndStages, parseWorkflowTitle, serializeWorkflowAndStages, cn, formatToMmmDdYyyy } from "../lib/utils";
import { Pencil, User, ChevronDown, Calendar, Clock, ClipboardList, CheckCircle2, ShieldCheck, Layers, BookOpen, AlertCircle, FileText, CheckSquare, Sparkles } from "lucide-react";
import { ActivityDetailView } from "./ActivityDetailView";
import { AnimatePresence } from "motion/react";

interface ActivityPanelProps {
  courseData: any[];
  mcBatchData: any[];
  employees: any[];
  workflowData: any[];
  onSaveCourse: (formData: any, editingRow: any | null) => Promise<void>;
  onSaveBatch: (formData: any, editingRow: any | null) => Promise<void>;
  documents?: any[];
  onSaveDocument?: (formData: any, editingRow: any | null) => Promise<void>;
  onViewFile?: (url: string, title: string, doc?: any) => void;
}

// Dummy FormPanel to satisfy Table requirements
const EmptyPanel = () => null;

const getThumbnail = (photoUrl: string) => {
  if (!photoUrl) return "";
  const fileIdMatch = photoUrl.match(/[-\w]{25,}/);
  if (fileIdMatch) {
    return `https://drive.google.com/thumbnail?id=${fileIdMatch[0]}&sz=w200`;
  }
  return photoUrl;
};

const getDeadlineStatus = (deadlineStr: string) => {
  if (!deadlineStr || deadlineStr === "-") return null;
  const target = new Date(deadlineStr);
  if (isNaN(target.getTime())) return null;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  
  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return {
      text: `Overdue by ${Math.abs(diffDays)}d`,
      className: "bg-rose-50 text-rose-700 border-rose-200"
    };
  } else if (diffDays === 0) {
    return {
      text: "Due Today",
      className: "bg-amber-50 text-amber-700 border-amber-200 animate-pulse"
    };
  } else if (diffDays <= 3) {
    return {
      text: `${diffDays} days left`,
      className: "bg-amber-50 text-amber-700 border-amber-200 font-semibold"
    };
  } else {
    return {
      text: `${diffDays} days left`,
      className: "bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold"
    };
  }
};

const EditableDateCell = ({
  initialValue,
  onSaveDate
}: {
  initialValue: string;
  onSaveDate: (newDate: string) => Promise<void>;
}) => {
  const [val, setVal] = useState(() => {
    if (!initialValue || initialValue === "-") return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(initialValue)) return initialValue;
    const d = new Date(initialValue);
    if (isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  });

  const handleSave = async (newDate: string) => {
    try {
      await onSaveDate(newDate);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="relative inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <input
        type="date"
        value={val}
        onChange={(e) => {
            const newDate = e.target.value;
            setVal(newDate);
            handleSave(newDate);
        }}
        className="px-1.5 py-0.5 text-[11px] bg-white border border-gray-300 rounded text-gray-700 focus:outline-none focus:border-teal-500 cursor-pointer shadow-sm w-32 font-medium"
      />
    </div>
  );
};

const EditableEmployeeCell = ({
  currentEmpId,
  currentEmpName,
  employees,
  onSaveEmployee
}: {
  currentEmpId: string;
  currentEmpName: string;
  employees: any[];
  onSaveEmployee: (newEmpId: string) => Promise<void>;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const filteredEmployees = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return employees;
    return employees.filter(emp => {
      const name = String(emp["Employee Name"] || "").toLowerCase();
      const id = String(emp["Employee ID"] || "").toLowerCase();
      const designation = String(emp["Designation"] || "").toLowerCase();
      return name.includes(term) || id.includes(term) || designation.includes(term);
    });
  }, [employees, search]);

  const handleSelect = async (newEmpId: string) => {
    if (newEmpId === currentEmpId) {
      setIsOpen(false);
      return;
    }
    setIsSaving(true);
    try {
      await onSaveEmployee(newEmpId);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full" onClick={(e) => e.stopPropagation()}>
      <div
        onClick={() => !isSaving && setIsOpen(!isOpen)}
        className={cn(
          "px-2 py-1.5 text-[11px] border border-gray-300 rounded focus:border-teal-500 outline-none bg-white cursor-pointer font-medium flex items-center justify-between shadow-xs hover:border-gray-400 hover:shadow-xs transition-all w-full min-w-[160px] max-w-[220px]",
          isSaving && "opacity-60 cursor-not-allowed"
        )}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="truncate text-gray-800 font-bold">{currentEmpName}</span>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0 ml-1.5" />
      </div>

      {isOpen && (
        <div className="absolute left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 flex flex-col w-64 max-h-64 overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-gray-100 flex items-center gap-1.5 shrink-0 bg-gray-50/50">
            <input
              type="text"
              placeholder="Search employee..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded px-2 py-1 text-[11px] outline-none focus:border-teal-500"
              autoFocus
            />
          </div>

          {/* List */}
          <div className="overflow-y-auto py-1 max-h-48 no-scrollbar flex-1">
            {filteredEmployees.length > 0 ? (
              filteredEmployees.map((emp, idx) => {
                const id = String(emp["Employee ID"] || "");
                const isSelected = id === currentEmpId;
                const photo = emp["Photo"];
                const thumb = getThumbnail(photo);

                return (
                  <div
                    key={`${id}-${idx}`}
                    onClick={() => handleSelect(id)}
                    className={cn(
                      "px-3 py-1.5 cursor-pointer flex items-center gap-2 transition-colors",
                      isSelected
                        ? "bg-teal-50 text-teal-950 font-bold"
                        : "text-gray-700 hover:bg-gray-50"
                    )}
                  >
                    <div className="w-6 h-6 rounded bg-gray-100 border border-gray-200 overflow-hidden shrink-0 flex items-center justify-center">
                      {photo ? (
                        <img
                          src={thumb}
                          alt=""
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span className="text-[8px] text-gray-400 font-bold">Pic</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] truncate">{emp["Employee Name"]}</div>
                      <div className="text-[9px] text-gray-400 truncate">{emp["Designation"]}</div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="px-3 py-3 text-xs text-gray-400 text-center">
                No employees found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default function ActivityPanel({ 
  courseData, 
  mcBatchData, 
  employees, 
  workflowData,
  onSaveCourse,
  onSaveBatch,
  documents,
  onSaveDocument,
  onViewFile
}: ActivityPanelProps) {
  const [isEditing, setIsEditing] = useState(false);

  const getDocStatus = (doc: any) => {
    if (!doc) return { text: "Review", color: "bg-teal-100 text-teal-800" };
    const tag = String(doc["Tag"] || doc["Status"] || "");
    if (tag.includes("Revision Required") || tag.includes("Revision")) return { text: "Revision", color: "bg-amber-100 text-amber-800" };
    if (tag.includes("Verified") || tag.includes("Job Done") || tag.includes("Approved")) return { text: "Verified", color: "bg-green-100 text-green-800" };
    return { text: "Review", color: "bg-teal-100 text-teal-800" };
  };

  const getAnyDocForActivity = (row: any) => {
    if (!documents) return null;
    const empId = String(row["Employee ID"] || "GENERAL").toUpperCase();
    const code = String(row["Course Code"] || row["Code"] || "N/A").toUpperCase();
    const batchNum = row["Batch Number"];
    const batchInfo = (row["Type"] === "Batch" && batchNum ? `Batch ${batchNum}` : "Course").toUpperCase();
    const stageName = String(row["_actualStageName"] || "").toUpperCase();
    const deliverables = row["deliverablesList"] || [];
    
    for (const deliv of deliverables) {
       const normDeliv = String(deliv).trim().toUpperCase();
       const doc = documents.find(d => {
          const title = String(d["Documents Title"] || d["Document Name"] || d["Title"] || "").toUpperCase();
          const tag = String(d["Tag"] || "").toUpperCase();
          const fullText = `${title} ${tag}`;

          const matchesDeliv = title === normDeliv || title.includes(normDeliv) || tag.includes(normDeliv);
          const matchesMetadata = 
            (tag.includes(code) || title.includes(code)) &&
            (tag.includes(empId) || title.includes(empId)) &&
            (tag.includes(stageName) || title.includes(stageName));

          if (matchesDeliv && matchesMetadata) return true;

          const expectedTitle = `${code} - ${batchInfo} - EMP ${empId} - ${stageName} - ${normDeliv}`;
          return title === expectedTitle || (fullText.includes(code) && fullText.includes(empId) && fullText.includes(stageName) && fullText.includes(normDeliv));
       });
       if (doc) return doc;
    }
    return null;
  };

  const handleSaveDeadline = async (activityRow: any, newDeadline: string) => {
    const isCourse = activityRow["Type"] === "Course";
    const code = activityRow["Code"];
    const batchNum = activityRow["Batch Number"];
    const stageName = activityRow["_stageName"];
    const empId = activityRow["Employee ID"];

    if (isCourse) {
      const originalCourse = courseData.find(c => c["Course Code"] === code);
      if (!originalCourse) return;

      const workflowStr = originalCourse["Workflow"] || originalCourse["Publication Workflow"] || "";
      const { jobTitle, stageAssignments } = parseWorkflowAndStages(workflowStr);

      let foundKey = Object.keys(stageAssignments).find(key => {
        const cleanKey = key.replace(/^\d+\.\s*/, '').trim();
        return cleanKey.toLowerCase() === stageName.toLowerCase();
      });

      if (!foundKey) {
        foundKey = stageName;
      }

      const currentAssignments = stageAssignments[foundKey] || [];
      const updatedAssignments = currentAssignments.map(idStr => {
        const parts = String(idStr).split('|');
        const currentEmpId = parts[0].trim();
        if (currentEmpId === String(empId).trim()) {
          const assignedDate = parts[1] || "";
          return `${currentEmpId}|${assignedDate}|${newDeadline}`;
        }
        return idStr;
      });

      stageAssignments[foundKey] = updatedAssignments;
      const updatedWorkflowStr = serializeWorkflowAndStages(jobTitle, stageAssignments);

      const updatedCourse = {
        ...originalCourse,
        "Workflow": updatedWorkflowStr,
        "Publication Workflow": updatedWorkflowStr
      };

      await onSaveCourse(updatedCourse, originalCourse);
    } else {
      const originalBatch = mcBatchData.find(b => b["Course Code"] === code && b["Batch Number"] === batchNum);
      if (!originalBatch) return;

      const workflowStr = originalBatch["Workflow"] || originalBatch["Publication Workflow"] || "";
      const { jobTitle, stageAssignments } = parseWorkflowAndStages(workflowStr);

      let foundKey = Object.keys(stageAssignments).find(key => {
        const cleanKey = key.replace(/^\d+\.\s*/, '').trim();
        return cleanKey.toLowerCase() === stageName.toLowerCase();
      });

      if (!foundKey) {
        foundKey = stageName;
      }

      const currentAssignments = stageAssignments[foundKey] || [];
      const updatedAssignments = currentAssignments.map(idStr => {
        const parts = String(idStr).split('|');
        const currentEmpId = parts[0].trim();
        if (currentEmpId === String(empId).trim()) {
          const assignedDate = parts[1] || "";
          return `${currentEmpId}|${assignedDate}|${newDeadline}`;
        }
        return idStr;
      });

      stageAssignments[foundKey] = updatedAssignments;
      const updatedWorkflowStr = serializeWorkflowAndStages(jobTitle, stageAssignments);

      const updatedBatch = {
        ...originalBatch,
        "Workflow": updatedWorkflowStr,
        "Publication Workflow": updatedWorkflowStr
      };

      await onSaveBatch(updatedBatch, originalBatch);
    }
  };

  const handleSaveAssignedDate = async (activityRow: any, newAssignedDate: string) => {
    const isCourse = activityRow["Type"] === "Course";
    const code = activityRow["Code"];
    const batchNum = activityRow["Batch Number"];
    const stageName = activityRow["_stageName"];
    const empId = activityRow["Employee ID"];

    if (isCourse) {
      const originalCourse = courseData.find(c => c["Course Code"] === code);
      if (!originalCourse) return;

      const workflowStr = originalCourse["Workflow"] || originalCourse["Publication Workflow"] || "";
      const { jobTitle, stageAssignments } = parseWorkflowAndStages(workflowStr);

      let foundKey = Object.keys(stageAssignments).find(key => {
        const cleanKey = key.replace(/^\d+\.\s*/, '').trim();
        return cleanKey.toLowerCase() === stageName.toLowerCase();
      });

      if (!foundKey) {
        foundKey = stageName;
      }

      const currentAssignments = stageAssignments[foundKey] || [];
      const updatedAssignments = currentAssignments.map(idStr => {
        const parts = String(idStr).split('|');
        const currentEmpId = parts[0].trim();
        if (currentEmpId === String(empId).trim()) {
          const deadline = parts[2] || "";
          return `${currentEmpId}|${newAssignedDate}|${deadline}`;
        }
        return idStr;
      });

      stageAssignments[foundKey] = updatedAssignments;
      const updatedWorkflowStr = serializeWorkflowAndStages(jobTitle, stageAssignments);

      const updatedCourse = {
        ...originalCourse,
        "Workflow": updatedWorkflowStr,
        "Publication Workflow": updatedWorkflowStr
      };

      await onSaveCourse(updatedCourse, originalCourse);
    } else {
      const originalBatch = mcBatchData.find(b => b["Course Code"] === code && b["Batch Number"] === batchNum);
      if (!originalBatch) return;

      const workflowStr = originalBatch["Workflow"] || originalBatch["Publication Workflow"] || "";
      const { jobTitle, stageAssignments } = parseWorkflowAndStages(workflowStr);

      let foundKey = Object.keys(stageAssignments).find(key => {
        const cleanKey = key.replace(/^\d+\.\s*/, '').trim();
        return cleanKey.toLowerCase() === stageName.toLowerCase();
      });

      if (!foundKey) {
        foundKey = stageName;
      }

      const currentAssignments = stageAssignments[foundKey] || [];
      const updatedAssignments = currentAssignments.map(idStr => {
        const parts = String(idStr).split('|');
        const currentEmpId = parts[0].trim();
        if (currentEmpId === String(empId).trim()) {
          const deadline = parts[2] || "";
          return `${currentEmpId}|${newAssignedDate}|${deadline}`;
        }
        return idStr;
      });

      stageAssignments[foundKey] = updatedAssignments;
      const updatedWorkflowStr = serializeWorkflowAndStages(jobTitle, stageAssignments);

      const updatedBatch = {
        ...originalBatch,
        "Workflow": updatedWorkflowStr,
        "Publication Workflow": updatedWorkflowStr
      };

      await onSaveBatch(updatedBatch, originalBatch);
    }
  };

  const handleSaveEmployee = async (activityRow: any, newEmpId: string) => {
    const isCourse = activityRow["Type"] === "Course";
    const code = activityRow["Code"];
    const batchNum = activityRow["Batch Number"];
    const stageName = activityRow["_stageName"];
    const oldEmpId = activityRow["Employee ID"];

    if (isCourse) {
      const originalCourse = courseData.find(c => c["Course Code"] === code);
      if (!originalCourse) return;

      const workflowStr = originalCourse["Workflow"] || originalCourse["Publication Workflow"] || "";
      const { jobTitle, stageAssignments } = parseWorkflowAndStages(workflowStr);

      let foundKey = Object.keys(stageAssignments).find(key => {
        const cleanKey = key.replace(/^\d+\.\s*/, '').trim();
        return cleanKey.toLowerCase() === stageName.toLowerCase();
      });

      if (!foundKey) {
        foundKey = stageName;
      }

      const currentAssignments = stageAssignments[foundKey] || [];
      const updatedAssignments = currentAssignments.map(idStr => {
        const parts = String(idStr).split('|');
        const currentEmpId = parts[0].trim();
        if (currentEmpId === String(oldEmpId).trim()) {
          const assignedDate = parts[1] || "";
          const deadline = parts[2] || "";
          return `${newEmpId}|${assignedDate}|${deadline}`;
        }
        return idStr;
      });

      stageAssignments[foundKey] = updatedAssignments;
      const updatedWorkflowStr = serializeWorkflowAndStages(jobTitle, stageAssignments);

      const updatedCourse = {
        ...originalCourse,
        "Workflow": updatedWorkflowStr,
        "Publication Workflow": updatedWorkflowStr
      };

      await onSaveCourse(updatedCourse, originalCourse);
    } else {
      const originalBatch = mcBatchData.find(b => b["Course Code"] === code && b["Batch Number"] === batchNum);
      if (!originalBatch) return;

      const workflowStr = originalBatch["Workflow"] || originalBatch["Publication Workflow"] || "";
      const { jobTitle, stageAssignments } = parseWorkflowAndStages(workflowStr);

      let foundKey = Object.keys(stageAssignments).find(key => {
        const cleanKey = key.replace(/^\d+\.\s*/, '').trim();
        return cleanKey.toLowerCase() === stageName.toLowerCase();
      });

      if (!foundKey) {
        foundKey = stageName;
      }

      const currentAssignments = stageAssignments[foundKey] || [];
      const updatedAssignments = currentAssignments.map(idStr => {
        const parts = String(idStr).split('|');
        const currentEmpId = parts[0].trim();
        if (currentEmpId === String(oldEmpId).trim()) {
          const assignedDate = parts[1] || "";
          const deadline = parts[2] || "";
          return `${newEmpId}|${assignedDate}|${deadline}`;
        }
        return idStr;
      });

      stageAssignments[foundKey] = updatedAssignments;
      const updatedWorkflowStr = serializeWorkflowAndStages(jobTitle, stageAssignments);

      const updatedBatch = {
        ...originalBatch,
        "Workflow": updatedWorkflowStr,
        "Publication Workflow": updatedWorkflowStr
      };

      await onSaveBatch(updatedBatch, originalBatch);
    }
  };

  const activityData = useMemo(() => {
    const activities: any[] = [];

    const processWorkflow = (items: any[], type: string) => {
      items.forEach((item) => {
        const workflowStr = item["Workflow"] || item["Publication Workflow"] || "";
        if (!workflowStr) return;
        
        const { jobTitle, stageAssignments } = parseWorkflowAndStages(workflowStr);
        
        const workflowDef = workflowData.find(w => {
          const parsed = parseWorkflowTitle(w["Workflow Title"], w.id);
          return parsed.id === jobTitle || parsed.title.trim().toLowerCase() === jobTitle.trim().toLowerCase();
        });
        
        const { stages: structuredStages } = workflowDef ? parseWorkflowTitle(workflowDef["Workflow Title"], workflowDef.id) : parseWorkflowTitle(workflowStr);
        
        Object.entries(stageAssignments).forEach(([stageNameOrId, employeeIds]) => {
          let cleanStageName = stageNameOrId.replace(/^\d+\.\s*/, '').trim();
          const structuredStage = structuredStages.find(s => 
            s.id === stageNameOrId || 
            s.stageName.replace(/^\d+\.\s*/, '').trim() === cleanStageName
          );
          
          if (structuredStage) {
            cleanStageName = structuredStage.stageName.replace(/^\d+\.\s*/, '').trim();
          }

          (employeeIds as string[]).forEach((idStr) => {
            const [empId, assignedDate, deadline] = String(idStr).split('|');
            const emp = employees.find(e => String(e['Employee ID'] || '').trim() === empId.trim());
            const currentDeadline = deadline || "";

            const rowRef = {
              "Type": type,
              "Code": item["Course Code"],
              "Batch Number": item["Batch Number"] || "",
              "_stageName": stageNameOrId,
              "Employee ID": emp ? emp['Employee ID'] : empId.trim()
            };

            activities.push({
              "Photo": emp ? emp['Photo'] : "",
              "Employee Name": emp ? emp['Employee Name'] : "Unknown",
              "Designation": emp ? emp['Designation'] : "N/A",
              "Type": type,
              "Name": item["Course Title"] || `Batch ${item["Batch Number"]}`,
              "Code": item["Course Code"],
              "Course Code": item["Course Code"] || "",
              "Course Title": item["Course Title"] || "",
              "Batch Number": item["Batch Number"] || "",
              "Employee ID": emp ? emp['Employee ID'] : empId.trim(),
              "workflowTitle": jobTitle,
              "_stageName": stageNameOrId,
              "_actualStageName": cleanStageName,
              "_deliverables": structuredStage ? structuredStage.deliverables.join(', ') : 'N/A',
               "Context": (
                <div className="flex flex-col gap-1 items-start">
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm", 
                    type === "Course" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                  )}>
                    {type}
                  </span>
                  <span className="text-[11px] text-slate-600 font-semibold whitespace-nowrap">
                    {item["Course Code"]}
                  </span>
                  {type === "Batch" && (
                    <span className="text-[11px] text-slate-500 whitespace-nowrap">
                      Batch {item["Batch Number"]}
                    </span>
                  )}
                </div>
              ),
              "Stage & Deliverables": (
                <div className="flex flex-col gap-0.5">
                  <span className="font-bold text-slate-800 text-[1.08em] leading-snug">{cleanStageName}</span>
                  {(structuredStage && (structuredStage.tasks.length > 0)) && (
                    <div className="flex flex-col gap-0.5 mt-1">
                      {structuredStage.tasks.length > 0 && (
                        <span className="text-gray-500 text-[0.92em] leading-tight">
                          <strong className="font-medium text-slate-700">Key Tasks:</strong> {structuredStage.tasks.join(', ')}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ),
              "Assigned Date": isEditing ? (
                <EditableDateCell 
                  initialValue={assignedDate || ""} 
                  onSaveDate={async (newDate) => {
                    await handleSaveAssignedDate(rowRef, newDate);
                  }} 
                />
              ) : (
                assignedDate || "-"
              ),
              "Deadline": isEditing ? (
                <EditableDateCell 
                  initialValue={currentDeadline} 
                  onSaveDate={async (newDate) => {
                    await handleSaveDeadline(rowRef, newDate);
                  }} 
                />
              ) : (
                currentDeadline || "-"
              ),
              "Key Tasks": structuredStage ? structuredStage.tasks.join(', ') : 'N/A',
              "Approval / Sign-off": structuredStage ? structuredStage.approval : 'N/A',
              "assignedDateRaw": assignedDate || "",
              "deadlineRaw": currentDeadline,
              "tasksList": structuredStage ? structuredStage.tasks : [],
              "deliverablesList": structuredStage ? structuredStage.deliverables : []
            });
          });
        });
      });
    };

    processWorkflow(courseData, "Course");
    processWorkflow(mcBatchData, "Batch");

    // Sort activities: 
    // 1. Deadline over (passed) rows first.
    // 2. Deadline not assigned (empty, missing, invalid, or "-") second.
    // 3. Remaining rows (deadline today or in the future) third.
    // Within each group, sort chronologically.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();

    const getScoreAndDate = (item: any) => {
      const deadlineStr = (item.deadlineRaw || "").trim();
      if (!deadlineStr || deadlineStr === "-") {
        return { score: 2, time: 0 }; // Category 2: Deadline not assigned
      }
      const target = new Date(deadlineStr);
      if (isNaN(target.getTime())) {
        return { score: 2, time: 0 }; // Category 2: Deadline not assigned
      }
      target.setHours(0, 0, 0, 0);
      const targetTime = target.getTime();
      if (targetTime < todayTime) {
        return { score: 1, time: targetTime }; // Category 1: Overdue
      }
      return { score: 3, time: targetTime }; // Category 3: Remaining/Future
    };

    activities.sort((a, b) => {
      const infoA = getScoreAndDate(a);
      const infoB = getScoreAndDate(b);

      if (infoA.score !== infoB.score) {
        return infoA.score - infoB.score;
      }

      // Within the same group, sort chronologically:
      if (infoA.score === 1 || infoA.score === 3) {
        return infoA.time - infoB.time; // Ascending: earliest deadline first
      } else {
        // No deadline: sort by assigned date chronological ascending if available
        const assignA = a.assignedDateRaw ? new Date(a.assignedDateRaw).getTime() : 0;
        const assignB = b.assignedDateRaw ? new Date(b.assignedDateRaw).getTime() : 0;
        if (assignA && assignB) {
          return assignA - assignB;
        }
        if (assignA) return -1;
        if (assignB) return 1;
        return 0;
      }
    });

    return activities;
  }, [courseData, mcBatchData, employees, workflowData, isEditing]);

  const [selectedActivity, setSelectedActivity] = useState<any>(null);
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (activityData.length > 0) {
      if (!hasInitialized.current) {
        setSelectedActivity(activityData[0]);
        hasInitialized.current = true;
      } else {
        setSelectedActivity((prevSelected: any) => {
          if (!prevSelected) return prevSelected;
          const freshSelected = activityData.find((row) =>
            row["Type"] === prevSelected["Type"] &&
            row["Code"] === prevSelected["Code"] &&
            row["Batch Number"] === prevSelected["Batch Number"] &&
            row["_stageName"] === prevSelected["_stageName"] &&
            row["Employee ID"] === prevSelected["Employee ID"]
          ) || activityData.find((row) =>
            row["Type"] === prevSelected["Type"] &&
            row["Code"] === prevSelected["Code"] &&
            row["Batch Number"] === prevSelected["Batch Number"] &&
            row["_stageName"] === prevSelected["_stageName"]
          );
          return freshSelected || prevSelected;
        });
      }
    }
  }, [activityData]);

  const headers = ["Photo", "Employee Name", "Stage & Deliverables", "Assigned Date", "Deadline"];

  return (
    <div className="flex h-full w-full bg-transparent gap-0 overflow-hidden relative p-4">
      <div className="flex-1 min-w-0 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden h-full">
        <Table 
          data={activityData}
          headers={headers}
          columnStyles={{
            "Photo": "w-10 text-center",
            "Employee Name": "w-px whitespace-nowrap",
            "Stage & Deliverables": "w-full normal whitespace-normal break-words font-semibold text-gray-900",
            "Assigned Date": "w-px whitespace-nowrap text-center",
            "Deadline": "w-px whitespace-nowrap text-center"
          }}
          isLoading={false}
          onSave={async () => {}}
          onDelete={async () => {}}
          onRowClick={(row) => setSelectedActivity(row)}
          isActiveRow={(row) => 
            selectedActivity &&
            selectedActivity["Type"] === row["Type"] &&
            selectedActivity["Code"] === row["Code"] &&
            selectedActivity["Batch Number"] === row["Batch Number"] &&
            selectedActivity["_stageName"] === row["_stageName"]
          }
          mergeGroups={{
            groupBy: ["Type", "Code", "Batch Number", "_stageName"],
            mergeColumns: ["Stage & Deliverables", "Assigned Date", "Deadline"]
          }}
          renderCell={(header, val, row) => {
            if (header === "Employee Name" && isEditing) {
              const rowRef = {
                "Type": row["Type"],
                "Code": row["Code"],
                "Batch Number": row["Batch Number"] || "",
                "_stageName": row["_stageName"],
                "Employee ID": row["Employee ID"]
              };
              return (
                <EditableEmployeeCell
                  currentEmpId={row["Employee ID"]}
                  currentEmpName={val}
                  employees={employees}
                  onSaveEmployee={async (newEmpId) => {
                    await handleSaveEmployee(rowRef, newEmpId);
                  }}
                />
              );
            }
            if (header === "Deadline" && !isEditing) {
              const deadlineStr = (row["deadlineRaw"] || "").trim();
              const doc = getAnyDocForActivity(row);
              
              const formattedDate = (val && val !== "-") ? formatToMmmDdYyyy(val) : "-";

              let deadlineContent = null;
              if (deadlineStr && deadlineStr !== "-") {
                const target = new Date(deadlineStr);
                if (!isNaN(target.getTime())) {
                  target.setHours(0, 0, 0, 0);
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  if (target.getTime() < today.getTime()) {
                    deadlineContent = (
                      <span className="text-rose-600 font-bold flex items-center gap-1 justify-center">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        {formattedDate}
                      </span>
                    );
                  }
                }
              }

              if (doc || deadlineContent) {
                const docStatus = getDocStatus(doc);
                return (
                  <div className="flex flex-col gap-1 items-center">
                    {deadlineContent ? deadlineContent : formattedDate}
                    {doc && (
                        <button 
                            className={`${docStatus.color} text-[10px] px-2 py-0.5 rounded-full font-bold hover:opacity-80 cursor-pointer shadow-sm`}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onViewFile && doc["File Link"]) {
                                    onViewFile(doc["File Link"], doc["Documents Title"], doc);
                                }
                            }}
                        >
                            {docStatus.text}
                        </button>
                    )}
                  </div>
                );
              }
            }
            return undefined;
          }}
          FormPanel={EmptyPanel as any}
          entityName="Activity"
          title="Activity Feed (Workflow Assignments)"
          hideAddButton={true}
          customHeaderButton={
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={cn(
                "p-1.5 rounded transition-all active:scale-95 flex items-center gap-1 text-xs font-bold uppercase tracking-wider px-2.5 shadow-sm cursor-pointer",
                isEditing 
                  ? "bg-green-600 hover:bg-green-700 text-white" 
                  : "bg-teal-600 hover:bg-teal-700 text-white"
              )}
              title={isEditing ? "Finish Editing" : "Edit Deadlines"}
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>{isEditing ? "Finish" : "Edit"}</span>
            </button>
          }
        />
      </div>

      <AnimatePresence>
        {selectedActivity && (
          <ActivityDetailView 
            selectedActivity={selectedActivity} 
            allActivities={activityData} 
            courseData={courseData}
            onClose={() => setSelectedActivity(null)}
            documents={documents}
            onSaveDocument={onSaveDocument}
            onViewFile={onViewFile}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
