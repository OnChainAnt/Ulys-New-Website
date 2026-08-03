// Contentful Delivery API helpers for the Glossary + News pages.
// Fill in CTF below with your Contentful space credentials + content model.
// The delivery token is read-only and safe to expose in the browser.
window.CTF = {
  space: 'YOUR_SPACE_ID',
  token: 'YOUR_DELIVERY_TOKEN',
  environment: 'master',
  // --- Glossary content type + field names ---
  glossary: {
    contentType: 'glossaryTerm',
    fields: { title: 'title', description: 'description', date: 'date', slug: 'slug' },
    // if entries link to full articles, the base path used with the slug:
    urlBase: 'https://ulys.ai/crypto-glossary/',
  },
  // --- News content type + field names ---
  news: {
    contentType: 'newsArticle',
    fields: { title: 'title', excerpt: 'excerpt', date: 'date', slug: 'slug' },
    urlBase: 'https://ulys.ai/news/',
  },
};

window.cmsConfigured = function () {
  return window.CTF.space && window.CTF.space !== 'YOUR_SPACE_ID' &&
    window.CTF.token && window.CTF.token !== 'YOUR_DELIVERY_TOKEN';
};

// Fetch all entries of a content type (handles pagination).
window.cmsFetchAll = async function (contentType) {
  const { space, token, environment } = window.CTF;
  const base = `https://cdn.contentful.com/spaces/${space}/environments/${environment}/entries`;
  const items = [];
  let skip = 0;
  const limit = 500;
  while (true) {
    const url = `${base}?content_type=${encodeURIComponent(contentType)}&limit=${limit}&skip=${skip}&order=-sys.createdAt`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Contentful ${res.status}`);
    const data = await res.json();
    items.push(...(data.items || []));
    if (!data.items || data.items.length < limit) break;
    skip += limit;
  }
  return items;
};

window.fmtDate = function (v) {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d)) return String(v);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

window.esc = function (s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
};
