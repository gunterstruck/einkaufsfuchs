import { describe, expect, it, vi } from 'vitest';

/* Das Blatt zieht Texte, Zustand und Dialog heran. Geprüft wird hier nur die
   reine Aufbereitung eines Angebots – deshalb stehen die Nachbarn als
   Doppel bereit und die Texte als ihre Schlüssel. */
vi.mock('../src/texte.js', () => ({
    t: (schluessel, ...werte) => (werte.length ? `${schluessel}:${werte.join('|')}` : schluessel)
}));
vi.mock('../src/zustand.js', () => ({
    angebotsergebnis: () => null,
    produktfoto: () => '',
    produktfotoSetzen: vi.fn(),
    produktfotoLoeschen: vi.fn(),
    produktwunschSetzen: vi.fn()
}));
vi.mock('../src/ui/dialog.js', () => ({ zeigeDialog: vi.fn(), schliesseDialog: vi.fn() }));
vi.mock('../src/ui/schale.js', () => ({ melde: vi.fn() }));

import { angebotDetails } from '../src/ui/artikelblatt.js';

function angebot(aenderung = {}) {
    return {
        artikelId: 'milch',
        artikelName: 'Milch',
        haendler: 'ALDI Nord',
        produkt: 'Frische Vollmilch 3,8 %',
        preis: 0.99,
        waehrung: 'EUR',
        menge: '1 l',
        grundpreis: '0,99 €/l',
        gueltigVon: '2026-09-14',
        gueltigBis: '2026-09-20',
        treffer: 'genau',
        hinweis: '',
        maerkte: ['Schürmannstraße 43b, 45136 Essen'],
        quellen: ['https://www.aldi-nord.de/angebote.html'],
        niedrigsterGefundenerGrundpreis: false,
        ...aenderung
    };
}

describe('Angebot im Artikelblatt', () => {
    it('führt Preis und Händler im Kopf, Menge und Grundpreis darunter', () => {
        const angaben = angebotDetails(angebot());
        expect(angaben.kopf).toBe('0,99 € · ALDI Nord');
        /* Der Grundpreis ist die eigentliche Vergleichszahl und darf nicht
           wegfallen: „0,99 €" sagt nichts, „0,99 €/l" sagt alles. */
        expect(angaben.preisangabe).toBe('1 l · 0,99 €/l');
        expect(angaben.gueltig).toBe('blatt.gueltigBis:20.09.2026');
    });

    /* Ohne diese Marke behauptet das Blatt ein Angebot für einen Artikel,
       den der Händler gar nicht führt. Das ist dieselbe Vertrauensfrage wie
       die Preisprüfung – nur an der Oberfläche. */
    it('kennzeichnet ein ähnliches Produkt als solches', () => {
        expect(angebotDetails(angebot({ treffer: 'alternative' })).marken)
            .toContain('blatt.alternative');
        expect(angebotDetails(angebot()).marken).not.toContain('blatt.alternative');
    });

    it('kennzeichnet den niedrigsten Grundpreis', () => {
        expect(angebotDetails(angebot({ niedrigsterGefundenerGrundpreis: true })).marken)
            .toContain('blatt.guenstigster');
    });

    it('nimmt die Kaufbedingung mit, ohne umgebende Leerzeichen', () => {
        expect(angebotDetails(angebot({ hinweis: '  Nur ab 6 Packungen  ' })).hinweis)
            .toBe('Nur ab 6 Packungen');
        expect(angebotDetails(angebot({ hinweis: '   ' })).hinweis).toBe('');
    });

    it('zeigt alle Filialen, aber nur eine Quelle', () => {
        const angaben = angebotDetails(angebot({
            maerkte: ['Schürmannstraße 43b', 'Steeler Straße 187'],
            /* Die Gruppierung sammelt je Filiale eine Quelle ein; sie zeigen
               auf dieselbe Angebotsseite. Eine Liste gleicher Links wäre
               Lärm. */
            quellen: ['https://www.aldi-nord.de/angebote.html', 'https://www.aldi-nord.de/angebote.html']
        }));
        expect(angaben.maerkte).toHaveLength(2);
        expect(angaben.quelle).toBe('https://www.aldi-nord.de/angebote.html');
    });

    it('kommt ohne Quellen und Märkte aus, statt zu werfen', () => {
        const angaben = angebotDetails(angebot({ quellen: undefined, maerkte: undefined }));
        expect(angaben.quelle).toBe('');
        expect(angaben.maerkte).toEqual([]);
    });
});
