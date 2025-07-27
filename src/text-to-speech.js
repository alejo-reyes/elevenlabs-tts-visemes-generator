import fs from 'fs/promises';
import { Buffer } from 'buffer';
import path from 'path';
import { dictionary } from 'cmu-pronouncing-dictionary';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { distance as levenshteinDistance } from 'fastest-levenshtein';
import {} from 'dotenv/config';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVEN_LABS_API_KEY
});

const inputTextPath = path.join('./input', 'speech.txt');

let message;
try {
  message = await fs.readFile(inputTextPath, 'utf8');
  if (!message.trim()) throw new Error('Input text file is empty.');
} catch (err) {
  console.error(`❌ Error: Could not read input text file at ${inputTextPath}.`);
  console.error('Please provide a valid text file in /input/speech.txt.');
  process.exit(1);
}

const voiceId = process.env.ELEVEN_LABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
const argv = yargs(hideBin(process.argv))
  .option('output', {
    alias: 'o',
    type: 'string',
    description: 'Output directory and base filename (e.g. ./output/myfile)',
    default: './output/speech_longer'
  })
  .help()
  .argv;

const outputDir = path.dirname(argv.output);
const filenameBase = path.basename(argv.output);
const outputMP3Path = path.join(outputDir, `${filenameBase}.mp3`);
const outputVisemePath = path.join(outputDir, `${filenameBase}_viseme_data.json`);

// === Step 1: Ensure output dir exists ===
await fs.mkdir(outputDir, { recursive: true });

// === Step 2: Generate audio + alignment ===
const reqObj = {
  text: message,
  voice_settings: {
    style: 1,
    stability: 0.3,
    similarity_boost: 0.4,
    use_speaker_boost: false,
    speed: 0.33
  },
  modelId: 'eleven_flash_v2_5'
};

const response = await elevenlabs.textToSpeech.convertWithTimestamps(voiceId, reqObj);

// === Step 3: Save MP3 ===
await fs.writeFile(outputMP3Path, Buffer.from(response.audioBase64, 'base64'));
console.log(`🎵 MP3 saved to: ${outputMP3Path}`);

function findClosestWord(word) {
  let bestMatch = null;
  let bestDistance = Infinity;

  for (const candidate of Object.keys(dictionary)) {
    const dist = levenshteinDistance(word, candidate);

    if (dist < bestDistance) {
      bestMatch = candidate;
      bestDistance = dist;
    }

    if (dist === 0) break;
  }

  const threshold = Math.max(2, Math.floor(word.length * 0.3));
  return bestDistance <= threshold ? bestMatch : null;
}

// === Step 4: Extract word-level timestamps ===
function extractWordsWithTimestamps(normalizedAlignment) {
  const { characters, characterStartTimesSeconds, characterEndTimesSeconds } = normalizedAlignment;

  const words = [];
  let currentWord = '';
  let currentStart = null;
  let currentEnd = null;

  for (let i = 0; i < characters.length; i++) {
    const char = characters[i];
    const start = characterStartTimesSeconds[i];
    const end = characterEndTimesSeconds[i];

    if (/\w/.test(char)) {
      if (!currentWord) currentStart = start;
      currentWord += char;
      currentEnd = end;
    } else if (char === ' ' || /[\.\,\!\?\:\;]/.test(char)) {
      if (currentWord) {
        words.push({ text: currentWord, start: currentStart, end: currentEnd });
        currentWord = '';
      }
    }
  }

  if (currentWord) {
    words.push({ text: currentWord, start: currentStart, end: currentEnd });
  }

  return words;
}

const words = extractWordsWithTimestamps(response.normalizedAlignment);

// === Step 5: Map words to phonemes ===
function mapWordsToPhonemes(words) {
  return words.map(({ text, start, end }) => {
    const wordLower = text.toLowerCase();
    let phonemeString = dictionary[wordLower];

    if (!phonemeString) {
      const closest = findClosestWord(wordLower);
      if (closest) {
        phonemeString = dictionary[closest];
        console.warn(`⚠️ Substituted "${text}" with similar word "${closest}"`);
      } else {
        console.warn(`⚠️ Word not found and no close match: "${text}" — using [SIL]`);
        return { word: text, start, end, phonemes: ['SIL'] };
      }
    }

    return {
      word: text,
      start,
      end,
      phonemes: phonemeString.split(' ')
    };
  });
}

const wordPhonemes = mapWordsToPhonemes(words);

// === Step 6: Phoneme to viseme mapping ===
const PHONEME_TO_VISEME = {
  SIL: { viseme: 'Vis_sil_M', duration: 80 },
  UH0: { viseme: 'Vis_U_M', duration: 100 },
  UH1: { viseme: 'Vis_U_M', duration: 100 },
  UW0: { viseme: 'Vis_U_M', duration: 100 },
  UW1: { viseme: 'Vis_U_M', duration: 100 },
  AO0: { viseme: 'Vis_O_M', duration: 100 },
  AO1: { viseme: 'Vis_O_M', duration: 100 },
  OW1: { viseme: 'Vis_O_M', duration: 100 },
  IH1: { viseme: 'Vis_I_M', duration: 90 },
  IY1: { viseme: 'Vis_I_M', duration: 90 },
  EH1: { viseme: 'Vis_E_M', duration: 90 },
  EY1: { viseme: 'Vis_E_M', duration: 90 },
  AA1: { viseme: 'Vis_aa_M', duration: 100 },
  AE1: { viseme: 'Vis_aa_M', duration: 100 },
  R: { viseme: 'Vis_RR_M', duration: 80 },
  ER0: { viseme: 'Vis_RR_M', duration: 80 },
  N: { viseme: 'Vis_nn_M', duration: 70 },
  M: { viseme: 'Vis_nn_M', duration: 70 },
  NG: { viseme: 'Vis_nn_M', duration: 70 },
  S: { viseme: 'Vis_SS_M', duration: 60 },
  Z: { viseme: 'Vis_SS_M', duration: 60 },
  CH: { viseme: 'Vis_CH_M', duration: 90 },
  JH: { viseme: 'Vis_CH_M', duration: 90 },
  K: { viseme: 'Vis_kk_M', duration: 70 },
  G: { viseme: 'Vis_kk_M', duration: 70 },
  D: { viseme: 'Vis_DD_M', duration: 70 },
  T: { viseme: 'Vis_DD_M', duration: 70 },
  TH: { viseme: 'Vis_TH_M', duration: 70 },
  DH: { viseme: 'Vis_TH_M', duration: 70 },
  F: { viseme: 'Vis_FF_M', duration: 70 },
  V: { viseme: 'Vis_FF_M', duration: 70 },
  P: { viseme: 'Vis_PP_M', duration: 70 },
  B: { viseme: 'Vis_PP_M', duration: 70 }
};

function mapPhonemesToVisemes(wordPhonemes) {
  const visemes = [];

  for (const { start, end, phonemes } of wordPhonemes) {
    const wordDuration = end - start;
    const mapped = phonemes.map(p => PHONEME_TO_VISEME[p] || PHONEME_TO_VISEME.SIL);
    const total = mapped.reduce((sum, p) => sum + p.duration, 0);
    let t = start;

    for (const { viseme, duration } of mapped) {
      const fraction = duration / total;
      const visemeStart = t;
      const visemeEnd = visemeStart + fraction * wordDuration;
      visemes.push({ timestamp: Math.round(visemeStart * 1000), viseme });
      t = visemeEnd;
    }
  }

  return visemes;
}

const visemeTrack = mapPhonemesToVisemes(wordPhonemes);

// === Step 7: Save viseme track to .json file ===
await fs.writeFile(outputVisemePath, JSON.stringify(visemeTrack, null, 2));
console.log(`📝 Viseme data saved to: ${outputVisemePath}`);
