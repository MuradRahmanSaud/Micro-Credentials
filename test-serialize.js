function serializeWorkflowAndStages(jobTitle, stageAssignments) {
  const parts = [];
  Object.entries(stageAssignments).forEach(([stageId, ids]) => {
    if (ids && ids.length > 0) {
      // ids might be like ['Emp1|2026-07-21', 'Emp2|2026-07-21']
      // We want to extract the date (take from the first one that has a date)
      let date = null;
      const cleanIds = ids.map(id => {
        const [empId, empDate] = id.split('|');
        if (empDate && !date) date = empDate;
        return empId;
      });
      
      let str = `${stageId}:${cleanIds.join(',')}`;
      if (date) {
         str += `|${date}`;
      }
      parts.push(str);
    }
  });
  
  if (parts.length === 0) return jobTitle;
  return `${jobTitle} {${parts.join('; ')}}`;
}

console.log(serializeWorkflowAndStages("api26cs", {
  '2gard2k': [ '710003254|2026-07-21', '829283|2026-07-21' ],
  'm0zvoy': [ '9294242|2026-07-22' ],
  'Stage2': [ 'E2' ]
}));
