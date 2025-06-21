let isInitialized = false;

export async function initializeTwitterPolling() {
  if (isInitialized) {
    console.log('Twitter polling already initialized');
    return;
  }

  try {
    const { startMentionPolling } = await import('../../app/api/twitter-webhook/route');
    await startMentionPolling();
    console.log('Twitter mention polling initialized successfully');
    isInitialized = true;
  } catch (error) {
    console.error('Error initializing Twitter polling:', error);
  }
}
