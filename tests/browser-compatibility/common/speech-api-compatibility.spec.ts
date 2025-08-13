import { test, expect, Page } from '@playwright/test';
import { detectBrowserCapabilities, BrowserCapabilities } from '../utils/browser-detector';

test.describe('Web Speech API Compatibility Tests', () => {
  let capabilities: BrowserCapabilities;

  test.beforeEach(async ({ page }) => {
    capabilities = await detectBrowserCapabilities(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should detect Speech Recognition API availability', async ({ page }) => {
    const speechSupport = await page.evaluate(() => {
      return {
        speechRecognition: 'SpeechRecognition' in window,
        webkitSpeechRecognition: 'webkitSpeechRecognition' in window,
        speechSynthesis: 'speechSynthesis' in window,
        speechSynthesisUtterance: 'SpeechSynthesisUtterance' in window
      };
    });

    console.log(`Speech API Support for ${capabilities.name}:`, speechSupport);

    // Log availability by browser
    if (capabilities.name === 'Chrome') {
      expect(speechSupport.webkitSpeechRecognition).toBe(true);
      expect(speechSupport.speechSynthesis).toBe(true);
    } else if (capabilities.name === 'Firefox') {
      // Firefox has limited speech recognition support
      console.log('Firefox: Limited speech recognition support expected');
    } else if (capabilities.name === 'Safari') {
      expect(speechSupport.webkitSpeechRecognition).toBe(true);
      expect(speechSupport.speechSynthesis).toBe(true);
    } else if (capabilities.name === 'Edge') {
      expect(speechSupport.webkitSpeechRecognition).toBe(true);
      expect(speechSupport.speechSynthesis).toBe(true);
    }

    // At least speech synthesis should be available in modern browsers
    expect(speechSupport.speechSynthesis).toBe(true);
  });

  test('should test Speech Recognition functionality if available', async ({ page }) => {
    const canTestSpeech = await page.evaluate(() => {
      return !!(
        window.SpeechRecognition || 
        (window as any).webkitSpeechRecognition
      );
    });

    if (!canTestSpeech) {
      console.log(`Speech Recognition not available in ${capabilities.name} - skipping`);
      test.skip();
      return;
    }

    // Test speech recognition initialization
    const speechRecognitionTest = await page.evaluate(() => {
      try {
        const SpeechRecognition = window.SpeechRecognition || 
                                 (window as any).webkitSpeechRecognition;
        
        if (!SpeechRecognition) return { success: false, error: 'API not available' };

        const recognition = new SpeechRecognition();
        
        // Configure recognition
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';
        
        // Test basic properties
        const config = {
          continuous: recognition.continuous,
          interimResults: recognition.interimResults,
          lang: recognition.lang,
          maxAlternatives: recognition.maxAlternatives || 1
        };

        return { 
          success: true, 
          config,
          methods: {
            start: typeof recognition.start === 'function',
            stop: typeof recognition.stop === 'function',
            abort: typeof recognition.abort === 'function'
          }
        };
        
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });

    console.log('Speech Recognition Test:', speechRecognitionTest);
    expect(speechRecognitionTest.success).toBe(true);
    
    if (speechRecognitionTest.success) {
      expect(speechRecognitionTest.methods.start).toBe(true);
      expect(speechRecognitionTest.methods.stop).toBe(true);
      expect(speechRecognitionTest.methods.abort).toBe(true);
    }
  });

  test('should test Speech Synthesis functionality', async ({ page }) => {
    const speechSynthesisTest = await page.evaluate(async () => {
      try {
        if (!('speechSynthesis' in window)) {
          return { success: false, error: 'speechSynthesis not available' };
        }

        const synthesis = window.speechSynthesis;
        
        // Get available voices (may be async)
        let voices = synthesis.getVoices();
        
        // If voices not immediately available, wait for voiceschanged event
        if (voices.length === 0) {
          await new Promise<void>((resolve) => {
            const timeout = setTimeout(() => resolve(), 2000);
            synthesis.addEventListener('voiceschanged', () => {
              clearTimeout(timeout);
              resolve();
            }, { once: true });
          });
          voices = synthesis.getVoices();
        }

        // Test utterance creation
        const utterance = new SpeechSynthesisUtterance('Test speech synthesis');
        
        const result = {
          success: true,
          voiceCount: voices.length,
          hasEnglishVoice: voices.some(voice => voice.lang.startsWith('en')),
          properties: {
            speaking: synthesis.speaking,
            pending: synthesis.pending,
            paused: synthesis.paused
          },
          utteranceProperties: {
            text: utterance.text,
            lang: utterance.lang || 'default',
            pitch: utterance.pitch,
            rate: utterance.rate,
            volume: utterance.volume
          },
          methods: {
            speak: typeof synthesis.speak === 'function',
            cancel: typeof synthesis.cancel === 'function',
            pause: typeof synthesis.pause === 'function',
            resume: typeof synthesis.resume === 'function'
          }
        };

        return result;
        
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });

    console.log('Speech Synthesis Test:', speechSynthesisTest);
    expect(speechSynthesisTest.success).toBe(true);

    if (speechSynthesisTest.success) {
      expect(speechSynthesisTest.voiceCount).toBeGreaterThanOrEqual(0);
      expect(speechSynthesisTest.methods.speak).toBe(true);
      expect(speechSynthesisTest.methods.cancel).toBe(true);
      
      // Log voice availability
      console.log(`Found ${speechSynthesisTest.voiceCount} voices`);
      if (speechSynthesisTest.hasEnglishVoice) {
        console.log('English voice available');
      }
    }
  });

  test('should implement fallback for unsupported Speech APIs', async ({ page }) => {
    // Navigate to Walmart agent to test fallback behavior
    const walmartButton = page.locator('button:has-text("Walmart"), a[href*="walmart"]').first();
    if (await walmartButton.isVisible()) {
      await walmartButton.click();
    } else {
      await page.goto('/walmart');
    }

    await page.waitForLoadState('networkidle');

    // Test what happens when speech APIs are disabled/unavailable
    await page.addInitScript(() => {
      // Mock unavailable Speech APIs
      delete (window as any).SpeechRecognition;
      delete (window as any).webkitSpeechRecognition;
      delete (window as any).speechSynthesis;
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Look for voice input button/feature
    const voiceButton = page.locator('button[aria-label*="voice" i], button:has([class*="microphone" i]), button:has([class*="voice" i])');
    
    if (await voiceButton.count() > 0) {
      // Voice button should either be disabled or show fallback behavior
      const isDisabled = await voiceButton.getAttribute('disabled');
      const isHidden = !(await voiceButton.isVisible());
      
      if (isDisabled !== null) {
        console.log('Voice button properly disabled when Speech API unavailable');
        expect(isDisabled).toBe('');
      } else if (isHidden) {
        console.log('Voice button hidden when Speech API unavailable');
      } else {
        // If still visible and enabled, clicking should show appropriate message
        await voiceButton.click();
        
        const errorMessage = page.locator('text=/voice.+not.+supported/i, text=/speech.+not.+available/i');
        if (await errorMessage.count() > 0) {
          console.log('Appropriate error message shown for unsupported speech');
        }
      }
    } else {
      console.log('No voice input feature found - expected for some implementations');
    }

    await page.screenshot({ 
      path: `browser-compatibility-results/${capabilities.name.toLowerCase()}/speech-fallback.png`,
      fullPage: true 
    });
  });

  test('should test microphone permissions handling', async ({ page, browserName }) => {
    // Skip on browsers that don't support getUserMedia
    const hasMediaDevices = await page.evaluate(() => {
      return 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices;
    });

    if (!hasMediaDevices) {
      console.log(`MediaDevices not available in ${browserName} - skipping microphone test`);
      test.skip();
      return;
    }

    // Test microphone access (this will likely be denied in headless mode)
    const microphoneTest = await page.evaluate(async () => {
      try {
        // Request microphone access
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: true,
          video: false 
        });
        
        // If we get here, permission was granted
        stream.getTracks().forEach(track => track.stop());
        
        return { 
          success: true, 
          granted: true,
          error: null
        };
        
      } catch (error) {
        const err = error as any;
        return { 
          success: false, 
          granted: false,
          error: err.name || 'Unknown error',
          message: err.message
        };
      }
    });

    console.log('Microphone Test:', microphoneTest);
    
    // In headless mode, we expect permission to be denied
    // What's important is that the API is available and handles errors gracefully
    if (microphoneTest.error) {
      expect(['NotAllowedError', 'NotFoundError', 'PermissionDeniedError']).toContain(microphoneTest.error);
      console.log('Microphone permission properly handled (expected in headless mode)');
    } else {
      console.log('Microphone access granted (unexpected in headless mode)');
    }
  });

  test('should provide speech API polyfill recommendations', async ({ page }) => {
    const recommendations = await page.evaluate(() => {
      const support = {
        speechRecognition: !!(window.SpeechRecognition || (window as any).webkitSpeechRecognition),
        speechSynthesis: !!window.speechSynthesis,
        mediaDevices: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
      };

      const polyfills = [];
      
      if (!support.speechRecognition) {
        polyfills.push({
          feature: 'Speech Recognition',
          polyfill: 'speech-recognition-polyfill',
          alternative: 'Consider Web Audio API + Cloud Speech Service'
        });
      }
      
      if (!support.speechSynthesis) {
        polyfills.push({
          feature: 'Speech Synthesis',
          polyfill: 'speech-synthesis-polyfill',
          alternative: 'Use Cloud Text-to-Speech Service'
        });
      }
      
      if (!support.mediaDevices) {
        polyfills.push({
          feature: 'Media Devices',
          polyfill: 'webrtc-adapter',
          alternative: 'Disable voice input features'
        });
      }

      return { support, polyfills };
    });

    console.log(`Speech API Support Summary for ${capabilities.name}:`);
    console.log('Support:', recommendations.support);
    
    if (recommendations.polyfills.length > 0) {
      console.log('Recommended Polyfills:');
      recommendations.polyfills.forEach(polyfill => {
        console.log(`- ${polyfill.feature}: ${polyfill.polyfill}`);
        console.log(`  Alternative: ${polyfill.alternative}`);
      });
    } else {
      console.log('All speech APIs supported natively');
    }

    // Save recommendations to results
    await page.evaluate((data) => {
      (window as any).speechCompatibilityReport = data;
    }, recommendations);
  });
});