import { memo, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, Search, Shirt, Sparkles } from 'lucide-react';
import {
  applyBrandColor, applyFontPair, applyLayoutStyle, FONT_PAIRS, LAYOUT_STYLES,
  improveThemeReadability, matchMobileAppearance, searchDesignerControls, themeReadability,
} from '../../config/websiteDesignerTools';
import { mergeWebsiteConfig } from '../../config/websiteCustomization';
import './WebsiteDesignerTools.css';

export function DesignerControlSearch({ onSelect }) {
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchDesignerControls(query), [query]);
  return <div className="designer-finder">
    <label className="designer-finder__input"><Search size={16} aria-hidden="true" /><input aria-label="Find a design setting" placeholder="Find a setting: logo, spacing, mobile…" value={query} maxLength={100} onChange={(event) => setQuery(event.target.value)} /></label>
    {query.trim() && <div className="designer-finder__results" aria-label="Matching settings">
      {results.map((item) => <button type="button" key={item.id} onClick={() => { onSelect(item.id); setQuery(''); }}><span>{item.label}</span><ArrowRight size={14} aria-hidden="true" /></button>)}
      {!results.length && <p>No matching settings. Try “logo”, “spacing” or “products”.</p>}
    </div>}
  </div>;
}

export const PresetGallery = memo(function PresetGallery({ presets, currentPreset, onApply }) {
  const [collection, setCollection] = useState('All');
  const [search, setSearch] = useState('');
  const [includeMobile, setIncludeMobile] = useState(false);
  const collections = useMemo(() => ['All', ...new Set(presets.map((item) => item.collection || 'Signature'))], [presets]);
  const filtered = useMemo(() => presets.filter((item) =>
    (collection === 'All' || (item.collection || 'Signature') === collection) &&
    `${item.name} ${item.description || ''}`.toLowerCase().includes(search.trim().toLowerCase())), [presets, collection, search]);
  return <div className="designer-gallery">
    <div className="designer-tools-heading"><span className="designer-eyebrow"><Sparkles size={14} />Curated for your store</span><h2>Find your signature look</h2><p>Coordinated colors, type, buttons and cards. Apply to your draft, then make it your own.</p></div>
    <div className="designer-gallery__toolbar">
      <input aria-label="Search presets" placeholder="Search looks…" value={search} maxLength={100} onChange={(event) => setSearch(event.target.value)} />
      <label><input type="checkbox" checked={includeMobile} onChange={(event) => setIncludeMobile(event.target.checked)} />Also match mobile card corners</label>
    </div>
    <div className="designer-gallery__filters" aria-label="Preset collections">{collections.map((item) => <button type="button" key={item} aria-pressed={collection === item} onClick={() => setCollection(item)}>{item}</button>)}</div>
    <p className="designer-help">Published colours apply to desktop, mobile, loaders and admin. {includeMobile ? 'Mobile card corners also match; columns, images and section order stay unchanged.' : 'Mobile layout stays unchanged.'} Your logo, content, links and product selections are kept.</p>
    <div className="designer-gallery__grid">{filtered.map((preset) => <PresetCard key={preset.id} preset={preset} selected={currentPreset === preset.id} onApply={onApply} includeMobile={includeMobile} />)}</div>
    {!filtered.length && <p className="designer-empty">No matching presets. <button type="button" onClick={() => { setSearch(''); setCollection('All'); }}>Clear filters</button></p>}
    <p className="designer-help">{filtered.length} of {presets.length} looks · Every preset is editable · Use Undo to try another</p>
  </div>;
});

const PresetCard = memo(function PresetCard({ preset, selected, onApply, includeMobile }) {
  const config = useMemo(() => mergeWebsiteConfig(preset.config), [preset.config]);
  const { colors, productCards, typography, buttons, header } = config;
  return <button type="button" className={`designer-preset${selected ? ' designer-preset--selected' : ''}`} aria-label={`Apply ${preset.name}`} aria-pressed={selected} disabled={!preset.config} onClick={() => onApply(preset, includeMobile)}>
    <div className="designer-preset__preview" aria-hidden="true" style={{ background: colors.background, color: colors.text }}>
      <div className="designer-preset__announcement" style={{ background: header.announcementBackground }} />
      <div className="designer-preset__nav" style={{ color: header.textColor, background: header.background }}><span>YOUR STORE</span><span>— &nbsp; — &nbsp; —</span></div>
      <div className="designer-preset__hero" style={{ background: colors.secondary }}><div><span className="designer-preset__eyebrow" style={{ color: colors.primary }}>THE NEW EDIT</span><strong style={{ fontFamily: typography.headingFont, fontWeight: typography.headingWeight }}>Everyday,<br />beautifully.</strong><span className="designer-preset__cta" style={{ background: buttons.style === 'solid' ? buttons.background : colors.secondary, color: buttons.style === 'solid' ? buttons.textColor : colors.primary, border: `1px solid ${buttons.background}`, borderRadius: Math.min(buttons.borderRadius, 16) }}>Explore</span></div><Shirt style={{ color: colors.primary }} strokeWidth={0.65} /></div>
      <div className="designer-preset__products">{[0, 1, 2].map((item) => <div key={item} style={{ borderRadius: Math.min(productCards.borderRadius, 12), background: colors.surface }}><div style={{ background: item === 1 ? colors.secondary : `${colors.accent}22`, borderRadius: Math.min(productCards.borderRadius, 12) }}><Shirt size={21} style={{ color: colors.primary }} strokeWidth={0.8} /></div><span style={{ background: colors.text }} /><span style={{ background: colors.mutedText }} /></div>)}</div>
    </div>
    <div className="designer-preset__details"><div><span className="designer-eyebrow">{preset.collection || 'Signature'}</span><h3>{preset.name}</h3></div>{selected && <Check size={17} aria-hidden="true" />}<p>{preset.description}</p><div className="designer-preset__swatches" aria-hidden="true">{Object.values(preset.swatches || {}).map((color, index) => <span key={index} style={{ background: color }} />)}</div><span className="designer-preset__apply">Apply look <ArrowRight size={14} aria-hidden="true" /></span></div>
  </button>;
});

export function QuickStylePanel({ draft, replace, onSelect }) {
  const [brandColor, setBrandColor] = useState(draft.colors.primary);
  useEffect(() => setBrandColor(draft.colors.primary), [draft.colors.primary]);
  const validColor = /^#[0-9a-f]{6}$/i.test(brandColor);
  return <div className="designer-quick">
    <div className="designer-tools-heading"><span className="designer-eyebrow"><Sparkles size={14} />Make it yours</span><h2>A few choices. A complete look.</h2><p>Apply coordinated changes in one step. Everything stays in this draft until you publish.</p></div>
    <section className="designer-tool-section"><h3>Your signature color</h3><p>Coordinate primary accents, buttons, announcement and footer colors, with contrasting button and footer text.</p><div className="designer-brand-color"><input type="color" aria-label="Signature color picker" value={validColor ? brandColor : '#000000'} onChange={(event) => setBrandColor(event.target.value)} /><input aria-label="Signature color hex" value={brandColor} maxLength={7} onChange={(event) => setBrandColor(event.target.value)} /><button type="button" disabled={!validColor} onClick={() => replace(applyBrandColor(draft, brandColor))}>Apply brand color</button></div></section>
    <section className="designer-tool-section"><h3>Typography pairings</h3><p>Choose complementary heading and body fonts for desktop.</p><div className="designer-choice-grid">{FONT_PAIRS.map((pair) => <button type="button" key={pair.id} onClick={() => replace(applyFontPair(draft, pair.id))}><strong style={{ fontFamily: pair.heading, fontWeight: pair.weight }}>{pair.name}</strong><span>{pair.note}</span></button>)}</div></section>
    <section className="designer-tool-section"><h3>Desktop layout rhythm</h3><p>Set product columns, spacing and content width together.</p><div className="designer-choice-grid">{LAYOUT_STYLES.map((layout) => <button type="button" key={layout.id} onClick={() => replace(applyLayoutStyle(draft, layout.id))}><span className="designer-density" aria-hidden="true">{Array.from({ length: layout.columns }, (_, index) => <i key={index} />)}</span><strong>{layout.name}</strong><span>{layout.note}</span></button>)}</div></section>
    <section className="designer-tool-section designer-mobile-match"><div><h3>One brand, every screen</h3><p>Match the desktop palette and card corners on mobile. Keeps your mobile columns, image ratio, content and section order.</p></div><button type="button" onClick={() => replace(matchMobileAppearance(draft))}>Match mobile appearance</button><small>Enables mobile overrides. You can fine-tune them in the Mobile tab.</small></section>
    <ReadabilityReview draft={draft} replace={replace} onSelect={onSelect} />
  </div>;
}

export function ReadabilityReview({ draft, replace, onSelect }) {
  const checks = useMemo(() => themeReadability(draft), [draft]);
  const flagged = checks.filter((item) => item.needsAttention);
  const canImprove = flagged.some((item) => item.suggestedText);
  return <section className="designer-tool-section"><h3>Readability check</h3><p>Checks flat theme colors against a 4.5:1 text contrast target. Check text over photographs and store-setting overrides in the preview too.</p>
    <div className="designer-readability">{checks.map((item) => <div key={item.label}><span>{item.label}</span><span className={item.needsAttention ? 'designer-readability__warning' : 'designer-readability__good'}>{item.ratio === null ? 'Finish color' : `${item.ratio.toFixed(1)}:1`}{item.needsAttention ? ' · Review' : ' · Good'}</span>{item.needsAttention && <button type="button" onClick={() => onSelect(item.tab)}>Edit<span className="sr-only"> {item.label}</span></button>}</div>)}</div>
    {canImprove && <button type="button" className="designer-inline-action" onClick={() => replace(improveThemeReadability(draft))}>Improve text contrast</button>}
    {!!flagged.length && <p className="designer-help">You can still save and publish. Automatic improvement changes text colors only; review accents and image backgrounds separately.</p>}
  </section>;
}
