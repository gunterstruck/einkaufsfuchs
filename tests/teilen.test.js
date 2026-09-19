import { describe, it, expect, vi } from 'vitest';
import {
    alsAustauschdatei, pruefeAustauschdatei, vergleicheImport,
    kaufStatistik, datumFuerDateiname, DATEI_TYP, DATEI_VERSION, TAG_MS,
    AUSTAUSCHDATEI_GRENZEN
} from '../src/logik.js';

const teilenUiDoppel = vi.hoisted(() => ({
    melde: vi.fn(),
    importAnwenden: vi.fn(async () => 0)
}));

vi.mock('../src/texte.js', () => ({ t: (schluessel) => schluessel }));
vi.mock('../src/zustand.js', () => ({
    zustand: { kategorien: [], artikel: new Map(), liste: new Map() },
    offeneEintraege: () => [],
    importAnwenden: teilenUiDoppel.importAnwenden,
    alleArtikel: () => [],
    ort: () => ''
}));
vi.mock('../src/ui/schale.js', () => ({ melde: teilenUiDoppel.melde }));
vi.mock('../src/ui/dialog.js', () => ({ zeigeDialog: vi.fn(), dialogZeile: vi.fn() }));

import { dateiEinlesen } from '../src/ui/teilen.js';

const JETZT = new Date('2026-08-30T10:00:00Z').getTime();

const artikelNachId = new Map([
    ['milch', { id: 'milch', name: 'Milch', kategorieId: 'molkerei', icon: '🥛', letzteKaeufe: [] }],
    ['brot', { id: 'brot', name: 'Brot', kategorieId: 'backwaren', icon: '🍞', letzteKaeufe: [] }]
]);
const kategorienNachId = new Map([
    ['molkerei', { id: 'molkerei', name: 'Milch, Käse & Eier', icon: '🧀', position: 0 }],
    ['backwaren', { id: 'backwaren', name: 'Brot & Backwaren', icon: '🥖', position: 1 }]
]);

describe('Austauschdatei', () => {
    const eintraege = [
        { artikelId: 'milch', menge: '2', notiz: 'laktosefrei' },
        { artikelId: 'brot', menge: '', notiz: '' }
    ];

    it('trägt alles mit, was das andere Gerät zum Anzeigen braucht', () => {
        const datei = alsAustauschdatei(eintraege, artikelNachId, kategorienNachId, new Date(JETZT));
        expect(datei.typ).toBe(DATEI_TYP);
        expect(datei.version).toBe(DATEI_VERSION);
        expect(datei.artikel[0]).toMatchObject({
            id: 'milch', name: 'Milch', kategorieId: 'molkerei',
            kategorieName: 'Milch, Käse & Eier', icon: '🥛', menge: '2', notiz: 'laktosefrei'
        });
        expect(pruefeAustauschdatei(datei).gueltig).toBe(true);
    });

    /* Die Kaufhistorie ist das Gedächtnis eines Haushalts, keine Beilage zu
       einer Einkaufsliste. Wer eine Liste teilt, teilt nicht mit, wie oft er
       Bier kauft. */
    it('gibt die Kaufhistorie nicht mit weiter', () => {
        const mitHistorie = new Map(artikelNachId);
        mitHistorie.set('milch', { ...artikelNachId.get('milch'), letzteKaeufe: [JETZT, JETZT - TAG_MS] });
        const datei = alsAustauschdatei(eintraege, mitHistorie, kategorienNachId, new Date(JETZT));
        const alsText = JSON.stringify(datei);
        expect(alsText).not.toContain('letzteKaeufe');
        expect(alsText).not.toContain('zaehler');
    });

    it('überspringt Einträge ohne Artikel, statt null zu schreiben', () => {
        const datei = alsAustauschdatei(
            [...eintraege, { artikelId: 'gibtsnicht', menge: '', notiz: '' }],
            artikelNachId, kategorienNachId, new Date(JETZT)
        );
        expect(datei.artikel).toHaveLength(2);
    });

    it('benennt die Datei nach dem Tag, sortierbar', () => {
        expect(datumFuerDateiname(new Date('2026-08-05T12:00:00'))).toBe('2026-08-05');
    });
});

describe('Prüfung eingelesener Dateien', () => {
    it('nimmt eine echte Foxi-Datei an', () => {
        expect(pruefeAustauschdatei({ typ: DATEI_TYP, version: 1, artikel: [] }).gueltig).toBe(true);
    });

    it('weist eine fremde Datei mit Grund ab', () => {
        expect(pruefeAustauschdatei({ typ: 'irgendwas', artikel: [] }))
            .toEqual({ gueltig: false, grund: 'fremd' });
    });

    it('weist Unsinn ab, ohne zu werfen', () => {
        expect(pruefeAustauschdatei(null).gueltig).toBe(false);
        expect(pruefeAustauschdatei('nur ein Text').gueltig).toBe(false);
        expect(pruefeAustauschdatei({ typ: DATEI_TYP, artikel: 'keine Liste' }).gueltig).toBe(false);
    });

    it('weist die ganze Datei ab, wenn ein einzelner Artikel den Katalog beschädigen könnte', () => {
        const basis = { typ: DATEI_TYP, version: 1 };
        const gueltig = { id: 'milch', name: 'Milch', menge: '', notiz: '' };

        expect(pruefeAustauschdatei({ ...basis, artikel: [gueltig, null] }))
            .toEqual({ gueltig: false, grund: 'kaputt' });
        expect(pruefeAustauschdatei({ ...basis, artikel: [gueltig, { id: 'brot', name: {} }] }))
            .toEqual({ gueltig: false, grund: 'kaputt' });
        expect(pruefeAustauschdatei({ ...basis, artikel: [{ id: '', name: 'Brot' }] }))
            .toEqual({ gueltig: false, grund: 'kaputt' });
        expect(pruefeAustauschdatei({ ...basis, artikel: [{ id: 'brot', name: 'Brot', icon: {} }] }))
            .toEqual({ gueltig: false, grund: 'kaputt' });
    });

    /* Eine Datei aus einer neueren Foxi-Fassung könnte Felder tragen, die
       diese hier still verlöre. Lieber ehrlich ablehnen. */
    it('weist eine Datei aus einer neueren Fassung ab', () => {
        expect(pruefeAustauschdatei({ typ: DATEI_TYP, version: 99, artikel: [] }))
            .toEqual({ gueltig: false, grund: 'zuNeu' });
    });

    it('akzeptiert nur ganzzahlige unterstützte Versionsnummern', () => {
        for (const version of [undefined, null, '1', 0, -1, 1.5, Number.NaN]) {
            expect(pruefeAustauschdatei({ typ: DATEI_TYP, version, artikel: [] }))
                .toEqual({ gueltig: false, grund: 'kaputt' });
        }
        expect(pruefeAustauschdatei({ typ: DATEI_TYP, version: 1, artikel: [] }).gueltig)
            .toBe(true);
    });

    it('begrenzt Artikelzahl und Textfelder, nimmt aber die Grenzwerte selbst an', () => {
        const artikelAmLimit = {
            id: 'i'.repeat(AUSTAUSCHDATEI_GRENZEN.id),
            name: 'N'.repeat(AUSTAUSCHDATEI_GRENZEN.name),
            kategorieId: 'k'.repeat(AUSTAUSCHDATEI_GRENZEN.kategorieId),
            kategorieName: 'K'.repeat(AUSTAUSCHDATEI_GRENZEN.kategorieName),
            icon: '🫙'.repeat(AUSTAUSCHDATEI_GRENZEN.icon / 2),
            menge: 'm'.repeat(AUSTAUSCHDATEI_GRENZEN.menge),
            notiz: 'n'.repeat(AUSTAUSCHDATEI_GRENZEN.notiz)
        };
        const basis = { typ: DATEI_TYP, version: 1 };
        const maximaleListe = Array.from(
            { length: AUSTAUSCHDATEI_GRENZEN.artikelAnzahl },
            (_, index) => ({ id: `artikel-${index}`, name: `Artikel ${index}` })
        );

        expect(pruefeAustauschdatei({ ...basis, artikel: [artikelAmLimit] }).gueltig).toBe(true);
        expect(pruefeAustauschdatei({ ...basis, artikel: maximaleListe }).gueltig).toBe(true);
        expect(pruefeAustauschdatei({
            ...basis, artikel: [...maximaleListe, { id: 'einer-zu-viel', name: 'Zu viel' }]
        }).gueltig).toBe(false);
        expect(pruefeAustauschdatei({
            ...basis,
            erzeugt: 'z'.repeat(AUSTAUSCHDATEI_GRENZEN.erzeugt),
            artikel: []
        }).gueltig).toBe(true);
        expect(pruefeAustauschdatei({
            ...basis,
            erzeugt: 'z'.repeat(AUSTAUSCHDATEI_GRENZEN.erzeugt + 1),
            artikel: []
        }).gueltig).toBe(false);

        for (const feld of ['id', 'name', 'kategorieId', 'kategorieName', 'icon', 'menge', 'notiz']) {
            const zuLang = {
                id: 'a',
                name: 'Artikel',
                [feld]: 'x'.repeat(AUSTAUSCHDATEI_GRENZEN[feld] + 1)
            };
            expect(pruefeAustauschdatei({ ...basis, artikel: [zuLang] }).gueltig).toBe(false);
        }
    });
});

describe('Dateiauswahl', () => {
    it('liest eine zu große Datei gar nicht erst in den Speicher', async () => {
        teilenUiDoppel.melde.mockClear();
        const datei = {
            size: AUSTAUSCHDATEI_GRENZEN.bytes + 1,
            text: vi.fn(async () => '{"typ":"foxi-liste"}')
        };
        let beiAenderung;
        let abgeschlossen;
        const feld = {
            files: [datei],
            addEventListener: vi.fn((art, rueckruf) => {
                if (art === 'change') beiAenderung = rueckruf;
            }),
            click: vi.fn(() => { abgeschlossen = beiAenderung(); }),
            remove: vi.fn()
        };
        const anhaengen = vi.fn();
        vi.stubGlobal('document', {
            createElement: vi.fn(() => feld),
            body: { append: anhaengen }
        });

        try {
            dateiEinlesen();
            await abgeschlossen;
            expect(anhaengen).toHaveBeenCalledWith(feld);
            expect(datei.text).not.toHaveBeenCalled();
            expect(teilenUiDoppel.melde).toHaveBeenCalledWith('teilen.kaputteDatei');
        } finally {
            vi.unstubAllGlobals();
        }
    });
});

describe('Zusammenführung', () => {
    const eigeneListe = new Map([
        ['milch', { artikelId: 'milch', menge: '', notiz: '' }],
        ['brot', { artikelId: 'brot', menge: '1', notiz: '' }]
    ]);

    const fremd = [
        { id: 'milch', name: 'Milch', menge: '', notiz: '' },        // identisch
        { id: 'brot', name: 'Brot', menge: '2', notiz: '' },         // andere Menge
        { id: 'butter', name: 'Butter', menge: '', notiz: '' }       // neu
    ];

    it('trennt neu, unverändert und abweichend', () => {
        const ergebnis = vergleicheImport(fremd, eigeneListe);
        expect(ergebnis.neu.map((a) => a.id)).toEqual(['butter']);
        expect(ergebnis.doppelt.map((a) => a.id)).toEqual(['milch']);
        expect(ergebnis.abweichend.map((a) => a.id)).toEqual(['brot']);
    });

    it('zählt eine abweichende Notiz genauso als Abweichung wie eine Menge', () => {
        const ergebnis = vergleicheImport(
            [{ id: 'milch', menge: '', notiz: 'die kleinen' }],
            eigeneListe
        );
        expect(ergebnis.abweichend).toHaveLength(1);
        expect(ergebnis.doppelt).toHaveLength(0);
    });

    it('behandelt fehlende und leere Angaben gleich', () => {
        const ergebnis = vergleicheImport([{ id: 'milch', name: 'Milch' }], eigeneListe);
        expect(ergebnis.doppelt).toHaveLength(1);
    });

    it('erkennt einen lokal erledigten Artikel als erneut benötigt', () => {
        const listeMitErledigterMilch = new Map(eigeneListe);
        listeMitErledigterMilch.set('milch', {
            artikelId: 'milch', menge: '', notiz: '', erledigt: true, erledigtAm: JETZT
        });

        const ergebnis = vergleicheImport(
            [{ id: 'milch', name: 'Milch', menge: '', notiz: '' }],
            listeMitErledigterMilch
        );

        expect(ergebnis.doppelt).toHaveLength(0);
        expect(ergebnis.abweichend.map((a) => a.id)).toEqual(['milch']);
    });

    it('meldet bei leerer Datei nichts als neu', () => {
        expect(vergleicheImport([], eigeneListe)).toEqual({ neu: [], doppelt: [], abweichend: [] });
    });
});

describe('Statistik', () => {
    const artikel = [
        { id: 'a', name: 'Milch', icon: '🥛', letzteKaeufe: [JETZT, JETZT - TAG_MS, JETZT - 2 * TAG_MS] },
        { id: 'b', name: 'Brot', icon: '🍞', letzteKaeufe: [JETZT - TAG_MS] },
        { id: 'c', name: 'Kapern', icon: '🫙', letzteKaeufe: [] }
    ];

    it('zählt roh und sortiert absteigend', () => {
        const zeilen = kaufStatistik(artikel);
        expect(zeilen.map((z) => z.artikel.name)).toEqual(['Milch', 'Brot']);
        expect(zeilen[0].anzahl).toBe(3);
    });

    it('lässt nie Gekauftes weg statt es mit null zu zeigen', () => {
        expect(kaufStatistik(artikel).some((z) => z.artikel.id === 'c')).toBe(false);
    });

    it('merkt sich den jüngsten Kauf', () => {
        expect(kaufStatistik(artikel)[0].zuletzt).toBe(JETZT);
    });

    it('deckelt auf die gewünschte Anzahl', () => {
        const viele = Array.from({ length: 40 }, (_, i) => ({
            id: `a${i}`, name: `Artikel ${i}`, letzteKaeufe: [JETZT]
        }));
        expect(kaufStatistik(viele, 15)).toHaveLength(15);
    });
});
