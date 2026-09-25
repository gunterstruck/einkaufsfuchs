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

const CACHE = 'einkaufsfuchs-v0.15.1';

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
    'favicon.ico?v=0.15.1',
    'icons/foxi.svg?v=0.15.1',
    'icons/favicon-64.png?v=0.15.1',
    'icons/icon-192.png?v=0.15.1',
    'icons/icon-512.png?v=0.15.1',
    'icons/maskable-512.png?v=0.15.1',
    'icons/apple-touch-icon.png?v=0.15.1'
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

    if (anfrage.mode === 'navigate') {
        ereignis.respondWith(schaleAusliefern(ereignis));
        return;
    }
    ereignis.respondWith(ausSpeicherOderNetz(ereignis));
});

/**
 * Seiten und Module bleiben bis zur sicheren Aktivierung auf demselben Stand:
 * Solange die Schale im Zwischenspeicher liegt, wird sie ausgeliefert und
 * nichts gefragt. Nur wenn sie fehlt – etwa weil ein Install abgebrochen
 * wurde –, geht eine Anfrage hinaus.
 */
async function schaleAusliefern(ereignis) {
    const anfrage = ereignis.request;
    const cache = await caches.open(CACHE);
    const treffer = await cache.match('index.html');
    if (treffer) return treffer;

    /* Was jetzt ankommt, wird zur neuen Schale. Was mit einem Fehlercode
       ankommt, geht unverändert durch: Die Antwort des Servers ist für den
       Menschen davor brauchbarer als ein Netzwerkfehler aus dem Nichts. */
    const antwort = await fetch(anfrage);
    if (antwort && antwort.ok) sichere(ereignis, cache, 'index.html', antwort.clone());
    return antwort;
}

async function ausSpeicherOderNetz(ereignis) {
    const anfrage = ereignis.request;
    const cache = await caches.open(CACHE);
    const treffer = await cache.match(anfrage);
    if (treffer) return treffer;

    const antwort = await fetch(anfrage);
    if (antwort && antwort.ok && antwort.type === 'basic') {
        sichere(ereignis, cache, anfrage, antwort.clone());
    }
    return antwort;
}

/**
 * Zwischenspeichern, ohne die Auslieferung daran zu hängen.
 *
 * `waitUntil` hält den Service Worker so lange am Leben, dass das Schreiben
 * auch dann fertig wird, wenn die Antwort längst beim Fenster ist. Und ein
 * voller Speicher ist kein Grund, eine Seite scheitern zu lassen – sonst
 * bringt ausgerechnet das volle Gerät die App zum Stehen.
 */
function sichere(ereignis, cache, schluessel, antwort) {
    ereignis.waitUntil(
        cache.put(schluessel, antwort).catch((fehler) => {
            console.debug('[Foxi] nicht zwischengespeichert', fehler);
        })
    );
}
