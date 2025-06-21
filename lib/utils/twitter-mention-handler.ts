import { processTwitterQuery } from './twitter-query-processor';

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
let cachedUserId: string | null = null;
let lastRateLimitReset: number = 0;

export function getLastProcessedMentionId(): string | null {
  return lastProcessedMentionId;
}

export function setLastProcessedMentionId(id: string): void {
  lastProcessedMentionId = id;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function handleRateLimit(response: Response, operation: string): Promise<boolean> {
  if (response.status === 429) {
    const resetTime = response.headers.get('x-rate-limit-reset');
    const remainingRequests = response.headers.get('x-rate-limit-remaining');
    
    console.log(`Rate limit hit for ${operation}. Remaining: ${remainingRequests}, Reset: ${resetTime}`);
    
    if (resetTime) {
      const resetTimestamp = parseInt(resetTime) * 1000;
      const waitTime = Math.max(resetTimestamp - Date.now(), 60000); // Wait at least 1 minute
      console.log(`Waiting ${Math.round(waitTime / 1000)}s for rate limit reset...`);
      
      if (waitTime <= 15 * 60 * 1000) {
        await sleep(waitTime);
        return true; // Indicate we should retry
      }
    } else {
      console.log('No reset time provided, waiting 5 minutes...');
      await sleep(5 * 60 * 1000);
      return true;
    }
  }
  return false; // Don't retry
}

export async function getJarvisUserId(): Promise<string> {
  const envUserId = process.env.TWITTER_USER_ID;
  if (envUserId) {
    return envUserId;
  }

  if (cachedUserId) {
    return cachedUserId;
  }

  const bearerToken = process.env.TWITTER_API_BEARER_TOKEN;
  if (!bearerToken) {
    throw new Error('TWITTER_API_BEARER_TOKEN environment variable is not set');
  }

  let retryCount = 0;
  const maxRetries = 3;

  while (retryCount < maxRetries) {
    try {
      const response = await fetch('https://api.twitter.com/2/users/by/username/JarvisCryptoAI', {
        headers: {
          'Authorization': `Bearer ${bearerToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        cachedUserId = data.data.id; // Cache the result
        return cachedUserId!; // We know it's not null here
      }

      if (await handleRateLimit(response, 'getJarvisUserId')) {
        retryCount++;
        continue;
      }

      const errorData = await response.text();
      console.error(`Failed to get user ID: ${response.status} - ${errorData}`);
      
      if (retryCount === maxRetries - 1) {
        throw new Error(`Failed to get user ID after ${maxRetries} attempts: ${response.status} - ${errorData}`);
      }
      
      retryCount++;
      await sleep(2000 * retryCount); // Exponential backoff
      
    } catch (error) {
      if (retryCount === maxRetries - 1) {
        throw error;
      }
      retryCount++;
      await sleep(2000 * retryCount);
    }
  }

  throw new Error('Failed to get user ID after all retries');
}

export async function fetchMentions(userId: string): Promise<TwitterMentionsResponse> {
  const bearerToken = process.env.TWITTER_API_BEARER_TOKEN;
  if (!bearerToken) {
    throw new Error('TWITTER_API_BEARER_TOKEN environment variable is not set');
  }

  let url = `https://api.twitter.com/2/users/${userId}/mentions?tweet.fields=created_at,author_id,public_metrics&expansions=author_id&user.fields=username,name&max_results=10`;
  
  if (lastProcessedMentionId) {
    url += `&since_id=${lastProcessedMentionId}`;
  }

  let retryCount = 0;
  const maxRetries = 3;

  while (retryCount < maxRetries) {
    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${bearerToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        return await response.json();
      }

      if (await handleRateLimit(response, 'fetchMentions')) {
        retryCount++;
        continue;
      }

      const errorData = await response.text();
      console.error(`Twitter API error: ${response.status} - ${errorData}`);
      
      if (retryCount === maxRetries - 1) {
        throw new Error(`Twitter API error after ${maxRetries} attempts: ${response.status} - ${errorData}`);
      }
      
      retryCount++;
      await sleep(2000 * retryCount); // Exponential backoff
      
    } catch (error) {
      if (retryCount === maxRetries - 1) {
        throw error;
      }
      retryCount++;
      await sleep(2000 * retryCount);
    }
  }

  throw new Error('Failed to fetch mentions after all retries');
}

export async function processMention(mention: TwitterMention, users: TwitterUser[]) {
  try {
    const author = users.find(user => user.id === mention.author_id);
    const authorUsername = author?.username || 'unknown';
    
    console.log(`Processing mention from @${authorUsername}: "${mention.text}"`);
    
    let botUserId: string | null = null;
    try {
      botUserId = await getJarvisUserId();
      if (mention.author_id === botUserId) {
        console.log('Skipping own mention');
        return;
      }
    } catch (error) {
      console.warn('Could not verify bot user ID due to rate limiting, continuing with mention processing');
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
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (!errorMessage.includes('429')) {
      await replyToTweet(
        mention.id,
        `@${authorUsername} Sorry, I encountered an error processing your request. Please try again later.`
      );
    } else {
      console.log(`Skipping error reply due to rate limiting for mention ${mention.id}`);
    }
  }
}

async function postTweetReply(tweetId: string, message: string) {
  const apiKey = process.env.TWITTER_API_KEY;
  const apiSecret = process.env.TWITTER_API_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;
  
  if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
    console.log('Twitter OAuth credentials not configured for posting replies. Mention detected but cannot reply.');
    console.log('To enable replies, set TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, and TWITTER_ACCESS_TOKEN_SECRET');
    return { success: false, reason: 'OAuth credentials not configured' };
  }

  const crypto = require('crypto');
  const url = 'https://api.twitter.com/2/tweets';
  
  let retryCount = 0;
  const maxRetries = 2; // Fewer retries for posting to avoid spam

  while (retryCount < maxRetries) {
    try {
      const oauthParams: Record<string, string> = {
        oauth_consumer_key: apiKey,
        oauth_token: accessToken,
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
        oauth_nonce: crypto.randomBytes(16).toString('hex'),
        oauth_version: '1.0'
      };

      const allParams: Record<string, string> = { ...oauthParams };
      const sortedParams = Object.keys(allParams).sort().map(key => `${key}=${encodeURIComponent(allParams[key])}`).join('&');
      
      const baseString = `POST&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`;
      const signingKey = `${encodeURIComponent(apiSecret)}&${encodeURIComponent(accessTokenSecret)}`;
      const signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');
      
      oauthParams.oauth_signature = signature;
      
      const authHeader = 'OAuth ' + Object.keys(oauthParams).sort().map(key => `${key}="${encodeURIComponent(oauthParams[key])}"`).join(', ');

      const requestBody = {
        text: message,
        reply: {
          in_reply_to_tweet_id: tweetId
        }
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        return await response.json();
      }

      if (await handleRateLimit(response, 'postTweetReply')) {
        retryCount++;
        continue;
      }

      const errorData = await response.text();
      console.log(`Twitter API error: ${response.status} - ${errorData}`);
      return { success: false, reason: `API error: ${response.status}` };
      
    } catch (error) {
      console.error('Error posting tweet reply:', error);
      if (retryCount === maxRetries - 1) {
        return { success: false, reason: 'Network error' };
      }
      retryCount++;
      await sleep(2000 * retryCount);
    }
  }

  return { success: false, reason: 'Failed after all retries' };
}

async function replyToTweet(tweetId: string, message: string) {
  try {
    const maxLength = 280;
    const truncatedMessage = message.length > maxLength 
      ? message.substring(0, maxLength - 3) + '...'
      : message;

    const result = await postTweetReply(tweetId, truncatedMessage);
    
    if (result.success === false) {
      console.log(`Could not reply to tweet ${tweetId}: ${result.reason}`);
      return;
    }
    
    console.log(`Successfully replied to tweet ${tweetId} with ID: ${result.data?.id}`);
  } catch (error) {
    console.error('Error replying to tweet:', error);
  }
}
