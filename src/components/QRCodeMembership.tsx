import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { getExternalQrSvgUrl } from '../services/codeGeneratorService';

interface QRCodeMembershipProps {
  value: string;
  size?: number;
  className?: string;
}

export const QRCodeMembership: React.FC<QRCodeMembershipProps> = ({ value, size = 180, className = '' }) => {
  const [externalFailed, setExternalFailed] = useState(false);
  const [svg, setSvg] = useState('');

  useEffect(() => {
    let active = true;
    setExternalFailed(false);
    setSvg('');
    QRCode.toString(value, {
      type: 'svg',
      width: size,
      margin: 4,
      errorCorrectionLevel: 'H',
      color: { dark: '#000000', light: '#ffffff' },
    }).then((result) => {
      if (active) setSvg(result);
    }).catch(() => {
      if (active) setSvg('');
    });
    return () => { active = false; };
  }, [value, size]);

  const externalUrl = getExternalQrSvgUrl(value, Math.max(600, size * 3));

  if (!externalFailed) {
    return (
      <div className={`bg-white p-1 ${className}`} style={{ width: size, height: size }} aria-label="QR Membership YUPOS">
        <img
          src={externalUrl}
          alt="QR Membership YUPOS"
          width={size - 8}
          height={size - 8}
          className="block w-full h-full object-contain"
          onError={() => setExternalFailed(true)}
          draggable={false}
        />
      </div>
    );
  }

  if (!svg) return <div aria-hidden="true" style={{ width: size, height: size }} />;

  return (
    <div
      className={`bg-white p-1 ${className}`}
      style={{ width: size, height: size }}
      aria-label="QR Membership YUPOS"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};
