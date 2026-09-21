import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

vi.mock('../src/zustand.js', () => ({
    istExperte: () => false,
    modusSetzen: vi.fn(),
    offeneEintraege: () => [],
    beiAenderung: vi.fn()
}));

import { DESKTOP_ABFRAGE } from '../src/ui/schale.js';

const datei = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');

/**
 * Die Schreibtisch-Ansicht wird an zwei Stellen entschieden: Das CSS
 * schneidet das Raster, die Logik lässt den Katalog stehen. Laufen die
 * beiden Fassungen der Abfrage auseinander, steht die linke Spalte leer –
 * ein Fehler, den man am Handy nie sieht.
 */
describe('Schreibtisch-Ansicht', () => {
    it('benutzt in Gestaltung und Logik wortgleich dieselbe Abfrage', () => {
        expect(datei('src/styles/foxi.css')).toContain(`@media ${DESKTOP_ABFRAGE} {`);
    });

    /* Ein großes Telefon quer ist über 900 px breit. Ohne die Höhenbedingung
       bekäme es zwei Spalten in 400 px Höhe. */
    it('sperrt Telefone aus, auch im Querformat', () => {
        expect(DESKTOP_ABFRAGE).toContain('min-height: 480px');
    });

    /* Hochkant ist Handy-Ansicht – auch auf einem breiten Tablet. Das ist die
       Regel, die man sich merken kann: quer ist Schreibtisch. */
    it('macht das Hochformat zur Handy-Ansicht', () => {
        expect(DESKTOP_ABFRAGE).toContain('orientation: landscape');
    });

    /* Eine im Manifest festgenagelte Ausrichtung verbietet der installierten
       App genau die Drehung, aus der die Schreibtisch-Ansicht entsteht. */
    it('lässt die installierte App drehen', () => {
        expect(JSON.parse(datei('manifest.webmanifest')).orientation).not.toBe('portrait');
    });
});
