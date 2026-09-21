import { describe, expect, it, vi } from 'vitest';

/* Die Schale hängt am Zustand; geprüft wird hier nur die reine Entscheidung,
   ob der Rahmen zurückgeholt werden muss. */
vi.mock('../src/zustand.js', () => ({
    istExperte: () => false,
    modusSetzen: vi.fn(),
    offeneEintraege: () => [],
    beiAenderung: vi.fn()
}));

import { rahmenVerschoben } from '../src/ui/schale.js';

/**
 * Warum es diese Prüfung gibt: Foxi ist genau bildschirmhoch, die untere
 * Leiste steht im Rahmen. Wird das Fenster verschoben – auf iOS schiebt die
 * Bildschirmtastatur den sichtbaren Ausschnitt hoch –, rutscht die Leiste aus
 * dem Bild, und man kommt an Katalog und Mehr nicht mehr heran.
 */
describe('Rahmen zurückholen', () => {
    it('ist in Ruhe zufrieden', () => {
        expect(rahmenVerschoben({ scrollY: 0, versatz: 0, tippt: false })).toBe(false);
        expect(rahmenVerschoben()).toBe(false);
    });

    it('erkennt ein verschobenes Fenster', () => {
        expect(rahmenVerschoben({ scrollY: 120, versatz: 0, tippt: false })).toBe(true);
    });

    /* Auf iOS bleibt `scrollY` bei 0 und stattdessen wandert der sichtbare
       Ausschnitt über die Seite. Beide Wege müssen auffallen. */
    it('erkennt auch einen verschobenen Ausschnitt', () => {
        expect(rahmenVerschoben({ scrollY: 0, versatz: 216, tippt: false })).toBe(true);
    });

    /* Solange jemand tippt, ist die Verschiebung gewollt: Sie hält das Feld
       über der Tastatur. Sie zurückzuholen zöge dem Schreibenden das Feld
       unter den Fingern weg. */
    it('lässt die Verschiebung stehen, solange getippt wird', () => {
        expect(rahmenVerschoben({ scrollY: 120, versatz: 216, tippt: true })).toBe(false);
    });

    it('macht aus einem Rundungsrest keinen Fehler', () => {
        expect(rahmenVerschoben({ scrollY: 0.5, versatz: 0.4, tippt: false })).toBe(false);
    });
});
