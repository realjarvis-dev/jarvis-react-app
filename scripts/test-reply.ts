// import dotenv from 'dotenv';
// import path from 'path';
// import { TwitterApi } from 'twitter-api-v2';

// // Load environment variables from .env.local at the root
// dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// async function testTweetReply() {
//   console.log('--- Independent Twitter Reply Test ---');
//   console.log('This script will only verify credentials and will NOT post a public tweet.');

//   const {
//     TWITTER_API_KEY,
//     TWITTER_API_SECRET,
//     TWITTER_ACCESS_TOKEN,
//     TWITTER_ACCESS_TOKEN_SECRET,
//   } = process.env;

//   if (!TWITTER_API_KEY || !TWITTER_API_SECRET || !TWITTER_ACCESS_TOKEN || !TWITTER_ACCESS_TOKEN_SECRET) {
//     console.error('\n❌ Error: Missing one or more required Twitter API credentials in .env.local');
//     console.log('Required: TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_TOKEN_SECRET');
//     return;
//   }

//   console.log('\n✅ Credentials loaded successfully from .env.local');

//   try {
//     console.log(`\nAttempting to create TwitterApi client...`);
//     const client = new TwitterApi({
//       appKey: TWITTER_API_KEY,
//       appSecret: TWITTER_API_SECRET,
//       accessToken: TWITTER_ACCESS_TOKEN,
//       accessSecret: TWITTER_ACCESS_TOKEN_SECRET,
//     });
//     console.log('✅ TwitterApi client created successfully.');

//     console.log(`\nVerifying credentials by fetching your own user profile...`);
//     const { data: verifiedUser } = await client.v2.me();
    
//     console.log('\n--- ✅ SUCCESS! ---');
//     console.log('Authentication successful for user:');
//     console.log(`ID: ${verifiedUser.id}`);
//     console.log(`Name: ${verifiedUser.name}`);
//     console.log(`Username: ${verifiedUser.username}`);
//     console.log('\nThis confirms your credentials and the twitter-api-v2 library are working correctly.');


//   } catch (error) {
//     console.error('\n--- ❌ FAILURE! ---');
//     console.error('An error occurred during the test:');
//     console.error(error);
//   }
// }

// testTweetReply(); 