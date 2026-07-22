import axios from 'axios';
axios.get('http://localhost:3000/api/data?gid=1686458334').then(res => {
  const data = res.data;
  console.log(Object.keys(data[0] || {}));
}).catch(console.error);
