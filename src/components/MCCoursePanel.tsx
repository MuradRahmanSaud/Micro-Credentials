import React, { useState, useEffect } from "react";
import SideView from "./SideView";
import SideEdit from "./SideEdit";

interface MCCoursePanelProps {
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
  allBatches?: any[];
  onSaveBatch?: (formData: any, editingRow: any | null) => Promise<void>;
  allDocuments?: any[];
  onSaveDocument?: (formData: any, editingRow: any | null) => Promise<void>;
  workflowData?: any[];
}

export default function MCCoursePanel({ 
  isOpen, 
  onClose, 
  onSave, 
  initialData, 
  headers,
  employees,
  allBatches,
  onSaveBatch,
  allDocuments,
  onSaveDocument,
  workflowData = []
}: MCCoursePanelProps) {
  const [isEditing, setIsEditing] = useState(!initialData);

  useEffect(() => {
    if (isOpen) {
      setIsEditing(!initialData);
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  if (isEditing) {
    return (
      <SideEdit
        isOpen={isOpen}
        onClose={() => {
          if (initialData) {
            setIsEditing(false);
          } else {
            onClose();
          }
        }}
        onSave={async (data) => {
          await onSave(data);
          if (initialData) setIsEditing(false);
        }}
        initialData={initialData}
        headers={headers}
        title={initialData ? "Edit Course" : "Add New Course"}
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
      data={initialData}
      headers={["Course Title", "Course Code", "Banner", "Publication Workflow"]}
      title="View Course"
      employees={employees}
      allBatches={allBatches}
      onSaveBatch={onSaveBatch}
      allDocuments={allDocuments}
      onSaveDocument={onSaveDocument}
      workflowData={workflowData}
    />
  );
}
