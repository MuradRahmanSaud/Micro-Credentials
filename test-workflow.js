import axios from 'axios';
axios.get('http://localhost:3000/api/data?gid=1686458334').then(res => {
  const data = res.data;
  if(data.length > 0) console.log("Keys:", Object.keys(data[0]));
  console.log("Row 0:", data[0]);
}).catch(console.error);
