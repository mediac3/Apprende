"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Hook de reconocimiento de voz (Web Speech API, nativa del navegador).
// Estrategia decidida: SOLO Web Speech API. Si el navegador no la soporta,
// el consumidor oculta el botón de micrófono y muestra un aviso.

// Tipos mínimos de la Web Speech API (lib.dom no los incluye en TS 5.9).
type SpeechRecognitionAlternative = { transcript: string; confidence: number };
type SpeechRecognitionResultLike = {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternative;
};
type SpeechRecognitionResultListLike = {
  length: number;
  [index: number]: SpeechRecognitionResultLike;
};
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
};
type SpeechRecognitionErrorEventLike = { error: string; message?: string };
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function isSpeechSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
}

function mapError(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Permiso de micrófono denegado. Habilítalo en el navegador.";
    case "no-speech":
      return "No se detectó voz. Intenta de nuevo.";
    case "network":
      return "Error de red durante el reconocimiento de voz.";
    case "audio-capture":
      return "No se encontró micrófono.";
    default:
      return `Error de reconocimiento de voz (${code}).`;
  }
}

export function useSpeechRecognition(lang: string = "es-CO") {
  const [isSupported] = useState(isSpeechSupported);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState(""); // texto final consolidado
  const [interimTranscript, setInterimTranscript] = useState(""); // transcripción en vivo
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setError("Dictado no soportado en este navegador.");
      return;
    }
    setError(null);
    setTranscript("");
    setInterimTranscript("");
    try {
      const rec = new Ctor();
      rec.lang = lang;
      rec.continuous = false;
      rec.interimResults = true;
      rec.onresult = (event) => {
        let finalText = "";
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) finalText += result[0].transcript;
          else interim += result[0].transcript;
        }
        if (finalText) setTranscript((prev) => (prev + " " + finalText).trim());
        setInterimTranscript(interim);
      };
      rec.onerror = (event) => {
        if (event.error === "aborted") return; // stop() intencional del usuario
        setError(mapError(event.error));
        setIsRecording(false);
      };
      rec.onend = () => setIsRecording(false);
      recognitionRef.current = rec;
      rec.start();
      setIsRecording(true);
    } catch {
      setError("No se pudo iniciar el micrófono.");
      setIsRecording(false);
    }
  }, [lang]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const reset = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
    setError(null);
  }, []);

  // Cleanup al desmontar: corta cualquier sesión activa.
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  return { isSupported, isRecording, transcript, interimTranscript, error, start, stop, reset };
}
