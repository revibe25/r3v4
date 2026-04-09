// AudioGate.tsx — User-gesture gate for AudioContext activation
//
// Wrap the root of your audio-dependent UI tree with <AudioGate>.
// The overlay unmounts completely once the context is running.
// Children always render — audio sub-components check isReady themselves.

import { useAudioContext } from "../hooks/useAudioContext";

export function AudioGate({ children }: { children: React.ReactNode }) {
  const { isReady, activateAudio, activationError } = useAudioContext();

  return (
    <div className="relative w-full h-full">
      {children}
      {!isReady && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-md">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-8 flex flex-col items-center gap-5 max-w-sm w-full mx-4 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-violet-600/20 border border-violet-500/40 flex items-center justify-center">
              <svg className="w-8 h-8 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
              </svg>
            </div>
            <div className="text-center">
              <h2 className="text-white font-semibold text-lg">Enable Audio</h2>
              <p className="text-zinc-400 text-sm mt-1 leading-relaxed">
                Click below to activate the audio engine.<br />
                Browsers require a user gesture before audio can play.
              </p>
            </div>
            {activationError && (
              <p className="text-red-400 text-xs text-center bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2 w-full">
                {activationError.message}
              </p>
            )}
            <button
              onClick={activateAudio}
              className="w-full bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
            >
              Enable Audio
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
