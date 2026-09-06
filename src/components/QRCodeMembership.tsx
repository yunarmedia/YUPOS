import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QRCodeMembershipProps {
  value: string;
  size?: number;
  className?: string;
}

export const QRCodeMembership: React.FC<QRCodeMembershipProps> = ({ value, size = 220, className = '' }) => {
  const [svg, setSvg] = useState('');

  useEffect(() => {
    let active = true;
    setSvg('');
    QRCode.toString(value, {
      type: 'svg',
      width: size,
      margin: 4,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    }).then((result) => {
      if (active) setSvg(result);
    }).catch(() => {
      if (active) setSvg('');
    });
    return () => { active = false; };
  }, [value, size]);

  if (!svg) return <div aria-hidden="true" style={{ width: size, height: size }} />;

  return (
    <div
      className={`bg-white ${className}`}
      style={{ width: size, height: size, padding: 0 }}
      aria-label="QR Membership YUPOS"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};
