import React, { useState, useMemo } from "react";
import { resolveNamesOrIdsToIds, isBatchRunning, formatToMmmDdYyyy, parseWorkflowAndStages, getStageAssignment, cn, serializeWorkflowAndStages, parseWorkflowTitle } from "../lib/utils";
import { Users, Calendar, Info, Briefcase, FileText, Plus } from "lucide-react";
import EmployeeMultiSelect from "./EmployeeMultiSelect";
import WorkflowTimeline from "./WorkflowTimeline";
import { motion, AnimatePresence } from "motion/react";
import SearchableSingleSelect from "./SearchableSingleSelect";

const getPhotoUrl = (emp: any) => {
  if (!emp) return 'https://ui-avatars.com/api/?name=User&background=0D9488&color=fff';
  const photoKey = Object.keys(emp).find(k => {
    const lk = k.toLowerCase().trim();
    return lk.includes("photo") || lk.includes("image") || lk.includes("picture") || lk.includes("avatar") || lk === "img" || lk.includes("profile");
  });
  const rawUrl = photoKey ? emp[photoKey] : '';
  if (!rawUrl || typeof rawUrl !== 'string' || rawUrl.trim() === '') {
    return 'https://ui-avatars.com/api/?name=' + encodeURIComponent(emp['Employee Name'] || 'User') + '&background=0D9488&color=fff';
  }
  const cleanUrl = rawUrl.trim();
  const fileIdMatch = cleanUrl.match(/[-\w]{25,}/);
  if (fileIdMatch && (cleanUrl.includes('drive.google.com') || cleanUrl.includes('docs.google.com'))) {
    return `https://drive.google.com/thumbnail?id=${fileIdMatch[0]}&sz=w400`;
  }
  return cleanUrl;
};

const toInputDateValue = (dateStr: any) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export interface BatchDetailsViewProps {
  batch: any;
  employees?: any[];
  isEditing?: boolean;
  onSaveBatch?: (batchData: any) => Promise<void>;
  workflowData?: any[];
  documents?: any[];
  onSaveDocument?: (formData: any, editingRow: any | null) => Promise<void>;
}

export default function BatchDetailsView({ batch, employees, isEditing, onSaveBatch, workflowData = [], documents = [], onSaveDocument }: BatchDetailsViewProps) {
  const [activeTab, setActiveTab] = useState<'info' | 'workflow' | 'documents' | 'financial'>('workflow');
  const [documentFilter, setDocumentFilter] = useState<string | null>(null);

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
        id: structured.id,
        title: structured.title || rawText || "",
        stages: structured.stages || [],
        rawText
      };
    }).filter(item => item.title.trim() !== "");
  }, [workflowData]);
  
  if (!batch) {
    return (
      <div className="h-full flex-1 w-full flex items-center justify-center text-slate-400 italic text-sm">
        No batch selected.
      </div>
    );
  }

  const instructorVal = batch["Instractor"] || batch["Instructor"];
  
  const getInstructorList = () => {
    if (!instructorVal || String(instructorVal).trim() === "") return [];
    
    const empList = employees || [];
    // First try resolveNamesOrIdsToIds
    const instructorIds = resolveNamesOrIdsToIds(String(instructorVal), empList);
    
    const resolvedFromIds = instructorIds.map(rawId => {
      const cleanId = String(rawId).split('|')[0].trim();
      return empList.find(e => {
        const empId = String(e['Employee ID'] || '').trim();
        const empName = String(e['Employee Name'] || '').trim();
        return (
          empId === cleanId || 
          empName.toLowerCase() === cleanId.toLowerCase()
        );
      });
    }).filter(Boolean);

    if (resolvedFromIds.length > 0) return resolvedFromIds;

    // Fallback split by comma or semicolon
    const items = String(instructorVal).split(/[,;]/).map(s => s.trim()).filter(Boolean);
    return items.map(item => {
      const parts = item.split('|').map(p => p.trim());
      const firstPart = parts[0] || '';
      const secondPart = parts[1] || '';

      const found = empList.find(e => {
        const empId = String(e['Employee ID'] || '').trim().toLowerCase();
        const empName = String(e['Employee Name'] || '').trim().toLowerCase();
        const fLower = firstPart.toLowerCase();
        const sLower = secondPart.toLowerCase();

        return (
          (empId && (empId === fLower || empId === sLower)) ||
          (empName && (empName === fLower || empName === sLower || (fLower.length > 2 && empName.includes(fLower))))
        );
      });

      if (found) return found;

      return {
        'Employee Name': secondPart || firstPart,
        Designation: "Instructor"
      };
    });
  };
  
  const instructorsToRender = getInstructorList();
  
  const instructorIds = useMemo(() => {
    if (!instructorVal || String(instructorVal).trim() === "") return [];
    return resolveNamesOrIdsToIds(String(instructorVal), employees || []).map(String);
  }, [instructorVal, employees]);
  
  const renderWorkflow = () => {
    const courseWorkflow = batch["Workflow"] || batch["Publication Workflow"] || "";
    const { jobTitle, stageAssignments } = parseWorkflowAndStages(courseWorkflow);

    const handleWorkflowChange = async (newJobTitle: string) => {
      if (onSaveBatch) {
        const matchingWorkflow = parsedWorkflows.find(w => 
          w.id === newJobTitle || w.title.trim().toLowerCase() === newJobTitle.trim().toLowerCase()
        );
        const workflowIdToSave = matchingWorkflow ? matchingWorkflow.id : newJobTitle;
        const serialized = serializeWorkflowAndStages(workflowIdToSave, {});
        await onSaveBatch({
          ...batch,
          Workflow: serialized,
          "Publication Workflow": serialized
        });
      }
    };

    const handleStageAssignmentChange = async (stageId: string, ids: string[]) => {
      if (onSaveBatch) {
        const updatedAssignments = { ...stageAssignments, [stageId]: ids };
        const serialized = serializeWorkflowAndStages(jobTitle, updatedAssignments);
        await onSaveBatch({
          ...batch,
          Workflow: serialized,
          "Publication Workflow": serialized
        });
      }
    };

    const matchingWorkflow = parsedWorkflows.find(w => 
      w.id === jobTitle || w.title.trim().toLowerCase() === jobTitle.trim().toLowerCase()
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

    return (
      <div className="space-y-4">
        {isEditing && (
          <div className="space-y-1 bg-white p-3 rounded-md border border-slate-200">
            <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Change Workflow</label>
            <select
              className="w-full text-[11px] font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded px-2 py-1.5 focus:border-teal-500 outline-none uppercase tracking-wide cursor-pointer"
              value={jobTitle || ''}
              onChange={(e) => handleWorkflowChange(e.target.value)}
            >
              <option value="">-- SELECT JOB TITLE --</option>
              {parsedWorkflows.map((w, idx) => (
                <option key={idx} value={w.id}>{w.title}</option>
              ))}
            </select>
          </div>
        )}

        {jobTitle && !isEditing && (
          <div className="bg-white p-3 rounded-md border border-slate-200 shadow-3xs flex flex-col gap-1">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Job Title / Workflow</span>
            <span className="text-xs font-semibold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-teal-600" />
              {parsedWorkflows.find(w => w.id === jobTitle)?.title || jobTitle}
            </span>
          </div>
        )}

        {!jobTitle ? (
          <div className="flex flex-col items-center justify-center p-6 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
            <Briefcase className="w-8 h-8 text-slate-300 mb-2" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">No Workflow Assigned</span>
            <p className="text-[9px] text-slate-400 mt-1 mb-4">No workflow assigned to this batch.</p>
          </div>
        ) : (
          <WorkflowTimeline
            stages={matchingStages}
            stageAssignments={stageAssignments}
            isEditing={isEditing}
            employees={employees || []}
            onStageAssignmentChange={handleStageAssignmentChange}
            placement="right-sidebar"
            jobTitle={jobTitle}
            batch={batch}
            courseCode={batch?.['Course Code']}
            documents={documents}
            onSaveDocument={onSaveDocument}
            viewType="batch"
            onViewDocuments={(filter) => {
              setActiveTab('documents');
              setDocumentFilter(filter);
            }}
          />
        )}
      </div>
    );
  };

  const renderDocuments = () => {
    const batchDocs = documents.filter(doc => {
      const tag = String(doc["Tag"] || "").toUpperCase();
      const title = String(doc["Documents Title"] || doc["Document Title"] || doc["Title"] || "").toUpperCase();
      const docCourseCode = String(doc["Course Code"] || "").toUpperCase();
      const docBatchNum = String(doc["Batch Number"] || doc["Batch"] || "").toUpperCase();

      const batchNum = String(batch?.["Batch Number"] || "").toUpperCase();
      const courseCode = String(batch?.["Course Code"] || "").toUpperCase();

      // Check course match
      const matchCourse = !courseCode || (docCourseCode === courseCode || tag.includes(courseCode) || title.includes(courseCode));
      if (!matchCourse) return false;

      // Check specific batch match
      const matchBatch = !batchNum || (
        docBatchNum === batchNum ||
        tag.includes(`BATCH ${batchNum}`) ||
        tag.includes(`BATCH-${batchNum}`) ||
        tag.includes(`BATCH:${batchNum}`) ||
        tag.includes(`BATCH ${batchNum},`) ||
        tag.includes(`BATCH ${batchNum} `)
      );

      if (!matchBatch) return false;

      if (documentFilter) {
        const normFilter = String(documentFilter).trim().toUpperCase();
        const cleanFilter = normFilter
          .replace(/^[^-]+-[^-]+-/, '')
          .replace(/^[^-]+-/, '')
          .replace(/-$/, '')
          .replace(/^\d+\.\s*/, '');

        const matchTag = tag.includes(normFilter) || tag.startsWith(normFilter) || (cleanFilter.length > 0 && tag.includes(cleanFilter));
        const matchTitle = title.includes(normFilter) || (cleanFilter.length > 0 && title.includes(cleanFilter));
        return matchTag || matchTitle;
      }

      return true;
    });
    
    return (
      <div className="space-y-3">
        {documentFilter && (
          <div className="flex items-center justify-between bg-teal-50 px-3 py-2 rounded-md">
            <span className="text-xs font-bold text-teal-700">Filtered Documents</span>
            <button
              onClick={() => setDocumentFilter(null)}
              className="text-[10px] font-bold text-teal-600 hover:text-teal-800 hover:underline cursor-pointer"
            >
              Clear Filter
            </button>
          </div>
        )}
        {batchDocs.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-6 text-center border border-dashed border-slate-200 rounded-md bg-slate-50/50">
            <FileText className="w-8 h-8 text-slate-300 mb-2" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">No Documents</span>
            <p className="text-[9px] text-slate-400 mt-1">{documentFilter ? "No documents match this filter." : "No documents tagged with this batch number."}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {batchDocs.map((doc, idx) => (
              <a 
                key={idx}
                href={doc["File Link"]}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 p-2.5 bg-white border border-slate-200 rounded-md hover:border-teal-300 hover:shadow-sm transition-all group"
              >
                <div className="w-8 h-8 rounded-md bg-teal-50 flex items-center justify-center shrink-0 group-hover:bg-teal-100 transition-colors">
                  <FileText className="w-4 h-4 text-teal-600" />
                </div>
                <div className="flex-1 min-w-0 py-0.5">
                  <h4 className="text-xs font-bold text-slate-800 truncate leading-tight group-hover:text-teal-700 transition-colors">
                    {doc["Documents Title"] || doc["Document Title"] || "Untitled Document"}
                  </h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider">
                      {doc["Date"] ? formatToMmmDdYyyy(doc["Date"]) : "No Date"}
                    </span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderFinancial = () => {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center border border-dashed border-slate-200 rounded-md bg-slate-50/50">
        <Info className="w-8 h-8 text-slate-300 mb-2" />
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Financial Data</span>
        <p className="text-[9px] text-slate-400 mt-1">Financial metrics for this batch are not available.</p>
      </div>
    );
  };

  return (
    <div id="batch-details-view-container" className="bg-slate-50 h-full w-full flex-1 flex flex-col min-h-0 relative">
      <div className="p-4 pb-0 shrink-0">
        <div className="flex items-center justify-start gap-3 mb-3 pb-2 border-b border-slate-200">
          <div className="flex bg-slate-200/60 p-0.5 rounded border border-slate-200/40 shrink-0">
            {(['info', 'workflow', 'documents', 'financial'] as const).map(tab => {
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => {
                    setActiveTab(tab);
                    if (tab === 'workflow') {
                      setDocumentFilter(null);
                    }
                  }}
                  className={cn(
                    "relative px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded transition-colors cursor-pointer select-none focus:outline-none",
                    isActive ? "text-slate-800 font-extrabold" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeBatchTab"
                      className="absolute inset-0 bg-white rounded shadow-2xs"
                      transition={{ type: "spring", stiffness: 380, damping: 28 }}
                    />
                  )}
                  <span className="relative z-10">{tab}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar p-4 pt-0 space-y-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
          >
            {activeTab === 'info' && (
              <div className="space-y-5 pt-2">
                {/* Dates / Schedule Box with Schedule label horizontally & vertically centered on top border */}
                <div className="relative border border-slate-200 bg-white rounded-lg p-3.5 pt-4">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white px-2.5 py-0.5 border border-slate-200 rounded-full flex items-center gap-1.5 text-slate-600 shadow-2xs z-10">
                    <Calendar className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700 whitespace-nowrap">Schedule</span>
                  </div>

                  {isEditing ? (
                    <div className="grid grid-cols-2 gap-3 pt-1 text-left">
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Start Date</label>
                        <input
                          type="date"
                          value={batch["Start Date"] ? toInputDateValue(batch["Start Date"]) : ''}
                          onChange={(e) => onSaveBatch && onSaveBatch({ ...batch, "Start Date": e.target.value })}
                          className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded px-2 py-1.5 focus:border-teal-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">End Date</label>
                        <input
                          type="date"
                          value={batch["End Date"] ? toInputDateValue(batch["End Date"]) : ''}
                          onChange={(e) => onSaveBatch && onSaveBatch({ ...batch, "End Date": e.target.value })}
                          className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded px-2 py-1.5 focus:border-teal-500 outline-none"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 divide-x divide-slate-100 text-center">
                      <div className="pr-2">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Start Date</p>
                        <p className="text-xs font-semibold text-slate-800 font-mono">
                          {batch["Start Date"] ? formatToMmmDdYyyy(batch["Start Date"]) : "—"}
                        </p>
                      </div>
                      <div className="pl-2">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">End Date</p>
                        <p className="text-xs font-semibold text-slate-800 font-mono">
                          {batch["End Date"] ? formatToMmmDdYyyy(batch["End Date"]) : "—"}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Instructors Card with Instructor label horizontally & vertically centered on top border */}
                <div className="relative border border-slate-200 bg-white rounded-lg p-3.5 pt-5">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white px-2.5 py-0.5 border border-slate-200 rounded-full flex items-center gap-1.5 text-slate-600 shadow-2xs z-10">
                    <Users className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700 whitespace-nowrap">
                      {instructorsToRender.length > 1 ? "Instructors" : "Instructor"}
                    </span>
                  </div>

                  {isEditing && (
                    <div className="mb-3.5 pt-1">
                      <EmployeeMultiSelect
                        label="Select Instructors"
                        selectedIds={instructorIds}
                        onChange={(ids) => {
                          if (onSaveBatch) {
                            onSaveBatch({ ...batch, "Instractor": ids.join(',') });
                          }
                        }}
                        employees={employees || []}
                        placement="right-sidebar"
                      />
                    </div>
                  )}

                  {instructorsToRender.length > 0 ? (
                    <div className="flex items-stretch justify-center gap-3 overflow-x-auto pb-1 pt-1 custom-scrollbar scroll-smooth">
                      {instructorsToRender.map((emp: any, i: number) => (
                        <div 
                          key={i} 
                          className={`flex flex-col items-center justify-center bg-slate-50/70 p-3 rounded-lg border border-slate-200/80 hover:border-teal-300 transition-all text-center ${
                            instructorsToRender.length === 1 ? 'w-full max-w-[180px] mx-auto' : 'min-w-[130px] max-w-[170px] shrink-0'
                          }`}
                        >
                          {/* Top: Photo */}
                          <div className="w-13 h-13 rounded-full bg-white overflow-hidden shrink-0 border-2 border-slate-200 shadow-2xs mb-2">
                            <img 
                              src={getPhotoUrl(emp)} 
                              alt={emp['Employee Name'] || 'Instructor'}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                const currentSrc = target.src;
                                const photoKey = Object.keys(emp).find(k => {
                                  const lk = k.toLowerCase().trim();
                                  return lk.includes("photo") || lk.includes("image") || lk.includes("picture") || lk.includes("avatar") || lk === "img" || lk.includes("profile");
                                });
                                const rawUrl = photoKey ? emp[photoKey] : '';
                                const fileIdMatch = typeof rawUrl === 'string' ? rawUrl.match(/[-\w]{25,}/) : null;

                                if (fileIdMatch && currentSrc.includes('drive.google.com')) {
                                  target.src = `https://lh3.googleusercontent.com/d/${fileIdMatch[0]}=s400`;
                                } else {
                                  target.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(emp['Employee Name'] || 'User') + '&background=0D9488&color=fff';
                                }
                              }}
                            />
                          </div>
                          {/* Middle: Name */}
                          <span className="text-xs font-bold text-slate-800 leading-tight line-clamp-2">
                            {emp['Employee Name'] || 'Unknown'}
                          </span>
                          {/* Bottom: Designation */}
                          <span className="text-[10px] font-medium text-slate-500 mt-1 line-clamp-2">
                            {emp['Designation'] || 'Instructor'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-2">
                      <span className="text-xs italic text-slate-400">No instructor assigned</span>
                    </div>
                  )}
                </div>

                {/* Additional Info */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-teal-600" />
                    <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Info</span>
                  </div>
                  <div className="p-3 bg-white border border-slate-200 rounded-lg">
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-xs text-slate-600 font-medium">Students Enrolled</span>
                      {isEditing ? (
                        <input
                          type="number"
                          value={batch["Student"] || ""}
                          onChange={(e) => onSaveBatch && onSaveBatch({ ...batch, "Student": e.target.value })}
                          className="w-24 text-xs font-mono font-bold text-teal-600 bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:border-teal-500 outline-none text-right"
                          placeholder="0"
                        />
                      ) : (
                        <span className="text-xs font-bold text-teal-600 font-mono">{batch["Student"] || "—"}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'workflow' && renderWorkflow()}
            {activeTab === 'documents' && renderDocuments()}
            {activeTab === 'financial' && renderFinancial()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
