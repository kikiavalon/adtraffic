import { Router } from 'express';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { CM360_TOOLS } from '../claude/tool-definitions.js';

const router = Router();

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifestPath = join(__dirname, '..', 'agent-manifest.json');

let cachedManifest: unknown = null;

function getManifest(): unknown {
  if (!cachedManifest) {
    const raw = readFileSync(manifestPath, 'utf-8');
    cachedManifest = JSON.parse(raw);
  }
  return cachedManifest;
}

/**
 * GET /api/v1/agent/manifest
 * Public endpoint — returns the agent capability manifest.
 * Used for IAB Agent Registry, interoperability, and transparency.
 */
router.get('/agent/manifest', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=3600');
  res.json(getManifest());
});

/**
 * GET /api/v1/agent/tools
 * Public endpoint — returns the list of CM360 tools with descriptions.
 * Useful for other systems discovering our agent's capabilities.
 */
router.get('/agent/tools', (_req, res) => {
  const tools = CM360_TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
  }));

  res.set('Cache-Control', 'public, max-age=3600');
  res.json({
    tool_count: tools.length,
    tools,
  });
});

export default router;
