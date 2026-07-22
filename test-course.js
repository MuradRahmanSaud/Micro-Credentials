import axios from 'axios';
axios.get('http://localhost:3000/api/data?gid=0').then(res => {
  const data = res.data;
  const withWorkflow = data.filter(d => d["Workflow"] || d["Publication Workflow"]);
  console.log("Courses with workflow:", withWorkflow.length);
  withWorkflow.forEach(w => {
    console.log("Course Workflow:", (w["Workflow"] || w["Publication Workflow"])?.substring(0, 150).replace(/\n/g, '\\n'));
  });
}).catch(console.error);
axios.get('http://localhost:3000/api/data?gid=1111164355').then(res => {
  const data = res.data;
  const withWorkflow = data.filter(d => d["Workflow"] || d["Publication Workflow"]);
  console.log("Batches with workflow:", withWorkflow.length);
  withWorkflow.forEach(w => {
    console.log("Batch Workflow:", (w["Workflow"] || w["Publication Workflow"])?.substring(0, 150).replace(/\n/g, '\\n'));
  });
}).catch(console.error);

