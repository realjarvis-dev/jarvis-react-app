import { fetchMentions, getJarvisUserId, processMention, setLastProcessedMentionId } from './twitter-mention-handler';

let isInitialized = false;
let pollingInterval: NodeJS.Timeout | null = null;

async function checkMentionsDirectly() {
  try {
    const userId = await getJarvisUserId();
    console.log(`🔍 Checking mentions for user ID: ${userId}`);
    
    const mentions = await fetchMentions(userId);
    
    if (mentions.data && mentions.data.length > 0) {
      console.log(`Found ${mentions.data.length} new mentions`);
      
      for (const mention of mentions.data) {
        await processMention(mention, mentions.includes?.users || []);
      }
      
      if (mentions.meta?.newest_id) {
        setLastProcessedMentionId(mentions.meta.newest_id);
      }
    } else {
      console.log('No new mentions found');
    }
  } catch (error) {
    console.error('Error checking mentions:', error);
    
    // For testing: Don't let API errors stop the polling
    if (error instanceof Error && error.message.includes('rate limit')) {
      console.log('⚠️ Rate limit error - will try again next cycle');
    } else if (error instanceof Error && error.message.includes('Twitter API')) {
      console.log('⚠️ Twitter API error - will try again next cycle');
    } else {
      console.log('⚠️ Unknown error - will try again next cycle');
    }
  }
}

async function startMentionPolling() {
  if (pollingInterval) {
    console.log('Mention polling already running');
    return;
  }

  console.log('Starting Twitter mention polling...');
  
  // Start polling every 1 minute for testing
  pollingInterval = setInterval(async () => {
    try {
      await checkMentionsDirectly();
    } catch (error) {
      console.error('Error during scheduled mention check:', error);
    }
  }, 60 * 1000); // 1 minute

  console.log('Twitter mention polling started with 1-minute intervals for testing');
}

function stopMentionPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    console.log('Twitter mention polling stopped');
  }
}

async function initializeLastProcessedMentionId() {
  try {
    console.log('Skipping recent mentions fetch for testing - will process all new mentions');
    console.log('Bot will start responding to new mentions immediately');
  } catch (error) {
    console.error('Error initializing lastProcessedMentionId:', error);
    console.log('Will start processing from next mention received');
  }
}

export async function initializeTwitterPolling() {
  if (isInitialized) {
    console.log('Twitter polling already initialized');
    return;
  }

  try {
    await initializeLastProcessedMentionId();
    
    // Start polling for new mentions only
    await startMentionPolling();
    console.log('Twitter mention polling initialized successfully (1-minute intervals)');
    isInitialized = true;
  } catch (error) {
    console.error('Error initializing Twitter polling:', error);
  }
}

export { startMentionPolling, stopMentionPolling };
