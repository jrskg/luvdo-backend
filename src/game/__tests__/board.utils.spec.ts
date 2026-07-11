import {
  calculateNewPosition,
  checkCapture,
  checkWin,
  getValidMoves,
  isSafePosition,
  isStarPosition,
} from '../../shared/utils/board.utils';
import {
  BASE_POSITION,
  CENTER_POSITION,
  HOME_COLUMN_START,
  PLAYER_START_POSITIONS,
  SAFE_POSITIONS,
  STAR_POSITIONS,
} from '../../shared/constants/board.constants';
import { DEFAULT_GAME_RULES, Token } from '../../shared/types/game.types';

function makeToken(overrides: Partial<Token>): Token {
  return {
    tokenId: 'red_0',
    playerId: 'player1',
    color: 'red',
    state: 'active',
    position: 0,
    homeColumnIndex: -1,
    ...overrides,
  };
}

describe('isSafePosition', () => {
  it('returns true for all safe positions', () => {
    SAFE_POSITIONS.forEach((pos) => expect(isSafePosition(pos)).toBe(true));
  });

  it('returns false for non-safe positions', () => {
    expect(isSafePosition(1)).toBe(false);
    expect(isSafePosition(5)).toBe(false);
  });
});

describe('isStarPosition', () => {
  it('returns true for all star positions', () => {
    STAR_POSITIONS.forEach((pos) => expect(isStarPosition(pos)).toBe(true));
  });
});

describe('calculateNewPosition', () => {
  describe('token in base', () => {
    it('enters board on 6', () => {
      const token = makeToken({ state: 'base', position: BASE_POSITION });
      const result = calculateNewPosition(token, 6);
      expect(result.newState).toBe('active');
      expect(result.newPosition).toBe(PLAYER_START_POSITIONS.red);
    });

    it('stays in base on non-6 roll', () => {
      const token = makeToken({ state: 'base', position: BASE_POSITION });
      const result = calculateNewPosition(token, 3);
      expect(result.newState).toBe('base');
      expect(result.newPosition).toBe(BASE_POSITION);
    });
  });

  describe('active movement on main ring', () => {
    it('moves forward correctly', () => {
      const token = makeToken({ state: 'active', position: 5 });
      const result = calculateNewPosition(token, 4);
      expect(result.newState).toBe('active');
      expect(result.newPosition).toBe(9);
    });

    it('wraps around from position 51', () => {
      const token = makeToken({ state: 'active', position: 49, color: 'green' });
      // Green home entry is at 12; position 49 + 3 = 52 → wraps to 0
      const result = calculateNewPosition(token, 3);
      expect(result.newState).toBe('active');
      expect(result.newPosition).toBe(52 % 52); // = 0
    });
  });

  describe('home column entry', () => {
    it('red token lands exactly on home entry (position 50)', () => {
      const token = makeToken({ state: 'active', position: 49, color: 'red' });
      const result = calculateNewPosition(token, 1);
      expect(result.newState).toBe('active');
      expect(result.newPosition).toBe(50);
    });

    it('red token enters home column past position 50', () => {
      // homeEntry=50; stepsToEntry from 49 = 1; dice=4 → homeSteps=4-1-1=2 → index 2
      const token = makeToken({ state: 'active', position: 49, color: 'red' });
      const result = calculateNewPosition(token, 4);
      expect(result.newState).toBe('home_column');
      expect(result.newHomeColumnIndex).toBe(2);
      expect(result.newPosition).toBe(HOME_COLUMN_START.red + 2);
    });

    it('red token at home entry enters first home cell with dice=1', () => {
      const token = makeToken({ state: 'active', position: 50, color: 'red' });
      const result = calculateNewPosition(token, 1);
      expect(result.newState).toBe('home_column');
      expect(result.newHomeColumnIndex).toBe(0);
      expect(result.newPosition).toBe(HOME_COLUMN_START.red);
    });

    it('token reaching center is marked finished', () => {
      // Token in home column at index 4 with 1 step → finishes
      const token = makeToken({
        state: 'home_column',
        position: HOME_COLUMN_START.red + 4,
        color: 'red',
        homeColumnIndex: 4,
      });
      const result = calculateNewPosition(token, 1);
      expect(result.newState).toBe('finished');
      expect(result.newPosition).toBe(CENTER_POSITION);
    });

    it('token overshooting home column stays put', () => {
      const token = makeToken({
        state: 'home_column',
        position: HOME_COLUMN_START.red + 3,
        color: 'red',
        homeColumnIndex: 3,
      });
      const result = calculateNewPosition(token, 4); // would need exactly 2 more
      expect(result.newState).toBe('home_column');
      expect(result.newHomeColumnIndex).toBe(3); // unchanged
    });
  });
});

describe('checkCapture', () => {
  it('returns null on safe position', () => {
    const moving = makeToken({ state: 'active', position: 5 });
    const opponent = makeToken({
      tokenId: 'green_0',
      playerId: 'player2',
      color: 'green',
      state: 'active',
      position: SAFE_POSITIONS[1], // safe
    });
    const result = checkCapture(moving, SAFE_POSITIONS[1], [moving, opponent]);
    expect(result).toBeNull();
  });

  it('returns opponent token when capturable', () => {
    const moving = makeToken({ state: 'active', position: 5 });
    const opponent = makeToken({
      tokenId: 'green_0',
      playerId: 'player2',
      color: 'green',
      state: 'active',
      position: 10,
    });
    const result = checkCapture(moving, 10, [moving, opponent]);
    expect(result?.tokenId).toBe('green_0');
  });

  it('returns null when two opponents block (cannot capture a block)', () => {
    const moving = makeToken({ state: 'active', position: 5 });
    const opp1 = makeToken({ tokenId: 'green_0', playerId: 'player2', color: 'green', state: 'active', position: 10 });
    const opp2 = makeToken({ tokenId: 'green_1', playerId: 'player2', color: 'green', state: 'active', position: 10 });
    const result = checkCapture(moving, 10, [moving, opp1, opp2]);
    expect(result).toBeNull();
  });
});

describe('checkWin', () => {
  it('returns true when all tokens finished', () => {
    const tokens = [
      makeToken({ tokenId: 'red_0', state: 'finished' }),
      makeToken({ tokenId: 'red_1', state: 'finished' }),
      makeToken({ tokenId: 'red_2', state: 'finished' }),
      makeToken({ tokenId: 'red_3', state: 'finished' }),
    ];
    expect(checkWin(tokens, 'player1')).toBe(true);
  });

  it('returns false when not all tokens finished', () => {
    const tokens = [
      makeToken({ tokenId: 'red_0', state: 'finished' }),
      makeToken({ tokenId: 'red_1', state: 'active', position: 10 }),
      makeToken({ tokenId: 'red_2', state: 'finished' }),
      makeToken({ tokenId: 'red_3', state: 'finished' }),
    ];
    expect(checkWin(tokens, 'player1')).toBe(false);
  });
});

describe('getValidMoves', () => {
  const baseTokens = [
    makeToken({ tokenId: 'red_0', state: 'base', position: BASE_POSITION }),
    makeToken({ tokenId: 'red_1', state: 'base', position: BASE_POSITION }),
    makeToken({ tokenId: 'red_2', state: 'active', position: 5 }),
    makeToken({ tokenId: 'red_3', state: 'active', position: 10 }),
  ];

  it('returns base tokens only when dice=6 and requireSixToStart', () => {
    const moves = getValidMoves(baseTokens, 'player1', 6, DEFAULT_GAME_RULES);
    expect(moves).toContain('red_0');
    expect(moves).toContain('red_1');
    expect(moves).toContain('red_2');
    expect(moves).toContain('red_3');
  });

  it('excludes base tokens when dice != 6 and requireSixToStart', () => {
    const moves = getValidMoves(baseTokens, 'player1', 4, DEFAULT_GAME_RULES);
    expect(moves).not.toContain('red_0');
    expect(moves).not.toContain('red_1');
    expect(moves).toContain('red_2');
    expect(moves).toContain('red_3');
  });

  it('excludes finished tokens', () => {
    const tokens = [
      makeToken({ tokenId: 'red_0', state: 'finished' }),
      makeToken({ tokenId: 'red_1', state: 'active', position: 5 }),
    ];
    const moves = getValidMoves(tokens, 'player1', 3, DEFAULT_GAME_RULES);
    expect(moves).not.toContain('red_0');
    expect(moves).toContain('red_1');
  });
});
