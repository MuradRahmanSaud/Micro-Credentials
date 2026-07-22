// Paste the new parseWorkflowAndStages and serializeWorkflowAndStages functions here...
function parseWorkflowAndStages(workflowStr) {
  if (!workflowStr) return { jobTitle: '', stageAssignments: {} };
  
  const match = workflowStr.match(/^(.*?)\s*\{(.*?)\}$/);
  if (match) {
    const jobTitle = match[1].trim();
    const stagesPart = match[2].trim();
    const stageAssignments = {};
    
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
  
  return { jobTitle: workflowStr.trim(), stageAssignments: {} };
}

function serializeWorkflowAndStages(jobTitle, stageAssignments) {
  const parts = [];
  Object.entries(stageAssignments).forEach(([stageId, ids]) => {
    if (ids && ids.length > 0) {
      // The ids are already formatted as "empId|date|deadline"
      parts.push(`${stageId}:${ids.join(', ')}`);
    }
  });
  
  if (parts.length === 0) return jobTitle;
  return `${jobTitle} {${parts.join('; ')}}`;
}

// Test case 1: New format
const assignments1 = {
  '2gard2k': [ '710003254|2026-07-21|2026-07-25', '829283|2026-07-21|2026-07-28' ],
};
const serialized1 = serializeWorkflowAndStages("api26cs", assignments1);
console.log("Serialized 1:", serialized1);
const parsed1 = parseWorkflowAndStages(serialized1);
console.log("Parsed 1:", JSON.stringify(parsed1, null, 2));

// Test case 2: Old format (EmpId|Date)
// If I pass 'EmpId|Date', parse should produce 'EmpId|Date|' (Deadline is empty)
const assignments2 = {
  'Stage1': [ 'Emp1|2026-07-21' ],
};
const serialized2 = serializeWorkflowAndStages("OldFormat", assignments2);
console.log("Serialized 2:", serialized2);
const parsed2 = parseWorkflowAndStages(serialized2);
console.log("Parsed 2:", JSON.stringify(parsed2, null, 2));
