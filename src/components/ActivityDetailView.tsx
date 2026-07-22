import React from "react";
import { motion } from "motion/react";
import { 
  User, 
  Layers, 
  Calendar, 
  Clock, 
  ClipboardList, 
  CheckCircle2, 
  FileText, 
  CheckSquare, 
  ShieldCheck, 
  BookOpen, 
  Bookmark,
  X,
  Eye,
  Upload,
  Loader2
} from "lucide-react";
import { cn } from "../lib/utils";
import axios from "axios";
import { FOLDER_LOCATIONS } from "../FolderLocation";

interface ActivityDetailViewProps {
  selectedActivity: any;
  allActivities?: any[];
  courseData?: any[];
  onClose?: () => void;
  documents?: any[];
  onSaveDocument?: (formData: any, editingRow: any | null) => Promise<void>;
  onViewFile?: (url: string, title: string) => void;
}

const getThumbnail = (photoUrl: string) => {
  if (!photoUrl) return "";
  const fileIdMatch = photoUrl.match(/[-\w]{25,}/);
  if (fileIdMatch) {
    return `https://drive.google.com/thumbnail?id=${fileIdMatch[0]}&sz=w200`;
  }
  return photoUrl;
};

const getBannerUrl = (url: any) => {
  if (!url || typeof url !== "string") return "";
  if (url.includes("drive.google.com/uc") && url.includes("id=")) {
    try {
      const id = new URL(url).searchParams.get("id");
      return `https://drive.google.com/thumbnail?id=${id}&sz=w1000`;
    } catch (e) {
      return url;
    }
  }
  const fileIdMatch = url.match(/[-\w]{25,}/);
  if (fileIdMatch && url.includes('drive.google.com')) {
    return `https://drive.google.com/thumbnail?id=${fileIdMatch[0]}&sz=w1000`;
  }
  return url;
};

const getDocStatus = (doc: any) => {
  const tag = String(doc["Tag"] || doc["Status"] || "");
  if (tag.includes("Revision Required") || tag.includes("Revision")) {
    return { text: "Revision", color: "bg-amber-100 text-amber-800 border-amber-200" };
  }
  if (tag.includes("Verified") || tag.includes("Job Done") || tag.includes("Approved")) {
    return { text: "Verified", color: "bg-emerald-100 text-emerald-800 border-emerald-200" };
  }
  return { text: "Review", color: "bg-teal-100 text-teal-800 border-teal-200" };
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

const formatDateMmmDDYYYY = (dateStr: string) => {
  if (!dateStr || dateStr === "-") return "-";
  const ymdMatch = dateStr.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1; // 0-based
    const day = parseInt(ymdMatch[3], 10);
    const date = new Date(year, month, day);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  }
  
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return dateStr;
  }
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
};

export const ActivityDetailView: React.FC<ActivityDetailViewProps> = ({ 
  selectedActivity, 
  allActivities,
  courseData,
  onClose,
  documents,
  onSaveDocument,
  onViewFile
}) => {
  const isCourse = selectedActivity["Type"] === "Course";
  const status = getDeadlineStatus(selectedActivity["deadlineRaw"]);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadingDeliv, setUploadingDeliv] = React.useState<string | null>(null);

  const diffDays = React.useMemo(() => {
    const deadlineStr = selectedActivity["deadlineRaw"];
    if (!deadlineStr || deadlineStr === "-") return null;
    const target = new Date(deadlineStr);
    if (isNaN(target.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    const diffTime = target.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }, [selectedActivity]);

  // Find course to get banner
  const course = React.useMemo(() => {
    if (!courseData || !selectedActivity) return null;
    const code = selectedActivity["Code"];
    return courseData.find(c => String(c["Course Code"] || "").trim().toLowerCase() === String(code || "").trim().toLowerCase());
  }, [courseData, selectedActivity]);

  const bannerUrl = course ? course["Banner"] : "";

  // Find all matching activities in the same merged group
  const matchingActivities = React.useMemo(() => {
    if (!allActivities || !selectedActivity) return [selectedActivity];
    const type = selectedActivity["Type"];
    const code = selectedActivity["Code"];
    const batch = selectedActivity["Batch Number"];
    const stage = selectedActivity["_stageName"];
    return allActivities.filter(
      (act) => act["Type"] === type && act["Code"] === code && act["Batch Number"] === batch && act["_stageName"] === stage
    );
  }, [allActivities, selectedActivity]);

  const assignedEmployees = React.useMemo(() => {
    const list: any[] = [];
    const seenIds = new Set<string>();
    
    matchingActivities.forEach((act) => {
      const empId = act["Employee ID"];
      if (empId && !seenIds.has(empId)) {
        seenIds.add(empId);
        list.push({
          id: empId,
          name: act["Employee Name"],
          designation: act["Designation"],
          photo: act["Photo"]
        });
      }
    });
    return list;
  }, [matchingActivities]);
  
  // Parse tasks list
  const tasks = Array.isArray(selectedActivity["tasksList"]) && selectedActivity["tasksList"].length > 0
    ? selectedActivity["tasksList"]
    : typeof selectedActivity["Key Tasks"] === "string" && selectedActivity["Key Tasks"] !== "N/A"
      ? selectedActivity["Key Tasks"].split(',').map((t: string) => t.trim()).filter(Boolean)
      : [];

  // Parse deliverables list
  const deliverables = Array.isArray(selectedActivity["deliverablesList"]) && selectedActivity["deliverablesList"].length > 0
    ? selectedActivity["deliverablesList"]
    : typeof selectedActivity["_deliverables"] === "string" && selectedActivity["_deliverables"] !== "N/A"
      ? selectedActivity["_deliverables"].split(',').map((d: string) => d.trim()).filter(Boolean)
      : [];

  const courseCode = selectedActivity["Course Code"] || selectedActivity["Code"] || "N/A";
  const batchNumber = selectedActivity["Type"] === "Batch" ? selectedActivity["Batch Number"] : null;
  
  // Explicitly handle title for Batch
  const courseTitle = selectedActivity["Type"] === "Batch"
    ? (course ? course["Course Title"] : (selectedActivity["Course Title"] || selectedActivity["Name"] || ""))
    : (selectedActivity["Course Title"] || selectedActivity["Name"] || "");

  const empId = selectedActivity["Employee ID"] || "GENERAL";
  const batchInfo = selectedActivity["Type"] === "Batch" && selectedActivity["Batch Number"] ? `Batch ${selectedActivity["Batch Number"]}` : "Course";
  const cleanStageName = selectedActivity["_actualStageName"] || "";

  const getUploadedDocForDeliverable = (deliv: string) => {
    if (!documents) return null;
    const expectedTitle = `${courseCode} - ${batchInfo} - EMP ${empId} - ${cleanStageName} - ${deliv}`.toUpperCase();
    return documents.find(doc => {
      const title = String(doc["Documents Title"] || doc["Document Name"] || doc["Title"] || "").toUpperCase();
      return title === expectedTitle || (title.includes(courseCode.toUpperCase()) && title.includes(empId.toUpperCase()) && title.includes(cleanStageName.toUpperCase()) && title.includes(deliv.toUpperCase()));
    });
  };

  const triggerUploadFor = (deliv: string) => {
    setUploadingDeliv(deliv);
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 50);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingDeliv) return;

    setIsUploading(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append("file", file);
      formDataUpload.append("folderPath", FOLDER_LOCATIONS.DOCUMENTS);

      const response = await axios.post("/api/upload", formDataUpload);
      let viewUrl = response.data.url || response.data.fileLink;

      if (!viewUrl) {
        throw new Error("No URL returned from server upload response");
      }

      if (viewUrl.includes("drive.google.com/uc") || viewUrl.includes("export=download")) {
        const fileIdMatch = viewUrl.match(/[?&]id=([^&]+)/);
        if (fileIdMatch && fileIdMatch[1]) {
          viewUrl = `https://drive.google.com/file/d/${fileIdMatch[1]}/view`;
        }
      }

      const generatedTitle = `${courseCode} - ${batchInfo} - Emp ${empId} - ${cleanStageName} - ${uploadingDeliv}`.toUpperCase();

      const existingDoc = getUploadedDocForDeliverable(uploadingDeliv);

      const newDoc = {
        "Date": new Date().toISOString().split('T')[0],
        "Documents Title": generatedTitle,
        "File Link": viewUrl,
        "Tag": `${courseCode}, ${selectedActivity["workflowTitle"] || ""}, ${selectedActivity["_stageName"] || ""}, Emp: ${empId}`,
        "Course Code": courseCode,
        "Course Name": courseTitle
      };

      if (onSaveDocument) {
        await onSaveDocument(newDoc, existingDoc || null);
      }
    } catch (err: any) {
      console.error("File upload failed:", err);
      const errorMessage = err.response?.data?.details || err.response?.data?.error || err.message || "Please try again.";
      alert("File upload failed: " + errorMessage);
    } finally {
      setIsUploading(false);
      setUploadingDeliv(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: "24rem", opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ type: "spring", damping: 30, stiffness: 300 }}
      className="relative h-full flex flex-col border border-gray-200 shadow-sm rounded-xl select-none bg-white overflow-hidden shrink-0 ml-4"
    >
      <div className="w-96 h-full flex flex-col overflow-hidden">
        {/* 1. Course Banner (with Course Title and Course Code inside) */}
        <div className="relative w-full h-44 bg-teal-900 shrink-0 overflow-hidden mb-3">
        {bannerUrl ? (
          <img
            src={getBannerUrl(bannerUrl)}
            alt="Course Banner"
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-teal-800 to-teal-700" />
        )}
        
        {/* Dark gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />

        {/* Top Right Close Button */}
        {onClose && (
          <div className="absolute top-2.5 right-2.5 z-20">
            <button 
              onClick={onClose} 
              className="p-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-xs transition-colors border border-white/10 cursor-pointer shadow-sm flex items-center justify-center"
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Bottom content inside the banner: Course Title & Course Code */}
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3 z-10">
          <div className="flex flex-col items-start text-left min-w-0">
            <h3 className="text-sm font-bold text-white leading-snug tracking-wide line-clamp-2 drop-shadow-md uppercase">
              {courseTitle}
            </h3>
            <div className="flex gap-1.5 mt-1.5">
              {courseCode !== "N/A" && (
                <span className="text-[9px] font-bold text-teal-200 bg-teal-950/80 px-2 py-0.5 rounded-md border border-teal-500/30 uppercase tracking-wider font-mono">
                  {courseCode}
                </span>
              )}
              {selectedActivity["Type"] === "Batch" && (
                <span className="text-[9px] font-bold text-teal-200 bg-teal-950/80 px-2 py-0.5 rounded-md border border-teal-500/30 uppercase tracking-wider font-mono">
                  Batch {batchNumber}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>



      {/* Main details body */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-3.5 space-y-4">
        
        {/* Bordered Container */}
        <div className="relative border border-gray-200 rounded-xl p-4 pt-6 pb-6 mt-2">
          
          {/* Stage Badge on Top Border */}
          {selectedActivity["_actualStageName"] && (
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-teal-50 text-teal-800 border border-teal-200 px-5 py-1.5 rounded-full shadow-sm w-[92%] text-center whitespace-normal break-words z-10">
              <span className="text-[11.5px] font-bold uppercase tracking-wider block leading-normal">
                {selectedActivity["_actualStageName"]}
              </span>
            </div>
          )}

          <div className="space-y-3">
            {/* Key Tasks */}
            <div className="space-y-1">
    
              {tasks.length > 0 ? (
                <div className="space-y-2 px-1">
                  {tasks.map((task: string, idx: number) => (
                    <div key={idx} className="flex items-start gap-2">
                      <p className="text-[11.5px] text-slate-700 font-semibold leading-relaxed text-justify w-full break-words">{task}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-[11px] text-slate-400 italic py-1">
                  No explicit key tasks specified.
                </div>
              )}
            </div>
    
            {/* Deliverables Card (containing Assign Date, Deadline, Days Left and Deliverables list) */}
            <div className="relative border border-gray-200 rounded-xl p-4 pt-8 mt-6 bg-slate-50/30">
              
              {/* Deliverables Title Badge on Top Border */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white text-teal-800 border border-teal-200 px-4 py-1 rounded-full shadow-xs text-[11px] font-bold uppercase tracking-wider whitespace-nowrap z-10">
                Deliverables {deliverables.length > 0 ? `(${deliverables.length})` : ""}
              </div>

              {/* Row 1: Assigned Date (left) & Deadline (right) */}
              <div className="flex justify-between items-center mb-3">
                <div className="flex flex-col text-left">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Assigned Date</span>
                  <span className="text-[11px] font-mono font-bold text-slate-700">
                    {formatDateMmmDDYYYY(selectedActivity["assignedDateRaw"])}
                  </span>
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Deadline</span>
                  <span className="text-[11px] font-mono font-bold text-slate-700">
                    {formatDateMmmDDYYYY(selectedActivity["deadlineRaw"])}
                  </span>
                </div>
              </div>

              {/* Row 2: Day Left (negative displays negative sign) */}
              <div className="text-center border-t border-b border-gray-200/50 py-2.5 mb-4 bg-white/40 rounded-lg">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Day Left</span>
                <span className={cn(
                  "text-xl font-extrabold tracking-tight mt-0.5 block",
                  diffDays !== null && diffDays < 0 ? "text-rose-600" :
                  diffDays !== null && diffDays <= 3 ? "text-amber-600" : "text-emerald-600"
                )}>
                  {diffDays !== null ? `${diffDays} days` : "N/A"}
                </span>
              </div>

              {/* Row 3: Deliverables Items Header & List */}
              <div className="space-y-2 mt-2 pt-2 border-t border-gray-200/60">
                <div className="flex items-center justify-between gap-2 px-1">
                  <div className="flex items-center gap-1.5 text-teal-800 font-bold text-[11px] uppercase tracking-wider">
                    <Upload className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                    <span>Deliverable Submission</span>
                  </div>
                </div>

                {deliverables.length > 0 ? (
                  <div className="flex flex-col gap-3 pt-2">
                    {deliverables.map((deliv: string, idx: number) => {
                      const doc = getUploadedDocForDeliverable(deliv);
                      const isItemUploading = isUploading && uploadingDeliv === deliv;
                      const docStatus = doc ? getDocStatus(doc) : null;
                      
                      return (
                        <div 
                          key={idx} 
                          className={cn(
                            "border rounded-lg p-2.5 pt-3 flex items-center justify-between gap-2 shadow-2xs transition-all relative group select-none w-full",
                            doc 
                              ? "bg-teal-50/40 border-teal-200 text-teal-950" 
                              : "bg-white border-dashed border-slate-300 hover:border-teal-500 hover:bg-teal-50/20 text-slate-700 cursor-pointer"
                          )}
                          onClick={() => {
                            if (!doc && !isItemUploading) {
                              triggerUploadFor(deliv);
                            }
                          }}
                        >
                          {doc && docStatus && (
                            <span className={cn("absolute -top-2.5 right-3 text-[9px] px-2 py-0.5 rounded-full font-bold border tracking-wider uppercase shadow-2xs whitespace-nowrap z-10", docStatus.color)}>
                              {docStatus.text}
                            </span>
                          )}

                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            {isItemUploading ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600 shrink-0" />
                            ) : (
                              <CheckSquare className={cn("w-3.5 h-3.5 shrink-0", doc ? "text-teal-600" : "text-gray-400")} />
                            )}
                            
                            <span className="text-[11.5px] font-bold leading-snug break-words" title={deliv}>
                              {deliv}
                            </span>
                          </div>

                          {!isItemUploading && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              {doc ? (
                                <>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (onViewFile && doc["File Link"]) {
                                        onViewFile(doc["File Link"], doc["Documents Title"]);
                                      }
                                    }}
                                    className="p-1 hover:bg-teal-100/80 rounded text-teal-700 cursor-pointer transition-colors"
                                    title="View Uploaded Document"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>

                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      triggerUploadFor(deliv);
                                    }}
                                    className="p-1 hover:bg-teal-100/80 rounded text-teal-700 cursor-pointer transition-colors"
                                    title="Re-upload Deliverable File"
                                  >
                                    <Upload className="w-3.5 h-3.5 text-teal-600" />
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    triggerUploadFor(deliv);
                                  }}
                                  className="flex items-center gap-1 text-[10px] font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200/80 px-2.5 py-1 rounded-md transition-colors cursor-pointer shadow-2xs"
                                  title="Click to Submit Deliverable File"
                                >
                                  <Upload className="w-3 h-3 text-teal-600 shrink-0" />
                                  <span>Submit File</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center text-[11px] text-slate-400 italic py-1">
                    No deliverables assigned.
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* Sign-off Authority Badge on Bottom Border of the Main Stage Card */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 bg-white text-teal-800 border border-teal-200 px-4 py-1 rounded-full shadow-xs text-[11px] font-bold uppercase tracking-wider whitespace-nowrap z-10 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-600 shrink-0" />
            <span className="text-slate-400 normal-case">Approved By:</span>
            <span>{selectedActivity["Approval / Sign-off"] || "N/A"}</span>
          </div>

        </div>

      </div>
      
      {/* Hidden File Input for Deliverables Upload */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.zip"
      />
    </div>
  </motion.div>
  );
};
