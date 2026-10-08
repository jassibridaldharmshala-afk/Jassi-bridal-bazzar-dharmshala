import { useCallback, useEffect, useRef, useState } from 'react';
import { CircleCheck, Copy, Eye, FileText, Hash, ImagePlus, IndianRupee, Search, SlidersHorizontal, Tag, Type, X } from 'lucide-react';
import api from '../../services/api';
import ImageUploader from './ImageUploader';
import VideoUploader from './VideoUploader';
import ProductSmartFill from './ProductSmartFill';
import ProductRentalPricing, { pricingFromOffer, rentalPricingError } from './ProductRentalPricing';
import ProductPreviewModal from './ProductPreviewModal';
import BarcodeScanner from './BarcodeScanner';
import CompleteLookPicker from './CompleteLookPicker';
import { applySmartPatch } from '../../utils/productSmartFill';
import { normalizeImageEntries, normalizeImageUrl, normalizeVideoEntries } from '../../services/normalize';
import {
  applyAssistantSuggestions,
  buildAssistantSuggestions,
} from '../../utils/productAssistant';
import { fetchCategories, fetchSubcategories } from '../../utils/catalogOptions';
import { buildVariantMatrix, hasManagedVariants } from '../../utils/variants';
import {
  buildSizeChartPayload,
  getSelectableSizes,
  getSizeChartColumns,
  getSizeChartValidation,
  inferSizeChartProfile,
  reconcileSizeChartRows,
  resolveSizingMode,
  SIZE_CHART_PROFILES,
  usesGarmentSizing,
  automaticSizing,
  sizeAttribute,
} from '../../utils/productSizing';

const DRAFT_PREFIX = 'samira-admin-product-draft';

const emptyProduct = {
  name: '',
  slug: '',
  shortDescription: '',
  price: '',
  originalPrice: '',
  costPrice: 0,
  gstRate: 0,
  hsnCode: '',
  barcode: '',
  sku: '',
  brand: 'Jassi General Store',
  category: '',
  subCategory: '',
  categoryDefinitionKey: '',
  stock: 0,
  lowStockAlert: 5,
  reorderQuantity: 0,
  shippingWeightKg: 0,
  packageDimensions: { lengthCm: 0, widthCm: 0, heightCm: 0 },
  countryOfOrigin: 'India',
  manufacturerDetails: '',
  warranty: '',
  supplierName: '',
  supplierSku: '',
  restockAt: '',
  publishAt: '',
  salePrice: '',
  saleStartAt: '',
  saleEndAt: '',
  sizes: '',
  sizingMode: 'auto',
  sizeChartProfile: 'auto',
  sizeChart: { unit: 'in', columns: [], rows: [] },
  sizeFitNotes: '',
  colors: '',
  tags: '',
  fabric: '',
  occasion: '',
  completeLookProductIds: [],
  description: '',
  attributeValues: {},
  images: [],
  videos: [],
  highlights: [],
  careInstructions: '',
  returnPolicy: '',
  returnable: true,
  exchangeable: true,
  returnWindowDays: '',
  metaTitle: '',
  metaDescription: '',
  metaKeywords: '',
  isFeatured: false,
  isNewArrival: false,
  isBestSeller: false,
  showOnHomepage: false,
  showInTrending: false,
  showInFestive: false,
  isActive: true,
  trackVariants: false,
  commerceMode: 'SALE_ONLY',
  rentalPricing: null,
  rentalOffers: [],
  variantOptionValues: {},
  variants: [],
};

export default function ProductForm({
  mode = 'Add',
  productId,
  onSaved,
  onCancel,
  apiPrefix = '/admin',
  uploadPrefix = '/admin/uploads',
  cancelPath = '/admin/products',
}) {
  const [structure, setStructure] = useState(null);
  const [structureError, setStructureError] = useState('');
  const [categories, setCategories] = useState([]);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);
  const [categoryReload, setCategoryReload] = useState(0);
  const [subcategories, setSubcategories] = useState([]);
  const [form, setForm] = useState(() => (productId ? emptyProduct : (readDraftForm(productId, apiPrefix) || emptyProduct)));
  const [assistant, setAssistant] = useState({
    category: '',
    subCategory: '',
    color: '',
    secondaryColors: '',
    fabric: '',
    occasion: '',
    style: '',
    workPattern: '',
    fit: '',
    sizeRange: '',
    priceSegment: '',
    targetCustomer: '',
  });
  const [saving, setSaving] = useState(false);
  const [mediaActivity, setMediaActivity] = useState({ images: false, videos: false });
  const [viewMode, setViewMode] = useState('essential');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [duplicateReview, setDuplicateReview] = useState({ loading: false, conflicts: [] });
  const [cloudDraft, setCloudDraft] = useState(null);
  const [autosaveStatus, setAutosaveStatus] = useState('');
  const [autosaveReady, setAutosaveReady] = useState(false);
  const [message, setMessage] = useState('');
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [errors, setErrors] = useState({});
  const [draftReady, setDraftReady] = useState(() => !productId);
  const [smartFillReset, setSmartFillReset] = useState(0);
  const [assistantMode, setAssistantMode] = useState('fill-empty');
  const [assistantSuggestions, setAssistantSuggestions] = useState(null);
  const [assistantSelection, setAssistantSelection] = useState({
    name: true,
    slug: true,
    sku: true,
    shortDescription: true,
    description: true,
    category: true,
    subCategory: true,
    occasion: true,
    fabric: true,
    sizes: true,
    colors: true,
    tags: true,
    highlights: true,
    careInstructions: true,
    returnPolicy: true,
    metaTitle: true,
    metaKeywords: true,
    metaDescription: true,
    caption: true,
    flags: false,
  });
  const [assistantPreviewOpen, setAssistantPreviewOpen] = useState(false);
  const [baseUpdatedAt, setBaseUpdatedAt] = useState('');
  const [recoveryDraft, setRecoveryDraft] = useState(null);
  const baselineRef = useRef(JSON.stringify(emptyProduct));
  const formRef = useRef(null);
  const autosaveIdRef = useRef('');
  const autosavePauseRef = useRef(false);
  const draftSaveLock = useRef(false);
  const submitIntentRef = useRef('save');
  const draftKey = getDraftKey(productId, apiPrefix);
  const autosaveKey = `active-add-product:${apiPrefix.replace(/[^a-z]/gi, '') || 'admin'}`;
  const reloadStructure = () => { setStructureError(''); return api.get('/catalog-configuration').then(setStructure).catch((error) => setStructureError(error.message)); };
  useEffect(() => {
    let alive = true;
    api.get('/catalog-configuration').then((value) => { if (alive) setStructure(value); }).catch((error) => { if (alive) setStructureError(error.message); });
    return () => { alive = false; };
  }, []);
  const productForSizing = (source) => !usesGarmentSizing(structure, source)
    ? { ...withCategoryName(source, categories), sizingMode: 'free-size', sizeChartProfile: 'free-size' }
    : withCategoryName(source, categories);

  useEffect(() => {
    let alive = true;
    setCategoriesLoaded(false);
    fetchCategories(api, apiPrefix).then((items) => {
      if (alive) { setCategories(items); setCategoriesLoaded(true); }
    });
    return () => { alive = false; };
  }, [apiPrefix, categoryReload]);

  useEffect(() => {
    let alive = true;
    fetchSubcategories(api, form.category, apiPrefix).then((items) => {
      if (alive) setSubcategories(items);
    });
    return () => { alive = false; };
  }, [apiPrefix, form.category]);

  useEffect(() => {
    let alive = true;
    if (!productId) {
      setDraftReady(true);
      return;
    }

    setDraftReady(false);
    setLoadError('');
    api.get(`${apiPrefix}/products/${productId}`).then((product) => {
      if (!alive) return;
      const savedDraft = readDraft(productId, apiPrefix);
      const cachedForm = draftFormOf(savedDraft);
      const mergedDraft = {};
      const serverForm = {
        ...emptyProduct,
        ...product,
        ...mergedDraft,
        rentalPricing: pricingFromOffer(product.rentalOffers?.[0]),
        category: mergedDraft.category ?? (product.category?._id || product.category || ''),
        sizes: mergedDraft.sizes || (product.sizes || []).join(', '),
        sizingMode: mergedDraft.sizingMode || product.sizingMode || 'auto',
        sizeChartProfile: mergedDraft.sizeChartProfile || product.sizeChartProfile || 'auto',
        sizeChart: mergedDraft.sizeChart || product.sizeChart || emptyProduct.sizeChart,
        sizeFitNotes: mergedDraft.sizeFitNotes ?? product.sizeFitNotes ?? '',
        colors: mergedDraft.colors || (product.colors || []).join(', '),
        tags: mergedDraft.tags || (product.tags || []).join(', '),
        highlights: Array.isArray(mergedDraft.highlights) && mergedDraft.highlights.length
          ? mergedDraft.highlights
          : (product.highlights?.length ? product.highlights : emptyProduct.highlights),
        images: normalizeImageEntries((Array.isArray(mergedDraft.images) && mergedDraft.images.length ? mergedDraft.images : product.images) || []),
        videos: normalizeVideoEntries((Array.isArray(mergedDraft.videos) && mergedDraft.videos.length ? mergedDraft.videos : product.videos) || []),
        packageDimensions: { ...emptyProduct.packageDimensions, ...(product.packageDimensions || {}), ...(mergedDraft.packageDimensions || {}) },
        restockAt: toDateTimeInput(mergedDraft.restockAt ?? product.restockAt),
        publishAt: toDateTimeInput(mergedDraft.publishAt ?? product.publishAt),
        saleStartAt: toDateTimeInput(mergedDraft.saleStartAt ?? product.saleStartAt),
        saleEndAt: toDateTimeInput(mergedDraft.saleEndAt ?? product.saleEndAt),
        trackVariants: hasManagedVariants(product) || Boolean(mergedDraft.trackVariants),
        variantOptionValues: Object.keys(mergedDraft.variantOptionValues || {}).length
          ? mergedDraft.variantOptionValues
          : readVariantOptionValues(product.variants || []),
        variants: Array.isArray(mergedDraft.variants) && mergedDraft.variants.length
          ? mergedDraft.variants
          : (product.variants || []),
      };
      setForm(serverForm);
      baselineRef.current = JSON.stringify(serverForm);
      setAssistant({
        category: product.category?.name || product.category || '',
        subCategory: product.subCategory || '',
        color: Array.isArray(product.colors) ? product.colors[0] : splitList(product.colors)[0] || '',
        secondaryColors: Array.isArray(product.colors) ? product.colors.slice(1).join(', ') : splitList(product.colors).slice(1).join(', '),
        fabric: product.fabric || '',
        occasion: product.occasion || '',
        style: product.shortDescription || '',
      });
      setBaseUpdatedAt(product.updatedAt || '');
      const recovery = JSON.stringify(cachedForm || {}) === JSON.stringify(serverForm)
        ? {}
        : mergeDraftIntoProduct(cachedForm);
      if (!Object.keys(recovery).length && savedDraft) clearDraft(productId, apiPrefix);
      setRecoveryDraft(Object.keys(recovery).length ? {
        form: cachedForm,
        savedAt: savedDraft?.__draftMeta?.savedAt || '',
        stale: Boolean(savedDraft?.__draftMeta?.baseUpdatedAt && product.updatedAt && savedDraft.__draftMeta.baseUpdatedAt !== product.updatedAt),
      } : null);
      setDraftReady(true);
    }).catch((error) => { if (alive) setLoadError(error.message); });
    return () => { alive = false; };
  }, [apiPrefix, productId, reload]);

  useEffect(() => {
    if (!draftReady || recoveryDraft) return undefined;
    if (typeof window === 'undefined' || !window.localStorage) return undefined;
    if (JSON.stringify(form) === baselineRef.current) return undefined;
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(draftKey, JSON.stringify({
          __draftMeta: { version: 2, savedAt: new Date().toISOString(), baseUpdatedAt },
          form,
        }));
      } catch {
        // ignore storage quota or privacy mode errors
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [baseUpdatedAt, draftKey, draftReady, form, recoveryDraft]);

  useEffect(() => {
    if (mode !== 'Add') { setAutosaveReady(true); return undefined; }
    let alive = true;
    api.get(`${apiPrefix}/product-drafts/autosave?key=${encodeURIComponent(autosaveKey)}`, { silent: true, forceRefetch: true })
      .then((response) => {
        if (!alive) return;
        const draft = response?.data && response.data.status !== 'published' ? response.data : null;
        if (draft && isMeaningfulDraft(draft)) {
          autosaveIdRef.current = String(draft.id || draft._id || '');
          setCloudDraft(draft);
          setAutosaveStatus(`Cloud draft saved ${new Date(draft.updatedAt || Date.now()).toLocaleString('en-IN')}`);
        }
      })
      .catch(() => { if (alive) setAutosaveStatus('Cloud draft sync is temporarily unavailable. Browser recovery is still active.'); })
      .finally(() => { if (alive) setAutosaveReady(true); });
    return () => { alive = false; };
  }, [apiPrefix, autosaveKey, mode]);

  useEffect(() => {
    if (mode !== 'Add' || !autosaveReady || cloudDraft || !draftReady || recoveryDraft || autosavePauseRef.current) return undefined;
    if (mediaActivity.images || mediaActivity.videos || !isMeaningfulDraft(form)) return undefined;
    const timer = window.setTimeout(async () => {
      try {
        setAutosaveStatus('Syncing draft…');
        const sizingDefaults = structure && !usesGarmentSizing(structure, form) ? { sizingMode: 'free-size', sizeChartProfile: 'free-size' } : {};
        const response = await api.put(`${apiPrefix}/product-drafts/autosave`, { ...buildDraftPayload(form, sizingDefaults), autosaveKey }, { silent: true });
        autosaveIdRef.current = String(response?.data?.id || response?.data?._id || autosaveIdRef.current || '');
        setAutosaveStatus('Draft synced across devices');
      } catch {
        setAutosaveStatus('Cloud sync paused. Browser recovery is still active.');
      }
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [apiPrefix, autosaveKey, autosaveReady, cloudDraft, draftReady, form, mediaActivity.images, mediaActivity.videos, mode, recoveryDraft, structure]);

  useEffect(() => {
    const name = String(form.name || '').trim();
    const sku = String(form.sku || '').trim();
    const barcode = String(form.barcode || '').trim();
    if (name.length < 3 && !sku && !barcode) { setDuplicateReview({ loading: false, conflicts: [] }); return undefined; }
    let alive = true;
    const timer = window.setTimeout(() => {
      setDuplicateReview((current) => ({ ...current, loading: true }));
      const query = new URLSearchParams({ ...(name.length >= 3 ? { name } : {}), ...(sku ? { sku } : {}), ...(barcode ? { barcode } : {}), ...(productId ? { excludeId: productId } : {}) });
      api.get(`${apiPrefix}/products/duplicate-check?${query}`, { silent: true, forceRefetch: true })
        .then((response) => { if (alive) setDuplicateReview({ loading: false, conflicts: Array.isArray(response?.conflicts) ? response.conflicts : [] }); })
        .catch(() => { if (alive) setDuplicateReview({ loading: false, conflicts: [] }); });
    }, 450);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [apiPrefix, form.barcode, form.name, form.sku, productId]);

  const handleBarcode = useCallback((value) => {
    setForm((current) => ({ ...current, barcode: value }));
    clearErrors(setErrors, 'barcode');
  }, []);

  const copyExistingProduct = useCallback((product) => {
    setForm(formFromExistingProduct(product));
    setErrors({});
    setMessage('Product details copied. Add a unique SKU, review the photos and enter stock before publishing.');
    setCopyOpen(false);
    setViewMode('essential');
  }, []);

  const update = (field, value) => {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if ((field === 'sizes' || field === 'colors') && current.trackVariants) {
        next.variants = seedExistingStock(
          buildVariantMatrix(splitList(field === 'sizes' ? value : current.sizes), splitList(field === 'colors' ? value : current.colors), current.variants),
          current,
        );
        next.stock = next.variants.reduce((sum, variant) => sum + Math.max(0, Number(variant.stock || 0)), 0);
      }
      return next;
    });
    clearErrors(setErrors, field, ...(field === 'sizes' ? ['sizeChart', 'variants'] : []), ...(field === 'colors' ? ['variants'] : []), ...(field === 'originalPrice' ? ['price'] : []));
  };

  const updateVariantStock = (index, stock) => {
    setForm((current) => {
      const variants = current.variants.map((variant, variantIndex) => (
        variantIndex === index ? { ...variant, stock: Math.max(0, Number(stock || 0)) } : variant
      ));
      return { ...current, variants, stock: variants.reduce((sum, variant) => sum + Math.max(0, Number(variant.stock || 0)), 0) };
    });
    clearErrors(setErrors, 'stock', 'variants');
  };

  const updateVariant = (index, field, value) => {
    setForm((current) => {
      const variants = current.variants.map((variant, variantIndex) => (
        variantIndex === index ? { ...variant, [field]: value } : variant
      ));
      return {
        ...current,
        variants,
        stock: variants.reduce((sum, variant) => sum + Math.max(0, Number(variant.stock || 0)), 0),
      };
    });
    clearErrors(setErrors, 'stock', 'variants');
  };

  const toggleTrackVariants = (enabled) => {
    setForm((current) => {
      const variants = enabled
        ? seedExistingStock(buildVariantMatrix(splitList(current.sizes), splitList(current.colors), current.variants), current)
        : [];
      return {
        ...current,
        trackVariants: enabled,
        variants,
        stock: enabled && variants.length
          ? variants.reduce((sum, variant) => sum + Math.max(0, Number(variant.stock || 0)), 0)
          : current.stock,
      };
    });
    clearErrors(setErrors, 'variants');
  };

  const updateSizeMeasurement = (sizeLabel, field, value) => {
    setForm((current) => {
      const sizingProduct = withCategoryName(current, categories);
      const columns = getSizeChartColumns(sizingProduct);
      const rows = reconcileSizeChartRows(current.sizeChart?.rows, getSelectableSizes(sizingProduct), columns)
        .map((row) => row.size === sizeLabel ? { ...row, [field]: value } : row);
      return {
        ...current,
        sizeChart: {
          unit: current.sizeChart?.unit === 'cm' ? 'cm' : 'in',
          columns: columns.map((column) => column.key),
          rows,
        },
      };
    });
    clearErrors(setErrors, 'sizeChart');
  };

  const updateSizeChartUnit = (unit) => {
    setForm((current) => ({
      ...current,
      sizeChart: { ...(current.sizeChart || {}), unit: unit === 'cm' ? 'cm' : 'in' },
    }));
  };

  const updateAssistant = (field, value) => setAssistant((current) => ({ ...current, [field]: value }));

  const generateAssistant = () => {
    const selectedCategory = categories.find((category) => category._id === form.category) || {};
    const matchedCategory = categories.find((category) => String(category.name || '').trim().toLowerCase() === String(assistant.category || '').trim().toLowerCase());
    const categoryLabel = assistant.category || selectedCategory.name || '';
    const suggestions = buildAssistantSuggestions({
      productId,
      sizingEnabled: automaticSizing(structure),
      categoryId: matchedCategory?._id || form.category || '',
      categoryName: categoryLabel,
      categoryLabel,
      subCategory: assistant.subCategory || form.subCategory || '',
      color: assistant.color || (Array.isArray(form.colors) ? form.colors[0] : splitList(form.colors)[0]) || '',
      secondaryColors: assistant.secondaryColors || splitList(form.colors).slice(1).join(', '),
      fabric: assistant.fabric || form.fabric || '',
      occasion: assistant.occasion || form.occasion || '',
      style: assistant.style || '',
      workPattern: assistant.workPattern || '',
      fit: assistant.fit || '',
      sizeRange: assistant.sizeRange || form.sizes || '',
      priceSegment: assistant.priceSegment || '',
      targetCustomer: assistant.targetCustomer || '',
    });
    setAssistantSuggestions(suggestions);
    setAssistantPreviewOpen(true);
    setMessage('');
  };

  const applyAssistant = () => {
    if (!assistantSuggestions) return;
    const nextForm = applyAssistantSuggestions(form, assistantSuggestions, assistantMode, Object.entries(assistantSelection).filter(([key, value]) => value && (automaticSizing(structure) || key !== 'sizes')).map(([key]) => key));
    setForm(nextForm);
    if (assistantSelection.caption && assistantSuggestions.caption && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(assistantSuggestions.caption).catch(() => {});
    }
    setAssistantPreviewOpen(false);
    setMessage('Smart product details generated.');
  };

  const submit = async (event) => {
    event.preventDefault();
    const intent = submitIntentRef.current || (mode === 'Add' ? 'publish' : 'save');
    if (saving || !draftReady || loadError || (mode === 'Update' && !productId)) return;
    if (mediaActivity.images || mediaActivity.videos) {
      setMessage('Please wait for the media upload to finish before saving the product.');
      return;
    }
    if (!structure) { setMessage('Load the store product configuration before saving.'); return; }
    const sizingProduct = productForSizing(form);
    const nextErrors = validate(form, sizingProduct, getActiveAttributeDefinitions(structure, categories, form));
    const blockingDuplicate = duplicateReview.conflicts.find((item) => item.blocking);
    if (blockingDuplicate) {
      const reasons = blockingDuplicate.reasons || [blockingDuplicate.reason];
      if (reasons.includes('SKU')) nextErrors.sku = `SKU is already used by ${blockingDuplicate.name}.`;
      if (reasons.includes('Barcode')) nextErrors.barcode = `Barcode is already used by ${blockingDuplicate.name}.`;
    }
    if (intent === 'schedule' && (!form.publishAt || new Date(form.publishAt) <= new Date())) nextErrors.publishAt = 'Choose a future date and time to schedule this product.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      const needsAdvanced = Object.keys(nextErrors).some((field) => ['barcode', 'costPrice', 'gstRate', 'lowStockAlert', 'reorderQuantity', 'shippingWeightKg', 'packageDimensions', 'publishAt', 'salePrice', 'saleStartAt', 'saleEndAt'].includes(field));
      if (needsAdvanced) {
        setViewMode('advanced');
        window.setTimeout(() => focusFormError(formRef.current, nextErrors), 0);
      } else focusFormError(event.currentTarget, nextErrors);
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const price = Number(form.price);
      const originalPrice = form.commerceMode === 'RENTAL_ONLY' ? price : Number(form.originalPrice || form.price);
      const sizingMode = resolveSizingMode(sizingProduct);
      const selectableSizes = getSelectableSizes(sizingProduct);
      const tracksVariants = form.trackVariants && (sizingMode === 'sized' || getEffectiveVariantConfig(structure, categories, form).enabled);
      const selectedCategory = categories.find((category) => String(category._id) === String(form.category));
      const payload = {
        ...form,
        rentalPricing: form.commerceMode === 'SALE_ONLY' ? undefined : form.rentalPricing,
        images: prepareImages(form.images),
        videos: prepareVideos(form.videos),
        price,
        originalPrice,
        salePrice: form.commerceMode === 'RENTAL_ONLY' ? null : form.salePrice ? Number(form.salePrice) : null,
        costPrice: Number(form.costPrice || 0),
        gstRate: Number(form.gstRate || 0),
        reorderQuantity: Number(form.reorderQuantity || 0),
        lowStockAlert: Number(form.lowStockAlert),
        shippingWeightKg: Number(form.shippingWeightKg || 0),
        packageDimensions: {
          lengthCm: Number(form.packageDimensions?.lengthCm || 0),
          widthCm: Number(form.packageDimensions?.widthCm || 0),
          heightCm: Number(form.packageDimensions?.heightCm || 0),
        },
        restockAt: nullableDate(form.restockAt),
        publishAt: intent === 'publish' ? null : nullableDate(form.publishAt),
        saleStartAt: form.commerceMode === 'RENTAL_ONLY' ? null : nullableDate(form.saleStartAt),
        saleEndAt: form.commerceMode === 'RENTAL_ONLY' ? null : nullableDate(form.saleEndAt),
        sizes: sizingMode === 'sized' ? selectableSizes : [],
        sizingMode: usesGarmentSizing(structure, form) ? form.sizingMode || 'auto' : 'free-size',
        sizeChartProfile: usesGarmentSizing(structure, form) ? form.sizeChartProfile || 'auto' : 'free-size',
        sizeChart: buildSizeChartPayload(sizingProduct),
        colors: splitList(form.colors),
        tags: splitList(form.tags),
        variants: tracksVariants ? form.variants : [],
        stock: tracksVariants
          ? form.variants.reduce((sum, variant) => sum + Math.max(0, Number(variant.stock || 0)), 0)
          : Number(form.stock),
        ...(productId ? { inventoryRevision: Number(form.inventoryRevision || 0) } : {}),
        discountPercentage: originalPrice > price ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0,
        industry: structure.industry,
        industryRevision: structure.revision,
        categoryDefinitionKey: activeCategoryDefinition?.key || form.categoryDefinitionKey || selectedCategory?.definitionKey || definitionKey(form.subCategory || selectedCategory?.name),
        returnWindowDays: form.returnWindowDays === '' ? null : Number(form.returnWindowDays),
        isActive: intent === 'publish' || intent === 'schedule' ? true : form.isActive,
      };
      if (productId && !tracksVariants && sizingMode !== 'sized' && !getEffectiveVariantConfig(structure, categories, form).enabled) delete payload.variants;
      if (!payload.category) delete payload.category;
      if (productId) await api.put(`${apiPrefix}/products/${productId}`, payload);
      else await api.post(`${apiPrefix}/products`, payload);
      autosavePauseRef.current = true;
      if (!cloudDraft && autosaveIdRef.current) await api.delete(`${apiPrefix}/product-drafts/${autosaveIdRef.current}`).catch(() => {});
      if (!productId) setForm(emptyProduct);
      clearDraft(productId, apiPrefix);
      setMessage(intent === 'schedule' ? 'Product scheduled successfully.' : intent === 'publish' ? 'Product published successfully.' : 'Product saved successfully.');
      onSaved?.();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
      submitIntentRef.current = 'save';
    }
  };

  const saveServerDraft = async () => {
    if (saving || draftSaveLock.current || mode !== 'Add') return;
    if (mediaActivity.images || mediaActivity.videos) {
      setMessage('Please wait for the media upload to finish before saving the draft.');
      return;
    }
    if (!isMeaningfulDraft(form)) {
      setMessage('Add a product name, SKU, description or photo before saving a draft.');
      return;
    }
    draftSaveLock.current = true;
    setSaving(true);
    setMessage('');
    try {
      const sizingProduct = productForSizing(form);
      const sizingMode = resolveSizingMode(sizingProduct);
      const tracksVariants = form.trackVariants && (sizingMode === 'sized' || getEffectiveVariantConfig(structure, categories, form).enabled);
      const payload = buildDraftPayload(form, {
        sizingMode: sizingProduct.sizingMode || 'auto', sizeChartProfile: sizingProduct.sizeChartProfile || 'auto',
        sizes: sizingMode === 'sized' ? getSelectableSizes(sizingProduct) : [],
        variants: tracksVariants ? form.variants : [],
        stock: tracksVariants ? form.variants.reduce((sum, variant) => sum + Math.max(0, Number(variant.stock || 0)), 0) : Number(form.stock || 0),
      });
      if (!payload.category) delete payload.category;
      await api.post(`${apiPrefix}/product-drafts`, payload);
      autosavePauseRef.current = true;
      if (!cloudDraft && autosaveIdRef.current) await api.delete(`${apiPrefix}/product-drafts/${autosaveIdRef.current}`).catch(() => {});
      clearDraft(productId, apiPrefix);
      setMessage('Draft saved safely. Open Product Drafts whenever you are ready to complete it.');
      onSaved?.({ draft: true });
    } catch (error) {
      setMessage(error.message);
    } finally {
      draftSaveLock.current = false;
      setSaving(false);
    }
  };

  const previewImage = (form.images || []).find((image) => image?.primary)?.url || form.images?.[0]?.url || '';
  const sizingProduct = productForSizing(form);
  const effectiveSizingMode = resolveSizingMode(sizingProduct);
  const inferredSizeProfile = inferSizeChartProfile(sizingProduct);
  const sizeChartColumns = getSizeChartColumns(sizingProduct);
  const selectableSizes = getSelectableSizes(sizingProduct);
  const sizeChartRows = reconcileSizeChartRows(form.sizeChart?.rows, selectableSizes, sizeChartColumns);
  const activeAttributeDefinitions = getActiveAttributeDefinitions(structure, categories, form);
  const effectiveVariantConfiguration = getEffectiveVariantConfig(structure, categories, form);
  const activeCategoryDefinition = findCategoryDefinition(structure, categories, form);
  const availableSubcategories = getConfiguredSubcategories(structure, categories, form, subcategories);
  const requiredAttributesComplete = activeAttributeDefinitions
    .filter((attribute) => attribute.required)
    .every((attribute) => String(form.attributeValues?.[attribute.key] ?? '').trim());
  const sizeChartReady = effectiveSizingMode !== 'sized'
    || (selectableSizes.length > 0 && getSizeChartValidation(sizingProduct).valid);
  const pricingReady = Number(form.price) > 0 && (form.commerceMode === 'RENTAL_ONLY'
    || (Number(form.originalPrice) > 0 && Number(form.price) <= Number(form.originalPrice)))
    && (form.commerceMode === 'SALE_ONLY' || !rentalPricingError(form.rentalPricing));
  const inventoryReady = Number.isSafeInteger(Number(form.stock)) && Number(form.stock) >= 0
    && (!form.trackVariants || (form.variants?.length > 0 && !validateVariants(form.variants)));
  const checklist = [
    { id: 'photo', label: 'Photo', done: Boolean(previewImage), target: 'product-media', icon: ImagePlus },
    { id: 'identity', label: 'Identity', done: String(form.name || '').trim().length >= 3 && Boolean(String(form.sku || '').trim()), target: 'product-basics', icon: Type },
    { id: 'category', label: 'Category', done: Boolean(form.category) && requiredAttributesComplete, target: 'product-pricing', icon: Tag },
    { id: 'price', label: 'Pricing', done: pricingReady, target: 'product-pricing', icon: IndianRupee },
    { id: 'stock', label: 'Inventory', done: inventoryReady, target: 'product-pricing', icon: Hash },
    { id: 'size', label: 'Sizing', done: sizeChartReady, target: 'product-media', icon: CircleCheck },
    { id: 'details', label: 'Details', done: String(form.description || '').trim().length >= 20, target: 'product-basics', icon: FileText },
  ];
  const readyCount = checklist.filter((item) => item.done).length;
  const quality = productQuality(form, { pricingReady, inventoryReady, sizeChartReady, requiredAttributesComplete });
  const chargeableWeight = calculateChargeableWeight(form);
  const scheduledPublish = Boolean(form.publishAt && new Date(form.publishAt) > new Date());

  if (mode === 'Update' && !productId) return <p role="alert" className="admin-card p-5">Choose a product from the catalog before editing. <a href={cancelPath} className="underline">Back to catalog</a></p>;
  if (loadError) return <div role="alert" className="admin-card p-5">{loadError} <button type="button" onClick={() => setReload(value => value + 1)} className="admin-btn-ghost">Retry loading product</button></div>;
  if (!draftReady) return <p role="status" className="admin-card p-5">Loading product...</p>;

  return (
    <form ref={formRef} onSubmit={submit} aria-busy={saving || mediaActivity.images || mediaActivity.videos} className="admin-product-form">
      <div className="product-form-commandbar">
        <div><p>Editing experience</p><div className="product-form-mode" aria-label="Product form detail level"><button type="button" aria-pressed={viewMode === 'essential'} onClick={() => setViewMode('essential')}>Essentials</button><button type="button" aria-pressed={viewMode === 'advanced'} onClick={() => setViewMode('advanced')}><SlidersHorizontal size={15} /> Advanced</button></div></div>
        <div className="product-form-quality"><span className={quality.score >= 80 ? 'is-ready' : ''}>{quality.score}</span><div><strong>Listing quality</strong><small>{quality.next || 'Ready for customers'}</small></div></div>
        <div className="product-form-commandbar__actions">
          {mode === 'Add' && <button type="button" className="admin-btn-ghost" onClick={() => setCopyOpen(true)}><Copy size={16} /> Copy existing</button>}
          <button type="button" className="admin-btn-ghost" onClick={() => setPreviewOpen(true)}><Eye size={16} /> Preview</button>
        </div>
      </div>
      <div className="admin-form-guide" role="status">
        <div className="admin-form-guide__progress">
          <span className={`admin-form-guide__count${readyCount === checklist.length ? ' is-ready' : ''}`}>
            {readyCount === checklist.length ? <CircleCheck className="h-4 w-4" /> : `${readyCount}/${checklist.length}`}
          </span>
          <span>{readyCount === checklist.length ? 'Ready to save' : 'Still needed'}</span>
        </div>
        <div className="admin-form-guide__chips">
          {checklist.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={`admin-form-chip${item.done ? ' is-done' : ''}`}
                title={item.done ? `${item.label} added` : `Jump to ${item.label.toLowerCase()}`}
                aria-label={item.done ? `${item.label} added` : `${item.label} still needed`}
                onClick={() => document.getElementById(item.target)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              >
                <span className="admin-form-chip__icon">
                  {item.id === 'photo' && previewImage ? <img src={previewImage} alt="" /> : <Icon className="h-3.5 w-3.5" />}
                </span>
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {recoveryDraft && <div role="alert" className={`admin-form-hint ${recoveryDraft.stale ? 'border-amber-300 bg-amber-50' : ''}`}>
        <div><h3>Unsaved browser draft found</h3><p>{recoveryDraft.stale ? 'The saved product changed after this browser draft was created. Review carefully before applying it.' : `Restore edits${recoveryDraft.savedAt ? ` saved ${new Date(recoveryDraft.savedAt).toLocaleString('en-IN')}` : ''}, or discard them and keep the latest server version.`}</p></div>
        <div className="mt-3 flex flex-wrap gap-2"><button type="button" className="admin-btn" onClick={() => { setForm((current) => ({ ...current, ...mergeDraftIntoProduct(recoveryDraft.form) })); setRecoveryDraft(null); }}>Restore browser edits</button><button type="button" className="admin-btn-ghost" onClick={() => { clearDraft(productId, apiPrefix); setRecoveryDraft(null); }}>Discard browser draft</button></div>
      </div>}

      {cloudDraft && <div role="alert" className="admin-form-hint border-blue-200 bg-blue-50"><div><h3>Draft available from your account</h3><p>Continue the version saved {new Date(cloudDraft.updatedAt || Date.now()).toLocaleString('en-IN')} on this or another device.</p></div><div className="mt-3 flex flex-wrap gap-2"><button type="button" className="admin-btn" onClick={() => { setForm(formFromServerDraft(cloudDraft)); setCloudDraft(null); setMessage('Cloud draft restored.'); }}>Restore cloud draft</button><button type="button" className="admin-btn-ghost" onClick={async () => { if (autosaveIdRef.current) await api.delete(`${apiPrefix}/product-drafts/${autosaveIdRef.current}`).catch(() => {}); autosaveIdRef.current = ''; setCloudDraft(null); setAutosaveStatus('Cloud draft discarded'); }}>Discard cloud draft</button></div></div>}

      {autosaveStatus && mode === 'Add' && <p className="product-form-sync" role="status">{autosaveStatus}</p>}

      {Object.keys(errors).length > 0 && <div role="status" aria-live="polite" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"><strong>Review {Object.keys(errors).length} highlighted field{Object.keys(errors).length === 1 ? '' : 's'} before saving.</strong><ul className="mt-2 space-y-1">{Object.entries(errors).slice(0, 6).map(([field, error]) => <li key={field}><button type="button" className="text-left font-semibold underline decoration-rose-300 underline-offset-2" onClick={() => focusFormError(formRef.current, { [field]: error })}>{error}</button></li>)}</ul></div>}

      {structureError && <div role="alert" className="admin-form-hint"><p>{structureError}</p><button type="button" onClick={reloadStructure}>Retry product configuration</button></div>}
      <ProductSmartFill key={`${apiPrefix}-${productId || 'new'}-${smartFillReset}`} form={form} categories={categories} structure={structure} apiPrefix={apiPrefix}
        disabled={saving || mediaActivity.images || mediaActivity.videos || !draftReady || !!loadError || !structure}
        onApply={(patch, undo) => { setForm(current => applySmartPatch(current, patch, undo)); setErrors({}); }} />
      {structure?.attributes?.length > 0 && <Section id="product-specifications" title={`${structure.name || 'Product'} specifications`} note="These fields, validation and customer-facing sections come from the active industry and category definition.">
        {errors.attributes && <p role="alert" data-error-field="attributes" tabIndex="-1" className="admin-form-hint lg:col-span-2">{errors.attributes}</p>}
        {activeAttributeDefinitions.filter((attribute) => viewMode === 'advanced' || attribute.required).map((attribute) => <DynamicAttributeField key={attribute.key} attribute={attribute} value={form.attributeValues?.[attribute.key] ?? attribute.defaultValue ?? ''} onChange={(value) => { setForm((current) => ({ ...current, attributeValues: { ...current.attributeValues, [attribute.key]: value } })); clearErrors(setErrors, 'attributes'); }} />)}
        {viewMode === 'essential' && activeAttributeDefinitions.some((attribute) => !attribute.required) && <button type="button" className="admin-btn-ghost lg:col-span-2 w-fit" onClick={() => setViewMode('advanced')}>Show optional specifications</button>}
      </Section>}
      <Section id="product-basics" step="01" title="Basic Information" note="Name, SKU and the story customers will read.">
        <Input field="name" label="Product name" value={form.name} onChange={(value) => update('name', value)} error={errors.name} placeholder="Royal Zari Silk Saree" required />
        {viewMode === 'advanced' && <Input label="Slug" value={form.slug} onChange={(value) => update('slug', value)} placeholder="leave blank for auto slug" />}
        <Input field="sku" label="SKU" value={form.sku} onChange={(value) => update('sku', value)} error={errors.sku} placeholder="SC-0101" />
        {viewMode === 'advanced' && <Input label="Brand" value={form.brand} onChange={(value) => update('brand', value)} />}
        <Input label="Short Description" value={form.shortDescription} onChange={(value) => update('shortDescription', value)} placeholder="Premium festive wear" />
        <label className="admin-field lg:col-span-2">
          <span>Full Description</span>
          <textarea
            value={form.description}
            onChange={(event) => update('description', event.target.value)}
            data-error-field="description"
            aria-invalid={Boolean(errors.description)}
            className={`admin-field__control${errors.description ? ' is-error' : ''}`}
            placeholder="Write fabric, fit, finish and occasion details"
          />
          {errors.description && <span className="admin-field__error">{errors.description}</span>}
        </label>
      </Section>

      {duplicateReview.loading && <p className="product-form-sync" role="status">Checking SKU, barcode and similar product names…</p>}
      {!!duplicateReview.conflicts.length && <div className="product-duplicate-warning" role="status"><strong>{duplicateReview.conflicts.some((item) => item.blocking) ? 'Resolve duplicate catalog values' : 'Similar product found'}</strong>{duplicateReview.conflicts.map((item) => <p key={item.id}><span>{item.name}</span> matches {item.reasons.join(' and ')}. <a href={`${apiPrefix}/products/edit?id=${item.id}`}>Review product</a></p>)}</div>}

      <Section id="product-pricing" step="02" title="Category, Pricing and Inventory" note="Where it sits in the catalog and how it is sold.">
        <label className="admin-field"><span>Available for</span><select className="admin-field__control" value={form.commerceMode || 'SALE_ONLY'} onChange={event => setForm(current => ({ ...current, commerceMode: event.target.value }))}><option value="SALE_ONLY">Sale only</option><option value="RENTAL_ONLY">Rental only</option><option value="SALE_AND_RENTAL">Sale and rental</option></select><small>Choose sale, rental or both for this item.</small></label>
        {form.commerceMode !== 'SALE_ONLY' && <div className="admin-form-hint lg:col-span-2"><h3>Sale + rental inventory</h3><p>Set rental pricing below. Track rental pieces and dates in Rental Studio. Sale stock is counted separately; use zero sale stock for rental-only items.</p></div>}
        <label className="admin-field">
          <span>Category<em>*</em></span>
          <select
            value={form.category}
            onChange={(event) => {
              const category = categories.find((item) => String(item._id) === String(event.target.value));
              setForm((current) => ({ ...current, category: event.target.value, subCategory: '', categoryDefinitionKey: category?.definitionKey || definitionKey(category?.name) }));
              clearErrors(setErrors, 'category', 'attributes');
            }}
            className={`admin-field__control${errors.category ? ' is-error' : ''}`}
            data-error-field="category"
            aria-invalid={Boolean(errors.category)}
          >
            <option value="">{categoriesLoaded ? 'Select category' : 'Loading categories...'}</option>
            {categories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}
          </select>
          {errors.category && <span className="admin-field__error">{errors.category}</span>}
          {categoriesLoaded && !categories.length ? <span className="admin-field__error">No category is available for this store. <button type="button" className="underline" onClick={() => setCategoryReload((value) => value + 1)}>Retry</button>{apiPrefix === '/admin' ? <> or <a className="underline" href="/admin/categories">create a category</a></> : null}.</span> : null}
        </label>
        {viewMode === 'advanced' && <label className="admin-field">
          <span>Subcategory</span>
          <input
            list="product-subcategories"
            value={form.subCategory}
            onChange={(event) => {
              const subCategory = event.target.value;
              const definition = findCategoryDefinition(structure, categories, { ...form, subCategory, categoryDefinitionKey: '' });
              setForm((current) => ({ ...current, subCategory, categoryDefinitionKey: definition?.key || current.categoryDefinitionKey }));
            }}
            className="admin-field__control"
            placeholder={availableSubcategories.length ? 'Select or type a subcategory' : 'Optional subcategory'}
          />
          <datalist id="product-subcategories">
            {availableSubcategories.map((item) => <option key={item} value={item} />)}
          </datalist>
        </label>}
        <Input label="Occasions (comma-separated)" value={form.occasion} onChange={(value) => update('occasion', value)} placeholder="Wedding, Party, Daily wear" />
        <small className="text-slate-500">Use consistent occasion names. Homepage shortcuts use this store’s published products.</small>
        {viewMode === 'advanced' && <Input label="Fabric" value={form.fabric} onChange={(value) => update('fabric', value)} placeholder="Silk" />}
        {form.commerceMode !== 'RENTAL_ONLY' && <Input field="originalPrice" label="Original price" type="number" min="0.01" step="0.01" value={form.originalPrice} onChange={(value) => update('originalPrice', value)} error={errors.originalPrice} placeholder="2499" />}
        <Input field="price" label={form.commerceMode === 'RENTAL_ONLY' ? 'Reference item value' : 'Selling price'} type="number" min="0.01" step="0.01" value={form.price} onChange={(value) => update('price', value)} error={errors.price} placeholder={form.commerceMode === 'RENTAL_ONLY' ? 'Enter item value' : '1299'} />
        {form.commerceMode !== 'SALE_ONLY' && <ProductRentalPricing value={form.rentalPricing} offers={form.rentalOffers} onChange={value => update('rentalPricing', value)} error={errors.rentalPricing} apiPrefix={apiPrefix} />}
        {viewMode === 'advanced' && <Input field="costPrice" label="Cost price" type="number" min="0" step="0.01" value={form.costPrice || 0} onChange={(value) => update('costPrice', value)} error={errors.costPrice} placeholder="700" />}
        {viewMode === 'advanced' && <Input field="gstRate" label="GST rate (%)" type="number" min="0" max="100" step="0.01" value={form.gstRate || 0} onChange={(value) => update('gstRate', value)} error={errors.gstRate} placeholder="5" />}
        {viewMode === 'advanced' && <Input label="HSN code" value={form.hsnCode || ''} onChange={(value) => update('hsnCode', value)} placeholder="6204" />}
        {viewMode === 'advanced' && <div className="admin-field"><Input field="barcode" label="Barcode / GTIN" value={form.barcode || ''} onChange={(value) => update('barcode', value)} error={errors.barcode} placeholder="Scan or enter barcode" /><BarcodeScanner disabled={saving} onDetected={handleBarcode} /></div>}
        <Input field="stock" label={form.trackVariants ? 'Total sale stock (calculated from variants)' : 'Sale stock quantity'} type="number" min="0" step="1" value={form.stock} onChange={(value) => update('stock', value)} error={errors.stock} placeholder="0" disabled={form.trackVariants} />
        {viewMode === 'advanced' && <Input field="lowStockAlert" label="Low stock alert" type="number" min="0" step="1" value={form.lowStockAlert} onChange={(value) => update('lowStockAlert', value)} error={errors.lowStockAlert} placeholder="5" />}
        {viewMode === 'advanced' && <Input field="reorderQuantity" label="Suggested reorder quantity" type="number" min="0" step="1" value={form.reorderQuantity || 0} onChange={(value) => update('reorderQuantity', value)} error={errors.reorderQuantity} placeholder="10" />}
        {viewMode === 'advanced' && <Input field="shippingWeightKg" label="Packed unit weight (kg, 0 uses store default)" type="number" min="0" max="1000" step="0.01" value={form.shippingWeightKg || 0} onChange={value => update('shippingWeightKg', value)} error={errors.shippingWeightKg} placeholder="0.5" />}
        {viewMode === 'advanced' && Number(form.costPrice || 0) > 0 && Number(form.price || 0) > 0 && <div className="admin-form-hint lg:col-span-2"><h3>Estimated gross margin</h3><p>Rs. {(Number(form.price) - Number(form.costPrice)).toLocaleString('en-IN')} per unit · {Math.round(((Number(form.price) - Number(form.costPrice)) / Number(form.price)) * 100)}% before tax, shipping and payment charges.</p></div>}
        {errors.variants && <p role="alert" data-error-field="variants" tabIndex="-1" className="admin-field__error lg:col-span-2">{errors.variants}</p>}
        {effectiveSizingMode === 'sized' ? (
          <label className={`admin-flag lg:col-span-2 w-fit${form.trackVariants ? ' is-on' : ''}`}>
            <input type="checkbox" checked={!!form.trackVariants} onChange={(event) => toggleTrackVariants(event.target.checked)} className="accent-rose" />
            Track stock by size and/or colour
          </label>
        ) : structure?.features?.sizing === false && effectiveVariantConfiguration.enabled ? (
          <DynamicVariantEditor
            variantConfiguration={effectiveVariantConfiguration}
            attributes={activeAttributeDefinitions}
            form={form}
            setForm={setForm}
            onUpdateVariant={updateVariant}
          />
        ) : (
          <div className="admin-form-hint lg:col-span-2">
            <h3>One-size inventory</h3>
            <p>This product does not require a size choice. Stock is tracked at product level and colour variants remain optional.</p>
          </div>
        )}
        {effectiveSizingMode === 'sized' && form.trackVariants ? (
          <div className="lg:col-span-2 overflow-hidden rounded-2xl border border-theme-border" data-error-field="variants" tabIndex="-1">
            <VariantBulkTools form={form} setForm={setForm} />
            <div className="overflow-x-auto"><table className="w-full min-w-[1120px] text-left text-sm">
              <thead className="bg-ivory text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr><th className="p-3">Size</th><th className="p-3">Colour</th><th className="p-3">Variant SKU</th><th className="p-3">Stock</th><th className="p-3">Selling price</th><th className="p-3">MRP</th><th className="p-3">Photo</th><th className="p-3">Available</th></tr>
              </thead>
              <tbody>
                {(form.variants || []).map((variant, index) => (
                  <tr key={`${variant.size}-${variant.color}-${index}`} className="border-t border-[#f3ebe3]">
                    <td className="p-3 font-bold">{variant.size}</td>
                    <td className="p-3">{variant.color || 'Default'}</td>
                    <td className="p-3"><input aria-label={`${variant.size || 'Default'} ${variant.color || 'default'} variant SKU`} value={variant.sku || ''} onChange={(event) => updateVariant(index, 'sku', event.target.value)} className="admin-field__control h-10 min-h-10 min-w-36 px-3" placeholder="Optional" /></td>
                    <td className="p-3">
                      <input aria-label={`${variant.size || 'Default'} ${variant.color || 'default'} stock`} type="number" min="0" step="1" value={variant.stock} onChange={(event) => updateVariantStock(index, event.target.value)} className="admin-field__control h-10 w-24 min-h-10 px-3" />
                    </td>
                    <td className="p-3"><input aria-label={`${variant.size || 'Default'} ${variant.color || 'default'} selling price`} type="number" min="0.01" step="0.01" value={variant.price || ''} onChange={(event) => updateVariant(index, 'price', event.target.value)} className="admin-field__control h-10 w-28 min-h-10 px-3" placeholder="Main price" /></td>
                    <td className="p-3"><input aria-label={`${variant.size || 'Default'} ${variant.color || 'default'} MRP`} type="number" min="0.01" step="0.01" value={variant.originalPrice || ''} onChange={(event) => updateVariant(index, 'originalPrice', event.target.value)} className="admin-field__control h-10 w-28 min-h-10 px-3" placeholder="Main MRP" /></td>
                    <td className="p-3"><select aria-label={`${variant.size || 'Default'} ${variant.color || 'default'} photo`} value={variant.images?.[0]?.url || ''} onChange={(event) => updateVariant(index, 'images', event.target.value ? [{ url: event.target.value, primary: true }] : [])} className="admin-field__control h-10 min-h-10 min-w-36 px-2"><option value="">Main product photo</option>{form.images.map((image, imageIndex) => <option key={`${image.url}-${imageIndex}`} value={image.url}>Photo {imageIndex + 1}{image.primary ? ' · Main' : ''}</option>)}</select></td>
                    <td className="p-3"><label className="inline-flex items-center gap-2 font-semibold"><input type="checkbox" checked={variant.isActive !== false} onChange={(event) => updateVariant(index, 'isActive', event.target.checked)} className="accent-wine" /> Sell</label></td>
                  </tr>
                ))}
              </tbody>
            </table></div>
            <p className="px-3 py-2 text-xs font-semibold text-slate-500">Total units: {form.stock || 0}. Leave a combination at 0 to make it unavailable. Blank variant prices use the main product price and MRP.</p>
          </div>
        ) : null}
      </Section>

      <Section id="product-media" step="03" title="Product Images, Sizes and Colors" note="Photos first, then the options customers pick.">
        <div className="lg:col-span-2" data-error-field="images" tabIndex="-1">
          <div className="admin-form-hint mb-3">
            <h3>Product images</h3>
            <p>Click the upload box or drag images here. Keep up to 20 clear product photos; add up to 8 at a time. JPG, JPEG, PNG or WEBP files up to 20MB are compressed before upload.</p>
          </div>
          <ImageUploader
            label="Choose Product Images"
            helpText="Uploaded images are saved on the backend and only image URLs are stored in MongoDB."
            multiple
            maxFiles={20}
            uploadContext="products"
            uploadPath={uploadPrefix}
            compressAboveMb={2}
            maxUploadMb={20}
            targetSizeMb={0.7}
            value={form.images}
            onChange={(images) => update('images', images)}
            disabled={saving}
            onBusyChange={(busy) => setMediaActivity((current) => ({ ...current, images: busy }))}
          />
          <p className="mt-2 text-xs font-semibold text-slate-500">{form.images.length}/20 images saved. Mark one image as Main for product listing.</p>
          {errors.images && <p className="admin-field__error mt-2">{errors.images}</p>}
        </div>
        {viewMode === 'advanced' && <div className="lg:col-span-2">
          <div className="admin-form-hint mb-3">
            <h3>Product videos</h3>
            <p>Optional. Upload up to 2 short videos. MP4, WEBM or MOV. Max 20MB each.</p>
          </div>
          <VideoUploader
            label="Choose Product Videos"
            helpText="Videos are uploaded to the backend and only video URLs are stored in MongoDB."
            multiple
            maxFiles={2}
            uploadContext="product-videos"
            uploadPath={`${uploadPrefix}/videos`}
            value={form.videos}
            onChange={(videos) => update('videos', videos)}
            disabled={saving}
            onBusyChange={(busy) => setMediaActivity((current) => ({ ...current, videos: busy }))}
          />
          <p className="mt-2 text-xs font-semibold text-slate-500">{form.videos.length}/2 videos uploaded.</p>
        </div>}
        {usesGarmentSizing(structure, form) && <><label className="admin-field">
          <span>Customer sizing</span>
          <select value={form.sizingMode || 'auto'} onChange={(event) => update('sizingMode', event.target.value)} className="admin-field__control">
            <option value="auto">Automatic from product category</option>
            <option value="sized">Customer must select a size</option>
            <option value="free-size">No size selection / free size</option>
          </select>
          <small className="text-xs font-semibold text-slate-500">
            Current behaviour: {effectiveSizingMode === 'sized' ? 'show size choices and size chart' : 'hide size choices'}.
            {effectiveSizingMode === 'sized' && ' For sarees or products without size options, choose No size selection / free size.'}
          </small>
        </label>
        <label className="admin-field">
          <span>Measurement template</span>
          <select
            value={form.sizeChartProfile || 'auto'}
            onChange={(event) => update('sizeChartProfile', event.target.value)}
            disabled={effectiveSizingMode !== 'sized'}
            className="admin-field__control disabled:bg-slate-100 disabled:text-slate-400"
          >
            <option value="auto">Automatic ({SIZE_CHART_PROFILES[inferredSizeProfile]?.label || 'category based'})</option>
            {Object.entries(SIZE_CHART_PROFILES).map(([value, profile]) => <option key={value} value={value}>{profile.label}</option>)}
          </select>
        </label>
        </>}
        {effectiveSizingMode === 'sized' ? (
          <Input field="sizes" label="Selectable sizes" value={form.sizes} onChange={(value) => update('sizes', value)} error={errors.sizes} placeholder="XS, S, M, L, XL, XXL" />
        ) : (
          <div className="admin-form-hint lg:col-span-2">
            <h3>No size chart required</h3>
            <p>This product does not require garment sizing. Customers can add it without choosing S, M, L or XL.</p>
          </div>
        )}
        <Input label="Colors" value={form.colors} onChange={(value) => update('colors', value)} placeholder="Pink, Maroon, Gold" />
        {viewMode === 'advanced' && <Input label="Tags" value={form.tags} onChange={(value) => update('tags', value)} placeholder="festive, silk, wedding" />}
        {viewMode === 'advanced' && <Input label="Care Instructions" value={form.careInstructions} onChange={(value) => update('careInstructions', value)} placeholder="Dry clean preferred" />}

        {effectiveSizingMode === 'sized' ? (
          <div className="lg:col-span-2 overflow-hidden rounded-2xl border border-theme-border bg-white">
            <div className="flex flex-col gap-3 border-b border-[#f0e5dc] bg-[#fffaf6] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-black text-charcoal">Garment size chart</h3>
                <p className="mt-1 text-xs font-semibold text-slate-500">Enter the actual finished-garment measurements from your supplier for every available size. Size labels such as S or M do not determine these measurements.</p>
              </div>
              <div className="inline-flex w-fit rounded-full border border-theme-border bg-white p-1" aria-label="Size chart unit">
                {['in', 'cm'].map((unit) => (
                  <button key={unit} type="button" onClick={() => updateSizeChartUnit(unit)} className={`h-8 rounded-full px-4 text-xs font-black uppercase ${form.sizeChart?.unit === unit ? 'bg-wine text-white' : 'text-slate-500'}`}>{unit}</button>
                ))}
              </div>
            </div>
            {selectableSizes.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-max text-left text-xs">
                  <thead className="bg-[#fbf7f3] text-[10px] uppercase tracking-[0.08em] text-slate-500">
                    <tr>
                      <th className="sticky left-0 z-10 min-w-20 bg-[#fbf7f3] p-3">Size</th>
                      {sizeChartColumns.map((column) => <th key={column.key} className="min-w-32 p-3">{column.label}<span className="ml-1 normal-case">({form.sizeChart?.unit || 'in'})</span></th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {sizeChartRows.map((row) => (
                      <tr key={row.size} className="border-t border-[#f3ebe3]">
                        <th className="sticky left-0 z-10 bg-white p-3 text-sm font-black text-charcoal">{row.size}</th>
                        {sizeChartColumns.map((column) => (
                          <td key={column.key} className="p-2">
                            <input
                              type="number"
                              min="0.1"
                              step="0.1"
                              value={row[column.key] ?? ''}
                              onChange={(event) => updateSizeMeasurement(row.size, column.key, event.target.value)}
                              aria-label={`${row.size} ${column.label}`}
                              data-garment-measurement="true"
                              aria-invalid={!!errors.sizeChart && (!Number.isFinite(Number(row[column.key])) || Number(row[column.key]) <= 0)}
                              className="h-10 w-28 rounded-lg border border-[#e5d8cf] px-3 font-bold outline-none focus:border-wine focus:ring-2 focus:ring-wine/10"
                              placeholder="0.0"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="p-4 text-xs font-semibold text-amber-700">Add the selectable sizes above to generate measurement rows.</p>
            )}
            <div className="border-t border-[#f0e5dc] p-4">
              <label className="admin-field">
                <span>Fit and measurement note</span>
                <textarea value={form.sizeFitNotes || ''} onChange={(event) => update('sizeFitNotes', event.target.value)} className="admin-field__control min-h-20" placeholder="Example: Garment measurements. Choose one size larger for a relaxed fit." />
              </label>
              {errors.sizeChart ? <p role="alert" className="admin-field__error mt-2">{errors.sizeChart}</p> : null}
            </div>
          </div>
        ) : null}
      </Section>

      <Section id="complete-look" title="Complete the look" note="Optional complementary products on the product-detail page; no automatic bundles or cart changes."><CompleteLookPicker apiPrefix={apiPrefix} productId={productId} value={form.completeLookProductIds || []} onChange={value => update('completeLookProductIds', value)} disabled={saving} /></Section>
      {viewMode === 'advanced' && <Section id="product-fulfilment" step="04" title="Shipping, Supplier and Schedule" note="Operational details used for courier planning, restocking and controlled publishing.">
        <Input field="packageDimensions" label="Package length (cm)" type="number" min="0" step="0.1" value={form.packageDimensions?.lengthCm || 0} onChange={(value) => { updateNested(setForm, 'packageDimensions', 'lengthCm', value); clearErrors(setErrors, 'packageDimensions'); }} error={errors.packageDimensions} />
        <Input label="Package width (cm)" type="number" min="0" step="0.1" value={form.packageDimensions?.widthCm || 0} onChange={(value) => { updateNested(setForm, 'packageDimensions', 'widthCm', value); clearErrors(setErrors, 'packageDimensions'); }} />
        <Input label="Package height (cm)" type="number" min="0" step="0.1" value={form.packageDimensions?.heightCm || 0} onChange={(value) => { updateNested(setForm, 'packageDimensions', 'heightCm', value); clearErrors(setErrors, 'packageDimensions'); }} />
        <Input label="Country of origin" value={form.countryOfOrigin || ''} onChange={(value) => update('countryOfOrigin', value)} placeholder="India" />
        <Input label="Supplier name" value={form.supplierName || ''} onChange={(value) => update('supplierName', value)} placeholder="Optional internal reference" />
        <Input label="Supplier SKU" value={form.supplierSku || ''} onChange={(value) => update('supplierSku', value)} placeholder="Supplier item code" />
        <Input label="Expected restock" type="datetime-local" value={form.restockAt || ''} onChange={(value) => update('restockAt', value)} />
        <Input field="publishAt" label="Publish on" type="datetime-local" value={form.publishAt || ''} onChange={(value) => update('publishAt', value)} error={errors.publishAt} />
        {form.commerceMode !== 'RENTAL_ONLY' && <><Input field="salePrice" label="Scheduled sale price" type="number" min="0.01" step="0.01" value={form.salePrice || ''} onChange={(value) => update('salePrice', value)} error={errors.salePrice} placeholder="Lower than regular selling price" />
        <Input field="saleStartAt" label="Sale starts" type="datetime-local" value={form.saleStartAt || ''} onChange={(value) => update('saleStartAt', value)} error={errors.saleStartAt} />
        <Input field="saleEndAt" label="Sale ends" type="datetime-local" value={form.saleEndAt || ''} onChange={(value) => update('saleEndAt', value)} error={errors.saleEndAt} /></>}
        <div className="admin-form-hint lg:col-span-2"><h3>Shipping weight preview</h3><p>Actual: {Number(form.shippingWeightKg || 0).toFixed(2)} kg · Volumetric: {chargeableWeight.volumetric.toFixed(2)} kg · Courier chargeable weight: <strong>{chargeableWeight.chargeable.toFixed(2)} kg</strong>. The final rate also depends on destination PIN code and your selected courier.</p></div>
        <label className="admin-field lg:col-span-2"><span>Manufacturer / importer details</span><textarea value={form.manufacturerDetails || ''} onChange={(event) => update('manufacturerDetails', event.target.value)} className="admin-field__control" placeholder="Name and address shown where legally required" /></label>
        <Input label="Warranty / guarantee" value={form.warranty || ''} onChange={(value) => update('warranty', value)} placeholder="Example: 6 months manufacturer warranty" />
      </Section>}

      {viewMode === 'advanced' && structure?.industry === 'fashion' ? <details className="admin-form-card"><summary className="cursor-pointer font-bold text-wine">Manual copy builder</summary><Section step="05" title="Build copy from your details" note="Optional templates. Review generated wording and product options before applying.">
        <div className="admin-form-hint lg:col-span-2">
          <h3>Generate title, description, tags and SEO</h3>
          <p>Use any details you know. Existing manual values stay unless you choose to replace them.</p>
        </div>
        <label className="admin-field">
          <span>Category</span>
          <select
            value={assistant.category}
            onChange={(event) => updateAssistant('category', event.target.value)}
            className="admin-field__control"
          >
            <option value="">Select category</option>
            {categories.map((category) => (
              <option key={category._id} value={category.name}>{category.name}</option>
            ))}
          </select>
        </label>
        <label className="admin-field">
          <span>Subcategory</span>
          <input
            list="assistant-subcategories"
            value={assistant.subCategory}
            onChange={(event) => updateAssistant('subCategory', event.target.value)}
            className="admin-field__control"
            placeholder={subcategories.length ? 'Select or type a subcategory' : 'Optional'}
          />
          <datalist id="assistant-subcategories">
            {subcategories.map((item) => <option key={`assistant-${item}`} value={item} />)}
          </datalist>
        </label>
        <Input label="Main color" value={assistant.color} onChange={(value) => updateAssistant('color', value)} placeholder="Pink, Wine, Blue" />
        <Input label="Secondary colors" value={assistant.secondaryColors} onChange={(value) => updateAssistant('secondaryColors', value)} placeholder="Gold, Cream" />
        <Input label="Fabric" value={assistant.fabric} onChange={(value) => updateAssistant('fabric', value)} placeholder="Georgette, Silk, Cotton" />
        <Input label="Occasion" value={assistant.occasion} onChange={(value) => updateAssistant('occasion', value)} placeholder="Festive, Party, Wedding" />
        <Input label="Style / Type" value={assistant.style} onChange={(value) => updateAssistant('style', value)} placeholder="Ethnic, Party Wear, Daily Wear" />
        <Input label="Work / Pattern" value={assistant.workPattern} onChange={(value) => updateAssistant('workPattern', value)} placeholder="Embroidered, Printed, Zari" />
        <Input label="Fit" value={assistant.fit} onChange={(value) => updateAssistant('fit', value)} placeholder="Regular, Relaxed, Slim" />
        {automaticSizing(structure) && <Input label="Size range" value={assistant.sizeRange} onChange={(value) => updateAssistant('sizeRange', value)} placeholder="S, M, L, XL" />}
        <Input label="Price segment" value={assistant.priceSegment} onChange={(value) => updateAssistant('priceSegment', value)} placeholder="Budget, Premium, Luxury" />
        <Input label="Target customer / usage" value={assistant.targetCustomer} onChange={(value) => updateAssistant('targetCustomer', value)} placeholder="Wedding guest, festive wear" />
        <div className="lg:col-span-2 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4">
          <label className="flex items-start gap-3 text-sm font-bold text-charcoal">
            <input
              type="radio"
              name="assistantMode"
              checked={assistantMode === 'fill-empty'}
              onChange={() => setAssistantMode('fill-empty')}
              className="mt-1 accent-rose"
            />
            <span>
              <span className="block">Fill Empty Fields Only</span>
              <span className="block text-xs font-semibold text-slate-500">Default. Existing manual values stay untouched.</span>
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm font-bold text-charcoal">
            <input
              type="radio"
              name="assistantMode"
              checked={assistantMode === 'replace'}
              onChange={() => setAssistantMode('replace')}
              className="mt-1 accent-rose"
            />
            <span>
              <span className="block">Replace Existing Values</span>
              <span className="block text-xs font-semibold text-slate-500">Will ask for confirmation before overwriting manual data.</span>
            </span>
          </label>
        </div>
        <div className="lg:col-span-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[
            ['name', 'Product name'],
            ['slug', 'Slug'],
            ['sku', 'SKU'],
            ['shortDescription', 'Short description'],
            ['description', 'Full description'],
            ['category', 'Category'],
            ['subCategory', 'Subcategory'],
            ['occasion', 'Occasion'],
            ['fabric', 'Fabric'],
            ['sizes', 'Sizes'],
            ['colors', 'Colors'],
            ['tags', 'Tags'],
            ['highlights', 'Highlights'],
            ['careInstructions', 'Care instructions'],
            ['returnPolicy', 'Return policy'],
            ['metaTitle', 'Meta title'],
            ['metaKeywords', 'Meta keywords'],
            ['metaDescription', 'Meta description'],
            ['flags', 'Flags'],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-charcoal">
              <input
                type="checkbox"
                checked={assistantSelection[key]}
                onChange={(event) => setAssistantSelection((current) => ({ ...current, [key]: event.target.checked }))}
                className="accent-rose"
              />
              {label}
            </label>
          ))}
        </div>
        <div className="lg:col-span-2 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={generateAssistant}
            className="admin-btn"
          >
            Generate Smart Details
          </button>
          <button
            type="button"
            onClick={generateAssistant}
            className="admin-btn-ghost"
          >
            Preview Suggestions
          </button>
        </div>
      </Section></details> : null}

      {viewMode === 'advanced' && <Section step="06" title="Highlights, Policy and SEO" note="Storefront extras and catalog flags.">
        <Input label="Highlights" value={form.highlights.join(', ')} onChange={(value) => update('highlights', splitList(value))} placeholder="Premium fabric, Easy wash care" />
        <Input label="Return Policy" value={form.returnPolicy} onChange={(value) => update('returnPolicy', value)} placeholder="7 days return/exchange" />
        <div className="admin-form-hint lg:col-span-2">
          <div><h3>Returns and exchanges</h3><p>These rules are copied into each order when it is placed, so later policy edits do not change an existing customer purchase.</p></div>
          <div className="mt-3 flex flex-wrap gap-2">
            <label className={`admin-flag${form.returnable ? ' is-on' : ''}`}><input type="checkbox" checked={form.returnable} onChange={(event) => update('returnable', event.target.checked)} className="accent-rose" /> Return allowed</label>
            <label className={`admin-flag${form.exchangeable ? ' is-on' : ''}`}><input type="checkbox" checked={form.exchangeable} onChange={(event) => update('exchangeable', event.target.checked)} className="accent-rose" /> Exchange allowed</label>
          </div>
          <label className="admin-field mt-3 max-w-xs"><span>Product window (days)</span><input className="admin-field__control" type="number" min="0" max="365" step="1" value={form.returnWindowDays} onChange={(event) => update('returnWindowDays', event.target.value)} placeholder="Use store default" /><small>Leave blank to use the store setting. Set 0 to close the window for this product.</small></label>
        </div>
        <Input label="Meta Title" value={form.metaTitle} onChange={(value) => update('metaTitle', value)} />
        <Input label="Meta Keywords" value={form.metaKeywords} onChange={(value) => update('metaKeywords', value)} />
        <label className="admin-field lg:col-span-2">
          <span>Meta Description</span>
          <textarea value={form.metaDescription} onChange={(event) => update('metaDescription', event.target.value)} className="admin-field__control" />
        </label>
        <div className="flex flex-wrap gap-2 lg:col-span-2">
          {[
            ['isFeatured', 'Featured'],
            ['isNewArrival', 'New Arrival'],
            ['isBestSeller', 'Best Seller'],
            ['showOnHomepage', 'Homepage'],
            ['showInTrending', 'Trending'],
            ['showInFestive', 'Festive'],
            ['isActive', 'Active'],
          ].map(([field, label]) => (
            <label key={field} className={`admin-flag${form[field] ? ' is-on' : ''}`}>
              <input type="checkbox" checked={form[field]} onChange={(event) => update(field, event.target.checked)} className="accent-rose" /> {label}
            </label>
          ))}
        </div>
        {form.publishAt && !form.isActive ? <div className="admin-form-hint lg:col-span-2"><h3>Scheduled publishing is paused</h3><p>Turn on Active if this product should appear automatically at the selected publish time.</p></div> : null}
      </Section>}

      {assistantPreviewOpen && assistantSuggestions && (
        <AssistantPreviewModal
          suggestions={assistantSuggestions}
          selection={assistantSelection}
          setSelection={setAssistantSelection}
          mode={assistantMode}
          onClose={() => setAssistantPreviewOpen(false)}
          onApply={applyAssistant}
        />
      )}
      {copyOpen && <ProductCopyModal apiPrefix={apiPrefix} onClose={() => setCopyOpen(false)} onChoose={copyExistingProduct} />}
      {previewOpen && <ProductPreviewModal product={{ ...form, sizes: splitList(form.sizes), colors: splitList(form.colors) }} onClose={() => setPreviewOpen(false)} />}

      {(mediaActivity.images || mediaActivity.videos) && <p role="status" className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900">Media upload in progress. Saving will be available when it finishes.</p>}
      {message && <p role="status" className="rounded-2xl border border-theme-border bg-white px-4 py-3 text-sm font-semibold text-wine">{message}</p>}
      <div className="admin-form-actions">
        {onCancel ? (
          <button type="button" disabled={saving || mediaActivity.images || mediaActivity.videos} onClick={onCancel} className="admin-btn-ghost disabled:opacity-60">
            Cancel
          </button>
        ) : (
          <a href={cancelPath} aria-disabled={saving || mediaActivity.images || mediaActivity.videos} onClick={(event) => { if (saving || mediaActivity.images || mediaActivity.videos) event.preventDefault(); }} className={`admin-btn-ghost${saving || mediaActivity.images || mediaActivity.videos ? ' pointer-events-none opacity-60' : ''}`}>Cancel</a>
        )}
        <button type="button" disabled={saving || mediaActivity.images || mediaActivity.videos} onClick={() => { setForm(JSON.parse(baselineRef.current)); setErrors({}); setMessage(''); clearDraft(productId, apiPrefix); setRecoveryDraft(null); setSmartFillReset(value => value + 1); }} className="admin-btn-ghost disabled:opacity-60">Reset</button>
        {mode === 'Add' && <button type="button" disabled={saving || mediaActivity.images || mediaActivity.videos || !structure} onClick={saveServerDraft} className="admin-btn-ghost disabled:opacity-60">Save Draft</button>}
        <button type="button" disabled={saving || mediaActivity.images || mediaActivity.videos} onClick={() => setPreviewOpen(true)} className="admin-btn-ghost disabled:opacity-60"><Eye size={16} /> Preview</button>
        {scheduledPublish && <button type="submit" disabled={saving || mediaActivity.images || mediaActivity.videos} onClick={() => { submitIntentRef.current = 'schedule'; }} className="admin-btn-secondary disabled:opacity-60">Schedule Product</button>}
        <button type="submit" disabled={saving || mediaActivity.images || mediaActivity.videos} onClick={() => { submitIntentRef.current = mode === 'Add' ? 'publish' : 'save'; }} className="admin-btn disabled:opacity-60">{saving ? 'Saving...' : (mediaActivity.images || mediaActivity.videos) ? 'Uploading media...' : `${mode} Product`}</button>
      </div>
    </form>
  );
}

function AssistantPreviewModal({ suggestions, selection, setSelection, mode, onClose, onApply }) {
  const fields = [
    ['name', 'Product name', suggestions.productName],
    ['slug', 'Slug', suggestions.slug],
    ['sku', 'SKU suggestion', suggestions.sku],
    ['shortDescription', 'Short description', suggestions.shortDescription],
    ['description', 'Full description', suggestions.description],
    ['category', 'Category', suggestions.categoryName || suggestions.category],
    ['subCategory', 'Subcategory', suggestions.subCategory],
    ['occasion', 'Occasion', suggestions.occasion],
    ['fabric', 'Fabric', suggestions.fabric],
    ['sizes', 'Sizes', suggestions.sizes.join(', ')],
    ['colors', 'Colors', suggestions.colors.join(', ')],
    ['tags', 'Tags', suggestions.tags],
    ['highlights', 'Highlights', suggestions.highlights.join('\n')],
    ['careInstructions', 'Care instructions', suggestions.careInstructions],
    ['returnPolicy', 'Return policy', suggestions.returnPolicy],
    ['metaTitle', 'Meta title', suggestions.seo?.metaTitle],
    ['metaKeywords', 'Meta keywords', suggestions.seo?.metaKeywords],
    ['metaDescription', 'Meta description', suggestions.seo?.metaDescription],
    ['flags', 'Flags', formatFlagSummary(suggestions.flags)],
    ['caption', 'Caption', suggestions.caption],
  ];

  return (
    <div className="fixed inset-0 z-[90] bg-black/55 p-3 sm:p-4">
      <div className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.3)]">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-wine/60">Smart Product Assistant</p>
            <h2 className="text-lg font-black text-charcoal">Preview generated suggestions</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">Mode: {mode === 'replace' ? 'Replace existing values' : 'Fill empty fields only'}</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full border border-slate-200">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="grid gap-3 lg:grid-cols-2">
            {fields.map(([key, label, value]) => (
              <label key={key} className="rounded-2xl border border-slate-200 bg-ivory p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-black text-charcoal">{label}</span>
                  <input
                    type="checkbox"
                    checked={Boolean(selection[key])}
                    onChange={(event) => setSelection((current) => ({ ...current, [key]: event.target.checked }))}
                    className="accent-rose"
                  />
                </div>
                <pre className="mt-2 whitespace-pre-wrap break-words text-[12px] leading-5 text-slate-600">{String(value || 'No suggestion')}</pre>
              </label>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 px-5 text-sm font-black text-slate-700">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (mode === 'replace' && !window.confirm('This will replace existing manually entered values. Continue?')) {
                return;
              }
              onApply();
            }}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-wine px-5 text-sm font-black text-white"
          >
            Apply Selected
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductCopyModal({ apiPrefix, onClose, onChoose }) {
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    const timer = window.setTimeout(() => {
      const search = query.trim() ? `&search=${encodeURIComponent(query.trim())}` : '';
      api.get(`${apiPrefix}/products?admin=true&page=1&limit=100&sort=updated${search}`, { silent: true, forceRefetch: true })
        .then((response) => {
          if (!alive) return;
          const items = Array.isArray(response) ? response : Array.isArray(response?.items) ? response.items : [];
          setProducts(items.filter((item) => item && item.isArchived !== true));
        })
        .catch((requestError) => { if (alive) setError(requestError.message || 'Products could not be loaded.'); })
        .finally(() => { if (alive) setLoading(false); });
    }, query.trim() ? 250 : 0);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [apiPrefix, query]);

  const normalizedQuery = query.trim().toLowerCase();
  const visible = products.filter((product) => !normalizedQuery || [product.name, product.sku, product.category?.name]
    .some((value) => String(value || '').toLowerCase().includes(normalizedQuery)));

  return (
    <div className="product-copy-modal" role="dialog" aria-modal="true" aria-labelledby="copy-product-title">
      <button type="button" className="product-copy-modal__backdrop" aria-label="Close product picker" onClick={onClose} />
      <section className="product-copy-modal__panel">
        <header>
          <div><p>Reuse a listing</p><h2 id="copy-product-title">Copy an existing product</h2><span>Details and media are copied. SKU, barcode, stock and schedules are cleared.</span></div>
          <button type="button" onClick={onClose} aria-label="Close product picker"><X size={20} /></button>
        </header>
        <label className="product-copy-modal__search">
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">Search existing products</span>
          <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by product, SKU or category" />
        </label>
        <div className="product-copy-modal__list">
          {loading ? <p className="product-copy-modal__state">Loading your catalogue…</p> : null}
          {error ? <p role="alert" className="product-copy-modal__state is-error">{error}</p> : null}
          {!loading && !error && visible.length === 0 ? <p className="product-copy-modal__state">No matching products found.</p> : null}
          {visible.map((product) => (
            <article key={product._id || product.id} className="product-copy-modal__item">
              {product.images?.[0]?.url || product.image
                ? <img src={normalizeImageUrl(product.images?.[0]?.url || product.image)} alt="" />
                : <span className="product-copy-modal__no-photo">No photo</span>}
              <div><strong>{product.name}</strong><span>{product.sku || 'No SKU'} · {product.category?.name || 'Uncategorised'}</span><small>₹{Number(product.price || 0).toLocaleString('en-IN')} · {Number(product.stock || 0)} in stock</small></div>
              <button type="button" className="admin-btn-ghost" onClick={() => onChoose(product)}>Use product</button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function formatFlagSummary(flags = {}) {
  return [
    flags.isNewArrival ? 'New Arrival: yes' : 'New Arrival: no',
    flags.showInFestive ? 'Festive: suggested' : 'Festive: no',
    flags.showInTrending ? 'Trending: suggested' : 'Trending: no',
    flags.isFeatured ? 'Featured: yes' : 'Featured: no',
    flags.isBestSeller ? 'Best Seller: yes' : 'Best Seller: no',
  ].join('\n');
}

function Section({ id, title, note, step, children }) {
  return (
    <section id={id} className="admin-form-card">
      <header className="admin-form-card__head">
        {step ? <span className="admin-form-card__step">{step}</span> : null}
        <div>
          <h2>{title}</h2>
          {note ? <p className="admin-form-card__note">{note}</p> : null}
        </div>
      </header>
      <div className="admin-form-grid">{children}</div>
    </section>
  );
}

function Input({ field, label, value, onChange, placeholder, type = 'text', required = false, error, min, max, step, disabled = false }) {
  return (
    <label className="admin-field">
      <span>{label}{required ? <em>*</em> : null}</span>
      <input
        required={required}
        type={type}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        data-error-field={field}
        aria-invalid={Boolean(error)}
        className={`admin-field__control disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500${error ? ' is-error' : ''}`}
        placeholder={placeholder}
      />
      {error && <span className="admin-field__error">{error}</span>}
    </label>
  );
}

function DynamicAttributeField({ attribute, value, onChange }) {
  const label = (
    <span>
      {attribute.label}{attribute.unit ? ` (${attribute.unit})` : ''}{attribute.required ? <em>*</em> : null}
    </span>
  );
  const common = {
    value: value ?? '',
    required: Boolean(attribute.required),
    onChange: (event) => onChange(event.target.value),
    'data-required-attribute': attribute.required && !String(value ?? '').trim() ? attribute.key : undefined,
    className: 'admin-field__control',
  };

  if (attribute.type === 'boolean') {
    return <label className="admin-field">{label}<select {...common}><option value="">Choose</option><option value="Yes">Yes</option><option value="No">No</option></select></label>;
  }
  if (attribute.type === 'dropdown') {
    return <label className="admin-field">{label}<select {...common}><option value="">Choose {attribute.label.toLowerCase()}</option>{(attribute.options || []).map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
  }
  if (attribute.type === 'multi_select') {
    const selected = new Set(splitList(value));
    if (attribute.options?.length) {
      return (
        <fieldset className="admin-field" data-required-attribute={attribute.required && !String(value ?? '').trim() ? attribute.key : undefined} tabIndex={attribute.required ? -1 : undefined}>
          <legend>{label}</legend>
          <div className="flex flex-wrap gap-2 rounded-xl border border-theme-border bg-white p-3">
            {attribute.options.map((option) => (
              <label key={option} className={`admin-flag ${selected.has(option) ? 'is-on' : ''}`}>
                <input type="checkbox" checked={selected.has(option)} onChange={() => {
                  const next = new Set(selected);
                  if (next.has(option)) next.delete(option); else next.add(option);
                  onChange(Array.from(next).join(', '));
                }} />
                {option}
              </label>
            ))}
          </div>
        </fieldset>
      );
    }
    return <label className="admin-field">{label}<input {...common} placeholder="Enter comma-separated values" /></label>;
  }
  if (attribute.type === 'textarea') {
    return <label className="admin-field lg:col-span-2">{label}<textarea {...common} rows={4} /></label>;
  }
  const numeric = ['number', 'measurement', 'range'].includes(attribute.type);
  return (
    <label className="admin-field">
      {label}
      <input
        {...common}
        type={attribute.type === 'date' ? 'date' : attribute.type === 'color' ? 'text' : numeric ? 'number' : 'text'}
        min={numeric ? attribute.validation?.min : undefined}
        max={numeric ? attribute.validation?.max : undefined}
        minLength={!numeric ? attribute.validation?.minLength : undefined}
        maxLength={!numeric ? attribute.validation?.maxLength : undefined}
        placeholder={attribute.type === 'color' ? 'Example: Midnight Blue or #14213d' : ''}
      />
    </label>
  );
}

function DynamicVariantEditor({ variantConfiguration, attributes, form, setForm, onUpdateVariant }) {
  const variantKeys = variantConfiguration?.attributes || [];
  const definitions = variantKeys.map((key) => attributes.find((item) => item.key === key)).filter(Boolean);
  const optionValues = form.variantOptionValues || {};
  const maxCombinations = Number(variantConfiguration?.maxCombinations || 120);
  const generate = () => {
    const variants = seedExistingStock(buildDynamicVariantMatrix(definitions, optionValues, form.variants, form.sku, maxCombinations), form);
    setForm((current) => ({
      ...current,
      trackVariants: true,
      variants,
      stock: variants.reduce((sum, variant) => sum + Math.max(0, Number(variant.stock || 0)), 0),
    }));
  };

  return (
    <div className="lg:col-span-2 rounded-2xl border border-theme-border bg-[#fffaf6] p-4 sm:p-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div><h3 className="font-bold text-charcoal">Variant inventory</h3><p className="mt-1 text-xs text-slate-500">Create only the combinations you sell. Every row can have its own SKU, price and stock.</p></div>
        <button type="button" onClick={generate} className="admin-btn-secondary h-10">Generate combinations</button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {definitions.map((definition) => (
          <label key={definition.key} className="admin-field">
            <span>{definition.label} options</span>
            <input
              value={optionValues[definition.key] || ''}
              onChange={(event) => setForm((current) => ({ ...current, variantOptionValues: { ...(current.variantOptionValues || {}), [definition.key]: event.target.value } }))}
              className="admin-field__control"
              placeholder={(definition.options || []).slice(0, 3).join(', ') || 'Comma-separated values'}
            />
          </label>
        ))}
      </div>
      {form.trackVariants && form.variants?.length ? (
        <><div className="mt-4"><VariantBulkTools form={form} setForm={setForm} /></div><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {form.variants.map((variant, index) => (
            <article key={dynamicVariantKey(variant.optionValues)} className="rounded-xl border border-theme-border bg-white p-3">
              <strong className="block truncate text-sm text-charcoal" title={formatVariantOptions(variant.optionValues)}>{formatVariantOptions(variant.optionValues)}</strong>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <CompactVariantInput label="SKU" value={variant.sku} onChange={(value) => onUpdateVariant(index, 'sku', value)} />
                <CompactVariantInput label="Stock" type="number" min={0} step={1} value={variant.stock} onChange={(value) => onUpdateVariant(index, 'stock', Math.max(0, Number(value || 0)))} />
                <CompactVariantInput label="Selling price" type="number" min={0.01} step={0.01} value={variant.price} onChange={(value) => onUpdateVariant(index, 'price', value)} />
                <CompactVariantInput label="MRP" type="number" min={0.01} step={0.01} value={variant.originalPrice} onChange={(value) => onUpdateVariant(index, 'originalPrice', value)} />
              </div>
              <label className="mt-3 grid gap-1 text-[11px] font-semibold text-slate-500"><span>Variant photo</span><select value={variant.images?.[0]?.url || ''} onChange={(event) => onUpdateVariant(index, 'images', event.target.value ? [{ url: event.target.value, primary: true }] : [])} className="h-9 rounded-lg border border-theme-border px-2"><option value="">Main product photo</option>{form.images.map((image, imageIndex) => <option key={`${image.url}-${imageIndex}`} value={image.url}>Photo {imageIndex + 1}</option>)}</select></label>
              <label className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-600"><input type="checkbox" checked={variant.isActive !== false} onChange={(event) => onUpdateVariant(index, 'isActive', event.target.checked)} /> Available for sale</label>
            </article>
          ))}
        </div></>
      ) : <p className="mt-4 text-xs font-semibold text-slate-500">Add option values and generate combinations. Nothing is created automatically.</p>}
    </div>
  );
}

function CompactVariantInput({ label, value, onChange, type = 'text', min, step }) {
  return <label className="grid gap-1 text-[11px] font-semibold text-slate-500"><span>{label}</span><input type={type} min={min} step={step} value={value ?? ''} onChange={(event) => onChange(event.target.value)} className="h-9 min-w-0 rounded-lg border border-theme-border px-2 text-xs text-charcoal" /></label>;
}

function VariantBulkTools({ form, setForm }) {
  const [values, setValues] = useState({ stock: '', price: '', originalPrice: '' });
  const updateAll = (transform) => setForm((current) => {
    const variants = (current.variants || []).map(transform);
    return { ...current, variants, stock: variants.filter((item) => item.isActive !== false).reduce((sum, item) => sum + Math.max(0, Number(item.stock || 0)), 0) };
  });
  const applyValues = () => {
    const patch = {};
    if (values.stock !== '') patch.stock = Math.max(0, Math.round(Number(values.stock || 0)));
    if (Number(values.price) > 0) patch.price = Number(values.price);
    if (Number(values.originalPrice) > 0) patch.originalPrice = Number(values.originalPrice);
    if (!Object.keys(patch).length) return;
    updateAll((variant) => ({ ...variant, ...patch }));
  };
  const generateSkus = () => updateAll((variant, index) => ({
    ...variant,
    sku: `${String(form.sku || 'PRODUCT').trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toUpperCase()}-${variantCode(variant, index)}`,
  }));
  const first = form.variants?.[0];
  return <div className="variant-bulk-tools">
    <div><strong>Bulk variant editor</strong><small>Apply common inventory values, then adjust individual combinations.</small></div>
    <label><span>Stock</span><input aria-label="Bulk variant stock" type="number" min="0" step="1" value={values.stock} onChange={(event) => setValues((current) => ({ ...current, stock: event.target.value }))} /></label>
    <label><span>Price</span><input aria-label="Bulk variant price" type="number" min="0.01" step="0.01" value={values.price} onChange={(event) => setValues((current) => ({ ...current, price: event.target.value }))} /></label>
    <label><span>MRP</span><input aria-label="Bulk variant MRP" type="number" min="0.01" step="0.01" value={values.originalPrice} onChange={(event) => setValues((current) => ({ ...current, originalPrice: event.target.value }))} /></label>
    <div className="variant-bulk-tools__actions"><button type="button" onClick={applyValues}>Apply values</button><button type="button" onClick={generateSkus}>Generate SKUs</button><button type="button" disabled={!first} onClick={() => updateAll((variant) => ({ ...variant, stock: first.stock, price: first.price, originalPrice: first.originalPrice }))}>Copy first row</button><button type="button" onClick={() => updateAll((variant) => ({ ...variant, isActive: true }))}>Enable all</button></div>
  </div>;
}

function variantCode(variant = {}, index = 0) {
  const values = Object.values(variant.optionValues || {}).filter(Boolean);
  if (variant.size) values.unshift(variant.size);
  if (variant.color) values.push(variant.color);
  const code = [...new Set(values)].join('-').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toUpperCase();
  return code || String(index + 1).padStart(2, '0');
}

function getActiveAttributeDefinitions(structure, categories = [], form = {}) {
  const categoryDefinition = findCategoryDefinition(structure, categories, form);
  const merged = new Map((structure?.attributes || []).map((item) => [item.key, item]));
  const chain = [];
  let cursor = categoryDefinition;
  while (cursor && chain.length < 12) {
    chain.unshift(cursor);
    const parentKey = cursor.parentKey;
    cursor = parentKey ? (structure?.categoryDefinitions || []).find((item) => item.key === parentKey) : null;
  }
  chain.forEach((layer) => (layer.attributes || []).forEach((item) => {
    if (typeof item === 'object' && item.key) merged.set(item.key, { ...(merged.get(item.key) || {}), ...item });
  }));
  return Array.from(merged.values()).filter((item) => item.active !== false && (usesGarmentSizing(structure, form) || !sizeAttribute(item.key))).sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0));
}

function getEffectiveVariantConfig(structure, categories = [], form = {}) {
  const attributes = getActiveAttributeDefinitions(structure, categories, form);
  const categoryDefinition = findCategoryDefinition(structure, categories, form);
  const inheritedVariantKeys = [];
  let cursor = categoryDefinition;
  while (cursor && inheritedVariantKeys.length < 12) {
    if (cursor.variantAttributes?.length) inheritedVariantKeys.unshift(...cursor.variantAttributes);
    const parentKey = cursor.parentKey;
    cursor = parentKey ? (structure?.categoryDefinitions || []).find((item) => item.key === parentKey) : null;
  }
  const requested = inheritedVariantKeys.length ? Array.from(new Set(inheritedVariantKeys)) : (structure?.variantConfig?.attributes || []);
  const allowed = new Set(attributes.filter((attribute) => attribute.variant).map((attribute) => attribute.key));
  const selected = requested.filter((key) => allowed.has(key));
  return { ...(structure?.variantConfig || {}), enabled: selected.length > 0, attributes: selected };
}

function findCategoryDefinition(structure, categories = [], form = {}) {
  const definitions = structure?.categoryDefinitions || [];
  const selectedCategory = categories.find((category) => String(category._id) === String(form.category));
  const subcategory = String(form.subCategory || '').trim().toLowerCase();
  if (subcategory) {
    const child = definitions.find((item) => item.key === definitionKey(subcategory) || String(item.name || '').trim().toLowerCase() === subcategory);
    if (child) return child;
  }
  const lookupKeys = [form.categoryDefinitionKey, selectedCategory?.definitionKey, definitionKey(selectedCategory?.name)].filter(Boolean);
  for (const lookupKey of lookupKeys) {
    const match = definitions.find((item) => item.key === lookupKey);
    if (match) return match;
  }
  return null;
}

function getConfiguredSubcategories(structure, categories = [], form = {}, saved = []) {
  const selectedCategory = categories.find((category) => String(category._id) === String(form.category));
  const parent = (structure?.categoryDefinitions || []).find((item) => (
    item.key === selectedCategory?.definitionKey
    || item.key === definitionKey(selectedCategory?.name)
  ));
  const configured = parent
    ? (structure?.categoryDefinitions || []).filter((item) => item.parentKey === parent.key && item.active !== false).map((item) => item.name)
    : [];
  return Array.from(new Set([...(saved || []), ...configured].map((item) => String(item || '').trim()).filter(Boolean)));
}

function buildDynamicVariantMatrix(definitions, values, existing = [], baseSku = '', max = 120) {
  const lists = definitions.map((definition) => splitList(values[definition.key]));
  if (!lists.length || lists.some((list) => !list.length)) return [];
  const combinations = lists.reduce((rows, options, index) => rows.flatMap((row) => options.map((option) => ({ ...row, [definitions[index].key]: option }))), [{}]).slice(0, max);
  const byKey = new Map((existing || []).map((variant) => [dynamicVariantKey(variant.optionValues || {}), variant]));
  return combinations.map((optionValues) => {
    const current = byKey.get(dynamicVariantKey(optionValues));
    const suffix = Object.values(optionValues).map((value) => String(value).replace(/[^a-z0-9]+/gi, '').toUpperCase()).filter(Boolean).join('-');
    const colour = optionValues.colour || optionValues.color || optionValues.shade || '';
    const size = optionValues.size || '';
    return {
      ...(current?._id ? { _id: current._id } : {}),
      optionValues,
      size,
      color: colour,
      sku: current?.sku || [baseSku, suffix].filter(Boolean).join('-'),
      stock: current?.stock ?? 0,
      price: current?.price ?? '',
      originalPrice: current?.originalPrice ?? '',
      images: current?.images || [],
      isActive: current?.isActive !== false,
    };
  });
}

function seedExistingStock(variants, form = {}) {
  if (!variants.length || (Array.isArray(form.variants) && form.variants.length) || !(Number(form.stock) > 0)) return variants;
  return variants.map((variant, index) => index === 0 ? { ...variant, stock: Number(form.stock) } : variant);
}

function readVariantOptionValues(variants = []) {
  const result = {};
  variants.forEach((variant) => Object.entries(variant.optionValues || {}).forEach(([key, value]) => {
    result[key] = Array.from(new Set([...(splitList(result[key])), String(value || '').trim()].filter(Boolean))).join(', ');
  }));
  return result;
}

function dynamicVariantKey(values = {}) {
  return Object.entries(values).sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => `${key}:${String(value).trim().toLowerCase()}`).join('|');
}

function formatVariantOptions(values = {}) {
  return Object.values(values || {}).filter(Boolean).join(' · ') || 'Variant';
}

function definitionKey(value = '') {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function splitList(value) {
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function validate(form, sizingProduct = form, attributes = []) {
  const errors = {};
  if (form.name.trim().length < 3) errors.name = 'Product name must be at least 3 characters.';
  if (!form.sku.trim()) errors.sku = 'SKU is required.';
  if (!form.category) errors.category = 'Category is required.';
  if (form.commerceMode !== 'RENTAL_ONLY' && (!Number.isFinite(Number(form.originalPrice)) || Number(form.originalPrice) <= 0)) errors.originalPrice = 'Original price is required.';
  if (!Number.isFinite(Number(form.price)) || Number(form.price) <= 0) errors.price = form.commerceMode === 'RENTAL_ONLY' ? 'Reference item value is required.' : 'Selling price is required.';
  if (form.commerceMode !== 'SALE_ONLY' && rentalPricingError(form.rentalPricing)) errors.rentalPricing = rentalPricingError(form.rentalPricing);
  if (form.commerceMode !== 'RENTAL_ONLY' && Number(form.price) > Number(form.originalPrice)) errors.price = 'Selling price cannot exceed original price.';
  if (!Number.isSafeInteger(Number(form.stock)) || Number(form.stock) < 0) errors.stock = 'Stock must be a whole number of zero or more.';
  if (!Number.isSafeInteger(Number(form.lowStockAlert)) || Number(form.lowStockAlert) < 0) errors.lowStockAlert = 'Use a whole number of zero or more.';
  if (!Number.isFinite(Number(form.costPrice || 0)) || Number(form.costPrice || 0) < 0) errors.costPrice = 'Cost price must be zero or more.';
  if (!Number.isFinite(Number(form.gstRate || 0)) || Number(form.gstRate || 0) < 0 || Number(form.gstRate || 0) > 100) errors.gstRate = 'GST rate must be between 0 and 100.';
  if (!Number.isSafeInteger(Number(form.reorderQuantity || 0)) || Number(form.reorderQuantity || 0) < 0) errors.reorderQuantity = 'Use a whole number of zero or more.';
  if (!Number.isFinite(Number(form.shippingWeightKg || 0)) || Number(form.shippingWeightKg || 0) < 0 || Number(form.shippingWeightKg || 0) > 1000) errors.shippingWeightKg = 'Packed unit weight must be between 0 and 1000 kg.';
  if (Object.values(form.packageDimensions || {}).some((value) => !Number.isFinite(Number(value || 0)) || Number(value || 0) < 0 || Number(value || 0) > 1000)) errors.packageDimensions = 'Package dimensions must be between 0 and 1000 cm.';
  for (const key of form.commerceMode === 'RENTAL_ONLY' ? ['publishAt'] : ['publishAt', 'saleStartAt', 'saleEndAt']) if (form[key] && Number.isNaN(new Date(form[key]).getTime())) errors[key] = 'Choose a valid date and time.';
  if (form.commerceMode !== 'RENTAL_ONLY' && form.saleStartAt && form.saleEndAt && new Date(form.saleStartAt) >= new Date(form.saleEndAt)) errors.saleEndAt = 'Sale end must be after sale start.';
  const hasScheduledSale = form.commerceMode !== 'RENTAL_ONLY' && Boolean(form.salePrice || form.saleStartAt || form.saleEndAt);
  if (hasScheduledSale) {
    if (!Number.isFinite(Number(form.salePrice)) || Number(form.salePrice) <= 0) errors.salePrice = 'Enter the scheduled sale price.';
    else if (Number(form.salePrice) >= Number(form.price)) errors.salePrice = 'Scheduled sale price must be below the regular selling price.';
    if (!form.saleStartAt) errors.saleStartAt = 'Choose when the sale starts.';
    if (!form.saleEndAt) errors.saleEndAt = 'Choose when the sale ends.';
  }
  if (!form.images.length) errors.images = 'Upload at least one product image.';
  if (form.description.trim().length < 20) errors.description = 'Description must be at least 20 characters.';
  if (form.trackVariants) {
    const variantError = validateVariants(form.variants);
    if (variantError) errors.variants = variantError;
  }
  const missingAttribute = attributes.find((attribute) => attribute.required && !String(form.attributeValues?.[attribute.key] ?? '').trim());
  if (missingAttribute) errors.attributes = `Enter ${missingAttribute.label}.`;
  if (resolveSizingMode(sizingProduct) === 'sized') {
    const sizeValidation = getSizeChartValidation(sizingProduct);
    if (!getSelectableSizes(sizingProduct).length) errors.sizes = 'Add at least one selectable size.';
    if (!sizeValidation.valid && sizeValidation.missing.length) {
      const sample = sizeValidation.missing.slice(0, 3).join(', ');
      errors.sizeChart = `Complete every measurement before saving. Missing: ${sample}${sizeValidation.missing.length > 3 ? ` and ${sizeValidation.missing.length - 3} more` : ''}.`;
    }
  }
  return errors;
}

function validateVariants(variants = []) {
  if (!Array.isArray(variants) || !variants.length) return 'Add every variant option, then generate at least one inventory combination.';
  const combinations = new Set();
  const skus = new Set();
  for (const variant of variants) {
    const stock = Number(variant?.stock);
    if (!Number.isSafeInteger(stock) || stock < 0) return 'Every variant stock value must be a whole number of zero or more.';
    const price = variant?.price === '' || variant?.price === undefined || variant?.price === null ? null : Number(variant.price);
    const originalPrice = variant?.originalPrice === '' || variant?.originalPrice === undefined || variant?.originalPrice === null ? null : Number(variant.originalPrice);
    if (price !== null && (!Number.isFinite(price) || price <= 0)) return 'Variant selling prices must be greater than zero when entered.';
    if (originalPrice !== null && (!Number.isFinite(originalPrice) || originalPrice <= 0)) return 'Variant MRP values must be greater than zero when entered.';
    if (price !== null && originalPrice !== null && price > originalPrice) return 'A variant selling price cannot exceed its MRP.';
    const combination = dynamicVariantKey(Object.keys(variant?.optionValues || {}).length
      ? variant.optionValues
      : { size: variant?.size || '', color: variant?.color || '' });
    if (!combination) return 'Every variant needs its configured option values.';
    if (combinations.has(combination)) return 'Variant option combinations must be unique.';
    combinations.add(combination);
    const sku = String(variant?.sku || '').trim().toLowerCase();
    if (sku && skus.has(sku)) return 'Variant SKUs must be unique within the product.';
    if (sku) skus.add(sku);
  }
  return '';
}

function focusFormError(formNode, errors = {}) {
  if (!formNode) return;
  let target = null;
  const fields = Array.from(formNode.querySelectorAll('[data-error-field]'));
  for (const field of Object.keys(errors)) {
    if (field === 'sizeChart') {
      target = Array.from(formNode.querySelectorAll('[data-garment-measurement]'))
        .find((input) => !Number.isFinite(Number(input.value)) || Number(input.value) <= 0);
    } else if (field === 'attributes') {
      target = Array.from(formNode.querySelectorAll('[data-required-attribute]'))
        .find((input) => !String(input.value || '').trim());
    }
    target ||= fields.find((item) => item.dataset.errorField === field);
    if (target) break;
  }
  if (!target) return;
  target.scrollIntoView?.({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  const focusTarget = target.matches?.('input, select, textarea, button, [tabindex]')
    ? target
    : target.querySelector?.('input, select, textarea, button, [tabindex]');
  focusTarget?.focus?.({ preventScroll: true });
}

function clearErrors(setter, ...fields) {
  setter((current) => {
    if (!fields.some((field) => current[field])) return current;
    const next = { ...current };
    fields.forEach((field) => delete next[field]);
    return next;
  });
}

function buildDraftPayload(form, overrides = {}) {
  const payload = {
    ...form,
    ...overrides,
    rentalPricing: form.commerceMode === 'SALE_ONLY' ? null : form.rentalPricing,
    images: prepareImages(form.images),
    videos: prepareVideos(form.videos),
    price: Number(form.price || 0),
    sellingPrice: Number(form.price || 0),
    originalPrice: form.commerceMode === 'RENTAL_ONLY' ? Number(form.price || 0) : Number(form.originalPrice || form.price || 0),
    salePrice: form.commerceMode === 'RENTAL_ONLY' ? undefined : form.salePrice ? Number(form.salePrice) : undefined,
    costPrice: Number(form.costPrice || 0),
    gstRate: Number(form.gstRate || 0),
    stock: overrides.stock ?? Number(form.stock || 0),
    lowStockAlert: Number(form.lowStockAlert || 5),
    reorderQuantity: Number(form.reorderQuantity || 0),
    shippingWeightKg: Number(form.shippingWeightKg || 0),
    packageDimensions: {
      lengthCm: Number(form.packageDimensions?.lengthCm || 0),
      widthCm: Number(form.packageDimensions?.widthCm || 0),
      heightCm: Number(form.packageDimensions?.heightCm || 0),
    },
    sizes: overrides.sizes ?? splitList(form.sizes),
    colors: splitList(form.colors),
    tags: splitList(form.tags),
    variants: overrides.variants ?? (form.trackVariants ? form.variants : []),
    restockAt: nullableDate(form.restockAt),
    publishAt: nullableDate(form.publishAt),
    saleStartAt: form.commerceMode === 'RENTAL_ONLY' ? null : nullableDate(form.saleStartAt),
    saleEndAt: form.commerceMode === 'RENTAL_ONLY' ? null : nullableDate(form.saleEndAt),
    returnWindowDays: form.returnWindowDays === '' ? undefined : Number(form.returnWindowDays),
  };
  if (!payload.category) delete payload.category;
  return payload;
}

function formFromServerDraft(draft = {}) {
  return {
    ...emptyProduct,
    ...draft,
    category: draft.category?._id || draft.category || '',
    sizes: listText(draft.sizes),
    colors: listText(draft.colors),
    tags: listText(draft.tags),
    highlights: Array.isArray(draft.highlights) ? draft.highlights : splitList(draft.highlights),
    images: normalizeImageEntries(draft.images || []),
    videos: normalizeVideoEntries(draft.videos || []),
    packageDimensions: { ...emptyProduct.packageDimensions, ...(draft.packageDimensions || {}) },
    restockAt: toDateTimeInput(draft.restockAt),
    publishAt: toDateTimeInput(draft.publishAt),
    saleStartAt: toDateTimeInput(draft.saleStartAt),
    saleEndAt: toDateTimeInput(draft.saleEndAt),
    trackVariants: Array.isArray(draft.variants) && draft.variants.length > 0,
  };
}

function formFromExistingProduct(product = {}) {
  const allowed = Object.keys(emptyProduct).reduce((result, key) => {
    if (product[key] !== undefined) result[key] = product[key];
    return result;
  }, {});
  const variants = (Array.isArray(product.variants) ? product.variants : []).map((variant) => {
    const { _id, id, ...safeVariant } = variant || {};
    return { ...safeVariant, sku: '', stock: 0 };
  });
  return {
    ...emptyProduct,
    ...allowed,
    name: product.name ? `${product.name} copy` : '',
    slug: '',
    sku: '',
    barcode: '',
    category: product.category?._id || product.category || '',
    sizes: listText(product.sizes),
    colors: listText(product.colors),
    tags: listText(product.tags),
    highlights: Array.isArray(product.highlights) ? [...product.highlights] : splitList(product.highlights),
    images: normalizeImageEntries(product.images || []),
    videos: normalizeVideoEntries(product.videos || []),
    packageDimensions: { ...emptyProduct.packageDimensions, ...(product.packageDimensions || {}) },
    attributeValues: { ...(product.attributeValues || {}) },
    stock: 0,
    variants,
    variantOptionValues: readVariantOptionValues(variants),
    trackVariants: variants.length > 0,
    restockAt: '',
    publishAt: '',
    salePrice: '',
    saleStartAt: '',
    saleEndAt: '',
    isFeatured: false,
    isNewArrival: false,
    isBestSeller: false,
    showOnHomepage: false,
    showInTrending: false,
    showInFestive: false,
    isActive: true,
  };
}

function listText(value) {
  return Array.isArray(value) ? value.join(', ') : String(value || '');
}

function calculateChargeableWeight(form = {}) {
  const actual = Math.max(0, Number(form.shippingWeightKg || 0));
  const dimensions = form.packageDimensions || {};
  const volumetric = Math.max(0, Number(dimensions.lengthCm || 0) * Number(dimensions.widthCm || 0) * Number(dimensions.heightCm || 0) / 5000);
  return { actual, volumetric, chargeable: Math.max(actual, volumetric) };
}

function productQuality(form = {}, readiness = {}) {
  const checks = [
    { label: 'Complete the required product details', done: String(form.name || '').trim().length >= 3 && form.category && readiness.pricingReady && readiness.inventoryReady && readiness.sizeChartReady && readiness.requiredAttributesComplete },
    { label: 'Add a stronger customer description', done: String(form.description || '').trim().length >= 50 && String(form.shortDescription || '').trim().length >= 12 },
    { label: 'Add two clear product photos', done: (form.images || []).length >= 2 && (form.images || []).some((image) => image.primary) },
    { label: 'Complete tags and search preview', done: splitList(form.tags).length >= 2 && String(form.metaTitle || '').trim().length >= 10 && String(form.metaDescription || '').trim().length >= 40 },
    { label: 'Add shipping and compliance details', done: Number(form.shippingWeightKg || 0) > 0 && Object.values(form.packageDimensions || {}).every((value) => Number(value) > 0) && Boolean(String(form.countryOfOrigin || '').trim()) },
  ];
  return { score: checks.filter((item) => item.done).length * 20, next: checks.find((item) => !item.done)?.label || '' };
}

function prepareImages(images) {
  const normalized = normalizeImageEntries(images);
  if (!normalized.length) return [];
  if (!normalized.some((image) => image.primary)) {
    normalized[0] = { ...normalized[0], primary: true };
  }
  return normalized.map((image) => ({
    url: image.url,
    publicId: image.publicId,
    ...(image.background ? { background: image.background } : {}),
    primary: Boolean(image.primary),
    ...(image.sourceFrame ? { sourceFrame: image.sourceFrame } : {}),
  }));
}

function updateNested(setter, parent, field, value) {
  setter((current) => ({ ...current, [parent]: { ...(current[parent] || {}), [field]: value } }));
}

function nullableDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toDateTimeInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function getDraftKey(productId, apiPrefix = '/admin') {
  return `${DRAFT_PREFIX}${apiPrefix === '/admin' ? '' : ':' + apiPrefix}:${productId || 'new'}`;
}

function readDraft(productId, apiPrefix) {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(getDraftKey(productId, apiPrefix));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function draftFormOf(record) {
  return record?.__draftMeta && record.form && typeof record.form === 'object' ? record.form : record;
}

function readDraftForm(productId, apiPrefix) {
  return draftFormOf(readDraft(productId, apiPrefix));
}

function clearDraft(productId, apiPrefix) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(getDraftKey(productId, apiPrefix));
  } catch {
    // ignore storage errors
  }
}

function prepareVideos(videos) {
  const normalized = normalizeVideoEntries(videos).slice(0, 2);
  return normalized.map((video) => ({
    url: video.url,
    publicId: video.publicId,
    thumbnail: video.thumbnail,
  }));
}

function mergeDraftIntoProduct(draft) {
  if (!draft || typeof draft !== 'object') return {};
  if (!isMeaningfulDraft(draft)) return {};

  const merged = {};
  for (const [key, value] of Object.entries(draft)) {
    if (key === 'images') {
      if (Array.isArray(value) && value.length) merged.images = value;
      continue;
    }

    if (Array.isArray(value)) {
      if (value.length) merged[key] = value;
      continue;
    }

    if (typeof value === 'string') {
      if (value.trim()) merged[key] = value;
      continue;
    }

    if (typeof value === 'boolean') {
      merged[key] = value;
      continue;
    }

    if (typeof value === 'number') {
      if (!Number.isNaN(value)) merged[key] = value;
      continue;
    }

    if (value && typeof value === 'object') {
      merged[key] = value;
    }
  }

  return merged;
}

function withCategoryName(form, categories = []) {
  const selected = categories.find((category) => String(category._id) === String(form.category));
  return { ...form, category: selected?.name || form.category || '' };
}

function isMeaningfulDraft(draft) {
  return Object.entries(draft).some(([key, value]) => {
    const defaultValue = emptyProduct[key];

    if (Array.isArray(value)) {
      if (key === 'highlights') {
        return JSON.stringify(value) !== JSON.stringify(defaultValue);
      }
      return value.length > 0;
    }

    if (typeof value === 'string') {
      if (key === 'brand') return value.trim() !== String(defaultValue || '').trim();
      return value.trim().length > 0;
    }

    if (typeof value === 'boolean') {
      return value !== defaultValue;
    }

    if (typeof value === 'number') {
      return !Number.isNaN(value) && value !== defaultValue;
    }

    if (value && typeof value === 'object') {
      return JSON.stringify(value) !== JSON.stringify(defaultValue);
    }

    return false;
  });
}
