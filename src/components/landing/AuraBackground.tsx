import React, { useEffect } from 'react';

export function AuraBackground() {
  useEffect(() => {
    const w = window as any;
    if (!w.UnicornStudio) {
      w.UnicornStudio = { isInitialized: false };
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v1.4.29/dist/unicornStudio.umd.js";
      script.onload = () => {
        if (!w.UnicornStudio.isInitialized) {
          w.UnicornStudio.init();
          w.UnicornStudio.isInitialized = true;
        }
      };
      document.head.appendChild(script);
    } else {
      if (w.UnicornStudio.init) {
        w.UnicornStudio.init();
      }
    }
  }, []);

  return (
    <div className="aura-background-component absolute inset-0 w-full h-full -z-10 pointer-events-none" style={{ position: 'absolute', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.7)', /* Faded overlay to match app's pure black theme */
        mixBlendMode: 'color', 
        zIndex: 1,
        pointerEvents: 'none'
      }}></div>
      <div data-us-project="tPmIIl0vKqHO9yqmtge2" className="absolute w-full h-full left-0 top-0 -z-10 pointer-events-none"></div>
    </div>
  );
}
