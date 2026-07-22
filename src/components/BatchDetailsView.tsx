import React, { useState, useMemo } from "react";
import { resolveNamesOrIdsToIds, isBatchRunning, formatToMmmDdYyyy, parseWorkflowAndStages, getStageAssignment, cn, serializeWorkflowAndStages, parseWorkflowTitle } from "../lib/utils";
import { Users, Calendar, Info, Briefcase, FileText, Plus } from "lucide-react";
import EmployeeMultiSelect from "./EmployeeMultiSelect";
import WorkflowTimeline from "./WorkflowTimeline";
import { motion, AnimatePresence } from "motion/react";
import SearchableSingleSelect from "./SearchableSingleSelect";

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
  const instructorIds = instructorVal ? resolveNamesOrIdsToIds(String(instructorVal), employees || []) : [];
  const instructorEmployees = instructorIds.map(id => (employees || []).find(e => String(e['Employee ID'] || '').trim() === String(id).trim() || String(e['Employee Name'] || '').trim().toLowerCase() === String(id).trim().toLowerCase())).filter(Boolean);
  
  const getInstructorList = () => {
    if (instructorEmployees.length > 0) return instructorEmployees;
    if (!instructorVal || String(instructorVal).trim() === "") return [];
    return String(instructorVal).split(',').map(name => ({
      'Employee Name': name.trim(),
      Designation: "External Expert"
    }));
  };
  
  const instructorsToRender = getInstructorList();
  
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
      const tag = String(doc["Tag"] || "");
      if (documentFilter) {
        return tag.startsWith(documentFilter);
      }
      const batchNum = batch["Batch Number"] || "";
      return tag === batchNum || tag.startsWith(batchNum + " - ");
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
                  onClick={() => setActiveTab(tab)}
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
              <div className="space-y-4">
                {/* Dates */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Calendar className="w-4 h-4 text-teal-600" />
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Schedule</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 p-3 bg-white border border-slate-200 rounded">
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Start Date</p>
                      <p className="text-xs font-medium text-slate-800">{batch["Start Date"] ? formatToMmmDdYyyy(batch["Start Date"]) : "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">End Date</p>
                      <p className="text-xs font-medium text-slate-800">{batch["End Date"] ? formatToMmmDdYyyy(batch["End Date"]) : "—"}</p>
                    </div>
                  </div>
                </div>

                {/* Instructors */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Users className="w-4 h-4 text-teal-600" />
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Instructors</span>
                  </div>
                  {instructorsToRender.length > 0 ? (
                    <div className="space-y-2">
                      {instructorsToRender.map((emp: any, i: number) => (
                        <div key={i} className="flex items-center gap-2.5 bg-white p-2.5 rounded border border-slate-200">
                          <div className="w-8 h-8 rounded-full bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                            <img 
                              src={getPhotoUrl(emp)} 
                              alt={emp['Employee Name']}
                              className="w-full h-full object-cover bg-gray-50"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(emp['Employee Name'] || 'User');
                              }}
                            />
                          </div>
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-xs font-bold text-slate-800 truncate leading-tight">
                              {emp['Employee Name'] || 'Unknown'}
                            </span>
                            <span className="text-[10px] text-slate-500 truncate mt-0.5">
                              {emp['Designation'] || 'Instructor'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 bg-white border border-slate-200 rounded text-center">
                      <span className="text-xs italic text-slate-400">No instructors assigned</span>
                    </div>
                  )}
                </div>

                {/* Additional Info */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Info className="w-4 h-4 text-teal-600" />
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Info</span>
                  </div>
                  <div className="p-3 bg-white border border-slate-200 rounded">
                     <div className="flex justify-between items-center">
                       <span className="text-xs text-slate-600 font-medium">Students Enrolled</span>
                       <span className="text-xs font-bold text-teal-600">{batch["Student"] || "—"}</span>
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
