/**
 * Feature flag registry — typed definitions with compile-time safety.
 *
 * Pure data: no logic, no side effects, no imports.
 * Override precedence: user DB override > env defaults > registry defaults.
 */

/** Boolean feature flags — enable/disable capabilities */
export const BOOLEAN_FLAGS = {
  'cm360.write_operations': { default: true, description: 'Gate create/update CM360 tools' },
  'cm360.tag_generation': { default: true, description: 'Gate cm360_generate_tags tool' },
  'cm360.read_operations': { default: true, description: 'Gate all list/get CM360 tools' },
  'chat.enabled': { default: true, description: 'Master switch for chat functionality' },
  'chat.file_upload': { default: true, description: 'Gate file upload in chat' },
  'beta.advanced_trafficking': { default: false, description: 'Advanced trafficking features (macros, Adobe/Demandbase)' },
  'beta.video_trafficking': { default: false, description: 'Video trafficking features (VAST/VPAID)' },
  'cm360.user_management': { default: true, description: 'Enable CM360 user & role management tools' },
} as const;

/** Numeric feature flags — configurable limits */
export const NUMERIC_FLAGS = {
  'limits.daily_api_requests': { default: 100, description: 'Per-user daily API request cap' },
  'limits.max_tool_rounds': { default: 10, description: 'Max agentic loop iterations per chat' },
  'limits.chat_rate_per_minute': { default: 20, description: 'Per-user chat rate limit' },
} as const;

/** Union type of all boolean flag names */
export type BooleanFlagName = keyof typeof BOOLEAN_FLAGS;

/** Union type of all numeric flag names */
export type NumericFlagName = keyof typeof NUMERIC_FLAGS;

/** Union of all flag names */
export type FlagName = BooleanFlagName | NumericFlagName;

/** Fully resolved flags — every flag has a concrete value */
export type ResolvedFlags = {
  [K in BooleanFlagName]: boolean;
} & {
  [K in NumericFlagName]: number;
};

/** All flag names for runtime validation */
export const ALL_FLAG_NAMES: readonly FlagName[] = [
  ...Object.keys(BOOLEAN_FLAGS) as BooleanFlagName[],
  ...Object.keys(NUMERIC_FLAGS) as NumericFlagName[],
];

/** Check if a string is a valid flag name */
export function isValidFlagName(name: string): name is FlagName {
  return ALL_FLAG_NAMES.includes(name as FlagName);
}

/** Check if a flag name is a boolean flag */
export function isBooleanFlag(name: FlagName): name is BooleanFlagName {
  return name in BOOLEAN_FLAGS;
}

/** Check if a flag name is a numeric flag */
export function isNumericFlag(name: FlagName): name is NumericFlagName {
  return name in NUMERIC_FLAGS;
}

/** Get the default ResolvedFlags (all registry defaults) */
export function getDefaultFlags(): ResolvedFlags {
  const flags = {} as Record<string, boolean | number>;
  for (const [name, def] of Object.entries(BOOLEAN_FLAGS)) {
    flags[name] = def.default;
  }
  for (const [name, def] of Object.entries(NUMERIC_FLAGS)) {
    flags[name] = def.default;
  }
  return flags as ResolvedFlags;
}
