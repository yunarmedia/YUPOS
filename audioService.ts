let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    audioContext ??= new (window.AudioContext || (window as any).webkitAudioContext)();
    return audioContext;
  } catch {
    return null;
  }
}

function playTone(
  ctx: AudioContext,
  frequency: number,
  start: number,
  duration: number,
  gain: number,
  type: OscillatorType = 'sine',
) {
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gainNode.gain.setValueAtTime(0.0001, start);
  gainNode.gain.exponentialRampToValueAtTime(gain, start + 0.012);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

/** Premium POS cash-register confirmation sound. */
export async function playPaymentSound(): Promise<void> {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    if (ctx.state === 'suspended') await ctx.resume();
    const now = ctx.currentTime;
    playTone(ctx, 880, now, 0.09, 0.06, 'sine');
    playTone(ctx, 1174.66, now + 0.07, 0.12, 0.07, 'sine');
    playTone(ctx, 1567.98, now + 0.15, 0.18, 0.08, 'sine');

    const noise = ctx.createBufferSource();
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.07), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 2600;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now + 0.18);
    gain.gain.exponentialRampToValueAtTime(0.035, now + 0.19);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now + 0.18);
  } catch (error) {
    console.warn('Payment audio unavailable:', error);
  }
}

const ONES = [
  'nol', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan',
  'sepuluh', 'sebelas',
];

export function numberToIndonesianWords(value: number): string {
  const n = Math.max(0, Math.floor(value));
  if (n < 12) return ONES[n];
  if (n < 20) return `${ONES[n - 10]} belas`;
  if (n < 100) return `${ONES[Math.floor(n / 10)]} puluh${n % 10 ? ` ${ONES[n % 10]}` : ''}`;
  if (n < 200) return `seratus${n % 100 ? ` ${numberToIndonesianWords(n % 100)}` : ''}`;
  if (n < 1000) return `${ONES[Math.floor(n / 100)]} ratus${n % 100 ? ` ${numberToIndonesianWords(n % 100)}` : ''}`;
  if (n < 2000) return `seribu${n % 1000 ? ` ${numberToIndonesianWords(n % 1000)}` : ''}`;
  if (n < 1_000_000) return `${numberToIndonesianWords(Math.floor(n / 1000))} ribu${n % 1000 ? ` ${numberToIndonesianWords(n % 1000)}` : ''}`;
  if (n < 1_000_000_000) return `${numberToIndonesianWords(Math.floor(n / 1_000_000))} juta${n % 1_000_000 ? ` ${numberToIndonesianWords(n % 1_000_000)}` : ''}`;
  if (n < 1_000_000_000_000) return `${numberToIndonesianWords(Math.floor(n / 1_000_000_000))} miliar${n % 1_000_000_000 ? ` ${numberToIndonesianWords(n % 1_000_000_000)}` : ''}`;
  return `${numberToIndonesianWords(Math.floor(n / 1_000_000_000_000))} triliun${n % 1_000_000_000_000 ? ` ${numberToIndonesianWords(n % 1_000_000_000_000)}` : ''}`;
}

function getPreferredVoice(langPrefix: string): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  const preferredNames = /female|woman|zira|samantha|ava|karen|google.*female|google us english/i;
  return voices.find((v) => v.lang.toLowerCase().startsWith(langPrefix) && preferredNames.test(v.name))
    || voices.find((v) => v.lang.toLowerCase().startsWith(langPrefix))
    || null;
}

export function speak(text: string, lang = 'id-ID', rate = 0.92, pitch = 1.02): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = 1;
    const voice = getPreferredVoice(lang.toLowerCase().split('-')[0]);
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
  } catch (error) {
    console.warn('Speech synthesis unavailable:', error);
  }
}

export function speakPayment(total: number, paymentMethod: string): void {
  const amountWords = numberToIndonesianWords(total);
  const method = paymentMethod.replace(/\//g, ' atau ');
  speak(`Pembayaran sebesar ${amountWords} rupiah dengan ${method}.`, 'id-ID', 0.9, 1.0);
}

export function speakBrandIntro(): void {
  speak('One Pos For Everything.', 'en-US', 0.84, 1.05);
}
