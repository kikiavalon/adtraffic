/**
 * Environment bootstrap — must be imported FIRST in index.ts.
 *
 * Uses dotenv with `override: true` so that .env file values take precedence
 * over empty shell environment variables. This is needed because Claude Code
 * sets ANTHROPIC_API_KEY="" in the shell environment, which would otherwise
 * prevent dotenv from loading the real key from backend/.env.
 */
import dotenv from 'dotenv';
dotenv.config({ override: true });
