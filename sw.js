/* ================================================
   SERVICE WORKER - Portal Desbravadores
   Estratégia: Network First com fallback para cache.
   Não intercepta requisições do Firebase/Google APIs.
   ================================================ */

const CACHE_NAME = 'portal-dbv-v2';
const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './PNGDBV.webp'
];

/* --- INSTALL: pré-cacheia os assets estáticos --- */
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            // Usa addAll com catch individual para não falhar se algum asset não existir
            return Promise.allSettled(
                STATIC_ASSETS.map((url) =>
                    cache.add(url).catch((err) => {
                        console.warn('[SW] Não foi possível cachear:', url, err);
                    })
                )
            );
        })
    );
    // Ativa o novo SW imediatamente sem esperar o anterior ser descartado
    self.skipWaiting();
});

/* --- ACTIVATE: limpa caches antigos --- */
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => {
                        console.log('[SW] Removendo cache antigo:', name);
                        return caches.delete(name);
                    })
            );
        })
    );
    // Assume controle de todas as abas imediatamente
    self.clients.claim();
});

/* --- FETCH: Network First com fallback para cache --- */
self.addEventListener('fetch', (event) => {
    // Ignorar requisições não-GET
    if (event.request.method !== 'GET') return;

    // Não interceptar requisições do Firebase / Google APIs
    const url = event.request.url;
    if (
        url.includes('firestore.googleapis.com') ||
        url.includes('firebase') ||
        url.includes('googleapis.com') ||
        url.includes('gstatic.com') ||
        url.includes('cdnjs.cloudflare.com') ||
        url.includes('discordapp.com') ||
        url.startsWith('chrome-extension://')
    ) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Só cacheia respostas válidas (status 200, tipo básico)
                if (response && response.ok && response.type === 'basic') {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                // Rede falhou: tenta servir do cache
                return caches.match(event.request).then((cached) => {
                    if (cached) return cached;
                    // Fallback final: retorna o index.html para navegação offline
                    if (event.request.mode === 'navigate') {
                        return caches.match('./index.html');
                    }
                });
            })
    );
});
