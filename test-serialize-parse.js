function parseWorkflowAndStages(workflowStr) {
  if (!workflowStr) return { jobTitle: '', stageAssignments: {} };
  
  const match = workflowStr.match(/^(.*?)\s*\{(.*?)\}$/);
  if (match) {
    const jobTitle = match[1].trim();
    const stagesPart = match[2].trim();
    const stageAssignments = {};
    
    // Split by either ';' or '|'
    const parts = stagesPart.split(/\s*[;|]\s*/);
    let currentStageId = null;
    
    parts.forEach(part => {
      const idx = part.indexOf(':');
      if (idx !== -1) {
        // It's a stage
        const stageId = part.substring(0, idx).trim();
        const idsStr = part.substring(idx + 1).trim();
        const ids = idsStr ? idsStr.split(',').map(s => s.trim()) : [];
        if (stageId) {
          stageAssignments[stageId] = ids;
          currentStageId = stageId;
        }
      } else if (part && currentStageId) {
        // It's a date for the current stage (or something else without ':')
        // We can attach the date to all employees of the current stage
        if (part.match(/^\d{4}-\d{2}-\d{2}$/)) { // Looks like a date
          stageAssignments[currentStageId] = stageAssignments[currentStageId].map(id => {
            // if already has date, keep it (though in old format it wouldn't)
            if (!id.includes('|')) {
               return `${id}|${part}`;
            }
            return id;
          });
        }
      }
    });
    
    return { jobTitle, stageAssignments };
  }
  
  return { jobTitle: workflowStr, stageAssignments: {} };
}

function serializeWorkflowAndStages(jobTitle, stageAssignments) {
  const parts = [];
  Object.entries(stageAssignments).forEach(([stageId, ids]) => {
    if (ids && ids.length > 0) {
      // Extract the common assigned date if it exists (for the format: stageId:ids|date)
      let commonDate = null;
      const formattedIds = ids.map(id => {
        const [empId, assignedDate, deadline] = id.split('|');
        if (assignedDate && !commonDate) commonDate = assignedDate;
        
        // Construct the id string with all components
        let idStr = empId;
        if (assignedDate) idStr += `|${assignedDate}`;
        if (deadline) idStr += `|${deadline}`;
        return idStr;
      });
      
      let str = `${stageId}:${formattedIds.join(', ')}`;
      if (commonDate) {
         str += `|${commonDate}`;
      }
      parts.push(str);
    }
  });
  
  if (parts.length === 0) return jobTitle;
  return `${jobTitle} {${parts.join('; ')}}`;
}

// Test case
const assignments = {
  '2gard2k': [ '710003254|2026-07-21|2026-07-25', '829283|2026-07-21|2026-07-28' ],
};

const serialized = serializeWorkflowAndStages("api26cs", assignments);
console.log("Serialized:", serialized);
const parsed = parseWorkflowAndStages(serialized);
console.log("Parsed:", JSON.stringify(parsed, null, 2));
