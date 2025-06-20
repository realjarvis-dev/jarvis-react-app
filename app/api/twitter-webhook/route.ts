import { NextRequest, NextResponse } from 'next/server';
import { processTwitterQuery } from '@/lib/utils/twitter-query-processor';


interface TwitterWebhookEvent {
  tweet_create_events?: Array<{
    id_str: string;
    text: string;
    user: {
      id_str: string;
      screen_name: string;
    };
    in_reply_to_status_id_str?: string;
    entities: {
      user_mentions: Array<{
        screen_name: string;
        id_str: string;
      }>;
    };
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const body: TwitterWebhookEvent = await request.json();
    console.log('Webhook received payload:', JSON.stringify(body, null, 2));
    
    if (body.tweet_create_events) {
      console.log(`Processing ${body.tweet_create_events.length} tweet events`);
      for (const tweet of body.tweet_create_events) {
        await processMention(tweet);
      }
    } else {
      console.log('No tweet_create_events in payload');
    }

    return NextResponse.json({ status: 'success' });
  } catch (error) {
    console.error('Twitter webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function processMention(tweet: any) {
  try {
    console.log(`Processing tweet from @${tweet.user.screen_name}: "${tweet.text}"`);
    console.log('User mentions:', tweet.entities.user_mentions.map((m: any) => m.screen_name));
    
    const jarvisMention = tweet.entities.user_mentions.find(
      (mention: any) => mention.screen_name.toLowerCase() === 'jarviscryptoai'
    );
    
    if (!jarvisMention) {
      console.log('No @JarvisCryptoAI mention found, skipping');
      return;
    }

    const botUserId = process.env.TWITTER_BOT_USER_ID;
    console.log(`Bot user ID: ${botUserId}, Tweet user ID: ${tweet.user.id_str}`);
    if (tweet.user.id_str === botUserId) {
      console.log('Skipping own tweet');
      return;
    }

    const query = tweet.text
      .replace(/@jarviscryptoai\s*/gi, '')
      .replace(/@\w+\s*/g, '')
      .trim();

    if (!query) {
      await replyToTweet(
        tweet.id_str,
        `GM @${tweet.user.screen_name}! 🚀 Drop your crypto research question after tagging @JarvisCryptoAI and I'll alpha you up! 📈`
      );
      return;
    }

    const response = await processTwitterQuery(query, tweet.user.id_str);
    
    await replyToTweet(tweet.id_str, `@${tweet.user.screen_name} ${response}`);
    
  } catch (error) {
    console.error('Error processing mention:', error);
    await replyToTweet(
      tweet.id_str,
      `@${tweet.user.screen_name} Sorry, I encountered an error processing your request. Please try again later.`
    );
  }
}



function generateOAuthSignature(method: string, url: string, oauthParams: Record<string, string>) {
  const crypto = require('crypto');
  
  const sortedParams = Object.keys(oauthParams)
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(oauthParams[key])}`)
    .join('&');
  
  const signatureBaseString = `${method.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`;
  
  const signingKey = `${encodeURIComponent(process.env.TWITTER_API_SECRET!)}&${encodeURIComponent(process.env.TWITTER_ACCESS_TOKEN_SECRET!)}`;
  
  const signature = crypto.createHmac('sha1', signingKey).update(signatureBaseString).digest('base64');
  
  return signature;
}

async function postTweetReply(tweetId: string, message: string) {
  const crypto = require('crypto');
  const url = 'https://api.twitter.com/2/tweets';
  const method = 'POST';
  
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error('TWITTER_ACCESS_TOKEN environment variable is not set');
  }
  
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: process.env.TWITTER_API_KEY!,
    oauth_token: accessToken,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_version: '1.0'
  };
  
  const signature = generateOAuthSignature(method, url, oauthParams);
  oauthParams.oauth_signature = signature;
  
  const authHeader = 'OAuth ' + Object.keys(oauthParams)
    .map(key => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`)
    .join(', ');
  
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
  const crc_token = url.searchParams.get('crc_token');
  
  if (crc_token) {
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', process.env.TWITTER_WEBHOOK_SECRET || 'fallback_secret');
    hmac.update(crc_token);
    const responseToken = 'sha256=' + hmac.digest('base64');
    
    return NextResponse.json({ response_token: responseToken });
  }
  
  return NextResponse.json({ error: 'Missing crc_token' }, { status: 400 });
}
