import { afterEach, describe, expect, it, vi } from 'vitest';
import { zustand } from '../src/zustand.js';
import { katalogVerdrahten, synchronisiereKacheln } from '../src/ui/katalog.js';

function kachelDoppel(artikelId) {
    const klassen = new Set(['kachel']);
    const attribute = new Map();
    return {
        dataset: { artikelId },
        classList: {
            contains: (name) => klassen.has(name),
            toggle: (name, aktiv) => aktiv ? klassen.add(name) : klassen.delete(name)
        },
        setAttribute: (name, wert) => attribute.set(name, wert),
        getAttribute: (name) => attribute.get(name)
    };
}

describe('Synchronisierung der Katalogkacheln', () => {
    afterEach(() => {
        zustand.artikel = new Map();
        zustand.liste = new Map();
        vi.unstubAllGlobals();
    });

    it('zieht beim Listenwechsel auch aria-pressed und aria-label nach', () => {
        const kachel = kachelDoppel('milch');
        const behaelter = { querySelectorAll: vi.fn(() => [kachel]) };
        const suchfeld = { addEventListener: vi.fn() };
        vi.stubGlobal('document', {
            getElementById: vi.fn((id) => id === 'katalog-inhalt' ? behaelter : suchfeld)
        });
        zustand.artikel = new Map([['milch', { id: 'milch', name: 'Milch' }]]);
        katalogVerdrahten();

        zustand.liste = new Map([['milch', { artikelId: 'milch' }]]);
        synchronisiereKacheln();
        expect(kachel.classList.contains('ist-drauf')).toBe(true);
        expect(kachel.getAttribute('aria-pressed')).toBe('true');
        expect(kachel.getAttribute('aria-label')).toBe('Milch – auf der Liste');

        zustand.liste.clear();
        synchronisiereKacheln();
        expect(kachel.classList.contains('ist-drauf')).toBe(false);
        expect(kachel.getAttribute('aria-pressed')).toBe('false');
        expect(kachel.getAttribute('aria-label')).toBe('Milch');
    });
});
