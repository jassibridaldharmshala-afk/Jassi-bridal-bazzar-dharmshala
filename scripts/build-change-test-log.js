const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const outPath = path.join(root, 'Jassi-Change-Test-Log.xls');

function gitLines(cmd) {
  const raw = execSync(cmd, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  return raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

const tracked = gitLines('git diff --name-only HEAD');
const extra = gitLines('git ls-files --others --exclude-standard');
const files = [...new Set([...tracked, ...extra])]
  .filter((file) => !file.includes('node_modules') && !file.endsWith('.package-lock.json'))
  .sort((a, b) => a.localeCompare(b));

function areaFor(file) {
  const f = file.replace(/\\/g, '/');
  if (f.includes('quickAdd') || f.includes('QuickAdd') || f.includes('quickAddVision')) return 'Quick Add + photo AI';
  if (f.includes('reel') || f.includes('Reel') || f.includes('localReel')) return 'Reel Product Import';
  if (f.includes('upload') || f.includes('r2Upload') || f.includes('cloudinary') || f.includes('mediaStorage') || f.includes('ImageUploader') || f.includes('VideoUploader')) return 'Uploads / R2';
  if (f.includes('ProductDraft') || f.includes('product-draft') || f.includes('productDraft')) return 'Product drafts';
  if (f.includes('variant') || f.includes('Variant')) return 'Variant groups';
  if (f.includes('catalogOptions') || f.includes('Categor')) return 'Categories';
  if (f.includes('cart') || f.includes('Cart')) return 'Cart / guest session';
  if (f.includes('wishlist') || f.includes('Wishlist')) return 'Wishlist';
  if (f.includes('order') || f.includes('Order') || f.includes('payment') || f.includes('Checkout') || f.includes('Receipt')) return 'Orders / checkout';
  if (f.includes('auth') || f.includes('otp') || f.includes('Login') || f.includes('generateToken') || f.includes('AuthContext')) return 'Auth / OTP';
  if (f.includes('seller') || f.includes('Seller') || f.includes('store') || f.includes('Store')) return 'Seller / storefront domain';
  if (f.includes('routing') || f.includes('useAppPath') || f.includes('SeoHead') || f.includes('sitemap') || f.includes('robots') || f.includes('_redirects')) return 'Path routing / SEO';
  if (f.includes('coupon') || f.includes('Coupon')) return 'Coupons';
  if (f.includes('banner') || f.includes('Banner')) return 'Banners';
  if (f.includes('review') || f.includes('Review')) return 'Reviews';
  if (f.includes('return') || f.includes('Return')) return 'Returns';
  if (f.includes('Inventory') || f.includes('dashboard') || f.includes('Dashboard') || f.includes('Reports')) return 'Admin dashboard / inventory';
  if (f.includes('Settings') || f.includes('settings')) return 'Settings';
  if (f.includes('ProductForm') || f.includes('AddProduct') || f.includes('Products.jsx') || f.includes('productController') || f.includes('productRoutes') || f.includes('Product.js')) return 'Catalog / Add Product';
  if (f.includes('admin')) return 'Admin shell / other admin pages';
  if (f.includes('customer') || f.includes('Home') || f.includes('ProductCard') || f.includes('ProductDetail')) return 'Storefront catalog';
  if (f.includes('apiSlice') || f.includes('api.js') || f.includes('apiBaseUrl') || f.includes('app.js') || f.includes('server.js')) return 'API / app core';
  if (f.endsWith('.env.example') || f === 'render.yaml' || f.includes('package.json')) return 'Config / deploy';
  return 'Other / shared';
}

function xml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cell(value, style = 'sText', type = 'String') {
  if (value == null || value === '') return '<Cell/>';
  if (typeof value === 'number') return `<Cell ss:StyleID="${style}"><Data ss:Type="Number">${value}</Data></Cell>`;
  const formula = String(value).startsWith('=');
  if (formula) return `<Cell ss:StyleID="${style}" ss:Formula="${xml(value)}"><Data ss:Type="Number">0</Data></Cell>`;
  return `<Cell ss:StyleID="${style}"><Data ss:Type="${type}">${xml(value)}</Data></Cell>`;
}

function row(values, styles = []) {
  return `<Row>${values.map((value, index) => cell(value, styles[index] || (index === 0 ? 'sText' : 'sText'))).join('')}</Row>`;
}

function headerRow(labels) {
  return `<Row ss:Height="22">${labels.map((label) => cell(label, 'sHeader')).join('')}</Row>`;
}

const tests = [
  ['T-001', 'P0', 'Setup', 'Backend health', 'Open http://localhost:5000/health', 'status is ok, database connected, imageStorage is r2 when R2 keys are present', 'backend/server.js, backend/app.js, backend/config/db.js'],
  ['T-002', 'P0', 'Setup', 'Local frontend uses local API', 'Open http://localhost:3000, Network tab any API call', 'Requests go to http://localhost:5000/api not Render', 'src/store/apiBaseUrl.js, src/services/api.js'],
  ['T-003', 'P0', 'Auth', 'Customer demo OTP login', 'Login with a valid admin/customer phone, OTP 123456 (demo mode)', 'OTP accepted, user session starts, token stored', 'backend/services/otpService.js, src/pages/customer/Login.jsx, src/context/AuthContext.jsx'],
  ['T-004', 'P0', 'Auth', 'Admin login', 'Open /admin/login and sign in as super admin', 'Lands on admin dashboard, sidebar visible', 'src/pages/admin/AdminLogin.jsx, backend/routes/adminAuthRoutes.js'],
  ['T-005', 'P0', 'Auth', 'Protected admin route', 'Log out, open /admin/products directly', 'Redirects to admin login, no catalog leak', 'src/components/layout/AdminRoute.jsx'],
  ['T-006', 'P0', 'Routing / SEO', 'Path URLs not hash', 'Click Home, Products, a product, Cart from the storefront', 'Address bar uses /products not /#/products', 'src/utils/routing.js, src/App.jsx, src/hooks/useAppPath.js'],
  ['T-007', 'P1', 'Routing / SEO', 'Old hash URL still works', 'Open /#/products then /#/admin', 'Redirects to path URL and page loads', 'src/utils/routing.js, src/index.js'],
  ['T-008', 'P1', 'Routing / SEO', 'Share / refresh product URL', 'Open a product, copy URL, refresh, open in new tab', 'Same product loads, SEO title present', 'src/components/seo/SeoHead.jsx, src/pages/customer/ProductDetail.jsx'],
  ['T-009', 'P1', 'Routing / SEO', 'robots and redirects', 'Open /robots.txt and confirm public/_redirects exists', 'robots.txt loads; SPA redirects file present for hosting', 'public/robots.txt, public/_redirects'],
  ['T-010', 'P0', 'Storefront', 'Home page loads', 'Open / as guest', 'Banners, featured/new products, no console crash', 'src/pages/customer/Home.jsx, src/pages/customer/StoreHome.jsx'],
  ['T-011', 'P0', 'Storefront', 'Product listing + filters', 'Open /products, search, category filter, open a card', 'Grid loads, filters work, detail opens', 'src/pages/customer/Products.jsx, src/components/products/ProductCard.jsx'],
  ['T-012', 'P0', 'Storefront', 'Product detail', 'Open a product with images, price, sizes/colors if any', 'Images, price, add to cart, tabs work', 'src/components/product/ProductDetailPage.jsx, ProductInfoPanel.jsx, ProductTabs.jsx'],
  ['T-013', 'P1', 'Storefront', 'Contact page', 'Open Contact, submit a message if form exists', 'Page loads; submit does not 500', 'src/pages/customer/Contact.jsx'],
  ['T-014', 'P0', 'Cart', 'Guest add to cart', 'Logged out, add a product to cart, refresh', 'Cart keeps items (guest session), qty updates', 'src/context/CartContext.jsx, backend/controllers/cartController.js, backend/routes/cartRoutes.js'],
  ['T-015', 'P0', 'Cart', 'Guest cart merges on login', 'Guest cart with 1+ items, then login', 'Cart after login contains guest items, no duplicate wipe', 'backend/controllers/cartController.js, src/context/CartContext.jsx'],
  ['T-016', 'P0', 'Cart', 'Stock / variant guard', 'Add item, raise qty past stock if possible', 'API rejects invalid stock/variant, UI shows error', 'backend/controllers/cartController.js'],
  ['T-017', 'P1', 'Wishlist', 'Guest or logged-in wishlist', 'Heart a product, refresh, open wishlist', 'Item remains; remove works', 'src/context/WishlistContext.jsx'],
  ['T-018', 'P0', 'Checkout', 'Checkout page still works', 'Cart with item -> Checkout', 'Address, coupon field, totals show; no blank page', 'src/pages/customer/Checkout.jsx, src/components/cart/PriceSummary.jsx'],
  ['T-019', 'P1', 'Checkout', 'Coupon apply', 'Apply a valid coupon and an invalid one', 'Valid reduces total; invalid shows error, checkout still usable', 'backend/controllers/couponController.js'],
  ['T-020', 'P1', 'Orders', 'Customer order detail / receipt', 'Place or open an existing order', 'Order detail and receipt render', 'src/pages/customer/OrderDetail.jsx, src/components/order/Receipt.jsx'],
  ['T-021', 'P1', 'Returns', 'My returns page', 'Open customer returns if logged in', 'Page loads; no crash', 'src/pages/customer/MyReturns.jsx'],
  ['T-022', 'P0', 'Admin catalog', 'Products table', 'Open /admin/products', 'Table loads; name/SKU/description truncate with hover title; stock status under qty', 'src/pages/admin/Products.jsx, src/components/admin/AdminShell.css'],
  ['T-023', 'P0', 'Admin catalog', 'KPI strip filters', 'Click Total, Active, Low stock, Out of stock, Inventory value; click again to clear', 'Table filters/sorts; second click clears', 'src/pages/admin/Products.jsx'],
  ['T-024', 'P0', 'Admin catalog', 'Inline stock update', 'Change stock on a row and blur/save', 'Stock persists after refresh; status label updates', 'src/pages/admin/Products.jsx, backend/controllers/productController.js'],
  ['T-025', 'P0', 'Add Product', 'Advanced Add Product still works', 'Open /admin/products/add, fill required fields, save', 'Product created; appears in catalog and storefront', 'src/pages/admin/AddProduct.jsx, src/components/admin/ProductForm.jsx'],
  ['T-026', 'P0', 'Add Product', 'Edit product', 'Edit an existing product name/price, save', 'Changes persist; storefront shows new values', 'src/components/admin/ProductForm.jsx'],
  ['T-027', 'P0', 'Categories', 'Live categories not placeholders', 'Open Add Product / Quick Add / Products filter category list', 'Categories match /admin/categories, not hardcoded Suit/Saree/Kurti only', 'src/utils/catalogOptions.js, src/pages/admin/Categories.jsx'],
  ['T-028', 'P1', 'Categories', 'Create category', 'Create a category with image, then use it on a product', 'Category appears in chips/selects after refresh', 'src/components/admin/CategoryForm.jsx, backend/controllers/categoryController.js'],
  ['T-029', 'P0', 'Quick Add', 'Open Quick Add from sidebar and catalog', 'Sidebar Quick Add and Products page Quick Add button', 'Opens /admin/products/quick-add, not a new product type', 'src/components/admin/AdminSidebar.jsx, src/pages/admin/QuickAddProduct.jsx, src/App.jsx'],
  ['T-030', 'P0', 'Quick Add', 'Photo upload on Quick Add', 'Upload a JPG/PNG/WEBP product photo', 'Preview appears; no storage error when R2 is configured', 'src/components/admin/ImageUploader.jsx, backend/routes/uploadRoutes.js'],
  ['T-031', 'P0', 'Quick Add', 'Photo AI fills listing (key on)', 'With GEMINI_API_KEY set, upload a garment photo and wait', 'Shows Looking at the garment; name/category/colors/description fill from image not filename; price and stock stay empty', 'backend/services/quickAddVision.service.js, src/pages/admin/QuickAddProduct.jsx'],
  ['T-032', 'P1', 'Quick Add', 'Photo AI off fallback', 'Temporarily remove GEMINI_API_KEY, restart, upload photo', 'Banner says Photo AI is off; filename may be used; save still works if user fills fields', 'src/pages/admin/QuickAddProduct.jsx'],
  ['T-033', 'P0', 'Quick Add', 'Save uses existing create API', 'Fill name, category, price, stock, save', 'POST /api/admin/products; product is a normal catalog item; SKU/slug generated', 'src/utils/quickAddProduct.js, backend/controllers/productController.js'],
  ['T-034', 'P0', 'Quick Add', 'Success actions', 'After save, View Product and Add Another', 'Edit page opens; Add Another resets form', 'src/pages/admin/QuickAddProduct.jsx'],
  ['T-035', 'P1', 'Quick Add', 'Escape to Advanced Add', 'On Quick Add click Open Advanced Add Product', 'Full Add Product form opens; no data loss crash', 'src/pages/admin/QuickAddProduct.jsx'],
  ['T-036', 'P0', 'Uploads', 'Admin image upload to R2', 'Upload image on Add Product or category', 'Returned URL is R2 public URL not /uploads when R2 is on', 'backend/routes/uploadRoutes.js, backend/services/r2Upload.js'],
  ['T-037', 'P1', 'Uploads', 'Local image fallback (no R2 on a temp env)', 'If testing without R2 in development only', 'Images save under /uploads and still preview; production still requires R2/Cloudinary', 'backend/routes/uploadRoutes.js'],
  ['T-038', 'P0', 'Reel Import', 'Open Reel Product Import', 'Open /admin/reel-import', 'Upload UI + history load; no Cloud storage required banner', 'src/pages/admin/ReelProductImport.jsx'],
  ['T-039', 'P0', 'Reel Import', 'Upload reel to R2', 'Select MP4 under 250MB / 180s, Upload and process', 'Upload succeeds; job appears in history (queued or processing)', 'backend/routes/uploadRoutes.js, backend/modules/reel-product-import/reelImport.controller.js'],
  ['T-040', 'P0', 'Reel Import', 'Processing completes locally', 'Restart backend first, retry a failed job or upload a short reel, wait without leaving', 'Progress moves past 10% (download/extract/save) and becomes Ready for review; not Failed on refresh', 'backend/services/localReelProcessor.service.js, backend/workers/reelImport.processor.js, backend/queues/reelImport.queue.js'],
  ['T-041', 'P0', 'Reel Import', 'Review candidates + create drafts', 'Open results, check frames, create selected drafts', 'Drafts appear in Product Drafts; nothing auto-publishes to live catalog', 'src/pages/admin/ReelProductImport.jsx, src/pages/admin/ProductDrafts.jsx'],
  ['T-042', 'P1', 'Reel Import', 'Failed job shows real error', 'If a job fails, read the red line under the filename', 'Message is specific (storage/ffmpeg/download), not a silent 10% stuck state', 'src/pages/admin/ReelProductImport.jsx'],
  ['T-043', 'P1', 'Reel Import', 'Retry / delete / cancel', 'Retry a failed job; delete a finished job', 'Retry requeues; delete removes from history', 'src/pages/admin/ReelProductImport.jsx'],
  ['T-044', 'P0', 'Drafts', 'Product Drafts list and publish', 'Open /admin/product-drafts, publish a selected draft if available', 'Draft becomes a real product; storefront can show it when active', 'src/pages/admin/ProductDrafts.jsx'],
  ['T-045', 'P1', 'Variants', 'Variant groups', 'Open /admin/variant-groups, open or create a group, attach products', 'Group saves; products still sellable', 'src/pages/admin/VariantGroups.jsx, src/utils/variants.js'],
  ['T-046', 'P1', 'Admin orders', 'Orders list + detail + status', 'Open /admin/orders, open one, change status if safe on test data', 'List/detail load; status update persists', 'src/pages/admin/Orders.jsx, src/pages/admin/OrderDetail.jsx'],
  ['T-047', 'P1', 'Inventory', 'Inventory / low stock', 'Open /admin/inventory', 'Low stock list matches KPI on Products', 'src/pages/admin/Inventory.jsx'],
  ['T-048', 'P1', 'Admin other', 'Dashboard and reports', 'Open /admin and /admin/reports', 'Stats cards and charts load', 'src/pages/admin/Dashboard.jsx, src/pages/admin/Reports.jsx'],
  ['T-049', 'P1', 'Admin other', 'Banners CRUD', 'Create/edit/disable a banner, check Home', 'Banner shows/hides on storefront', 'src/pages/admin/Banners.jsx'],
  ['T-050', 'P1', 'Admin other', 'Coupons CRUD', 'Create a coupon in admin, use a valid and invalid code at checkout', 'Valid coupon reduces total; invalid shows error', 'backend/controllers/couponController.js, src/components/admin/CouponForm.jsx'],
  ['T-051', 'P1', 'Admin other', 'Reviews / returns admin', 'Open reviews and returns admin pages', 'Lists load; status update if present', 'backend/controllers/reviewController.js, returnController.js'],
  ['T-052', 'P1', 'Admin other', 'Customers / support / subscribers / audit', 'Open customers, support, subscribers, audit log', 'Pages load, no 404', 'src/pages/admin/Support.jsx, Subscribers.jsx, AuditLogs.jsx'],
  ['T-053', 'P1', 'Settings', 'Admin settings save', 'Open /admin/settings, change a harmless field, save, refresh', 'Value persists', 'src/pages/admin/Settings.jsx, backend/controllers/settingsController.js'],
  ['T-054', 'P1', 'Seller', 'Seller onboarding + catalog isolation', 'If a second store exists: seller A must not see seller B products', 'Store-scoped catalog; client storeId on create is ignored', 'src/pages/seller/*, backend/routes/sellerRoutes.js'],
  ['T-055', 'P1', 'Seller', 'Seller add product', 'Seller add product via seller form', 'Saved to that boutique only', 'src/pages/seller/ProductFormPage.jsx'],
  ['T-056', 'P1', 'Seller', 'Seller orders / inbox / CRM / Instagram stub', 'Open seller dashboard pages', 'Pages load; Instagram is status/stub not live scrape', 'src/pages/seller/Instagram.jsx, Inbox.jsx, Crm.jsx'],
  ['T-057', 'P0', 'Regression', 'Existing product still sells', 'Pick an old catalog product, add to cart as guest then logged-in', 'No schema errors, images load, price correct', 'backend/models/Product.js'],
  ['T-058', 'P0', 'Regression', 'Admin sidebar at 1024px', 'Resize admin to below and above 1024px', 'Desktop sidebar vs mobile admin chrome still usable', 'src/components/admin/AdminLayout.jsx, AdminShell.css'],
  ['T-059', 'P1', 'API core', 'Error messages stay customer-safe', 'Trigger a 500-style failure if possible (invalid id)', 'No raw Mongo stack in UI; friendly message', 'backend/middleware/errorMiddleware.js, src/services/api.js'],
  ['T-060', 'P1', 'Config', 'Env examples have no secrets in frontend', 'Check .env.example vs backend/.env.example', 'No GEMINI/R2 secrets under REACT_APP_*', '.env.example, backend/.env.example, render.yaml'],
];

const howTo = [
  ['Jassi General Store — change test log'],
  ['Generated for the current uncommitted + new files (source and config). node_modules is excluded.'],
  [`File count in this log: ${files.length}`],
  ['Date: 21 Aug 2026'],
  [''],
  ['How to use'],
  ['1. Restart backend and frontend before testing so the latest code is loaded.'],
  ['2. Work P0 cases first (must-pass), then P1.'],
  ['3. On sheet Test Cases fill Result (Pass / Fail / Blocked), Tester, Date, Actual result.'],
  ['4. One failed P0 means that area is not ready. Do not skip Quick Add, Reel Import, cart, or Add Product.'],
  ['5. You do not test 231 files one by one. You test the behaviours those files implement. Sheet File Inventory maps every file to an area.'],
  [''],
  ['Local URLs'],
  ['Storefront: http://localhost:3000'],
  ['Admin: http://localhost:3000/admin'],
  ['API health: http://localhost:5000/health'],
  [''],
  ['Before you start'],
  ['Backend .env has MONGO_URI, JWT secrets, R2 keys, optional GEMINI_API_KEY for photo AI.'],
  ['OTP demo code stays 123456 while OTP_MODE=demo.'],
  ['Do not use production payments on test data unless you intend a real charge.'],
];

const summaryRows = [
  ['Area', 'Total cases', 'Pass', 'Fail', 'Blocked', 'Not run', 'Area result'],
];

const areas = [...new Set(tests.map((test) => test[2]))];

function colLetter(index) {
  return String.fromCharCode(65 + index);
}

let xmlOut = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
<DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
 <Title>Jassi General Store change test log</Title>
 <Author>Jassi General Store</Author>
</DocumentProperties>
<Styles>
 <Style ss:ID="Default"><Alignment ss:Vertical="Top" ss:WrapText="1"/><Font ss:FontName="Calibri" ss:Size="11"/></Style>
 <Style ss:ID="sHeader"><Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#6D1F34" ss:Pattern="Solid"/><Alignment ss:Vertical="Center" ss:WrapText="1"/></Style>
 <Style ss:ID="sTitle"><Font ss:FontName="Calibri" ss:Size="16" ss:Bold="1" ss:Color="#6D1F34"/></Style>
 <Style ss:ID="sText"><Alignment ss:Vertical="Top" ss:WrapText="1"/></Style>
 <Style ss:ID="sP0"><Font ss:Bold="1" ss:Color="#6D1F34"/></Style>
 <Style ss:ID="sP1"><Font ss:Color="#B88945"/></Style>
</Styles>
`;

xmlOut += `<Worksheet ss:Name="How to use"><Table ss:DefaultColumnWidth="120">
<Column ss:Width="900"/>
${howTo.map((line, index) => `<Row ss:Height="${index === 0 ? 28 : 18}">${cell(line[0], index === 0 ? 'sTitle' : 'sText')}</Row>`).join('\n')}
</Table></Worksheet>
`;

const testHeaders = ['ID', 'Priority', 'Area', 'Case', 'Steps', 'Expected result', 'Main files', 'Result (Pass/Fail/Blocked)', 'Tester', 'Date', 'Actual result / bug notes'];
xmlOut += `<Worksheet ss:Name="Test Cases"><Table ss:DefaultColumnWidth="110">
<Column ss:Width="55"/>
<Column ss:Width="55"/>
<Column ss:Width="140"/>
<Column ss:Width="200"/>
<Column ss:Width="320"/>
<Column ss:Width="320"/>
<Column ss:Width="280"/>
<Column ss:Width="90"/>
<Column ss:Width="90"/>
<Column ss:Width="80"/>
<Column ss:Width="260"/>
${headerRow(testHeaders)}
${tests.map((test) => {
  const styles = ['sText', test[1] === 'P0' ? 'sP0' : 'sP1', 'sText', 'sText', 'sText', 'sText', 'sText'];
  return row([...test, '', '', '', ''], styles);
}).join('\n')}
</Table>
<WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/><SplitHorizontal>1</SplitHorizontal><TopRowBottomPane>1</TopRowBottomPane><ActivePane>2</ActivePane></WorksheetOptions>
</Worksheet>
`;

xmlOut += `<Worksheet ss:Name="Results"><Table ss:DefaultColumnWidth="120">
<Column ss:Width="200"/><Column ss:Width="80"/><Column ss:Width="70"/><Column ss:Width="70"/><Column ss:Width="80"/><Column ss:Width="80"/><Column ss:Width="100"/>
${headerRow(['Area', 'Total', 'Pass', 'Fail', 'Blocked', 'Not run', 'Notes'])}
${areas.map((area) => {
  const escaped = area.replace(/"/g, '""');
  return row([
    area,
    `=COUNTIF('Test Cases'!C:C,"${escaped}")`,
    `=COUNTIFS('Test Cases'!C:C,"${escaped}",'Test Cases'!H:H,"Pass")`,
    `=COUNTIFS('Test Cases'!C:C,"${escaped}",'Test Cases'!H:H,"Fail")`,
    `=COUNTIFS('Test Cases'!C:C,"${escaped}",'Test Cases'!H:H,"Blocked")`,
    '',
    'Fill Pass/Fail on Test Cases; this sheet totals them in Excel',
  ]);
}).join('\n')}
${row(['ALL', `=COUNTA('Test Cases'!A:A)-1`, `=COUNTIF('Test Cases'!H:H,"Pass")`, `=COUNTIF('Test Cases'!H:H,"Fail")`, `=COUNTIF('Test Cases'!H:H,"Blocked")`, '', 'P0 failures block release of that feature'])}
</Table></Worksheet>
`;

xmlOut += `<Worksheet ss:Name="File Inventory"><Table ss:DefaultColumnWidth="140">
<Column ss:Width="70"/>
<Column ss:Width="420"/>
<Column ss:Width="200"/>
<Column ss:Width="90"/>
${headerRow(['#', 'File', 'Test area', 'In git status'])}
${files.map((file, index) => row([index + 1, file, areaFor(file), tracked.includes(file) ? 'Modified' : 'New'])).join('\n')}
</Table>
<WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/><SplitHorizontal>1</SplitHorizontal><TopRowBottomPane>1</TopRowBottomPane><ActivePane>2</ActivePane></WorksheetOptions>
</Worksheet>
`;

xmlOut += `</Workbook>
`;

fs.writeFileSync(outPath, xmlOut, 'utf8');
console.log(`Wrote ${outPath}`);
console.log(`files=${files.length} tests=${tests.length} areas=${areas.length}`);
