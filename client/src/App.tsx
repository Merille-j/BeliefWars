import React from 'react';
import { useGameStore } from './store/gameStore';
import { useSocket } from './hooks/useSocket';
import { StartScreen } from './components/StartScreen';
import { GameScreen } from './components/GameScreen';
import { ResultScreen } from './components/ResultScreen';
import { ClientAction } from './types/client.types';

/**
 * Root application component.
 * Manages top-level game state transitions:
 * - StartScreen: no active game
 * - GameScreen: game in progress
 * - ResultScreen: match ended
 */
const App: React.FC = () => {
  const { isGameActive, isMatchOver, resetGame } = useGameStore();
  const { startGame, sendAction } = useSocket();

  const handleStartGame = () => {
    resetGame();
    startGame();
  };

  const handlePlayAgain = () => {
    resetGame();
    startGame();
  };

  const handleAction = (action: ClientAction) => {
    sendAction(action);
  };

  if (isMatchOver) {
    return <ResultScreen onPlayAgain={handlePlayAgain} />;
  }

  if (!isGameActive) {
    return <StartScreen onStart={handleStartGame} />;
  }

  return <GameScreen onAction={handleAction} />;
};

export default App;
