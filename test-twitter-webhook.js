const fetch = require('node-fetch');

async function testTwitterWebhook() {
  const webhookUrl = 'http://localhost:3001/api/twitter-webhook';
  
  const mockTwitterPayload = {
    tweet_create_events: [
      {
        id_str: '1234567890',
        text: '@JarvisCryptoAI What is the current price of Bitcoin?',
        user: {
          id_str: '987654321',
          screen_name: 'testuser'
        },
        entities: {
          user_mentions: [
            {
              screen_name: 'JarvisCryptoAI',
              id_str: '123456789'
            }
          ]
        }
      }
    ]
  };

  try {
    console.log('Testing Twitter webhook endpoint...');
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mockTwitterPayload)
    });

    const result = await response.json();
    console.log('Response status:', response.status);
    console.log('Response body:', result);
    
    if (response.status === 200) {
      console.log('✅ Webhook endpoint test passed!');
    } else {
      console.log('❌ Webhook endpoint test failed!');
    }
  } catch (error) {
    console.error('Test error:', error.message);
  }
}

testTwitterWebhook();
