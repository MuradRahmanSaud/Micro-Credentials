const fs = require('fs');

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

const wStr = `ID: row-0-4b6dh
Title: Micro-Credential Course Development Process

Stage: Course Ideation & Scope Draft
Tasks:
• Define course title, identify target learners, conduct industry demand analysis, draft learning outcomes, estimate course duration
Deliverables:
• Course Concept Note
Approval: Micro-Credentials Team

Stage: Curriculum & Material Building
Tasks:
• Develop syllabus, create module breakdown, define Course Learning Outcomes (CLOs), design assessments, prepare learning materials
Deliverables:
• Draft Curriculum & Learning Materials
Approval: Academic Reviewer`;

const res = parseWorkflowTitle(wStr, '123');
console.log(JSON.stringify(res, null, 2));

