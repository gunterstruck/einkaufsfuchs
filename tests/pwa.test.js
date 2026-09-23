import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..');
const lies = (pfad) => readFileSync(join(wurzel, pfad), 'utf8');
const liesBinaer = (pfad) => readFileSync(join(wurzel, pfad));

describe('PWA-Aktualisierung', () => {
    it('hält Anwendung, Manifest, Cache und Icon-Adressen auf derselben Version', () => {
        const paket = JSON.parse(lies('package.json'));
        const version = lies('src/version.js').match(/VERSION = '([^']+)'/)?.[1];
        const cache = lies('sw.js').match(/einkaufsfuchs-v([\d.]+)/)?.[1];
        const manifest = lies('manifest.webmanifest');
        const index = lies('index.html');

        expect(version).toBe(paket.version);
        expect(cache).toBe(paket.version);
        expect(manifest).toContain(`?v=${paket.version}`);
        expect(index).toContain(`?v=${paket.version}`);
    });

    it('prüft sofort, bei Rückkehr und regelmäßig ohne HTTP-Zwischenspeicher', () => {
        const client = lies('src/pwa-update.js');
        expect(client).toContain("updateViaCache: 'none'");
        expect(client).toContain('void pruefeAufUpdate();');
        expect(client).toContain("window.addEventListener('focus'");
        expect(client).toContain("document.addEventListener('visibilitychange'");
        expect(client).toContain('window.setInterval');
    });

    it('wartet mit Updates auf geschlossene Fenster und hält die Schale konsistent', () => {
        const worker = lies('sw.js');
        expect(worker).not.toContain('self.skipWaiting()');
        expect(worker).toContain('self.clients.claim()');
        expect(worker).not.toContain('client.navigate');
        expect(worker.indexOf("cache.match('index.html')")).toBeLessThan(worker.indexOf('fetch(anfrage)'));
    });
});

describe('Fuchs-Familienzeichen', () => {
    it('verwendet die gemeinsame Palette und drei Listenstriche', () => {
        const manifest = JSON.parse(lies('manifest.webmanifest'));
        const farben = lies('src/styles/stamm/variables.css');
        const icon = lies('icons/foxi.svg');

        expect(manifest.theme_color).toBe('#0d9488');
        expect(manifest.background_color).toBe('#f8fafc');
        expect(farben).toContain('--color-primary: #0d9488');
        expect(icon).toContain('fill="#0d9488"');
        expect(icon.match(/<rect x="36" y="(?:10|16|22)"/g)).toHaveLength(3);
        expect(icon).toContain('M50 32 C64 32 76 42 76 54');
    });

    it('liefert dasselbe Zeichen auch für klassische Favicon-Crawler', () => {
        const index = lies('index.html');
        const worker = lies('sw.js');
        const ico = liesBinaer('favicon.ico');
        const png = liesBinaer('icons/favicon-64.png');

        expect(index).toContain('rel="shortcut icon"');
        expect(index).toContain('icons/favicon-64.png');
        expect(worker).toContain('favicon.ico');
        expect(worker).toContain('icons/favicon-64.png');
        expect([...ico.subarray(0, 6)]).toEqual([0, 0, 1, 0, 1, 0]);
        expect([...ico.subarray(22, 30)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
        expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    });
});

describe('Mobile App-Schale', () => {
    it('hängt an den Fensterkanten statt an einer Viewport-Einheit und reserviert die Reiterzeile fest', () => {
        const css = lies('src/styles/foxi.css');
        /* Nur die Regeln, ohne den erklärenden Kommentar darin. */
        const app = css.match(/\n#app\s*\{([^}]*)\}/)[1].replace(/\/\*[\s\S]*?\*\//g, '');
        expect(app).toMatch(/position:\s*fixed;/);
        expect(app).toMatch(/inset:\s*0;/);
        /* Keine Höhe aus `vh`/`dvh`: Genau die stand in installierten
           Web-Apps zeitweise falsch und schob die Leiste aus dem Bild. */
        expect(app).not.toMatch(/height:\s*100d?vh/);
        expect(css).toContain('minmax(0, 1fr)');
        expect(css).toContain('calc(var(--tableiste-height) + env(safe-area-inset-bottom))');
    });

    it('sperrt den Doppeltipp-Zoom, lässt Zwei-Finger-Zoom aber zu', () => {
        const css = lies('src/styles/foxi.css');
        expect(css).toMatch(/html,\s*body,\s*body \*\s*\{\s*touch-action:\s*manipulation;/);
        const html = lies('index.html');
        expect(html).not.toMatch(/user-scalable\s*=\s*no|maximum-scale/);
    });
});
