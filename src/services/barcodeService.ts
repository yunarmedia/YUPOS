const PATTERNS = ['212222','222122','222221','121223','121322','131222','122213','122312','132212','221213','221312','231212','112232','122132','122231','113222','123122','123221','223211','221132','221231','213212','223112','312131','311222','321122','321221','312212','322112','322211','212123','212321','232121','111323','131123','131321','112313','132113','132311','211313','231113','231311','112133','112331','132131','113123','113321','133121','313121','211331','231131','213113','213311','213131','311123','311321','312113','312311','332111','314111','221411','431111','111224','111422','121124','121421','141122','141221','112214','112412','122114','122411','142112','142211','241211','221114','413111','241112','134111','111242','121142','121241','114212','114412','124112','124211','411212','421112','421211','212141','214121','412121','111143','111341','131141','114113','114311','411113','411311','113141','114131','311141','411131','211412','211214','2331112'];

function sanitize(value: string): string {
  return Array.from(value || '').map((char) => {
    const code = char.charCodeAt(0);
    return code >= 32 && code <= 126 ? char : '?';
  }).join('');
}

function encodeCode128B(value: string): number[] {
  const text = sanitize(value);
  const codes = [104];
  for (const char of text) codes.push(char.charCodeAt(0) - 32);
  let checksum = 104;
  for (let i = 1; i < codes.length; i += 1) checksum += codes[i] * i;
  codes.push(checksum % 103);
  codes.push(106);
  return codes;
}

export interface BarcodeBar {
  x: number;
  width: number;
  black: boolean;
}

export function getCode128Bars(value: string): BarcodeBar[] {
  const codes = encodeCode128B(value);
  const modules = codes.flatMap((code) => Array.from(PATTERNS[code] || '').map(Number));
  let x = 0;
  return modules.map((width, index) => {
    const item = { x, width, black: index % 2 === 0 };
    x += width;
    return item;
  });
}

export function drawCode128ToCanvas(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  width: number,
  height: number,
): number {
  const bars = getCode128Bars(value);
  const totalModules = bars.length ? bars[bars.length - 1].x + bars[bars.length - 1].width : 1;
  const moduleWidth = width / totalModules;
  ctx.save();
  ctx.fillStyle = '#fff';
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = '#000';
  for (const bar of bars) {
    if (bar.black) ctx.fillRect(x + bar.x * moduleWidth, y, Math.max(1, bar.width * moduleWidth), height);
  }
  ctx.restore();
  return y + height;
}
