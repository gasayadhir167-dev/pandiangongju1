/* 现场盘点助手 Service Worker
   作用：把 App 本体缓存到手机，断网也能打开。
   注意：它只缓存程序文件，不碰你的盘点数据和照片——那些在 IndexedDB 里。

   改完 index.html 以后，把下面的 VERSION 改一下（比如 v2.0.1），
   否则手机可能还用着旧缓存。 */
const VERSION = 'v2.0.0';
const CACHE = 'md-inventory-' + VERSION;
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // 逐个放进缓存：某一个文件缺失不至于让整个安装失败
    await Promise.all(SHELL.map(u => c.add(new Request(u, {cache:'reload'})).catch(err => {
      console.warn('[sw] 这个文件没缓存上：', u, err);
    })));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('md-inventory-') && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;      // 外站请求（比如网上搜图片）不拦

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, {ignoreSearch:true});

    if (hit) {
      // 先给缓存，后台顺手更新一份，下次打开就是新版
      fetch(req).then(res => { if (res && res.ok) cache.put(req, res.clone()); }).catch(()=>{});
      return hit;
    }
    try {
      const res = await fetch(req);
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    } catch (err) {
      // 断网且没缓存：页面跳转一律回退到首页
      if (req.mode === 'navigate') {
        const fallback = await cache.match('./index.html');
        if (fallback) return fallback;
      }
      throw err;
    }
  })());
});
