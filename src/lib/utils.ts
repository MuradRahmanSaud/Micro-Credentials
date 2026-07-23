import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function resolveNamesOrIdsToIds(valueStr: string, employees: any[]): string[] {
  if (!valueStr) return [];
  const parts = valueStr.split(',').map(p => p.trim()).filter(Boolean);
  return parts.map(part => {
    // Try matching ID
    const foundById = employees.find(e => String(e['Employee ID'] || '').trim() === part);
    if (foundById) return String(foundById['Employee ID']);

    // Try matching Name
    const foundByName = employees.find(e => String(e['Employee Name'] || '').trim().toLowerCase() === part.toLowerCase());
    if (foundByName) return String(foundByName['Employee ID']);

    return part; // fallback
  }).filter(Boolean);
}

export function resolveIdsToNames(ids: string[], employees: any[]): string {
  if (!ids || ids.length === 0) return '';
  return ids.map(id => {
    const emp = employees.find(e => String(e['Employee ID'] || '').trim() === String(id).trim());
    return emp ? String(emp['Employee Name']).trim() : id;
  }).filter(Boolean).join(', ');
}

export async function compressImage(file: File, maxWidth = 400): Promise<File> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      return resolve(file);
    }
    const reader = new FileReader();
    reader.onload = event => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(file);
        
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(blob => {
          if (!blob) return resolve(file);
          // Always upload as JPEG to save space
          const newName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
          resolve(new File([blob], newName, { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.7);
      };
      img.onerror = () => resolve(file);
      img.src = event.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

export function extractFolderId(input: string): string {
  if (!input) return "";
  const match = input.match(/\/folders\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  // If it's not a URL, assume it's already a raw folder ID and return it trimmed
  if (!input.includes("/")) {
    return input.trim();
  }
  return "";
}

export function getDbOverridesHeaders(): Record<string, string> {
  try {
    const saved = localStorage.getItem("settings_data");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        const link = parsed.find((r: any) => r.Title === "Google Sheet Link")?.Content || "";
        const api = parsed.find((r: any) => r.Title === "Apps Script API")?.Content || "";
        const driveLoc = parsed.find((r: any) => r.Title === "Drive Location")?.Content || "";
        
        let spreadsheetId = "";
        if (link) {
          const match = link.match(/\/d\/([a-zA-Z0-9-_]+)/);
          if (match) {
            spreadsheetId = match[1];
          }
        }
        
        const folderId = extractFolderId(driveLoc);
        
        const headers: Record<string, string> = {};
        if (spreadsheetId) headers["x-spreadsheet-id"] = spreadsheetId;
        if (api) headers["x-apps-script-url"] = api;
        if (folderId) headers["x-drive-folder-id"] = folderId;
        return headers;
      }
    }
  } catch (e) {}
  return {};
}

export function formatToMmmDdYyyy(val: any): string {
  if (val == null || typeof val === "number" || typeof val === "boolean") {
    return String(val ?? "");
  }
  const str = String(val).trim();
  if (!str) return "";

  // Check if it strictly matches YYYY-MM-DD or YYYY/MM/DD
  const matchYmd = str.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/);
  if (matchYmd) {
    const year = parseInt(matchYmd[1], 10);
    const month = parseInt(matchYmd[2], 10) - 1; // 0-indexed
    const day = parseInt(matchYmd[3], 10);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    if (month >= 0 && month < 12 && day >= 1 && day <= 31 && year >= 1970 && year <= 2100) {
      const monthStr = months[month];
      const dayStr = String(day).padStart(2, '0');
      return `${monthStr} ${dayStr}, ${year}`;
    }
  }

  // Check if it matches ISO date time or timestamp
  const timestamp = Date.parse(str);
  if (!isNaN(timestamp)) {
    // Only format strings that have standard separators to avoid treating random words as dates
    const hasSeparators = /[-/.]/.test(str) || /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i.test(str);
    if (hasSeparators) {
      try {
        const d = new Date(timestamp);
        const year = d.getFullYear();
        if (year >= 1970 && year <= 2100) {
          const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          const monthStr = months[d.getMonth()];
          const dayStr = String(d.getDate()).padStart(2, '0');
          return `${monthStr} ${dayStr}, ${year}`;
        }
      } catch (e) {}
    }
  }

  return str;
}

export function isBatchRunning(batch: any): boolean {
  if (!batch) return false;
  const endStr = batch["End Date"];
  if (!endStr || String(endStr).trim() === "") return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const endTimestamp = Date.parse(String(endStr).trim());
  if (isNaN(endTimestamp)) return false;
  const endDate = new Date(endTimestamp);
  endDate.setHours(23, 59, 59, 999);

  return today <= endDate;
}

export function getCourseStatusName(
  course: any,
  documentsData: any[] = [],
  workflowData: any[] = []
): string {
  if (!course) return "N/A";

  const workflowStr = course["Workflow"] || course["Publication Workflow"] || "";
  const rawStatus = String(course["Status"] || "").trim();

  let totalStages = 10;
  let stageList: Array<{ id: string; name: string; deliverables: string[] }> = [];

  if (workflowStr) {
    const { jobTitle, stageAssignments } = parseWorkflowAndStages(workflowStr);
    
    const workflowDef = workflowData.find(w => {
      const parsed = parseWorkflowTitle(w["Workflow Title"], w.id);
      return parsed.id === jobTitle || parsed.title.trim().toLowerCase() === jobTitle.trim().toLowerCase();
    });

    const { stages: structuredStages } = workflowDef 
      ? parseWorkflowTitle(workflowDef["Workflow Title"], workflowDef.id) 
      : parseWorkflowTitle(workflowStr);

    if (structuredStages && structuredStages.length > 0) {
      totalStages = structuredStages.length;
      stageList = structuredStages.map(s => ({
        id: s.id,
        name: s.stageName.replace(/^\d+\.\s*/, '').trim(),
        deliverables: s.deliverables || []
      }));
    } else {
      const assignedKeys = Object.keys(stageAssignments);
      if (assignedKeys.length > 0) {
        totalStages = assignedKeys.length;
        stageList = assignedKeys.map(k => ({
          id: k,
          name: k.replace(/^\d+\.\s*/, '').trim(),
          deliverables: []
        }));
      }
    }
  }

  if (totalStages <= 0) totalStages = 10;

  const courseCode = String(course["Course Code"] || "").trim().toUpperCase();
  const courseTitle = String(course["Course Title"] || course["Name"] || "").trim().toUpperCase();

  // Count Verified stages from uploaded/reviewed documents
  let verifiedStagesCount = 0;

  if (stageList.length > 0) {
    stageList.forEach(stage => {
      const normStage = stage.name.toUpperCase();
      const stageDelivs = stage.deliverables.map(d => d.trim().toUpperCase()).filter(Boolean);

      const isStageVerified = documentsData.some(doc => {
        const tag = String(doc["Tag"] || "").toUpperCase();
        const status = String(doc["Status"] || "").toUpperCase();
        const title = String(doc["Documents Title"] || doc["Title"] || "").toUpperCase();

        const isVerified = 
          tag.includes("VERIFIED") || 
          tag.includes("JOB DONE") || 
          tag.includes("APPROVED") || 
          status.includes("VERIFIED") || 
          status.includes("JOB DONE") || 
          status.includes("APPROVED");

        if (!isVerified) return false;

        // Check course code / title match
        const docCourseCode = String(doc["Course Code"] || "").toUpperCase();
        const docCourseName = String(doc["Course Name"] || "").toUpperCase();
        const matchesCourse = 
          !courseCode || 
          docCourseCode === courseCode || 
          tag.includes(courseCode) || 
          title.includes(courseCode) ||
          (courseTitle && (docCourseName.includes(courseTitle) || tag.includes(courseTitle)));

        if (!matchesCourse) return false;

        // Check stage name or deliverable match
        const matchesStage = 
          (normStage && (tag.includes(normStage) || title.includes(normStage))) ||
          stageDelivs.some(d => title.includes(d) || tag.includes(d));

        return matchesStage;
      });

      if (isStageVerified) {
        verifiedStagesCount++;
      }
    });
  } else {
    // If no stage list parsed, count unique verified stage documents for this course
    const verifiedDocs = documentsData.filter(doc => {
      const tag = String(doc["Tag"] || "").toUpperCase();
      const status = String(doc["Status"] || "").toUpperCase();
      const title = String(doc["Documents Title"] || doc["Title"] || "").toUpperCase();

      const isVerified = 
        tag.includes("VERIFIED") || 
        tag.includes("JOB DONE") || 
        tag.includes("APPROVED") || 
        status.includes("VERIFIED") || 
        status.includes("JOB DONE") || 
        status.includes("APPROVED");

      if (!isVerified) return false;

      const docCourseCode = String(doc["Course Code"] || "").toUpperCase();
      const docCourseName = String(doc["Course Name"] || "").toUpperCase();
      return !courseCode || docCourseCode === courseCode || tag.includes(courseCode) || title.includes(courseCode) || (courseTitle && (docCourseName.includes(courseTitle) || tag.includes(courseTitle)));
    });

    verifiedStagesCount = verifiedDocs.length;
  }

  if (verifiedStagesCount > 0) {
    const completePercentage = Math.min(100, Math.round((verifiedStagesCount / totalStages) * 100));
    return `${completePercentage}%`;
  }

  // Fallback if no verified documents yet
  if (rawStatus.endsWith("%")) {
    const parsedVal = parseInt(rawStatus, 10);
    if (!isNaN(parsedVal)) {
      return `${parsedVal}%`;
    }
  }

  // If 0 stages verified so far, 0% complete
  return "0%";
}

export function parseWorkflowAndStages(workflowStr: string) {
  if (!workflowStr) return { jobTitle: '', stageAssignments: {} as Record<string, string[]> };
  
  const match = workflowStr.match(/^(.*?)\s*\{(.*?)\}$/);
  if (match) {
    const jobTitle = match[1].trim();
    const stagesPart = match[2].trim();
    const stageAssignments: Record<string, string[]> = {};
    
    // Split stages by ';'
    const parts = stagesPart.split(/\s*;\s*/);
    
    parts.forEach(part => {
      const idx = part.indexOf(':');
      if (idx !== -1) {
        const stageId = part.substring(0, idx).trim();
        const idsStr = part.substring(idx + 1).trim();
        
        // Split employees by ','
        const rawIds = idsStr ? idsStr.split(/\s*,\s*/).map(s => s.trim()) : [];
        
        // Normalize employee id strings to: EmpId|Date|Deadline
        const ids = rawIds.map(id => {
          const parts = id.split('|');
          const empId = parts[0] || '';
          const assignedDate = parts[1] || '';
          const deadline = parts[2] || '';
          return `${empId}|${assignedDate}|${deadline}`;
        });
        
        if (stageId) {
          stageAssignments[stageId] = ids;
        }
      }
    });
    
    return { jobTitle, stageAssignments };
  }
  
  return { jobTitle: workflowStr.trim(), stageAssignments: {} as Record<string, string[]> };
}

export function serializeWorkflowAndStages(jobTitle: string, stageAssignments: Record<string, string[]>) {
  const parts: string[] = [];
  Object.entries(stageAssignments).forEach(([stageId, ids]) => {
    if (ids && ids.length > 0) {
      // The ids are already formatted as "empId|date|deadline"
      parts.push(`${stageId}:${ids.join(', ')}`);
    }
  });
  
  if (parts.length === 0) return jobTitle;
  return `${jobTitle} {${parts.join('; ')}}`;
}

export function getStageAssignment(assignments: Record<string, string[]>, name: string): string[] {
  if (!assignments) return [];
  if (assignments[name]) return assignments[name];
  const cleanName = name.replace(/^\d+\.\s*/, '').trim();
  const matchingKey = Object.keys(assignments).find(key => {
    const cleanKey = key.replace(/^\d+\.\s*/, '').trim();
    return cleanKey.toLowerCase() === cleanName.toLowerCase();
  });
  return matchingKey ? assignments[matchingKey] : [];
}

// --- Types & Parsers for Workflow Title ---
export interface WorkflowStageData {
  id: string;
  stageName: string;
  tasks: string[];
  deliverables: string[];
  approval: string;
  policies?: string[];
}

export interface StructuredWorkflow {
  id: string; // Added stable ID
  title: string;
  stages: WorkflowStageData[];
}

export function parseWorkflowTitle(text: string, rowId?: string): StructuredWorkflow {
  // Simple hash function for stable ID generation if rowId and ID: are missing
  const getStableId = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36) || 'fallback';
  };

  if (!text) return { id: rowId || "empty", title: "", stages: [] };
  
  const stages: WorkflowStageData[] = [];
  let title = "";
  let id = rowId || getStableId(text);
  
  const lines = text.split('\n');
  let currentStage: WorkflowStageData | null = null;
  let currentSection = ""; 
  let isPlain = true;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    
    if (trimmed.startsWith("ID: ")) {
        id = trimmed.substring(4);
    } else if (trimmed.startsWith("Title: ")) {
      isPlain = false;
      title = trimmed.substring(7);
      currentSection = "";
    } else if (trimmed.startsWith("Stage: ")) {
      isPlain = false;
      const content = trimmed.substring(7);
      const idMatch = content.match(/^(.*?) \[ID: (.*?)\]$/);
      
      let stageName = content;
      let stageId = getStableId(content);
      
      if (idMatch) {
          stageName = idMatch[1];
          stageId = idMatch[2];
      }

      currentStage = {
        id: stageId,
        stageName: stageName,
        tasks: [],
        deliverables: [],
        approval: "",
        policies: []
      };
      stages.push(currentStage);
      currentSection = "";
    } else if (trimmed === "Tasks:") {
      isPlain = false;
      currentSection = "tasks";
    } else if (trimmed === "Deliverables:") {
      isPlain = false;
      currentSection = "deliverables";
    } else if (trimmed === "Policies:") {
      isPlain = false;
      currentSection = "policies";
    } else if (trimmed.startsWith("Approval: ")) {
      isPlain = false;
      if (currentStage) {
        currentStage.approval = trimmed.substring(10);
      }
      currentSection = "approval";
    } else if (trimmed.startsWith("• ")) {
      isPlain = false;
      const item = trimmed.substring(2);
      if (currentStage) {
         if (currentSection === "tasks") currentStage.tasks.push(item);
         else if (currentSection === "deliverables") currentStage.deliverables.push(item);
         else if (currentSection === "policies") {
           if (!currentStage.policies) currentStage.policies = [];
           currentStage.policies.push(item);
         }
      }
    } else if (currentStage) {
      if (currentSection === "tasks") {
        isPlain = false;
        currentStage.tasks.push(trimmed);
      } else if (currentSection === "deliverables") {
        isPlain = false;
        currentStage.deliverables.push(trimmed);
      } else if (currentSection === "policies") {
        isPlain = false;
        if (!currentStage.policies) currentStage.policies = [];
        currentStage.policies.push(trimmed);
      }
    }
  }
  
  if (isPlain) {
    title = text;
  } else if (!title && lines.length > 0) {
     const firstLine = lines[0].trim();
     if (firstLine && !firstLine.includes(":")) {
         title = firstLine;
     }
  }
  
  return { id, title, stages };
}

export function stringifyWorkflowTitle(data: StructuredWorkflow): string {
  let result = `ID: ${data.id}\n`;
  if (data.title) {
    result += `Title: ${data.title}\n\n`;
  }
  data.stages.forEach(stage => {
    if (stage.stageName) {
      result += `Stage: ${stage.stageName} [ID: ${stage.id}]\n`;
      if (stage.tasks.length > 0) {
        result += `Tasks:\n`;
        stage.tasks.forEach(t => {
          if (t) result += `• ${t}\n`;
        });
      }
      if (stage.deliverables.length > 0) {
        result += `Deliverables:\n`;
        stage.deliverables.forEach(d => {
          if (d) result += `• ${d}\n`;
        });
      }
      if (stage.policies && stage.policies.length > 0) {
        result += `Policies:\n`;
        stage.policies.forEach(p => {
          if (p) result += `• ${p}\n`;
        });
      }
      if (stage.approval) {
        result += `Approval: ${stage.approval}\n`;
      }
      result += "\n";
    }
  });
  return result.trim();
}



