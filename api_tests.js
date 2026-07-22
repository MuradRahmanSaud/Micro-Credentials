const axios = require('axios');

async function testAdd() {
  // test_add
  const newId = '999999999' + Math.floor(Math.random() * 1000);
  const data = {
    'Employee ID': newId,
    'Employee Name': 'Test Add User',
    'Photo': 'https://drive.google.com/uc?export=view&id=1SbIeamzhjLXD7aocsYKC19SlafFbvEM9'
  };
  const res = await axios.post('http://localhost:3000/api/proxy', { action: 'ADD', data });
  console.log('Add Response:', res.data);
}

async function testGet() {
  const res = await axios.post('http://localhost:3000/api/proxy', { action: 'GET' });
  console.log('Headers:', res.data.headers);
}

async function testUpdate() {
  const data = { 'Employee Name': 'Updated Name' };
  const res = await axios.post('http://localhost:3000/api/proxy', {
    action: 'UPDATE',
    idKey: 'Employee ID',
    idValue: '12345',
    data
  });
  console.log('Update Response:', res.data);
}

// You can uncomment the function you want to run
// testAdd();
// testGet();
// testUpdate();
