import React, { useMemo, useState } from 'react';
import { Order, StoreSettings, Customer } from '../types';
import { loadCustomers } from '../services/customerService';
import { buildMembershipScanUrl } from '../services/membershipService';
import { QRCodeMembership } from './QRCodeMembership';
import { Barcode128 } from './Barcode128';
import { getExternalBarcodeSvgUrl } from '../services/codeGeneratorService';

interface PrintReceiptProps { order: Order | null; settings: StoreSettings; }

const ExternalMembershipBarcode: React.FC<{ value: string }> = ({ value }) => {
  const [failed, setFailed] = useState(false);
  if (failed) return <Barcode128 value={value} height={46} moduleWidth={1.15} className="max-w-full" />;
  return (
    <img
      src={getExternalBarcodeSvgUrl(value, 900, 220)}
      alt="Barcode Membership YUPOS"
      className="block w-[88%] max-w-[330px] h-auto mx-auto mt-2"
      onError={() => setFailed(true)}
      draggable={false}
    />
  );
};

export const PrintReceipt: React.FC<PrintReceiptProps> = ({ order, settings }) => {
  const memberCustomer = useMemo<Customer | null>(() => {
    if (!order || settings.businessType !== 'barbershop' || !order.customerIsMember || !order.customerCode) return null;
    try { return loadCustomers(order.merchantId || 'default_merchant').find((customer) => customer.customerCode === order.customerCode) || null; }
    catch { return null; }
  }, [order, settings.businessType]);

  if (!order) return null;
  const formatRp = (num: number) => 'Rp ' + num.toLocaleString('id-ID');
  const cashier = order.shift === '1' ? settings.shift1Name : settings.shift2Name;
  const membershipQrValue = memberCustomer ? buildMembershipScanUrl(memberCustomer) : '';
  const membershipBarcodeValue = memberCustomer?.customerCode || '';

  return <div id="print-receipt-portal" className="hidden print:block text-black bg-white">
    <div className="text-center leading-relaxed">
      {settings.logoBase64 && <img src={settings.logoBase64} alt="Logo" className="w-24 h-auto mx-auto mb-2 object-contain" />}
      <h2 className="text-sm font-black uppercase tracking-wider mb-1">{settings.storeName}</h2>
      {settings.storeAddress && <p className="text-[10px] leading-relaxed mb-0.5">{settings.storeAddress}</p>}
      {settings.storePhone && <p className="text-[10px] leading-relaxed">Telp: {settings.storePhone}</p>}
      <div className="border-b border-dashed border-black my-2" />
    </div>

    <div className="text-[10px] leading-relaxed space-y-1.5">
      <div className="flex justify-between"><span>{order.date} {order.time}</span><span>ID: {order.id}</span></div>
      <div>Kasir: {cashier || 'Kasir'} (S{order.shift})</div>
      <div className="font-bold">Pelanggan: {order.customer || '-'}</div>
      <div className="border-b border-dashed border-black my-2" />
    </div>

    <div className="text-[10px] leading-relaxed space-y-2 my-2">
      {order.items.map((item, idx) => (
        <div key={idx} className="pb-1">
          <div className="flex justify-between gap-3">
            <span className="font-bold">{item.name} {item.assignedTo ? `[${item.assignedTo}]` : ''}</span>
            <span className="shrink-0">{formatRp(item.price * item.qty)}</span>
          </div>
          <div className="flex justify-between text-[9px] text-gray-700 pl-1 mt-0.5"><span>{item.qty} x {formatRp(item.price)}</span></div>
          {item.note && <p className="text-[9px] italic text-gray-600 pl-1 mt-0.5">* {item.note}</p>}
        </div>
      ))}
    </div>

    <div className="border-t border-dashed border-black pt-2 text-[10px] leading-relaxed space-y-1.5">
      {(order.discount > 0 || (order.ppn && order.ppn > 0)) && <div className="flex justify-between"><span>Subtotal</span><span>{formatRp(order.subtotal || order.total)}</span></div>}
      {order.discount > 0 && <div className="flex justify-between"><span>Diskon</span><span>- {formatRp(order.discount)}</span></div>}
      {order.ppn && order.ppn > 0 ? <div className="flex justify-between"><span>PPN ({order.ppnRate || 11}%)</span><span>+ {formatRp(order.ppn)}</span></div> : null}
      <div className="flex justify-between font-black text-xs pt-1"><span>TOTAL</span><span>{formatRp(order.total)}</span></div>
      <div className="flex justify-between pt-1"><span>Metode Bayar</span><span className="font-bold uppercase">{order.payment}</span></div>
      <div className="border-b border-dashed border-black my-2" />
    </div>

    {memberCustomer && membershipQrValue && (
      <div className="text-center pt-2 pb-2 leading-relaxed">
        <p className="text-[9px] font-black uppercase tracking-wider mb-1">Membership Customer</p>
        <p className="text-[8px] leading-relaxed mb-1.5">Scan QR untuk cek kunjungan &amp; reward membership</p>
        <div className="flex justify-center overflow-hidden mb-1.5"><QRCodeMembership value={membershipQrValue} size={150} /></div>
        {membershipBarcodeValue && <ExternalMembershipBarcode value={membershipBarcodeValue} />}
        <p className="text-[8px] font-mono mt-1.5">{memberCustomer.customerCode} • {memberCustomer.visitCount}/10 KUNJUNGAN</p>
      </div>
    )}

    <div className="text-center text-[9px] pt-2 whitespace-pre-line leading-relaxed">{settings.footer}</div>
    <div className="text-center text-[8px] pt-1 leading-relaxed">Powered by YUPOS</div>
  </div>;
};
