import { NextRequest, NextResponse } from 'next/server';
import { TwitterApi } from 'twitter-api-v2';
import { processTwitterQuery } from '@/lib/utils/twitter-query-processor';

const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY!,
  appSecret: process.env.TWITTER_API_SECRET!,
  accessToken: process.env.TWITTER_ACCESS_TOKEN!,
  accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET!,
});

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
    
    if (body.tweet_create_events) {
      for (const tweet of body.tweet_create_events) {
        await processMention(tweet);
      }
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
    const jarvisMention = tweet.entities.user_mentions.find(
      (mention: any) => mention.screen_name.toLowerCase() === 'jarvis'
    );
    
    if (!jarvisMention) {
      return;
    }

    const botUserId = process.env.TWITTER_BOT_USER_ID;
    if (tweet.user.id_str === botUserId) {
      return;
    }

    const query = tweet.text
      .replace(/@jarvis\s*/gi, '')
      .replace(/@\w+\s*/g, '')
      .trim();

    if (!query) {
      await replyToTweet(
        tweet.id_str,
        `Hi @${tweet.user.screen_name}! Please include your investment research question after mentioning @jarvis.`
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



async function replyToTweet(tweetId: string, message: string) {
  try {
    const maxLength = 280;
    const truncatedMessage = message.length > maxLength 
      ? message.substring(0, maxLength - 3) + '...'
      : message;

    await twitterClient.v2.reply(truncatedMessage, tweetId);
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
    const hmac = crypto.createHmac('sha256', process.env.TWITTER_WEBHOOK_SECRET!);
    hmac.update(crc_token);
    const responseToken = 'sha256=' + hmac.digest('base64');
    
    return NextResponse.json({ response_token: responseToken });
  }
  
  return NextResponse.json({ error: 'Missing crc_token' }, { status: 400 });
}
