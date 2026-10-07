// Isolated visual QA: serves the built frontend and synthetic public data.
// Never loads .env, connects to MongoDB, or forwards requests to a live store.
// Compile with REACT_APP_API_URL=http://127.0.0.1:4173/api and a separate
// BUILD_PATH=build/performance-preview, then open http://127.0.0.1:4173.
// HOME_DELAY_MS=20000 exercises the 15-second read timeout/retry state.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../build/performance-preview');
const delay = Math.max(0, Math.min(60000, Number(process.env.HOME_DELAY_MS) || 5000));
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
const product = { _id: '0123456789abcdef01234567', name: 'Preview Jewellery Set', price: 999, originalPrice: 1299, stock: 5, images: [], isFeatured: true, sizes: [], colors: [], sizingMode: 'none' };
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:4173');
  if (url.pathname.startsWith('/api/')) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'GET') { res.statusCode = 405; res.end(JSON.stringify({ message: 'Read-only performance preview' })); return; }
    const responses = {
      '/api/website-config': { config: {}, metadata: {} },
      '/api/stores/resolve': { isDefault: true },
      '/api/cart': [], '/api/wishlist': [], '/api/categories': [], '/api/banners': [],
      '/api/settings': {}, '/api/products': [product],
      '/api/storefront/home': { format: 'compact-v1', products: [product], collections: { featured: [product._id] }, categories: [], banners: [], settings: { available: false }, warnings: [] },
    };
    const send = () => { if (!res.destroyed) res.end(JSON.stringify(responses[url.pathname] || {})); };
    if (url.pathname === '/api/storefront/home') {
      const timer = setTimeout(send, delay);
      res.on('close', () => clearTimeout(timer));
    } else send();
    return;
  }
  const target = path.resolve(root, `.${decodeURIComponent(url.pathname)}`);
  if (target !== root && !target.startsWith(root + path.sep)) { res.statusCode = 403; res.end(); return; }
  const file = fs.existsSync(target) && fs.statSync(target).isFile() ? target : path.join(root, 'index.html');
  res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).on('error', () => { res.statusCode = 404; res.end('Run npm run build first.'); }).pipe(res);
}).listen(4173, '127.0.0.1', () => console.log(`Read-only synthetic preview: http://127.0.0.1:4173 (home delay ${delay}ms)`));
