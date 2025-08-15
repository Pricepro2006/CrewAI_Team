import { useState, useRef, useCallback, useEffect } from 'react';

// Speech Recognition types
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((event: Event) => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onspeechstart: ((event: Event) => void) | null;
  onspeechend: ((event: Event) => void) | null;
  onaudiostart: ((event: Event) => void) | null;
  onaudioend: ((event: Event) => void) | null;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
  length: number;
}

interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
  length: number;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message: string;
}

declare global {
  interface Window {
    webkitSpeechRecognition: new() => SpeechRecognition;
    SpeechRecognition: new() => SpeechRecognition;
  }
}

export interface VoiceRecognitionConfig {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
  confidenceThreshold?: number;
  onResult?: (transcript: string, confidence: number, isFinal: boolean) => void;
  onError?: (error: string, message?: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
  onInterimResult?: (transcript: string, confidence: number) => void;
}

export interface VoiceRecognitionState {
  isSupported: boolean;
  isListening: boolean;
  isProcessing: boolean;
  transcript: string;
  interimTranscript: string;
  confidence: number;
  error: string | null;
  browserInfo: {
    hasWebkitSupport: boolean;
    hasNativeSupport: boolean;
    userAgent: string;
  };
}

export interface VoiceRecognitionActions {
  start: () => Promise<void>;
  stop: () => void;
  abort: () => void;
  reset: () => void;
  getAvailableLanguages: () => string[];
  checkBrowserSupport: () => boolean;
  requestPermissions: () => Promise<boolean>;
}

export const useVoiceRecognition = (config: VoiceRecognitionConfig = {}) => {
  const {
    lang = 'en-US',
    continuous = false,
    interimResults = true,
    maxAlternatives = 1,
    confidenceThreshold = 0.7,
    onResult,
    onError,
    onStart,
    onEnd,
    onInterimResult,
  } = config;

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isStartingRef = useRef(false);

  const [state, setState] = useState<VoiceRecognitionState>(() => {
    const hasWebkitSupport = 'webkitSpeechRecognition' in window;
    const hasNativeSupport = 'SpeechRecognition' in window;
    
    return {
      isSupported: hasWebkitSupport || hasNativeSupport,
      isListening: false,
      isProcessing: false,
      transcript: '',
      interimTranscript: '',
      confidence: 0,
      error: null,
      browserInfo: {
        hasWebkitSupport,
        hasNativeSupport,
        userAgent: navigator.userAgent,
      },
    };
  });

  // Initialize speech recognition
  useEffect(() => {
    if (!state.isSupported) return;

    const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = lang;
    recognition.maxAlternatives = maxAlternatives;

    recognition.onstart = () => {
      setState(prev => ({ ...prev, isListening: true, error: null, isProcessing: false }));
      onStart?.();
      isStartingRef.current = false;
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interimTranscript = '';
      let bestConfidence = 0;

      for (let i = event.resultIndex; i < event?.results?.length; i++) {
        const result = event.results[i];
        const alternative = result[0];
        
        if (result.isFinal) {
          finalTranscript += alternative.transcript;
          bestConfidence = Math.max(bestConfidence, alternative.confidence);
        } else {
          interimTranscript += alternative.transcript;
        }
      }

      if (finalTranscript) {
        setState(prev => ({
          ...prev,
          transcript: prev.transcript + finalTranscript,
          confidence: bestConfidence,
          interimTranscript: '',
        }));

        if (bestConfidence >= confidenceThreshold) {
          onResult?.(finalTranscript.trim(), bestConfidence, true);
        } else {
          onError?.('low-confidence', `Recognition confidence too low: ${bestConfidence.toFixed(2)}`);
        }
      } else if (interimTranscript) {
        setState(prev => ({
          ...prev,
          interimTranscript,
        }));

        onInterimResult?.(interimTranscript.trim(), 0);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      const errorMessage = getErrorMessage(event.error);
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isListening: false,
        isProcessing: false,
      }));
      onError?.(event.error, errorMessage);
      isStartingRef.current = false;
    };

    recognition.onend = () => {
      setState(prev => ({
        ...prev,
        isListening: false,
        isProcessing: false,
      }));
      onEnd?.();
      isStartingRef.current = false;
    };

    recognition.onaudiostart = () => {
      setState(prev => ({ ...prev, isProcessing: true }));
    };

    recognition.onspeechstart = () => {
      setState(prev => ({ ...prev, isProcessing: true }));
    };

    recognition.onspeechend = () => {
      setState(prev => ({ ...prev, isProcessing: false }));
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef?.current?.abort();
      }
    };
  }, [lang, continuous, interimResults, maxAlternatives, confidenceThreshold]);

  const start = useCallback(async () => {
    if (!state.isSupported) {
      throw new Error('Speech recognition is not supported in this browser');
    }

    if (isStartingRef.current || state.isListening) {
      return;
    }

    try {
      // Request microphone permissions
      if (navigator.mediaDevices && navigator?.mediaDevices?.getUserMedia) {
        try {
          const stream = await navigator?.mediaDevices?.getUserMedia({ audio: true });
          stream.getTracks().forEach(track => track.stop()); // Clean up
        } catch (permissionError) {
          throw new Error('Microphone permission denied');
        }
      }

      setState(prev => ({ 
        ...prev, 
        error: null, 
        transcript: '', 
        interimTranscript: '',
        isProcessing: true 
      }));

      isStartingRef.current = true;
      recognitionRef.current?.start();
    } catch (error) {
      isStartingRef.current = false;
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to start recognition',
        isProcessing: false 
      }));
      throw error;
    }
  }, [state.isSupported, state.isListening]);

  const stop = useCallback(() => {
    if (recognitionRef.current && state.isListening) {
      recognitionRef?.current?.stop();
    }
  }, [state.isListening]);

  const abort = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef?.current?.abort();
    }
    isStartingRef.current = false;
    setState(prev => ({
      ...prev,
      isListening: false,
      isProcessing: false,
      error: null,
    }));
  }, []);

  const reset = useCallback(() => {
    setState(prev => ({
      ...prev,
      transcript: '',
      interimTranscript: '',
      confidence: 0,
      error: null,
    }));
  }, []);

  const getAvailableLanguages = useCallback(() => {
    return [
      'en-US', 'en-GB', 'es-ES', 'es-MX', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'pt-PT',
      'ru-RU', 'ja-JP', 'ko-KR', 'zh-CN', 'zh-TW', 'nl-NL', 'sv-SE', 'da-DK', 'no-NO',
      'fi-FI', 'pl-PL', 'cs-CZ', 'sk-SK', 'hu-HU', 'ro-RO', 'bg-BG', 'hr-HR', 'sl-SI',
      'et-EE', 'lv-LV', 'lt-LT', 'el-GR', 'tr-TR', 'ar-SA', 'he-IL', 'hi-IN', 'th-TH',
      'vi-VN', 'id-ID', 'ms-MY', 'tl-PH', 'sw-KE', 'af-ZA',
    ];
  }, []);

  const checkBrowserSupport = useCallback(() => {
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  }, []);

  const requestPermissions = useCallback(async () => {
    try {
      if (navigator.mediaDevices && navigator?.mediaDevices?.getUserMedia) {
        const stream = await navigator?.mediaDevices?.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const actions: VoiceRecognitionActions = {
    start,
    stop,
    abort,
    reset,
    getAvailableLanguages,
    checkBrowserSupport,
    requestPermissions,
  };

  return {
    ...state,
    ...actions,
  };
};

function getErrorMessage(errorCode: string): string {
  const errorMessages: Record<string, string> = {
    'no-speech': 'No speech detected. Please try speaking more clearly.',
    'aborted': 'Speech recognition was stopped.',
    'audio-capture': 'Audio capture failed. Please check your microphone.',
    'network': 'Network error occurred during recognition.',
    'not-allowed': 'Microphone access denied. Please allow microphone permissions.',
    'service-not-allowed': 'Speech recognition service not allowed.',
    'bad-grammar': 'Speech recognition grammar error.',
    'language-not-supported': 'Selected language is not supported.',
  };

  return errorMessages[errorCode] || `Speech recognition error: ${errorCode}`;
}

export default useVoiceRecognition;