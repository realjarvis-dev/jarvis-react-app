export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const isTwitterBotEnabled = process.env.ENABLE_TWITTER_BOT === 'true';
    
    if (!isTwitterBotEnabled) {
      console.log('Twitter bot service disabled via ENABLE_TWITTER_BOT environment variable');
      return;
    }
    
    const { initializeTwitterPolling } = await import('./lib/utils/twitter-polling-service');
    
    setTimeout(async () => {
      console.log('Server startup: Initializing Twitter mention polling...');
      await initializeTwitterPolling();
    }, 3000);
  }
}
