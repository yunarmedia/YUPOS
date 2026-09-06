import React, { useMemo } from 'react';
import { Order, StoreSettings, Customer } from '../types';
import { loadCustomers } from '../services/customerService';
import { buildMembershipScanUrl } from '../services/membershipService';
import { QRCodeMembership } from './QRCodeMembership';

interface PrintReceiptProps { order: Order | null; settings: StoreSettings; }

export const PrintReceipt: React.FC<PrintReceiptProps> = ({ order, settings }) => {
  const memberCustomer = useMemo<Customer | null>(() => {
    if (!order || settings.businessType !== 'barbershop' || !order.customerIsMember || !order.customerCode) return null;
    try { return loadCustomers(order.merchantId || 'default_merchant').find((customer) => customer.customerCode === order.customerCode) || null; }
    catch { return null; }
  }, [order, settings.businessType]);

  if (!order) return null;
  const formatRp = (num: number) => 'Rp ' + (num || 0).toLocaleString('id-ID');
  const cashier = order.cashierName || (order.shift === '1' ? settings.shift1Name : settings.shift2Name) || 'Kasir';
  const membershipQrValue = memberCustomer ? buildMembershipScanUrl(memberCustomer) : '';
  const paperClass = settings.printerPaperWidth === '80mm' ? 'yupos-receipt-80' : 'yupos-receipt-58';

  return <div id="print-receipt-portal" className={`hidden print:block ${paperClass} text-black bg-white`}>
    <div className="yupos-receipt-header text-center">
      {settings.logoBase64 && <img src={settings.logoBase64} alt="Logo" className="yupos-receipt-logo mx-auto object-contain" />}
      <h2 className="yupos-receipt-store">{settings.storeName}</h2>
      {settings.storeAddress && <p>{settings.storeAddress}</p>}
      {settings.storePhone && <p>Telp: {settings.storePhone}</p>}
      <div className="yupos-receipt-divider" />
    </div>

    <div className="yupos-receipt-meta">
      <div className="yupos-receipt-row"><span>{order.date} {order.time}</span><span>ID: {order.id}</span></div>
      <div>Kasir: {cashier} (S{order.shift})</div>
      {order.customer && order.customer !== 'Pelanggan' && <div className="font-bold">Pelanggan: {order.customer}{order.customerCode ? ` [${order.customerCode}]` : ''}</div>}
      <div className="yupos-receipt-divider" />
    </div>

    <div className="yupos-receipt-items">
      {order.items.map((item, idx) => (
        <div key={idx} className="yupos-receipt-item">
          <div className="yupos-receipt-row gap-2">
            <span className="font-bold">{item.name}{item.assignedTo ? ` [${item.assignedTo}]` : ''}</span>
            <span className="shrink-0">{formatRp(item.price * item.qty)}</span>
          </div>
          <div className="yupos-receipt-subrow">{item.qty} x {formatRp(item.price)}</div>
          {item.note && <div className="yupos-receipt-note">* {item.note}</div>}
        </div>
      ))}
    </div>

    <div className="yupos-receipt-totals">
      <div className="yupos-receipt-divider" />
      <div className="yupos-receipt-row"><span>Subtotal</span><span>{formatRp(order.subtotal || order.total)}</span></div>
      {order.discount > 0 && <div className="yupos-receipt-row"><span>Diskon</span><span>- {formatRp(order.discount)}</span></div>}
      {order.ppn && order.ppn > 0 ? <div className="yupos-receipt-row"><span>PPN ({order.ppnRate || 11}%)</span><span>+ {formatRp(order.ppn)}</span></div> : null}
      <div className="yupos-receipt-total yupos-receipt-row"><span>TOTAL</span><span>{formatRp(order.total)}</span></div>
      <div className="yupos-receipt-row"><span>Metode Bayar</span><span className="font-bold uppercase">{order.payment}</span></div>
    </div>

    {memberCustomer && membershipQrValue && (
      <div className="yupos-membership-print text-center">
        <div className="yupos-receipt-divider" />
        <p className="yupos-membership-title">MEMBERSHIP CUSTOMER</p>
        <p className="yupos-membership-hint">Scan QR untuk cek kunjungan<br />&amp; reward membership</p>
        <div className="yupos-membership-qr"><QRCodeMembership value={membershipQrValue} size={settings.printerPaperWidth === '80mm' ? 300 : 260} /></div>
        <p className="yupos-membership-code">{memberCustomer.customerCode} • {memberCustomer.visitCount}/10 KUNJUNGAN</p>
      </div>
    )}

    <div className="yupos-receipt-footer">
      <div className="yupos-receipt-divider" />
      <div className="yupos-footer-message">{settings.footer || 'Terima kasih atas kunjungan Anda!'}</div>
      <div className="yupos-powered">Powered by YUPOS</div>
    </div>
  </div>;
};
