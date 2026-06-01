// Core Grid Types 

export interface Cell {
  probability: number; // 0–1 (normalized)
  cost: number;        // movement cost for pathfinding
  x: number;
  y: number;
}

export interface ProbabilityGrid {
  cells: Cell[][];
  width: number;
  height: number;
}

// Entity Types

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

// Enums

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

export enum EventType {
  // Phase events
  PHASE_STARTED = 'PHASE_STARTED',
  PHASE_ENDED = 'PHASE_ENDED',
  PHASE_VIOLATION_ERROR = 'PHASE_VIOLATION_ERROR',

  // Belief state events
  BELIEF_UPDATED = 'BELIEF_UPDATED',
  BELIEF_COLLAPSE = 'BELIEF_COLLAPSE',

  // Grid events
  GRID_BOUNDARY_ERROR = 'GRID_BOUNDARY_ERROR',

  // Entity events
  INSUFFICIENT_AP_ERROR = 'INSUFFICIENT_AP_ERROR',
  ENTITY_MOVED = 'ENTITY_MOVED',

  // Match events
  ROUND_WON = 'ROUND_WON',
  MATCH_WON = 'MATCH_WON',
  ROLES_ASSIGNED = 'ROLES_ASSIGNED',

  // Objective events
  OBJECTIVE_REACHED = 'OBJECTIVE_REACHED',

  // Algorithm events
  PATHFINDING_ERROR = 'PATHFINDING_ERROR',
  CONTINGENCY_PLAN_READY = 'CONTINGENCY_PLAN_READY',

  // Nondeterministic events
  NONDETERMINISTIC_EVENT_OCCURRED = 'NONDETERMINISTIC_EVENT_OCCURRED',
}

// Game State

export interface Objective {
  id: string;
  position: Position;
  completed: boolean;
  label: string;
}

export interface GameState {
  phase: GamePhase;
  alertLevel: number;   // 0–100
  roundNumber: number;
  objectives: Objective[];
}

export interface RoundStore {
  ghostWins: number;
  seekerWins: number;
  currentRound: number;
  roleAssignments: Record<string, GameRole>;
}

// Events

export interface GameEvent {
  type: EventType;
  payload: unknown;
  timestamp: number;
}

// Actions

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

export type Action =
  | ThrowDecoyAction
  | MakeNoiseAction
  | LayFalseTrailAction
  | MoveAction
  | CompleteObjectiveAction
  | ScanAction
  | LockAction
  | EndPhaseAction;

// Pathfinding

export interface Path {
  cells: Position[];
  cost: number;
}

// MCTS 

export interface MCTSRecommendation {
  action: Action;
  expectedValue: number;
  confidence: number; // 0–1
}

// AND-OR Planner 

export interface AndOrBranch {
  condition: string;
  action: Action | null;
  children: AndOrBranch[];
}

export interface ContingencyPlan {
  eventType: string;
  branches: AndOrBranch[];
}

export interface AndOrNode {
  type: 'AND' | 'OR';
  children: AndOrNode[];
  action: Action | null;
  condition?: string;
}

// Nondeterministic Events

export type NondeterministicEventKind = 'fog' | 'storm' | 'sensor_disruption';

export interface AffectedRegion {
  x: number;
  y: number;
  radius: number;
}

export interface NondeterministicEvent {
  type: NondeterministicEventKind;
  affectedRegion: AffectedRegion;
  duration: number; // rounds
}

// Round History

/** A single recorded action by either player during a round */
export interface MoveRecord {
  actor: 'human' | 'ai';
  role: GameRole;
  phase: GamePhase;
  actionType: ActionType;
  x?: number;
  y?: number;
  detail?: string; // human-readable description
}

export interface RoundHistoryEntry {
  round: number;
  winnerRole: GameRole;
  humanWon: boolean;
  humanRole: GameRole;
  aiRole: GameRole;
  /**
   * How the round ended:
   * - 'objectives_completed' — Ghost survived both collapses AND completed ≥3 objectives → Ghost wins
   * - 'ghost_locked'         — Seeker locked Ghost during Collapse → Seeker wins
   * - 'ghost_survived'       — Ghost survived but completed <3 objectives → Seeker wins
   */
  winCondition: 'objectives_completed' | 'all_objectives_completed' | 'ghost_locked' | 'ghost_survived';
  objectivesCompleted: number;
  moves: MoveRecord[];
}

// Serialized State (sent to client)

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
  cyclesCompleted: number;   // how many full cycles done this round (0 or 1)
  cyclesPerRound: number;    // total cycles required (always 2)
  roundHistory: RoundHistoryEntry[];
}
