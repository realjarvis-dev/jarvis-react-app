import { createChatWithShareableLink } from './chat-creator';
import { processTwitterQuery } from './twitter-query-processor';


async function getTwitterApiClient() {
  const { TwitterApi } = await import('twitter-api-v2');
  return TwitterApi;
}


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
  public_metrics?: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
    listed_count: number;
  };
  created_at?: string;
  verified?: boolean;
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
let lastMentionProcessTime: number = 0;
const MENTION_PROCESSING_DELAY = 2000; // 2 seconds between mentions (optimized for 10 mentions/15min limit)

let repliedMentions: Set<string> = new Set();
let botTweetIds: Set<string> = new Set();
let recentReplies: number[] = [];

export function getLastProcessedMentionId(): string | null {
  return lastProcessedMentionId;
}

export function setLastProcessedMentionId(id: string): void {
  lastProcessedMentionId = id;
}

export function hasRepliedToMention(mentionId: string): boolean {
  return repliedMentions.has(mentionId);
}

export function markMentionAsReplied(mentionId: string): void {
  repliedMentions.add(mentionId);
  if (repliedMentions.size > 1000) {
    const mentionsArray = Array.from(repliedMentions);
    repliedMentions = new Set(mentionsArray.slice(-500)); // Keep last 500
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRateLimited(): boolean {
  return Date.now() < lastRateLimitReset;
}

function setRateLimitReset(resetTime: number): void {
  lastRateLimitReset = resetTime;
}

async function handleRateLimit(response: Response, operation: string): Promise<boolean> {
  if (response.status === 429) {
    const resetTime = response.headers.get('x-rate-limit-reset');
    const remainingRequests = response.headers.get('x-rate-limit-remaining');

    console.log(`Rate limit hit for ${operation}. Remaining: ${remainingRequests}, Reset: ${resetTime}`);
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    // Temporary bypass for testing - just log and skip
    console.log('⚠️ BYPASSING RATE LIMIT FOR TESTING - Will try to process anyway');
    return false; // Don't retry, just continue
  }
  return false; // Don't retry
}

export async function getJarvisUserId(): Promise<string> {
  const KNOWN_BOT_USER_ID = '1930617094195798016';
  
  
  const envUserId = process.env.TWITTER_USER_ID;
  if (envUserId) {
    return envUserId;
  }

  return KNOWN_BOT_USER_ID;
}

export async function fetchMentions(userId: string): Promise<TwitterMentionsResponse> {
  const bearerToken = process.env.TWITTER_API_BEARER_TOKEN;
  if (!bearerToken) {
    throw new Error('TWITTER_API_BEARER_TOKEN environment variable is not set');
  }

  let url = `https://api.twitter.com/2/users/${userId}/mentions?tweet.fields=created_at,author_id,public_metrics&expansions=author_id&user.fields=username,name,public_metrics,created_at,verified&max_results=10`;

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

export async function fetchRecentMentionsForInitialization(userId: string): Promise<TwitterMentionsResponse> {
  const bearerToken = process.env.TWITTER_API_BEARER_TOKEN;
  if (!bearerToken) {
    throw new Error('TWITTER_API_BEARER_TOKEN environment variable is not set');
  }

  const url = `https://api.twitter.com/2/users/${userId}/mentions?tweet.fields=created_at,author_id,public_metrics&expansions=author_id&user.fields=username,name,public_metrics,created_at,verified&max_results=5`;

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

      if (await handleRateLimit(response, 'fetchRecentMentionsForInitialization')) {
        retryCount++;
        continue;
      }

      const errorData = await response.text();
      console.error(`Twitter API error during initialization: ${response.status} - ${errorData}`);

      if (retryCount === maxRetries - 1) {
        throw new Error(`Twitter API error during initialization after ${maxRetries} attempts: ${response.status} - ${errorData}`);
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

  throw new Error('Failed to fetch recent mentions for initialization after all retries');
}

function shouldFilterMention(mention: TwitterMention, author: TwitterUser | undefined): { shouldFilter: boolean; reason: string } {
  if (!author) {
    return { shouldFilter: true, reason: 'Author not found' };
  }

  // All filters disabled for testing
  return { shouldFilter: false, reason: '' };
}

export async function processMention(mention: TwitterMention, users: TwitterUser[]) {
  try {
    const author = users.find(user => user.id === mention.author_id);
    const authorUsername = author?.username || 'unknown';

    if (hasRepliedToMention(mention.id)) {
      return;
    }
    if (authorUsername === 'JarvisCryptoAI') {
      return;
    }

    const filterResult = shouldFilterMention(mention, author);
    if (filterResult.shouldFilter) {
      console.log(`🚫 Filtered mention from @${authorUsername}: ${filterResult.reason}`);
      markMentionAsReplied(mention.id);
      return;
    }

    console.log(`✅ Processing mention from @${authorUsername}`);

    const now = Date.now();
    recentReplies = recentReplies.filter(time => now - time < 900000);
    if (recentReplies.length >= 10) {
      console.log('Circuit breaker: Reached mention processing limit (10/15min), pausing');
      return;
    }

    if (botTweetIds.has(mention.id)) {
      return;
    }

    const timeSinceLastProcess = now - lastMentionProcessTime;
    if (timeSinceLastProcess < MENTION_PROCESSING_DELAY) {
      const waitTime = MENTION_PROCESSING_DELAY - timeSinceLastProcess;
      await sleep(waitTime);
    }
    lastMentionProcessTime = Date.now();

    let botUserId: string;
    try {
      botUserId = await getJarvisUserId();
    } catch (error) {
      console.warn('Could not verify bot user ID, skipping mention processing to prevent recursive loops');
      return;
    }

    if (mention.author_id === botUserId) {
      return;
    }

    recentReplies.push(now);

    // Extract the base query (remove mentions)
    const baseQuery = mention.text
      .replace(/@jarviscryptoai\s*/gi, '')
      .replace(/@\w+\s*/g, '')
      .trim();

    if (!baseQuery) {
      await replyToTweet(
        mention.id,
        `GM @${authorUsername}! 🚀 Drop your crypto research question after tagging @JarvisCryptoAI and I'll alpha you up! 📈`
      );
      markMentionAsReplied(mention.id);
      return;
    }

    // Check if this is a REPORT request
    const isReportRequest = /^REPORT\b/i.test(baseQuery);
    
    if (isReportRequest) {
      console.log(`📊 REPORT request from @${authorUsername}`);
      
      // Extract the actual query after "REPORT"
      const reportQuery = baseQuery.replace(/^REPORT\s*/i, '').trim();
      
      if (!reportQuery) {
        await replyToTweet(
          mention.id,
          `@${authorUsername} Please provide a query after REPORT! Example: "@JarvisCryptoAI REPORT What are the top DeFi yields?" 📊`
        );
        markMentionAsReplied(mention.id);
        return;
      }

      try {
        // Use the new chat creation workflow
        const result = await createChatWithShareableLink(reportQuery, {
          userId: `twitter-${authorUsername}`,
          baseUrl: process.env.NEXT_PUBLIC_BASE_URL || 'https://jarvis-investment-agent.vercel.app'
        });

        const reportResponse = `@${authorUsername} 📊 Here's your comprehensive research report: ${result.shareUrl} 

🔗 This detailed analysis includes live data, charts, and actionable insights. Bookmark it for later! 📈`;

        const result_tweet = await replyToTweet(mention.id, reportResponse);
        console.log(`✅ REPORT response sent to @${authorUsername}: ${result.shareUrl}`);
        
        if (result_tweet && result_tweet.data?.id) {
          botTweetIds.add(result_tweet.data.id);
          if (botTweetIds.size > 1000) {
            const tweetIdsArray = Array.from(botTweetIds);
            botTweetIds = new Set(tweetIdsArray.slice(-500));
          }
        }
        
      } catch (error) {
        console.error('Error processing REPORT request:', error);
        await replyToTweet(
          mention.id,
          `@${authorUsername} Sorry, I encountered an error generating your report. Please try again later. 📊`
        );
      }
    } else {
      // Use existing Twitter bot workflow for regular queries
      const response = await processTwitterQuery(baseQuery, mention.author_id);
      const result = await replyToTweet(mention.id, `@${authorUsername} ${response}`);
      
      if (result && result.data?.id) {
        botTweetIds.add(result.data.id);
        if (botTweetIds.size > 1000) {
          const tweetIdsArray = Array.from(botTweetIds);
          botTweetIds = new Set(tweetIdsArray.slice(-500));
        }
      }
    }

    markMentionAsReplied(mention.id);

  } catch (error) {
    console.error('Error processing mention:', error);
    const author = users.find(user => user.id === mention.author_id);
    const authorUsername = author?.username || 'unknown';

    const errorMessage = error instanceof Error ? error.message : String(error);
    if (!errorMessage.includes('429') && !errorMessage.includes('rate limit')) {
      try {
        await replyToTweet(
          mention.id,
          `@${authorUsername} Sorry, I encountered an error processing your request. Please try again later.`
        );
        markMentionAsReplied(mention.id);
      } catch (replyError) {
        console.log(`Could not send error reply due to rate limiting for mention ${mention.id}`);
      }
    }
  }
}

async function postTweetReply(tweetId: string, message: string) {
  const apiKey = process.env.TWITTER_API_KEY;
  const apiSecret = process.env.TWITTER_API_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;

  if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
    console.log('Twitter OAuth credentials not configured for posting replies.');
    return { success: false, reason: 'OAuth credentials not configured' };
  }

  try {
    // Correctly and safely import the library only when this function is called.
    // This avoids the Next.js/Bun hoisting issue during startup.

    const TwitterApi = await getTwitterApiClient();

    const oauthClient = new TwitterApi({
      appKey: apiKey,
      appSecret: apiSecret,
      accessToken: accessToken,
      accessSecret: accessTokenSecret,
    });

    const botUserId = await getJarvisUserId();
    
    const { data } = await oauthClient.v2.tweet({
      text: message,
      reply: {
        in_reply_to_tweet_id: tweetId,
        exclude_reply_user_ids: [botUserId]
      }
    });
    
    return { success: true, data };

  } catch (error: any) {
    console.error('Error posting tweet reply:', error);
    const errorDetail = {
      title: error.data?.title,
      detail: error.data?.detail,
      type: error.data?.type,
      status: error.data?.status
    };
    return { success: false, reason: errorDetail };
  }
}

async function replyToTweet(tweetId: string, message: string) {
  try {
    const maxLength = 280;

    if (message.length <= maxLength) {
      const result = await postTweetReply(tweetId, message);

      if (result.success === false) {
        console.log(`Could not reply to tweet ${tweetId}: ${JSON.stringify(result.reason)}`);
        return result;
      }

      console.log(`Successfully replied to tweet ${tweetId} with ID: ${result.data?.id}`);
      return result;
    }

    const truncatedMessage = truncateAtWordBoundary(message, maxLength - 3) + '...';

    const result = await postTweetReply(tweetId, truncatedMessage);

    if (result.success === false) {
      console.log(`Could not reply to tweet ${tweetId}: ${JSON.stringify(result.reason)}`);
      return result;
    }

    console.log(`Successfully replied to tweet ${tweetId} with ID: ${result.data?.id} (truncated from ${message.length} to ${truncatedMessage.length} chars)`);
    return result;
  } catch (error) {
    console.error('Error replying to tweet:', error);
    return { success: false, reason: 'Exception occurred' };
  }
}

function truncateAtWordBoundary(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  const truncated = text.substring(0, maxLength);
  const lastSpaceIndex = truncated.lastIndexOf(' ');

  if (lastSpaceIndex > maxLength * 0.7) {
    return truncated.substring(0, lastSpaceIndex);
  }

  return truncated;
}
