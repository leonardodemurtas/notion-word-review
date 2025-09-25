const NOTION_BASE = 'https://api.notion.com/v1';
const NOTION_TOKEN = process.env.NOTION_TOKEN;

module.exports = async (req, res) => {
  // API key guard
  const incomingKey = req.headers['x-api-key'] || req.headers['X-API-KEY'];
  if (process.env.API_KEY && incomingKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { pageId, increment, setReviewCount, setDate } = req.body || {};
    if (!pageId) return res.status(400).json({ error: 'pageId required' });

    let newCount = setReviewCount;
    if (increment) {
      const getResp = await fetch(`${NOTION_BASE}/pages/${pageId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Notion-Version': '2022-06-28'
        }
      });
      const page = await getResp.json();
      if (!getResp.ok) return res.status(getResp.status).json({ error: page });
      newCount = (page.properties?.ReviewCount?.number ?? 0) + 1;
    }

    const date = setDate || new Date().toISOString();
    const properties = {};
    if (typeof newCount === 'number') properties.ReviewCount = { number: newCount };
    if (date) properties.Date = { date: { start: date } };

    const updateResp = await fetch(`${NOTION_BASE}/pages/${pageId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ properties })
    });

    const updateJson = await updateResp.json();
    if (!updateResp.ok) return res.status(updateResp.status).json({ error: updateJson });

    res.status(200).json({ ok: true, pageId, reviewCount: newCount, date });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
