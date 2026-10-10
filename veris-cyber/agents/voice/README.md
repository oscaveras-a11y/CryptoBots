# VOICE: integração local (Windows/Linux)

O CORE já aceita `audioTranscriber` e `speechSynthesizer` no construtor. O arquivo `agents/voice/local-adapters.js` implementa adaptadores para **whisper.cpp** (transcrição) e **Piper** (fala).

## Pré-requisitos

1. Instalar os executáveis de whisper.cpp e Piper de fontes oficiais, compatíveis com o sistema.
2. Baixar um modelo de transcrição Whisper e uma voz Piper para português brasileiro. Verificar licenças e requisitos de cada modelo.
3. Fornecer caminhos absolutos dos executáveis e modelos. Nada é baixado automaticamente.
4. Implementar `loadAudio(id)` e `saveAudio(id, bytes, mimeType)` em armazenamento local controlado pelo aplicativo. Não usar IDs recebidos do usuário como caminhos de arquivo.
5. Antes de transcrever, converter a gravação para WAV PCM mono 16 kHz (por exemplo, com ffmpeg em um módulo de captura controlado). O adaptador rejeita outros formatos.

## Conexão

```js
import { VerisCore } from './core/src/index.js';
import { createLocalVoiceAdapters } from './agents/voice/local-adapters.js';

const adapters = createLocalVoiceAdapters({
  whisperBinary: 'CAMINHO_ABSOLUTO_WHISPER_CLI',
  whisperModel: 'CAMINHO_ABSOLUTO_MODELO_WHISPER',
  piperBinary: 'CAMINHO_ABSOLUTO_PIPER',
  piperModel: 'CAMINHO_ABSOLUTO_VOZ_PIPER',
  loadAudio: async id => audioStore.get(id),
  saveAudio: async (id, bytes, mimeType) => audioStore.set(id, bytes)
});
const core = new VerisCore({
  audioTranscriber: adapters.transcribeAudio,
  speechSynthesizer: adapters.synthesizeSpeech
});
// core.processVoice({ audio: { id, mimeType: 'audio/wav', byteLength } })
// core.speak('Olá, como posso ajudar?')
```

O exemplo pressupõe que `audioStore` já foi criado pela aplicação. O CORE não abre microfone, não reproduz áudio nem instala motores por conta própria. A resposta de `processVoice` é informativa: comandos que alteram o sistema continuam exigindo autorização e escopo no fluxo de execução do CORE. Falta testar com os binários reais no computador de destino.
