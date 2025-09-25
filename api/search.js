const fs = require('fs');
const path = require('path');

function authGuard(req, res) {
  const incomingKey = req.headers['x-api-key'] || req.headers['X-API-KEY'];
  if (process.env.API_KEY && incomingKey !== process.env.API_KEY) {
    res.status(401).json({ error: 'unauthorized' });
    return false;
  }
  return true;
}

module.exports = async (req, res) => {
  if (!authGuard(req, res)) return;
  if (req.method !== 'GET') return res.status(405).end();

  const q = (req.query.q || '').trim().toLowerCase();
  const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10) || 1, 1), 100);

  if (!q) return res.status(400).json({ error: 'q query required' });

  try {
    const file = path.join(process.cwd(), 'data', 'index.json');
    if (!fs.existsSync(file)) return res.status(500).json({ error: 'index not built (data/index.json missing)' });

    const raw = fs.readFileSync(file, 'utf8');
    const docs = JSON.parse(raw);

    const hits = docs.filter(d => {
      const combined = ((d.word || '') + ' ' + (d.description || '') + ' ' + (d.example || '')).toLowerCase();
      return combined.includes(q);
    });

    const results = hits.slice(0, limit).map(d => ({
      id: d.id,
      pageId: d.pageId,
      word: d.word,
      description: d.description,
      example: d.example,
      reviewCount: d.reviewCount,
      date: d.date,
      relevance: d.relevance
    }));

    res.json({ hits: results, nbHits: hits.length, offset: 0, limit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
