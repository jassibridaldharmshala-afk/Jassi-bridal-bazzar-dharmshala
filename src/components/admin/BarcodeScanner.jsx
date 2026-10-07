import { Camera, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export default function BarcodeScanner({ disabled = false, onDetected }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const frameRef = useRef(0);
  const detectedRef = useRef(onDetected);

  useEffect(() => { detectedRef.current = onDetected; }, [onDetected]);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia || typeof window.BarcodeDetector !== 'function') {
        setMessage('Camera barcode scanning is not supported in this browser. Enter the code manually.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (cancelled) { stream.getTracks().forEach((track) => track.stop()); return; }
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code'] });
        const scan = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const results = await detector.detect(videoRef.current);
            const value = String(results?.[0]?.rawValue || '').trim();
            if (value) { detectedRef.current?.(value); setOpen(false); return; }
          } catch {
            // A video frame may not be ready yet; keep scanning.
          }
          frameRef.current = window.requestAnimationFrame(scan);
        };
        scan();
      } catch {
        setMessage('Camera permission was not granted. Enter the barcode manually or allow camera access.');
      }
    };
    start();
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameRef.current);
      streamRef.current?.getTracks?.().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [open]);

  return <>
    <button type="button" disabled={disabled} onClick={() => { setMessage(''); setOpen(true); }} className="admin-btn-ghost product-barcode-button"><Camera size={16} />Scan barcode</button>
    {open && <div className="product-preview-overlay" role="dialog" aria-modal="true" aria-labelledby="barcode-scanner-title">
      <div className="product-barcode-modal">
        <header><div><p>Camera scanner</p><h2 id="barcode-scanner-title">Scan product barcode</h2></div><button type="button" onClick={() => setOpen(false)} aria-label="Close scanner"><X /></button></header>
        <div className="product-barcode-camera"><video ref={videoRef} muted playsInline /><span /></div>
        <p role={message ? 'alert' : 'status'}>{message || 'Place the barcode inside the frame. It will be filled automatically.'}</p>
        <button type="button" className="admin-btn-ghost" onClick={() => setOpen(false)}>Enter manually</button>
      </div>
    </div>}
  </>;
}
