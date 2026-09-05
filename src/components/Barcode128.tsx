import React, { useMemo } from 'react';
import { getCode128Bars } from '../services/barcodeService';

interface Barcode128Props {
  value: string;
  height?: number;
  moduleWidth?: number;
  className?: string;
}

export const Barcode128: React.FC<Barcode128Props> = ({ value, height = 58, moduleWidth = 1.4, className = '' }) => {
  const bars = useMemo(() => getCode128Bars(value), [value]);
  const totalModules = bars.length ? bars[bars.length - 1].x + bars[bars.length - 1].width : 1;
  const width = totalModules * moduleWidth;
  return (
    <svg className={className} width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Barcode membership" preserveAspectRatio="xMidYMid meet">
      <rect width={width} height={height} fill="white" />
      {bars.filter((bar) => bar.black).map((bar, index) => (
        <rect key={index} x={bar.x * moduleWidth} y={0} width={bar.width * moduleWidth} height={height} fill="black" />
      ))}
    </svg>
  );
};
