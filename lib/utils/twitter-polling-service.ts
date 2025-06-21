let isInitialized = false;
let pollingInterval: NodeJS.Timeout | null = null;

async function startMentionPolling() {
  if (pollingInterval) {
    console.log('Mention polling already running');
    return;
  }

  console.log('Starting Twitter mention polling...');
  
  const baseUrl = process.env.NODE_ENV === 'production' 
    ? process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'
    : 'http://localhost:3000';
  
  // Start polling immediately, then every 15 minutes
  try {
    const response = await fetch(`${baseUrl}/api/twitter-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check' })
    });
    if (!response.ok) {
      console.error('Failed to check mentions:', await response.text());
    }
  } catch (error) {
    console.error('Error checking mentions:', error);
  }
  
  pollingInterval = setInterval(async () => {
    try {
      const response = await fetch(`${baseUrl}/api/twitter-webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check' })
      });
      if (!response.ok) {
        console.error('Failed to check mentions:', await response.text());
      }
    } catch (error) {
      console.error('Error during scheduled mention check:', error);
    }
  }, 15 * 60 * 1000); // 15 minutes

  console.log('Twitter mention polling started with 15-minute intervals');
}

function stopMentionPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    console.log('Twitter mention polling stopped');
  }
}

export async function initializeTwitterPolling() {
  if (isInitialized) {
    console.log('Twitter polling already initialized');
    return;
  }

  try {
    await startMentionPolling();
    console.log('Twitter mention polling initialized successfully');
    isInitialized = true;
  } catch (error) {
    console.error('Error initializing Twitter polling:', error);
  }
}

export { startMentionPolling, stopMentionPolling };
