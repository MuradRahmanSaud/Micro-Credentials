/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import Table from "./components/Table";
import EmployeePanel from "./components/EmployeePanel";
import MCCoursePanel from "./components/MCCoursePanel";
import MCBatchPanel from "./components/MCBatchPanel";
import MCCourseDetails from "./components/MCCourseDetails";
import EmployeePicker from "./components/EmployeePicker";
import SettingsPanel from "./components/SettingsPanel";
import SettingsTab from "./components/SettingsTab";
import MCDashboard from "./components/MCDashboard";
import DocumentsPanel from "./components/DocumentsPanel";
import WorkflowView from "./components/WorkflowView";
import axios from "axios";
import { motion, AnimatePresence } from "motion/react";
import { UserCheck, Eye, LayoutDashboard, BookOpen, Layers, X, Briefcase, FileText, GitMerge, Activity, Users } from "lucide-react";
import { useGoogleSheet } from "./hooks/useGoogleSheet";
import { getCourseStatusName } from "./lib/utils";
import ActivityPanel from "./components/ActivityPanel";

export default function App() {
  const [activeTab, setActiveTab] = useState("micro-credentials");
  const [mcSubTab, setMcSubTab] = useState("dashboard");
  const [showEmployeePicker, setShowEmployeePicker] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<any>(null);
  const [isCourseDetailsOpen, setIsCourseDetailsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [viewingFile, setViewingFile] = useState<{ url: string; title: string; doc?: any } | null>(null);
  const [docStatus, setDocStatus] = useState<string>("");

  useEffect(() => {
    if (viewingFile?.doc) {
        const tag = String(viewingFile.doc["Tag"] || "");
        if (tag.includes("Revision Required") || tag.includes("Revision")) setDocStatus("Revision");
        else if (tag.includes("Verified") || tag.includes("Job Done") || tag.includes("Approved")) setDocStatus("Verified");
        else setDocStatus("");
    } else {
        setDocStatus("");
    }
  }, [viewingFile]);

  const handleSaveDocStatus = async () => {
    if (!viewingFile || !viewingFile.doc) return;
    
    let tag = String(viewingFile.doc["Tag"] || "");
    // Remove previous status
    tag = tag.replace(/, Revision Required|Revision Required|, Revision|Revision|Verified|, Verified|Job Done|, Job Done|Approved|, Approved/g, "").trim();
    // Add new status
    if (docStatus) {
        tag = tag ? `${tag}, ${docStatus}` : docStatus;
    }
    
    const updatedDoc = { ...viewingFile.doc, Tag: tag };
    
    // Close immediately
    setViewingFile(null);
    
    // Save in background
    handleDocumentSave(updatedDoc, viewingFile.doc).catch(console.error);
  };

  const renderCourseActions = (row: any) => (
    <button 
      onClick={(e) => {
        e.stopPropagation();
        setSelectedCourse(row);
        setIsCourseDetailsOpen(true);
      }}
      className="p-1 hover:bg-teal-100 rounded text-teal-600"
    >
      <Eye className="w-4 h-4" />
    </button>
  );

  // Helper to read initial setting value from localStorage
  const getSavedSetting = (key: string, fallback: string) => {
    try {
      const saved = localStorage.getItem("settings_data");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const found = parsed.find(r => r.Title === key);
          if (found && found.Content) return found.Content;
        }
      }
    } catch (e) {}
    return fallback;
  };

  const [employeeGid, setEmployeeGid] = useState(() => getSavedSetting("Employee GID", "0"));
  const [settingsGid, setSettingsGid] = useState(() => getSavedSetting("Settings GID", getSavedSetting("GID", "1972051572")));
  const [mcBatchGid, setMcBatchGid] = useState(() => getSavedSetting("MC Batch GID", "1111164355"));

  // Workforce Sheet (GID = employeeGid)
  const {
    data,
    setData,
    headers,
    isLoading,
    fetchData,
    saveRow: saveEmployee,
    deleteRow: deleteEmployeeRaw
  } = useGoogleSheet({
    gid: employeeGid,
    localStorageKey: "workforce_data",
    fallbackHeaders: [
      "Employee ID", "Employee Name", "Designation", 
      "Mobile", "IP-Ext", "E-mail", 
      "Status", "Group Name", "Department", "Tag"
    ]
  });

  // Settings Sheet (GID = settingsGid)
  const {
    data: settingsData,
    setData: setSettingsData,
    headers: settingsHeaders,
    isLoading: isSettingsLoading,
    fetchData: fetchSettingsData,
    saveRow: saveSettingRaw,
    deleteRow: deleteSetting
  } = useGoogleSheet({
    gid: settingsGid,
    localStorageKey: "settings_data",
    fallbackHeaders: ["Title", "Content"]
  });

  // Course Sheet
  const {
    data: courseData,
    setData: setCourseData,
    headers: courseHeaders,
    isLoading: isCourseLoading,
    fetchData: fetchCourseData,
    saveRow: saveCourse,
    deleteRow: deleteCourseRaw
  } = useGoogleSheet({
    gid: "1120624852",
    localStorageKey: "course_data",
    fallbackHeaders: [
      "Course Code", "Course Title", "Banner", "Mode", "Duration", "Class",
      "Course Fee", "Student Size", "Status", "Workflow",
      "Industry Expert", "Batches", "Enrolled", "Discount", "Expenses",
      "Remarks"
    ]
  });

  // MC Batch Sheet
  const {
    data: mcBatchData,
    setData: setMcBatchData,
    headers: mcBatchHeaders,
    isLoading: isMcBatchLoading,
    fetchData: fetchMcBatchData,
    saveRow: saveMcBatch,
    deleteRow: deleteMcBatchRaw
  } = useGoogleSheet({
    gid: mcBatchGid,
    localStorageKey: "mc_batch_data",
    fallbackHeaders: [
      "Course Code", "Batch Number", "Start Date", "End Date", "Student", "Instractor"
    ]
  });

  // Documents Sheet
  const {
    data: documentsData,
    headers: documentsHeaders,
    isLoading: isDocumentsLoading,
    fetchData: fetchDocumentsData,
    saveRow: saveDocument,
    deleteRow: deleteDocumentRaw
  } = useGoogleSheet({
    gid: "732376789",
    localStorageKey: "documents_data",
    fallbackHeaders: ["Date", "Documents Title", "File Link", "Tag"]
  });

  // Workflow Sheet
  const {
    data: workflowData,
    headers: workflowHeaders,
    isLoading: isWorkflowLoading,
    fetchData: fetchWorkflowData,
    saveRow: saveWorkflow,
    deleteRow: deleteWorkflow
  } = useGoogleSheet({
    gid: "1686458334",
    localStorageKey: "workflow_data",
    fallbackHeaders: ["Workflow Title"]
  });

  // Keep state GIDs in sync when settingsData updates
  useEffect(() => {
    if (settingsData && Array.isArray(settingsData)) {
      const savedEmployeeGid = settingsData.find(r => r.Title === "Employee GID")?.Content;
      const savedSettingsGid = settingsData.find(r => r.Title === "Settings GID")?.Content || settingsData.find(r => r.Title === "GID")?.Content;
      const savedMCBatchGid = settingsData.find(r => r.Title === "MC Batch GID")?.Content;
      
      if (savedEmployeeGid && savedEmployeeGid !== employeeGid) {
        setEmployeeGid(savedEmployeeGid);
      }
      if (savedSettingsGid && savedSettingsGid !== settingsGid) {
        setSettingsGid(savedSettingsGid);
      }
      if (savedMCBatchGid && savedMCBatchGid !== mcBatchGid) {
        setMcBatchGid(savedMCBatchGid);
      }
    }
  }, [settingsData, employeeGid, settingsGid, mcBatchGid]);

  const courseTableHeaders = useMemo(() => {
    const hiddenHeaders = [
      "Banner", "Received By", "Gross Revenue", "Net Revenue", "Remarks", 
      "Proposed By", "Developed By", "Reviewed By", "Approved By", "Published By",
      "Workflow", "Discount", "Expenses", "Net Profit", "Profit %", "Industry Expert", "Industry Expart"
    ];
    // Explicitly filter out "Status", "Batches", "Gross Revenue", "Net Revenue", "Net Profit", "Profit %" and hidden headers to avoid duplicates
    const baseHeaders = courseHeaders.filter(h => 
      !hiddenHeaders.includes(h) && 
      h !== "Status" && 
      h !== "Batches" && 
      h !== "Gross Revenue" && 
      h !== "Net Revenue" && 
      h !== "Net Profit" && 
      h !== "Profit %"
    );
    
    // Find Mode index and insert "Status" after it
    const modeIdx = baseHeaders.findIndex(h => h.toLowerCase() === "mode");
    const updatedHeaders = [...baseHeaders];
    
    if (modeIdx !== -1) {
      updatedHeaders.splice(modeIdx + 1, 0, "Status");
    } else {
      // Fallback: Add at the end if Mode column is missing
      updatedHeaders.push("Status");
    }

    // Insert Batches before Enrolled or Enrollments
    const enrolledIdx = updatedHeaders.indexOf("Enrolled");
    const enrolledActualIdx = enrolledIdx !== -1 ? enrolledIdx : updatedHeaders.indexOf("Enrollments");
    
    if (enrolledActualIdx !== -1) {
      updatedHeaders.splice(enrolledActualIdx, 0, "Batches");
    } else {
      updatedHeaders.push("Batches");
    }

    return updatedHeaders;
  }, [courseHeaders]);

  const enrichedCourseData = useMemo(() => {
    return courseData.map(course => {
      const fee = parseFloat(String(course["Course Fee"] || "0").replace(/[^0-9.]/g, ""));
      const enrolled = parseInt(String(course["Enrolled"] || course["Enrollments"] || "0").replace(/[^0-9.]/g, ""), 10);
      const discount = parseFloat(String(course["Discount"] || "0").replace(/[^0-9.]/g, ""));
      const expenses = parseFloat(String(course["Expenses"] || "0").replace(/[^0-9.]/g, ""));
      
      const grossRevenue = isNaN(fee) || isNaN(enrolled) ? 0 : fee * enrolled;
      const netRevenue = grossRevenue - (isNaN(discount) ? 0 : discount);
      const netProfit = netRevenue - (isNaN(expenses) ? 0 : expenses);
      const profitMargin = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0;
      
      const courseBatchesCount = mcBatchData.filter(b => b['Course Code'] === course['Course Code'] || b['Course Name'] === course['Course Title']).length;

      return {
        ...course,
        "Status": getCourseStatusName(course, documentsData, workflowData),
        "Batches": courseBatchesCount.toString(),
        "Gross Revenue": `৳ ${grossRevenue.toLocaleString()}`,
        "Net Revenue": `৳ ${netRevenue.toLocaleString()}`,
        "Net Profit": `৳ ${netProfit.toLocaleString()}`,
        "Profit %": `${profitMargin.toFixed(1)}%`
      };
    });
  }, [courseData, mcBatchData, documentsData, workflowData]);

  const getDbOverridesHeaders = () => {
    try {
      const saved = localStorage.getItem("settings_data");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const link = parsed.find((r: any) => r.Title === "Google Sheet Link")?.Content || "";
          const api = parsed.find((r: any) => r.Title === "Apps Script API")?.Content || "";
          
          let spreadsheetId = "";
          if (link) {
            const match = link.match(/\/d\/([a-zA-Z0-9-_]+)/);
            if (match) {
              spreadsheetId = match[1];
            }
          }
          
          const headers: Record<string, string> = {};
          if (spreadsheetId) headers["x-spreadsheet-id"] = spreadsheetId;
          if (api) headers["x-apps-script-url"] = api;
          return headers;
        }
      }
    } catch (e) {}
    return {};
  };

  const availableEmployeesForPicker = useMemo(() => {
    return data;
  }, [data]);

  const handleSaveMultipleSettings = async (updates: { Title: string; Content: string }[]) => {
    const previousSettings = [...settingsData];
    
    // Optimistically update local settings state
    let updatedSettings = [...settingsData];
    for (const update of updates) {
      const idx = updatedSettings.findIndex(r => r.Title === update.Title);
      if (idx !== -1) {
        updatedSettings[idx] = { ...updatedSettings[idx], ...update };
      } else {
        updatedSettings = [update, ...updatedSettings];
      }
    }
    setSettingsData(updatedSettings);
    localStorage.setItem("settings_data", JSON.stringify(updatedSettings));

    try {
      const headers = getDbOverridesHeaders();
      // Post all updates in parallel to Google Sheet
      await Promise.all(updates.map(async (update) => {
        const exists = previousSettings.some(r => r.Title === update.Title);
        await axios.post("/api/proxy", {
          action: exists ? "UPDATE" : "ADD",
          data: update,
          gid: settingsGid,
          ...(exists && { idKey: "Title", idValue: update.Title })
        }, {
          headers
        });
      }));
    } catch (error) {
      // Revert state on failure
      setSettingsData(previousSettings);
      localStorage.setItem("settings_data", JSON.stringify(previousSettings));
      throw error;
    }
  };

  const handleSave = async (formData: any, editingRow: any | null) => {
    const idKey = formData["Employee ID"] ? "Employee ID" : (formData["ID"] ? "ID" : Object.keys(formData)[0]);
    await saveEmployee(formData, editingRow, idKey);
  };

  const handlePickerSave = async (selectedEmployees: any[]) => {
    const idKey = headers.find(h => h.toLowerCase() === "id" || h.toLowerCase() === "employee id") || "Employee ID";
    
    // The picker now returns the COMPLETE list of who SHOULD be MC Representatives
    const selectedIds = new Set(selectedEmployees.map(emp => String(emp[idKey])));
    
    const updatedEmployees: any[] = [];
    const newData = data.map(emp => {
      const id = String(emp[idKey]);
      const shouldHaveTag = selectedIds.has(id);
      
      const currentTagsStr = emp["Tag"] || "";
      let tags: string[] = [];
      if (Array.isArray(currentTagsStr)) {
        tags = [...currentTagsStr];
      } else if (typeof currentTagsStr === 'string') {
        tags = currentTagsStr.split(',').map(s => s.trim()).filter(Boolean);
      }
      
      const hasTag = tags.includes("MC Representatives");
      
      let updatedEmp = null;
      if (shouldHaveTag && !hasTag) {
        // Add tag
        tags.push("MC Representatives");
        updatedEmp = { ...emp, Tag: tags.join(", ") };
      } else if (!shouldHaveTag && hasTag) {
        // Remove tag
        tags = tags.filter(t => t !== "MC Representatives");
        updatedEmp = { ...emp, Tag: tags.join(", ") };
      }
      
      if (updatedEmp) {
        updatedEmployees.push({ id, data: updatedEmp });
        return updatedEmp;
      }
      return emp;
    });

    // Optimistic update locally (all at once)
    setData(newData);

    // Update on server in background (Parallelized)
    Promise.all(updatedEmployees.map(update => 
      axios.post("/api/proxy", {
        action: "UPDATE",
        data: update.data,
        idKey,
        idValue: update.id,
        gid: "0"
      }).catch(error => {
        console.error(`Error updating employee ${update.id}:`, error);
      })
    ));
  };

  const handleDelete = async (row: any) => {
    const rowHeaders = Object.keys(row);
    const idKey = rowHeaders.find(h => {
      const cleaned = h.trim().toLowerCase();
      return cleaned === "id" || cleaned === "employee id" || cleaned === "employee-id" || cleaned === "emp id";
    }) || rowHeaders[0];
    
    const photoKey = rowHeaders.find(h => h.trim().toLowerCase().includes("photo"));
    
    if (!idKey || row[idKey] === undefined) {
      console.warn("Delete failed: No ID found for row", row);
      return;
    }

    try {
      await deleteEmployeeRaw(row, idKey);

      // Try to delete photo (handles both local uploads and Google Drive)
      if (photoKey && row[photoKey]) {
        const photoUrl = row[photoKey];
        if (typeof photoUrl === "string" && photoUrl.trim() !== "") {
          try {
            await axios.post("/api/delete-file", { url: photoUrl });
          } catch (e) {
            console.error("Failed to delete photo:", e);
          }
        }
      }
      
      // We don't call fetchData(true) here immediately because Google Sheet CSV export
      // can be stale for a few seconds. The hook already updated the local state.
    } catch (e: any) {
      alert("Error during deletion: " + e.message);
    }
  };

  const [isSyncing, setIsSyncing] = useState(false);
  const courseTableRef = useRef<any>(null);

  const handleSyncAll = async () => {
    setIsSyncing(true);
    try {
      await Promise.all([
        fetchData(true),
        fetchSettingsData(true),
        fetchCourseData(true),
        fetchMcBatchData(true),
        fetchDocumentsData(true),
        fetchWorkflowData(true)
      ]);
    } catch (error) {
      console.error("Sync all failed:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSettingsSave = async (formData: any, editingRow: any | null) => {
    await saveSettingRaw(formData, editingRow, "Title");
  };

  const handleSettingsDelete = async (row: any) => {
    await deleteSetting(row, "Title");
  };

  const handleCourseSave = async (formData: any, editingRow: any | null) => {
    // Strip calculated/virtual columns before saving to sheet
    const { 
      "Status": _s, 
      "Gross Revenue": _gr, 
      "Net Revenue": _nr, 
      "Net Profit": _np, 
      "Profit %": _pp,
      ...dataToSave 
    } = formData;

    if (dataToSave["Publication Workflow"] !== undefined) {
      dataToSave["Workflow"] = dataToSave["Publication Workflow"];
    }

    await saveCourse(dataToSave, editingRow, "Course Code");
    setSelectedCourse(formData);
  };

  const handleCourseDelete = async (row: any) => {
    await deleteCourseRaw(row, "Course Code");
  };

  const handleMCBatchSave = async (formData: any, editingRow: any | null) => {
    await saveMcBatch(formData, editingRow, "Batch Number");
  };

  const handleMCBatchDelete = async (row: any) => {
    await deleteMcBatchRaw(row, "Batch Number");
  };

  const handleDocumentSave = async (formData: any, editingRow: any | null) => {
    const idKey = documentsHeaders.find(h => {
      const cleaned = h.toLowerCase().trim();
      return cleaned === "documents title" || cleaned === "document title" || cleaned === "title";
    }) || "Documents Title";
    await saveDocument(formData, editingRow, idKey);
  };

  const handleDocumentDelete = async (row: any) => {
    const idKey = documentsHeaders.find(h => {
      const cleaned = h.toLowerCase().trim();
      return cleaned === "documents title" || cleaned === "document title" || cleaned === "title";
    }) || "Documents Title";
    await deleteDocumentRaw(row, idKey);
  };

  const handleWorkflowSave = async (formData: any, editingRow: any | null) => {
    const idKey = workflowHeaders.find(h => {
      const cleaned = h.trim().toLowerCase();
      return cleaned === "workflow title" || cleaned === "title";
    }) || "Workflow Title";
    
    await saveWorkflow(formData, editingRow, idKey);
  };

  const handleWorkflowDelete = async (row: any) => {
    const idKey = workflowHeaders.find(h => {
      const cleaned = h.trim().toLowerCase();
      return cleaned === "workflow title" || cleaned === "title";
    }) || "Workflow Title";
    
    await deleteWorkflow(row, idKey);
  };

  const renderDocumentActions = (row: any) => {
    const fileLink = row["File Link"];
    if (!fileLink) return null;
    
    let viewUrl = fileLink;
    // Transform Google Drive download link to view link
    if (viewUrl.includes("drive.google.com/uc") || viewUrl.includes("export=download")) {
      const fileIdMatch = viewUrl.match(/[?&]id=([^&]+)/);
      if (fileIdMatch && fileIdMatch[1]) {
        viewUrl = `https://drive.google.com/file/d/${fileIdMatch[1]}/view`;
      }
    }

    return (
      <div className="flex justify-center">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            setViewingFile({ url: viewUrl, title: row["Documents Title"] || "Document Preview" });
          }}
          className="flex items-center gap-1 px-2 py-1 bg-teal-50 hover:bg-teal-100 text-teal-600 rounded border border-teal-200 transition-colors"
          title="View Document"
        >
          <Eye className="w-3.5 h-3.5" />
          <span className="text-[10px] font-bold uppercase tracking-wider">View</span>
        </button>
      </div>
    );
  };



  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden font-sans antialiased text-gray-800">
      <Header 
        activeTab={activeTab} 
        settingsData={settingsData} 
        onSaveMultipleSettings={handleSaveMultipleSettings} 
        onSyncAll={handleSyncAll}
        isSyncing={isSyncing}
        onLogoClick={() => setIsSidebarOpen(prev => !prev)}
      />
      
      <div className="flex flex-1 overflow-hidden">
        <AnimatePresence initial={false}>
          {isSidebarOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 224, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="h-full overflow-hidden shrink-0"
            >
              <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
            </motion.div>
          )}
        </AnimatePresence>
        
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden border-t border-gray-200">
          <div className="flex-1 overflow-hidden p-3 flex flex-col gap-3">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, scale: 0.99 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.99 }}
                transition={{ duration: 0.15 }}
                className="flex-1 min-h-0"
              >
                {activeTab === "micro-credentials" ? (
                  <div className="flex flex-col w-full h-full bg-white rounded border border-gray-200 overflow-hidden relative">
                    {/* Sub-tabs bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-2.5 bg-gray-50/50 border-b border-gray-100 shrink-0 gap-2">
                      <div className="flex items-center gap-1 bg-gray-200/40 p-1 rounded-lg border border-gray-200/40 max-w-max relative isolate">
                        <button
                          onClick={() => {
                            setMcSubTab("dashboard");
                            setIsCourseDetailsOpen(false);
                          }}
                          className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider cursor-pointer text-gray-500 hover:text-gray-800 transition-colors duration-200 select-none"
                        >
                          {mcSubTab === "dashboard" && (
                            <motion.span
                              layoutId="activeSubTab"
                              className="absolute inset-0 bg-white rounded-md shadow-sm border border-gray-100 -z-10"
                              transition={{ type: "spring", stiffness: 220, damping: 26 }}
                            />
                          )}
                          <LayoutDashboard className="w-3.5 h-3.5" />
                          <span className={mcSubTab === "dashboard" ? "text-teal-800" : ""}>Dashboard</span>
                        </button>
                        <button
                          onClick={() => {
                            setMcSubTab("course");
                            setIsCourseDetailsOpen(false);
                          }}
                          className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider cursor-pointer text-gray-500 hover:text-gray-800 transition-colors duration-200 select-none"
                        >
                          {mcSubTab === "course" && (
                            <motion.span
                              layoutId="activeSubTab"
                              className="absolute inset-0 bg-white rounded-md shadow-sm border border-gray-100 -z-10"
                              transition={{ type: "spring", stiffness: 220, damping: 26 }}
                            />
                          )}
                          <BookOpen className="w-3.5 h-3.5" />
                          <span className={mcSubTab === "course" ? "text-teal-800" : ""}>Course</span>
                        </button>
                        <button
                          onClick={() => {
                            setMcSubTab("batch");
                            setIsCourseDetailsOpen(false);
                          }}
                          className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider cursor-pointer text-gray-500 hover:text-gray-800 transition-colors duration-200 select-none"
                        >
                          {mcSubTab === "batch" && (
                            <motion.span
                              layoutId="activeSubTab"
                              className="absolute inset-0 bg-white rounded-md shadow-sm border border-gray-100 -z-10"
                              transition={{ type: "spring", stiffness: 220, damping: 26 }}
                            />
                          )}
                          <Layers className="w-3.5 h-3.5" />
                          <span className={mcSubTab === "batch" ? "text-teal-800" : ""}>Batch</span>
                        </button>
                        <button
                          onClick={() => {
                            setMcSubTab("employees");
                            setIsCourseDetailsOpen(false);
                          }}
                          className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider cursor-pointer text-gray-500 hover:text-gray-800 transition-colors duration-200 select-none"
                        >
                          {mcSubTab === "employees" && (
                            <motion.span
                              layoutId="activeSubTab"
                              className="absolute inset-0 bg-white rounded-md shadow-sm border border-gray-100 -z-10"
                              transition={{ type: "spring", stiffness: 220, damping: 26 }}
                            />
                          )}
                          <Users className="w-3.5 h-3.5" />
                          <span className={mcSubTab === "employees" ? "text-teal-800" : ""}>Employee</span>
                        </button>
                        <button
                          onClick={() => {
                            setMcSubTab("representatives");
                            setIsCourseDetailsOpen(false);
                          }}
                          className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider cursor-pointer text-gray-500 hover:text-gray-800 transition-colors duration-200 select-none"
                        >
                          {mcSubTab === "representatives" && (
                            <motion.span
                              layoutId="activeSubTab"
                              className="absolute inset-0 bg-white rounded-md shadow-sm border border-gray-100 -z-10"
                              transition={{ type: "spring", stiffness: 220, damping: 26 }}
                            />
                          )}
                          <UserCheck className="w-3.5 h-3.5" />
                          <span className={mcSubTab === "representatives" ? "text-teal-800" : ""}>Representatives</span>
                        </button>
                        <button
                          onClick={() => {
                            setMcSubTab("workflow");
                            setIsCourseDetailsOpen(false);
                          }}
                          className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider cursor-pointer text-gray-500 hover:text-gray-800 transition-colors duration-200 select-none"
                        >
                          {mcSubTab === "workflow" && (
                            <motion.span
                              layoutId="activeSubTab"
                              className="absolute inset-0 bg-white rounded-md shadow-sm border border-gray-100 -z-10"
                              transition={{ type: "spring", stiffness: 220, damping: 26 }}
                            />
                          )}
                          <GitMerge className="w-3.5 h-3.5" />
                          <span className={mcSubTab === "workflow" ? "text-teal-800" : ""}>Workflow</span>
                        </button>
                        <button
                          onClick={() => {
                            setMcSubTab("activity");
                            setIsCourseDetailsOpen(false);
                          }}
                          className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider cursor-pointer text-gray-500 hover:text-gray-800 transition-colors duration-200 select-none"
                        >
                          {mcSubTab === "activity" && (
                            <motion.span
                              layoutId="activeSubTab"
                              className="absolute inset-0 bg-white rounded-md shadow-sm border border-gray-100 -z-10"
                              transition={{ type: "spring", stiffness: 220, damping: 26 }}
                            />
                          )}
                          <Activity className="w-3.5 h-3.5" />
                          <span className={mcSubTab === "activity" ? "text-teal-800" : ""}>Activity</span>
                        </button>
                        <button
                          onClick={() => {
                            setMcSubTab("documents");
                            setIsCourseDetailsOpen(false);
                          }}
                          className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider cursor-pointer text-gray-500 hover:text-gray-800 transition-colors duration-200 select-none"
                        >
                          {mcSubTab === "documents" && (
                            <motion.span
                              layoutId="activeSubTab"
                              className="absolute inset-0 bg-white rounded-md shadow-sm border border-gray-100 -z-10"
                              transition={{ type: "spring", stiffness: 220, damping: 26 }}
                            />
                          )}
                          <FileText className="w-3.5 h-3.5" />
                          <span className={mcSubTab === "documents" ? "text-teal-800" : ""}>Documents</span>
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5 text-[9px] font-mono text-gray-400 font-bold tracking-widest uppercase shrink-0">
                        <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
                        Micro-Credentials
                      </div>
                    </div>

                    {/* Sub-tab contents */}
                    <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={mcSubTab}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.15, ease: "easeInOut" }}
                          className="flex-1 overflow-hidden flex flex-col min-h-0 transform-gpu"
                        >
                          {mcSubTab === "dashboard" ? (
                            <MCDashboard 
                              courseData={enrichedCourseData} 
                              mcBatchData={mcBatchData} 
                              employees={data} 
                              onTabChange={(tab) => {
                                setMcSubTab(tab);
                                setIsCourseDetailsOpen(false);
                              }}
                              onCourseClick={(course) => {
                                setSelectedCourse(course);
                                setMcSubTab("course");
                                setTimeout(() => {
                                  setIsCourseDetailsOpen(true);
                                }, 50);
                              }}
                            />
                          ) : mcSubTab === "course" ? (
                            <div className="flex-1 overflow-hidden relative">
                              <Table 
                                ref={courseTableRef}
                                data={enrichedCourseData}
                                headers={courseTableHeaders}
                                formHeaders={courseHeaders.filter(h => !["Proposed By", "Developed By", "Reviewed By", "Approved By", "Published By"].includes(h))}
                                isLoading={isCourseLoading}
                                onSave={handleCourseSave}
                                onDelete={handleCourseDelete}
                                onRefresh={() => fetchCourseData(true)}
                                FormPanel={MCCoursePanel}
                                entityName="Course"
                                title="Course List"
                                renderActions={renderCourseActions}
                                employees={data}
                                extraFormProps={{ 
                                  allBatches: mcBatchData, 
                                  onSaveBatch: handleMCBatchSave,
                                  allDocuments: documentsData,
                                  onSaveDocument: handleDocumentSave,
                                  workflowData: workflowData,
                                  onExpand: (course: any) => {
                                    setSelectedCourse(course);
                                    setIsCourseDetailsOpen(true);
                                  }
                                }}
                              />
                              <MCCourseDetails 
                                isOpen={isCourseDetailsOpen}
                                onClose={() => {
                                  setIsCourseDetailsOpen(false);
                                  if (courseTableRef.current) {
                                    courseTableRef.current.handleOpenEdit(selectedCourse);
                                  }
                                }}
                                data={selectedCourse}
                                onSave={handleCourseSave}
                                employees={data}
                                batches={mcBatchData}
                                documents={documentsData}
                                workflowData={workflowData}
                                extraFormProps={{
                                  onSaveBatch: handleMCBatchSave,
                                  onSaveDocument: handleDocumentSave,
                                  batchHeaders: mcBatchHeaders,
                                  documentHeaders: documentsHeaders
                                }}
                              />
                            </div>
                          ) : mcSubTab === "batch" ? (
                            <div className="flex-1 overflow-hidden relative">
                              <Table 
                                data={mcBatchData}
                                headers={mcBatchHeaders}
                                isLoading={isMcBatchLoading}
                                onSave={handleMCBatchSave}
                                onDelete={handleMCBatchDelete}
                                onRefresh={() => fetchMcBatchData(true)}
                                FormPanel={MCBatchPanel}
                                entityName="Batch"
                                title="Batch List"
                                employees={data}
                                extraFormProps={{
                                  workflowData: workflowData
                                }}
                              />
                            </div>
                          ) : mcSubTab === "employees" ? (
                            <div className="flex-1 overflow-hidden relative">
                              <Table 
                                data={data}
                                headers={headers}
                                isLoading={isLoading}
                                onSave={handleSave}
                                onDelete={handleDelete}
                                onRefresh={() => fetchData(true)}
                                FormPanel={EmployeePanel}
                                entityName="Employee"
                              />
                            </div>
                          ) : mcSubTab === "representatives" ? (
                            <div className="flex-1 overflow-hidden relative">
                              <Table 
                                data={data}
                                headers={headers}
                                isLoading={isLoading}
                                onSave={handleSave}
                                onDelete={handleDelete}
                                onRefresh={() => fetchData(true)}
                                FormPanel={EmployeePanel}
                                entityName="MC Representative"
                                title="Representatives List"
                                initialFilter={{ Tag: "MC Representatives" }}
                                defaultNewValues={{ Tag: ["MC Representatives"] }}
                                onAddClick={() => setShowEmployeePicker(true)}
                              >
                                <EmployeePicker
                                  isOpen={showEmployeePicker}
                                  onClose={() => setShowEmployeePicker(false)}
                                  onSave={handlePickerSave}
                                  employees={availableEmployeesForPicker}
                                  headers={headers}
                                />
                              </Table>
                            </div>
                          ) : mcSubTab === "workflow" ? (
                            <div className="flex-1 overflow-hidden relative">
                              <WorkflowView 
                                data={workflowData}
                                headers={workflowHeaders}
                                isLoading={isWorkflowLoading}
                                onSave={handleWorkflowSave}
                                onDelete={handleWorkflowDelete}
                                onRefresh={() => fetchWorkflowData(true)}
                              />
                            </div>
                          ) : mcSubTab === "activity" ? (
                            <div className="flex-1 overflow-hidden relative">
                              <ActivityPanel
                                courseData={enrichedCourseData}
                                mcBatchData={mcBatchData}
                                employees={data}
                                workflowData={workflowData}
                                onSaveCourse={handleCourseSave}
                                onSaveBatch={handleMCBatchSave}
                                documents={documentsData}
                                onSaveDocument={handleDocumentSave}
                                onViewFile={(url, title, doc) => setViewingFile({ url, title, doc })}
                              />
                            </div>
                          ) : mcSubTab === "documents" ? (
                            <div className="flex-1 overflow-hidden relative">
                              <Table 
                                data={documentsData}
                                headers={documentsHeaders}
                                isLoading={isDocumentsLoading}
                                onSave={handleDocumentSave}
                                onDelete={handleDocumentDelete}
                                onRefresh={() => fetchDocumentsData(true)}
                                FormPanel={DocumentsPanel}
                                entityName="Document"
                                title="Documents List"
                                renderActions={renderDocumentActions}
                              />
                            </div>
                          ) : null}
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  </div>
                ) : activeTab === "settings" ? (
                  <div className="flex w-full h-full bg-white rounded border border-gray-200 overflow-hidden">
                    <SettingsTab 
                      settingsData={settingsData}
                      isLoading={isSettingsLoading}
                      onSaveMultipleSettings={handleSaveMultipleSettings}
                      onRefresh={() => fetchSettingsData(true)}
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full bg-white rounded border border-gray-200">
                    <p className="text-gray-400 text-xs font-mono uppercase tracking-widest">
                      Module Offline / {activeTab}
                    </p>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
      <AnimatePresence>
        {viewingFile && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-lg shadow-2xl w-full max-w-5xl h-[80vh] flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between p-3 bg-teal-600 text-white">
                <h3 className="text-sm font-bold truncate pr-4">{viewingFile.title}</h3>
                
                <div className="flex gap-2">
                    <button 
                        onClick={() => setDocStatus("Revision")}
                        className={`px-2 py-1 text-[10px] font-bold rounded ${docStatus === "Revision" || docStatus === "Revision Required" ? "bg-amber-800" : "bg-amber-600 hover:bg-amber-500"}`}
                    >
                        Revision
                    </button>
                    <button 
                        onClick={() => setDocStatus("Verified")}
                        className={`px-2 py-1 text-[10px] font-bold rounded ${docStatus === "Verified" || docStatus === "Job Done" || docStatus === "Approved" ? "bg-emerald-800" : "bg-emerald-600 hover:bg-emerald-500"}`}
                    >
                        Verified
                    </button>
                    <button 
                        onClick={handleSaveDocStatus}
                        className="px-2 py-1 text-[10px] font-bold bg-white text-teal-700 rounded hover:bg-gray-100"
                    >
                        Save
                    </button>
                </div>

                <button 
                  onClick={() => setViewingFile(null)}
                  className="p-1 hover:bg-teal-700 rounded transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 bg-gray-100 relative">
                {viewingFile.url.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/) ? (
                  <div className="w-full h-full flex items-center justify-center p-4 text-center">
                    <img 
                      src={viewingFile.url} 
                      alt={viewingFile.title} 
                      className="max-w-full max-h-full object-contain mx-auto shadow-lg bg-white"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  <iframe 
                    src={
                      viewingFile.url.includes("drive.google.com") 
                        ? viewingFile.url.replace("/view", "/preview").replace("/edit", "/preview")
                        : viewingFile.url
                    } 
                    className="w-full h-full border-none"
                    title="File Preview"
                  />
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
