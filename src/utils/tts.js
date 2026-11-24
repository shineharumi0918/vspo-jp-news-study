const PREFERRED_JA_VOICE_PATTERNS = [
  /nanami/i,
  /keita/i,
  /google\s*日本語/i,
  /google\s*japanese/i,
  /kyoko/i,
  /otoya/i,
  /o-ren/i,
  /haruka/i,
  /ayumi/i,
  /ichiro/i,
];

let cachedVoices = [];
let listenerAttached = false;
const statusSubscribers = new Set();
let activeSpeakingId = null;
let activeUtteranceSeq = 0;
const speakingSubscribers = new Set();

function setActiveSpeakingId(nextId) {
  if (activeSpeakingId === nextId) return;
  activeSpeakingId = nextId;
  for (const cb of speakingSubscribers) {
    cb(activeSpeakingId);
  }
}

export function getActiveSpeakingId() {
  return activeSpeakingId;
}

export function subscribeActiveSpeakingId(listener) {
  speakingSubscribers.add(listener);
  return () => {
    speakingSubscribers.delete(listener);
  };
}

export function isTtsSupported() {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof SpeechSynthesisUtterance !== 'undefined'
  );
}

export function isJapaneseVoice(voice) {
  if (!voice) return false;
  const lang = String(voice.lang || '').trim().toLowerCase();
  const name = String(voice.name || '').trim();
  if (/^ja([-_]|$)/.test(lang)) return true;
  return /japanese|日本語/i.test(name);
}

export function selectJapaneseVoice(voices = []) {
  const jaVoices = (voices || []).filter(isJapaneseVoice);
  if (jaVoices.length === 0) return null;

  for (const pattern of PREFERRED_JA_VOICE_PATTERNS) {
    const preferred = jaVoices.find((v) => pattern.test(v.name || ''));
    if (preferred) return preferred;
  }

  return jaVoices.find((v) => /^ja[-_]jp$/i.test(v.lang || '')) || jaVoices[0];
}

function refreshVoices() {
  if (!isTtsSupported()) return [];
  try {
    cachedVoices = window.speechSynthesis.getVoices() || [];
  } catch {
    cachedVoices = [];
  }
  return cachedVoices;
}

function notifySubscribers() {
  const status = getTtsStatus();
  for (const cb of statusSubscribers) {
    cb(status);
  }
}

function attachVoiceListener() {
  if (!isTtsSupported() || listenerAttached) return;
  listenerAttached = true;
  refreshVoices();
  try {
    window.speechSynthesis.addEventListener('voiceschanged', () => {
      refreshVoices();
      notifySubscribers();
    });
  } catch {
    window.speechSynthesis.onvoiceschanged = () => {
      refreshVoices();
      notifySubscribers();
    };
  }
}

export function getTtsStatus() {
  if (!isTtsSupported()) {
    return { supported: false, hasJapaneseVoice: false, voiceName: null, voicesLoaded: true };
  }
  attachVoiceListener();
  const voices = cachedVoices.length > 0 ? cachedVoices : refreshVoices();
  const jaVoice = selectJapaneseVoice(voices);
  return {
    supported: true,
    hasJapaneseVoice: Boolean(jaVoice),
    voiceName: jaVoice?.name || null,
    voicesLoaded: voices.length > 0,
  };
}

export function subscribeTtsStatus(listener) {
  if (!isTtsSupported()) return () => {};
  attachVoiceListener();
  statusSubscribers.add(listener);
  return () => {
    statusSubscribers.delete(listener);
  };
}

export function ensureJapaneseVoice(timeoutMs = 700) {
  if (!isTtsSupported()) return Promise.resolve(null);
  attachVoiceListener();

  const existing = selectJapaneseVoice(refreshVoices());
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
      } catch {
        // ignore
      }
      resolve(selectJapaneseVoice(refreshVoices()));
    };

    const onVoicesChanged = () => {
      if (refreshVoices().length > 0) {
        finish();
      }
    };

    const timer = setTimeout(finish, timeoutMs);
    try {
      window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);
    } catch {
      finish();
    }
  });
}

export function stopSpeaking() {
  activeUtteranceSeq += 1;
  setActiveSpeakingId(null);
  if (!isTtsSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // 忽略瀏覽器語音引擎例外
  }
}

export async function speakJapanese(text, { id = null, rate = 1.0, onStart, onEnd, onNoVoice } = {}) {
  if (!isTtsSupported() || !text) {
    if (onEnd) onEnd();
    return { ok: false, reason: 'unsupported' };
  }

  const seq = ++activeUtteranceSeq;
  if (id !== null) {
    setActiveSpeakingId(id);
  }

  const jaVoice = await ensureJapaneseVoice();
  if (seq !== activeUtteranceSeq) {
    return { ok: false, reason: 'superseded' };
  }

  if (!jaVoice) {
    setActiveSpeakingId(null);
    if (onEnd) onEnd();
    if (onNoVoice) onNoVoice(String(text));
    return { ok: false, reason: 'no-ja-voice' };
  }

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(String(text));
    utterance.voice = jaVoice;
    utterance.lang = jaVoice.lang || 'ja-JP';
    utterance.rate = rate;

    const handleFinish = () => {
      if (seq === activeUtteranceSeq) {
        setActiveSpeakingId(null);
      }
      if (onEnd) onEnd();
    };

    if (onStart) utterance.onstart = onStart;
    utterance.onend = handleFinish;
    utterance.onerror = handleFinish;

    window.speechSynthesis.speak(utterance);
    return { ok: true, voiceName: jaVoice.name };
  } catch {
    if (seq === activeUtteranceSeq) {
      setActiveSpeakingId(null);
    }
    if (onEnd) onEnd();
    return { ok: false, reason: 'error' };
  }
}

export function buildGoogleTranslateAudioLink(text) {
  return `https://translate.google.com/?sl=ja&tl=zh-TW&text=${encodeURIComponent(String(text || ''))}&op=translate`;
}

export function parseTimestampToSeconds(timestamp = '') {
  const match = String(timestamp).trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  if (match[3] !== undefined) {
    return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
  }
  return Number(match[1]) * 60 + Number(match[2]);
}
