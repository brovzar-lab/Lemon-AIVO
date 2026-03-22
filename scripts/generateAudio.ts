/**
 * Generate minimal placeholder WAV audio files for the Boiler Room app.
 *
 * Creates tiny silent/near-silent WAV files as placeholders.
 * These should be replaced with real sounds from freesound.org for production.
 *
 * Usage: npx tsx scripts/generateAudio.ts
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const AUDIO_DIR = join(__dirname, '..', 'public', 'audio');

/** Creates a minimal valid WAV file with the given parameters */
function createWav(
  sampleRate: number,
  durationSec: number,
  generator: (t: number, sampleRate: number) => number,
): Buffer {
  const numSamples = Math.floor(sampleRate * durationSec);
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = numSamples * blockAlign;

  // WAV header is 44 bytes
  const buffer = Buffer.alloc(44 + dataSize);
  let offset = 0;

  // RIFF header
  buffer.write('RIFF', offset); offset += 4;
  buffer.writeUInt32LE(36 + dataSize, offset); offset += 4;
  buffer.write('WAVE', offset); offset += 4;

  // fmt sub-chunk
  buffer.write('fmt ', offset); offset += 4;
  buffer.writeUInt32LE(16, offset); offset += 4;          // Sub-chunk size
  buffer.writeUInt16LE(1, offset); offset += 2;           // PCM format
  buffer.writeUInt16LE(numChannels, offset); offset += 2;
  buffer.writeUInt32LE(sampleRate, offset); offset += 4;
  buffer.writeUInt32LE(byteRate, offset); offset += 4;
  buffer.writeUInt16LE(blockAlign, offset); offset += 2;
  buffer.writeUInt16LE(bitsPerSample, offset); offset += 2;

  // data sub-chunk
  buffer.write('data', offset); offset += 4;
  buffer.writeUInt32LE(dataSize, offset); offset += 4;

  // Generate audio samples
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.max(-1, Math.min(1, generator(t, sampleRate)));
    const intSample = Math.floor(sample * 32767);
    buffer.writeInt16LE(intSample, offset);
    offset += 2;
  }

  return buffer;
}

// Ensure output directory exists
mkdirSync(AUDIO_DIR, { recursive: true });

// 1. ambient-office.wav: 5-second loopable low hum (very quiet sine + noise)
const ambient = createWav(22050, 5, (t) => {
  const sine = Math.sin(2 * Math.PI * 60 * t) * 0.02;
  const noise = (Math.random() * 2 - 1) * 0.005;
  return sine + noise;
});
writeFileSync(join(AUDIO_DIR, 'ambient-office.mp3'), ambient);

// 2. sfx-footstep.wav: 0.1s short tap
const footstep = createWav(22050, 0.1, (t) => {
  const decay = Math.exp(-t * 80);
  const click = (Math.random() * 2 - 1) * decay * 0.4;
  return click;
});
writeFileSync(join(AUDIO_DIR, 'sfx-footstep.mp3'), footstep);

// 3. sfx-knock.wav: 0.3s two-tap knock
const knock = createWav(22050, 0.3, (t) => {
  const hit1 = t < 0.05 ? Math.exp(-t * 100) * Math.sin(2 * Math.PI * 200 * t) * 0.5 : 0;
  const t2 = t - 0.15;
  const hit2 = t2 > 0 && t2 < 0.05 ? Math.exp(-t2 * 100) * Math.sin(2 * Math.PI * 180 * t2) * 0.4 : 0;
  return hit1 + hit2;
});
writeFileSync(join(AUDIO_DIR, 'sfx-knock.mp3'), knock);

// 4. sfx-paper.wav: 0.2s filtered noise burst
const paper = createWav(22050, 0.2, (t) => {
  const decay = Math.exp(-t * 20);
  const noise = (Math.random() * 2 - 1) * decay * 0.3;
  return noise;
});
writeFileSync(join(AUDIO_DIR, 'sfx-paper.mp3'), paper);

// 5. sfx-chime.wav: 0.5s two-note chime (C5 + E5)
const chime = createWav(22050, 0.5, (t) => {
  const decay = Math.exp(-t * 5);
  const c5 = Math.sin(2 * Math.PI * 523 * t) * 0.3;
  const e5 = Math.sin(2 * Math.PI * 659 * t) * 0.2;
  return (c5 + e5) * decay;
});
writeFileSync(join(AUDIO_DIR, 'sfx-chime.mp3'), chime);

console.log('Audio placeholder files generated in public/audio/');
console.log('NOTE: These are WAV data saved as .mp3 for path consistency.');
console.log('Replace with real sounds from freesound.org for production.');
