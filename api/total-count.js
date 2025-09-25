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

  try {
    const file = path.join(process.cwd(), 'data', 'index.json');
    if (!fs.existsSync(file)) {
      return res.status(404).json({ error: 'index not found. Run the reindex script to build data/index.json' });
    }

    const raw = fs.readFileSync(file, 'utf8');
    const docs = JSON.parse(raw);
    return res.json({ total: docs.length, cached: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
