import seedrandom from 'seedrandom';
import { gameEngine } from '../GameEngine';

async function runMatches(count: number, seed: string) {
  // Seed Math.random for reproducibility
  seedrandom(seed, { global: true });

  const results: Record<string, number> = { GHOST: 0, SEEKER: 0, TIE: 0 };

  for (let i = 0; i < count; i++) {
    gameEngine.initialize({ humanPlayerId: `human_${i}` });
    // Run until match over or max ticks exceeded
    let ticks = 0;
    const MAX_TICKS = 10000;
    while (!gameEngine.isMatchOver() && ticks++ < MAX_TICKS) {
      gameEngine.tick();
    }

    const winner = gameEngine.getMatchWinner();
    if (winner === null) results.TIE++;
    else results[winner] = (results[winner] ?? 0) + 1;
  }

  console.log(`Evaluation: ${count} matches (seed=${seed})`);
  console.table(results as any);
}

if (require.main === module) {
  const matches = parseInt(process.argv[2] || '10', 10);
  const seed = process.argv[3] || 'eval-seed';
  runMatches(matches, seed).catch(err => {
    console.error('Evaluation error:', err);
    process.exit(1);
  });
}
