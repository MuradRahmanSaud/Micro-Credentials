import axios from 'axios';

function parseWorkflowAndStages(workflowStr) {
  if (!workflowStr) return { jobTitle: '', stageAssignments: {} };
  
  const match = workflowStr.match(/^(.*?)\s*\{(.*?)\}$/);
  if (match) {
    const jobTitle = match[1].trim();
    const stagesPart = match[2].trim();
    const stageAssignments = {};
    
    const parts = stagesPart.split('|');
    parts.forEach(part => {
      const [stageName, ...empIds] = part.split(':');
      if (stageName) {
        stageAssignments[stageName.trim()] = empIds.flatMap(empId => empId.split(',').map(id => id.trim()));
      }
    });
    
    return { jobTitle, stageAssignments };
  }
  
  return { jobTitle: workflowStr, stageAssignments: {} };
}

const getStableId = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36) || 'fallback';
};

function parseWorkflowTitle(text, rowId) {
  if (!text) return { id: rowId || "empty", title: "", stages: [] };
  
  const stages = [];
  let title = "";
  let id = rowId || getStableId(text);
  
  const lines = text.split('\n');
  let currentStage = null;
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
        approval: ""
      };
      stages.push(currentStage);
      currentSection = "";
    } else if (trimmed === "Tasks:") {
      isPlain = false;
      currentSection = "tasks";
    } else if (trimmed === "Deliverables:") {
      isPlain = false;
      currentSection = "deliverables";
    } else if (trimmed.startsWith("Approval: ")) {
        // ..
    } else if (currentStage) {
      if (currentSection === "tasks") {
        isPlain = false;
        currentStage.tasks.push(trimmed);
      } else if (currentSection === "deliverables") {
        isPlain = false;
        currentStage.deliverables.push(trimmed);
      }
    }
  }
  return { id, title, stages };
}

axios.get('http://localhost:3000/api/data?gid=1686458334').then(res => {
  const workflowData = res.data;
  const workflowStr = "api26cs {2gard2k:710003254|2026-07-21}"; // Test batch workflow
  const { jobTitle, stageAssignments } = parseWorkflowAndStages(workflowStr);
  console.log("jobTitle:", jobTitle);
  console.log("stageAssignments:", stageAssignments);
  
  const workflowDef = workflowData.find(w => {
    const parsed = parseWorkflowTitle(w["Workflow Title"], w.id);
    return parsed.id === jobTitle || parsed.title.trim().toLowerCase() === jobTitle.trim().toLowerCase();
  });
  console.log("workflowDef found:", !!workflowDef);
  
  const { stages: structuredStages } = workflowDef ? parseWorkflowTitle(workflowDef["Workflow Title"], workflowDef.id) : parseWorkflowTitle(workflowStr);
  console.log("structuredStages length:", structuredStages.length);
  
  Object.entries(stageAssignments).forEach(([stageNameOrId, employeeIds]) => {
    let cleanStageName = stageNameOrId.replace(/^\d+\.\s*/, '').trim();
    const structuredStage = structuredStages.find(s => 
      s.id === stageNameOrId || 
      s.stageName.replace(/^\d+\.\s*/, '').trim() === cleanStageName
    );
    console.log("Looking for stage:", stageNameOrId, "Found:", !!structuredStage);
    if(structuredStage) {
       console.log("Tasks:", structuredStage.tasks);
       console.log("Deliverables:", structuredStage.deliverables);
    }
  });

}).catch(console.error);
