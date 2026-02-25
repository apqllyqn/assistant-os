// Token-based fuzzy matching for client/folder name resolution

function tokenize(str: string): string[] {
  // Split on spaces, hyphens, dots, underscores, and camelCase boundaries
  return str
    .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase split
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2') // ACRONYMWord split
    .split(/[\s\-_.\/]+/)
    .map((t) => t.toLowerCase())
    .filter((t) => t.length > 1); // drop single chars
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function tokenSimilarity(queryTokens: string[], targetTokens: string[]): number {
  if (queryTokens.length === 0 || targetTokens.length === 0) return 0;

  let matchScore = 0;
  for (const qt of queryTokens) {
    let bestMatch = 0;
    for (const tt of targetTokens) {
      // Exact match
      if (qt === tt) { bestMatch = 1; break; }
      // Substring containment
      if (tt.includes(qt) || qt.includes(tt)) { bestMatch = Math.max(bestMatch, 0.8); continue; }
      // Levenshtein tolerance: allow 1 edit per 4 chars
      const maxDist = Math.max(1, Math.floor(Math.max(qt.length, tt.length) / 4));
      const dist = levenshtein(qt, tt);
      if (dist <= maxDist) {
        bestMatch = Math.max(bestMatch, 1 - dist / Math.max(qt.length, tt.length));
      }
    }
    matchScore += bestMatch;
  }

  // Jaccard-style: normalize by total unique tokens
  const unionSize = new Set([...queryTokens, ...targetTokens]).size;
  return matchScore / unionSize;
}

export interface MatchResult {
  index: number;
  score: number; // 0 to 1, higher = better match
}

export function fuzzyMatch(
  query: string,
  targets: string[],
  threshold = 0.25,
): MatchResult[] {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const results: MatchResult[] = [];
  for (let i = 0; i < targets.length; i++) {
    const targetTokens = tokenize(targets[i]);
    const score = tokenSimilarity(queryTokens, targetTokens);
    if (score >= threshold) {
      results.push({ index: i, score });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

export function extractOrgName(title: string, description?: string | null): string | null {
  const text = `${title} ${description || ''}`;

  // Pattern: "for [Proper Noun]" or "with [Proper Noun]" or "[Proper Noun] needs"
  const patterns = [
    /(?:for|with|at)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,2})/,
    /([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,2})\s+(?:needs?|wants?|requested|asked)/,
    /(?:from|re:?\s*)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,2})/i,
  ];

  // Common words to exclude
  const exclude = new Set([
    'the', 'and', 'for', 'with', 'from', 'about', 'after', 'before',
    'send', 'follow', 'check', 'update', 'review', 'schedule', 'meeting',
    'email', 'call', 'recap', 'next', 'steps', 'action', 'item', 'task',
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
    'january', 'february', 'march', 'april', 'may', 'june', 'july',
    'august', 'september', 'october', 'november', 'december',
  ]);

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const candidate = match[1].trim();
      const words = candidate.split(/\s+/);
      if (words.every((w) => exclude.has(w.toLowerCase()))) continue;
      if (candidate.length >= 3) return candidate;
    }
  }

  return null;
}
