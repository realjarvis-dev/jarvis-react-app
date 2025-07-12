import { createChatWithShareableLink } from './chat-creator';
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
  const hasReplied = repliedMentions.has(mentionId);
  console.log(`🔍 Checking if already replied to ${mentionId}: ${hasReplied}`);
  return hasReplied;
}

export function markMentionAsReplied(mentionId: string): void {
  console.log(`🔒 Marking mention ${mentionId} as replied (total tracked: ${repliedMentions.size})`);
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

    if (resetTime) {
      const resetTimestamp = parseInt(resetTime, 10) * 1000;
      const waitTime = Math.max(resetTimestamp - Date.now(), 60000); // Wait at least 1 minute
      console.log(`Waiting ${Math.round(waitTime / 1000)}s for rate limit reset...`);

      const maxWaitTime = operation === 'postTweetReply' ? 20 * 60 * 1000 : 15 * 60 * 1000;

      if (waitTime <= maxWaitTime) {
        setRateLimitReset(resetTimestamp);
        await sleep(waitTime);
        return true; // Indicate we should retry
      } else {
        console.log(`Wait time too long (${Math.round(waitTime / 1000)}s), skipping retry for ${operation}`);
        setRateLimitReset(resetTimestamp);
        return false;
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

  const isBotReply = mention.text.includes('@') &&   
                    mention.text.match(/^@\w+\s+/) && // Starts with @username  
                    (mention.text.includes('🚀') || mention.text.includes('📊') || mention.text.includes('📈')); // Contains bot emojis
  
  if (isBotReply) {
    return { shouldFilter: true, reason: 'Potential bot reply based on content pattern' };
  }

  if (author.created_at) {
    const accountAge = Date.now() - new Date(author.created_at).getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    if (accountAge < sevenDaysMs) {
      return { shouldFilter: true, reason: `Account too new (${Math.round(accountAge / (24 * 60 * 60 * 1000))} days old)` };
    }
  }

  // if (author.public_metrics && author.public_metrics.followers_count < 5) {
  //   return { shouldFilter: true, reason: `Too few followers (${author.public_metrics.followers_count})` };
  // }

  const mentionCount = (mention.text.match(/@\w+/g) || []).length;
  if (mentionCount > 3) {
    return { shouldFilter: true, reason: `Too many mentions (${mentionCount})` };
  }

  const spamKeywords = [
    'check out', 'follow me', 'dm me', 'link in bio', 'check my profile',
    'follow for follow', 'f4f', 'follow back', 'check this out',
    'visit my page', 'click link', 'see my bio', 'promotion', 'giveaway'
  ];
  
  const lowerText = mention.text.toLowerCase();
  for (const keyword of spamKeywords) {
    if (lowerText.includes(keyword)) {
      return { shouldFilter: true, reason: `Contains spam keyword: "${keyword}"` };
    }
  }

  return { shouldFilter: false, reason: '' };
}

export async function processMention(mention: TwitterMention, users: TwitterUser[]) {
  try {
    const author = users.find(user => user.id === mention.author_id);
    const authorUsername = author?.username || 'unknown';

    console.log(`🔍 Processing mention ${mention.id} from @${authorUsername}`);

    // Filter 1: Already replied check
    if (hasRepliedToMention(mention.id)) {
      console.log(`🛑 FILTER 1 - Already replied to mention ${mention.id} from @${authorUsername}`);
      return;
    }

    // Filter 2: Bot replying to itself check (username)
    if (authorUsername === 'JarvisCryptoAI') {
      console.log(`🛑 FILTER 2a - Bot replying to itself (username): ${authorUsername}`);
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

    // Filter 3: Check if this is bot's own tweet by ID
    if (botTweetIds.has(mention.id)) {
      console.log(`🛑 FILTER 3 - Skipping bot's own tweet: ${mention.id} (stored in botTweetIds set of ${botTweetIds.size} IDs)`);
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
      console.log(`🤖 Bot user ID: ${botUserId}, Mention author ID: ${mention.author_id}`);
    } catch (error) {
      console.warn('Could not verify bot user ID, skipping mention processing to prevent recursive loops');
      return;
    }

    // Filter 2b: Bot replying to itself check (user ID)
    if (mention.author_id === botUserId) {
      console.log(`🛑 FILTER 2b - Bot replying to itself (user ID): ${mention.author_id}`);
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
          baseUrl: 'https://app.thejarvis.xyz'
        });

        const reportResponse = `@${authorUsername} 📊 Here's your comprehensive research report: ${result.shareUrl} 

🔗 This detailed analysis includes live data, charts, and actionable insights. Bookmark it for later! 📈`;

        const result_tweet = await replyToTweet(mention.id, reportResponse);
        console.log(`✅ REPORT response sent to @${authorUsername}: ${result.shareUrl}`);
        
        if (result_tweet && (result_tweet.data?.data?.id || result_tweet.data?.id)) {
          const tweetId = result_tweet.data?.data?.id || result_tweet.data?.id;
          console.log(`📝 Storing bot tweet ID for REPORT: ${tweetId}`);
          botTweetIds.add(tweetId);
          if (botTweetIds.size > 1000) {
            const tweetIdsArray = Array.from(botTweetIds);
            botTweetIds = new Set(tweetIdsArray.slice(-500));
          }
        }
        
        console.log(`✅ REPORT reply sent, marking mention ${mention.id} as replied`);
        markMentionAsReplied(mention.id);
        
      } catch (error) {
        console.error('Error processing REPORT request:', error);
        await replyToTweet(
          mention.id,
          `@${authorUsername} Sorry, I encountered an error generating your report. Please try again later. 📊`
        );
        console.log(`❌ REPORT error reply sent, marking mention ${mention.id} as replied`);
        markMentionAsReplied(mention.id);
      }
    } else {
      // Use existing Twitter bot workflow for regular queries
      console.log(`📝 Processing regular query for mention ${mention.id}: "${baseQuery}"`);
      const response = await processTwitterQuery(baseQuery, mention.author_id);
      const result = await replyToTweet(mention.id, `@${authorUsername} ${response}`);
      
      if (result && (result.data?.data?.id || result.data?.id)) {
        const tweetId = result.data?.data?.id || result.data?.id;
        console.log(`📤 Regular reply posted with ID: ${tweetId}`);
        botTweetIds.add(tweetId);
        if (botTweetIds.size > 1000) {
          const tweetIdsArray = Array.from(botTweetIds);
          botTweetIds = new Set(tweetIdsArray.slice(-500));
        }
      }
      console.log(`✅ Regular reply sent, marking mention ${mention.id} as replied`);
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
    console.log('Twitter OAuth credentials not configured for posting replies. Mention detected but cannot reply.');
    console.log('To enable replies, set TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, and TWITTER_ACCESS_TOKEN_SECRET');
    return { success: false, reason: 'OAuth credentials not configured' };
  }
  
  const crypto = require('crypto');
  const url = 'https://api.twitter.com/2/tweets';

  let retryCount = 0;
  const maxRetries = 3; 

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

      const botUserId = await getJarvisUserId();
      const requestBody = {
        text: message,
        reply: {
          in_reply_to_tweet_id: tweetId,
          exclude_reply_user_ids: [botUserId]
        }
      };

      const bodyString = JSON.stringify(requestBody);
      
      const encodedParams = Object.keys(oauthParams)
        .sort()
        .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(oauthParams[key])}`)
        .join('&');

      const baseString = `POST&${encodeURIComponent(url)}&${encodeURIComponent(encodedParams)}`;
      const signingKey = `${encodeURIComponent(apiSecret)}&${encodeURIComponent(accessTokenSecret)}`;
      const signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');

      oauthParams.oauth_signature = signature;

      const authHeader = 'OAuth ' + Object.keys(oauthParams)
        .sort()
        .map(key => `${key}="${encodeURIComponent(oauthParams[key])}"`)
        .join(', ');

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: bodyString
      });

      if (response.ok) {
        const data = await response.json();
        return { success: true, data };
      }

      if (await handleRateLimit(response, 'postTweetReply')) {
        retryCount++;
        continue;
      }

      const errorData = await response.text();
      console.error(`Twitter API error: ${response.status}`);
      console.error('Response Headers:', Object.fromEntries(response.headers.entries()));
      console.error('Error Response Body:', errorData);
      return { success: false, reason: `API error: ${response.status}`, error: errorData };

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
  console.log(`🔄 Attempting to reply to tweet ${tweetId} with message: "${message.substring(0, 50)}..."`);
  try {
    const maxLength = 280;

    if (message.length <= maxLength) {
      const result = await postTweetReply(tweetId, message);

      if (result.success === false) {
        console.log(`Could not reply to tweet ${tweetId}: ${result.reason}`);
        return result;
      }

      console.log(`Successfully replied to tweet ${tweetId} with ID: ${result.data?.data?.id || result.data?.id}`);
      return result;
    }

    const truncatedMessage = truncateAtWordBoundary(message, maxLength - 3) + '...';

    const result = await postTweetReply(tweetId, truncatedMessage);

    if (result.success === false) {
      console.log(`Could not reply to tweet ${tweetId}: ${result.reason}`);
      return result;
    }

    console.log(`Successfully replied to tweet ${tweetId} with ID: ${result.data?.data?.id || result.data?.id} (truncated from ${message.length} to ${truncatedMessage.length} chars)`);
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
