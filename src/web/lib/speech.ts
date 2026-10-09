import { useCallback, useEffect, useRef, useState } from "react";

// Reconnaissance vocale intégrée au navigateur (Web Speech API) : Chrome / Edge / Safari.
// Absente de Firefox : le bouton micro est alors masqué.

interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type RecognitionCtor = new () => Recognition;

const Ctor: RecognitionCtor | undefined =
  typeof window === "undefined"
    ? undefined
    : ((window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: RecognitionCtor }).webkitSpeechRecognition);

/**
 * Dictée : une phrase par appui (le mode continu répète les résultats sur Chrome Android).
 * onFinal reçoit chaque phrase reconnue ; `interim` montre la transcription en cours.
 */
export function useSpeechRecognition(locale: string, onFinal: (text: string) => void, onError?: (error: string) => void) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const recognition = useRef<Recognition | null>(null);
  const handlers = useRef({ onFinal, onError });
  handlers.current = { onFinal, onError };

  const stop = useCallback(() => recognition.current?.stop(), []);

  const start = useCallback(() => {
    if (!Ctor) return;
    recognition.current?.abort();
    const rec = new Ctor();
    rec.lang = locale === "en" ? "en-GB" : "fr-FR";
    rec.continuous = false;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let pending = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i]!;
        if (result.isFinal) handlers.current.onFinal(result[0].transcript);
        else pending += result[0].transcript;
      }
      setInterim(pending);
    };
    rec.onerror = (e) => {
      if (e.error !== "no-speech" && e.error !== "aborted") handlers.current.onError?.(e.error);
    };
    rec.onend = () => {
      setListening(false);
      setInterim("");
    };
    recognition.current = rec;
    rec.start();
    setListening(true);
  }, [locale]);

  useEffect(() => () => recognition.current?.abort(), []);

  return { supported: !!Ctor, listening, interim, start, stop };
}
