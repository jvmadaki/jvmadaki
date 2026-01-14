import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { MODEL_NAME, SYSTEM_INSTRUCTION, SAMPLE_RATE_INPUT, SAMPLE_RATE_OUTPUT } from "../constants";
import { createPcmBlob, decodeAudioData, base64ToBytes } from "./audioUtils";
import { ConnectionStatus } from "../types";

type StatusCallback = (status: ConnectionStatus) => void;
type TranscriptCallback = (text: string, isUser: boolean, isFinal: boolean) => void;
type VolumeCallback = (volume: number) => void;

export class GeminiLiveService {
  private ai: GoogleGenAI;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private mediaStream: MediaStream | null = null;
  private nextStartTime = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private sessionPromise: Promise<any> | null = null; // Using any for session type as it's dynamic in SDK
  
  // State for transcription
  private currentInputTranscription = '';
  private currentOutputTranscription = '';

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async connect(
    onStatusChange: StatusCallback,
    onTranscript: TranscriptCallback,
    onVolumeChange: VolumeCallback
  ) {
    try {
      onStatusChange(ConnectionStatus.CONNECTING);

      // Initialize Audio Contexts
      this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: SAMPLE_RATE_INPUT
      });
      this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: SAMPLE_RATE_OUTPUT
      });

      const outputNode = this.outputAudioContext.createGain();
      outputNode.connect(this.outputAudioContext.destination);

      // Get User Media
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Connect to Gemini Live
      this.sessionPromise = this.ai.live.connect({
        model: MODEL_NAME,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          systemInstruction: SYSTEM_INSTRUCTION,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            onStatusChange(ConnectionStatus.CONNECTED);
            this.setupAudioInput(onVolumeChange);
          },
          onmessage: async (message: LiveServerMessage) => {
            this.handleMessage(message, outputNode, onTranscript, onVolumeChange);
          },
          onerror: (e: any) => {
            console.error("Gemini Live Error:", e);
            onStatusChange(ConnectionStatus.ERROR);
            this.disconnect();
          },
          onclose: () => {
            onStatusChange(ConnectionStatus.DISCONNECTED);
          }
        }
      });

    } catch (error) {
      console.error("Failed to connect:", error);
      onStatusChange(ConnectionStatus.ERROR);
      this.disconnect();
    }
  }

  private setupAudioInput(onVolumeChange: VolumeCallback) {
    if (!this.inputAudioContext || !this.mediaStream || !this.sessionPromise) return;

    const source = this.inputAudioContext.createMediaStreamSource(this.mediaStream);
    // Buffer size 4096 is a good balance for script processor
    this.scriptProcessor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);

    this.scriptProcessor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      
      // Calculate volume for visualizer
      let sum = 0;
      for (let i = 0; i < inputData.length; i++) {
        sum += inputData[i] * inputData[i];
      }
      const rms = Math.sqrt(sum / inputData.length);
      onVolumeChange(Math.min(rms * 5, 1)); // Amplify a bit for visualizer

      const pcmBlob = createPcmBlob(inputData);
      
      this.sessionPromise?.then((session) => {
        session.sendRealtimeInput({ media: pcmBlob });
      });
    };

    source.connect(this.scriptProcessor);
    this.scriptProcessor.connect(this.inputAudioContext.destination);
  }

  private async handleMessage(
    message: LiveServerMessage, 
    outputNode: GainNode,
    onTranscript: TranscriptCallback,
    onVolumeChange: VolumeCallback
  ) {
    // 1. Handle Transcription
    if (message.serverContent?.outputTranscription) {
      const text = message.serverContent.outputTranscription.text;
      this.currentOutputTranscription += text;
      onTranscript(this.currentOutputTranscription, false, false);
    } else if (message.serverContent?.inputTranscription) {
      const text = message.serverContent.inputTranscription.text;
      this.currentInputTranscription += text;
      onTranscript(this.currentInputTranscription, true, false);
    }

    if (message.serverContent?.turnComplete) {
      if (this.currentInputTranscription) {
        onTranscript(this.currentInputTranscription, true, true);
        this.currentInputTranscription = '';
      }
      if (this.currentOutputTranscription) {
        onTranscript(this.currentOutputTranscription, false, true);
        this.currentOutputTranscription = '';
      }
    }

    // 2. Handle Audio Output
    const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
    if (base64Audio && this.outputAudioContext) {
      this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
      
      try {
        const audioBytes = base64ToBytes(base64Audio);
        const audioBuffer = await decodeAudioData(
          audioBytes,
          this.outputAudioContext,
          SAMPLE_RATE_OUTPUT,
          1
        );

        const source = this.outputAudioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(outputNode);
        
        // Simple visualizer hook for output (rough approximation based on playback)
        // Ideally we'd use an AnalyserNode on the outputNode for accurate output viz
        onVolumeChange(0.5); // Simulate activity
        
        source.addEventListener('ended', () => {
          this.sources.delete(source);
          if (this.sources.size === 0) {
             onVolumeChange(0); // Reset viz when silence
          }
        });

        source.start(this.nextStartTime);
        this.nextStartTime += audioBuffer.duration;
        this.sources.add(source);
      } catch (err) {
        console.error("Audio decode error:", err);
      }
    }

    // 3. Handle Interruption
    if (message.serverContent?.interrupted) {
      this.stopAllAudio();
      this.currentOutputTranscription = ''; // Clear stale transcription
      this.nextStartTime = 0;
    }
  }

  private stopAllAudio() {
    for (const source of this.sources.values()) {
      try {
        source.stop();
      } catch (e) { /* ignore already stopped */ }
      this.sources.delete(source);
    }
  }

  disconnect() {
    // Stop recording
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor.onaudioprocess = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
    }
    
    // Stop playback
    this.stopAllAudio();
    
    // Close AudioContexts
    this.inputAudioContext?.close();
    this.outputAudioContext?.close();
    
    this.inputAudioContext = null;
    this.outputAudioContext = null;
    this.mediaStream = null;
    this.sessionPromise = null; // We can't explicitly close the session object easily without the ref, but closing context helps.
    
    // Attempt to close session if stored (API doesn't export a clear Close on the promise result easily outside callback, 
    // but the `connect` callback `onclose` is triggered if server disconnects. 
    // We mainly rely on cleaning up client side resources here.)
  }
}