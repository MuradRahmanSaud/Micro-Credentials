import { Bell, HelpCircle, Loader2, Edit3, X, Upload, Check, RefreshCw } from "lucide-react";
import React, { useState, useRef, useEffect } from "react";
import axios from "axios";

import { FOLDER_LOCATIONS } from "../FolderLocation";
import { getDbOverridesHeaders } from "../lib/utils";

interface HeaderProps {
  activeTab?: string;
  settingsData?: any[];
  onSaveMultipleSettings?: (updates: { Title: string; Content: string }[]) => Promise<void>;
  onSyncAll?: () => Promise<void>;
  isSyncing?: boolean;
  onLogoClick?: () => void;
}

export default function Header({ settingsData = [], onSaveMultipleSettings, onSyncAll, isSyncing = false, onLogoClick }: HeaderProps) {
  // Find settings or fallback to defaults
  const departmentSetting = settingsData?.find((r: any) => r.Title === "Department");
  const organizationSetting = settingsData?.find((r: any) => r.Title === "Organization");
  const logoSetting = settingsData?.find((r: any) => r.Title === "Logo");

  // Fallbacks: If not in DB, use "Department" and "Organization", and Logo is empty/blank
  const displayDepartment = (departmentSetting?.Content && departmentSetting.Content.trim() !== "") 
    ? departmentSetting.Content 
    : "Department";

  const displayOrganization = (organizationSetting?.Content && organizationSetting.Content.trim() !== "") 
    ? organizationSetting.Content 
    : "Organization";

  const displayLogo = (logoSetting?.Content && logoSetting.Content.trim() !== "") 
    ? logoSetting.Content 
    : "";

  const [isEditing, setIsEditing] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // In-place inline edit temp states
  const [tempLogo, setTempLogo] = useState(displayLogo);
  const [tempDepartment, setTempDepartment] = useState(displayDepartment);
  const [tempOrganization, setTempOrganization] = useState(displayOrganization);

  // Selected file and local preview URL state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync temp states with real data when NOT editing or when props change
  useEffect(() => {
    if (!isEditing) {
      setTempLogo(displayLogo);
      setTempDepartment(displayDepartment);
      setTempOrganization(displayOrganization);
      setSelectedFile(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl("");
      }
    }
  }, [isEditing, displayLogo, displayDepartment, displayOrganization]);

  // Clean up preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleLogoClick = () => {
    if (isEditing && !isUploadingLogo && !isSaving) {
      fileInputRef.current?.click();
    } else if (!isEditing && onLogoClick) {
      onLogoClick();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    const newPreviewUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewUrl(newPreviewUrl);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSaveInline = async () => {
    setIsSaving(true);
    let finalLogoUrl = tempLogo;

    try {
      // If a file was selected, upload it now
      if (selectedFile) {
        setIsUploadingLogo(true);
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("folderPath", FOLDER_LOCATIONS.LOGO);
        formData.append("departmentName", tempDepartment);

        const response = await axios.post("/api/upload", formData, {
          headers: { 
            "Content-Type": "multipart/form-data",
            ...getDbOverridesHeaders()
          }
        });

        if (response.data && response.data.url) {
          finalLogoUrl = response.data.url;
          setTempLogo(finalLogoUrl);
        } else {
          throw new Error("Failed to get uploaded logo URL");
        }
      }

      const updates = [
        { Title: "Logo", Content: finalLogoUrl },
        { Title: "Department", Content: tempDepartment },
        { Title: "Organization", Content: tempOrganization }
      ];

      if (onSaveMultipleSettings) {
        await onSaveMultipleSettings(updates);
      }

      // Clean up selected file state
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setSelectedFile(null);
      setPreviewUrl("");
      setIsEditing(false);
    } catch (error) {
      console.error("Error saving header changes:", error);
      alert("Failed to save changes. Please try again.");
    } finally {
      setIsUploadingLogo(false);
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl("");
    setTempLogo(displayLogo);
    setTempDepartment(displayDepartment);
    setTempOrganization(displayOrganization);
    setIsEditing(false);
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
    <header className="h-14 bg-teal-900 flex items-center justify-between px-4 shrink-0 z-20 shadow-md border-b border-teal-800/50">
      <div className="flex items-center gap-4 flex-1">
        {/* Hidden Input File for Logo upload */}
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          accept="image/*" 
          className="hidden" 
        />

        {/* Logo Container: Clickable in edit mode */}
        <div 
          onClick={handleLogoClick}
          className={`w-10 h-10 rounded flex items-center justify-center overflow-hidden relative shadow-inner p-1 transition-all group cursor-pointer ${
            isEditing 
              ? "ring-2 ring-amber-400 bg-teal-950 border border-amber-300 hover:scale-105" 
              : "bg-white/10 border border-white/10 hover:bg-white/20 hover:scale-105"
          }`}
          title={isEditing ? "Click to upload a new logo" : "Click to toggle sidebar"}
        >
          {isUploadingLogo ? (
            <div className="absolute inset-0 bg-teal-950/80 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
            </div>
          ) : (
            <>
              {getDisplayUrl(isEditing ? (previewUrl || tempLogo) : displayLogo) ? (
                <img 
                  src={getDisplayUrl(isEditing ? (previewUrl || tempLogo) : displayLogo)} 
                  alt="Logo" 
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] text-teal-300/40 font-semibold select-none leading-none text-center">
                  No Logo
                </div>
              )}
              {isEditing && (
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Upload className="w-4 h-4 text-white" />
                </div>
              )}
            </>
          )}
        </div>

        {/* Brand Text Section: Plain labels or Inline Inputs */}
        <div className="flex flex-col flex-1 max-w-xl">
          {isEditing ? (
            <div className="flex flex-col gap-1">
              <input
                type="text"
                value={tempDepartment}
                onChange={(e) => setTempDepartment(e.target.value)}
                disabled={isSaving}
                className="bg-teal-950/60 text-white font-bold px-2 py-0.5 rounded text-xs outline-none border border-amber-500/50 w-full max-w-md focus:border-amber-400 uppercase tracking-tight"
                placeholder="Department Name"
                autoFocus
              />
              <input
                type="text"
                value={tempOrganization}
                onChange={(e) => setTempOrganization(e.target.value)}
                disabled={isSaving}
                className="bg-teal-950/40 text-teal-100 px-2 py-0.5 rounded text-[10px] font-medium outline-none border border-teal-600/50 w-full max-w-md focus:border-amber-400 uppercase tracking-wider"
                placeholder="Organization Name"
              />
            </div>
          ) : (
            <div className="flex flex-col">
              <div className="text-sm font-bold text-white tracking-tight leading-none uppercase">
                {displayDepartment}
              </div>
              <div className="text-[10px] text-teal-50/80 font-medium tracking-wider uppercase mt-0.5 leading-none">
                {displayOrganization}
              </div>
            </div>
          )}
        </div>
        
        <div className="h-6 w-px bg-white/10 mx-2 hidden sm:block" />
      </div>
      
      {/* Action Controls */}
      <div className="flex items-center gap-2 shrink-0">
        {isEditing ? (
          <div className="flex items-center gap-1.5 bg-teal-950/40 p-1 rounded-md border border-teal-800/40">
            {/* Cancel Button */}
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="p-1.5 text-red-200 hover:text-white hover:bg-red-500/20 rounded transition-all cursor-pointer border-none outline-none bg-transparent"
              title="Cancel editing"
            >
              <X className="w-4 h-4" />
            </button>
            {/* Save Button */}
            <button
              onClick={handleSaveInline}
              disabled={isSaving || isUploadingLogo}
              className="p-1.5 text-emerald-200 hover:text-white hover:bg-emerald-500/20 rounded transition-all cursor-pointer border-none outline-none bg-transparent flex items-center justify-center"
              title="Save changes"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
              ) : (
                <Check className="w-4 h-4" />
              )}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            {/* Sync All Button */}
            <button
              onClick={onSyncAll}
              disabled={isSyncing}
              className={`p-1.5 text-teal-50/70 hover:text-white hover:bg-white/10 rounded-md transition-all cursor-pointer border-none outline-none bg-transparent flex items-center justify-center ${isSyncing ? "text-amber-400" : ""}`}
              title="Sync all data"
              id="header-sync-btn"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin text-amber-400" : ""}`} />
            </button>

            {/* Edit Header Button - beside Sync button */}
            <button 
              onClick={() => setIsEditing(true)}
              className="p-1.5 text-teal-50/70 hover:text-white hover:bg-white/10 rounded-md transition-all cursor-pointer border-none outline-none" 
              title="Edit Header details"
              id="header-edit-btn"
            >
              <Edit3 className="w-4 h-4" />
            </button>
          </div>
        )}

        <button className="p-1.5 text-teal-50/70 hover:text-white hover:bg-white/10 rounded-md transition-all cursor-pointer border-none outline-none" title="Notifications">
          <Bell className="w-4 h-4" />
        </button>
        
        <button className="p-1.5 text-teal-50/70 hover:text-white hover:bg-white/10 rounded-md transition-all cursor-pointer border-none outline-none" title="Help">
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
