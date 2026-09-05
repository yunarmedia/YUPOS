# YUPOS — Universal POS Cashier

YUPOS is a responsive universal POS cashier application with Firebase authentication, merchant-isolated data, PWA installation, ESC/POS receipt generation, and direct Chrome Web Bluetooth printer connection.

## Bluetooth Printer

Use Google Chrome/Edge over HTTPS. From **Pengaturan → Printer**, press **Sambungkan Printer Kasir** or **Sambungkan Printer Dapur**. YUPOS opens the native browser/Android Web Bluetooth device chooser directly from that user action. Select a compatible BLE ESC/POS thermal printer and pair/connect it.

Supported printer discovery profiles include common ESC/POS BLE, FFE0/FFE1, Nordic UART, and Serial Port BLE profiles. Bluetooth Classic/SPP printers are not accessible through Web Bluetooth and require a native bridge.
