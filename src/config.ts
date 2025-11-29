import 'dotenv/config';

export interface Config {
  token: string;
  clientId: string;
  guildId: string | null;
  categoryName: string;
  defaultDirectory: string;
  allowedUsers: string[];
  allowAllUsers: boolean;
  allowedPaths: string[];
  messageRetentionDays: number | null;
  rateLimitMs: number;
}

function getEnvOrExit(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`ERROR: ${name} environment variable is required`);
    console.error('Set it in your .env file or export it before running');
    process.exit(1);
  }
  return value;
}

export const config: Config = {
  // Discord bot token (required)
  token: getEnvOrExit('DISCORD_TOKEN'),

  // Discord application client ID (required)
  clientId: getEnvOrExit('DISCORD_CLIENT_ID'),

  // Guild ID for faster command registration (optional but recommended)
  guildId: process.env.DISCORD_GUILD_ID || null,

  // Category name for Claude session channels
  categoryName: process.env.CATEGORY_NAME || 'Claude Sessions',

  // Default working directory for new sessions
  defaultDirectory: process.env.DEFAULT_DIRECTORY || process.cwd(),

  // Allowed Discord user IDs (comma-separated in .env)
  allowedUsers: process.env.ALLOWED_USERS?.split(',').map(id => id.trim()).filter(Boolean) || [],

  // Explicit opt-in to allow all users (when no whitelist is set)
  allowAllUsers: process.env.ALLOW_ALL_USERS === 'true',

  // Allowed directory paths (comma-separated in .env)
  // Sessions can only be created in these directories or subdirectories
  allowedPaths: process.env.ALLOWED_PATHS?.split(',').map(p => p.trim()).filter(Boolean) || [],

  // Message retention in days (null = never delete)
  messageRetentionDays: process.env.MESSAGE_RETENTION_DAYS
    ? parseInt(process.env.MESSAGE_RETENTION_DAYS, 10)
    : null,

  // Rate limit between messages per user (in milliseconds)
  rateLimitMs: process.env.RATE_LIMIT_MS
    ? parseInt(process.env.RATE_LIMIT_MS, 10)
    : 1000, // Default 1 second
};

// Security validation at startup
if (config.allowedUsers.length > 0) {
  console.log(`User whitelist enabled: ${config.allowedUsers.length} user(s) allowed`);
} else if (config.allowAllUsers) {
  console.warn('WARNING: ALLOW_ALL_USERS=true - anyone in the guild can use this bot');
} else {
  console.error('ERROR: Security misconfiguration - set ALLOWED_USERS or ALLOW_ALL_USERS=true');
  process.exit(1);
}

if (config.allowedPaths.length > 0) {
  console.log(`Path restrictions enabled: ${config.allowedPaths.length} path(s) allowed`);
} else {
  console.warn('WARNING: No ALLOWED_PATHS set - sessions can access any directory');
}

if (config.messageRetentionDays) {
  console.log(`Message retention: ${config.messageRetentionDays} day(s)`);
}

export default config;
