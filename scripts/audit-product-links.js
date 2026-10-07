/* eslint-disable no-console */

const apiBase = String(process.env.SAMIRA_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');

async function readJson(url) {
  const response = await fetch(url);
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { ok: response.ok, status: response.status, body };
}

async function main() {
  const catalogResponse = await readJson(`${apiBase}/products`);
  if (!catalogResponse.ok) {
    throw new Error(`Catalog request failed with HTTP ${catalogResponse.status}`);
  }

  const products = Array.isArray(catalogResponse.body)
    ? catalogResponse.body
    : (Array.isArray(catalogResponse.body?.items) ? catalogResponse.body.items : []);
  const failures = [];

  for (const product of products) {
    const id = String(product?._id || product?.id || '').trim();
    const slug = String(product?.slug || '').trim();
    const keys = [...new Set([id, slug].filter(Boolean))];

    if (!id) {
      failures.push({ name: product?.name || 'Unnamed product', key: '(missing id)', status: 'invalid catalog row' });
      continue;
    }

    for (const key of keys) {
      const detailResponse = await readJson(`${apiBase}/products/${encodeURIComponent(key)}`);
      if (!detailResponse.ok) {
        const stableResponse = id ? await readJson(`${apiBase}/products/${encodeURIComponent(id)}`) : null;
        const storedSlug = String(stableResponse?.body?.slug || '');
        failures.push({
          name: product?.name || id,
          id,
          key,
          keyLength: key.length,
          status: detailResponse.status,
          message: detailResponse.body?.message || '',
          storedSlug: JSON.stringify(storedSlug),
          codePoints: [...storedSlug].map((character) => character.codePointAt(0)).join(','),
        });
      }
    }
  }

  console.log(`Checked ${products.length} catalog products (${products.reduce((sum, product) => sum + new Set([product?._id || product?.id, product?.slug].filter(Boolean)).size, 0)} detail URLs).`);
  if (failures.length) {
    console.error('Broken product detail URLs:');
    failures.forEach((failure) => console.error(`- ${failure.name}: key=${JSON.stringify(failure.key)}, id=${failure.id}, length=${failure.keyLength} (HTTP ${failure.status}${failure.message ? `, ${failure.message}` : ''}); storedSlug=${failure.storedSlug}, codePoints=${failure.codePoints}`));
    process.exitCode = 1;
    return;
  }
  console.log('Every catalog product resolves by its stable ID and current slug.');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
