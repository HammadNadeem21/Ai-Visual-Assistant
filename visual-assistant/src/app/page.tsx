import Assistant from "@/components/Assistant";

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white selection:bg-blue-500/30">
      
      {/* Background ambient lighting */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-12 flex flex-col items-center">
        
        {/* Header */}
        <div className="text-center mb-12 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-full text-xs font-semibold text-zinc-400 mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            Fully Free Next.js Stack
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 text-transparent bg-clip-text bg-linear-to-br from-white to-zinc-500 pb-1">
            Agentic Visual Assistant
          </h1>
          <p className="text-zinc-400 text-lg">
            Share your screen and talk out loud. The AI sees what you see and talks back in real-time. Powered by WebRTC, Web Speech API, and Gemini 2.5 Flash.
          </p>
        </div>

        {/* The App Engine */}
        <Assistant />

        {/* Footer / Info */}
        {/* <div className="mt-20 text-center text-sm text-zinc-600">
          <p>
            Make sure your <code className="bg-zinc-900 px-1 py-0.5 rounded text-zinc-400 border border-zinc-800">GEMINI_API_KEY</code> is correctly configured in your <code className="bg-zinc-900 px-1 py-0.5 rounded text-zinc-400 border border-zinc-800">.env.local</code>.
          </p>
          <p className="mt-2 text-xs">
            Using Chrome or Edge is highly recommended for full Web Speech API support.
          </p>
        </div> */}

      </div>
    </main>
  );
}
