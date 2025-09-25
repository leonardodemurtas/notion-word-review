/**
 * scripts/reindex.js
 * Pages a Notion DB and writes data/index.json
 * Expects env: NOTION_TOKEN, NOTION_DB_ID
 */
const fs = require('fs');
const path = require('path');
const fetch = global.fetch || require('node-fetch');

const NOTION_BASE = 'https://api.notion.com/v1';
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DB_ID = process.env.NOTION_DB_ID;

if (!NOTION_TOKEN || !DB_ID) {
  console.error('Missing required env vars: NOTION_TOKEN and NOTION_DB_ID');
  process.exit(1);
}

(async () => {
  try {
    console.log('Starting Notion reindex (to data/index.json)...');
    const docs = [];
    let next_cursor = null;
    const pageSize = 100;

    do {
      const body = { page_size: pageSize };
      if (next_cursor) body.start_cursor = next_cursor;

      const resp = await fetch(`${NOTION_BASE}/databases/${DB_ID}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      const json = await resp.json();
      if (!resp.ok) {
        console.error('Notion API error:', JSON.stringify(json));
        process.exit(2);
      }

      for (const p of (json.results || [])) {
        const props = p.properties || {};
        const doc = {
          id: p.id,
          pageId: p.id,
          word: (props.word?.title?.[0]?.plain_text) || '',
          description: (props.Description?.rich_text?.[0]?.plain_text) || '',
          example: (props.Example?.rich_text?.[0]?.plain_text) || '',
          reviewCount: props.ReviewCount?.number ?? 0,
          date: props.Date?.date?.start ?? null,
          relevance: props.Relevance?.select?.name ?? null,
          raw: props
        };
        docs.push(doc);
      }

      next_cursor = json.has_more ? json.next_cursor : null;
      console.log('Fetched batch, total so far:', docs.length);
    } while (next_cursor);

    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    const outPath = path.join(dataDir, 'index.json');
    fs.writeFileSync(outPath, JSON.stringify(docs, null, 2), 'utf8');
    console.log('Wrote', outPath, 'with', docs.length, 'documents');
    process.exit(0);
  } catch (err) {
    console.error('Reindex failed:', err);
    process.exit(3);
  }
})();
