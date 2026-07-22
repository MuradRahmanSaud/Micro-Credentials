import React, { useState, useEffect } from "react";
import SideView from "./SideView";
import SideEdit from "./SideEdit";
import { Save, X } from "lucide-react";

interface MCBatchPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  onDelete: (row: any) => Promise<void>;
  initialData?: any;
  defaultData?: any;
  headers: string[];
  onDirtyChange?: (isDirty: boolean) => void;
  allData?: any[];
  employees?: any[];
  workflowData?: any[];
}

export default function MCBatchPanel({ 
  isOpen, 
  onClose, 
  onSave, 
  initialData, 
  headers,
  employees,
  workflowData = [],
  allData
}: MCBatchPanelProps) {
  const [isEditing, setIsEditing] = useState(!initialData);
  const [pendingBatches, setPendingBatches] = useState<any[]>([]);

  const [newBatchData, setNewBatchData] = useState<any>(null);

  useEffect(() => {
    if (isOpen && !initialData) {
      // Calculate next batch number
      const batchNumbers = (allData || [])
        .map(b => b["Batch Number"])
        .filter(bn => bn && bn.toString().startsWith("Batch-"))
        .map(bn => parseInt(bn.toString().split("-")[1] || "0", 10));

      const nextNum = batchNumbers.length > 0 ? Math.max(...batchNumbers) + 1 : 1;
      const nextBatchNumber = `Batch-${nextNum.toString().padStart(2, '0')}`;
      setNewBatchData({ "Batch Number": nextBatchNumber });
    } else {
      setNewBatchData(null);
      setPendingBatches([]);
    }
  }, [isOpen, initialData, allData]);

  useEffect(() => {
    if (isOpen) {
      setIsEditing(!initialData);
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleAddToBatchList = async (data: any) => {
    setPendingBatches([...pendingBatches, data]);
    // Calculate next batch number for the next addition
    const batchNumbers = (allData || [])
        .map(b => b["Batch Number"])
        .concat(pendingBatches.map(b => b["Batch Number"]))
        .filter(bn => bn && bn.toString().startsWith("Batch-"))
        .map(bn => parseInt(bn.toString().split("-")[1] || "0", 10));
    const nextNum = batchNumbers.length > 0 ? Math.max(...batchNumbers) + 1 : 1;
    setNewBatchData({ "Batch Number": `Batch-${nextNum.toString().padStart(2, '0')}` });
  };

  const handleSaveAll = async () => {
    for (const batch of pendingBatches) {
      await onSave(batch);
    }
    onClose();
  };

  if (isEditing && !initialData) {
    return (
      <div className="absolute top-0 right-0 bottom-0 w-80 bg-white shadow-2xl z-40 flex flex-col">
        <SideEdit
          isOpen={isOpen}
          onClose={onClose}
          onSave={handleAddToBatchList}
          initialData={newBatchData}
          headers={headers}
          title="Add New Batch"
          employees={employees}
          workflowData={workflowData}
          saveButtonLabel="Add Batch"
          closeOnSave={false}
          isNew={true}
        />
        <div className="p-4 border-t border-gray-100 bg-white">
          <div className="text-xs font-bold text-gray-400 uppercase mb-2">Pending Batches ({pendingBatches.length})</div>
          <div className="max-h-40 overflow-y-auto mb-4">
            {pendingBatches.map((b, i) => <div key={i} className="text-xs">{b["Batch Number"]}</div>)}
          </div>
          <button 
            onClick={handleSaveAll}
            disabled={pendingBatches.length === 0}
            className="w-full py-2 bg-teal-600 text-white rounded flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> Save All
          </button>
        </div>
      </div>
    );
  }

  if (isEditing) {
    return (
      <SideEdit
        isOpen={isOpen}
        onClose={onClose}
        onSave={onSave}
        initialData={initialData}
        headers={headers}
        title="Edit Batch"
        employees={employees}
        workflowData={workflowData}
      />
    );
  }

  return (
    <SideView
      isOpen={isOpen}
      onClose={onClose}
      onEdit={() => setIsEditing(true)}
      onSaveBatch={onSave}
      data={initialData}
      headers={headers}
      title="View Batch Details"
      employees={employees}
      workflowData={workflowData}
    />
  );
}
