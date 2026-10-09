// Local Whisper.cpp + Piper adapters. No shell, no network, no implicit installation.
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

function execute(binary, args, { input, signal, timeoutMs = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], signal });
    const output = [], errors = [];
    let settled = false;
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.stdout.on('data', chunk => output.push(chunk));
    child.stderr.on('data', chunk => errors.push(chunk));
    child.on('error', fail);
    child.on('close', code => code === 0 ? finish(null, Buffer.concat(output)) : fail(new Error('audio_engine_failed_' + code + ': ' + Buffer.concat(errors).toString('utf8').slice(0, 200))));
    child.stdin.on('error', () => {});
    child.stdin.end(input);
    function finish(error, result) { if (settled) return; settled = true; clearTimeout(timer); error ? reject(error) : resolve(result); }
    function fail(error) { finish(error); }
  });
}
export function createLocalVoiceAdapters({ whisperBinary, whisperModel, piperBinary, piperModel, loadAudio, saveAudio } = {}) {
  if (typeof loadAudio !== 'function' || typeof saveAudio !== 'function') throw new TypeError('audio_storage_callbacks_required');
  return {
    async transcribeAudio({ audio }, { signal } = {}) {
      if (!whisperBinary || !whisperModel) throw new Error('whisper_not_configured');
      const bytes = await loadAudio(audio.id);
      if (!Buffer.isBuffer(bytes) || bytes.length !== audio.byteLength) throw new Error('audio_payload_mismatch');
      // whisper.cpp CLI expects 16 kHz mono PCM WAV; callers must normalize audio before storage.
      if (audio.mimeType !== 'audio/wav' && audio.mimeType !== 'audio/wave') throw new Error('whisper_requires_pcm_wav');
      const dir = await mkdtemp(join(tmpdir(), 'veris-whisper-'));
      try {
        const file = join(dir, 'input.wav');
        await writeFile(file, bytes);
        await execute(whisperBinary, ['-m', whisperModel, '-f', file, '-l', 'pt', '-nt', '-otxt', '-of', join(dir, 'transcript')], { signal });
        const text = (await readFile(join(dir, 'transcript.txt'), 'utf8')).trim();
        if (!text) throw new Error('empty_transcription');
        return { text, language: 'pt-BR' };
      } finally { await rm(dir, { recursive: true, force: true }); }
    },
    async synthesizeSpeech({ text }, { signal } = {}) {
      if (!piperBinary || !piperModel) throw new Error('piper_not_configured');
      const dir = await mkdtemp(join(tmpdir(), 'veris-piper-'));
      try {
        const file = join(dir, 'speech.wav');
        await execute(piperBinary, ['--model', piperModel, '--output_file', file], { input: Buffer.from(text, 'utf8'), signal });
        const bytes = await readFile(file);
        if (!bytes.length) throw new Error('empty_speech_audio');
        const audioId = randomUUID();
        await saveAudio(audioId, bytes, 'audio/wav');
        return { audioId, mimeType: 'audio/wav' };
      } finally { await rm(dir, { recursive: true, force: true }); }
    }
  };
}
