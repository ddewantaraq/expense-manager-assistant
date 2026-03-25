/**
 * Path validation helpers: keep data files under the skill directory (or optional workspace).
 */
const path = require('path');

const SKILL_DIR = path.resolve(__dirname);

/**
 * Returns true if resolved child path is inside parent (or equal to a file under parent).
 */
function isPathInsideDir(childPath, parentPath) {
  const child = path.resolve(childPath);
  const parent = path.resolve(parentPath);
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/**
 * Resolve EXPENSES_CSV_PATH (or default) to an absolute path that must stay under the skill directory.
 */
function resolveAllowedCsvPath() {
  const raw = process.env.EXPENSES_CSV_PATH || 'expenses.csv';
  const resolved = path.isAbsolute(raw) ? path.resolve(raw) : path.resolve(SKILL_DIR, raw);
  if (!isPathInsideDir(resolved, SKILL_DIR)) {
    throw new Error(
      `EXPENSES_CSV_PATH must resolve inside the skill directory: ${SKILL_DIR}`
    );
  }
  return resolved;
}

/**
 * Allowed roots for receipt images: skill dir + optional OPENCLAW_WORKSPACE.
 */
function getImageAllowedRoots() {
  const roots = [SKILL_DIR];
  const ws = process.env.OPENCLAW_WORKSPACE;
  if (ws && String(ws).trim()) {
    roots.push(path.resolve(String(ws).trim()));
  }
  return roots;
}

/**
 * Resolve and validate an image path for reading (must be under one of the allowed roots).
 */
function resolveAllowedImagePath(imagePathArg) {
  if (!imagePathArg || typeof imagePathArg !== 'string') {
    throw new Error('Image path is required');
  }
  const resolved = path.resolve(imagePathArg);
  const roots = getImageAllowedRoots();
  const ok = roots.some((root) => isPathInsideDir(resolved, root));
  if (!ok) {
    throw new Error(
      `Image path must be under the skill directory (${SKILL_DIR}) or OPENCLAW_WORKSPACE if set. Got: ${resolved}`
    );
  }
  return resolved;
}

const MAX_ITEM_LENGTH = 200;

function sanitizeItem(item) {
  const s = String(item);
  const noControls = s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');
  if (noControls.length > MAX_ITEM_LENGTH) {
    return noControls.slice(0, MAX_ITEM_LENGTH);
  }
  return noControls;
}

module.exports = {
  SKILL_DIR,
  isPathInsideDir,
  resolveAllowedCsvPath,
  resolveAllowedImagePath,
  sanitizeItem,
  MAX_ITEM_LENGTH,
};
