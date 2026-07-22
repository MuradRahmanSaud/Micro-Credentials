import axios from 'axios';
axios.get('http://localhost:3000/api/data?gid=1686458334').then(res => {
  const data = res.data;
  console.log("Row 1 (api26cs):", JSON.stringify(data[1], null, 2));
}).catch(console.error);
