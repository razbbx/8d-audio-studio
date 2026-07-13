"use client";



export function InfoPanel() {
  // We keep options in props just in case, but this is now a static guide.
  
  return (
    <div className="flex flex-col h-full bg-[var(--charcoal-4)] border-t md:border-t-0 p-5 md:p-6 overflow-auto">
      <div className="flex items-center gap-2 mb-6 text-[var(--charcoal)]">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
        <h3 className="font-semibold text-[13px] uppercase tracking-widest">
          Knob Guide
        </h3>
      </div>

      <div className="space-y-6 flex-1">
        
        {/* Panning Section */}
        <div className="space-y-3">
          <h4 className="text-[10px] font-bold text-[var(--muted-gray)] uppercase tracking-widest border-b border-[var(--light-cream)] pb-1">
            Panning
          </h4>
          
          <div className="space-y-2.5">
            <div>
              <span className="text-[12px] font-semibold text-[var(--charcoal)]">Speed: </span>
              <span className="text-[12px] text-[var(--muted-gray)]">How fast the sound revolves around your head.</span>
            </div>
            <div>
              <span className="text-[12px] font-semibold text-[var(--charcoal)]">Depth: </span>
              <span className="text-[12px] text-[var(--muted-gray)]">How far left and right the sound travels during its orbit.</span>
            </div>
            <div>
              <span className="text-[12px] font-semibold text-[var(--charcoal)]">Reality: </span>
              <span className="text-[12px] text-[var(--muted-gray)]">Intensifies acoustic skull-shadowing and psychoacoustic height (elevation) cues.</span>
            </div>
            <div>
              <span className="text-[12px] font-semibold text-[var(--charcoal)]">Mode: </span>
              <span className="text-[12px] text-[var(--muted-gray)]">HRTF 3D = true binaural orbit (front, back, top, bottom, all around). Stereo = classic left/right only.</span>
            </div>
            <div>
              <span className="text-[12px] font-semibold text-[var(--charcoal)]">Elevatn: </span>
              <span className="text-[12px] text-[var(--muted-gray)]">Tilts the 3D orbit so the sound also sweeps above and below your head (HRTF mode only).</span>
            </div>
            <div>
              <span className="text-[12px] font-semibold text-[var(--charcoal)]">Bass: </span>
              <span className="text-[12px] text-[var(--muted-gray)]">Anchors sub-frequencies in the center to prevent woofer pumping and phase cancellation.</span>
            </div>
            <div>
              <span className="text-[12px] font-semibold text-[var(--charcoal)]">Variatn: </span>
              <span className="text-[12px] text-[var(--muted-gray)]">Injects organic wobble, flutter, and unpredictability into the orbital path.</span>
            </div>
          </div>
        </div>

        {/* Space Section */}
        <div className="space-y-3">
          <h4 className="text-[10px] font-bold text-[var(--muted-gray)] uppercase tracking-widest border-b border-[var(--light-cream)] pb-1">
            Reverb & Space
          </h4>
          
          <div className="space-y-2.5">
            <div>
              <span className="text-[12px] font-semibold text-[var(--charcoal)]">Amount: </span>
              <span className="text-[12px] text-[var(--muted-gray)]">The overall volume of the simulated acoustic environment.</span>
            </div>
            <div>
              <span className="text-[12px] font-semibold text-[var(--charcoal)]">Decay: </span>
              <span className="text-[12px] text-[var(--muted-gray)]">The size of the room (how long the echo takes to fade out).</span>
            </div>
            <div>
              <span className="text-[12px] font-semibold text-[var(--charcoal)]">Pre-dly: </span>
              <span className="text-[12px] text-[var(--muted-gray)]">The time gap before the room echo hits your ear. Pushes the walls further away.</span>
            </div>
            <div>
              <span className="text-[12px] font-semibold text-[var(--charcoal)]">Air: </span>
              <span className="text-[12px] text-[var(--muted-gray)]">High-frequency brightness. Turn up for concert halls, turn down for padded rooms.</span>
            </div>
            <div>
              <span className="text-[12px] font-semibold text-[var(--charcoal)]">Width: </span>
              <span className="text-[12px] text-[var(--muted-gray)]">Artificially pushes the sides of the stereo field further apart using Mid/Side processing.</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
