/**
 * Service Worker – der Grund, warum Foxi im Laden funktioniert.
 *
 * Im Supermarkt ist das Netz schlecht oder gar nicht da; im Keller eines
 * Getränkemarktes ist es zuverlässig weg. Deshalb liegt die ganze App im
 * Zwischenspeicher. Statische Bausteine kommen daraus, Seitenstarts prüfen
 * bei vorhandenem Netz zuerst den veröffentlichten Stand.
 *
 * Das ist gefahrlos, weil Foxi keine fremden Inhalte anzeigt. Bei einem
 * Seitenstart wird online trotzdem zuerst der aktuelle Stand geholt; ohne
 * Netz fällt Foxi auf die vollständige App-Schale zurück.
 */

const CACHE = 'einkaufsfuchs-v0.10.0';

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
    'src/angebotsradar.js',
    'src/db.js',
    'src/zustand.js',
    'src/version.js',
    'src/ui/schale.js',
    'src/ui/liste.js',
    'src/ui/katalog.js',
    'src/ui/mehr.js',
    'src/ui/dialog.js',
    'src/ui/teilen.js',
    'src/ui/angebote.js',
    'src/ui/artikelblatt.js',
    'src/daten/katalog.json',
    'src/daten/rezepte.json',
    'favicon.ico?v=0.10.0',
    'icons/foxi.svg?v=0.10.0',
    'icons/favicon-64.png?v=0.10.0',
    'icons/icon-192.png?v=0.10.0',
    'icons/icon-512.png?v=0.10.0',
    'icons/maskable-512.png?v=0.10.0',
    'icons/apple-touch-icon.png?v=0.10.0'
];

self.addEventListener('install', (ereignis) => {
    ereignis.waitUntil(
        caches.open(CACHE)
            .then((speicher) => speicher.addAll(SCHALE))
            .then(() => self.skipWaiting())
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

                /* Wichtig für die Fassung, die diesen Updateweg noch nicht
                   kennt: Sobald der neue Worker eine alte Foxi-Schale ersetzt,
                   lädt er bereits offene Fenster selbst neu. Beim allerersten
                   Installieren gibt es keinen alten Cache und keinen unnötigen
                   Neustart. IndexedDB bleibt davon vollständig unberührt. */
                if (alteNamen.length === 0) return;
                const fenster = await self.clients.matchAll({
                    type: 'window',
                    includeUncontrolled: true
                });
                await Promise.all(fenster.map(async (client) => {
                    try {
                        await client.navigate(client.url);
                    } catch {
                        /* `controllerchange` im aktuellen Client ist der
                           Rückfallweg für Browser ohne WindowClient.navigate. */
                    }
                }));
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

    /* Seitenaufrufe sind netzwerkzuerst. Damit sieht schon der erste normale
       Start nach einer Veröffentlichung die neue index.html; offline bleibt
       die vollständig gespeicherte Startseite verfügbar. */
    if (anfrage.mode === 'navigate') {
        ereignis.respondWith(
            fetch(anfrage)
                .then((antwort) => {
                    if (antwort && antwort.ok) {
                        const kopie = antwort.clone();
                        caches.open(CACHE).then((speicher) => speicher.put('index.html', kopie));
                    }
                    return antwort;
                })
                .catch(() => caches.match('index.html'))
        );
        return;
    }

    ereignis.respondWith(
        caches.match(anfrage).then((treffer) => {
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
