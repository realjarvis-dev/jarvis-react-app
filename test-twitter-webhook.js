const fetch = require('node-fetch');

const testActions = [
  { action: 'status' },
  { action: 'start' },
  { action: 'check' },
  { action: 'stop' }
];

async function testMentionPolling() {
  try {
    console.log('Testing Twitter mention polling endpoint...');
    
    for (const testAction of testActions) {
      console.log(`\n--- Testing ${testAction.action} action ---`);
      
      let url = 'http://localhost:3000/api/twitter-webhook';
      let method = 'GET';
      let body = null;
      
      if (testAction.action === 'check') {
        method = 'POST';
        body = JSON.stringify(testAction);
      } else {
        url += `?action=${testAction.action}`;
      }
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body
      });

      const result = await response.json();
      console.log('Response status:', response.status);
      console.log('Response body:', result);
      
      if (response.ok) {
        console.log(`✅ ${testAction.action} test successful!`);
      } else {
        console.log(`❌ ${testAction.action} test failed!`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (error) {
    console.error('❌ Error testing mention polling:', error);
  }
}

console.log('Starting Twitter mention polling tests...\n');

testMentionPolling().then(() => {
  console.log('\nAll tests completed!');
});
