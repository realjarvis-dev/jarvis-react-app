import { getJarvisUserId, fetchMentions, processMention, setLastProcessedMentionId } from './twitter-mention-handler';

let isInitialized = false;
let pollingInterval: NodeJS.Timeout | null = null;

async function checkMentionsDirectly() {
  try {
    const userId = await getJarvisUserId();
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
  }
}

async function startMentionPolling() {
  if (pollingInterval) {
    console.log('Mention polling already running');
    return;
  }

  console.log('Starting Twitter mention polling...');
  
  // Start polling immediately, then every 15 minutes
  try {
    await checkMentionsDirectly();
  } catch (error) {
    console.error('Error checking mentions:', error);
  }
  
  pollingInterval = setInterval(async () => {
    try {
      await checkMentionsDirectly();
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
