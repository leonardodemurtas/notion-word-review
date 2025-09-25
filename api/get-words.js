const NOTION_BASE = 'https://api.notion.com/v1';
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DB_ID = process.env.NOTION_DB_ID;

module.exports = async (req, res) => {
  // API key guard
  const incomingKey = req.headers['x-api-key'] || req.headers['X-API-KEY'];
  if (process.env.API_KEY && incomingKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  if (req.method !== 'GET') return res.status(405).end();
  try {
    const limit = Math.min(parseInt(req.query.limit || '10', 10), 100);
    const resp = await fetch(`${NOTION_BASE}/databases/${DB_ID}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        page_size: limit,
        sorts: [{ property: 'ReviewCount', direction: 'ascending' }]
      })
    });

    const json = await resp.json();
    if (!resp.ok) return res.status(resp.status).json({ error: json });

    const items = (json.results || []).map(p => {
      const props = p.properties || {};
      return {
        id: p.id,
        word: (props.word?.title?.[0]?.plain_text) || '',
        description: (props.Description?.rich_text?.[0]?.plain_text) || '',
        example: (props.Example?.rich_text?.[0]?.plain_text) || '',
        reviewCount: props.ReviewCount?.number ?? 0,
        date: props.Date?.date?.start ?? null,
        relevance: props.Relevance?.select?.name ?? null,
        raw: props
      };
    });

    res.status(200).json({ results: items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
