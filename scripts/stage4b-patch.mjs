import fs from 'node:fs';

const path = 'src/App.tsx';
let patched = fs.readFileSync(path, 'utf8');

const required = (from, to) => {
  if (!patched.includes(from)) throw new Error(`Stage 4B patch target not found: ${from}`);
  patched = patched.replace(from, to);
};

// Make mutation handlers await the Firestore-first sync functions.
for (const [from, to] of [
  ["const handleSaveOrder = (", "const handleSaveOrder = async ("],
  ["const handleSaveProduct = (prodData: Omit<ProductItem, 'id'>, id?: string) => {", "const handleSaveProduct = async (prodData: Omit<ProductItem, 'id'>, id?: string) => {"],
  ["const handleDeleteProduct = (id: string) => {", "const handleDeleteProduct = async (id: string) => {"],
  ["const handleAddExpense = (expData: Omit<Expense, 'id'>) => {", "const handleAddExpense = async (expData: Omit<Expense, 'id'>) => {"],
  ["const handleUpdateExpense = (exp: Expense) => {", "const handleUpdateExpense = async (exp: Expense) => {"],
  ["const handleDeleteExpense = (id: string | number) => {", "const handleDeleteExpense = async (id: string | number) => {"],
  ["const handleSavePettyCash = (amount: number) => {", "const handleSavePettyCash = async (amount: number) => {"],
  ["const handleSaveCustomer = (customerData: Omit<Customer, 'id'>, id?: string) => {", "const handleSaveCustomer = async (customerData: Omit<Customer, 'id'>, id?: string) => {"],
  ["const handleDeleteCustomer = (id: string) => {", "const handleDeleteCustomer = async (id: string) => {"],
  ["const handleToggleMembership = (id: string) => {", "const handleToggleMembership = async (id: string) => {"],
  ["const handleCancelOrder = (orderId: string) => {", "const handleCancelOrder = async (orderId: string) => {"],
  ["const handleDeleteOrderPermanently = (orderId: string) => {", "const handleDeleteOrderPermanently = async (orderId: string) => {"],
].map(([a,b]) => [a,b])) {
  required(from, to);
}

// Product CRUD.
required(
  "      setProducts(updated);\n      saveMerchantProducts(currentMId, currentBType, updated);\n      syncProductsToFirebase(updated, currentMId, currentBType);\n      showToast('Katalog berhasil diperbarui!', 'success');",
  "      const persisted = await syncProductsToFirebase(updated, currentMId, currentBType);\n      if (!persisted) { showToast('Gagal menyimpan katalog ke cloud. Data lokal tidak diubah.', 'error'); return; }\n      setProducts(updated);\n      showToast('Katalog berhasil diperbarui!', 'success');"
);
required(
  "      setProducts(updated);\n      saveMerchantProducts(currentMId, currentBType, updated);\n      syncProductsToFirebase(updated, currentMId, currentBType);\n      showToast('Katalog baru berhasil ditambahkan!', 'success');",
  "      const persisted = await syncProductsToFirebase(updated, currentMId, currentBType);\n      if (!persisted) { showToast('Gagal menyimpan katalog ke cloud. Data lokal tidak diubah.', 'error'); return; }\n      setProducts(updated);\n      showToast('Katalog baru berhasil ditambahkan!', 'success');"
);
required(
  "    setProducts(updated);\n    saveMerchantProducts(currentMId, currentBType, updated);\n    syncProductsToFirebase(updated, currentMId, currentBType);\n    showToast('Katalog berhasil dinonaktifkan.', 'info');",
  "    const persisted = await syncProductsToFirebase(updated, currentMId, currentBType);\n    if (!persisted) { showToast('Gagal menonaktifkan katalog di cloud.', 'error'); return; }\n    setProducts(updated);\n    showToast('Katalog berhasil dinonaktifkan.', 'info');"
);

// Expense CRUD.
for (const [from, to] of [
  ["    setExpenses(updated);\n    saveMerchantExpenses(currentMId, currentBType, updated);\n    syncExpensesToFirebase(updated, currentMId, currentBType);\n    showToast('Catatan pengeluaran berhasil disimpan.', 'success');", "    const persisted = await syncExpensesToFirebase(updated, currentMId, currentBType);\n    if (!persisted) { showToast('Gagal menyimpan pengeluaran ke cloud.', 'error'); return; }\n    setExpenses(updated);\n    showToast('Catatan pengeluaran berhasil disimpan.', 'success');"],
  ["    setExpenses(updated);\n    saveMerchantExpenses(currentMId, currentBType, updated);\n    syncExpensesToFirebase(updated, currentMId, currentBType);\n    showToast('Catatan pengeluaran diperbarui.', 'success');", "    const persisted = await syncExpensesToFirebase(updated, currentMId, currentBType);\n    if (!persisted) { showToast('Gagal memperbarui pengeluaran di cloud.', 'error'); return; }\n    setExpenses(updated);\n    showToast('Catatan pengeluaran diperbarui.', 'success');"],
  ["    setExpenses(updated);\n    saveMerchantExpenses(currentMId, currentBType, updated);\n    syncExpensesToFirebase(updated, currentMId, currentBType);\n    showToast('Pengeluaran berhasil dihapus.', 'info');", "    const persisted = await syncExpensesToFirebase(updated, currentMId, currentBType);\n    if (!persisted) { showToast('Gagal menghapus pengeluaran di cloud.', 'error'); return; }\n    setExpenses(updated);\n    showToast('Pengeluaran berhasil dihapus.', 'info');"]
]) required(from, to);

required(
  "    setPettyCash(amount);\n    saveMerchantPettyCash(currentMId, currentBType, amount);\n    syncPettyCashToFirebase(amount, currentMId, currentBType);\n    showToast('Modal awal kasir berhasil diperbarui!', 'success');",
  "    const persisted = await syncPettyCashToFirebase(amount, currentMId, currentBType);\n    if (!persisted) { showToast('Gagal menyimpan modal awal kasir ke cloud.', 'error'); return; }\n    setPettyCash(amount);\n    showToast('Modal awal kasir berhasil diperbarui!', 'success');"
);

// Customer CRUD: no success toast is emitted until the cloud write succeeds.
required(
  "      updated = customers.map((c) => (c.id === id ? { ...customerData, id } : c));\n      showToast('Data customer berhasil diperbarui!', 'success');",
  "      updated = customers.map((c) => (c.id === id ? { ...customerData, id } : c));"
);
required(
  "      updated = [newCustomer, ...customers];\n      showToast('Customer baru berhasil didaftarkan!', 'success');",
  "      updated = [newCustomer, ...customers];"
);
required(
  "    setCustomers(updated);\n    saveCustomers(currentMId, updated);\n    syncCustomersToFirebase(currentMId, updated);",
  "    const persisted = await syncCustomersToFirebase(currentMId, updated);\n    if (!persisted) { showToast('Gagal menyimpan data customer ke cloud.', 'error'); return; }\n    setCustomers(updated);\n    showToast(id ? 'Data customer berhasil diperbarui!' : 'Customer baru berhasil didaftarkan!', 'success');"
);
required(
  "    setCustomers(updated);\n    saveCustomers(currentMId, updated);\n    syncCustomersToFirebase(currentMId, updated);\n    showToast('Data customer berhasil dihapus.', 'info');",
  "    const persisted = await syncCustomersToFirebase(currentMId, updated);\n    if (!persisted) { showToast('Gagal menghapus customer di cloud.', 'error'); return; }\n    setCustomers(updated);\n    showToast('Data customer berhasil dihapus.', 'info');"
);
required(
  "    setCustomers(updated);\n    saveCustomers(currentMId, updated);\n    syncCustomersToFirebase(currentMId, updated);\n    showToast('Status membership customer diperbarui!', 'success');",
  "    const persisted = await syncCustomersToFirebase(currentMId, updated);\n    if (!persisted) { showToast('Gagal memperbarui membership di cloud.', 'error'); return; }\n    setCustomers(updated);\n    showToast('Status membership customer diperbarui!', 'success');"
);

// Order persistence: Firestore commit precedes state/cache mutation and success feedback.
for (const [from, to] of [
  ["      setOrders(updated);\n      saveMerchantOrders(currentMId, currentBType, updated);\n      syncOrdersToFirebase(updated, currentMId, currentBType);", "      const persisted = await syncOrdersToFirebase(updated, currentMId, currentBType);\n      if (!persisted) { showToast('Gagal menyimpan transaksi ke cloud. Transaksi tidak diselesaikan.', 'error'); return; }\n      setOrders(updated);"],
  ["    setOrders(updated);\n    saveMerchantOrders(currentMId, currentBType, updated);\n    syncOrdersToFirebase(updated, currentMId, currentBType);\n    showToast('Status pesanan dibatalkan.', 'warning');", "    const persisted = await syncOrdersToFirebase(updated, currentMId, currentBType);\n    if (!persisted) { showToast('Gagal membatalkan pesanan di cloud.', 'error'); return; }\n    setOrders(updated);\n    showToast('Status pesanan dibatalkan.', 'warning');"],
  ["    setOrders(updated);\n    saveMerchantOrders(currentMId, currentBType, updated);\n    syncOrdersToFirebase(updated, currentMId, currentBType);\n    showToast('Pesanan dihapus secara permanen.', 'info');", "    const persisted = await syncOrdersToFirebase(updated, currentMId, currentBType);\n    if (!persisted) { showToast('Gagal menghapus pesanan di cloud.', 'error'); return; }\n    setOrders(updated);\n    showToast('Pesanan dihapus secara permanen.', 'info');"]
]) {
  if (patched.includes(from)) patched = patched.replace(from, to);
}

if (patched.includes('saveMerchantProducts(currentMId, currentBType, updated);\n      syncProductsToFirebase') || patched.includes('saveMerchantOrders(currentMId, currentBType, updated);\n      syncOrdersToFirebase')) {
  throw new Error('Stage 4B left an unsafe pre-sync cache write.');
}

fs.writeFileSync(path, patched);
console.log('Stage 4B patch applied to App.tsx');
