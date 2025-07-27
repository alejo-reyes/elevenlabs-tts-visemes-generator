import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import {} from 'dotenv/config';

const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVEN_LABS_API_KEY
});

function truncate(str, maxLength = 40) {
  if (!str) return '';
  return str.length > maxLength ? str.slice(0, maxLength - 3) + '...' : str;
}

async function listVoices() {
  try {
    const result = await elevenlabs.voices.search();
    const voices = result.voices;

    if (!voices || !voices.length) {
      console.log('No voices found for this account.');
      return;
    }

    const tableData = voices.map(v => ({
      'Voice Name': truncate(v.name, 20),
      'Voice ID': truncate(v.voiceId, 20),
      'Category': truncate(v.category, 15),
      'Description': truncate(v.description, 30),
      'Preview': truncate(v.previewUrl, 40)
    }));

    console.log('\n=== ElevenLabs Available Voices ===\n');
    console.table(tableData);
    console.log('');
  } catch (err) {
    console.error('❌ Error fetching ElevenLabs voices:', err.message);
    process.exit(1);
  }
}

listVoices();