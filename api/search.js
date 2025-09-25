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

  const rawQ = (req.query.q || '').trim();
  const q = rawQ.toLowerCase();
  const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10) || 1, 1), 100);

  // new: support type filter (comma-separated). e.g. ?type=verb,adjective
  const typesParam = (req.query.type || req.query.types || '').trim();
  const typesFilter = typesParam
    ? typesParam.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
    : [];

  // require either q or type filter
  if (!q && typesFilter.length === 0) {
    return res.status(400).json({ error: 'q or type query required' });
  }

  try {
    const file = path.join(process.cwd(), 'data', 'index.json');
    if (!fs.existsSync(file)) return res.status(500).json({ error: 'index not built (data/index.json missing)' });

    const raw = fs.readFileSync(file, 'utf8');
    const docs = JSON.parse(raw);

    const hits = docs.filter(d => {
      // match q against word/description/example if q provided
      let qMatches = true;
      if (q) {
        const combined = ((d.word || '') + ' ' + (d.description || '') + ' ' + (d.example || '')).toLowerCase();
        qMatches = combined.includes(q);
      }

      // match types if requested
      let typeMatches = true;
      if (typesFilter.length > 0) {
        const multi = (d.raw && d.raw.Type && d.raw.Type.multi_select) || [];
        const typeNames = multi.map(t => (t && t.name || '').toLowerCase());
        typeMatches = typesFilter.some(tf => typeNames.includes(tf));
      }

      return qMatches && typeMatches;
    });

    const results = hits.slice(0, limit).map(d => ({
      id: d.id,
      pageId: d.pageId,
      word: d.word,
      description: d.description,
      example: d.example,
      reviewCount: d.reviewCount,
      date: d.date,
      relevance: d.relevance,
      types: (d.raw && d.raw.Type && d.raw.Type.multi_select) ? d.raw.Type.multi_select.map(t => t.name) : []
    }));

    res.json({ hits: results, nbHits: hits.length, offset: 0, limit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
