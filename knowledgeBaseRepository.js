// lib/knowledgeBaseRepository.js
// Answers general, non-order-specific questions (return policy, refund
// timelines, cancellation policy, etc.) from the kb_articles table. This is
// deliberately separate from orderRepository: order facts and policy facts
// are different sources of truth and must never blend.

const db = require('./database');

const allArticlesStmt = db.prepare('SELECT * FROM kb_articles');

const STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'do', 'does', 'did', 'i', 'you', 'your',
  'my', 'me', 'to', 'of', 'for', 'on', 'in', 'it', 'can', 'will', 'how',
  'what', 'when', 'and', 'or', 'have', 'has', 'this', 'that', 'be', 'get',
]);

// Very light stemming - just enough to match "refund"/"refunds",
// "return"/"returns" etc. without pulling in a real NLP dependency.
function stem(word) {
  if (word.length > 4 && word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (word.length > 4 && word.endsWith('es')) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s')) return word.slice(0, -1);
  return word;
}

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w))
    .map(stem);
}

/**
 * Bag-of-words keyword scorer, plus a bonus for exact multi-word phrase
 * hits. Enough for an MVP knowledge base - swap for real full-text search
 * or embeddings post-MVP without touching any caller of this function.
 */
function searchKnowledgeBase(query) {
  const articles = allArticlesStmt.all();
  const queryLower = query.toLowerCase();
  const queryTokens = new Set(tokenize(query));

  let best = null;
  let bestScore = 0;

  for (const article of articles) {
    const phrases = article.keywords.split(',').map((k) => k.trim().toLowerCase());
    let score = 0;

    for (const phrase of phrases) {
      if (phrase.includes(' ') && queryLower.includes(phrase)) {
        score += 3; // exact multi-word phrase match is the strongest signal
      }
    }

    const articleTokens = new Set(tokenize(phrases.join(' ')));
    for (const t of queryTokens) {
      if (articleTokens.has(t)) score += 1;
    }

    if (score > bestScore) {
      bestScore = score;
      best = article;
    }
  }

  // Require at least a couple of overlapping signals so a stray shared word
  // doesn't produce a confident-looking wrong answer.
  return bestScore >= 2 ? best : null;
}

module.exports = { searchKnowledgeBase };
