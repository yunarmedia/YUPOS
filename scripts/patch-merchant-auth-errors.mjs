import fs from 'node:fs';

const path = 'src/components/MerchantLogin.tsx';
const source = fs.readFileSync(path, 'utf8');

if (source.includes('STAGE_AUTH_ERRORS_PATCHED')) {
  console.log('Merchant auth error patch already applied.');
  process.exit(0);
}

const loginOld = `      if (code === 'auth/user-not-found') {\n        setErrorMessage(UNREGISTERED_MESSAGE);\n      } else if (code === 'auth/too-many-requests') {\n        setErrorMessage('Terlalu banyak percobaan login. Tunggu beberapa saat lalu coba lagi.');\n      } else if (code === 'auth/network-request-failed') {\n        setErrorMessage('Koneksi internet bermasalah. Periksa jaringan Anda.');\n      } else if (code === 'auth/invalid-email') {\n        setErrorMessage('Format email tidak valid.');\n      } else {\n        setErrorMessage('Email atau kata sandi tidak sesuai. Silakan periksa kembali data Anda.');\n      }`;

const loginNew = `      if (code === 'auth/invalid-credential' || code === 'auth/user-not-found') {\n        setErrorMessage('Email atau kata sandi tidak valid.');\n      } else if (code === 'auth/user-disabled') {\n        setErrorMessage('Akun ini dinonaktifkan. Hubungi tim YUPOS.');\n      } else if (code === 'auth/too-many-requests') {\n        setErrorMessage('Terlalu banyak percobaan login. Tunggu beberapa saat lalu coba lagi.');\n      } else if (code === 'auth/network-request-failed') {\n        setErrorMessage('Koneksi internet bermasalah. Periksa jaringan Anda.');\n      } else if (code === 'auth/invalid-email') {\n        setErrorMessage('Format email tidak valid.');\n      } else if (code === 'auth/operation-not-allowed') {\n        setErrorMessage('Login email/password belum diaktifkan pada project Firebase.');\n      } else {\n        setErrorMessage(\`Autentikasi gagal. Kode: \${code || 'unknown'}\`);\n      }`;

const resetOld = `      if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {\n        setErrorMessage(UNREGISTERED_MESSAGE);\n      } else if (code === 'auth/invalid-email') {\n        setErrorMessage('Format email tidak valid.');\n      } else if (code === 'auth/too-many-requests') {\n        setErrorMessage('Terlalu banyak permintaan reset. Tunggu beberapa saat lalu coba lagi.');\n      } else if (code === 'auth/network-request-failed') {\n        setErrorMessage('Koneksi internet bermasalah. Periksa jaringan Anda.');\n      } else {\n        setErrorMessage(UNREGISTERED_MESSAGE);\n      }`;

const resetNew = `      if (code === 'auth/invalid-email') {\n        setErrorMessage('Format email tidak valid.');\n      } else if (code === 'auth/too-many-requests') {\n        setErrorMessage('Terlalu banyak permintaan reset. Tunggu beberapa saat lalu coba lagi.');\n      } else if (code === 'auth/network-request-failed') {\n        setErrorMessage('Koneksi internet bermasalah. Periksa jaringan Anda.');\n      } else if (code === 'auth/user-disabled') {\n        setErrorMessage('Akun ini dinonaktifkan. Hubungi tim YUPOS.');\n      } else if (code === 'auth/operation-not-allowed') {\n        setErrorMessage('Pemulihan kata sandi email belum diaktifkan pada project Firebase.');\n      } else {\n        setErrorMessage(\`Permintaan reset gagal. Kode: \${code || 'unknown'}\`);\n      }`;

if (!source.includes(loginOld)) throw new Error('Login error handler pattern not found; aborting.');
if (!source.includes(resetOld)) throw new Error('Reset error handler pattern not found; aborting.');

let updated = source.replace(loginOld, loginNew).replace(resetOld, resetNew);
updated = `// STAGE_AUTH_ERRORS_PATCHED\n${updated}`;
fs.writeFileSync(path, updated);
console.log('Merchant auth error handling patched successfully.');
