import React from 'react';
import { Order, StoreSettings } from '../types';

interface PrintReceiptProps {
  order: Order | null;
  settings: StoreSettings;
}

export const PrintReceipt: React.FC<PrintReceiptProps> = ({ order, settings }) => {
  if (!order) return null;

  const formatRp = (num: number) => {
    return 'Rp ' + num.toLocaleString('id-ID');
  };

  const cashier = order.shift === '1' ? settings.shift1Name : settings.shift2Name;

  return (
    <div id="print-receipt-portal" className="hidden print:block text-black bg-white">
      {/* Store Header */}
      <div className="text-center">
        {settings.logoBase64 && (
          <img
            src={settings.logoBase64}
            alt="Logo"
            className="w-24 h-auto mx-auto mb-1 object-contain"
          />
        )}
        <h2 className="text-sm font-black uppercase tracking-wider">{settings.storeName}</h2>
        {settings.storeAddress && (
          <p className="text-[10px] leading-tight">{settings.storeAddress}</p>
        )}
        {settings.storePhone && (
          <p className="text-[10px] leading-tight">Telp: {settings.storePhone}</p>
        )}
        <div className="border-b border-dashed border-black my-1.5" />
      </div>

      {/* Meta */}
      <div className="text-[10px] space-y-0.5">
        <div className="flex justify-between">
          <span>{order.date} {order.time}</span>
          <span>ID: {order.id}</span>
        </div>
        <div className="flex justify-between">
          <span>Kasir: {cashier || 'Kasir'} (S{order.shift})</span>
        </div>
        <div className="flex justify-between font-bold">
          <span>Pelanggan: {order.customer || '-'}</span>
        </div>
        <div className="border-b border-dashed border-black my-1.5" />
      </div>

      {/* Items list */}
      <div className="text-[10px] space-y-1 my-1.5">
        {order.items.map((item, idx) => (
          <div key={idx}>
            <div className="flex justify-between">
              <span className="font-bold">
                {item.name} {item.assignedTo ? `[${item.assignedTo}]` : ''}
              </span>
              <span>{formatRp(item.price * item.qty)}</span>
            </div>
            <div className="flex justify-between text-[9px] text-gray-700 pl-1">
              <span>{item.qty} x {formatRp(item.price)}</span>
            </div>
            {item.note && (
              <p className="text-[9px] italic text-gray-600 pl-1">* {item.note}</p>
            )}
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="border-t border-dashed border-black pt-1.5 text-[10px] space-y-0.5">
        {(order.discount > 0 || (order.ppn && order.ppn > 0)) && (
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatRp(order.subtotal || order.total)}</span>
          </div>
        )}
        {order.discount > 0 && (
          <div className="flex justify-between">
            <span>Diskon</span>
            <span>- {formatRp(order.discount)}</span>
          </div>
        )}
        {order.ppn && order.ppn > 0 ? (
          <div className="flex justify-between">
            <span>PPN ({order.ppnRate || 11}%)</span>
            <span>+ {formatRp(order.ppn)}</span>
          </div>
        ) : null}
        <div className="flex justify-between font-black text-xs pt-0.5">
          <span>TOTAL</span>
          <span>{formatRp(order.total)}</span>
        </div>
        <div className="flex justify-between pt-0.5">
          <span>Metode Bayar</span>
          <span className="font-bold uppercase">{order.payment}</span>
        </div>
        <div className="border-b border-dashed border-black my-1.5" />
      </div>

      {/* Footer */}
      <div className="text-center text-[9px] pt-1 whitespace-pre-line leading-tight">
        {settings.footer}
      </div>
    </div>
  );
};
