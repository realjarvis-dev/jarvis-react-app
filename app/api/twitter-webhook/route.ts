import { NextRequest, NextResponse } from 'next/server';
import { 
  getJarvisUserId, 
  fetchMentions, 
  processMention, 
  getLastProcessedMentionId, 
  setLastProcessedMentionId,
  hasRepliedToMention
} from '@/lib/utils/twitter-mention-handler';

let pollingInterval: NodeJS.Timeout | null = null;

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();
    
    if (action === 'start') {
      await startMentionPolling();
      return NextResponse.json({ status: 'Mention polling started' });
    } else if (action === 'stop') {
      stopMentionPolling();
      return NextResponse.json({ status: 'Mention polling stopped' });
    } else if (action === 'check') {
      await checkMentions();
      return NextResponse.json({ status: 'Mentions checked manually' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Twitter mentions API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function startMentionPolling() {
  if (pollingInterval) {
    console.log('Mention polling already running');
    return;
  }

  console.log('Starting Twitter mention polling...');
  
  await checkMentions();
  
  pollingInterval = setInterval(async () => {
    try {
      await checkMentions();
    } catch (error) {
      console.error('Error in mention polling interval:', error);
    }
  }, 15 * 60 * 1000);
  
  console.log('Twitter mention polling started with 15-minute intervals');
}

function stopMentionPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    console.log('Twitter mention polling stopped');
  }
}



async function checkMentions() {
  try {
    const userId = await getJarvisUserId();
    const mentions = await fetchMentions(userId);
    
    if (mentions.data && mentions.data.length > 0) {
      console.log(`Found ${mentions.data.length} new mentions`);
      
      const mentionsToProcess = mentions.data.slice(0, 10);
      if (mentions.data.length > 10) {
        console.log(`Rate limiting: processing first 10 of ${mentions.data.length} mentions to stay within API limits (10 mentions/15min)`);
      }
      
      for (const mention of mentionsToProcess) {
        try {
          await processMention(mention, mentions.includes?.users || []);
        } catch (error) {
          console.error(`Error processing mention ${mention.id}:`, error);
        }
      }
      
      const lastProcessedMention = mentionsToProcess[mentionsToProcess.length - 1];
      if (lastProcessedMention) {
        setLastProcessedMentionId(lastProcessedMention.id);
      }
    } else {
      console.log('No new mentions found');
    }
  } catch (error) {
    console.error('Error checking mentions:', error);
  }
}









export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  
  if (action === 'status') {
    return NextResponse.json({ 
      status: pollingInterval ? 'running' : 'stopped',
      lastProcessedMentionId: getLastProcessedMentionId() || 'none'
    });
  } else if (action === 'start') {
    await startMentionPolling();
    return NextResponse.json({ status: 'Mention polling started' });
  } else if (action === 'stop') {
    stopMentionPolling();
    return NextResponse.json({ status: 'Mention polling stopped' });
  }
  
  return NextResponse.json({ 
    error: 'Use ?action=status, ?action=start, or ?action=stop',
    currentStatus: pollingInterval ? 'running' : 'stopped'
  });
}
