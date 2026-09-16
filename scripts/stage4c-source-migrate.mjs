import fs from 'node:fs';

function replaceOnce(file, from, to, label) {
  const source = fs.readFileSync(file, 'utf8');
  if (!source.includes(from)) throw new Error(`Stage 4C pattern not found: ${label}`);
  fs.writeFileSync(file, source.replace(from, to));
}

const app = 'src/App.tsx';

replaceOnce(app,
`  // Customizable Auto-shift scheduler (consumes custom hours shift1Start/End & shift2Start/End)
  useEffect(() => {
    const checkShift = () => {
      if (settings.manualOverride) return;

      const now = new Date();
      const curTime = \`${'${String(now.getHours()).padStart(2, \'0\')}:${String(now.getMinutes()).padStart(2, \'0\')}' }\`;
      const s1Start = settings.shift1Start || '10:00';
      const s1End = settings.shift1End || '13:00';

      const inShift1 = isTimeWithinRange(curTime, s1Start, s1End);
      const expectedShift: '1' | '2' = inShift1 ? '1' : '2';

      if (settings.activeShift !== expectedShift) {
        const mId = merchant?.uid?.trim();
        if (!mId) return;

        setSettings((prev) => {
          const updated = { ...prev, activeShift: expectedShift };
          saveMerchantSettings(mId, updated);
          syncConfigToFirebase(updated, mId);
          return updated;
        });
      }
    };`,
`  // Customizable Auto-shift scheduler (consumes custom hours shift1Start/End & shift2Start/End)
  const autoShiftSyncRef = useRef(false);

  useEffect(() => {
    const checkShift = async () => {
      if (settings.manualOverride || autoShiftSyncRef.current) return;

      const now = new Date();
      const curTime = \`${'${String(now.getHours()).padStart(2, \'0\')}:${String(now.getMinutes()).padStart(2, \'0\')}' }\`;
      const s1Start = settings.shift1Start || '10:00';
      const s1End = settings.shift1End || '13:00';

      const inShift1 = isTimeWithinRange(curTime, s1Start, s1End);
      const expectedShift: '1' | '2' = inShift1 ? '1' : '2';

      if (settings.activeShift !== expectedShift) {
        const mId = merchant?.uid?.trim();
        if (!mId) return;

        const updated = { ...settings, activeShift: expectedShift };
        autoShiftSyncRef.current = true;
        try {
          const persisted = await syncConfigToFirebase(updated, mId);
          if (!persisted) {
            showToast('Gagal menyimpan perubahan shift ke cloud.', 'error');
            return;
          }
          setSettings(updated);
        } finally {
          autoShiftSyncRef.current = false;
        }
      }
    };`, 'auto-shift handler');

replaceOnce(app,
`  const handleUpdateSettings = (newSettings: Partial<StoreSettings>) => {
    const currentMId = requireMerchantId();
    if (!currentMId) return;

    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      saveMerchantSettings(currentMId, updated);
      syncConfigToFirebase(updated, currentMId);

      // When businessType changes: isolate data strictly!
      // Save current items for old businessType, load items for new businessType
      if (newSettings.businessType && newSettings.businessType !== prev.businessType) {
        const oldType = prev.businessType;
        const newType = newSettings.businessType;

        // Save current items under old businessType
        saveMerchantProducts(currentMId, oldType, products);
        saveMerchantOrders(currentMId, oldType, orders);
        saveMerchantExpenses(currentMId, oldType, expenses);
        saveMerchantPettyCash(currentMId, oldType, pettyCash);

        // Load isolated items for new businessType
        const switchedProducts = loadMerchantProducts(currentMId, newType);
        const switchedOrders = loadMerchantOrders(currentMId, newType);
        const switchedExpenses = loadMerchantExpenses(currentMId, newType);
        const switchedPetty = loadMerchantPettyCash(currentMId, newType);

        setProducts(switchedProducts);
        setOrders(switchedOrders);
        setExpenses(switchedExpenses);
        setPettyCash(switchedPetty);

        // Clear active cart to avoid cross-business mismatched items
        setCart([]);
        setEditingOrder(null);
      }

      return updated;
    });
  };`,
`  const handleUpdateSettings = async (newSettings: Partial<StoreSettings>) => {
    const currentMId = requireMerchantId();
    if (!currentMId) return;

    const previous = settings;
    const updated = { ...previous, ...newSettings };
    const persisted = await syncConfigToFirebase(updated, currentMId);
    if (!persisted) {
      showToast('Gagal menyimpan pengaturan ke cloud. Perubahan tidak diterapkan.', 'error');
      return;
    }

    setSettings(updated);

    if (newSettings.businessType && newSettings.businessType !== previous.businessType) {
      const newType = newSettings.businessType;
      setProducts(loadMerchantProducts(currentMId, newType));
      setOrders(loadMerchantOrders(currentMId, newType));
      setExpenses(loadMerchantExpenses(currentMId, newType));
      setPettyCash(loadMerchantPettyCash(currentMId, newType));
      setCart([]);
      setEditingOrder(null);
    }

    showToast('Pengaturan berhasil disimpan.', 'success');
  };`, 'settings handler');

replaceOnce(app,
`      const updatedCustomers = recordCustomerVisit(
        customers,
        {
          name: customerDetails.name,
          phone: customerDetails.phone,
          customerCode: customerDetails.customerCode,
          isMember: customerDetails.isMember,
        },
        status === 'selesai' ? finalTotal : 0,
        currentMId
      );
      setCustomers(updatedCustomers);`,
`      const updatedCustomers = await recordCustomerVisit(
        customers,
        {
          name: customerDetails.name,
          phone: customerDetails.phone,
          customerCode: customerDetails.customerCode,
          isMember: customerDetails.isMember,
        },
        status === 'selesai' ? finalTotal : 0,
        currentMId
      );
      if (updatedCustomers) {
        setCustomers(updatedCustomers);
      } else {
        showToast('Transaksi tersimpan, tetapi riwayat customer gagal disimpan ke cloud.', 'warning');
      }`, 'customer visit await');

replaceOnce(app, '// STAGE4B_SOURCE_MIGRATED', '// STAGE4B_SOURCE_MIGRATED\n// STAGE4C_SOURCE_MIGRATED', 'stage marker');

const customer = 'src/services/customerService.ts';
let c = fs.readFileSync(customer, 'utf8');
const visitMatch = c.match(/export function recordCustomerVisit\([\s\S]*?\nexport function claimMembershipReward/);
if (!visitMatch) throw new Error('recordCustomerVisit function not found');
const visitBlock = visitMatch[0];
const visitWithoutNext = visitBlock.slice(0, -'export function claimMembershipReward'.length);
const migratedVisit = visitWithoutNext
  .replace('export function recordCustomerVisit(', 'export async function recordCustomerVisit(')
  .replace('void syncCustomersToFirebase(merchantId,updatedList);return updatedList;', 'const persisted = await syncCustomersToFirebase(merchantId,updatedList); return persisted ? updatedList : null;');
c = c.replace(visitBlock, migratedVisit + 'export function claimMembershipReward');

const claimMatch = c.match(/export function claimMembershipReward\([\s\S]*$/);
if (!claimMatch) throw new Error('claimMembershipReward function not found');
const migratedClaim = claimMatch[0]
  .replace('export function claimMembershipReward(', 'export async function claimMembershipReward(')
  .replace('void syncCustomersToFirebase(merchantId,updated);return{customers:updated,success:true,', 'const persisted = await syncCustomersToFirebase(merchantId,updated); if (!persisted) return{customers,success:false,message:\'Gagal menyimpan reward customer ke cloud.\'}; return{customers:updated,success:true,');
c = c.replace(claimMatch[0], migratedClaim);
fs.writeFileSync(customer, c);

const customerView = 'src/components/CustomerView.tsx';
let v = fs.readFileSync(customerView, 'utf8');
v = v.replace('const claimReward = (reward: MembershipRewardType) => {', 'const claimReward = async (reward: MembershipRewardType) => {');
v = v.replace('const result = claimMembershipReward(customers, cardCustomer.id, reward, merchantId);', 'const result = await claimMembershipReward(customers, cardCustomer.id, reward, merchantId);');
v = v.replace('onSaveCustomer({ ...updated }, updated.id);', 'await onSaveCustomer({ ...updated }, updated.id);');
v = v.replace('onSaveCustomer: (customerData: Omit<Customer, \'id\'>, id?: string) => void;', 'onSaveCustomer: (customerData: Omit<Customer, \'id\'>, id?: string) => void | Promise<void>;');
fs.writeFileSync(customerView, v);

console.log('Stage 4C source migration completed.');
