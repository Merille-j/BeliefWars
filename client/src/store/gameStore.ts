import { create } from 'zustand';
import {
  SerializedGameState,
  GameState,
  ProbabilityGrid,
  Entity,
  GamePhase,
  GameRole,
  MCTSRecommendation,
  NondeterministicEvent,
  AlertState,
  PendingActionMode,
  RoundHistoryEntry,
} from '../types/client.types';

interface GameStore {
  // Game state
  gameState: GameState | null;
  grid: ProbabilityGrid | null;
  entities: Entity[];
  ghostWins: number;
  seekerWins: number;
  humanWins: number;
  aiWins: number;
  currentRound: number;
  roleAssignments: Record<string, GameRole>;
  recommendations: MCTSRecommendation[];
  activeEvent: NondeterministicEvent | null;
  phaseTimeRemaining: number;
  phaseDuration: number;
  cyclesCompleted: number;
  cyclesPerRound: number;
  roundHistory: RoundHistoryEntry[];

  // UI state
  isGameActive: boolean;
  isMatchOver: boolean;
  matchWinner: GameRole | null;
  alert: AlertState;
  pendingAction: PendingActionMode;
  selectedCells: Array<{ x: number; y: number }>;
  humanPlayerId: string;
  /** A* suggested path for the human Ghost — cells to walk through to reach a goal */
  suggestedPath: Array<{ x: number; y: number }> | null;

  // Actions
  setGameState: (state: SerializedGameState) => void;
  setPhase: (phase: GamePhase) => void;
  setAlert: (alert: AlertState) => void;
  dismissAlert: () => void;
  setMatchOver: (winner: GameRole) => void;
  setPendingAction: (mode: PendingActionMode) => void;
  addSelectedCell: (x: number, y: number) => void;
  clearSelectedCells: () => void;
  setHumanPlayerId: (id: string) => void;
  setSuggestedPath: (path: Array<{ x: number; y: number }> | null) => void;
  resetGame: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  // Initial state
  gameState: null,
  grid: null,
  entities: [],
  ghostWins: 0,
  seekerWins: 0,
  humanWins: 0,
  aiWins: 0,
  currentRound: 1,
  roleAssignments: {},
  recommendations: [],
  activeEvent: null,
  phaseTimeRemaining: 20,
  phaseDuration: 20,
  cyclesCompleted: 0,
  cyclesPerRound: 2,
  roundHistory: [],

  isGameActive: false,
  isMatchOver: false,
  matchWinner: null,
  alert: { active: false, message: '', type: 'info' },
  pendingAction: 'none',
  selectedCells: [],
  humanPlayerId: 'human',
  suggestedPath: null,

  // Actions
  setGameState: (state: SerializedGameState) => {
    set({
      gameState: state.gameState,
      grid: state.grid,
      entities: state.entities,
      ghostWins: state.ghostWins,
      seekerWins: state.seekerWins,
      humanWins: state.humanWins,
      aiWins: state.aiWins,
      currentRound: state.currentRound,
      humanPlayerId: state.humanPlayerId,
      roleAssignments: state.roleAssignments,
      recommendations: state.recommendations,
      activeEvent: state.activeEvent,
      phaseTimeRemaining: state.phaseTimeRemaining,
      phaseDuration: state.phaseDuration,
      cyclesCompleted: state.cyclesCompleted,
      cyclesPerRound: state.cyclesPerRound,
      roundHistory: state.roundHistory,
      isGameActive: true,
    });
  },

  setPhase: (phase: GamePhase) => {
    set((state) => ({
      gameState: state.gameState ? { ...state.gameState, phase } : null,
    }));
  },

  setAlert: (alert: AlertState) => {
    set({ alert });
  },

  dismissAlert: () => {
    set({ alert: { active: false, message: '', type: 'info' } });
  },

  setMatchOver: (winner: GameRole) => {
    set({ isMatchOver: true, matchWinner: winner });
  },

  setPendingAction: (mode: PendingActionMode) => {
    set({ pendingAction: mode, selectedCells: [] });
  },

  addSelectedCell: (x: number, y: number) => {
    set((state) => ({
      selectedCells: [...state.selectedCells, { x, y }],
    }));
  },

  clearSelectedCells: () => {
    set({ selectedCells: [], pendingAction: 'none' });
  },

  setHumanPlayerId: (id: string) => {
    set({ humanPlayerId: id });
  },

  setSuggestedPath: (path) => {
    set({ suggestedPath: path });
  },

  resetGame: () => {
    set({
      gameState: null,
      grid: null,
      entities: [],
      ghostWins: 0,
      seekerWins: 0,
      humanWins: 0,
      aiWins: 0,
      currentRound: 1,
      roleAssignments: {},
      recommendations: [],
      activeEvent: null,
      phaseTimeRemaining: 20,
      phaseDuration: 20,
      cyclesCompleted: 0,
      cyclesPerRound: 2,
      roundHistory: [],
      isGameActive: false,
      isMatchOver: false,
      matchWinner: null,
      alert: { active: false, message: '', type: 'info' },
      pendingAction: 'none',
      selectedCells: [],
      suggestedPath: null,
    });
  },
}));

// ─── Derived selectors (use these instead of store getters) ──────────────────

/** Current game phase. */
export const selectPhase = (s: GameStore): GamePhase =>
  s.gameState?.phase ?? GamePhase.RECON;

/** Human player's assigned role. */
export const selectHumanRole = (s: GameStore): GameRole | null =>
  s.roleAssignments[s.humanPlayerId] ?? null;

/** Seeker's current AP. */
export const selectSeekerAP = (s: GameStore): number =>
  s.entities.find((e) => e.role === GameRole.SEEKER)?.ap ?? 0;

/** Ghost's current AP. */
export const selectGhostAP = (s: GameStore): number =>
  s.entities.find((e) => e.role === GameRole.GHOST)?.ap ?? 0;
