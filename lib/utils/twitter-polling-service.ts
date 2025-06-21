let isInitialized = false;

export async function initializeTwitterPolling() {
  if (isInitialized) {
    console.log('Twitter polling already initialized');
    return;
  }

  try {
    const response = await fetch('/api/twitter-webhook?action=start');
    if (response.ok) {
      console.log('Twitter mention polling initialized successfully');
      isInitialized = true;
    } else {
      console.error('Failed to initialize Twitter polling:', await response.text());
    }
  } catch (error) {
    console.error('Error initializing Twitter polling:', error);
  }
}

if (typeof window === 'undefined') {
  setTimeout(() => {
    initializeTwitterPolling();
  }, 5000);
}
