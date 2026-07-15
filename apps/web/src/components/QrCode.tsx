'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export function QrCode({ value, size = 220 }: { value: string; size?: number }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    QRCode.toDataURL(value, { width: size, margin: 1, errorCorrectionLevel: 'M' })
      .then(setUrl)
      .catch(() => setUrl(''));
  }, [value, size]);
  if (!url) return <div className="grid place-items-center bg-white" style={{ width: size, height: size }}><span className="text-xs text-black/50">…</span></div>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="QR code" width={size} height={size} className="rounded-lg bg-white p-2" />;
}
