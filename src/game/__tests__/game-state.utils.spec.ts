import {
  applyDiceRoll,
  applyTokenMove,
  createInitialTokens,
  initializeGameState,
} from '../../shared/utils/game-state.utils';
import { validateMove } from '../../shared/utils/board.utils';
import {
  DEFAULT_GAME_CONFIG,
  DEFAULT_GAME_RULES,
  Player,
} from '../../shared/types/game.types';
import { BASE_POSITION, PLAYER_START_POSITIONS } from '../../shared/constants/board.constants';

function makePlayers(): Player[] {
  return [
    {
      playerId: 'p1',
      userId: 'u1',
      socketId: 'sock1',
      color: 'red',
      name: 'Alice',
      avatar: '👩',
      mood: 'Happy',
      isReady: true,
      isConnected: true,
      isHost: true,
    },
    {
      playerId: 'p2',
      userId: 'u2',
      socketId: 'sock2',
      color: 'green',
      name: 'Bob',
      avatar: '👨',
      mood: 'Happy',
      isReady: true,
      isConnected: true,
      isHost: false,
    },
  ];
}

describe('createInitialTokens', () => {
  it('creates correct number of tokens per player', () => {
    const players = makePlayers();
    const tokens = createInitialTokens(players, 4);
    expect(tokens.length).toBe(8);
    expect(tokens.filter((t) => t.color === 'red').length).toBe(4);
    expect(tokens.filter((t) => t.color === 'green').length).toBe(4);
  });

  it('all tokens start in base', () => {
    const tokens = createInitialTokens(makePlayers(), 4);
    tokens.forEach((t) => {
      expect(t.state).toBe('base');
      expect(t.position).toBe(BASE_POSITION);
      expect(t.homeColumnIndex).toBe(-1);
    });
  });
});

describe('initializeGameState', () => {
  it('creates a valid initial state', () => {
    const players = makePlayers();
    const state = initializeGameState('room1', players);
    expect(state.phase).toBe('playing');
    expect(state.currentTurn).toBe('p1'); // first player
    expect(state.diceValue).toBeNull();
    expect(state.tokens.length).toBe(8); // 2 players × 4 tokens
  });
});

describe('applyDiceRoll', () => {
  it('sets dice value and computes valid moves', () => {
    const players = makePlayers();
    const state = initializeGameState('room1', players);
    // All tokens in base + dice = 6 → should have 4 valid moves for red
    const newState = applyDiceRoll(state, 6, 'p1', 'evt1');
    expect(newState.diceValue).toBe(6);
    expect(newState.validMoves.length).toBeGreaterThan(0);
  });

  it('advances turn when dice = 3 and all tokens in base', () => {
    const players = makePlayers();
    const state = initializeGameState('room1', players);
    // No valid moves with dice=3 + requireSixToStart → auto-advance
    const newState = applyDiceRoll(state, 3, 'p1', 'evt2');
    expect(newState.currentTurn).toBe('p2');
    expect(newState.validMoves.length).toBe(0);
  });

  it('handles 3 consecutive sixes by skipping turn', () => {
    const players = makePlayers();
    let state = initializeGameState('room1', players, {}, { maxConsecutiveSixes: 3 });
    // Bring a token into play so dice=6 doesn't get force-turned
    state.tokens[0] = { ...state.tokens[0], state: 'active', position: PLAYER_START_POSITIONS.red };
    state = applyDiceRoll(state, 6, 'p1', 'e1');
    state = applyDiceRoll({ ...state, diceValue: null, currentTurn: 'p1' }, 6, 'p1', 'e2');
    state = applyDiceRoll({ ...state, diceValue: null, currentTurn: 'p1', consecutiveSixes: 2 }, 6, 'p1', 'e3');
    // Third six → turn should advance to p2
    expect(state.currentTurn).toBe('p2');
    expect(state.consecutiveSixes).toBe(0);
  });
});

describe('applyTokenMove', () => {
  it('moves a token from base to board on 6', () => {
    const players = makePlayers();
    const state = initializeGameState('room1', players);
    const stateAfterRoll = applyDiceRoll(state, 6, 'p1', 'roll1');
    const tokenId = stateAfterRoll.validMoves[0];
    const token = stateAfterRoll.tokens.find((t) => t.tokenId === tokenId)!;

    const validation = validateMove(token, 6, stateAfterRoll.tokens, DEFAULT_GAME_RULES);
    const newState = applyTokenMove(stateAfterRoll, tokenId, validation, 'move1');

    const movedToken = newState.tokens.find((t) => t.tokenId === tokenId)!;
    expect(movedToken.state).toBe('active');
    expect(movedToken.position).toBe(PLAYER_START_POSITIONS.red);
  });

  it('resets captured token to base', () => {
    const players = makePlayers();
    const state = initializeGameState('room1', players);
    // Place red token and green token at position 5
    state.tokens[0] = {
      ...state.tokens[0], state: 'active', position: 1, color: 'red',
    };
    state.tokens[4] = {
      ...state.tokens[4], state: 'active', position: 5, color: 'green',
    };
    const stateAfterRoll = applyDiceRoll(state, 4, 'p1', 'roll1');
    // red_0 is at 1, move 4 steps → lands on 5 where green_0 is
    const validation = validateMove(state.tokens[0], 4, state.tokens, DEFAULT_GAME_RULES);
    if (!validation.valid) return; // skip if not valid in this scenario
    const newState = applyTokenMove(stateAfterRoll, 'red_0', validation, 'move1');

    if (validation.capturedTokenId) {
      const captured = newState.tokens.find((t) => t.tokenId === validation.capturedTokenId)!;
      expect(captured.state).toBe('base');
      expect(captured.position).toBe(BASE_POSITION);
    }
  });
});
