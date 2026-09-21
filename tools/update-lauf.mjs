/**
 * Echte PWA-Aktualisierung mit zwei nacheinander ausgelieferten Workern.
 *
 * Der Lauf beweist drei Dinge im Browser: Der neue Worker wird entdeckt, ein
 * offenes Fenster behält seine Eingaben bis alle Fenster geschlossen sind,
 * und lokale IndexedDB-Daten überleben den Anwendungsneustart.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..');
const workerNeu = await readFile(join(wurzel, 'sw.js'), 'utf8');
const cacheNeu = workerNeu.match(/const CACHE = '([^']+)'/)?.[1];
if (!cacheNeu) throw new Error('Cache-Kennung im Service Worker fehlt.');
const workerAlt = workerNeu
    .replace(`const CACHE = '${cacheNeu}';`, "const CACHE = 'einkaufsfuchs-update-test-alt';")
    .concat('\n/* update-test: alte Fassung */\n');

const typen = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png'
};

let neueFassung = false;
let workerAbrufe = 0;
const server = createServer(async (anfrage, antwort) => {
    const adresse = new URL(anfrage.url, 'http://127.0.0.1');
    if (adresse.pathname === '/__neue_fassung') {
        neueFassung = true;
        antwort.writeHead(204, { 'Cache-Control': 'no-store' }).end();
        return;
    }
    if (adresse.pathname === '/sw.js') {
        workerAbrufe += 1;
        antwort.writeHead(200, {
            'Content-Type': 'text/javascript; charset=utf-8',
            'Cache-Control': 'no-store',
            'Service-Worker-Allowed': '/'
        });
        antwort.end(neueFassung ? workerNeu : workerAlt);
        return;
    }

    try {
        let pfad = join(wurzel, normalize(decodeURIComponent(adresse.pathname)));
        if (!pfad.startsWith(wurzel)) {
            antwort.writeHead(403).end();
            return;
        }
        const angaben = await stat(pfad).catch(() => null);
        if (angaben?.isDirectory()) pfad = join(pfad, 'index.html');
        const inhalt = await readFile(pfad);
        antwort.writeHead(200, {
            'Content-Type': typen[extname(pfad)] || 'application/octet-stream',
            'Cache-Control': 'no-store'
        });
        antwort.end(inhalt);
    } catch {
        antwort.writeHead(404).end('Nicht gefunden');
    }
});

await new Promise((fertig) => server.listen(0, '127.0.0.1', fertig));
const { port } = server.address();
const adresse = `http://127.0.0.1:${port}/`;
const browser = await chromium.launch(
    process.env.FOXI_CHROMIUM ? { executablePath: process.env.FOXI_CHROMIUM } : {}
);

const befunde = [];
const pruefe = (bedingung, text) => {
    console.log(`${bedingung ? '✓' : '✗'} ${text}`);
    if (!bedingung) befunde.push(text);
};

try {
    const kontext = await browser.newContext();
    let seite = await kontext.newPage();
    let navigationen = 0;
    seite.on('framenavigated', (frame) => {
        if (frame === seite.mainFrame()) navigationen += 1;
    });

    await seite.goto(adresse, { waitUntil: 'networkidle' });
    await seite.evaluate(async () => {
        await navigator.serviceWorker.ready;
        if (!navigator.serviceWorker.controller) {
            await new Promise((fertig) =>
                navigator.serviceWorker.addEventListener('controllerchange', fertig, { once: true })
            );
        }
    });

    await seite.evaluate(() => new Promise((fertig, kaputt) => {
        const anfrage = indexedDB.open('foxi-update-beweis', 1);
        anfrage.onupgradeneeded = () => anfrage.result.createObjectStore('werte');
        anfrage.onerror = () => kaputt(anfrage.error);
        anfrage.onsuccess = () => {
            const transaktion = anfrage.result.transaction('werte', 'readwrite');
            transaktion.objectStore('werte').put('bleibt-erhalten', 'probe');
            transaktion.oncomplete = fertig;
            transaktion.onerror = () => kaputt(transaktion.error);
        };
    }));

    const zweitesFenster = await kontext.newPage();
    await zweitesFenster.goto(adresse, { waitUntil: 'networkidle' });
    await zweitesFenster.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    await seite.evaluate(async () => {
        const z = await import('./src/zustand.js'); await z.modusSetzen('experte');
        await z.aufListeSetzen('milch');
    });
    await seite.locator('.karte-stift').first().click();
    await seite.locator('.mengen-editor input[type=text]').fill('Mein ungespeicherter Wunsch');
    navigationen = 0;
    await seite.evaluate(async () => {
        await fetch('/__neue_fassung', { method: 'POST' });
        const registrierung = await navigator.serviceWorker.getRegistration();
        await registrierung.update();
    });
    await seite.waitForFunction(async () => Boolean((await navigator.serviceWorker.getRegistration())?.waiting));
    pruefe(navigationen === 0, 'Ein Update lädt offene Fenster nicht neu');
    pruefe(await seite.locator('.mengen-editor input[type=text]').inputValue() === 'Mein ungespeicherter Wunsch', 'Ungespeicherte Eingaben bleiben erhalten');
    await zweitesFenster.bringToFront();
    await zweitesFenster.waitForFunction(async () => Boolean((await navigator.serviceWorker.getRegistration()).waiting));
    await seite.close();
    pruefe(await zweitesFenster.evaluate(async () => (await caches.keys()).includes('einkaufsfuchs-update-test-alt')), 'Die alte Fassung bleibt bis zum Schließen des zweiten Fensters aktiv');
    await zweitesFenster.close();
    seite = await kontext.newPage();
    await seite.goto(adresse, { waitUntil: 'networkidle' });
    await seite.waitForFunction(async () => !(await caches.keys()).includes('einkaufsfuchs-update-test-alt'));

    const ergebnis = await seite.evaluate(async () => {
        const wert = await new Promise((fertig, kaputt) => {
            const anfrage = indexedDB.open('foxi-update-beweis', 1);
            anfrage.onerror = () => kaputt(anfrage.error);
            anfrage.onsuccess = () => {
                const lesen = anfrage.result.transaction('werte').objectStore('werte').get('probe');
                lesen.onsuccess = () => fertig(lesen.result);
                lesen.onerror = () => kaputt(lesen.error);
            };
        });
        return {
            wert,
            caches: await caches.keys(),
            gesteuert: Boolean(navigator.serviceWorker.controller)
        };
    });

    pruefe(workerAbrufe >= 2, `Browser hat nach der neuen Worker-Fassung gefragt (${workerAbrufe} Abrufe)`);
    pruefe(ergebnis.gesteuert, 'Der neue Worker steuert das neu geladene Fenster');
    pruefe(ergebnis.caches.includes(cacheNeu), 'Der neue App-Cache ist aktiv');
    pruefe(!ergebnis.caches.includes('einkaufsfuchs-update-test-alt'), 'Der alte App-Cache wurde entfernt');
    pruefe(ergebnis.wert === 'bleibt-erhalten', 'Lokale IndexedDB-Daten bleiben beim Update erhalten');
} finally {
    await browser.close();
    await new Promise((fertig) => server.close(fertig));
}

if (befunde.length > 0) {
    console.error(`\n${befunde.length} Update-Prüfung(en) fehlgeschlagen.`);
    process.exit(1);
}
console.log('\n8/8 Update-Prüfungen bestanden.');
