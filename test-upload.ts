import fs from 'fs';

async function test() {
  try {
    const formData = new FormData();
    const blob = new Blob(['fake excel data'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    formData.append('file', blob, 'test.xlsx');

    const res = await fetch('http://localhost:3000/api/upload-rfq', {
      method: 'POST',
      body: formData
    });

    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Response:', text.substring(0, 200));
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

test();
