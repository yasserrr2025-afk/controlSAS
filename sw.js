
// ═══════════════════════════════════════════════════════
//   الكنترول المطور — Service Worker v8
//   استراتيجية: Network First مع Offline Fallback
// ═══════════════════════════════════════════════════════

const CACHE_NAME = 'control-v8';
const STATIC_CACHE = 'control-static-v8';

// الأصول الأساسية التي تعمل بدون إنترنت
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/index.css',
];

// ── التثبيت: كاش الأصول الأساسية ──
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS.map(url => new Request(url, { cache: 'reload' }))))
      .catch(() => {}) // لا نكسر التثبيت لو فشل URL ما
  );
  self.skipWaiting();
});

// ── التفعيل: حذف الكاش القديم ──
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== STATIC_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── الطلبات: Network First لضمان التحديث الفوري ──
self.addEventListener('fetch', (event) => {
  // تجاهل الطلبات غير GET
  if (event.request.method !== 'GET') return;
  
  // تجاهل Supabase وخدمات خارجية (تحتاج شبكة دائماً)
  const url = new URL(event.request.url);
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('esm.sh') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('cdn.tailwindcss.com')
  ) {
    return; // دع المتصفح يتعامل معها مباشرة
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // كاش الاستجابة الناجحة فقط
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() =>
        // إذا انقطع الإنترنت → رجوع للكاش
        caches.match(event.request).then((cached) =>
          cached || caches.match('/index.html') // offline fallback
        )
      )
  );
});

// ── رسائل من التطبيق ──
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
  if (event.data === 'clearCache') {
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
  }
});
