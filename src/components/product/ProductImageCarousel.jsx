import { useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { normalizeImageEntries, normalizeImageUrl } from '../../services/normalize';
import { ProductVisual } from './ProductVisual';

export default function ProductImageCarousel({
  product,
  className = 'aspect-[4/5] w-full rounded-[18px]',
  onOpen,
  children,
  priority = false,
}) {
  const images = useMemo(() => normalizeImageEntries(product?.images || []), [product?.images]);
  const hasMultiple = images.length > 1;
  const galleryKey = images.map((image) => image.url).join('\n');
  const [selection, setSelection] = useState({ key: '', index: 0, visited: [0] });
  const current = selection.key === galleryKey ? selection : { index: 0, visited: [0] };
  const index = current.index;
  const visited = current.visited;
  const pointerState = useRef({ startX: 0, startY: 0, deltaX: 0, deltaY: 0, swiping: false, pointerId: null });

  const goTo = (nextIndex) => {
    if (!images.length) return;
    const total = images.length;
    const next = (nextIndex + total) % total;
    setSelection((previous) => ({
      key: galleryKey, index: next,
      visited: [...new Set([...(previous.key === galleryKey ? previous.visited : [0]), next])],
    }));
  };

  const handleTouchStart = (event) => {
    const touch = event.touches[0];
    pointerState.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      deltaX: 0,
      deltaY: 0,
      swiping: false,
      pointerId: null,
    };
  };

  const handleTouchMove = (event) => {
    const touch = event.touches[0];
    const deltaX = touch.clientX - pointerState.current.startX;
    const deltaY = touch.clientY - pointerState.current.startY;
    pointerState.current.deltaX = deltaX;
    pointerState.current.deltaY = deltaY;
    if (Math.abs(deltaX) > Math.abs(deltaY) + 8) {
      pointerState.current.swiping = true;
    }
  };

  const handleTouchEnd = () => {
    if (!hasMultiple) return;
    const { deltaX, swiping } = pointerState.current;
    if (!swiping || Math.abs(deltaX) < 40) return;
    if (deltaX < 0) goTo(index + 1);
    else goTo(index - 1);
  };

  const handlePointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    pointerState.current = {
      startX: event.clientX,
      startY: event.clientY,
      deltaX: 0,
      deltaY: 0,
      swiping: false,
      pointerId: event.pointerId,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event) => {
    if (pointerState.current.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - pointerState.current.startX;
    const deltaY = event.clientY - pointerState.current.startY;
    pointerState.current.deltaX = deltaX;
    pointerState.current.deltaY = deltaY;
    if (Math.abs(deltaX) > Math.abs(deltaY) + 8) {
      pointerState.current.swiping = true;
    }
  };

  const handlePointerUp = (event) => {
    if (pointerState.current.pointerId !== event.pointerId) return;
    if (!hasMultiple) {
      pointerState.current.pointerId = null;
      return;
    }
    const { deltaX, swiping } = pointerState.current;
    if (swiping && Math.abs(deltaX) >= 40) {
      goTo(deltaX < 0 ? index + 1 : index - 1);
    }
    pointerState.current.pointerId = null;
  };

  const handleClick = () => {
    if (pointerState.current.swiping && Math.abs(pointerState.current.deltaX) > 8) {
      pointerState.current.swiping = false;
      return;
    }
    onOpen?.();
  };

  return (
    <div
      className={`relative overflow-hidden bg-[#f6efe8] ${className}`}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        pointerState.current.pointerId = null;
        pointerState.current.swiping = false;
      }}
      style={{ touchAction: 'pan-y' }}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen?.();
        }
      }}
      aria-label={`View ${product?.name || 'product'}`}
    >
      {images.length ? (
        <>
          <div
            className="flex h-full w-full transition-transform duration-300 ease-out"
            style={{ transform: `translateX(-${index * 100}%)` }}
          >
            {images.map((image, imageIndex) => (
              <div key={`${image.url}-${imageIndex}`} className="h-full w-full shrink-0">
                {visited.includes(imageIndex) && <img
                  src={normalizeImageUrl(image.url)}
                  alt={product?.name || 'Product'}
                  className="h-full w-full object-cover object-center"
                  loading={priority && imageIndex === 0 ? 'eager' : 'lazy'}
                  fetchPriority={priority && imageIndex === 0 ? 'high' : 'auto'}
                  decoding="async"
                  draggable="false"
                />}
              </div>
            ))}
          </div>

          {hasMultiple && (
            <>
              <div className="sc-gallery__dots pointer-events-none absolute inset-x-0 bottom-2 z-10 flex justify-center gap-1.5">
                {images.map((image, dotIndex) => (
                  <span
                    key={`${image.url}-dot-${dotIndex}`}
                    className={`h-1.5 rounded-full transition-all ${dotIndex === index ? 'w-4 bg-white' : 'w-1.5 bg-white/65'}`}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  goTo(index - 1);
                }}
                className="absolute left-2 top-1/2 hidden h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-white/92 text-charcoal shadow-sm md:grid"
                aria-label="Previous image"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  goTo(index + 1);
                }}
                className="absolute right-2 top-1/2 hidden h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-white/92 text-charcoal shadow-sm md:grid"
                aria-label="Next image"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}
        </>
      ) : (
        <ProductVisual product={product} compact={false} showMeta={false} />
      )}

      {children}
    </div>
  );
}
