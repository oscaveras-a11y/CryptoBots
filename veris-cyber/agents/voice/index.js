// VOICE handles validated audio metadata and delegates speech processing to CORE-owned adapters.
const AUDIO_TYPES = new Set(['audio/wav', 'audio/wave', 'audio/mpeg', 'audio/mp3', 'audio/webm', 'audio/ogg', 'audio/mp4']);
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
export function validateAudio(audio) {
  if (!audio || typeof audio !== 'object' || Array.isArray(audio)) throw new TypeError('invalid_audio');
  if (!AUDIO_TYPES.has(audio.mimeType)) throw new TypeError('unsupported_audio_type');
  if (!Number.isInteger(audio.byteLength) || audio.byteLength < 1 || audio.byteLength > MAX_AUDIO_BYTES) throw new TypeError('invalid_audio_size');
  if (typeof audio.id !== 'string' || !audio.id.trim() || audio.id.length > 256) throw new TypeError('invalid_audio_id');
  return { id: audio.id, mimeType: audio.mimeType, byteLength: audio.byteLength };
}
export default async function voice({ instruction = '', data = {} } = {}, context = {}) {
  if (context.signal?.aborted) throw new Error('voice_aborted');
  const operation = data.operation ?? 'transcribe';
  if (operation === 'transcribe') {
    if (!data.audio) return { status: 'requires_audio', verified: false };
    const audio = validateAudio(data.audio);
    if (typeof context.transcribeAudio !== 'function') return { status: 'requires_audio_adapter', audio, verified: false };
    const response = await context.transcribeAudio({ audio, language: 'pt-BR' }, { signal: context.signal });
    if (context.signal?.aborted) throw new Error('voice_aborted');
    if (typeof response?.text !== 'string' || !response.text.trim() || response.text.length > 4000) throw new Error('invalid_transcription');
    return { status: 'transcribed', text: response.text.trim(), language: response.language ?? 'pt-BR', verified: false };
  }
  if (operation === 'synthesize') {
    const text = typeof data.text === 'string' ? data.text.trim() : '';
    if (!text || text.length > 4000) throw new TypeError('invalid_speech_text');
    if (typeof context.synthesizeSpeech !== 'function') return { status: 'requires_speech_adapter', textLength: text.length, verified: false };
    const response = await context.synthesizeSpeech({ text, language: 'pt-BR' }, { signal: context.signal });
    if (context.signal?.aborted) throw new Error('voice_aborted');
    if (typeof response?.audioId !== 'string' || !response.audioId.trim()) throw new Error('invalid_speech_response');
    return { status: 'speech_ready', audioId: response.audioId, mimeType: response.mimeType ?? null, verified: false };
  }
  throw new TypeError('unsupported_voice_operation');
}
