"use client";

import React, { useState, useRef, useEffect } from 'react';
import { MonitorUp, Mic, Square, Loader2, Play, Volume2 } from 'lucide-react';

export default function Assistant() {
  const [isSharing, setIsSharing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Need to hold onto the speech recognition object so we can stop it if needed
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Initialize Web Speech API
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false; // We want single-shot queries for this MVP
      recognition.interimResults = true; // Show words as they are being spoken
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(currentTranscript);
      };

      recognition.onend = () => {
        // When speech stops, if we were actively listening, we send the message
        setIsListening((prev) => {
          if (prev) {
            // We use a small timeout to let the state settle and get the final transcript
            setTimeout(() => sendToAI(), 100);
          }
          return false;
        });
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        if (event.error !== 'no-speech') {
          setError(`Speech API Error: ${event.error}`);
        }
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } else {
      setError("Speech Recognition API is not supported in this browser. Please use Chrome.");
    }
  }, []);

  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ 
        video: { displaySurface: "browser" }, 
        audio: false 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsSharing(true);
        setError(null);

        // Handle when user stops sharing via the browser's native UI
        stream.getVideoTracks()[0].onended = () => {
          stopScreenShare();
        };
      }
    } catch (err: any) {
      console.error("Error accessing display media.", err);
      setError("Screen sharing was cancelled or failed.");
      setIsSharing(false);
    }
  };

  const stopScreenShare = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsSharing(false);
  };

  const captureImage = (): string | null => {
    // Check srcObject to avoid React stale closure issues from the useEffect
    if (!videoRef.current || !canvasRef.current || !videoRef.current.srcObject) return null;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Set canvas dimensions to match the video
    // We can downscale here if performance or payload size is an issue.
    // For 1080p, let's max width at ~1280 to save payload size.
    const MAX_WIDTH = 1280;
    const scale = Math.min(1, MAX_WIDTH / video.videoWidth);
    
    canvas.width = video.videoWidth * scale;
    canvas.height = video.videoHeight * scale;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      // Return a JPEG data URL with 0.7 quality to reduce base64 size significantly
      return canvas.toDataURL('image/jpeg', 0.7); 
    }
    return null;
  };

  const handleMicClick = () => {
    if (!isSharing || isProcessing) return;

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      // It will auto-trigger sendToAI due to onend handler.
    } else {
      setTranscript('');
      setAiResponse('');
      setError(null);
      // Stop any ongoing speech
      window.speechSynthesis.cancel();
      
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (err) {
        console.error("Could not start recognition", err);
      }
    }
  };

  const speakText = (text: string) => {
    // Cancel any current speaking
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    // Optional: Customize voice here if desired
    // const voices = window.speechSynthesis.getVoices();
    // utterance.voice = voices.find(v => v.name.includes("Google") || v.lang === "en-US") || voices[0];
    
    window.speechSynthesis.speak(utterance);
  };

  const sendToAI = async () => {
    // We need to fetch the latest transcript from the DOM/state, 
    // but React state might be stale here if called right from an event handler without refs.
    // Let's use string manipulation or a callback to get the latest.
    // In our implementation, `onend` triggers this. `transcript` state might be slightly delayed.
    // Let's ensure we wait for state to drain by putting a small fallback, OR better, passing the text.
    // To fix stale state closure, we will rely on a generic way or rely on user having stopped talking.
    
    // For safety, let's grab the HTML value instead of relying heavily on state if it's stale.
    const textElement = document.getElementById("transcript-text")?.innerText || transcript;
    
    if (!textElement.trim()) {
       setError("I didn't hear anything. Please try again.");
       return;
    }

    // Check srcObject directly to bypass React stale state closure
    if (!videoRef.current || !videoRef.current.srcObject) {
        setError("Please share a screen first so the AI can see.");
        return;
    }

    setIsProcessing(true);
    const imageBase64 = captureImage();

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: textElement, imageBase64 })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to process");
      }

      setAiResponse(data.reply);
      speakText(data.reply);
      
    } catch (err: any) {
      console.error("API error", err);
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };


  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-6">
      
      {/* Video Preview Container */}
      <div className="relative aspect-video bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 shadow-2xl flex items-center justify-center">
        {/* The active video feed */}
        <video 
          ref={videoRef} 
          className={`w-full h-full object-contain ${!isSharing && 'hidden'}`} 
          muted 
        />
        
        {/* Placeholder when not sharing */}
        {!isSharing && (
          <div className="text-zinc-500 flex flex-col items-center gap-4">
            <MonitorUp size={48} className="opacity-50" />
            <p>No screen being shared</p>
          </div>
        )}

        {/* Status Badges Overlay */}
        <div className="absolute top-4 left-4 flex gap-2">
           {isSharing && (
             <span className="bg-green-500/10 text-green-500 border border-green-500/20 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-sm flex items-center gap-2">
               <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
               SCREEN SHARED
             </span>
           )}
           {isListening && (
             <span className="bg-red-500/10 text-red-500 border border-red-500/20 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-sm flex items-center gap-2">
               <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
               LISTENING
             </span>
           )}
           {isProcessing && (
             <span className="bg-blue-500/10 text-blue-500 border border-blue-500/20 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-sm flex items-center gap-2">
               <Loader2 className="w-3 h-3 animate-spin" />
               THINKING
             </span>
           )}
        </div>
      </div>

      {/* Hidden Canvas used for taking screenshots */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-center gap-4">
        <button 
          onClick={isSharing ? stopScreenShare : startScreenShare}
          className={`px-6 py-3 rounded-xl font-medium transition-all flex items-center gap-2
            ${isSharing 
              ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' 
              : 'bg-white hover:bg-zinc-200 text-black shadow-lg hover:shadow-xl hover:-translate-y-0.5'}`}
        >
          {isSharing ? <Square size={18} /> : <MonitorUp size={18} />}
          {isSharing ? "Stop Sharing" : "Share Screen"}
        </button>

        <button 
          onMouseDown={handleMicClick}
          className={`relative px-8 py-4 rounded-full font-bold transition-all flex items-center gap-3 overflow-hidden
            ${!isSharing ? 'opacity-50 cursor-not-allowed bg-zinc-800 text-zinc-500' : 
            isListening 
              ? 'bg-red-600 hover:bg-red-700 text-white shadow-[0_0_30px_rgba(220,38,38,0.5)] scale-105' 
              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:scale-105'}`}
          disabled={!isSharing || isProcessing}
        >
          {isProcessing ? <Loader2 size={24} className="animate-spin" /> : <Mic size={24} />}
          {isListening ? `Click to Send (or finish talking)` : isProcessing ? 'Processing Image & Text...' : 'Click to Ask a Question'}
          
          {/* Pulse ring effect when listening */}
          {isListening && (
            <span className="absolute inset-0 border-2 border-red-400 rounded-full animate-ping opacity-75" />
          )}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-900/30 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg flex items-center gap-2">
           <span className="font-semibold text-red-400">Error:</span> {error}
        </div>
      )}

      {/* Conversation Display */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {/* You Area */}
        <div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-xl">
          <div className="flex items-center gap-2 text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-3">
             <Mic size={14} /> You
          </div>
          <p id="transcript-text" className={`min-h-[60px] text-zinc-300 font-medium ${isListening ? 'animate-pulse' : ''}`}>
             {transcript || <span className="text-zinc-600 italic">Your speech will appear here...</span>}
          </p>
        </div>

        {/* AI Area */}
        <div className="bg-blue-900/10 border border-blue-500/20 p-5 rounded-xl">
          <div className="flex items-center justify-between text-blue-400 text-xs font-semibold uppercase tracking-wider mb-3">
             <div className="flex items-center gap-2">
               <Volume2 size={14} /> Agent
             </div>
             {aiResponse && (
                <button 
                  onClick={() => speakText(aiResponse)}
                  className="text-blue-500 hover:text-blue-300 transition-colors p-1 bg-blue-500/10 rounded-full"
                  title="Replay Audio"
                >
                   <Play size={12} className="ml-0.5" />
                </button>
             )}
          </div>
          <p className="min-h-[60px] text-blue-100/90 leading-relaxed">
             {isProcessing ? (
                <span className="flex items-center gap-2 text-blue-500/70">
                  <Loader2 size={16} className="animate-spin" /> Analyzing screen...
                </span>
             ) : (
                aiResponse || <span className="text-blue-500/40 italic">Agent response will appear here...</span>
             )}
          </p>
        </div>
      </div>
      
    </div>
  );
}
