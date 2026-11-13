import type { BotLevel } from '@/game/bots';
import type { TileKind } from '@/game/tiles';

/** How each opponent level is named and described to the player. */
export const LEVEL_INFO: Readonly<Record<BotLevel, { name: string; detail: string; tile: TileKind }>> = {
  beginner: {
    name: 'Beginner',
    detail: 'Learning alongside you. Plays fair, makes mistakes, and never reads your exposures.',
    tile: { type: 'flower' },
  },
  club: {
    name: 'Club',
    detail: 'A steady weekly player. Counts dead tiles, keeps a backup hand, swaps for Jokers.',
    tile: { type: 'dragon', dragon: 'green' },
  },
  shark: {
    name: 'Shark',
    detail: 'Reads your exposures and won’t throw what you need, especially late in the wall.',
    tile: { type: 'dragon', dragon: 'red' },
  },
};
