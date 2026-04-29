import React, { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';

/**
 * Full-screen alert overlay for belief collapse and nondeterministic events.
 * Red flash effect on belief collapse. Auto-dismisses after 3 seconds.
 */
export const AlertOverlay: React.FC = () => {
  const { alert, dismissAlert } = useGameStore();

  useEffect(() => {
    if (alert.active) {
      const timer = setTimeout(() => {
        dismissAlert();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [alert.active, dismissAlert]);

  if (!alert.active) return null;

  const isCollapse = alert.type === 'collapse';
  const isEvent = alert.type === 'event';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
      style={{ animation: 'fadeInOut 3s ease-in-out forwards' }}
    >
      {/* Background flash */}
      <div
        className={`absolute inset-0 ${
          isCollapse
            ? 'bg-red-900/60'
            : isEvent
            ? 'bg-purple-900/50'
            : 'bg-blue-900/40'
        }`}
        style={{
          animation: 'pulse 0.5s ease-in-out 3',
        }}
      />

      {/* Alert box */}
      <div
        className={`relative z-10 text-center px-12 py-8 rounded-xl border-2 ${
          isCollapse
            ? 'bg-red-950 border-red-500 text-red-400'
            : isEvent
            ? 'bg-purple-950 border-purple-500 text-purple-400'
            : 'bg-blue-950 border-blue-500 text-blue-400'
        }`}
        style={{
          boxShadow: isCollapse
            ? '0 0 60px rgba(255, 0, 0, 0.5)'
            : '0 0 40px rgba(128, 0, 255, 0.4)',
          animation: 'slideIn 0.3s ease-out',
        }}
      >
        {isCollapse && (
          <>
            <div className="text-6xl mb-4" style={{ animation: 'pulse 0.5s infinite' }}>
              🚨
            </div>
            <div className="text-4xl font-black font-mono tracking-widest mb-2">
              DETECTED!
            </div>
            <div className="text-lg font-mono opacity-80">
              Ghost location confirmed!
            </div>
          </>
        )}

        {isEvent && (
          <>
            <div className="text-5xl mb-4">⚡</div>
            <div className="text-2xl font-black font-mono tracking-widest mb-2">
              EVENT!
            </div>
            <div className="text-sm font-mono opacity-80 max-w-xs">
              {alert.message}
            </div>
          </>
        )}

        {alert.type === 'info' && (
          <>
            <div className="text-3xl font-bold font-mono mb-2">ℹ️</div>
            <div className="text-sm font-mono opacity-80">{alert.message}</div>
          </>
        )}

        {/* Dismiss hint */}
        <div className="mt-4 text-xs opacity-40 font-mono">
          Auto-dismissing...
        </div>
      </div>

      <style>{`
        @keyframes fadeInOut {
          0% { opacity: 0; }
          10% { opacity: 1; }
          80% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes slideIn {
          from { transform: scale(0.8) translateY(-20px); opacity: 0; }
          to { transform: scale(1) translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};
