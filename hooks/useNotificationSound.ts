/**
 * useNotificationSound — يُشغّل أصواتاً إشعارية عبر Web Audio API
 * لا يحتاج لملفات صوتية خارجية
 */
export function useNotificationSound() {
  const playAlert = (type: 'alert' | 'ding' | 'blip' = 'alert') => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'alert') {
        // صوت تنبيه حاد (للبلاغات العاجلة)
        osc.type = 'square';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.setValueAtTime(660, ctx.currentTime + 0.1);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.2);
        osc.frequency.setValueAtTime(660, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.5);
      } else if (type === 'ding') {
        // صوت "دنق" ناعم (للنجاح / الاستلام)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1046, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(523, ctx.currentTime + 0.4);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.6);
      } else {
        // blip بسيط (للمعلومات)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(660, ctx.currentTime);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.15);
      }

      osc.onended = () => ctx.close();
    } catch {
      // تجاهل الخطأ إذا لم يدعم المتصفح Web Audio
    }
  };

  return { playAlert };
}
