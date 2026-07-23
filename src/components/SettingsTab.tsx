import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { 
  Building2, 
  Database, 
  Edit3, 
  Save, 
  X, 
  Globe, 
  Terminal, 
  Fingerprint, 
  Briefcase, 
  Building, 
  Image as ImageIcon, 
  Loader2, 
  Check,
  ExternalLink,
  RefreshCw,
  FolderOpen,
  BookOpen,
  HelpCircle,
  ArrowRight,
  Info,
  FileCode,
  FileUp,
  Users,
  Layers,
  FileText,
  GitMerge,
  Table
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";

interface SettingsTabProps {
  settingsData: any[];
  isLoading: boolean;
  onSaveMultipleSettings: (updates: { Title: string; Content: string }[]) => Promise<void>;
  onRefresh?: () => void;
}

export default function SettingsTab({
  settingsData,
  isLoading,
  onSaveMultipleSettings,
  onRefresh
}: SettingsTabProps) {
  // Find values from settingsData or fallback to empty strings
  const getSettingValue = (title: string, fallback: string = "") => {
    const found = settingsData.find(r => r.Title === title);
    return found?.Content ?? fallback;
  };

  // Unified Edit & Saving State
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [orgForm, setOrgForm] = useState({
    Department: "",
    Organization: "",
    Logo: ""
  });

  const [dbForm, setDbForm] = useState<any>({
    "Google Sheet Link": "",
    "Apps Script API": "",
    "Settings GID": "",
    "Employee GID": "",
    "MC Batch GID": "",
    "Course GID": "",
    "Documents GID": "",
    "Workflow GID": "",
    "Drive Location": "",
    "File Location": "",
    "Script": "",
    "Script Link": ""
  });

  // Sync state with real data when not editing
  useEffect(() => {
    if (!isEditing) {
      setOrgForm({
        Department: getSettingValue("Department", "Department"),
        Organization: getSettingValue("Organization", "Organization"),
        Logo: getSettingValue("Logo", "")
      });
    }
  }, [settingsData, isEditing]);

  useEffect(() => {
    if (!isEditing) {
      setDbForm({
        "Google Sheet Link": getSettingValue("Google Sheet Link", "https://docs.google.com/spreadsheets/d/1zpDWjuTLdSIdZ8GCICEo6EFs962kAkBk1TpIPDvmZwc/edit"),
        "Apps Script API": getSettingValue("Apps Script API", "https://script.google.com/macros/s/AKfycby_iQK4Z5C1ppjPA3g3JbHU4kbXLMS0aWhWg73mwRFY8QUohd_u8MuvusHK5ZxOXSDx/exec"),
        "Settings GID": getSettingValue("Settings GID", getSettingValue("GID", "1972051572")),
        "Employee GID": getSettingValue("Employee GID", "0"),
        "MC Batch GID": getSettingValue("MC Batch GID", "1111164355"),
        "Course GID": getSettingValue("Course GID", "1120624852"),
        "Documents GID": getSettingValue("Documents GID", "732376789"),
        "Workflow GID": getSettingValue("Workflow GID", "1686458334"),
        "Drive Location": getSettingValue("Drive Location", ""),
        "File Location": getSettingValue("File Location", "Main Folder"),
        "Script": getSettingValue("Script", getSettingValue("Script name", "Script")),
        "Script Link": getSettingValue("Script Link", "")
      });
    }
  }, [settingsData, isEditing]);

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const updates = [
        { Title: "Google Sheet Link", Content: dbForm["Google Sheet Link"].trim() },
        { Title: "Apps Script API", Content: dbForm["Apps Script API"].trim() },
        { Title: "Settings GID", Content: dbForm["Settings GID"].trim() },
        { Title: "Employee GID", Content: dbForm["Employee GID"].trim() },
        { Title: "MC Batch GID", Content: dbForm["MC Batch GID"].trim() },
        { Title: "Course GID", Content: dbForm["Course GID"].trim() },
        { Title: "Documents GID", Content: dbForm["Documents GID"].trim() },
        { Title: "Workflow GID", Content: dbForm["Workflow GID"].trim() },
        { Title: "Drive Location", Content: dbForm["Drive Location"].trim() },
        { Title: "File Location", Content: dbForm["File Location"].trim() },
        { Title: "Script", Content: dbForm["Script"].trim() },
        { Title: "Department", Content: orgForm.Department.trim() },
        { Title: "Organization", Content: orgForm.Organization.trim() },
        { Title: "Logo", Content: orgForm.Logo.trim() }
      ];
      await onSaveMultipleSettings(updates);
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to save configuration settings:", error);
      alert("Failed to save configuration changes. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const [isUploadingScript, setIsUploadingScript] = useState(false);
  const [scriptUploadUrl, setScriptUploadUrl] = useState("");
  const [scriptUploadError, setScriptUploadError] = useState("");
  const scriptFileInputRef = useRef<HTMLInputElement>(null);

  const handleScriptFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingScript(true);
    setScriptUploadError("");
    setScriptUploadUrl("");

    const fileLocation = dbForm["File Location"] || "Main Folder";
    const scriptName = dbForm["Script"] || "Script";
    const uploadFolder = `${fileLocation}/${scriptName}`;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("folderPath", uploadFolder);

    try {
      const link = dbForm["Google Sheet Link"] || getSettingValue("Google Sheet Link");
      const api = dbForm["Apps Script API"] || getSettingValue("Apps Script API");
      let spreadsheetId = "";
      if (link) {
        const match = link.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (match) spreadsheetId = match[1];
      }
      const headers: Record<string, string> = {
        "Content-Type": "multipart/form-data"
      };
      if (spreadsheetId) headers["x-spreadsheet-id"] = spreadsheetId;
      if (api) headers["x-apps-script-url"] = api;

      const response = await axios.post("/api/upload", formData, { headers });
      if (response.data && response.data.url) {
        const uploadedUrl = response.data.url;
        setScriptUploadUrl(uploadedUrl);
        setDbForm(prev => ({ ...prev, "Script Link": uploadedUrl }));
        try {
          await onSaveMultipleSettings([
            { Title: "Script Link", Content: uploadedUrl }
          ]);
        } catch (saveErr) {
          console.error("Failed to auto-save script link:", saveErr);
        }
      } else {
        throw new Error("No URL returned from upload API");
      }
    } catch (err: any) {
      console.error("Script file upload failed:", err);
      setScriptUploadError(
        err.response?.data?.details || 
        err.response?.data?.error || 
        err.message || 
        "Upload failed"
      );
    } finally {
      setIsUploadingScript(false);
      if (scriptFileInputRef.current) {
        scriptFileInputRef.current.value = "";
      }
    }
  };

  const getDisplayUrl = (url: string) => {
    if (!url) return "";
    if (url.startsWith("blob:")) return url;
    if (url.includes("drive.google.com") || url.includes("drive.usercontent.google.com")) {
      return `/api/image?url=${encodeURIComponent(url)}`;
    }
    return url;
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-50 overflow-hidden">
      {/* Top action bar - Made highly compact */}
      <div className="px-4 py-2.5 bg-white border-b border-gray-200 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-sm font-bold text-gray-900 tracking-tight">Configuration Settings</h2>
          <p className="text-[11px] text-gray-500 mt-0.5">Manage organization parameters and central database configurations.</p>
        </div>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-2.5 py-1.5 border border-gray-200 hover:border-gray-300 hover:bg-gray-50 rounded text-xs font-semibold text-gray-600 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn("w-3 h-3 text-gray-500", isLoading && "animate-spin")} />
          Sync settings
        </button>
      </div>

      {/* Main settings grids - Compact padding and 2-column Layout */}
      <div className="flex-1 overflow-y-auto p-3.5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 max-w-7xl mx-auto">
          
          {/* Left Column (Combined Setup Card with Row Groups) */}
          <div className="lg:col-span-5 space-y-3.5">
            
            {/* Combined Configuration Card */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden flex flex-col h-fit">
              <div className="px-4 py-2 bg-teal-800 text-white flex items-center gap-2 shrink-0 justify-between">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-teal-200" />
                  <div>
                    <h3 className="text-xs font-bold tracking-wider uppercase">System Configuration</h3>
                    <p className="text-[9px] text-teal-200/80 font-mono">DATABASE & ORGANIZATION SETTINGS</p>
                  </div>
                </div>
                <span className="text-[9px] bg-teal-900/60 px-2 py-0.5 rounded text-teal-200 font-medium">Step 1 & 2</span>
              </div>

              <div className="p-3.5 space-y-3">
                <div className="border border-gray-100 rounded overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 font-semibold uppercase tracking-wider text-[9px]">
                        <th className="px-3 py-2 w-5/12 border-r border-gray-100">Setting Key</th>
                        <th className="px-3 py-2 w-7/12">Value / Content</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-700">
                      
                      {/* GROUP 1: DATABASE SETTINGS */}
                      <tr className="bg-teal-50/50">
                        <td colSpan={2} className="px-3 py-1.5 text-teal-800 font-bold uppercase tracking-wider text-[9px] border-y border-gray-150">
                          <div className="flex items-center gap-1.5 font-sans">
                            <Database className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                            <span>Database Setup</span>
                          </div>
                        </td>
                      </tr>

                      {/* Google Sheet Link Row */}
                      <tr>
                        <td className="px-3 py-2 font-semibold bg-gray-50/50 border-r border-gray-100 flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          Google Sheet Link
                        </td>
                        <td className="px-3 py-1.5">
                          {isEditing ? (
                            <input
                              type="text"
                              value={dbForm["Google Sheet Link"]}
                              onChange={(e) => setDbForm({ ...dbForm, "Google Sheet Link": e.target.value })}
                              className="w-full border border-gray-200 focus:border-teal-500 outline-none rounded px-2 py-1 text-xs text-gray-800 bg-white font-mono text-[10px]"
                              placeholder="https://docs.google.com/spreadsheets/d/..."
                            />
                          ) : (
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="font-mono text-[10px] text-gray-600 truncate max-w-[240px]" title={dbForm["Google Sheet Link"]}>
                                {dbForm["Google Sheet Link"] || <em className="text-gray-300 font-sans">Not configured</em>}
                              </span>
                              {dbForm["Google Sheet Link"] && (
                                <a 
                                  href={dbForm["Google Sheet Link"]} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="text-teal-600 hover:text-teal-800 p-0.5 hover:bg-teal-50 rounded shrink-0"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>

                      {/* Apps Script API Row */}
                      <tr>
                        <td className="px-3 py-2 font-semibold bg-gray-50/50 border-r border-gray-100 flex items-center gap-1.5">
                          <Terminal className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          Apps Script API
                        </td>
                        <td className="px-3 py-1.5">
                          {isEditing ? (
                            <input
                              type="text"
                              value={dbForm["Apps Script API"]}
                              onChange={(e) => setDbForm({ ...dbForm, "Apps Script API": e.target.value })}
                              className="w-full border border-gray-200 focus:border-teal-500 outline-none rounded px-2 py-1 text-xs text-gray-800 bg-white font-mono text-[10px]"
                              placeholder="https://script.google.com/macros/s/.../exec"
                            />
                          ) : (
                            <span className="font-mono text-[10px] text-gray-600 block truncate max-w-[280px]" title={dbForm["Apps Script API"]}>
                              {dbForm["Apps Script API"] || <em className="text-gray-300 font-sans">Not configured</em>}
                            </span>
                          )}
                        </td>
                      </tr>

                      {/* Script Row */}
                      <tr>
                        <td className="px-3 py-2 font-semibold bg-gray-50/50 border-r border-gray-100 flex items-center gap-1.5">
                          <FileCode className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          Script
                        </td>
                        <td className="px-3 py-1.5">
                          {isEditing ? (
                            <div className="flex flex-col gap-1">
                              <input
                                type="text"
                                value={dbForm["Script"]}
                                onChange={(e) => setDbForm({ ...dbForm, "Script": e.target.value })}
                                className="w-full border border-gray-200 focus:border-teal-500 outline-none rounded px-2 py-1 text-xs text-gray-800 bg-white font-mono text-[10px]"
                                placeholder="e.g. Script"
                              />
                              <span className="text-[9px] text-gray-400">
                                Folder location: <code className="bg-gray-100 px-1 py-0.5 rounded text-[8px] font-mono text-teal-700">{dbForm["File Location"] || "Main Folder"}/{dbForm["Script"] || "Script"}</code>
                              </span>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1.5 py-0.5">
                              <div className="flex items-center gap-2">
                                <input 
                                  type="file"
                                  ref={scriptFileInputRef}
                                  onChange={handleScriptFileUpload}
                                  className="hidden"
                                  id="script-file-upload-input"
                                  disabled={isUploadingScript}
                                />
                                <label
                                  htmlFor="script-file-upload-input"
                                  className={cn(
                                    "flex items-center gap-1.5 px-2.5 py-1 bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 rounded text-[11px] font-semibold text-gray-700 cursor-pointer shadow-sm transition-colors shrink-0",
                                    isUploadingScript && "opacity-50 cursor-not-allowed"
                                  )}
                                >
                                  <FileUp className="w-3.5 h-3.5 text-gray-500" />
                                  Choose File
                                </label>

                                {isUploadingScript ? (
                                  <div className="flex items-center gap-1 text-[11px] text-teal-600 font-medium animate-pulse">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-500" />
                                    Uploading...
                                  </div>
                                ) : (dbForm["Script Link"] || scriptUploadUrl) ? (
                                  <a 
                                    href={dbForm["Script Link"] || scriptUploadUrl} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="flex items-center gap-1 px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 hover:text-teal-950 border border-teal-200 rounded text-[11px] font-semibold transition-colors animate-fade-in"
                                    title="Preview file in Google Drive"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5 shrink-0 text-teal-600" />
                                    Preview File
                                  </a>
                                ) : (
                                  <span className="text-[10px] text-gray-400 italic">
                                    No script file uploaded yet
                                  </span>
                                )}
                              </div>
                              
                              <span className="text-[9px] text-gray-400 font-sans">
                                Upload path: <code className="bg-gray-100 px-1 py-0.5 rounded text-[8px] font-mono text-teal-700">{dbForm["File Location"] || "Main Folder"}/{dbForm["Script"] || "Script"}</code>
                              </span>

                              {scriptUploadError && (
                                <div className="text-[10px] text-red-500 bg-red-50 border border-red-100 p-1.5 rounded mt-0.5 font-medium break-all">
                                  Error: {scriptUploadError}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>

                      {/* Settings GID Row */}
                      <tr>
                        <td className="px-3 py-2 font-semibold bg-gray-50/50 border-r border-gray-100 flex items-center gap-1.5">
                          <Fingerprint className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          Settings GID
                        </td>
                        <td className="px-3 py-1.5">
                          {isEditing ? (
                            <input
                              type="text"
                              value={dbForm["Settings GID"]}
                              onChange={(e) => setDbForm({ ...dbForm, "Settings GID": e.target.value })}
                              className="w-full border border-gray-200 focus:border-teal-500 outline-none rounded px-2 py-1 text-xs text-gray-800 bg-white font-mono text-[10px]"
                              placeholder="e.g. 1972051572"
                            />
                          ) : (
                            <span className="font-mono text-[10px] text-gray-900 font-semibold">{dbForm["Settings GID"] || "1972051572"}</span>
                          )}
                        </td>
                      </tr>

                      {/* Employee GID Row */}
                      <tr>
                        <td className="px-3 py-2 font-semibold bg-gray-50/50 border-r border-gray-100 flex items-center gap-1.5">
                          <Fingerprint className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          Employee GID
                        </td>
                        <td className="px-3 py-1.5">
                          {isEditing ? (
                            <input
                              type="text"
                              value={dbForm["Employee GID"]}
                              onChange={(e) => setDbForm({ ...dbForm, "Employee GID": e.target.value })}
                              className="w-full border border-gray-200 focus:border-teal-500 outline-none rounded px-2 py-1 text-xs text-gray-800 bg-white font-mono text-[10px]"
                              placeholder="e.g. 0"
                            />
                          ) : (
                            <span className="font-mono text-[10px] text-gray-900 font-semibold">{dbForm["Employee GID"] || "0"}</span>
                          )}
                        </td>
                      </tr>

                      {/* MC Batch GID Row */}
                      <tr>
                        <td className="px-3 py-2 font-semibold bg-gray-50/50 border-r border-gray-100 flex items-center gap-1.5">
                          <Fingerprint className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          MC Batch GID
                        </td>
                        <td className="px-3 py-1.5">
                          {isEditing ? (
                            <input
                              type="text"
                              value={dbForm["MC Batch GID"]}
                              onChange={(e) => setDbForm({ ...dbForm, "MC Batch GID": e.target.value })}
                              className="w-full border border-gray-200 focus:border-teal-500 outline-none rounded px-2 py-1 text-xs text-gray-800 bg-white font-mono text-[10px]"
                              placeholder="e.g. 1111164355"
                            />
                          ) : (
                            <span className="font-mono text-[10px] text-gray-900 font-semibold">{dbForm["MC Batch GID"] || "1111164355"}</span>
                          )}
                        </td>
                      </tr>

                      {/* Course GID Row */}
                      <tr>
                        <td className="px-3 py-2 font-semibold bg-gray-50/50 border-r border-gray-100 flex items-center gap-1.5">
                          <Fingerprint className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          Course GID
                        </td>
                        <td className="px-3 py-1.5">
                          {isEditing ? (
                            <input
                              type="text"
                              value={dbForm["Course GID"]}
                              onChange={(e) => setDbForm({ ...dbForm, "Course GID": e.target.value })}
                              className="w-full border border-gray-200 focus:border-teal-500 outline-none rounded px-2 py-1 text-xs text-gray-800 bg-white font-mono text-[10px]"
                              placeholder="e.g. 1120624852"
                            />
                          ) : (
                            <span className="font-mono text-[10px] text-gray-900 font-semibold">{dbForm["Course GID"] || "1120624852"}</span>
                          )}
                        </td>
                      </tr>

                      {/* Documents GID Row */}
                      <tr>
                        <td className="px-3 py-2 font-semibold bg-gray-50/50 border-r border-gray-100 flex items-center gap-1.5">
                          <Fingerprint className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          Documents GID
                        </td>
                        <td className="px-3 py-1.5">
                          {isEditing ? (
                            <input
                              type="text"
                              value={dbForm["Documents GID"]}
                              onChange={(e) => setDbForm({ ...dbForm, "Documents GID": e.target.value })}
                              className="w-full border border-gray-200 focus:border-teal-500 outline-none rounded px-2 py-1 text-xs text-gray-800 bg-white font-mono text-[10px]"
                              placeholder="e.g. 732376789"
                            />
                          ) : (
                            <span className="font-mono text-[10px] text-gray-900 font-semibold">{dbForm["Documents GID"] || "732376789"}</span>
                          )}
                        </td>
                      </tr>

                      {/* Workflow GID Row */}
                      <tr>
                        <td className="px-3 py-2 font-semibold bg-gray-50/50 border-r border-gray-100 flex items-center gap-1.5">
                          <Fingerprint className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          Workflow GID
                        </td>
                        <td className="px-3 py-1.5">
                          {isEditing ? (
                            <input
                              type="text"
                              value={dbForm["Workflow GID"]}
                              onChange={(e) => setDbForm({ ...dbForm, "Workflow GID": e.target.value })}
                              className="w-full border border-gray-200 focus:border-teal-500 outline-none rounded px-2 py-1 text-xs text-gray-800 bg-white font-mono text-[10px]"
                              placeholder="e.g. 1686458334"
                            />
                          ) : (
                            <span className="font-mono text-[10px] text-gray-900 font-semibold">{dbForm["Workflow GID"] || "1686458334"}</span>
                          )}
                        </td>
                      </tr>

                      {/* Drive Location Row */}
                      <tr>
                        <td className="px-3 py-2 font-semibold bg-gray-50/50 border-r border-gray-100 flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          Drive Location
                        </td>
                        <td className="px-3 py-1.5">
                          {isEditing ? (
                            <input
                              type="text"
                              value={dbForm["Drive Location"]}
                              onChange={(e) => setDbForm({ ...dbForm, "Drive Location": e.target.value })}
                              className="w-full border border-gray-200 focus:border-teal-500 outline-none rounded px-2 py-1 text-xs text-gray-800 bg-white font-mono text-[10px]"
                              placeholder="Google Drive Folder Link or Folder ID"
                            />
                          ) : (
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="font-mono text-[10px] text-gray-600 truncate max-w-[240px]" title={dbForm["Drive Location"]}>
                                {dbForm["Drive Location"] || <em className="text-gray-300 font-sans">Root Folder (default)</em>}
                              </span>
                              {dbForm["Drive Location"] && (dbForm["Drive Location"].includes("drive.google.com") || dbForm["Drive Location"].includes("drive.usercontent.google.com")) && (
                                <a 
                                  href={dbForm["Drive Location"]} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="text-teal-600 hover:text-teal-800 p-0.5 hover:bg-teal-50 rounded shrink-0"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>

                      {/* File Location Row */}
                      <tr>
                        <td className="px-3 py-2 font-semibold bg-gray-50/50 border-r border-gray-100 flex items-center gap-1.5">
                          <FolderOpen className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          File Location
                        </td>
                        <td className="px-3 py-1.5">
                          {isEditing ? (
                            <input
                              type="text"
                              value={dbForm["File Location"]}
                              onChange={(e) => setDbForm({ ...dbForm, "File Location": e.target.value })}
                              className="w-full border border-gray-200 focus:border-teal-500 outline-none rounded px-2 py-1 text-xs text-gray-800 bg-white font-mono text-[10px]"
                              placeholder="e.g. Main Folder"
                            />
                          ) : (
                            <span className="font-mono text-[10px] text-gray-900 font-semibold">{dbForm["File Location"] || "Main Folder"}</span>
                          )}
                        </td>
                      </tr>

                      {/* GROUP 2: ORGANIZATION PROFILE */}
                      <tr className="bg-teal-50/50">
                        <td colSpan={2} className="px-3 py-1.5 text-teal-800 font-bold uppercase tracking-wider text-[9px] border-y border-gray-150">
                          <div className="flex items-center gap-1.5 font-sans">
                            <Building2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                            <span>Organization Setup</span>
                          </div>
                        </td>
                      </tr>

                      {/* Department Row */}
                      <tr>
                        <td className="px-3 py-2 font-semibold bg-gray-50/50 border-r border-gray-100 flex items-center gap-1.5">
                          <Briefcase className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          Department
                        </td>
                        <td className="px-3 py-1.5">
                          {isEditing ? (
                            <input
                              type="text"
                              value={orgForm.Department}
                              onChange={(e) => setOrgForm({ ...orgForm, Department: e.target.value })}
                              className="w-full border border-gray-200 focus:border-teal-500 outline-none rounded px-2 py-1 text-xs text-gray-800 bg-white"
                              placeholder="e.g. Mechanical Department"
                            />
                          ) : (
                            <span className="font-medium text-gray-900">{orgForm.Department || <em className="text-gray-300">Not configured</em>}</span>
                          )}
                        </td>
                      </tr>

                      {/* Organization Row */}
                      <tr>
                        <td className="px-3 py-2 font-semibold bg-gray-50/50 border-r border-gray-100 flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          Organization
                        </td>
                        <td className="px-3 py-1.5">
                          {isEditing ? (
                            <input
                              type="text"
                              value={orgForm.Organization}
                              onChange={(e) => setOrgForm({ ...orgForm, Organization: e.target.value })}
                              className="w-full border border-gray-200 focus:border-teal-500 outline-none rounded px-2 py-1 text-xs text-gray-800 bg-white"
                              placeholder="e.g. Acme Corporation"
                            />
                          ) : (
                            <span className="font-medium text-gray-900">{orgForm.Organization || <em className="text-gray-300">Not configured</em>}</span>
                          )}
                        </td>
                      </tr>

                      {/* Logo Row */}
                      <tr>
                        <td className="px-3 py-2 font-semibold bg-gray-50/50 border-r border-gray-100 flex items-center gap-1.5">
                          <ImageIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          Logo URL
                        </td>
                        <td className="px-3 py-1.5">
                          {isEditing ? (
                            <div className="space-y-1.5">
                              <input
                                type="text"
                                value={orgForm.Logo}
                                onChange={(e) => setOrgForm({ ...orgForm, Logo: e.target.value })}
                                className="w-full border border-gray-200 focus:border-teal-500 outline-none rounded px-2 py-1 text-xs text-gray-800 bg-white font-mono text-[10px]"
                                placeholder="Image or Google Drive direct link URL"
                              />
                              {orgForm.Logo.trim() && (
                                <div className="flex items-center gap-1.5 bg-gray-50 p-1 rounded border border-gray-100">
                                  <span className="text-[9px] text-gray-400">Preview:</span>
                                  <img 
                                    src={getDisplayUrl(orgForm.Logo.trim())} 
                                    alt="Logo Preview" 
                                    className="h-6 object-contain rounded border border-gray-200 bg-white p-0.5"
                                    onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                                  />
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-[10px] text-gray-500 max-w-[200px] truncate" title={orgForm.Logo}>
                                {orgForm.Logo || <em className="text-gray-300 font-sans">No custom Logo URL</em>}
                              </span>
                              {orgForm.Logo && (
                                <img 
                                  src={getDisplayUrl(orgForm.Logo)} 
                                  alt="Logo thumbnail" 
                                  className="h-5 w-8 object-contain rounded bg-gray-50 p-0.5 border border-gray-100"
                                />
                              )}
                            </div>
                          )}
                        </td>
                      </tr>

                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bottom edit button - Compact height */}
              <div className="px-4 py-2 bg-gray-50 border-t border-gray-150 flex justify-end gap-2 shrink-0">
                {isEditing ? (
                  <>
                    <button
                      onClick={() => {
                        setIsEditing(false);
                        setDbForm({
                          "Google Sheet Link": getSettingValue("Google Sheet Link", "https://docs.google.com/spreadsheets/d/1zpDWjuTLdSIdZ8GCICEo6EFs962kAkBk1TpIPDvmZwc/edit"),
                          "Apps Script API": getSettingValue("Apps Script API", "https://script.google.com/macros/s/AKfycby_iQK4Z5C1ppjPA3g3JbHU4kbXLMS0aWhWg73mwRFY8QUohd_u8MuvusHK5ZxOXSDx/exec"),
                          "Settings GID": getSettingValue("Settings GID", getSettingValue("GID", "1972051572")),
                          "Employee GID": getSettingValue("Employee GID", "0"),
                          "MC Batch GID": getSettingValue("MC Batch GID", "1111164355"),
                          "Course GID": getSettingValue("Course GID", "1120624852"),
                          "Documents GID": getSettingValue("Documents GID", "732376789"),
                          "Workflow GID": getSettingValue("Workflow GID", "1686458334"),
                          "Drive Location": getSettingValue("Drive Location", ""),
                          "File Location": getSettingValue("File Location", "Main Folder"),
                          "Script": getSettingValue("Script", getSettingValue("Script name", "Script")),
                          "Script Link": getSettingValue("Script Link", "")
                        });
                        setOrgForm({
                          Department: getSettingValue("Department", "Department"),
                          Organization: getSettingValue("Organization", "Organization"),
                          Logo: getSettingValue("Logo", "")
                        });
                      }}
                      disabled={isSaving}
                      className="flex items-center gap-1 px-2.5 py-1 border border-gray-200 rounded text-[11px] font-bold text-gray-500 hover:bg-gray-100 transition-all uppercase tracking-wider"
                    >
                      <X className="w-3 h-3" />
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveSettings}
                      disabled={isSaving || !orgForm.Department.trim() || !orgForm.Organization.trim()}
                      className="flex items-center gap-1 px-3.5 py-1 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-200 disabled:text-gray-400 rounded text-[11px] font-bold text-white transition-all uppercase tracking-wider"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-3 h-3" />
                          Save Changes
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-1.5 px-3 py-1 border border-teal-600 hover:bg-teal-50 text-teal-700 rounded text-[11px] font-bold transition-all uppercase tracking-wider"
                  >
                    <Edit3 className="w-3 h-3" />
                    Edit Settings
                  </button>
                )}
              </div>
            </div>

            {/* Google Sheets Tabs Overview Card */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden flex flex-col h-fit">
              <div className="px-4 py-2 bg-teal-900 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <Table className="w-4 h-4 text-teal-300" />
                  <div>
                    <h3 className="text-xs font-bold tracking-wider uppercase">Application Google Sheets</h3>
                    <p className="text-[9px] text-teal-200/80 font-mono">DIRECT LINKS TO ALL GOOGLE SHEET TABS</p>
                  </div>
                </div>
                <span className="text-[9px] bg-teal-800 px-2 py-0.5 rounded text-teal-200 font-bold font-mono">
                  6 Sheets Connected
                </span>
              </div>

              <div className="p-3 space-y-2 text-xs">
                {[
                  { title: "Employee Directory", key: "Employee GID", gid: dbForm["Employee GID"] || "0", icon: Users, color: "text-blue-600 bg-blue-50 border-blue-100", desc: "Workforce records, designation, email, mobile & group tags" },
                  { title: "Settings & Configuration", key: "Settings GID", gid: dbForm["Settings GID"] || "1972051572", icon: Database, color: "text-purple-600 bg-purple-50 border-purple-100", desc: "Global parameters, organization profile & GID mapping" },
                  { title: "Course List", key: "Course GID", gid: dbForm["Course GID"] || "1120624852", icon: BookOpen, color: "text-emerald-600 bg-emerald-50 border-emerald-100", desc: "Micro-credentials courses, codes, pricing & workflow stages" },
                  { title: "MC Batch Records", key: "MC Batch GID", gid: dbForm["MC Batch GID"] || "1111164355", icon: Layers, color: "text-amber-600 bg-amber-50 border-amber-100", desc: "Batch schedules, enrollment capacity & instructor names" },
                  { title: "Documents Repository", key: "Documents GID", gid: dbForm["Documents GID"] || "732376789", icon: FileText, color: "text-rose-600 bg-rose-50 border-rose-100", desc: "Uploaded document logs, Drive file links & verification tags" },
                  { title: "Workflow Matrix", key: "Workflow GID", gid: dbForm["Workflow GID"] || "1686458334", icon: GitMerge, color: "text-cyan-600 bg-cyan-50 border-cyan-100", desc: "Workflow stages, milestone titles & approval steps" }
                ].map((sheet) => {
                  const Icon = sheet.icon;
                  const baseLink = dbForm["Google Sheet Link"] || "https://docs.google.com/spreadsheets/d/1zpDWjuTLdSIdZ8GCICEo6EFs962kAkBk1TpIPDvmZwc/edit";
                  const cleanBase = baseLink.split("#")[0];
                  const directUrl = `${cleanBase}#gid=${sheet.gid}`;

                  return (
                    <div key={sheet.key} className="flex items-center justify-between p-2.5 bg-gray-50/70 hover:bg-gray-50 rounded border border-gray-150 transition-colors gap-2">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className={cn("p-1.5 rounded border shrink-0 mt-0.5", sheet.color)}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900 text-xs truncate">{sheet.title}</span>
                            <span className="font-mono text-[9px] px-1.5 py-0.2 bg-gray-200/70 text-gray-700 rounded font-semibold shrink-0">
                              GID: {sheet.gid}
                            </span>
                          </div>
                          <p className="text-[10px] text-gray-500 truncate mt-0.5">{sheet.desc}</p>
                        </div>
                      </div>

                      <a
                        href={directUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-teal-50 text-teal-700 hover:text-teal-900 border border-gray-200 hover:border-teal-300 rounded text-[10px] font-bold transition-all shrink-0 shadow-sm"
                        title={`Open ${sheet.title} tab in Google Sheets`}
                      >
                        <span>Open Tab</span>
                        <ExternalLink className="w-3 h-3 text-teal-600" />
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Right Column (Instruction & Key short description guide) */}
          <div className="lg:col-span-7 space-y-3.5">
            
            {/* Guide & Instructions Card */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden flex flex-col h-fit">
              <div className="px-4 py-2 bg-slate-800 text-white flex items-center gap-2 shrink-0">
                <BookOpen className="w-4 h-4 text-slate-200" />
                <div>
                  <h3 className="text-xs font-bold tracking-wider uppercase">Instruction & Setup Guide</h3>
                  <p className="text-[9px] text-slate-300 font-mono">HOW TO CONFIGURE KEY PARAMETERS</p>
                </div>
              </div>

              {/* Instructions content - Very neat and compact */}
              <div className="p-3.5 space-y-3.5 text-xs text-gray-600">
                
                {/* DB Connection Instructions */}
                <div>
                  <h4 className="font-bold text-slate-800 text-xs border-b border-gray-100 pb-1 mb-2 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-slate-500" />
                    How to Setup your Google Sheet Database
                  </h4>
                  <ul className="space-y-1.5 text-[11px] list-none pl-0">
                    <li className="flex items-start gap-1.5">
                      <span className="text-teal-600 font-bold font-mono text-xs mt-0.5">1.</span>
                      <span><strong>Prepare Sheet Tabs:</strong> Ensure you have two sheets. One for the main <strong>Employee Directory</strong>, and another for global <strong>Settings</strong>.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-teal-600 font-bold font-mono text-xs mt-0.5">2.</span>
                      <span><strong>Obtain Sheet GIDs:</strong> Note the number at the end of the URL for each tab (e.g. <code>gid=0</code> or <code>gid=1972051572</code>). Insert these in the respective GID inputs.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-teal-600 font-bold font-mono text-xs mt-0.5">3.</span>
                      <span><strong>Deploy Apps Script API:</strong> Open extensions, create a script proxy that handles Google Sheet operations, and publish it as a Web App (Access: <em>Anyone</em>). Paste the executable URL in the API field.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-teal-600 font-bold font-mono text-xs mt-0.5">4.</span>
                      <span><strong>Set File Folder Location:</strong> Provide a custom folder name. Photos, log files, and logos will instantly structure within this designated folder in Google Drive.</span>
                    </li>
                  </ul>
                </div>

                {/* Key Meanings & Descriptions */}
                <div>
                  <h4 className="font-bold text-slate-800 text-xs border-b border-gray-100 pb-1 mb-2 flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
                    Setting Keys & Field Descriptions
                  </h4>
                  <div className="space-y-2.5 max-h-[290px] overflow-y-auto pr-1">
                    
                    <div className="bg-gray-50 p-2 rounded border border-gray-100">
                      <span className="font-semibold text-slate-800 text-[11px] block font-mono">Google Sheet Link</span>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        The web address of your master Google Sheet database. Copy the complete URL of your spreadsheet to enable quick administration links.
                      </p>
                    </div>

                    <div className="bg-gray-50 p-2 rounded border border-gray-100">
                      <span className="font-semibold text-slate-800 text-[11px] block font-mono">Apps Script API</span>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        The published web app URL generated from your Google Apps Script workspace. Acts as the primary secured driver for all CRUD data operations and direct files upload/deletion.
                      </p>
                    </div>

                    <div className="bg-gray-50 p-2 rounded border border-gray-100">
                      <span className="font-semibold text-slate-800 text-[11px] block font-mono">Settings GID</span>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        The unique numerical Sheet Tab GID specifically dedicated to managing global application metadata like Department, Org name, and Logo. (Default: <code>1972051572</code>).
                      </p>
                    </div>

                    <div className="bg-gray-50 p-2 rounded border border-gray-100">
                      <span className="font-semibold text-slate-800 text-[11px] block font-mono">Employee GID</span>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        The Sheet Tab GID holding the primary workforce profiles, designations, photo links, and qualification metrics. Typically the first sheet, mapped as GID <code>0</code>.
                      </p>
                    </div>

                    <div className="bg-gray-50 p-2 rounded border border-gray-100">
                      <span className="font-semibold text-slate-800 text-[11px] block font-mono">MC Batch GID</span>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        The Sheet Tab GID storing Micro-Credential batch schedules, enrollment quotas, start/end dates, and instructor details. (Default: <code>1111164355</code>).
                      </p>
                    </div>

                    <div className="bg-gray-50 p-2 rounded border border-gray-100">
                      <span className="font-semibold text-slate-800 text-[11px] block font-mono">Course GID</span>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        The Sheet Tab GID listing course codes, course titles, pricing, duration, and publishing workflow states. (Default: <code>1120624852</code>).
                      </p>
                    </div>

                    <div className="bg-gray-50 p-2 rounded border border-gray-100">
                      <span className="font-semibold text-slate-800 text-[11px] block font-mono">Documents GID</span>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        The Sheet Tab GID tracking document upload logs, drive file links, file types, and verification statuses. (Default: <code>732376789</code>).
                      </p>
                    </div>

                    <div className="bg-gray-50 p-2 rounded border border-gray-100">
                      <span className="font-semibold text-slate-800 text-[11px] block font-mono">Workflow GID</span>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        The Sheet Tab GID defining approval matrix steps, milestone titles, and workflow timeline configurations. (Default: <code>1686458334</code>).
                      </p>
                    </div>

                    <div className="bg-gray-50 p-2 rounded border border-gray-100">
                      <span className="font-semibold text-slate-800 text-[11px] block font-mono">Drive Location</span>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        The Google Drive Shared Folder link or Folder ID. If configured, all subfolders (specified in File Location) will be automatically created and stored inside this designated Google Drive folder. Make sure to share this folder as "Anyone with the link can edit" so that uploads work seamlessly.
                      </p>
                    </div>

                    <div className="bg-gray-50 p-2 rounded border border-gray-100">
                      <span className="font-semibold text-slate-800 text-[11px] block font-mono">File Location</span>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        The base folder name created in the administrator's Google Drive. The app automatically organizes directories (e.g. <code>[Folder]/Logo</code> and <code>[Folder]/Employees Photo</code>) directly underneath.
                      </p>
                    </div>

                    <div className="bg-gray-50 p-2 rounded border border-gray-100">
                      <span className="font-semibold text-slate-800 text-[11px] block font-mono">Department</span>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        The default operational branch of the current view (e.g., Mechanical Department, QA and Audits). Updates page subtitles and filter boundaries.
                      </p>
                    </div>

                    <div className="bg-gray-50 p-2 rounded border border-gray-100">
                      <span className="font-semibold text-slate-800 text-[11px] block font-mono">Organization</span>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        The primary company, business, or enterprise name. This name is stamped as the official branding on certificate exports, titles, and headers.
                      </p>
                    </div>

                    <div className="bg-gray-50 p-2 rounded border border-gray-100">
                      <span className="font-semibold text-slate-800 text-[11px] block font-mono">Logo URL</span>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        URL for the brand's logo image. Accepts generic internet image URLs or direct Google Drive shared links, serving as the official signature on document headers.
                      </p>
                    </div>

                  </div>
                </div>

              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}

