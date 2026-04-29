// ─── Mirrored from server types ───────────────────────────────────────────────

export interface Cell {
  probability: number;
  cost: number;
  x: number;
  y: number;
}

export interface ProbabilityGrid {
  cells: Cell[][];
  width: number;
  height: number;
}

export interface Position {
  x: number;
  y: number;
}

export interface Entity {
  id: string;
  role: GameRole;
  position: Position;
  ap: number;
  statusEffects: string[];
}

export enum GamePhase {
  RECON = 'RECON',
  MANIPULATION = 'MANIPULATION',
  OBJECTIVE = 'OBJECTIVE',
  AND_OR_EVENTS = 'AND_OR_EVENTS',
  COLLAPSE = 'COLLAPSE',
}

export enum GameRole {
  GHOST = 'GHOST',
  SEEKER = 'SEEKER',
}

export interface Objective {
  id: string;
  position: Position;
  completed: boolean;
  label: string;
}

export interface GameState {
  phase: GamePhase;
  alertLevel: number;
  roundNumber: number;
  objectives: Objective[];
}

export interface MCTSRecommendation {
  action: ClientAction;
  expectedValue: number;
  confidence: number;
}

export interface NondeterministicEvent {
  type: 'fog' | 'storm' | 'sensor_disruption';
  affectedRegion: { x: number; y: number; radius: number };
  duration: number;
}

// ─── Round History ────────────────────────────────────────────────────────────

export interface MoveRecord {
  actor: 'human' | 'ai';
  role: GameRole;
  phase: GamePhase;
  actionType: string;
  x?: number;
  y?: number;
  detail?: string;
}

export interface RoundHistoryEntry {
  round: number;
  winnerRole: GameRole;
  humanWon: boolean;
  humanRole: GameRole;
  aiRole: GameRole;
  winCondition: 'objectives_completed' | 'ghost_locked' | 'ghost_survived';
  objectivesCompleted: number;
  moves: MoveRecord[];
}

export interface SerializedGameState {
  gameState: GameState;
  grid: ProbabilityGrid;
  entities: Entity[];
  ghostWins: number;
  seekerWins: number;
  humanWins: number;
  aiWins: number;
  currentRound: number;
  humanPlayerId: string;
  roleAssignments: Record<string, GameRole>;
  recommendations: MCTSRecommendation[];
  activeEvent: NondeterministicEvent | null;
  phaseTimeRemaining: number;
  phaseDuration: number;
  cyclesCompleted: number;
  cyclesPerRound: number;
  roundHistory: RoundHistoryEntry[];
}

// ─── Client Action Types ──────────────────────────────────────────────────────

export type ActionType =
  | 'THROW_DECOY'
  | 'MAKE_NOISE'
  | 'LAY_FALSE_TRAIL'
  | 'MOVE'
  | 'COMPLETE_OBJECTIVE'
  | 'SCAN'
  | 'LOCK'
  | 'END_PHASE';

export interface BaseAction {
  type: ActionType;
  playerId: string;
}

export interface ThrowDecoyAction extends BaseAction {
  type: 'THROW_DECOY';
  x: number;
  y: number;
}

export interface MakeNoiseAction extends BaseAction {
  type: 'MAKE_NOISE';
  x: number;
  y: number;
  radius: number;
}

export interface LayFalseTrailAction extends BaseAction {
  type: 'LAY_FALSE_TRAIL';
  cells: Position[];
}

export interface MoveAction extends BaseAction {
  type: 'MOVE';
  x: number;
  y: number;
}

export interface CompleteObjectiveAction extends BaseAction {
  type: 'COMPLETE_OBJECTIVE';
  objectiveId: string;
}

export interface ScanAction extends BaseAction {
  type: 'SCAN';
  x: number;
  y: number;
  radius: number;
}

export interface LockAction extends BaseAction {
  type: 'LOCK';
  x: number;
  y: number;
}

export interface EndPhaseAction extends BaseAction {
  type: 'END_PHASE';
}

export type ClientAction =
  | ThrowDecoyAction
  | MakeNoiseAction
  | LayFalseTrailAction
  | MoveAction
  | CompleteObjectiveAction
  | ScanAction
  | LockAction
  | EndPhaseAction;

// ─── UI State ─────────────────────────────────────────────────────────────────

export type PendingActionMode =
  | 'none'
  | 'throw_decoy'
  | 'make_noise'
  | 'lay_false_trail'
  | 'move'
  | 'scan'
  | 'lock';

export interface AlertState {
  active: boolean;
  message: string;
  type: 'collapse' | 'event' | 'info';
}
