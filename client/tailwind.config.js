/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Dark tactical theme
        'game-bg': '#0a0e1a',
        'game-panel': '#111827',
        'game-border': '#1f2937',
        'game-accent': '#00ff88',
        'game-danger': '#ff3333',
        'game-warning': '#ffaa00',
        'game-info': '#00aaff',
        'ghost-color': '#00ff88',
        'seeker-color': '#00aaff',
        'phase-recon': '#6366f1',
        'phase-manipulation': '#f59e0b',
        'phase-objective': '#10b981',
        'phase-events': '#8b5cf6',
        'phase-collapse': '#ef4444',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      animation: {
        'pulse-fast': 'pulse 0.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'flash': 'flash 0.3s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out',
      },
      keyframes: {
        flash: {
          '0%, 100%': { opacity: '0' },
          '50%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
