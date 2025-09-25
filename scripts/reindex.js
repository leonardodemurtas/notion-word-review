/**
 * scripts/reindex.js
 * Run: node scripts/reindex.js
 * Expects env: NOTION_TOKEN, NOTION_DB_ID, MEILI_HOST, MEILI_API_KEY, MEILI_INDEX
 */
const fetch = global.fetch || require('node-fetch');
const { MeiliSearch } = require('meilisearch');

const NOTION_BASE = 'https://api.notion.com/v1';
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DB_ID = process.env.NOTION_DB_ID;
const MEILI_HOST = process.env.MEILI_HOST;
const MEILI_KEY = process.env.MEILI_API_KEY;
const MEILI_INDEX = process.env.MEILI_INDEX || 'words';

if (!NOTION_TOKEN || !DB_ID || !MEILI_HOST || !MEILI_KEY) {
  console.error('Missing required env vars. See README.');
  process.exit(1);
}

(async function main() {
  try {
    const client = new MeiliSearch({ host: MEILI_HOST, apiKey: MEILI_KEY });
    await client.createIndex(MEILI_INDEX).catch(()=>{});
    const index = client.index(MEILI_INDEX);

    await index.updateSettings({
      searchableAttributes: ['word','description','example'],
      filterableAttributes: ['relevance'],
      sortableAttributes: ['reviewCount','date']
    });

    let next_cursor = null;
    const pageSize = 100;
    const docsBuffer = [];
    const batchSize = 50;

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
      if (!resp.ok) throw new Error(JSON.stringify(json));

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
          relevance: props.Relevance?.select?.name ?? null
        };
        docsBuffer.push(doc);
        if (docsBuffer.length >= batchSize) {
          await index.addDocuments(docsBuffer.splice(0, docsBuffer.length));
          console.log('Flushed batch to Meili');
        }
      }

      next_cursor = json.has_more ? json.next_cursor : null;
    } while (next_cursor);

    if (docsBuffer.length) {
      await index.addDocuments(docsBuffer.splice(0, docsBuffer.length));
    }

    const stats = await index.getStats();
    console.log('Reindex done. Documents indexed:', stats.numberOfDocuments);
  } catch (err) {
    console.error('Reindex failed:', err);
    process.exit(2);
  }
})();
