import { NextRequest, NextResponse } from 'next/server';
import { processTwitterQuery } from '@/lib/utils/twitter-query-processor';

interface TwitterMention {
  id: string;
  text: string;
  author_id: string;
  created_at: string;
  public_metrics: {
    retweet_count: number;
    like_count: number;
    reply_count: number;
    quote_count: number;
  };
}

interface TwitterUser {
  id: string;
  username: string;
  name: string;
}

interface TwitterMentionsResponse {
  data?: TwitterMention[];
  includes?: {
    users?: TwitterUser[];
  };
  meta?: {
    oldest_id?: string;
    newest_id?: string;
    result_count?: number;
    next_token?: string;
  };
}

let lastProcessedMentionId: string | null = null;
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

async function getJarvisUserId(): Promise<string> {
  const cachedUserId = process.env.TWITTER_USER_ID;
  if (cachedUserId) {
    return cachedUserId;
  }

  const bearerToken = process.env.TWITTER_API_BEARER_TOKEN;
  if (!bearerToken) {
    throw new Error('TWITTER_API_BEARER_TOKEN environment variable is not set');
  }

  const response = await fetch('https://api.twitter.com/2/users/by/username/JarvisCryptoAI', {
    headers: {
      'Authorization': `Bearer ${bearerToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Failed to get user ID: ${response.status} - ${errorData}`);
  }

  const data = await response.json();
  return data.data.id;
}

async function checkMentions() {
  try {
    const userId = await getJarvisUserId();
    const mentions = await fetchMentions(userId);
    
    if (mentions.data && mentions.data.length > 0) {
      console.log(`Found ${mentions.data.length} new mentions`);
      
      for (const mention of mentions.data) {
        await processMention(mention, mentions.includes?.users || []);
      }
      
      if (mentions.meta?.newest_id) {
        lastProcessedMentionId = mentions.meta.newest_id;
      }
    } else {
      console.log('No new mentions found');
    }
  } catch (error) {
    console.error('Error checking mentions:', error);
  }
}

async function fetchMentions(userId: string): Promise<TwitterMentionsResponse> {
  const bearerToken = process.env.TWITTER_API_BEARER_TOKEN;
  if (!bearerToken) {
    throw new Error('TWITTER_API_BEARER_TOKEN environment variable is not set');
  }

  let url = `https://api.twitter.com/2/users/${userId}/mentions?tweet.fields=created_at,author_id,public_metrics&expansions=author_id&user.fields=username,name&max_results=10`;
  
  if (lastProcessedMentionId) {
    url += `&since_id=${lastProcessedMentionId}`;
  }

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${bearerToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Twitter API error: ${response.status} - ${errorData}`);
  }

  return await response.json();
}

async function processMention(mention: TwitterMention, users: TwitterUser[]) {
  try {
    const author = users.find(user => user.id === mention.author_id);
    const authorUsername = author?.username || 'unknown';
    
    console.log(`Processing mention from @${authorUsername}: "${mention.text}"`);
    
    const botUserId = await getJarvisUserId();
    if (mention.author_id === botUserId) {
      console.log('Skipping own mention');
      return;
    }

    const query = mention.text
      .replace(/@jarviscryptoai\s*/gi, '')
      .replace(/@\w+\s*/g, '')
      .trim();

    if (!query) {
      await replyToTweet(
        mention.id,
        `GM @${authorUsername}! 🚀 Drop your crypto research question after tagging @JarvisCryptoAI and I'll alpha you up! 📈`
      );
      return;
    }

    const response = await processTwitterQuery(query, mention.author_id);
    
    await replyToTweet(mention.id, `@${authorUsername} ${response}`);
    
  } catch (error) {
    console.error('Error processing mention:', error);
    const author = users.find(user => user.id === mention.author_id);
    const authorUsername = author?.username || 'unknown';
    await replyToTweet(
      mention.id,
      `@${authorUsername} Sorry, I encountered an error processing your request. Please try again later.`
    );
  }
}



async function postTweetReply(tweetId: string, message: string) {
  const bearerToken = process.env.TWITTER_API_BEARER_TOKEN;
  if (!bearerToken) {
    throw new Error('TWITTER_API_BEARER_TOKEN environment variable is not set');
  }
  
  const url = 'https://api.twitter.com/2/tweets';
  
  const requestBody = {
    text: message,
    reply: {
      in_reply_to_tweet_id: tweetId
    }
  };
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${bearerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Twitter API error: ${response.status} - ${errorData}`);
  }

  return await response.json();
}



async function replyToTweet(tweetId: string, message: string) {
  try {
    const maxLength = 280;
    const truncatedMessage = message.length > maxLength 
      ? message.substring(0, maxLength - 3) + '...'
      : message;

    const result = await postTweetReply(tweetId, truncatedMessage);
    
    console.log(`Successfully replied to tweet ${tweetId} with ID: ${result.data?.id}`);
  } catch (error) {
    console.error('Error replying to tweet:', error);
    throw error;
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  
  if (action === 'status') {
    return NextResponse.json({ 
      status: pollingInterval ? 'running' : 'stopped',
      lastProcessedMentionId: lastProcessedMentionId || 'none'
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
