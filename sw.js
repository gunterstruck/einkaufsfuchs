/**
 * Service Worker – der Grund, warum Foxi im Laden funktioniert.
 *
 * Im Supermarkt ist das Netz schlecht oder gar nicht da; im Keller eines
 * Getränkemarktes ist es zuverlässig weg. Deshalb liegt die ganze App im
 * Zwischenspeicher. Seiten und Module kommen aus derselben gespeicherten Fassung.
 * Updates warten, bis alle alten Fenster geschlossen sind.
 *
 * So bleiben Eingaben und die laufende App-Schale bei einem Update erhalten.
 */

const CACHE = 'einkaufsfuchs-v0.13.0';

const SCHALE = [
    './',
    'index.html',
    'manifest.webmanifest',
    'src/styles/stamm/variables.css',
    'src/styles/farben.css',
    'src/styles/stamm/base.css',
    'src/styles/foxi.css',
    'src/app.js',
    'src/pwa-update.js',
    'src/texte.js',
    'src/logik.js',
    'src/sicherung.js',
    'src/angebotsradar.js',
    'src/qrcode.js',
    'src/qrliste.js',
    'src/db.js',
    'src/zustand.js',
    'src/version.js',
    'src/ui/schale.js',
    'src/ui/liste.js',
    'src/ui/assistent.js',
    'src/ui/katalog.js',
    'src/ui/mehr.js',
    'src/ui/dialog.js',
    'src/ui/teilen.js',
    'src/ui/angebote.js',
    'src/ui/artikelblatt.js',
    'src/daten/katalog.json',
    'src/daten/rezepte.json',
    'favicon.ico?v=0.13.0',
    'icons/foxi.svg?v=0.13.0',
    'icons/favicon-64.png?v=0.13.0',
    'icons/icon-192.png?v=0.13.0',
    'icons/icon-512.png?v=0.13.0',
    'icons/maskable-512.png?v=0.13.0',
    'icons/apple-touch-icon.png?v=0.13.0'
];

self.addEventListener('install', (ereignis) => {
    ereignis.waitUntil(
        caches.open(CACHE)
            .then((speicher) => speicher.addAll(SCHALE))
    );
});

self.addEventListener('activate', (ereignis) => {
    ereignis.waitUntil(
        caches.keys()
            .then(async (namen) => {
                const alteNamen = namen.filter(
                    (name) => name.startsWith('einkaufsfuchs-') && name !== CACHE
                );
                await Promise.all(alteNamen.map((name) => caches.delete(name)));
                await self.clients.claim();


            })
    );
});

self.addEventListener('fetch', (ereignis) => {
    const anfrage = ereignis.request;
    if (anfrage.method !== 'GET') return;

    const adresse = new URL(anfrage.url);
    /* Fremde Adressen gehen Foxi nichts an. Es stellt keine – und wenn doch
       einmal eine entstünde, soll sie jedenfalls nicht auch noch hier
       zwischengespeichert werden. */
    if (adresse.origin !== self.location.origin) return;

    /* Seiten und Module bleiben bis zur sicheren Aktivierung auf demselben Stand. */
    if (anfrage.mode === 'navigate') {
        ereignis.respondWith(
            caches.open(CACHE).then(cache => cache.match('index.html')).then(treffer => treffer || fetch(anfrage))
                .then((antwort) => {
                    if (antwort && antwort.ok) {
                        const kopie = antwort.clone();
                        caches.open(CACHE).then((speicher) => speicher.put('index.html', kopie));
                    }
                    if (!antwort || !antwort.ok) return caches.open(CACHE).then(cache => cache.match('index.html'));
                    return antwort;
                })
                .catch(() => caches.open(CACHE).then(cache => cache.match('index.html')))
        );
        return;
    }

    ereignis.respondWith(
        caches.open(CACHE).then(cache => cache.match(anfrage)).then((treffer) => {
            if (treffer) return treffer;
            return fetch(anfrage).then((antwort) => {
                if (antwort && antwort.ok && antwort.type === 'basic') {
                    const kopie = antwort.clone();
                    caches.open(CACHE).then((speicher) => speicher.put(anfrage, kopie));
                }
                return antwort;
            });
        })
    );
});
