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

console.log(parseWorkflowAndStages("api26cs {2gard2k:710003254|2026-07-21}"));
console.log(parseWorkflowAndStages("api26cs {2gard2k:710003254, 829283|2026-07-21; m0zvoy:9294242|2026-07-22}"));
console.log(parseWorkflowAndStages("api26cs {Stage1:E1|Stage2:E2}")); // Old format
