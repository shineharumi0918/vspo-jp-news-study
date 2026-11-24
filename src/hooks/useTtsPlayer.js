import { useCallback, useEffect, useState } from 'react';
import {
  getActiveSpeakingId,
  isTtsSupported,
  speakJapanese,
  stopSpeaking,
  subscribeActiveSpeakingId,
} from '../utils/tts';

export function useTtsPlayer({ rate = 1.0, onNoVoice } = {}) {
  const [speakingId, setSpeakingId] = useState(getActiveSpeakingId);
  const ttsAvailable = isTtsSupported();

  useEffect(() => subscribeActiveSpeakingId(setSpeakingId), []);

  const toggleSpeak = useCallback(
    (id, text) => {
      if (getActiveSpeakingId() === id) {
        stopSpeaking();
        return;
      }
      speakJapanese(text, { id, rate, onNoVoice });
    },
    [rate, onNoVoice]
  );

  return { speakingId, ttsAvailable, toggleSpeak, stopSpeaking };
}
