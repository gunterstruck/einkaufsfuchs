import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { qrErzeugen, HOECHSTE_VERSION } from '../src/qrcode.js';

/**
 * Ein selbst gebauter QR-Erzeuger ist nur so viel wert, wie er sich prüfen
 * lässt – und gegen sich selbst zu prüfen wäre wertlos.
 *
 * `qr-referenz.json` enthält deshalb die Fingerabdrücke einer **unabhängigen**
 * Umsetzung (`qrcode` auf npm, mit `tools/`-Wegwerfskript einmalig erzeugt):
 * je ein Text für jede der 25 Versionen in beiden Stufen, dazu Emoji und eine
 * echte Foxi-URL. Verglichen wird das fertige Bild Modul für Modul.
 *
 * Fällt einer dieser Tests, ist der erzeugte Code nicht „etwas anders",
 * sondern von keinem Leser der Welt zu lesen.
 */
const referenz = JSON.parse(
    readFileSync(new URL('./qr-referenz.json', import.meta.url), 'utf8')
);

const abdruck = (module) => createHash('sha256')
    .update(Buffer.from(module))
    .digest('hex')
    .slice(0, 32);

describe('QR-Erzeuger gegen eine unabhängige Umsetzung', () => {
    for (const [name, fall] of Object.entries(referenz)) {
        it(`erzeugt ${name} Modul für Modul gleich`, () => {
            const code = qrErzeugen(fall.text, { stufe: fall.stufe });
            expect(code.version).toBe(fall.version);
            expect(code.groesse).toBe(fall.groesse);
            expect(code.module).toHaveLength(fall.groesse * fall.groesse);
            expect(abdruck(code.module)).toBe(fall.abdruck);
        });
    }
});

describe('Grenzen des Erzeugers', () => {
    it('deckt alle 25 Versionen ab', () => {
        expect(HOECHSTE_VERSION).toBe(25);
        const versionen = new Set(Object.values(referenz).map((f) => f.version));
        for (let v = 1; v <= HOECHSTE_VERSION; v++) expect(versionen.has(v)).toBe(true);
    });

    /* Lieber eine klare Absage als ein Bild, das keine Kamera mehr liest. */
    it('sagt ab, statt einen unlesbar dichten Code zu bauen', () => {
        expect(() => qrErzeugen('x'.repeat(5000))).toThrow();
        expect(() => qrErzeugen('x'.repeat(200), { hoechsteVersion: 2 })).toThrow();
    });

    it('weist eine unbekannte Fehlerkorrekturstufe ab', () => {
        expect(() => qrErzeugen('Milch', { stufe: 'H' })).toThrow();
    });

    /* Umlaute und Emoji sind in einer Einkaufsliste der Normalfall, nicht die
       Ausnahme – sie müssen als UTF-8 in den Byte-Modus. */
    it('trägt Umlaute und Emoji', () => {
        const code = qrErzeugen('Äpfel 🍎 · Käse 🧀', { stufe: 'L' });
        expect(code.version).toBeGreaterThan(0);
        expect(code.module.some((m) => m === 1)).toBe(true);
    });
});
