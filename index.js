require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = global.fetch || require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DB_ID = process.env.NOTION_DB_ID;
const NOTION_BASE = 'https://api.notion.com/v1';

if (!NOTION_TOKEN || !DB_ID) {
  console.error('Missing NOTION_TOKEN or NOTION_DB_ID in .env');
  process.exit(1);
}

const headers = {
  'Authorization': `Bearer ${NOTION_TOKEN}`,
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json'
};

app.get('/get-words', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '10', 10), 100);
    const resp = await fetch(`${NOTION_BASE}/databases/${DB_ID}/query`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        page_size: limit,
        sorts: [{ property: 'ReviewCount', direction: 'ascending' }]
      })
    });
    const json = await resp.json();
    if (!resp.ok) return res.status(resp.status).json({ error: json });

    const items = (json.results || []).map(p => {
      const props = p.properties || {};
      const title = (props.word?.title?.[0]?.plain_text) || '';
      const description = (props.Description?.rich_text?.[0]?.plain_text) || '';
      const example = (props.Example?.rich_text?.[0]?.plain_text) || '';
      return {
        id: p.id,
        word: title,
        description,
        example,
        reviewCount: props.ReviewCount?.number ?? 0,
        date: props.Date?.date?.start ?? null,
        relevance: props.Relevance?.select?.name ?? null,
        raw: props
      };
    });
    res.json({ results: items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/update-word', async (req, res) => {
  try {
    const { pageId, increment, setReviewCount, setDate } = req.body;
    if (!pageId) return res.status(400).json({ error: 'pageId required' });

    let newCount = setReviewCount;
    if (increment) {
      const getResp = await fetch(`${NOTION_BASE}/pages/${pageId}`, {
        method: 'GET',
        headers
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
      headers,
      body: JSON.stringify({ properties })
    });
    const updateJson = await updateResp.json();
    if (!updateResp.ok) return res.status(updateResp.status).json({ error: updateJson });

    res.json({ ok: true, pageId, reviewCount: newCount, date });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('notion-word-review listening on ' + PORT));
