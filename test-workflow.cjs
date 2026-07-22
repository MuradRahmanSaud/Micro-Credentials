const fs = require('fs');
let workflowData = [];
try {
  const fileData = fs.readFileSync('node_modules/.cache/workflow_data.json', 'utf8'); // Wait, localStorage is in browser. We don't have it on the server unless the server fetches it or it's mocked.
} catch(e) {}
