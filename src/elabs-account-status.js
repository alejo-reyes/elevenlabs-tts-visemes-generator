import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import {} from 'dotenv/config';

const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVEN_LABS_API_KEY
});

async function showSubscriptionStatus() {
  try {
    const user = await elevenlabs.user.get();
    const sub = user.subscription;

    const charactersRemaining = sub.characterLimit - sub.characterCount;

    console.log('\n=== Logged User ===');
    console.log(`ID: ${user.userId}`);
    console.log(`Name: ${user.firstName}\n`);

    console.log('=== ElevenLabs Account Subscription Status ===\n');
    console.table({
      'Plan': sub.tier,
      'Status': sub.status,
      'Character Limit': sub.characterLimit,
      'Characters Used': sub.characterCount,
      'Characters Remaining': charactersRemaining,
      'Next Renewal': sub.nextCharacterCountResetUnix ? new Date(sub.nextCharacterCountResetUnix * 1000).toLocaleString() : 'N/A',
      'Can Extend': sub.canExtendCharacterLimit ? 'Yes' : 'No',
      'Voice Limit': sub.voiceLimit,
      'Voices Used': sub.voiceSlotsUsed,
      'Professional Voice Limit': sub.professionalVoiceLimit,
      'Professional Voices Used': sub.professionalVoiceSlotsUsed,
      'Billing Period': sub.billingPeriod
    });
    console.log('');
  } catch (err) {
    console.error('❌ Error fetching ElevenLabs subscription status:', err.message);
    process.exit(1);
  }
}

showSubscriptionStatus();