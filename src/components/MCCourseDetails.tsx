import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Edit2, Globe, Clock, Calendar, Users, CheckCircle, Target, BookOpen, AlertCircle, Save, Loader2, TrendingUp, Briefcase, GripVertical, Tag, Percent, Banknote, CreditCard, Wallet, PieChart, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import EmployeeMultiSelect from './EmployeeMultiSelect';
import MCBatchPanel from './MCBatchPanel';
import BatchDetailsView from './BatchDetailsView';
import DocumentsPanel from './DocumentsPanel';
import { Plus, ChevronUp, ChevronDown, Eye, Upload, Search, ListFilter, Pencil, Check } from 'lucide-react';
import { resolveNamesOrIdsToIds, resolveIdsToNames, cn, formatToMmmDdYyyy, isBatchRunning, parseWorkflowAndStages, serializeWorkflowAndStages, getStageAssignment, parseWorkflowTitle } from '../lib/utils';
import axios from 'axios';
import WorkflowTimeline from './WorkflowTimeline';
import { FOLDER_LOCATIONS } from '../FolderLocation';

const TakaIcon = ({ className }: { className?: string }) => (
  <span className={`${className} font-medium select-none text-[13px] flex items-center justify-center leading-none`} style={{ fontFamily: 'sans-serif' }}>
    ৳
  </span>
);

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

interface MCCourseDetailsProps {
  isOpen: boolean;
  onClose: () => void;
  data: any;
  onSave: (formData: any, editingRow: any | null) => Promise<void>;
  employees?: any[];
  batches?: any[];
  documents?: any[];
  workflowData?: any[];
  extraFormProps?: {
    onSaveBatch?: (formData: any, editingRow: any | null) => Promise<void>;
    onSaveDocument?: (formData: any, editingRow: any | null) => Promise<void>;
    batchHeaders?: string[];
    documentHeaders?: string[];
  };
}

export default function MCCourseDetails({ 
  isOpen, 
  onClose, 
  data, 
  onSave, 
  employees = [], 
  batches = [], 
  documents = [], 
  workflowData = [],
  extraFormProps 
}: MCCourseDetailsProps) {
  const [isAddBatchOpen, setIsAddBatchOpen] = useState(false);
  const [editedBatches, setEditedBatches] = useState<Record<string, any>>({});
  const [localNewBatches, setLocalNewBatches] = useState<any[]>([]);
  const [localNewDocs, setLocalNewDocs] = useState<any[]>([]);
  const [batchSavingKey, setBatchSavingKey] = useState<string | null>(null);
  const [activeDocKey, setActiveDocKey] = useState<string | null>(null);
  const [newBatchesData, setNewBatchesData] = useState<any[]>([]);
  const [batchWarning, setBatchWarning] = useState<string | null>(null);
  
  const [newDocumentData, setNewDocumentData] = useState({
    "Documents Title": "",
    "Date": new Date().toISOString().split('T')[0],
    "File Link": ""
  });

  const getNextBatchNumber = (currentNewBatches: any[] = []) => {
    const courseBatches = [
      ...batches.filter(b => b['Course Code'] === data?.['Course Code'] || b['Course Name'] === data?.['Course Title']),
      ...localNewBatches,
      ...currentNewBatches
    ];
    const maxBatchNum = courseBatches.reduce((max, b) => {
      const match = String(b['Batch Number'] || '').match(/Batch-(\d+)/);
      const num = match ? parseInt(match[1], 10) : 0;
      return Math.max(max, num);
    }, 0);
    return `Batch-${String(maxBatchNum + 1).padStart(2, '0')}`;
  };
  
  useEffect(() => {
    if (isAddBatchOpen) {
      const timer = setTimeout(() => {
        const nextBatchNumber = getNextBatchNumber([]);
        setNewBatchesData([
          {
            "Batch Number": nextBatchNumber,
            "Start Date": "",
            "End Date": "",
            "Student": "",
            "Instractor": ""
          }
        ]);
      }, 100);
      return () => clearTimeout(timer);
    } else {
      setNewBatchesData([]);
      setBatchWarning(null);
    }
  }, [isAddBatchOpen, batches, localNewBatches, data]);

  const [isAddDocumentOpen, setIsAddDocumentOpen] = useState(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState<'workflow' | 'documents' | 'financial_overview'>('workflow');
  const [documentFilter, setDocumentFilter] = useState<string | null>(null);
  const [selectedBatchIndex, setSelectedBatchIndex] = useState<number | null>(0);
  const [inlineEditingBatchKey, setInlineEditingBatchKey] = useState<string | null>(null);
  const [batchSearchTerm, setBatchSearchTerm] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isUploadingNewDoc, setIsUploadingNewDoc] = useState(false);
  const [docErrors, setDocErrors] = useState<Record<string, string>>({});
  const [editedData, setEditedData] = useState(data);
  const [batchPage, setBatchPage] = useState(1);
  const ITEMS_PER_PAGE = 20;
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddBatch = async () => {
    const validBatches = newBatchesData.filter(b => b["Start Date"] && b["End Date"]);
    if (validBatches.length === 0) {
      setIsAddBatchOpen(false);
      return;
    }

    const batchesToSave = validBatches.map(b => ({
      ...b,
      "Course Code": data?.['Course Code'],
      "Course Name": data?.['Course Title']
    }));

    if (isEditing) {
      setLocalNewBatches(prev => [...prev, ...batchesToSave]);
      setIsAddBatchOpen(false);
      setNewBatchesData([]);
      setBatchWarning(null);
      return;
    }

    if (extraFormProps?.onSaveBatch) {
      setIsSubmitting(true);
      const promises = batchesToSave.map(batchToSave => extraFormProps.onSaveBatch!(batchToSave, null));
      await Promise.all(promises);
      setIsSubmitting(false);
      setIsAddBatchOpen(false);
      setNewBatchesData([]);
      setBatchWarning(null);
    }
  };

  const addBatchRowRef = useRef<HTMLTableRowElement | null>(null);

  useEffect(() => {
    const handleOutsideClick = async (event: MouseEvent) => {
      if (!isAddBatchOpen) return;

      const target = event.target as HTMLElement;
      if (
        target.closest('[data-add-batch-row="true"]') ||
        target.closest('[data-portal-dropdown="true"]') ||
        target.closest('#add-batch-btn')
      ) {
        return;
      }

      const hasAnyValid = newBatchesData.some(b => b["Start Date"] && b["End Date"]);
      if (hasAnyValid) {
        await handleAddBatch();
      } else {
        setIsAddBatchOpen(false);
        setNewBatchesData([]);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isAddBatchOpen, newBatchesData]);

  const handleAddDocument = async () => {
    const errors: Record<string, string> = {};
    if (!newDocumentData["Documents Title"]) errors.title = "Title is required";
    if (!newDocumentData["Date"]) errors.date = "Date is required";
    if (!newDocumentData["File Link"]) errors.link = "File link or upload is required";

    if (Object.keys(errors).length > 0) {
      setDocErrors(errors);
      return;
    }
    setDocErrors({});
    
    const docToSave = {
      ...newDocumentData,
      "Course Code": data?.['Course Code'],
      "Course Name": data?.['Course Title'],
      "Tag": data?.['Course Code']
    };

    if (isEditing) {
      setLocalNewDocs(prev => [...prev, docToSave]);
      setIsAddDocumentOpen(false);
      setDocErrors({});
      setNewDocumentData({
        "Documents Title": "",
        "Date": new Date().toISOString().split('T')[0],
        "File Link": ""
      });
      return;
    }

    if (extraFormProps?.onSaveDocument) {
      setIsSubmitting(true);
      await extraFormProps.onSaveDocument(docToSave, null);
      setIsSubmitting(false);
      setIsAddDocumentOpen(false);
      setDocErrors({});
      setNewDocumentData({
        "Documents Title": "",
        "Date": new Date().toISOString().split('T')[0],
        "File Link": ""
      });
    }
  };

  const [localStages, setLocalStages] = useState<any[]>([]);
  const [draggedStageIndex, setDraggedStageIndex] = useState<number | null>(null);

  const handleStageUpdate = (index: number, field: string, value: string) => {
    setLocalStages(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleAddLocalStage = () => {
    if (!jobTitle) return;
    const newStageNum = localStages.length + 1;
    const newStage = {
      "ID": `WS-${Date.now()}`,
      "Job Title": jobTitle,
      "Workflow Stage": `${newStageNum}. New Stage`,
      "Key Responsibilities": "",
      "Deliverables": ""
    };
    setLocalStages(prev => [...prev, newStage]);
  };

  const handleDeleteLocalStage = (index: number) => {
    setLocalStages(prev => {
      const updated = prev.filter((_, i) => i !== index);
      // Resequence
      return updated.map((stage, i) => ({
        ...stage,
        "Workflow Stage": `${i + 1}. ${stage["Workflow Stage"].replace(/^\d+\.\s*/, '')}`
      }));
    });
  };

  const [editedDocs, setEditedDocs] = useState<Record<string, any>>({});
  const [docUploadingKey, setDocUploadingKey] = useState<string | null>(null);
  const [docSavingKey, setDocSavingKey] = useState<string | null>(null);

  const courseBatches = useMemo(() => {
    return [
      ...batches.filter(b => b['Course Code'] === data?.['Course Code'] || b['Course Name'] === data?.['Course Title']),
      ...localNewBatches
    ].map(b => {
      const key = b["Batch Number"] || b["id"] || b["ID"];
      return editedBatches[key] || b;
    });
  }, [batches, data, localNewBatches, editedBatches]);

  const handleSelectBatchWithAutoSave = async (clickedIndex: number, clickedBatchKey: string) => {
    const previousKey = inlineEditingBatchKey;
    setSelectedBatchIndex(clickedIndex);

    if (!isEditing) {
      return;
    }

    if (previousKey === clickedBatchKey) {
      return;
    }

    if (previousKey) {
      const prevOriginalBatch = [
        ...batches.filter(b => b['Course Code'] === data?.['Course Code'] || b['Course Name'] === data?.['Course Title']),
        ...localNewBatches
      ].find(b => (b["Batch Number"] || b["id"] || b["ID"]) === previousKey);

      const prevLocalBatch = editedBatches[previousKey];

      if (prevLocalBatch && prevOriginalBatch) {
        const isDirty = JSON.stringify(prevLocalBatch) !== JSON.stringify(prevOriginalBatch);
        if (isDirty) {
          if (extraFormProps?.onSaveBatch) {
            setBatchSavingKey(previousKey);
            try {
              await extraFormProps.onSaveBatch(prevLocalBatch, prevOriginalBatch);
              setEditedBatches(prev => {
                const copy = { ...prev };
                delete copy[previousKey];
                return copy;
              });
            } catch (err) {
              console.error("Failed to auto-save batch:", err);
            } finally {
              setBatchSavingKey(null);
            }
          }
        }
      }
    }

    setInlineEditingBatchKey(clickedBatchKey);
  };

  const toInputDateValue = (dateStr: any) => {
    if (!dateStr) return '';
    // If it's a date object, format it. If it's a string, try parsing.
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const courseWorkflow = editedData?.['Workflow'] || editedData?.['Publication Workflow'] || data?.['Workflow'] || data?.['Publication Workflow'] || "";
  const { jobTitle, stageAssignments } = parseWorkflowAndStages(courseWorkflow);

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
  }, [jobTitle, parsedWorkflows, isEditing]);

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
      const assignedIds = stageAssignments[stg["ID"]] || getStageAssignment(stageAssignments, originalName);
      updatedAssignments[stg["ID"]] = assignedIds;
    });

    const serialized = serializeWorkflowAndStages(jobTitle, updatedAssignments);
    setEditedData((prev: any) => ({
      ...prev,
      'Workflow': serialized,
      'Publication Workflow': serialized
    }));
  };

  useEffect(() => {
    setEditedData(data);
    setIsEditing(false);
  }, [data]);

  // Updated course info based on the provided screenshot structure
  const courseInfo = [
    { key: 'Mode', icon: Globe, label: 'Mode', value: editedData?.['Mode'] || 'Hybrid' },
    { key: 'Duration', icon: Clock, label: 'Duration', value: editedData?.['Duration'] || '30' },
    { key: 'No. of Class', icon: Calendar, label: 'No. of Class', value: editedData?.['No. of Class'] || '10' },
    { key: 'Course Fee', icon: TakaIcon, label: 'Course Fee', value: editedData?.['Course Fee'] || '2000' },
    { key: 'Student Size', icon: Users, label: 'Student Size', value: editedData?.['Student Size'] || '20-25' },
    { key: 'Status', icon: CheckCircle, label: 'Status', value: editedData?.['Status'] || 'On Hold' },
    { key: 'Batches', icon: AlertCircle, label: 'Batches', value: editedData?.['Batches'] || '—' },
    { key: 'Enrolled', icon: Users, label: 'Enrolled', value: editedData?.['Enrolled'] || editedData?.['Enrollments'] || '—' },
    { 
      key: 'Gross Revenue', 
      icon: TakaIcon, 
      label: 'Gross Revenue', 
      value: (() => {
        const fee = parseFloat(String(editedData?.['Course Fee'] || "0").replace(/[^0-9.]/g, ""));
        const enrolled = parseInt(String(editedData?.['Enrolled'] || editedData?.['Enrollments'] || "0").replace(/[^0-9.]/g, ""), 10);
        const gross = isNaN(fee) || isNaN(enrolled) ? 0 : fee * enrolled;
        return gross.toLocaleString();
      })()
    },
    { 
      key: 'Net Revenue', 
      icon: TakaIcon, 
      label: 'Net Revenue', 
      value: (() => {
        const fee = parseFloat(String(editedData?.['Course Fee'] || "0").replace(/[^0-9.]/g, ""));
        const enrolled = parseInt(String(editedData?.['Enrolled'] || editedData?.['Enrollments'] || "0").replace(/[^0-9.]/g, ""), 10);
        const discount = parseFloat(String(editedData?.['Discount'] || "0").replace(/[^0-9.]/g, ""));
        const gross = isNaN(fee) || isNaN(enrolled) ? 0 : fee * enrolled;
        const net = gross - (isNaN(discount) ? 0 : discount);
        return net.toLocaleString();
      })()
    },
    { key: 'Discount', icon: TrendingUp, label: 'Discount', value: editedData?.['Discount'] || '0' },
    { key: 'Expenses', icon: TrendingUp, label: 'Expenses', value: editedData?.['Expenses'] || '0' },
    { 
      key: 'Net Profit', 
      icon: TrendingUp, 
      label: 'Net Profit', 
      value: (() => {
        const fee = parseFloat(String(editedData?.['Course Fee'] || "0").replace(/[^0-9.]/g, ""));
        const enrolled = parseInt(String(editedData?.['Enrolled'] || editedData?.['Enrollments'] || "0").replace(/[^0-9.]/g, ""), 10);
        const discount = parseFloat(String(editedData?.['Discount'] || "0").replace(/[^0-9.]/g, ""));
        const expenses = parseFloat(String(editedData?.['Expenses'] || "0").replace(/[^0-9.]/g, ""));
        const gross = isNaN(fee) || isNaN(enrolled) ? 0 : fee * enrolled;
        const net = gross - (isNaN(discount) ? 0 : discount);
        const profit = net - (isNaN(expenses) ? 0 : expenses);
        return profit.toLocaleString();
      })()
    },
    { 
      key: 'Profit %', 
      icon: TrendingUp, 
      label: 'Profit %', 
      value: (() => {
        const fee = parseFloat(String(editedData?.['Course Fee'] || "0").replace(/[^0-9.]/g, ""));
        const enrolled = parseInt(String(editedData?.['Enrolled'] || editedData?.['Enrollments'] || "0").replace(/[^0-9.]/g, ""), 10);
        const discount = parseFloat(String(editedData?.['Discount'] || "0").replace(/[^0-9.]/g, ""));
        const expenses = parseFloat(String(editedData?.['Expenses'] || "0").replace(/[^0-9.]/g, ""));
        const gross = isNaN(fee) || isNaN(enrolled) ? 0 : fee * enrolled;
        const net = gross - (isNaN(discount) ? 0 : discount);
        const profit = net - (isNaN(expenses) ? 0 : expenses);
        const margin = net > 0 ? (profit / net) * 100 : 0;
        return `${margin.toFixed(1)}%`;
      })()
    },
  ];

  const handleInputChange = (key: string, value: string) => {
    setEditedData((prev: any) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      let finalEditedData = { ...editedData };

      // Re-serialize the course workflow with the new prefixed stage names to keep everything fully synced!
      if (jobTitle && localStages && localStages.length > 0) {
        const updatedAssignments: Record<string, string[]> = {};
        localStages.forEach((stage, idx) => {
          const originalStageName = stage["Workflow Stage"] || "Unnamed Stage";
          
          // Get the employee assignments using the stage ID, fallback to original name
          const assignedIds = stageAssignments[stage["ID"]] || getStageAssignment(stageAssignments, originalStageName);
          updatedAssignments[stage["ID"]] = assignedIds;
        });

        const matchingWorkflow = parsedWorkflows.find(w => 
          w.id === jobTitle || w.title.trim().toLowerCase() === jobTitle.trim().toLowerCase()
        );
        const workflowIdToSave = matchingWorkflow ? matchingWorkflow.id : jobTitle;

        const serialized = serializeWorkflowAndStages(workflowIdToSave, updatedAssignments);
        finalEditedData = {
          ...finalEditedData,
          'Workflow': serialized,
          'Publication Workflow': serialized
        };
      }

      // Check if there are batches currently being added, and capture them before saving
      let batchesToSave = [...localNewBatches];
      if (isAddBatchOpen) {
        const validBatches = newBatchesData.filter(b => b["Start Date"] && b["End Date"]);
        
        // Only add if not already in localNewBatches
        const formattedNew = validBatches.filter(b => 
            !localNewBatches.some(lb => lb["Batch Number"] === b["Batch Number"])
        ).map(b => ({
          ...b,
          "Course Code": data?.['Course Code'],
          "Course Name": data?.['Course Title']
        }));
        
        batchesToSave = [...batchesToSave, ...formattedNew];
      }

      // Check if there is a document currently being added, and capture it before saving
      let docsToSave = [...localNewDocs];
      if (isAddDocumentOpen && newDocumentData["Documents Title"]?.trim()) {
        const docToSave = {
          ...newDocumentData,
          "Course Code": data?.['Course Code'],
          "Course Name": data?.['Course Title'],
          "Tag": data?.['Course Code']
        };
        docsToSave.push(docToSave);
      }

      // Clear local new states immediately so they don't duplicate with the optimistic parent updates
      setLocalNewBatches([]);
      setLocalNewDocs([]);

      // Turn off editing state and close dialogs/forms immediately so UI becomes static instantly
      setIsAddBatchOpen(false);
      setIsAddDocumentOpen(false);
      setInlineEditingBatchKey(null);
      setIsEditing(false);

      // 1. Create a list of promises to execute concurrently
      const savePromises: Promise<any>[] = [];

      // Save Course row with the updated serialized workflow
      savePromises.push(onSave(finalEditedData, data));

      // 2. Save modified and new batches concurrently to maximize saving speed
      const saveBatchesSequence = async () => {
        if (extraFormProps?.onSaveBatch) {
          const promises: Promise<any>[] = [];
          const batchEntries = Object.entries(editedBatches);
          for (const [key, batchData] of batchEntries) {
            const originalBatch = batches.find(b => (b["Batch Number"] || b["id"] || b["ID"]) === key);
            promises.push(extraFormProps.onSaveBatch(batchData, originalBatch || null));
          }
          if (batchesToSave.length > 0) {
            for (const batchData of batchesToSave) {
              promises.push(extraFormProps.onSaveBatch(batchData, null));
            }
          }
          if (promises.length > 0) {
            await Promise.all(promises);
          }
        }
      };

      // 3. Save modified and new docs concurrently to maximize saving speed
      const saveDocsSequence = async () => {
        if (extraFormProps?.onSaveDocument) {
          const promises: Promise<any>[] = [];
          const docEntries = Object.entries(editedDocs);
          for (const [key, docData] of docEntries) {
            const originalDoc = documents.find(d => (d["Documents Title"] || d["id"] || d["ID"]) === key);
            promises.push(extraFormProps.onSaveDocument(docData, originalDoc || null));
          }
          if (docsToSave.length > 0) {
            for (const docData of docsToSave) {
              promises.push(extraFormProps.onSaveDocument(docData, null));
            }
          }
          if (promises.length > 0) {
            await Promise.all(promises);
          }
        }
      };

      savePromises.push(saveBatchesSequence());
      savePromises.push(saveDocsSequence());

      // Await all save operations to maximize saving speed and keep sequential order where needed
      await Promise.all(savePromises);

      // Clear local states and reset editing states
      setEditedBatches({});
      setEditedDocs({});
      setLocalNewBatches([]);
      setLocalNewDocs([]);
      setNewBatchesData([]);
      setNewDocumentData({
        "Documents Title": "",
        "Date": new Date().toISOString().split('T')[0],
        "File Link": ""
      });
    } catch (error) {
      console.error('Failed to save data:', error);
      alert('Failed to save data. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

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

  return (
    <AnimatePresence>
      {isOpen && (
        <>
        <motion.div
          initial={{ opacity: 0, scale: 0.99 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.99 }}
          transition={{ duration: 0.15 }}
          className="absolute inset-0 z-50 bg-gradient-to-br from-slate-50 via-white to-teal-50 shadow-xl overflow-hidden flex flex-col lg:flex-row"
        >
          {/* Left Main Area: Fixed Banner + Scrollable Info Grid */}
          <div className="flex-1 flex flex-col h-full overflow-hidden border-r border-slate-100">
{/* Fixed Banner Area */}
          {/* Sticky Banner Container */}
                <div className="shrink-0 p-4 pb-0 z-40 bg-transparent">
                  {/* Banner & Identity */}
                  <div className="group/banner rounded-md overflow-hidden border border-slate-100 shadow-sm">
                    {(() => {
                    const bannerUrl = editedData?.['Banner'] || data?.['Banner'];
                    let displayUrl = bannerUrl;
                    const fileIdMatch = bannerUrl?.match(/[-\w]{25,}/);
                    if (fileIdMatch && bannerUrl?.includes('drive.google.com')) {
                      displayUrl = `https://drive.google.com/thumbnail?id=${fileIdMatch[0]}&sz=w1000`;
                    }
                    
                    const hasCourseInfo = !!(data?.['Course Code'] && data?.['Course Title']);

                    return (
                      <div className="w-full h-28 md:h-32 relative bg-teal-900 flex items-center justify-center">
                        {displayUrl ? (
                          <img
                            src={displayUrl}
                            alt="Course Banner"
                            className="absolute inset-0 w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <BookOpen className="w-8 h-8 text-teal-800/60 z-0" />
                        )}
                        {/* Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-teal-950/90 via-teal-900/40 to-black/20" />
                        
                        {/* Action Buttons - Top Right (Hover) */}
                        {!isEditing && hasCourseInfo && (
                          <div className="absolute top-0 right-0 p-10 z-20 group/actions pointer-events-none">
                            <div className="flex items-center gap-1.5 opacity-0 group-hover/actions:opacity-100 transition-opacity duration-200 pointer-events-auto absolute top-2.5 right-2.5">
                              <button 
                                onClick={() => setIsEditing(true)} 
                                className="p-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-xs transition-colors border border-white/10 cursor-pointer shadow-sm"
                                title="Edit Course"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button 
                                onClick={onClose} 
                                className="p-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-xs transition-colors border border-white/10 cursor-pointer shadow-sm"
                                title="Close"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Edit Mode Buttons */}
                        {isEditing && (
                          <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-2">
                            <button 
                              onClick={() => {
                                setIsEditing(false);
                                setEditedData(data);
                                setEditedBatches({});
                                setEditedDocs({});
                                setLocalNewBatches([]);
                                setLocalNewDocs([]);
                                setInlineEditingBatchKey(null);
                                // Also sync localStages back to original data if needed
                                if (data && data["Workflow"]) {
                                    try {
                                        const parsed = JSON.parse(data["Workflow"]);
                                        if (Array.isArray(parsed)) setLocalStages(parsed);
                                    } catch(e) {}
                                }
                              }}
                              disabled={isSubmitting}
                              className="px-2.5 py-1 text-[13px] font-medium text-white bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-md transition-all uppercase disabled:opacity-50"
                            >
                              Cancel
                            </button>
                            <button 
                              onClick={handleSave} 
                              disabled={isSubmitting}
                              className="flex items-center gap-1.5 px-3 py-1 bg-teal-500 hover:bg-teal-600 text-white rounded-md border border-teal-400 text-[13px] font-medium uppercase tracking-wider transition-all disabled:opacity-50 shadow-lg"
                            >
                              {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                              Save
                            </button>
                          </div>
                        )}

                        {/* Course Identity Glass Panel - Bottom Left */}
                        <div className="absolute bottom-2 left-2 right-2 z-10">
                          <div className="bg-black/20 backdrop-blur-md border border-white/10 rounded-md p-2 shadow-lg">
                            <div className="flex flex-col gap-3">
                              <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="px-1.5 py-0.5 bg-teal-500 text-white text-[10px] font-bold uppercase tracking-wider rounded">
                                      {editedData?.['Mode'] || data?.['Mode'] || 'Online'}
                                    </span>
                                    <span className="px-1.5 py-0.5 bg-white/10 text-white/90 text-[10px] font-bold uppercase tracking-wider rounded border border-white/10">
                                      {editedData?.['Course Code'] || data?.['Course Code'] || 'CODE'}
                                    </span>
                                  </div>
                                  <div className="flex flex-col gap-1 w-full max-w-md">
                                    {isEditing ? (
                                      <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                          <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest leading-none">Course Title</span>
                                          {editedData?.['Course Title'] !== data?.['Course Title'] && (
                                            <span className="text-[9px] font-bold text-amber-300 animate-pulse uppercase tracking-widest bg-white/5 px-1 rounded border border-white/10">Changed</span>
                                          )}
                                        </div>
                                        <input 
                                          type="text" 
                                          value={editedData?.['Course Title'] || ''} 
                                          onChange={(e) => handleInputChange('Course Title', e.target.value)}
                                          className="bg-white/10 border border-white/20 rounded px-2 py-1 w-full outline-none focus:bg-white/20 transition-all text-white uppercase text-lg font-medium"
                                        />
                                      </div>
                                    ) : (
                                      <h2 className="text-lg font-medium text-white uppercase tracking-wider leading-tight drop-shadow-md">
                                        {editedData?.['Course Title'] || data?.['Course Title'] || 'Untitled Course'}
                                      </h2>
                                    )}
                                  </div>

                                  {/* Info Row: Status, Duration, Classes */}
                                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-2 text-white/80">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[9px] font-medium uppercase tracking-widest opacity-50">Status</span>
                                      {isEditing ? (
                                        <div className="flex items-center gap-1.5">
                                          <select 
                                            value={editedData?.['Status'] || ''} 
                                            onChange={(e) => handleInputChange('Status', e.target.value)}
                                            className="bg-white/10 border border-white/20 rounded px-1 py-0.5 text-[12px] font-medium uppercase outline-none text-white appearance-none cursor-pointer min-w-[80px]"
                                          >
                                            <option value="Active" className="text-slate-900">Active</option>
                                            <option value="Inactive" className="text-slate-900">Inactive</option>
                                            <option value="Upcoming" className="text-slate-900">Upcoming</option>
                                            <option value="On Hold" className="text-slate-900">On Hold</option>
                                          </select>
                                          {editedData?.['Status'] !== data?.['Status'] && (
                                            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" title="Status Changed" />
                                          )}
                                        </div>
                                      ) : (
                                        <span className="text-[12px] font-medium uppercase">{editedData?.['Status'] || data?.['Status'] || 'Active'}</span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[9px] font-medium uppercase tracking-widest opacity-50">Duration</span>
                                      {isEditing ? (
                                        <div className="flex items-center gap-1.5">
                                          <input 
                                            type="text" 
                                            value={editedData?.['Duration'] || ''} 
                                            onChange={(e) => handleInputChange('Duration', e.target.value)}
                                            className="bg-white/10 border border-white/20 rounded px-1 py-0.5 text-[12px] font-medium uppercase outline-none text-white w-20"
                                          />
                                          {editedData?.['Duration'] !== data?.['Duration'] && (
                                            <div className="w-1 h-1 rounded-full bg-amber-400 animate-pulse" />
                                          )}
                                        </div>
                                      ) : (
                                        <span className="text-[12px] font-medium uppercase">{editedData?.['Duration'] || data?.['Duration'] || '—'}</span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[9px] font-medium uppercase tracking-widest opacity-50">Classes</span>
                                      {isEditing ? (
                                        <div className="flex items-center gap-1.5">
                                          <input 
                                            type="text" 
                                            value={editedData?.['No. of Class'] || ''} 
                                            onChange={(e) => handleInputChange('No. of Class', e.target.value)}
                                            className="bg-white/10 border border-white/20 rounded px-1 py-0.5 text-[12px] font-medium uppercase outline-none text-white w-12"
                                          />
                                          {editedData?.['No. of Class'] !== data?.['No. of Class'] && (
                                            <div className="w-1 h-1 rounded-full bg-amber-400 animate-pulse" />
                                          )}
                                        </div>
                                      ) : (
                                        <span className="text-[12px] font-medium uppercase">{editedData?.['No. of Class'] || data?.['No. of Class'] || '—'}</span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-4 text-white/80">
                                  <div className="flex flex-col items-start md:items-end">
                                    <span className="text-[10px] font-medium uppercase tracking-widest opacity-60">Category</span>
                                    {isEditing ? (
                                      <select
                                        value={editedData?.['Course Category'] || data?.['Course Category'] || 'Technical'}
                                        onChange={(e) => handleInputChange('Course Category', e.target.value)}
                                        className="bg-white/10 border border-white/20 rounded px-1.5 py-0.5 text-[12px] font-medium uppercase outline-none text-white appearance-none cursor-pointer text-right"
                                      >
                                        <option value="Technical" className="text-slate-900">Technical</option>
                                        <option value="Non-Technical" className="text-slate-900">Non-Technical</option>
                                        <option value="Professional" className="text-slate-900">Professional</option>
                                      </select>
                                    ) : (
                                      <span className="text-[13px] font-medium uppercase">{editedData?.['Course Category'] || data?.['Course Category'] || 'Technical'}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

                

            <div className="flex-1 overflow-y-auto no-scrollbar pt-2 flex flex-col">
{/* Plain Text Document Style Info Grid */}
                <div className="flex flex-col gap-8 px-4 w-full h-full pb-6">
                  {/* Batch List */}
                  <div className="w-full min-w-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col flex-1">
                    <div className="flex items-center justify-between p-2 border-b border-slate-200 bg-slate-50/50">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 px-2">
                          <Users className="w-4 h-4 text-teal-600" />
                          <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Batch List</h4>
                        </div>
                        {(() => {
                           const courseBatches = batches.filter(b => b['Course Code'] === data?.['Course Code'] || b['Course Name'] === data?.['Course Title']);
                           const completed = courseBatches.filter(b => !isBatchRunning(b)).length;
                           const running = courseBatches.filter(b => isBatchRunning(b)).length;
                           const students = courseBatches.reduce((acc, curr) => acc + (parseInt(curr["Student"] || curr["Students"] || "0", 10) || 0), 0);
                           return (
                             <div className="hidden sm:flex items-center gap-3 text-[10px] text-gray-500 font-mono tracking-wide">
                               <span className="bg-white px-2 py-0.5 border border-slate-200 rounded text-slate-600">Completed: {completed}</span>
                               <span className="bg-teal-50 px-2 py-0.5 border border-teal-200 rounded text-teal-700">Running: {running}</span>
                               <span className="bg-white px-2 py-0.5 border border-slate-200 rounded text-slate-600">Students: {students}</span>
                             </div>
                           );
                        })()}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="relative w-48 group">
                          <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-1 z-10">
                            <Search className="w-3.5 h-3.5 text-gray-400 group-focus-within:text-teal-500 transition-colors" />
                          </div>
                          <input
                            type="text"
                            placeholder="Search batches..."
                            className="w-full pl-7 pr-8 py-1 text-[11px] bg-white border border-gray-200 text-gray-800 rounded focus:outline-none focus:border-teal-500 transition-all placeholder:text-gray-400"
                            value={batchSearchTerm}
                            onChange={(e) => setBatchSearchTerm(e.target.value)}
                          />
                          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1 z-10">
                             <button className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-teal-600 transition-colors">
                               <ListFilter className="w-3.5 h-3.5" />
                             </button>
                          </div>
                        </div>
                        {isEditing && (
                          <button 
                            id="add-batch-btn"
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (isAddBatchOpen) {
                                const incompleteRow = newBatchesData.find(b => !b["Start Date"] || !b["End Date"]);
                                if (incompleteRow) {
                                  setBatchWarning("invalid");
                                  return;
                                }
                                setBatchWarning(null);
                                const nextNum = getNextBatchNumber(newBatchesData);
                                setNewBatchesData(prev => [
                                  ...prev,
                                  {
                                    "Batch Number": nextNum,
                                    "Start Date": "",
                                    "End Date": "",
                                    "Student": "",
                                    "Instractor": ""
                                  }
                                ]);
                              } else {
                                setBatchWarning(null);
                                setIsAddBatchOpen(true);
                              }
                            }} 
                            className="p-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded transition-all active:scale-95" 
                            title={isAddBatchOpen ? "Add Another Batch Row" : "Add Batch"}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="w-full flex-1 bg-white flex flex-col min-h-0">
                        {(() => {
                           let courseBatches = [
                             ...batches.filter(b => b['Course Code'] === data?.['Course Code'] || b['Course Name'] === data?.['Course Title']),
                             ...localNewBatches
                           ].map(b => {
                             const key = b["Batch Number"] || b["id"] || b["ID"];
                             return editedBatches[key] || b;
                           });
                           
                           if (batchSearchTerm.trim() !== '') {
                             const lowerSearch = batchSearchTerm.toLowerCase();
                             courseBatches = courseBatches.filter(b => 
                               String(b['Batch Number'] || '').toLowerCase().includes(lowerSearch) ||
                               String(b['Start Date'] || '').toLowerCase().includes(lowerSearch) ||
                               String(b['End Date'] || '').toLowerCase().includes(lowerSearch) ||
                               String(b['Student'] || '').toLowerCase().includes(lowerSearch)
                             );
                           }

                           const totalBatches = courseBatches.length;
                           const totalBatchPages = Math.ceil(totalBatches / ITEMS_PER_PAGE) || 1;
                           const currentBatchPage = Math.min(batchPage, totalBatchPages);
                           const paginatedBatches = courseBatches.slice((currentBatchPage - 1) * ITEMS_PER_PAGE, currentBatchPage * ITEMS_PER_PAGE);
                           
                           if (courseBatches.length === 0 && !isAddBatchOpen) {
                              return (
                                <div className="py-6 px-4 m-3 text-center rounded border border-dashed border-slate-200 bg-slate-50/50">
                                  <span className="text-gray-400 text-[13px] font-medium block mb-1">NO BATCHES FOUND</span>
                                  <p className="text-gray-400/70 text-[13px] italic">No matching batches found.</p>
                                </div>
                              );
                            }
                            return (
                              <div className="flex flex-col w-full h-full min-h-[300px]">
                                <div className="flex flex-col md:flex-row w-full bg-white flex-1 min-h-0">
                                  <div className="w-full md:w-[60%] overflow-y-auto no-scrollbar relative">
                                    <table className="w-full table-auto text-left relative">
                                      <thead className="bg-gray-50 shadow-sm sticky top-0 z-10">
                                        <tr>
                                          <th className="px-2 py-1 text-xs font-bold text-gray-500 uppercase tracking-tighter border-b border-gray-200 border-r border-gray-100 bg-gray-50 whitespace-nowrap text-left">Batch No</th>
                                          <th className="px-2 py-1 text-xs font-bold text-gray-500 uppercase tracking-tighter border-b border-gray-200 border-r border-gray-100 bg-gray-50 whitespace-nowrap text-center">Start Date</th>
                                          <th className="px-2 py-1 text-xs font-bold text-gray-500 uppercase tracking-tighter border-b border-gray-200 border-r border-gray-100 bg-gray-50 whitespace-nowrap text-center">End Date</th>
                                          <th className="px-2 py-1 text-xs font-bold text-gray-500 uppercase tracking-tighter border-b border-gray-200 border-r border-gray-100 bg-gray-50 whitespace-nowrap text-center">Student</th>
                                          <th className="px-2 py-1 text-xs font-bold text-gray-500 uppercase tracking-tighter border-b border-gray-200 border-r border-gray-100 bg-gray-50 whitespace-nowrap text-center">Instructors</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-100">
                                        {isAddBatchOpen && newBatchesData.map((newBatchRow, rowIndex) => (
                                          <tr key={`new-batch-${rowIndex}`} data-add-batch-row="true" className="bg-amber-50/30">
                                            <td className="px-2 py-1 border-r border-gray-100">
                                              <input 
                                                  type="text" 
                                                  placeholder="Batch No" 
                                                  value={newBatchRow["Batch Number"] || ""} 
                                                  onChange={e => {
                                                    const updated = [...newBatchesData];
                                                    updated[rowIndex] = { ...newBatchRow, "Batch Number": e.target.value };
                                                    setNewBatchesData(updated);
                                                  }}
                                                  className="w-full min-w-[80px] text-[11px] bg-white border border-slate-200 rounded px-1.5 py-0.5 focus:border-teal-500 outline-none"
                                              />
                                            </td>
                                            <td className="px-2 py-1 border-r border-gray-100 text-center">
                                              <input 
                                                  type="date" 
                                                  value={newBatchRow["Start Date"] || ""} 
                                                  onChange={e => {
                                                    const updated = [...newBatchesData];
                                                    updated[rowIndex] = { ...newBatchRow, "Start Date": e.target.value };
                                                    setNewBatchesData(updated);
                                                    if (e.target.value && newBatchRow["End Date"]) {
                                                      const stillIncomplete = updated.some(b => !b["Start Date"] || !b["End Date"]);
                                                      if (!stillIncomplete) {
                                                        setBatchWarning(null);
                                                      }
                                                    }
                                                  }}
                                                  className={`w-full min-w-[100px] text-[11px] bg-white border rounded px-1.5 py-0.5 outline-none transition-all ${
                                                    !newBatchRow["Start Date"] && batchWarning 
                                                      ? "border-red-400 bg-red-50/20 focus:border-red-500 focus:ring-1 focus:ring-red-200" 
                                                      : "border-slate-200 focus:border-teal-500"
                                                  }`}
                                              />
                                            </td>
                                            <td className="px-2 py-1 border-r border-gray-100 text-center">
                                              <input 
                                                  type="date" 
                                                  value={newBatchRow["End Date"] || ""} 
                                                  onChange={e => {
                                                    const updated = [...newBatchesData];
                                                    updated[rowIndex] = { ...newBatchRow, "End Date": e.target.value };
                                                    setNewBatchesData(updated);
                                                    if (newBatchRow["Start Date"] && e.target.value) {
                                                      const stillIncomplete = updated.some(b => !b["Start Date"] || !b["End Date"]);
                                                      if (!stillIncomplete) {
                                                        setBatchWarning(null);
                                                      }
                                                    }
                                                  }}
                                                  className={`w-full min-w-[100px] text-[11px] bg-white border rounded px-1.5 py-0.5 outline-none transition-all ${
                                                    !newBatchRow["End Date"] && batchWarning 
                                                      ? "border-red-400 bg-red-50/20 focus:border-red-500 focus:ring-1 focus:ring-red-200" 
                                                      : "border-slate-200 focus:border-teal-500"
                                                  }`}
                                              />
                                            </td>
                                          <td className="px-2 py-1 border-r border-gray-100 text-center">
                                            <input 
                                                type="number" 
                                                placeholder="Students" 
                                                value={newBatchRow["Student"] || ""} 
                                                onChange={e => {
                                                  const updated = [...newBatchesData];
                                                  updated[rowIndex] = { ...newBatchRow, "Student": e.target.value };
                                                  setNewBatchesData(updated);
                                                }}
                                                className="w-full min-w-[60px] text-[11px] bg-white border border-slate-200 rounded px-1.5 py-0.5 focus:border-teal-500 outline-none"
                                            />
                                           </td>
                                           <td className="px-2 py-1 border-r border-gray-100 text-left">
                                             <div className="flex items-center gap-1.5">
                                               <div className="flex-1 min-w-0">
                                                 <EmployeeMultiSelect
                                                   selectedIds={newBatchRow["Instractor"] ? resolveNamesOrIdsToIds(String(newBatchRow["Instractor"]), employees || []).map(String) : []}
                                                   onChange={(ids) => {
                                                     const updated = [...newBatchesData];
                                                     updated[rowIndex] = { ...newBatchRow, "Instractor": ids.join(',') };
                                                     setNewBatchesData(updated);
                                                   }}
                                                   employees={employees || []}
                                                   placement="bottom"
                                                 />
                                               </div>
                                               {newBatchesData.length > 1 && (
                                                 <button
                                                   type="button"
                                                   onClick={() => {
                                                     const updated = newBatchesData.filter((_, idx) => idx !== rowIndex);
                                                     setNewBatchesData(updated);
                                                   }}
                                                   className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-all shrink-0 cursor-pointer"
                                                   title="Remove Row"
                                                 >
                                                   <Trash2 className="w-3.5 h-3.5" />
                                                 </button>
                                               )}
                                             </div>
                                          </td>
                                        </tr>
                                      ))}


                                      {paginatedBatches.map((batch, localIndex) => {
                                        const index = (currentBatchPage - 1) * ITEMS_PER_PAGE + localIndex;
                                        const batchKey = batch["Batch Number"] || `batch-${index}`;
                                        const localBatch = editedBatches[batchKey] || batch;
                                        const isBatchDirty = JSON.stringify(localBatch) !== JSON.stringify(batch);
                                        
                                        // Resolve potential multiple instructors
                                        const instructorVal = localBatch["Instractor"] || localBatch["Instructor"];
                                        const instructorIds = instructorVal ? resolveNamesOrIdsToIds(String(instructorVal), employees || []) : [];
                                        const instructorEmployees = instructorIds.map(id => {
                                           const baseId = String(id).split('|')[0].trim();
                                           return (employees || []).find(e => 
                                             String(e['Employee ID'] || '').trim() === baseId || 
                                             String(e['Employee Name'] || '').trim().toLowerCase() === baseId.toLowerCase()
                                           );
                                         }).filter(Boolean);
                                        
                                        const getInstructorList = () => {
                                          if (instructorEmployees.length > 0) return instructorEmployees;
                                          if (!instructorVal || String(instructorVal).trim() === "") return [];
                                          return String(instructorVal).split(',').map(name => ({
                                            'Employee Name': name.trim(),
                                            Designation: "External Expert"
                                          }));
                                        };
                                        
                                        const instructorsToRender = getInstructorList();

                                        const activeBorderColor = isEditing ? "border-amber-400" : "border-teal-500";
                                        const activeBgColor = isEditing ? "bg-amber-50/40" : "bg-teal-50/20";

                                        return (
                                          <React.Fragment key={index}>
                                            <tr 
                                              onClick={() => handleSelectBatchWithAutoSave(index, batchKey)}
                                              className={cn("group transition-all duration-150 text-xs hover:bg-gray-50/80 cursor-pointer", selectedBatchIndex === index ? "bg-teal-50/50" : "")}
                                            >
                                              <td className={cn("px-2 py-1 text-gray-700 whitespace-nowrap overflow-hidden text-ellipsis border-r border-gray-100 transition-all duration-150 text-left", selectedBatchIndex === index ? "border-l-2 border-teal-500" : "")}>
                                                <div className="flex items-center gap-1.5">
                                                  <span className="font-medium text-gray-900">{localBatch["Batch Number"] || "N/A"}</span>
                                                  {isBatchDirty && (
                                                    <span className="text-[8px] font-bold text-amber-500 bg-amber-50 px-1 rounded border border-amber-200 uppercase tracking-tighter">Edited</span>
                                                  )}
                                                  {isBatchRunning(localBatch) && (
                                                    <span className="relative flex h-1.5 w-1.5 shrink-0" title="Active Running Batch">
                                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                                                    </span>
                                                  )}
                                                </div>
                                              </td>
                                              <td className="px-2 py-1 font-mono text-[11px] text-gray-600 border-r border-gray-100 transition-all duration-150 text-center">
                                                {inlineEditingBatchKey === batchKey ? (
                                                  <input
                                                    type="date"
                                                    value={localBatch["Start Date"] ? toInputDateValue(localBatch["Start Date"]) : ''}
                                                    onChange={(e) => {
                                                      setEditedBatches(prev => ({
                                                        ...prev,
                                                        [batchKey]: { ...localBatch, "Start Date": e.target.value }
                                                      }));
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="w-full min-w-[100px] text-[11px] bg-white border border-slate-200 rounded px-1.5 py-0.5 focus:border-teal-500 outline-none"
                                                  />
                                                ) : (
                                                  localBatch["Start Date"] ? formatToMmmDdYyyy(localBatch["Start Date"]) : "—"
                                                )}
                                              </td>
                                              <td className="px-2 py-1 font-mono text-[11px] text-gray-600 border-r border-gray-100 transition-all duration-150 text-center">
                                                {inlineEditingBatchKey === batchKey ? (
                                                  <input
                                                    type="date"
                                                    value={localBatch["End Date"] ? toInputDateValue(localBatch["End Date"]) : ''}
                                                    onChange={(e) => {
                                                      setEditedBatches(prev => ({
                                                        ...prev,
                                                        [batchKey]: { ...localBatch, "End Date": e.target.value }
                                                      }));
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="w-full min-w-[100px] text-[11px] bg-white border border-slate-200 rounded px-1.5 py-0.5 focus:border-teal-500 outline-none"
                                                  />
                                                ) : (
                                                  localBatch["End Date"] ? formatToMmmDdYyyy(localBatch["End Date"]) : "—"
                                                )}
                                              </td>
                                              <td className="px-2 py-1 text-[11px] font-medium text-teal-600 transition-all duration-150 text-center border-r border-gray-100">
                                                {inlineEditingBatchKey === batchKey ? (
                                                  <input
                                                    type="number"
                                                    value={localBatch["Student"] || ''}
                                                    onChange={(e) => {
                                                      setEditedBatches(prev => ({
                                                        ...prev,
                                                        [batchKey]: { ...localBatch, "Student": e.target.value }
                                                      }));
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="w-full min-w-[60px] text-[11px] bg-white border border-slate-200 rounded px-1.5 py-0.5 focus:border-teal-500 outline-none"
                                                  />
                                                ) : (
                                                  localBatch["Student"] ? `${localBatch["Student"]}` : "—"
                                                )}
                                              </td>
                                              <td className="px-2 py-1 transition-all duration-150 text-center border-r border-gray-100">
                                                {inlineEditingBatchKey === batchKey ? (
                                                  <div onClick={(e) => e.stopPropagation()} className="text-left">
                                                    <EmployeeMultiSelect
                                                      selectedIds={instructorIds.map(String)}
                                                      onChange={(ids) => {
                                                        setEditedBatches(prev => ({
                                                          ...prev,
                                                          [batchKey]: { ...localBatch, "Instractor": ids.join(',') }
                                                        }));
                                                      }}
                                                      employees={employees || []}
                                                      placement="bottom"
                                                    />
                                                  </div>
                                                ) : (
                                                  <div className="flex flex-wrap gap-1.5 items-center justify-center py-1">
                                                    {instructorsToRender.map((emp: any, i: number) => (
                                                      <img 
                                                        key={i} 
                                                        src={getPhotoUrl(emp)} 
                                                        alt={emp['Employee Name']}
                                                        title={`${emp['Employee Name']} - ${emp['Designation'] || ''}`}
                                                        className="h-6 w-6 rounded-full object-cover bg-gray-50 shrink-0 border border-slate-200 shadow-xs hover:scale-110 transition-transform"
                                                        onError={(e) => {
                                                          const target = e.target as HTMLImageElement;
                                                          target.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(emp['Employee Name'] || 'User');
                                                        }}
                                                      />
                                                    ))}
                                                    {instructorsToRender.length === 0 && <span className="text-[10px] text-gray-400 italic">None</span>}
                                                  </div>
                                                )}
                                              </td>
                                              
                                            </tr>
                                          </React.Fragment>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                                <div className="hidden md:flex w-full md:w-[40%] bg-slate-50 relative border-l border-slate-200 flex-col">
                                  <BatchDetailsView 
                                    batch={courseBatches[selectedBatchIndex ?? 0]} 
                                    employees={employees} 
                                    isEditing={isEditing}
                                    onSaveBatch={async (batchData) => {
                                      if (isEditing) {
                                        const batchKey = batchData["Batch Number"] || batchData["id"] || batchData["ID"];
                                        setEditedBatches(prev => ({ ...prev, [batchKey]: batchData }));
                                      } else if (extraFormProps?.onSaveBatch) {
                                        await extraFormProps.onSaveBatch(batchData, batchData);
                                      }
                                    }}
                                    workflowData={workflowData}
                                    documents={[...documents, ...localNewDocs]}
                                    onSaveDocument={async (docData, originalRow) => {
                                      if (isEditing) {
                                        const docKey = docData["Documents Title"] || docData["id"] || docData["ID"];
                                        setEditedDocs(prev => ({ ...prev, [docKey]: docData }));
                                        setLocalNewDocs(prev => [...prev, docData]);
                                      } else if (extraFormProps?.onSaveDocument) {
                                        await extraFormProps.onSaveDocument(docData, originalRow);
                                      }
                                    }}
                                  />
                                </div>
                              </div>
                              {totalBatchPages > 1 && (
                                <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100 bg-gray-50/80 shrink-0">
                                  <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">
                                    Showing {(currentBatchPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentBatchPage * ITEMS_PER_PAGE, totalBatches)} of {totalBatches}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => setBatchPage(p => Math.max(1, p - 1))}
                                      disabled={currentBatchPage === 1}
                                      className="px-2.5 py-1 text-[11px] font-medium text-gray-600 bg-white border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                      Prev
                                    </button>
                                    <span className="px-2 text-[11px] font-bold text-gray-700">
                                      {currentBatchPage} / {totalBatchPages}
                                    </span>
                                    <button
                                      onClick={() => setBatchPage(p => Math.min(totalBatchPages, p + 1))}
                                      disabled={currentBatchPage === totalBatchPages}
                                      className="px-2.5 py-1 text-[11px] font-medium text-gray-600 bg-white border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                      Next
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                            );
                         })()}
                    </div>
                  </div>
                </div>
              </div>
            </div>

          {/* Right Sidebar: Workflow Stages */}
          <div className="w-full lg:w-[380px] xl:w-[440px] shrink-0 bg-white border-l border-slate-100 flex flex-col h-full overflow-hidden">
            <div className="bg-white border-b border-slate-100 shrink-0 p-2">
              <div className="flex h-9 p-1 gap-1 bg-slate-50 rounded-lg border border-slate-100">
                <button 
                  onClick={() => {
                    setActiveSidebarTab('workflow');
                    setDocumentFilter(null);
                  }}
                  className={cn(
                    "flex-1 text-[11px] font-bold uppercase tracking-[0.15em] transition-all relative rounded-md",
                    activeSidebarTab === 'workflow' ? "text-white" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  <span className="relative z-10">Workflow</span>
                  {activeSidebarTab === 'workflow' && (
                    <motion.div 
                      layoutId="activeSidebarTab"
                      className="absolute inset-0 bg-teal-600 rounded-md shadow-sm"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                </button>
                <button 
                  onClick={() => setActiveSidebarTab('documents')}
                  className={cn(
                    "flex-1 text-[11px] font-bold uppercase tracking-[0.15em] transition-all relative rounded-md",
                    activeSidebarTab === 'documents' ? "text-white" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  <span className="relative z-10">Documents</span>
                  {activeSidebarTab === 'documents' && (
                    <motion.div 
                      layoutId="activeSidebarTab"
                      className="absolute inset-0 bg-teal-600 rounded-md shadow-sm"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                </button>
                <button 
                  onClick={() => setActiveSidebarTab('financial_overview')}
                  className={cn(
                    "flex-1 text-[11px] font-bold uppercase tracking-[0.15em] transition-all relative rounded-md",
                    activeSidebarTab === 'financial_overview' ? "text-white" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  <span className="relative z-10">Financial</span>
                  {activeSidebarTab === 'financial_overview' && (
                    <motion.div 
                      layoutId="activeSidebarTab"
                      className="absolute inset-0 bg-teal-600 rounded-md shadow-sm"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar">
              <AnimatePresence mode="wait">
                {activeSidebarTab === 'workflow' ? (
                  <motion.div 
                    key="workflow"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.2 }}
                    className="p-4 space-y-4"
                  >
                    {!isEditing && jobTitle && (
                      <div className="bg-white p-3 rounded-md border border-slate-200 shadow-3xs flex flex-col gap-1">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Job Title / Workflow</span>
                        <span className="text-xs font-semibold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                          <Briefcase className="w-3.5 h-3.5 text-teal-600" />
                          {parsedWorkflows.find(w => w.id === jobTitle)?.title || jobTitle}
                        </span>
                      </div>
                    )}

                    {isEditing && (
                      <div className="space-y-1 bg-white p-3 rounded-md border border-slate-200">
                        <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Change Workflow</label>
                        <select
                          className="w-full text-[11px] font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded px-2 py-1.5 focus:border-teal-500 outline-none uppercase tracking-wide cursor-pointer"
                          value={jobTitle || ''}
                          onChange={(e) => {
                            const newJobTitle = e.target.value;
                            // Clear assignments on job title change
                            const serialized = serializeWorkflowAndStages(newJobTitle, {});
                            setEditedData((prev: any) => ({
                              ...prev,
                              'Workflow': serialized,
                              'Publication Workflow': serialized
                            }));
                          }}
                        >
                          <option value="">-- SELECT JOB TITLE --</option>
                          {parsedWorkflows.map((w, idx) => (
                            <option key={idx} value={w.id}>{w.title}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    
                    {isEditing && (
                      <div className="flex items-center justify-between px-1">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Workflow Config</span>
                      </div>
                    )}
                    
                    {(() => {
                      const courseWorkflow = editedData?.['Workflow'] || editedData?.['Publication Workflow'] || data?.['Workflow'] || data?.['Publication Workflow'] || "";
                      const { jobTitle, stageAssignments } = parseWorkflowAndStages(courseWorkflow);

                      if (!jobTitle) {
                        return (
                          <div className="flex flex-col items-center justify-center h-full text-center py-12 px-4">
                            <Briefcase className="w-7 h-7 text-slate-300 mb-2" />
                            <span className="text-[13px] font-medium text-slate-400 uppercase tracking-wider">No Workflow Assigned</span>
                            <p className="text-[13px] text-slate-400 mt-1 leading-relaxed">Please edit this course to assign a Publication Workflow / Job Title.</p>
                          </div>
                        );
                      }

                      if (localStages.length === 0) {
                        return (
                          <div className="flex flex-col items-center justify-center h-full text-center py-12 px-4">
                            <Briefcase className="w-7 h-7 text-slate-300 mb-2" />
                            <span className="text-[13px] font-medium text-slate-400 uppercase tracking-wider">No Stages Found</span>
                            <p className="text-[13px] text-slate-400 mt-1 leading-relaxed">No stages defined for "{jobTitle}" in Job Description list.</p>
                          </div>
                        );
                      }

                      return (
                        <WorkflowTimeline
                          stages={localStages}
                          stageAssignments={stageAssignments}
                          isEditing={isEditing}
                          employees={employees || []}
                          onStageAssignmentChange={(stageId, ids) => {
                            const updatedAssignments = {
                              ...stageAssignments,
                              [stageId]: ids
                            };
                            const serialized = serializeWorkflowAndStages(jobTitle, updatedAssignments);
                            setEditedData((prev: any) => ({
                              ...prev,
                              'Workflow': serialized,
                              'Publication Workflow': serialized
                            }));
                          }}
                          placement="bottom"
                          jobTitle={jobTitle}
                          batch={courseBatches[selectedBatchIndex ?? 0]}
                          courseCode={data?.['Course Code']}
                          documents={[...documents, ...localNewDocs]}
                          onSaveDocument={async (docData, originalRow) => {
                            if (isEditing) {
                              const docKey = docData["Documents Title"] || docData["id"] || docData["ID"];
                              setEditedDocs(prev => ({ ...prev, [docKey]: docData }));
                              setLocalNewDocs(prev => [...prev, docData]);
                            } else if (extraFormProps?.onSaveDocument) {
                              await extraFormProps.onSaveDocument(docData, originalRow);
                            }
                          }}
                          onViewDocuments={(filter) => {
                            setActiveSidebarTab('documents');
                            setDocumentFilter(filter);
                          }}
                          viewType="course"
                        />
                      );
                    })()}
                  </motion.div>
                ) : activeSidebarTab === 'documents' ? (
                  <motion.div 
                    key="documents"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2 }}
                    className="p-4 space-y-4"
                  >
                    <div className="flex items-center justify-between bg-teal-50/80 px-3 py-1.5 rounded-lg border-b border-teal-100 mb-2">
                      <div className="flex items-center gap-2">
                        <h4 className="text-[11px] font-bold text-teal-800 uppercase tracking-[0.2em]">Document List</h4>
                        {documentFilter && (
                           <button
                             onClick={() => setDocumentFilter(null)}
                             className="text-[9px] font-bold text-teal-600 hover:text-teal-800 hover:underline cursor-pointer bg-teal-100 px-1.5 py-0.5 rounded"
                           >
                             Clear Filter
                           </button>
                        )}
                      </div>
                      {isEditing && (
                        <button onClick={() => setIsAddDocumentOpen(true)} className="flex items-center gap-1 text-[11px] font-bold uppercase text-teal-600 hover:text-teal-700 tracking-wider transition-colors">
                          <Plus className="w-3.5 h-3.5" /> Add New
                        </button>
                      )}
                    </div>
                    
                    <AnimatePresence>
                      {isAddDocumentOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="mb-4"
                        >
                          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3 shadow-sm">
                            <div className="flex justify-between items-center">
                              <h5 className="text-[11px] font-medium text-slate-500 uppercase tracking-widest">New Document</h5>
                              <button onClick={() => setIsAddDocumentOpen(false)}><X className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" /></button>
                            </div>
                            <div className="space-y-2">
                               <div className="space-y-1">
                                 <input
                                    type="text" 
                                    placeholder="Document Title" 
                                    value={newDocumentData["Documents Title"]} 
                                    onChange={e => {
                                      setNewDocumentData({...newDocumentData, "Documents Title": e.target.value});
                                      if (docErrors.title) setDocErrors(prev => ({ ...prev, title: "" }));
                                    }}
                                    className={`w-full text-[13px] font-medium p-2 bg-white border ${docErrors.title ? 'border-red-400' : 'border-slate-200'} rounded-lg outline-none focus:border-teal-500`}
                                />
                                {docErrors.title && <span className="text-[10px] text-red-500 font-medium pl-1">{docErrors.title}</span>}
                               </div>

                               <div className="space-y-1">
                                 <input 
                                     type="date" 
                                     value={newDocumentData["Date"]} 
                                     onChange={e => {
                                       setNewDocumentData({...newDocumentData, "Date": e.target.value});
                                       if (docErrors.date) setDocErrors(prev => ({ ...prev, date: "" }));
                                     }}
                                     className={`w-full text-[13px] font-medium p-2 bg-white border ${docErrors.date ? 'border-red-400' : 'border-slate-200'} rounded-lg outline-none focus:border-teal-500`}
                                     required
                                 />
                                 {docErrors.date && <span className="text-[10px] text-red-500 font-medium pl-1">{docErrors.date}</span>}
                               </div>

                               <div className="space-y-1">
                                 <div className="relative">
                                   <label className="absolute left-1 top-1 bottom-1 w-9 flex items-center justify-center bg-slate-50 hover:bg-slate-100 text-slate-500 rounded border border-slate-200 cursor-pointer transition-colors z-10">
                                     {isUploadingNewDoc ? <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600" /> : <Upload className="w-3.5 h-3.5" />}
                                     <input
                                       type="file"
                                       className="hidden"
                                       required
                                       onChange={async (e) => {
                                         const file = e.target.files?.[0];
                                         if (!file) return;
                                         setIsUploadingNewDoc(true);
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
                                             setNewDocumentData(prev => ({ ...prev, "File Link": viewUrl }));
                                             if (docErrors.link) setDocErrors(prev => ({ ...prev, link: "" }));
                                           }
                                         } catch (err) {
                                           alert("Upload failed.");
                                         } finally {
                                           setIsUploadingNewDoc(false);
                                         }
                                       }}
                                     />
                                   </label>
                                   <input 
                                       type="text" 
                                       placeholder="File Link (Required)" 
                                       value={newDocumentData["File Link"]} 
                                       onChange={e => {
                                         setNewDocumentData({...newDocumentData, "File Link": e.target.value});
                                         if (docErrors.link) setDocErrors(prev => ({ ...prev, link: "" }));
                                       }}
                                       className={`w-full text-[13px] font-medium py-2 pl-12 pr-2 bg-white border ${docErrors.link ? 'border-red-400' : 'border-slate-200'} rounded-lg outline-none focus:border-teal-500`}
                                       required
                                   />
                                 </div>
                                 {docErrors.link && <span className="text-[10px] text-red-500 font-medium pl-1">{docErrors.link}</span>}
                               </div>
                            </div>
                              <button 
                                  onClick={handleAddDocument}
                                  disabled={isSubmitting || isUploadingNewDoc}
                                  className="w-full py-2 bg-teal-600 text-white rounded-lg text-[11px] font-medium uppercase tracking-[0.1em] shadow-sm hover:bg-teal-700 transition-colors disabled:opacity-50 mt-2"
                              >
                                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" /> : 'Save Document'}
                              </button>
                            </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="space-y-3">
                        {(() => {
                          const courseDocs = [
                            ...(documents || []).filter(d => {
                              const cCode = String(data?.['Course Code'] || "").trim().toUpperCase();
                              const cTitle = String(data?.['Course Title'] || "").trim().toUpperCase();

                              const dCourseCode = String(d['Course Code'] || "").trim().toUpperCase();
                              const dCourseName = String(d['Course Name'] || "").trim().toUpperCase();
                              const tagStr = String(d['Tag'] || "").toUpperCase();
                              const titleStr = String(d['Documents Title'] || d['Document Name'] || d['Title'] || "").toUpperCase();

                              const matchCourseCode = Boolean(cCode && (dCourseCode === cCode || tagStr.includes(cCode) || titleStr.includes(cCode)));
                              const matchCourseName = Boolean(cTitle && (dCourseName === cTitle || tagStr.includes(cTitle) || titleStr.includes(cTitle)));

                              let isRelevant = matchCourseCode || matchCourseName;
                              if (!cCode && !cTitle) isRelevant = true;
                              
                              if (documentFilter) {
                                const normFilter = String(documentFilter).trim().toUpperCase();
                                const cleanFilter = normFilter
                                  .replace(/^[^-]+-[^-]+-/, '')
                                  .replace(/^[^-]+-/, '')
                                  .replace(/-$/, '')
                                  .replace(/^\d+\.\s*/, '');

                                const tagStr = String(d['Tag'] || "").toUpperCase();
                                const titleStr = String(d['Documents Title'] || d['Document Name'] || d['Title'] || "").toUpperCase();

                                const matchFilterInTag = tagStr.includes(normFilter) || tagStr.startsWith(normFilter) || (cleanFilter.length > 0 && tagStr.includes(cleanFilter));
                                const matchFilterInTitle = titleStr.includes(normFilter) || (cleanFilter.length > 0 && titleStr.includes(cleanFilter));

                                const matchingStage = localStages.find(s => {
                                  const sName = String(s["Workflow Stage"] || "").toUpperCase();
                                  const sClean = sName.replace(/^\d+\.\s*/, '');
                                  return (cleanFilter.length > 0 && (sName.includes(cleanFilter) || sClean.includes(cleanFilter) || normFilter.includes(sClean)));
                                });

                                let matchDeliverable = false;
                                if (matchingStage) {
                                  const delivsStr = String(matchingStage["Deliverables"] || "");
                                  const delivs = delivsStr.split(/[\n|;,]+/).map(x => x.trim().toUpperCase()).filter(Boolean);
                                  matchDeliverable = delivs.some(deliv => titleStr === deliv || titleStr.includes(deliv) || tagStr.includes(deliv));
                                }

                                isRelevant = isRelevant && (matchFilterInTag || matchFilterInTitle || matchDeliverable);
                              }
                              
                              return isRelevant;
                            }),
                            ...localNewDocs
                          ].map(d => {
                            const key = d["Documents Title"] || d["id"] || d["ID"];
                            return editedDocs[key] || d;
                          });

                          if (courseDocs.length === 0) {
                            return (
                              <div className="py-12 px-4 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50">
                                <BookOpen className="w-7 h-7 text-slate-300 mx-auto mb-2" />
                                <span className="text-slate-400 text-[11px] font-medium uppercase tracking-[0.15em] block mb-1">No Documents</span>
                                <p className="text-slate-400/70 text-[11px] italic leading-relaxed px-4">No documents have been uploaded or tagged for this course yet.</p>
                              </div>
                            );
                          }

                          return (
                            <div className="space-y-2.5">
                              {courseDocs.map((doc: any, index: number) => {
                                const docKey = doc["Documents Title"] || doc["Document Name"] || doc["Title"] || `doc-${index}`;
                                const localDoc = editedDocs[docKey] || doc;
                                const isDocDirty = JSON.stringify(localDoc) !== JSON.stringify(doc);
                                const isDocActive = isEditing && (activeDocKey === docKey);

                                return (
                                  <div 
                                    key={index}
                                    onClick={() => isEditing && setActiveDocKey(activeDocKey === docKey ? null : docKey)}
                                    className={cn(
                                      "p-3 rounded-xl border transition-all duration-200",
                                      isDocActive 
                                        ? "bg-teal-50/30 border-teal-200 shadow-sm" 
                                        : "bg-white border-slate-100 hover:border-slate-200 hover:shadow-xs cursor-pointer"
                                    )}
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                          <Calendar className="w-3 h-3 text-slate-400" />
                                          <span className="text-[10px] font-mono font-medium text-slate-500 uppercase tracking-tighter">
                                            {localDoc["Date"] ? formatToMmmDdYyyy(localDoc["Date"]) : "—"}
                                          </span>
                                        </div>
                                        <a 
                                          href={localDoc["File Link"] || localDoc["Link"]} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          onClick={(e) => e.stopPropagation()}
                                          className="text-[12.5px] font-medium text-slate-800 hover:text-teal-600 uppercase tracking-tight leading-tight block truncate transition-colors"
                                        >
                                          {localDoc["Documents Title"] || localDoc["Document Name"] || localDoc["Title"]}
                                        </a>
                                      </div>
                                      <div className="shrink-0 pt-1">
                                        <div className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-teal-500 transition-colors">
                                          <Eye className="w-3.5 h-3.5" />
                                        </div>
                                      </div>
                                    </div>

                                    {isDocActive && (
                                      <div className="mt-3 pt-3 border-t border-teal-100/50 space-y-3" onClick={(e) => e.stopPropagation()}>
                                        <div className="space-y-1">
                                          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Document Title</span>
                                          <input
                                            type="text"
                                            value={localDoc["Documents Title"] || localDoc["Document Name"] || localDoc["Title"] || ''}
                                            onChange={(e) => setEditedDocs(prev => ({ ...prev, [docKey]: { ...localDoc, "Documents Title": e.target.value } }))}
                                            className="w-full text-[12px] font-medium text-slate-800 bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:border-teal-500 outline-none uppercase"
                                          />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                          <div className="space-y-1">
                                            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Date</span>
                                            <input
                                              type="date"
                                              value={localDoc["Date"] ? toInputDateValue(localDoc["Date"]) : ''}
                                              onChange={(e) => setEditedDocs(prev => ({ ...prev, [docKey]: { ...localDoc, "Date": e.target.value } }))}
                                              className="w-full text-[12px] font-medium text-slate-500 bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:border-teal-500 outline-none"
                                            />
                                          </div>
                                          <div className="space-y-1">
                                            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Action</span>
                                            <label className="w-full flex items-center justify-center gap-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg cursor-pointer transition-colors border border-slate-200 text-[11px] font-medium uppercase tracking-wider">
                                              <Upload className="w-3 h-3" />
                                              Update
                                              <input
                                                type="file"
                                                className="hidden"
                                                onChange={async (e) => {
                                                  const file = e.target.files?.[0];
                                                  if (!file) return;
                                                  setDocUploadingKey(docKey);
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
                                                      setEditedDocs(prev => ({ ...prev, [docKey]: { ...localDoc, "File Link": viewUrl } }));
                                                    }
                                                  } catch (err) {
                                                    alert("Upload failed.");
                                                  } finally {
                                                    setDocUploadingKey(null);
                                                  }
                                                }}
                                              />
                                            </label>
                                          </div>
                                        </div>

                                        {docUploadingKey === docKey && (
                                          <div className="text-[10px] font-medium text-amber-600 animate-pulse flex items-center gap-1.5 justify-center py-1">
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                            UPLOADING TO DRIVE...
                                          </div>
                                        )}

                                        {isDocDirty && (
                                          <button
                                            onClick={async () => {
                                              if (extraFormProps?.onSaveDocument) {
                                                setDocSavingKey(docKey);
                                                try {
                                                  await extraFormProps.onSaveDocument(localDoc, doc);
                                                  setEditedDocs(prev => {
                                                    const copy = { ...prev };
                                                    delete copy[docKey];
                                                    return copy;
                                                  });
                                                } catch (err) {
                                                  alert("Failed to save document.");
                                                } finally {
                                                  setDocSavingKey(null);
                                                }
                                              }
                                            }}
                                            disabled={docSavingKey === docKey || docUploadingKey === docKey}
                                            className="w-full flex items-center justify-center gap-2 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-[11px] font-medium uppercase tracking-[0.1em] transition-all shadow-sm disabled:opacity-50"
                                          >
                                            {docSavingKey === docKey ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                            Save Changes
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                    </div>
                  </motion.div>
                ) : activeSidebarTab === 'financial_overview' ? (
                  <motion.div 
                    key="financial_overview"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2 }}
                    className="p-4 space-y-4"
                  >
                    <div className="space-y-3">
                      <h4 className="text-[11px] font-bold text-teal-800 bg-teal-50/80 px-3 py-1.5 rounded-lg uppercase tracking-[0.2em] border-b border-teal-100 mb-3">Financial Overview</h4>
                      <div className="space-y-2 pl-2">
                        {[
                          { label: 'Course Fee', key: 'Course Fee', icon: Tag, type: 'input' },
                          { label: 'Total Enrolled', key: 'Enrolled', icon: Users, type: 'input', operator: '×' },
                          { label: 'Gross Revenue', key: 'Gross Revenue', icon: TrendingUp, type: 'result', operator: '=' },
                          { label: 'Discount Allowed', key: 'Discount', icon: Percent, type: 'minus', operator: '−' },
                          { label: 'Net Revenue', key: 'Net Revenue', icon: Banknote, type: 'result', operator: '=' },
                          { label: 'Total Expenses', key: 'Expenses', icon: CreditCard, type: 'minus', operator: '−' },
                          { label: 'Est. Net Profit', key: 'Net Profit', icon: Wallet, type: 'final', operator: '=' },
                          { label: 'Profit Margin', key: 'Profit %', icon: PieChart, type: 'stat' }
                        ].map((item) => {
                          const computedValue = courseInfo.find(c => c.key === item.key)?.value;
                          const isDynamic = ['Gross Revenue', 'Net Revenue', 'Net Profit', 'Profit %'].includes(item.key);
                          const Icon = item.icon;
                          
                          const getColors = () => {
                            if (item.type === 'minus') return 'text-rose-600 bg-rose-50/50 rounded px-1 -mx-1';
                            if (item.type === 'result') return 'text-teal-700 font-bold';
                            if (item.type === 'final') return 'text-emerald-700 font-bold bg-emerald-50 rounded px-1 -mx-1';
                            if (item.type === 'stat') return 'text-indigo-600 font-bold';
                            return 'text-slate-700';
                          };

                          const textClass = getColors();
                          
                          return (
                            <div key={item.key} className="flex items-center py-0.5 group">
                              <div className="flex items-center gap-2 w-[120px] shrink-0">
                                <Icon className={cn("w-3.5 h-3.5 shrink-0", 
                                  item.type === 'minus' ? 'text-rose-400' : 
                                  item.type === 'result' ? 'text-teal-500' : 
                                  item.type === 'final' ? 'text-emerald-500' : 'text-slate-400'
                                )} />
                                <span className={cn("text-[11.5px] font-medium leading-tight pt-0.5", 
                                  item.type === 'minus' ? 'text-rose-500' : 'text-slate-500'
                                )}>
                                  {item.label}
                                </span>
                              </div>
                              <span className="text-[13px] font-medium text-slate-400 mx-1 pt-0.5">:</span>
                              
                              <div className="flex-1 flex items-center justify-end gap-1.5 min-w-0">
                                {item.operator && (
                                  <span className={cn(
                                    "text-[10px] font-black shrink-0",
                                    item.type === 'minus' ? "text-rose-400" : "text-slate-300"
                                  )}>
                                    {item.operator}
                                  </span>
                                )}

                                <div className="min-w-0">
                                  {isEditing && !isDynamic ? (
                                    <input
                                      type="text"
                                      value={editedData?.[item.key] || (item.key === 'Enrolled' ? editedData?.['Enrollments'] || '' : '')}
                                      onChange={(e) => handleInputChange(item.key === 'Enrolled' ? (editedData?.['Enrolled'] !== undefined ? 'Enrolled' : 'Enrollments') : item.key, e.target.value)}
                                      className="w-full text-[12px] font-bold text-slate-700 bg-slate-50 border-b border-slate-200 py-0.5 focus:border-teal-500 outline-none transition-all text-right"
                                    />
                                  ) : (
                                    <span className={cn("text-[12px] font-medium leading-tight pt-0.5 break-words block text-right", textClass)}>
                                      {isDynamic ? (
                                        ['Gross Revenue', 'Net Revenue', 'Net Profit'].includes(item.key) ? `৳ ${computedValue || '0'}` : computedValue
                                      ) : (
                                        ['Course Fee', 'Discount', 'Expenses'].includes(item.key) ? `৳ ${editedData?.[item.key] || data?.[item.key] || '0'}` : (item.key === 'Enrolled' ? (editedData?.['Enrolled'] || editedData?.['Enrollments'] || data?.['Enrolled'] || data?.['Enrollments'] || '0') : (editedData?.[item.key] || data?.[item.key] || '0'))
                                      )}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
  

        {/* Add Modals */}
        {extraFormProps && (
          <>
            <MCBatchPanel 
              isOpen={isAddBatchOpen}
              onClose={() => setIsAddBatchOpen(false)}
              onSave={async (formData) => {
                 if (isEditing) {
                   setLocalNewBatches(prev => [...prev, formData]);
                   setIsAddBatchOpen(false);
                 } else if (extraFormProps.onSaveBatch) {
                   await extraFormProps.onSaveBatch(formData, null);
                   setIsAddBatchOpen(false);
                 }
              }}
              onDelete={async () => {}}
              headers={extraFormProps.batchHeaders || []}
              employees={employees}
              initialData={{
                'Course Code': data?.['Course Code'],
                'Course Name': data?.['Course Title']
              }}
            />
            
            <DocumentsPanel 
              isOpen={isAddDocumentOpen}
              onClose={() => setIsAddDocumentOpen(false)}
              onSave={async (formData) => {
                 if (isEditing) {
                   setLocalNewDocs(prev => [...prev, formData]);
                   setIsAddDocumentOpen(false);
                 } else if (extraFormProps.onSaveDocument) {
                   await extraFormProps.onSaveDocument(formData, null);
                   setIsAddDocumentOpen(false);
                 }
              }}
              onDelete={async () => {}}
              headers={extraFormProps.documentHeaders || []}
              initialData={{
                'Course Code': data?.['Course Code'],
                'Course Name': data?.['Course Title'],
                'Tag Name': data?.['Course Code'],
                'Tag': data?.['Course Code']
              }}
            />
          </>
        )}
        </>
      )}
    </AnimatePresence>
  );
}
