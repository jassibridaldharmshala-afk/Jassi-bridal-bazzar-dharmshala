const guide = (id, area, title, summary, paths, steps, tips = [], related = [], keywords = '') => ({
  id, area, title, summary, paths, steps, tips, related, keywords,
});

export const USER_MANUAL_GUIDES = [
  guide('storefront-home', 'Shopping', 'Store home', 'Discover categories, new arrivals, offers and featured products.', ['/'], [
    'Use the main menu or category cards to open a product collection.',
    'Select a product card to view photos, price, available options and delivery details.',
    'Use Search when you already know a product name, category, colour or style.',
  ], ['Offers and availability can change until checkout is completed.'], [{ label: 'Browse all products', path: '/products' }], 'home storefront new arrivals featured best sellers'),
  guide('catalog', 'Shopping', 'Product catalogue & search', 'Find the right product using search, filters and sorting.', ['/products', '/category', '/search'], [
    'Search by product name, category, colour or keyword.',
    'Apply category, price, size, colour and availability filters to narrow the list.',
    'Choose a sort order, then open a card for full product information.',
    'Clear filters if no products match your selection.',
  ], ['The heart saves an item without adding it to the bag.'], [{ label: 'Open wishlist', path: '/wishlist' }], 'shop all filters sort product cards'),
  guide('product-detail', 'Shopping', 'Product details', 'Review product information and choose valid options before buying.', ['/product'], [
    'Review every photo, price, offer, description and delivery information.',
    'Select colour and size when those options are available. Free-size products do not require a size selection.',
    'Set quantity, then choose Add to bag or Buy now.',
    'Use the pincode check before buying when delivery availability is shown.',
  ], ['Unavailable variants cannot be added. Use the size guide when measurements are provided.'], [{ label: 'View shopping bag', path: '/cart' }], 'size colour quantity buy now add bag delivery pincode'),
  guide('wishlist', 'Shopping', 'Wishlist', 'Keep products for later and move available choices to the shopping bag.', ['/wishlist'], [
    'Use the heart on any product to save or remove it.',
    'Open a saved product to confirm its current price and availability.',
    'Choose required size or colour, then move the item to the bag.',
    'Remove products you no longer want to keep.',
  ], ['Wishlist availability is not a stock reservation.'], [{ label: 'Continue shopping', path: '/products' }], 'saved favourites collection heart'),
  guide('shopping-bag', 'Checkout', 'Shopping bag', 'Review selected items, quantities, discounts and the payable total.', ['/cart'], [
    'Confirm product options and quantities for every item.',
    'Apply an eligible coupon and review the updated price breakdown.',
    'Remove or move items to the wishlist when required.',
    'Select Continue to address to begin checkout.',
  ], ['Stock and final offers are revalidated during checkout.'], [{ label: 'Manage addresses', path: '/profile/addresses' }, { label: 'Continue to checkout', path: '/checkout' }], 'cart bag coupon total quantity address'),
  guide('checkout', 'Checkout', 'Address & payment', 'Confirm delivery, charges and payment before placing the order.', ['/checkout'], [
    'Select a saved address or add a complete serviceable delivery address.',
    'Review every item, shipping charge, discount, tax and final amount.',
    'Choose an available payment method. COD and prepaid availability can differ by pincode and order value.',
    'Select Place order once and wait for the final confirmation screen.',
  ], ['Do not refresh or press Back while an online payment confirmation is processing. A failed attempt can be resumed safely.'], [{ label: 'Manage addresses', path: '/profile/addresses' }, { label: 'View orders', path: '/orders' }], 'payment COD UPI Razorpay address order summary'),
  guide('account-access', 'Account', 'Login or signup', 'Access your account securely with the mobile number and one-time password.', ['/login', '/register', '/admin/login'], [
    'Enter the mobile number linked to your account and accept the terms.',
    'Request the OTP, then enter the code before it expires.',
    'Use Resend only after the cooldown ends.',
    'After verification, you return to the page that requested login.',
  ], ['Never share a production OTP with another person. Demo OTP behavior depends on the store environment.'], [{ label: 'Get login help', path: '/contact' }], 'otp phone signup authentication'),
  guide('profile', 'Account', 'My account', 'Use one place for profile, orders, addresses, notifications and saved products.', ['/profile'], [
    'Open the required account section from the menu.',
    'Keep your mobile number and delivery details accurate.',
    'Use Orders for delivery or refund progress and Notifications for recent updates.',
  ], [], [{ label: 'Edit profile', path: '/profile/details' }, { label: 'View orders', path: '/orders' }], 'account dashboard'),
  guide('profile-details', 'Account', 'Profile details', 'Maintain the customer information used by the store.', ['/profile/details'], [
    'Update the editable name, email and profile information.',
    'Check the values once, then save.',
    'Return to My account after the success message appears.',
  ], ['The verified login number may require a separate verification flow before it can change.'], [{ label: 'Back to account', path: '/profile' }], 'name email personal information'),
  guide('addresses', 'Account', 'Saved addresses', 'Add and maintain accurate delivery and billing addresses.', ['/profile/addresses', '/profile/addresses/new', '/profile/addresses/edit'], [
    'Add the recipient name, mobile, house number, area, city, state and six-digit pincode.',
    'Add a landmark when it helps the courier find the location.',
    'Save the address and mark the most-used address as default.',
    'Edit or remove an address only after checking it is not needed for the current checkout.',
  ], ['Changing a saved address does not change an order that has already been placed.'], [{ label: 'Return to bag', path: '/cart' }], 'delivery billing pincode default address'),
  guide('orders', 'Orders & support', 'My orders', 'Find purchases and follow payment, fulfilment and delivery progress.', ['/orders'], [
    'Search using an order number or product name.',
    'Use status and date filters to find older orders.',
    'Open an order for item-level actions, tracking, invoice and refund details.',
  ], [], [{ label: 'View returns', path: '/returns' }], 'history tracking invoice status'),
  guide('order-detail', 'Orders & support', 'Order details', 'Track items, payments, cancellation, delivery, invoice and after-sales cases.', ['/order-detail'], [
    'Read the order timeline and delivery tracking before taking action.',
    'Cancel only when the available action is shown; choose a reason and confirm the affected item or order.',
    'After delivery, use Return / exchange only for eligible items and quantities.',
    'Download the invoice or contact support with the displayed order ID.',
  ], ['Payment, delivery and refund statuses are intentionally shown separately.'], [{ label: 'All orders', path: '/orders' }, { label: 'Contact support', path: '/contact' }], 'cancel return exchange refund tracking invoice'),
  guide('order-result', 'Checkout', 'Order or payment result', 'Understand what happened after checkout and choose the safe next step.', ['/order-success', '/payment-failed'], [
    'Keep the order or payment reference shown on the screen.',
    'For a successful order, open tracking or My orders.',
    'For a failed payment, use the offered retry action once or choose another payment method.',
    'Check My orders before attempting again if the result is uncertain.',
  ], ['Avoid creating a second order until the first attempt has been checked.'], [{ label: 'Check my orders', path: '/orders' }], 'success failed retry confirmation'),
  guide('customer-returns', 'Orders & support', 'My returns & exchanges', 'Follow every return, pickup, inspection, exchange and refund update.', ['/returns'], [
    'Open a case to see its current stage and activity timeline.',
    'Keep the item packed and ready after pickup is approved.',
    'Follow QC, refund or replacement tracking updates inside the case.',
    'Contact support when an SLA warning or courier problem is shown.',
  ], ['Refund completion time depends on the payment provider after the store processes it.'], [{ label: 'Open order history', path: '/orders' }], 'reverse pickup qc replacement refund'),
  guide('notifications', 'Account', 'Notifications', 'Review order, delivery, return, offer and store updates.', ['/notifications', '/admin/notifications', '/seller/notifications'], [
    'Unread updates appear first and increase the bell count.',
    'Open a notification to view its related order, product or task when available.',
    'Use Mark all read after reviewing the queue.',
  ], ['Admin and customer notifications are separated by account and store.'], [], 'alerts unread bell updates'),
  guide('customer-help', 'Orders & support', 'Help, policies & contact', 'Read store policies or send the store a clear support request.', ['/contact', '/privacy-policy', '/terms', '/return-policy', '/shipping-policy', '/cancellation-policy', '/size-guide', '/faqs', '/our-story'], [
    'Choose the relevant policy or help topic.',
    'For order help, include the order ID and a short description of the problem.',
    'Use the available phone, email or WhatsApp channel during listed support hours.',
  ], ['Do not include passwords, OTPs or complete payment credentials in a support message.'], [{ label: 'View orders', path: '/orders' }], 'faq terms privacy shipping cancellation size guide contact'),

  guide('team-dashboard', 'Store operations', 'Dashboard', 'Monitor sales, fulfilment, inventory and tasks for the selected period.', ['/admin', '/seller'], [
    'Choose 7, 30 or 90 days to compare accurate period data.',
    'Review revenue, orders, conversion, stock alerts and operational exceptions.',
    'Select a card or action to open the underlying records.',
    'Refresh after completing a task when its count has not updated yet.',
  ], ['Dashboard totals follow the active store and exclude cancelled/refunded value according to reporting rules.'], [], 'analytics overview revenue KPI operations'),
  guide('product-list', 'Catalogue', 'Products', 'Search, review and maintain the live product catalogue.', ['/admin/products', '/seller/products'], [
    'Search or filter by status, category, stock and catalogue quality.',
    'Open a product to edit its content, media, variants or availability.',
    'Use bulk actions only after reviewing every selected row.',
    'Archive products that should leave the storefront while preserving order history.',
  ], ['Archived products remain available in historical orders.'], [], 'catalogue bulk archive publish stock'),
  guide('product-form', 'Catalogue', 'Add or edit product', 'Create a complete sellable product with accurate commercial and inventory data.', ['/admin/products/add', '/admin/products/edit', '/seller/products/add', '/seller/products/edit'], [
    'Add clear product photos, name, category, description and search details.',
    'Enter selling price, MRP, tax, SKU and inventory accurately.',
    'Add only real size, colour and variant combinations; complete required size-chart measurements.',
    'Review the storefront preview and validation summary before saving or publishing.',
  ], ['Smart suggestions assist entry but price, stock, tax and availability must be verified by a person.'], [], 'sku price mrp photos variants smart fill size chart'),
  guide('quick-add', 'Catalogue', 'Quick Add', 'Create a product faster from a small set of essential fields.', ['/admin/products/quick-add'], [
    'Upload a clear main image and add the product identity.',
    'Review suggested details and correct anything uncertain.',
    'Enter verified price, stock and required options.',
    'Save as a draft when the product is not ready for sale.',
  ], ['Use the full Add Product screen for complex variants or detailed specifications.'], [], 'fast product image'),
  guide('product-drafts', 'Catalogue', 'Product drafts', 'Finish, validate and publish incomplete catalogue work safely.', ['/admin/product-drafts'], [
    'Filter drafts by source, completeness or validation status.',
    'Open a draft and resolve every required-field warning.',
    'Review duplicate signals, photos, price, stock and variants.',
    'Publish only after the readiness check passes; archive abandoned drafts instead of losing audit history.',
  ], [], [], 'review draft ready publish duplicate'),
  guide('social-import', 'Catalogue', 'Import product from social media', 'Turn an allowed Instagram or Facebook post into a reviewed product draft.', ['/admin/social-import', '/admin/reel-import'], [
    'Paste the public post/reel URL or upload permitted media.',
    'Wait for extraction, then select the clearest product views.',
    'Review generated name, category, description, colour and other suggestions.',
    'Verify price, stock and variants manually before creating or publishing products.',
  ], ['Only import content you own or are allowed to reuse. Nothing should publish without review.'], [], 'instagram facebook reel media smart assistant'),
  guide('categories', 'Catalogue', 'Categories', 'Organize product discovery without breaking existing catalogue links.', ['/admin/categories', '/admin/categories/edit'], [
    'Create a clear name, slug, image, description and display order.',
    'Use parent categories only when the hierarchy helps customers browse.',
    'Preview affected products before archiving or restructuring a category.',
    'When editing, keep the existing image unless you intentionally replace or remove it.',
  ], ['Archive a used category instead of deleting historical relationships.'], [], 'taxonomy slug hierarchy image'),
  guide('variant-groups', 'Catalogue', 'Variant groups', 'Define reusable option combinations such as size and colour.', ['/admin/variant-groups', '/seller/variant-groups'], [
    'Create the option labels and allowed values in a consistent order.',
    'Map products only after checking their existing variants.',
    'Review compatibility and stock impact before applying changes.',
    'Archive an unused group when it should no longer be offered.',
  ], ['Variant changes can affect product validation and checkout availability.'], [], 'size colour options combinations'),
  guide('inventory', 'Operations', 'Inventory Operations Center', 'Track sellable, reserved, incoming, damaged and quarantined stock.', ['/admin/inventory', '/seller/inventory'], [
    'Filter products that are low, out of stock or need reconciliation.',
    'Choose the exact product and variant before adjusting quantity.',
    'Select the correct adjustment reason and add a useful reference or note.',
    'Use receiving, transfer and QC actions to keep each stock bucket accurate.',
  ], ['Never use a stock adjustment to correct an order or refund; use its proper workflow.'], [], 'stock movement reserve receive damaged quarantine'),
  guide('order-queue', 'Operations', 'Order queue', 'Process paid and COD orders through valid fulfilment steps.', ['/admin/orders', '/seller/orders'], [
    'Use task cards and filters to find new, late or exceptional orders.',
    'Confirm payment and address information before packing.',
    'Move the order only through the next available status action.',
    'Create a courier shipment, print the label and request pickup before handover.',
  ], ['Cancellation, payment and delivery states are recorded separately.'], [], 'confirm pack ship pickup AWB courier bulk'),
  guide('admin-order-detail', 'Operations', 'Manage order', 'Resolve fulfilment, payment, shipment, cancellation and RTO work from one record.', ['/admin/orders/detail', '/seller/orders/detail'], [
    'Review items, payment, address, timeline and allowed actions.',
    'Create or sync the courier shipment and download its label.',
    'Use item/order cancellation only before courier handover.',
    'For an RTO, confirm warehouse receipt, perform QC and complete the appropriate refund or inventory action.',
  ], ['A manual refund action records money already sent; it does not transfer funds. Always enter the real bank/provider reference.'], [], 'fulfilment refund rto shipment invoice cancellation'),
  guide('return-center', 'Operations', 'Returns & Exchange Center', 'Manage approval, reverse pickup, QC, refund and replacement delivery.', ['/admin/returns', '/seller/returns'], [
    'Open Needs attention first, then review new requests and customer evidence.',
    'Assign the case, set priority and add private operational notes when needed.',
    'Approve or reject with a clear reason, then create the reverse pickup from the customer pickup address.',
    'Record received quantity and QC disposition before refunding or allocating a replacement.',
    'Use retry/reconcile controls for failed refunds and follow replacement tracking to closure.',
  ], ['Sensitive bank/UPI details stay masked until an authorized audited reveal.'], [], 'sla assignment reverse replacement qc refund exception'),
  guide('customers-crm', 'Customers', 'Customers & CRM', 'Understand customer activity and record responsible follow-up.', ['/admin/customers', '/seller/crm'], [
    'Search by name, phone, email, order or customer segment.',
    'Open a profile to review orders, returns, value and engagement history.',
    'Add internal tags or notes with a clear operational purpose.',
    'Contact only through channels for which the customer has valid consent.',
  ], ['Customer contact and personal information require the appropriate staff permission.'], [], 'segments consent notes lifetime value'),
  guide('coupons', 'Marketing', 'Coupons', 'Create controlled discounts with predictable checkout behavior.', ['/admin/coupons', '/seller/offers'], [
    'Choose a clear code, discount type and value.',
    'Set validity dates, minimum order, limits and eligible products/customers.',
    'Review the estimated impact, then activate the coupon.',
    'Pause or archive a coupon when it should stop applying.',
  ], ['Test eligibility with a realistic bag before announcing a campaign.'], [], 'discount code limits eligibility budget'),
  guide('banners', 'Marketing', 'Banners', 'Publish responsive promotional artwork to controlled storefront slots.', ['/admin/banners', '/seller/banners'], [
    'Select the storefront slot and upload suitable desktop and mobile images.',
    'Add accessible alt text and a safe internal destination link.',
    'Set schedule, priority and audience rules.',
    'Preview both device sizes before publishing.',
  ], ['Avoid placing essential text only inside an image.'], [], 'hero mobile image schedule link'),
  guide('campaigns', 'Marketing', 'Campaigns', 'Coordinate offer, banner, audience, budget and measurement in one campaign.', ['/admin/campaigns', '/seller/campaigns'], [
    'Choose the campaign goal, dates and audience.',
    'Connect reviewed coupons, banners and product selections.',
    'Check conflicts, budget and readiness before scheduling or publishing.',
    'Monitor attributed visits, orders and revenue; pause the campaign when required.',
  ], ['Publishing a campaign does not bypass each coupon or banner safety rule.'], [], 'festival audience attribution publish schedule'),
  guide('reviews', 'Customers', 'Reviews', 'Moderate genuine feedback and respond consistently.', ['/admin/reviews', '/seller/reviews'], [
    'Review pending, reported and high-risk entries first.',
    'Publish valid reviews or hide/reject with a recorded reason.',
    'Add one professional store response and edit it when resolution changes.',
    'Feature only useful published reviews and preserve moderation history.',
  ], ['Do not remove a review only because its rating is low.'], [], 'moderation reports response featured rating'),
  guide('reports', 'Analytics', 'Reports & analytics', 'Build accurate business views and export only the data you need.', ['/admin/reports', '/seller/reports', '/seller/analytics'], [
    'Select the report, store scope, date range and comparison period.',
    'Apply filters and verify totals before sharing.',
    'Save useful views or schedule permitted reports.',
    'Export the selected columns in the required format.',
  ], ['Revenue and refund reports use order financial events rather than visual dashboard totals.'], [], 'sales export csv pdf scheduled comparison'),
  guide('business-center', 'Analytics', 'Business Center', 'Turn store health and live data into prioritized work.', ['/admin/business', '/seller/business'], [
    'Review the health score and open each incomplete health item.',
    'Use abandoned-bag recovery only when the feature and customer consent are available.',
    'Ask the data assistant a specific question about the active store.',
    'Use campaign recommendations as a review starting point, not an automatic decision.',
  ], ['Locked cards show the plan required for that capability.'], [], 'health score assistant abandoned cart insight'),
  guide('social-workspace', 'Communication', 'Social & inbox workspace', 'Manage connected social conversations and reviewed publishing tasks.', ['/admin/social', '/seller/social', '/seller/inbox', '/seller/instagram'], [
    'Connect Facebook Pages or an eligible Instagram professional account from Accounts, then check account health and sync status.',
    'In Shared inbox, filter overdue or unassigned work, assign an owner, set priority, add labels and review any linked customer orders.',
    'Use private notes for handover. A suggested reply stays editable and sends only after you choose Send within the available reply window.',
    'In Create & publish, select catalogue photos, review separate Instagram and Facebook captions, inspect each platform preview and choose destinations.',
    'Publish immediately or schedule at least five minutes ahead. Use content history to cancel an upcoming schedule or retry confirmed failures.',
    'Use Insights to monitor response time, overdue conversations, publishing outcomes, connection status and Instagram publishing usage.',
  ], ['Provider credentials and access tokens remain on the backend.', 'Personal social inboxes are not available through Meta business APIs.', 'Check any result marked “Check on Meta” before attempting another send or post.'], [], 'instagram facebook messages post reply assignment schedule insights'),
  guide('subscribers', 'Communication', 'Subscribers', 'Manage newsletter audiences and consent responsibly.', ['/admin/subscribers'], [
    'Search subscribers and review their consent/source information.',
    'Export or contact only the eligible selected audience.',
    'Honor unsubscribe and suppression status immediately.',
  ], ['Never import or message a list without valid consent.'], [], 'newsletter consent export unsubscribe'),
  guide('support-admin', 'Communication', 'Support desk', 'Track customer questions to a clear resolution.', ['/admin/support'], [
    'Open unresolved and overdue conversations first.',
    'Review the linked customer, order and previous messages.',
    'Assign ownership, reply clearly and add private notes when needed.',
    'Close only after the resolution is recorded.',
  ], [], [], 'ticket conversation reply assignment'),
  guide('audit', 'Security', 'Audit log', 'Review who changed important business data and when.', ['/admin/audit', '/seller/audit'], [
    'Filter by date, actor, action or affected record.',
    'Open View details to compare recorded before/after information.',
    'Export an investigation set when authorized.',
    'Delete only records the retention policy explicitly allows; protected financial/security history remains immutable.',
  ], [], [], 'history actor changes compliance'),
  guide('website-designer', 'Store setup', 'Website Designer', 'Customize storefront layout and appearance with safe previews and releases.', ['/admin/customization', '/seller/design'], [
    'Start from the current draft or choose a preset.',
    'Change layout, typography, colours and supported blocks using the editor controls.',
    'Preview desktop and mobile, then review accessibility and performance checks.',
    'Save a draft, compare with live and publish or schedule the reviewed version.',
  ], ['Publishing changes the storefront; use version history to restore an earlier design when needed.'], [], 'theme preset colors layout preview publish rollback'),
  guide('store-content', 'Store setup', 'Content Studio', 'Edit storefront wording without changing layout, colours or products.', ['/admin/store-content', '/seller/content'], [
    'Find the page or block and edit its heading, description or button label.',
    'Use desktop/mobile preview and character guidance.',
    'Save a draft, compare it with published content and review affected pages.',
    'Publish or schedule the content patch; use history to restore wording when required.',
  ], ['Company identity, contact and SEO fields are maintained in Settings when marked as owned there.'], [], 'copy headings CTA history schedule'),
  guide('settings', 'Store setup', 'Settings', 'Control store identity, commerce rules, integrations and operational defaults.', ['/admin/settings', '/seller/settings'], [
    'Choose a settings section and change only values you understand.',
    'Upload the logo and maintain company, contact, legal and SEO information.',
    'Configure checkout, shipping, payments, returns, tax, notifications and integrations.',
    'Review validation and the change summary before saving.',
  ], ['Secret credentials are stored through backend controls and are never displayed back in full.'], [], 'logo company shipping payment return SEO integration'),
  guide('system-status', 'Security', 'System & updates', 'Check service readiness, integrations and available application updates.', ['/admin/system'], [
    'Review database, storage, authentication and provider status.',
    'Open a failed check for its safe corrective action.',
    'Review release notes and compatibility before applying an update.',
    'Run health checks again after configuration changes.',
  ], ['Do not paste secret values into screenshots or support conversations.'], [], 'health database storage release update'),
  guide('seller-onboarding', 'Store setup', 'Store onboarding', 'Complete the minimum store setup required to start selling.', ['/seller/onboarding'], [
    'Enter business identity and customer contact details.',
    'Configure catalogue, pickup address, payment and delivery settings.',
    'Add and validate the first sellable product.',
    'Preview the storefront and resolve every launch blocker before going live.',
  ], [], [], 'setup launch checklist'),
  guide('subscription', 'Account', 'Plan & subscription', 'Understand available features, limits, billing period and renewal.', ['/seller/subscription'], [
    'Review the active plan, expiry date and included limits.',
    'Compare monthly, yearly and lifetime pricing where available.',
    'Complete payment through the approved billing action.',
    'Keep the payment reference and confirm the plan becomes active.',
  ], ['Store access and each client subscription are isolated.'], [], 'plan billing trial monthly yearly lifetime'),

  guide('master-configuration', 'Platform owner', 'Master configuration', 'Control client capabilities and shared product structure without exposing platform ownership.', ['/master'], [
    'Select the configuration section and review the current signed revision.',
    'Edit plan features, limits, industry blueprints or platform defaults.',
    'Preview affected stores/products before applying a structural change.',
    'Add a reason, review the change summary and publish the new version.',
  ], ['Generated client packages must never include master-control routes, credentials or screens.'], [], 'plans limits industries governance version'),
  guide('store-portfolio', 'Platform owner', 'Store portfolio', 'Operate each client store, subscription and ownership independently.', ['/master/stores'], [
    'Search and select the client store you want to manage.',
    'Review health, plan, limits, team, lifecycle and recent operations.',
    'Use reviewed actions for access grants, pause, ownership transfer or industry migration.',
    'Export client business data only with a recorded reason.',
  ], ['Always verify the selected store before changing access or catalogue structure.'], [], 'tenants clients license migration owner'),
  guide('client-control', 'Platform owner', 'Client control', 'Generate and manage isolated client installations and release delivery.', ['/master/clients'], [
    'Create an installation for the correct client and industry blueprint.',
    'Review package contents and security boundaries before generation.',
    'Register deployment information and verify control-plane connectivity.',
    'Publish signed releases in stages and monitor client acknowledgement, failure and rollback status.',
  ], ['Each client uses separate store data and credentials; master controls are excluded from generated packages.'], [], 'installation generate release rollout rollback'),
];

const FALLBACKS = {
  customer: guide('customer-fallback', 'Shopping', 'Using this page', 'Use the visible actions to complete this step in your shopping journey.', [], [
    'Read the page heading and any status or validation message first.',
    'Complete required fields and review the result before continuing.',
    'Use Help & Support if the page cannot complete the requested action.',
  ]),
  seller: guide('seller-fallback', 'Store operations', 'Using this workspace', 'This page operates on the currently selected store and your assigned permissions.', [], [
    'Review the page summary, filters and any Needs attention indicator.',
    'Open one record and use only its available next actions.',
    'Confirm the success message or refreshed record before leaving.',
  ]),
  admin: guide('admin-fallback', 'Administration', 'Using this admin page', 'Manage this area through reviewed, permission-controlled actions.', [], [
    'Use search and filters to locate the exact record.',
    'Review related data and warnings before saving a change.',
    'Confirm the updated value or audit entry after completion.',
  ]),
  master: guide('master-fallback', 'Platform owner', 'Using this owner page', 'Changes here can affect client access or shared platform behavior.', [], [
    'Verify the selected store, version and scope.',
    'Review impact and provide a clear reason.',
    'Confirm audit history and rollout status after applying the change.',
  ]),
};

export function normalizeManualPath(route = '/') {
  const raw = String(route || '/').split('?')[0].split('#')[0] || '/';
  const storePath = raw.match(/^\/store\/[^/]+(\/.*)?$/)?.[1];
  if (storePath !== undefined) return storePath || '/';
  if (/^\/products\/[^/]+$/.test(raw) || /^\/product\/[^/]+$/.test(raw)) return '/product';
  return raw.replace(/\/$/, '') || '/';
}

export function manualAudience(route = '/') {
  const path = normalizeManualPath(route);
  if (path === '/master' || path.startsWith('/master/')) return 'master';
  if (path.startsWith('/seller')) return 'seller';
  if (path.startsWith('/admin')) return 'admin';
  return 'customer';
}

export function guideForRoute(route = '/') {
  const path = normalizeManualPath(route);
  return USER_MANUAL_GUIDES.find((entry) => entry.paths.includes(path)) || FALLBACKS[manualAudience(path)];
}

export function guidesForAudience(route = '/') {
  const audience = manualAudience(route);
  if (audience === 'customer') return USER_MANUAL_GUIDES.filter((entry) => entry.paths.some((path) => !path.startsWith('/admin') && !path.startsWith('/seller') && !path.startsWith('/master')));
  if (audience === 'master') return USER_MANUAL_GUIDES.filter((entry) => entry.area === 'Platform owner' || entry.id === 'audit' || entry.id === 'system-status');
  const prefix = audience === 'seller' ? '/seller' : '/admin';
  return USER_MANUAL_GUIDES.filter((entry) => entry.paths.some((path) => path.startsWith(prefix)) || ['team-dashboard', 'notifications', 'variant-groups', 'inventory', 'order-queue', 'admin-order-detail', 'return-center', 'reports', 'business-center', 'audit', 'settings', 'store-content'].includes(entry.id));
}

export function searchManual(guides, query) {
  const words = String(query || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!words.length) return guides;
  return guides.filter((entry) => {
    const text = [entry.title, entry.summary, entry.area, entry.keywords, ...entry.steps, ...entry.tips].join(' ').toLowerCase();
    return words.every((word) => text.includes(word));
  });
}
