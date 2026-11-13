// The product events Tile & Tea sends, and the exact properties each one
// carries. docs/ANALYTICS.md describes them in plain English; keep the two in
// step (a test checks that every event here is documented there).
//
// Property values are only strings, numbers and booleans, never free text a
// player typed, so nothing personal can slip into an event.

/** Which welcome-tour button finished onboarding. */
export type OnboardingExit = 'finished' | 'skipped';

/** Where a finished game ended. */
export type GameResult = 'won' | 'lost' | 'wall_game' | 'dead_hand' | 'abandoned';

/** What the player called a discard for. */
export type CallClaim = 'pung' | 'kong' | 'quint' | 'sextet' | 'mah_jongg';

/** The screen a Share button sat on. */
export type ShareSurface = 'lesson' | 'drill_streak' | 'game' | 'puzzle';

export type AnalyticsEvents = {
  /** The player left the welcome tour for the first time or on a replay. */
  onboarding_completed: { via: OnboardingExit };
  lesson_started: { lesson_id: string };
  lesson_completed: { lesson_id: string };
  /** One answer in a Train drill. `skill` is the drill's skill id. */
  drill_answered: { skill: string; correct: boolean };
  /** A drill answer lifted a skill's rating into a higher band. `level` is the band's id, e.g. 'steady'. */
  skill_level_reached: { skill: string; level: string };
  /** `opponents` is the bot level, e.g. 'beginner'. */
  game_started: { opponents: string };
  /** The player sat back down to their saved game. */
  game_resumed: { opponents: string };
  /** `abandoned`: a saved game the player replaced with a new deal (leaving the table keeps it saved). */
  game_finished: { opponents: string; result: GameResult };
  /** The player called a discard at the table. `claim` is 'pung' … 'sextet' or 'mah_jongg'; `won` is whether the tile went to them. */
  tile_called: { claim: CallClaim; won: boolean };
  /** The player traded a rack tile for an exposed Joker. `own` is true for a Joker in their own exposure. */
  joker_swapped: { own: boolean };
  share_clicked: { surface: ShareSurface };
};

export type AnalyticsEventName = keyof AnalyticsEvents;

/** Every event name, for docs checks and debugging. */
export const ANALYTICS_EVENT_NAMES = [
  'onboarding_completed',
  'lesson_started',
  'lesson_completed',
  'drill_answered',
  'skill_level_reached',
  'game_started',
  'game_resumed',
  'game_finished',
  'tile_called',
  'joker_swapped',
  'share_clicked',
] as const satisfies readonly AnalyticsEventName[];

// Fails to compile if an event is added to AnalyticsEvents but not listed above.
type Missing = Exclude<AnalyticsEventName, (typeof ANALYTICS_EVENT_NAMES)[number]>;
const listsEveryEvent: Missing extends never ? true : Missing = true;
void listsEveryEvent;

export type EventProperties = Record<string, string | number | boolean>;
