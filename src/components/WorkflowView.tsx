import React, { useState, useMemo, useEffect } from "react";
import { Search, Plus, Edit3, Trash2, GitMerge, ChevronRight, ChevronDown, ArrowDown, Layout, CheckCircle2, List, FileText, Settings, RefreshCw, X, Loader2, Check, GripVertical, CheckSquare, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ConfirmModal from "./ConfirmModal";
import { cn, parseWorkflowTitle, stringifyWorkflowTitle, type StructuredWorkflow, type WorkflowStageData } from "../lib/utils";

interface WorkflowViewProps {
  data: any[];
  headers: string[];
  isLoading: boolean;
  onSave: (formData: any, editingRow: any | null) => Promise<void>;
  onDelete: (row: any) => Promise<void>;
  onRefresh?: () => void;
}

export default function WorkflowView({
  data,
  headers,
  isLoading,
  onSave,
  onDelete,
  onRefresh
}: WorkflowViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [rowToDelete, setRowToDelete] = useState<any>(null);
  
  const idKey = useMemo(() => {
    return headers.find(h => {
      const cleaned = h.trim().toLowerCase();
      return cleaned === "workflow title" || cleaned === "title";
    }) || "Workflow Title";
  }, [headers]);

  // Parse all rows
  const parsedData = useMemo(() => {
    if (!Array.isArray(data)) return [];
    return data.map((row, idx) => {
      const rawText = String(row[idKey] || "");
      // Attempt to find a unique identifier in the row, or fall back to the existing _id logic
      const rowId = row["ID"] || row["id"] || row["Workflow ID"] || `row-${idx}-${Math.random().toString(36).substring(2, 7)}`;
      const structured = parseWorkflowTitle(rawText, String(rowId));
      return {
        _id: String(rowId),
        originalRow: row,
        structured,
        rawText
      };
    });
  }, [data, idKey]);

  // Filtered by search
  const filteredWorkflows = useMemo(() => {
    return parsedData.filter(item => 
      item.structured.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [parsedData, searchTerm]);

  // Initial selection
  useEffect(() => {
    if (!selectedRowId && parsedData.length > 0) {
      setSelectedRowId(parsedData[0]._id);
    } else if (selectedRowId && !parsedData.find(r => r._id === selectedRowId)) {
      setSelectedRowId(parsedData.length > 0 ? parsedData[0]._id : null);
    }
  }, [parsedData, selectedRowId]);

  const selectedWorkflow = useMemo(() => {
    return parsedData.find(r => r._id === selectedRowId) || null;
  }, [parsedData, selectedRowId]);

  // View/Edit states for the selected workflow
  const [isEditMode, setIsEditMode] = useState(false);
  const [editWorkflow, setEditWorkflow] = useState<StructuredWorkflow | null>(null);
  const [activeStageId, setActiveStageId] = useState<string | null>(null);
  const [isDeleteStageModalOpen, setIsDeleteStageModalOpen] = useState(false);
  const [stageIdToDelete, setStageIdToDelete] = useState<string | null>(null);
  
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [isAddingTitle, setIsAddingTitle] = useState(false);
  const [newTitleValue, setNewTitleValue] = useState("");
  const [isSubmittingTitle, setIsSubmittingTitle] = useState(false);

  // Drag and drop states
  const [dragOverStageIndex, setDragOverStageIndex] = useState<number | null>(null);
  const [dragOverTaskIndex, setDragOverTaskIndex] = useState<number | null>(null);
  const [dragOverDeliverableIndex, setDragOverDeliverableIndex] = useState<number | null>(null);
  const [dragOverPolicyIndex, setDragOverPolicyIndex] = useState<number | null>(null);

  const handleStageDragStart = (e: React.DragEvent, index: number) => {
    if (!isEditMode) return;
    e.dataTransfer.setData("text/plain", index.toString());
    e.dataTransfer.effectAllowed = "move";
  };

  const handleStageDrop = (e: React.DragEvent, targetIndex: number) => {
    if (!isEditMode || !editWorkflow) return;
    e.preventDefault();
    const sourceIndexStr = e.dataTransfer.getData("text/plain");
    if (!sourceIndexStr) return;
    const sourceIndex = parseInt(sourceIndexStr, 10);
    if (isNaN(sourceIndex) || sourceIndex === targetIndex) return;

    const newStages = [...editWorkflow.stages];
    const [removed] = newStages.splice(sourceIndex, 1);
    newStages.splice(targetIndex, 0, removed);

    setEditWorkflow({
      ...editWorkflow,
      stages: newStages
    });
  };

  const handleTaskDragStart = (e: React.DragEvent, index: number) => {
    if (!isEditMode) return;
    e.dataTransfer.setData("task-index", index.toString());
    e.dataTransfer.effectAllowed = "move";
  };

  const handleTaskDrop = (e: React.DragEvent, targetIndex: number) => {
    if (!isEditMode || !editWorkflow || !activeStageId) return;
    e.preventDefault();
    const sourceIndexStr = e.dataTransfer.getData("task-index");
    if (!sourceIndexStr) return;
    const sourceIndex = parseInt(sourceIndexStr, 10);
    if (isNaN(sourceIndex) || sourceIndex === targetIndex) return;

    setEditWorkflow({
      ...editWorkflow,
      stages: editWorkflow.stages.map(s => {
        if (s.id !== activeStageId) return s;
        const newTasks = [...s.tasks];
        const [removed] = newTasks.splice(sourceIndex, 1);
        newTasks.splice(targetIndex, 0, removed);
        return { ...s, tasks: newTasks };
      })
    });
  };

  const handleDeliverableDragStart = (e: React.DragEvent, index: number) => {
    if (!isEditMode) return;
    e.dataTransfer.setData("deliverable-index", index.toString());
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDeliverableDrop = (e: React.DragEvent, targetIndex: number) => {
    if (!isEditMode || !editWorkflow || !activeStageId) return;
    e.preventDefault();
    const sourceIndexStr = e.dataTransfer.getData("deliverable-index");
    if (!sourceIndexStr) return;
    const sourceIndex = parseInt(sourceIndexStr, 10);
    if (isNaN(sourceIndex) || sourceIndex === targetIndex) return;

    setEditWorkflow({
      ...editWorkflow,
      stages: editWorkflow.stages.map(s => {
        if (s.id !== activeStageId) return s;
        const newDeliverables = [...s.deliverables];
        const [removed] = newDeliverables.splice(sourceIndex, 1);
        newDeliverables.splice(targetIndex, 0, removed);
        return { ...s, deliverables: newDeliverables };
      })
    });
  };

  const handlePolicyDragStart = (e: React.DragEvent, index: number) => {
    if (!isEditMode) return;
    e.dataTransfer.setData("policy-index", index.toString());
    e.dataTransfer.effectAllowed = "move";
  };

  const handlePolicyDrop = (e: React.DragEvent, targetIndex: number) => {
    if (!isEditMode || !editWorkflow || !activeStageId) return;
    e.preventDefault();
    const sourceIndexStr = e.dataTransfer.getData("policy-index");
    if (!sourceIndexStr) return;
    const sourceIndex = parseInt(sourceIndexStr, 10);
    if (isNaN(sourceIndex) || sourceIndex === targetIndex) return;

    setEditWorkflow({
      ...editWorkflow,
      stages: editWorkflow.stages.map(s => {
        if (s.id !== activeStageId) return s;
        const newPolicies = [...(s.policies || [])];
        const [removed] = newPolicies.splice(sourceIndex, 1);
        newPolicies.splice(targetIndex, 0, removed);
        return { ...s, policies: newPolicies };
      })
    });
  };

  useEffect(() => {
    if (selectedWorkflow) {
      if (!isEditMode) {
        setEditWorkflow(JSON.parse(JSON.stringify(selectedWorkflow.structured)));
      }
    } else {
      setEditWorkflow(null);
    }
  }, [selectedWorkflow, isEditMode]);

  useEffect(() => {
    if (editWorkflow && editWorkflow.stages.length > 0) {
      if (!activeStageId || !editWorkflow.stages.find(s => s.id === activeStageId)) {
        setActiveStageId(editWorkflow.stages[0].id);
      }
    } else if (editWorkflow && editWorkflow.stages.length === 0) {
      setActiveStageId(null);
    }
  }, [editWorkflow, activeStageId]);

  const activeStage = useMemo(() => {
    if (!editWorkflow || !activeStageId) return null;
    return editWorkflow.stages.find(s => s.id === activeStageId) || null;
  }, [editWorkflow, activeStageId]);

  const handleToggleEditMode = () => {
    if (isEditMode) {
      handleSaveAllChanges();
    } else {
      setIsEditMode(true);
    }
  };

  const handleCancelEdit = () => {
    if (selectedWorkflow) {
      setEditWorkflow(JSON.parse(JSON.stringify(selectedWorkflow.structured)));
    }
    setIsEditMode(false);
  };

  const handleSaveAllChanges = async () => {
    if (!editWorkflow || !selectedWorkflow) return;
    
    // Validation: Check if any stage has an empty name
    const emptyStageIndex = editWorkflow.stages.findIndex(s => !s.stageName || !s.stageName.trim());
    if (emptyStageIndex !== -1) {
      alert(`Stage ${emptyStageIndex + 1} is missing a name. Please enter a stage name.`);
      setActiveStageId(editWorkflow.stages[emptyStageIndex].id);
      return;
    }

    const previousId = selectedWorkflow._id;
    const newText = stringifyWorkflowTitle(editWorkflow);
    const dataToSave = { ...selectedWorkflow.originalRow, [idKey]: newText };

    setIsSavingAll(true);
    try {
      // Optimistically update selection and mode for instant, lag-free UI update
      setSelectedRowId(newText);
      setIsEditMode(false);

      await onSave(dataToSave, selectedWorkflow.originalRow);
    } catch (err) {
      console.error(err);
      alert("Failed to save workflow");
      // Revert if saving fails
      setSelectedRowId(previousId);
      setIsEditMode(true);
    } finally {
      setIsSavingAll(false);
    }
  };

  const handleSaveNewTitle = async () => {
    if (!newTitleValue.trim()) return;
    setIsSubmittingTitle(true);
    try {
      const newWorkflow: StructuredWorkflow = {
        id: Math.random().toString(36).substring(2, 9),
        title: newTitleValue.trim(),
        stages: [{
          id: Math.random().toString(36).substring(2, 9),
          stageName: "Stage 1",
          tasks: [],
          deliverables: [],
          approval: ""
        }]
      };
      const text = stringifyWorkflowTitle(newWorkflow);
      
      // Select the new workflow immediately
      setSelectedRowId(text);
      setIsAddingTitle(false);
      setNewTitleValue("");
      
      await onSave({ [idKey]: text }, null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingTitle(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!rowToDelete) return;
    try {
      const isDeletingSelected = selectedWorkflow && selectedWorkflow.originalRow === rowToDelete;
      if (isDeletingSelected) {
        setIsEditMode(false);
        setActiveStageId(null);
        setEditWorkflow(null);
      }
      await onDelete(rowToDelete);
      setIsDeleteModalOpen(false);
      setRowToDelete(null);
    } catch (err) {
      console.error(err);
    }
  };

  // --- Inline Edit Handlers ---
  const updateStageName = (val: string) => {
    if (!editWorkflow || !activeStageId) return;
    setEditWorkflow({
      ...editWorkflow,
      stages: editWorkflow.stages.map(s => s.id === activeStageId ? { ...s, stageName: val } : s)
    });
  };

  const updateApproval = (val: string) => {
    if (!editWorkflow || !activeStageId) return;
    setEditWorkflow({
      ...editWorkflow,
      stages: editWorkflow.stages.map(s => s.id === activeStageId ? { ...s, approval: val } : s)
    });
  };

  const addTask = () => {
    if (!editWorkflow || !activeStageId) return;
    setEditWorkflow({
      ...editWorkflow,
      stages: editWorkflow.stages.map(s => s.id === activeStageId ? { ...s, tasks: [...s.tasks, ""] } : s)
    });
  };

  const updateTask = (idx: number, val: string) => {
    if (!editWorkflow || !activeStageId) return;
    setEditWorkflow({
      ...editWorkflow,
      stages: editWorkflow.stages.map(s => s.id === activeStageId ? {
        ...s,
        tasks: s.tasks.map((t, i) => i === idx ? val : t)
      } : s)
    });
  };

  const removeTask = (idx: number) => {
    if (!editWorkflow || !activeStageId) return;
    setEditWorkflow({
      ...editWorkflow,
      stages: editWorkflow.stages.map(s => s.id === activeStageId ? {
        ...s,
        tasks: s.tasks.filter((_, i) => i !== idx)
      } : s)
    });
  };

  const addDeliverable = () => {
    if (!editWorkflow || !activeStageId) return;
    setEditWorkflow({
      ...editWorkflow,
      stages: editWorkflow.stages.map(s => s.id === activeStageId ? { ...s, deliverables: [...s.deliverables, ""] } : s)
    });
  };

  const updateDeliverable = (idx: number, val: string) => {
    if (!editWorkflow || !activeStageId) return;
    setEditWorkflow({
      ...editWorkflow,
      stages: editWorkflow.stages.map(s => s.id === activeStageId ? {
        ...s,
        deliverables: s.deliverables.map((d, i) => i === idx ? val : d)
      } : s)
    });
  };

  const removeDeliverable = (idx: number) => {
    if (!editWorkflow || !activeStageId) return;
    setEditWorkflow({
      ...editWorkflow,
      stages: editWorkflow.stages.map(s => s.id === activeStageId ? {
        ...s,
        deliverables: s.deliverables.filter((_, i) => i !== idx)
      } : s)
    });
  };

  const addPolicy = () => {
    if (!editWorkflow || !activeStageId) return;
    setEditWorkflow({
      ...editWorkflow,
      stages: editWorkflow.stages.map(s => {
        if (s.id !== activeStageId) return s;
        const existing = s.policies || [];
        return { ...s, policies: ["", ...existing] };
      })
    });
  };

  const updatePolicy = (idx: number, val: string) => {
    if (!editWorkflow || !activeStageId) return;
    setEditWorkflow({
      ...editWorkflow,
      stages: editWorkflow.stages.map(s => {
        if (s.id !== activeStageId) return s;
        const existing = [...(s.policies || [])];
        existing[idx] = val;
        return { ...s, policies: existing };
      })
    });
  };

  const removePolicy = (idx: number) => {
    if (!editWorkflow || !activeStageId) return;
    setEditWorkflow({
      ...editWorkflow,
      stages: editWorkflow.stages.map(s => {
        if (s.id !== activeStageId) return s;
        const existing = [...(s.policies || [])];
        existing.splice(idx, 1);
        return { ...s, policies: existing };
      })
    });
  };

  const addStage = () => {
    if (!editWorkflow) return;
    const newId = Math.random().toString();
    setEditWorkflow({
      ...editWorkflow,
      stages: [...editWorkflow.stages, {
        id: newId,
        stageName: "New Stage",
        tasks: [],
        deliverables: [],
        approval: ""
      }]
    });
    setActiveStageId(newId);
  };

  const triggerRemoveStage = (stageId: string) => {
    setStageIdToDelete(stageId);
    setIsDeleteStageModalOpen(true);
  };

  const handleConfirmDeleteStage = () => {
    if (!editWorkflow || !stageIdToDelete) return;
    const newStages = editWorkflow.stages.filter(s => s.id !== stageIdToDelete);
    setEditWorkflow({ ...editWorkflow, stages: newStages });
    if (activeStageId === stageIdToDelete) {
      setActiveStageId(newStages.length > 0 ? newStages[0].id : null);
    }
    setStageIdToDelete(null);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50/50 p-2 sm:p-3 overflow-hidden min-h-0">
      <div className="w-full min-w-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col flex-1 h-full min-h-0">
        
        <div className="flex items-center justify-between p-3 px-4 border-b border-slate-200 bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-2">
            <GitMerge className="w-4 h-4 text-teal-600" />
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Workflow Definitions</h4>
          </div>
          {onRefresh && (
            <button 
              onClick={onRefresh}
              className="p-1 hover:bg-slate-200 rounded transition-colors cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className={cn("w-3.5 h-3.5 text-gray-400", isLoading && "animate-spin")} />
            </button>
          )}
        </div>

        <div className="flex-1 flex overflow-hidden min-h-0 w-full bg-white">
          {/* Sidebar: Workflows */}
          <div className="w-64 border-r border-slate-200 flex flex-col bg-slate-50/30 relative shrink-0">
            <div className="p-2 border-b border-slate-200 space-y-1.5">
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Workflow Titles</h3>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input 
                  type="text"
                  placeholder="Search workflow..."
                  className="w-full pl-7 pr-2 py-1 text-[11px] bg-white border border-gray-200 rounded focus:outline-none focus:border-teal-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-1 space-y-0.5">
              {filteredWorkflows.map(item => (
                <div key={item._id} className="relative group">
                  <button
                    onClick={() => {
                      if (isEditMode) handleCancelEdit();
                      setSelectedRowId(item._id);
                    }}
                    className={cn(
                      "w-full flex items-start justify-between px-2 py-1.5 rounded text-left transition-all cursor-pointer",
                      selectedRowId === item._id 
                        ? "bg-teal-600 text-white shadow-sm" 
                        : "text-gray-600 hover:bg-white hover:text-gray-900 border border-transparent hover:border-gray-100"
                    )}
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      <GitMerge className={cn(
                        "w-3.5 h-3.5 mt-0.5 shrink-0 transition-colors", 
                        selectedRowId === item._id ? "text-teal-100" : "text-teal-600/40 group-hover:text-teal-600"
                      )} />
                      <span className="text-xs font-medium leading-relaxed break-words">
                        {item.structured.title || "Untitled Workflow"}
                      </span>
                    </div>
                  </button>
                  {/* Delete button wrapper */}
                  <div className={cn(
                    "absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity",
                    selectedRowId === item._id && "hidden"
                  )}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setRowToDelete(item.originalRow);
                        setIsDeleteModalOpen(true);
                      }}
                      className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {filteredWorkflows.length === 0 && (
                <div className="p-3 text-center">
                  <p className="text-[10px] text-gray-400 italic">No workflows found</p>
                </div>
              )}
            </div>
 
            <div className="p-2 border-t border-slate-200 bg-white space-y-2">
              <AnimatePresence>
                {isAddingTitle && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">New Workflow</h4>
                      <button onClick={() => setIsAddingTitle(false)} className="p-1 hover:bg-gray-100 rounded cursor-pointer">
                        <X className="w-3 h-3 text-gray-400" />
                      </button>
                    </div>
                    <input
                      autoFocus
                      type="text"
                      value={newTitleValue}
                      onChange={(e) => setNewTitleValue(e.target.value)}
                      placeholder="Workflow Title..."
                      className="w-full px-2 py-1 text-xs bg-gray-50 border border-gray-200 rounded focus:outline-none focus:border-teal-500 focus:bg-white transition-all"
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveNewTitle()}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
 
              <button
                onClick={isAddingTitle ? handleSaveNewTitle : () => setIsAddingTitle(true)}
                disabled={isAddingTitle && (isSubmittingTitle || !newTitleValue.trim())}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded text-[10px] font-bold uppercase tracking-wider transition-colors shadow-sm cursor-pointer"
              >
                {isSubmittingTitle ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : isAddingTitle ? (
                  "Save"
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    Add Workflow
                  </>
                )}
              </button>
            </div>
          </div>
 
          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-white">
            {editWorkflow ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Workflow Header */}
                <div className="px-4 py-2.5 border-b border-gray-100 flex flex-col gap-2.5 bg-gray-50/30">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5 flex-1">
                      <div className="w-8 h-8 rounded-md bg-teal-50 flex items-center justify-center text-teal-600 border border-teal-100 shrink-0">
                        <GitMerge className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        {isEditMode ? (
                          <input 
                            className="text-base font-bold text-gray-900 leading-none bg-white border border-gray-200 px-2 py-0.5 rounded w-full focus:outline-none focus:border-teal-500 max-w-md"
                            value={editWorkflow.title}
                            onChange={(e) => setEditWorkflow({...editWorkflow, title: e.target.value})}
                          />
                        ) : (
                          <h2 className="text-base font-bold text-gray-900 leading-none">{editWorkflow.title || "Untitled Workflow"}</h2>
                        )}
                        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                          {editWorkflow.stages.length} Stage{editWorkflow.stages.length !== 1 ? 's' : ''} Defined
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isEditMode && (
                        <button
                          onClick={handleCancelEdit}
                          disabled={isSavingAll}
                          className="px-2.5 py-1 rounded transition-all border flex items-center justify-center cursor-pointer text-[10px] font-bold uppercase tracking-wider bg-white hover:bg-slate-50 text-gray-500 border-slate-200 hover:border-slate-300"
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        onClick={handleToggleEditMode}
                        disabled={isSavingAll}
                        className={cn(
                          "px-2.5 py-1 rounded transition-all border flex items-center justify-center cursor-pointer text-[10px] font-bold uppercase tracking-wider",
                          isEditMode 
                            ? "bg-teal-50 border-teal-200 text-teal-600 hover:bg-teal-100" 
                            : "bg-white hover:bg-slate-50 text-teal-600 border-slate-200 hover:border-slate-300"
                        )}
                      >
                        {isSavingAll ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                        ) : isEditMode ? (
                          <Check className="w-3.5 h-3.5 mr-1" />
                        ) : (
                          <Edit3 className="w-3.5 h-3.5 mr-1" />
                        )}
                        {isEditMode ? "Save Changes" : "Edit Workflow"}
                      </button>
                    </div>
                  </div>
 
                  {/* Stage Tabs */}
                </div>
 
                <div className="flex-1 flex overflow-hidden">
                  {/* Vertical Stage Tabs Sidebar */}
                  <div className="w-56 border-r border-slate-200 bg-slate-50/50 flex flex-col shrink-0 overflow-hidden relative">
                    <style>{`
                      .no-scrollbar::-webkit-scrollbar {
                        display: none;
                      }
                      .no-scrollbar {
                        -ms-overflow-style: none;
                        scrollbar-width: none;
                      }
                    `}</style>
                    
                    <div className="p-2 pb-1.5 border-b border-slate-200/60 shrink-0 w-full">
                      <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center w-full">Stages Flow</h3>
                    </div>
 
                    <div className="flex-1 overflow-y-auto no-scrollbar p-2 pt-2 flex flex-col items-center w-full">
                      {editWorkflow.stages.map((stage, idx) => (
                        <React.Fragment key={stage.id}>
                          {idx > 0 && (
                            <div className="flex justify-center py-1 shrink-0">
                              <ChevronDown className="w-4 h-4 text-slate-300" />
                            </div>
                          )}
                          <div
                            draggable={isEditMode}
                            onDragStart={(e) => handleStageDragStart(e, idx)}
                            onDragOver={(e) => {
                              if (isEditMode) {
                                e.preventDefault();
                                setDragOverStageIndex(idx);
                              }
                            }}
                            onDragLeave={() => setDragOverStageIndex(null)}
                            onDrop={(e) => {
                              handleStageDrop(e, idx);
                              setDragOverStageIndex(null);
                            }}
                            className={cn(
                              "w-full transition-all duration-200 rounded-md",
                              isEditMode && "cursor-grab active:cursor-grabbing",
                              dragOverStageIndex === idx && "border-2 border-dashed border-teal-400 bg-teal-50/20 scale-[1.02]"
                            )}
                          >
                            <button
                              onClick={() => setActiveStageId(stage.id)}
                              className={cn(
                                "w-full px-2.5 py-2.5 rounded-md text-sm font-semibold transition-all flex flex-col items-center gap-1.5 border shadow-3xs relative group shrink-0",
                                activeStageId === stage.id
                                  ? "bg-teal-50 text-teal-800 border-teal-300 ring-2 ring-teal-100/50 font-bold"
                                  : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:shadow-2xs"
                              )}
                            >
                              {isEditMode && (
                                <GripVertical className="w-3.5 h-3.5 text-slate-300 absolute top-2 left-1.5 cursor-grab opacity-40 group-hover:opacity-100 transition-opacity" />
                              )}
                              <span className="whitespace-normal break-words text-center leading-relaxed text-sm">
                                {stage.stageName || "Unnamed"}
                              </span>
                              {isEditMode && (
                                <span 
                                  onClick={(e) => { e.stopPropagation(); triggerRemoveStage(stage.id); }}
                                  className="absolute top-1 right-1 p-0.5 shrink-0 rounded-full hover:bg-red-100 hover:text-red-600 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X className="w-3 h-3" />
                                </span>
                              )}
                            </button>
                          </div>
                        </React.Fragment>
                      ))}
                    </div>
 
                    {isEditMode && (
                      <div className="p-2 border-t border-slate-200 bg-white shrink-0 w-full">
                        <button
                          onClick={addStage}
                          className="w-full px-2 py-2.5 rounded-md text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 hover:shadow-sm transition-colors flex items-center justify-center gap-1 shrink-0 cursor-pointer"
                        >
                          <Plus className="w-4 h-4" /> 
                          <span>Add Stage</span>
                        </button>
                      </div>
                    )}
                  </div>
 
                  {/* Active Stage Content */}
                  {activeStage ? (
                  <div className="flex-1 overflow-y-auto no-scrollbar p-4 sm:p-5 pb-14 sm:pb-16 space-y-4 bg-slate-50/10">
                    
                    {/* Bordered Container */}
                    <div className="relative border border-gray-200 rounded-xl p-4 sm:p-5 pt-5 sm:pt-7 pb-12 sm:pb-14 mt-6 mb-4 bg-white mx-auto max-w-5xl">
                      
                      {/* Workflow Title on Top Border */}
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-teal-50 text-teal-800 border border-teal-200 px-6 py-2.5 rounded-full shadow-sm w-[92%] max-w-2xl text-center whitespace-normal break-words z-10">
                        <span className="text-base md:text-lg font-extrabold uppercase tracking-wider block leading-snug">
                          {editWorkflow.title || "Untitled Workflow"}
                        </span>
                      </div>
                      
                      <div className="pt-5 sm:pt-6">
                        {/* Grid with Stage Flow Card on Left & Policy Card on Right */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch mb-5">
                          
                          {/* Stage Flow Card */}
                          <div className="lg:col-span-6 xl:col-span-7 border border-teal-200 rounded-lg p-3.5 pb-10 bg-teal-50/30 w-full relative flex flex-col justify-between min-h-[160px] max-h-[280px] lg:max-h-[35vh]">
                            {/* Stage Badge in Middle of Top Border */}
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white text-teal-800 border border-teal-200 px-5 py-1.5 rounded-full shadow-xs text-xs md:text-sm font-bold uppercase tracking-wider z-10 flex items-center justify-center gap-1.5 max-w-[90%] whitespace-nowrap">
                              <Layout className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                              {isEditMode ? (
                                <input
                                  type="text"
                                  value={activeStage.stageName}
                                  onChange={(e) => updateStageName(e.target.value)}
                                  className="bg-transparent text-center text-xs md:text-sm font-bold uppercase tracking-wider focus:outline-none placeholder-teal-300 text-teal-800 min-w-[100px]"
                                  placeholder="Stage Name"
                                />
                              ) : (
                                <span className="truncate">
                                  {activeStage.stageName || "Unnamed Stage"}
                                </span>
                              )}
                            </div>

                            {/* Content with internal scroll */}
                            <div className="mt-2 flex-1 overflow-y-auto no-scrollbar pr-1">
                              {/* Key Tasks */}
                              <div className="space-y-2">
                                {isEditMode && (
                                  <div className="flex justify-center px-1 mb-1">
                                    <button onClick={addTask} className="text-xs font-bold uppercase tracking-wider text-teal-600 hover:text-teal-800 flex items-center gap-1 cursor-pointer transition-colors">
                                      <Plus className="w-3.5 h-3.5" /> Add Task
                                    </button>
                                  </div>
                                )}
                                
                                {activeStage.tasks.length === 0 && !isEditMode ? (
                                  <div className="text-center text-xs text-slate-400 italic py-6">
                                    No key tasks specified.
                                  </div>
                                ) : (
                                  <div className="space-y-2.5 px-1 text-justify flex flex-col items-center">
                                    {activeStage.tasks.map((task, tIdx) => (
                                      <div
                                        key={tIdx}
                                        draggable={isEditMode}
                                        onDragStart={(e) => handleTaskDragStart(e, tIdx)}
                                        onDragOver={(e) => {
                                          if (isEditMode) {
                                            e.preventDefault();
                                            setDragOverTaskIndex(tIdx);
                                          }
                                        }}
                                        onDragLeave={() => setDragOverTaskIndex(null)}
                                        onDrop={(e) => {
                                          handleTaskDrop(e, tIdx);
                                          setDragOverTaskIndex(null);
                                        }}
                                        className={cn(
                                          "flex items-center justify-start gap-2 w-full max-w-xl",
                                          isEditMode && "p-1.5 rounded-md transition-all hover:bg-slate-50 border border-transparent",
                                          dragOverTaskIndex === tIdx && "border-2 border-dashed border-teal-400 bg-teal-50/20"
                                        )}
                                      >
                                        {isEditMode ? (
                                          <div className="flex items-center justify-center gap-1.5 w-full">
                                            <div className="cursor-grab active:cursor-grabbing p-1 text-slate-300 hover:text-slate-500 rounded shrink-0" title="Drag to reorder">
                                              <GripVertical className="w-3.5 h-3.5" />
                                            </div>
                                            <textarea
                                              value={task}
                                              onChange={(e) => updateTask(tIdx, e.target.value)}
                                              className="flex-1 px-2.5 py-1.5 text-sm font-semibold leading-relaxed bg-white border border-slate-200 rounded focus:outline-none focus:border-teal-400 min-h-[45px] text-justify resize-y"
                                              placeholder="Task description..."
                                            />
                                            <button onClick={() => removeTask(tIdx)} className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        ) : (
                                          <p className="text-xs md:text-sm text-slate-700 font-semibold leading-relaxed text-justify block w-full flex-1 break-words px-1 py-0.5">{task}</p>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Deliverables Badge on Bottom Border */}
                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 bg-white text-teal-800 border border-teal-200 px-4 py-2 rounded-xl shadow-xs text-xs font-bold z-10 flex flex-col items-center justify-center gap-1 w-[92%] max-w-md">
                              <div className="flex items-center justify-center gap-1.5 text-slate-400 font-bold uppercase tracking-wider text-xs">
                                <CheckSquare className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                                <span>Deliverables:</span>
                              </div>
                              {activeStage.deliverables.length === 0 && !isEditMode ? (
                                <span className="text-slate-400 italic normal-case text-xs">None</span>
                              ) : (
                                <div className="flex items-center justify-center gap-1.5 flex-wrap min-w-0">
                                  {activeStage.deliverables.map((deliv, dIdx) => (
                                    <React.Fragment key={dIdx}>
                                      {isEditMode ? (
                                        <div
                                          draggable={isEditMode}
                                          onDragStart={(e) => handleDeliverableDragStart(e, dIdx)}
                                          onDragOver={(e) => {
                                            if (isEditMode) {
                                              e.preventDefault();
                                              setDragOverDeliverableIndex(dIdx);
                                            }
                                          }}
                                          onDragLeave={() => setDragOverDeliverableIndex(null)}
                                          onDrop={(e) => {
                                            handleDeliverableDrop(e, dIdx);
                                            setDragOverDeliverableIndex(null);
                                          }}
                                          className={cn(
                                            "flex items-center gap-0.5 text-xs font-bold text-teal-800",
                                            dragOverDeliverableIndex === dIdx && "border-b-2 border-dashed border-teal-400"
                                          )}
                                        >
                                          <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500" title="Drag to reorder">
                                            <GripVertical className="w-3 h-3" />
                                          </div>
                                          <input
                                            type="text"
                                            value={deliv}
                                            onChange={(e) => updateDeliverable(dIdx, e.target.value)}
                                            className="bg-transparent focus:outline-none text-xs font-bold text-teal-800 max-w-[140px] border-b border-teal-300 text-center"
                                            placeholder="Deliverable..."
                                          />
                                          <button onClick={() => removeDeliverable(dIdx)} className="text-gray-400 hover:text-red-500 transition-colors">
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        </div>
                                      ) : (
                                        <span className="text-teal-900 font-bold normal-case text-xs md:text-sm">
                                          {deliv}{dIdx < activeStage.deliverables.length - 1 ? "," : ""}
                                        </span>
                                      )}
                                    </React.Fragment>
                                  ))}
                                  {isEditMode && (
                                    <button
                                      onClick={addDeliverable}
                                      className="text-teal-600 hover:text-teal-800 p-0.5 rounded hover:bg-teal-50 transition-colors flex items-center gap-0.5 text-xs font-bold cursor-pointer ml-1"
                                      title="Add Deliverable"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                      <span>Add</span>
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Policy Card */}
                          <div className="lg:col-span-6 xl:col-span-5 border border-teal-200 rounded-lg p-3.5 pb-10 bg-teal-50/30 w-full relative flex flex-col justify-between min-h-[160px] max-h-[280px] lg:max-h-[35vh]">
                            {/* Policy Badge in Middle of Top Border */}
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white text-teal-800 border border-teal-200 px-5 py-1.5 rounded-full shadow-xs text-xs md:text-sm font-bold uppercase tracking-wider z-10 flex items-center justify-center gap-1.5 whitespace-nowrap">
                              <FileText className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                              <span>Policy</span>
                            </div>

                            {/* Policy List / Inputs with internal scroll */}
                            <div className="space-y-2 mt-2 flex-1 overflow-y-auto no-scrollbar pr-1 flex flex-col justify-start">
                              {isEditMode && (
                                <div className="flex justify-center px-1 mb-1">
                                  <button onClick={addPolicy} className="text-xs font-bold uppercase tracking-wider text-teal-600 hover:text-teal-800 flex items-center gap-1 cursor-pointer transition-colors">
                                    <Plus className="w-3.5 h-3.5" /> Add Policy
                                  </button>
                                </div>
                              )}

                              {(!activeStage.policies || activeStage.policies.length === 0) && !isEditMode ? (
                                <div className="text-center text-xs text-slate-400 italic py-2 flex-1 flex items-center justify-center">
                                  No policy specified.
                                </div>
                              ) : (
                                <div className="space-y-2.5 px-1 text-left flex flex-col items-start flex-1 justify-start w-full">
                                  {(activeStage.policies || []).map((policy, pIdx) => (
                                    <div
                                      key={pIdx}
                                      draggable={isEditMode}
                                      onDragStart={(e) => handlePolicyDragStart(e, pIdx)}
                                      onDragOver={(e) => {
                                        if (isEditMode) {
                                          e.preventDefault();
                                          setDragOverPolicyIndex(pIdx);
                                        }
                                      }}
                                      onDragLeave={() => setDragOverPolicyIndex(null)}
                                      onDrop={(e) => {
                                        handlePolicyDrop(e, pIdx);
                                        setDragOverPolicyIndex(null);
                                      }}
                                      className={cn(
                                        "flex items-center justify-start gap-2 w-full",
                                        isEditMode && "p-1.5 rounded-md transition-all hover:bg-slate-50 border border-transparent",
                                        dragOverPolicyIndex === pIdx && "border-2 border-dashed border-teal-400 bg-teal-50/20"
                                      )}
                                    >
                                      {isEditMode ? (
                                        <div className="flex items-center justify-start gap-1.5 w-full">
                                          <div className="cursor-grab active:cursor-grabbing p-1 text-slate-300 hover:text-slate-500 rounded shrink-0" title="Drag to reorder">
                                            <GripVertical className="w-3.5 h-3.5" />
                                          </div>
                                          <FileText className="w-4 h-4 text-teal-600 shrink-0" />
                                          <textarea
                                            value={policy}
                                            onChange={(e) => updatePolicy(pIdx, e.target.value)}
                                            className="flex-1 px-2.5 py-1.5 text-sm font-semibold leading-relaxed bg-white border border-slate-200 rounded focus:outline-none focus:border-teal-400 min-h-[45px] text-justify resize-y"
                                            placeholder="Policy description..."
                                          />
                                          <button onClick={() => removePolicy(pIdx)} className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      ) : (
                                        <p className="text-xs md:text-sm text-slate-700 font-medium leading-relaxed text-justify flex-1 break-words px-1 py-0.5">{policy}</p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                        </div>
                      </div>

                      {/* Sign-off Authority Badge on Bottom Border */}
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 bg-white text-teal-800 border border-teal-200 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl shadow-xs text-xs font-bold z-20 flex flex-col items-center justify-center gap-0.5 w-[88%] sm:w-[92%] max-w-md">
                        <div className="flex items-center justify-center gap-1.5 text-slate-400 font-bold uppercase tracking-wider text-xs">
                          <ShieldCheck className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                          <span>Approved By:</span>
                        </div>
                        {isEditMode ? (
                          <input
                            type="text"
                            value={activeStage.approval || ""}
                            onChange={(e) => updateApproval(e.target.value)}
                            placeholder="N/A"
                            className="bg-transparent focus:outline-none w-full text-center text-teal-800 font-bold text-xs md:text-sm"
                          />
                        ) : (
                          <span className="truncate text-center text-xs md:text-sm font-bold text-teal-900">{activeStage.approval || "N/A"}</span>
                        )}
                      </div>
                      
                    </div>
                  </div>
                  ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                    <p className="text-xs text-slate-400">Select or add a stage</p>
                  </div>
                )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-gray-50/30">
                <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center mb-6 text-gray-300">
                  <Settings className="w-8 h-8 animate-spin-slow" />
                </div>
                <h3 className="text-base font-bold text-gray-400 uppercase tracking-widest">Select a Workflow</h3>
                <p className="text-xs text-gray-400 mt-2 max-w-xs">
                  Choose a workflow from the sidebar to view or edit its stages and tasks.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Confirm Deletion"
        message="Are you sure you want to delete this workflow? This will permanently delete the Workflow Title along with all its Stages, Key Tasks, Deliverables, and Approval/Sign-off requirements."
        confirmText="Delete Workflow"
        variant="danger"
      />
      <ConfirmModal
        isOpen={isDeleteStageModalOpen}
        onClose={() => {
          setIsDeleteStageModalOpen(false);
          setStageIdToDelete(null);
        }}
        onConfirm={handleConfirmDeleteStage}
        title="Confirm Stage Deletion"
        message="Are you sure you want to delete this stage? This will permanently delete this stage along with all its associated Key Tasks, Deliverables, and Approval / Sign-off instructions."
        confirmText="Delete Stage"
        variant="danger"
      />
    </div>
  );
}
