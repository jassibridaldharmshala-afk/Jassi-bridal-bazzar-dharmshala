const fs = require('fs');
const path = require('path');
const express = require('express');

const app = express();
const buildDir = path.join(__dirname, '..', 'build');
const indexFile = path.join(buildDir, 'index.html');
const port = Number(process.env.PORT || process.env.SERVER_PORT || 3000);

if (!fs.existsSync(indexFile)) {
  console.error('Frontend build is missing. Run npm run build first.');
  process.exit(1);
}

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' https://checkout.razorpay.com https://www.googletagmanager.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; media-src 'self' blob: https:; connect-src 'self' https: http://localhost:5000 http://127.0.0.1:5000; frame-src 'self' https://*.razorpay.com https://*.facebook.com https://*.instagram.com; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'; manifest-src 'self'");
  next();
});
app.use(express.static(buildDir, {
  index: false,
  maxAge: '1y',
  setHeaders(res, filePath) {
    if (filePath.endsWith('index.html') || filePath.endsWith('404.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
}));

app.get('*', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(indexFile);
});

app.listen(port, () => {
  console.log(`Jassi storefront serving SPA on port ${port}`);
});
