import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbDoppel = vi.hoisted(() => ({
    lege: vi.fn(async () => {}),
    legeViele: vi.fn(async () => {})
}));

vi.mock('../src/db.js', () => ({
    SPEICHER: {
        ARTIKEL: 'artikel',
        LISTE: 'liste'
    },
    lege: dbDoppel.lege,
    legeViele: dbDoppel.legeViele
}));

import { abhaken, importAnwenden, zurueckholen, zustand } from '../src/zustand.js';

describe('Listenimport', () => {
    beforeEach(() => {
        dbDoppel.legeViele.mockClear();
        zustand.kategorien = [{ id: 'molkerei' }];
        zustand.artikel = new Map([[
            'milch',
            {
                id: 'milch', name: 'Milch', kategorieId: 'molkerei', icon: '🥛',
                zaehler: 0, letzteKaeufe: [], standardWunsch: '6 Liter'
            }
        ]]);
        zustand.liste = new Map([[
            'milch',
            { artikelId: 'milch', menge: '6 Liter', notiz: '', erledigt: false, erledigtAm: null }
        ]]);
    });

    it('löscht beim vollständigen Übernehmen auch einen gespeicherten Produktwunsch', async () => {
        const anzahl = await importAnwenden([{
            id: 'milch', name: 'Milch', kategorieId: 'molkerei', icon: '🥛', menge: '', notiz: ''
        }], 'alles');

        expect(anzahl).toBe(1);
        expect(zustand.artikel.get('milch').standardWunsch).toBe('');
        expect(zustand.liste.get('milch')).toMatchObject({
            menge: '', notiz: '', erledigt: false, erledigtAm: null
        });
        expect(dbDoppel.legeViele).toHaveBeenCalledWith(
            'artikel',
            [expect.objectContaining({ id: 'milch', standardWunsch: '' })]
        );
    });

    it('lässt beim Modus nurNeue den vorhandenen Produktwunsch unangetastet', async () => {
        const anzahl = await importAnwenden([{
            id: 'milch', name: 'Milch', kategorieId: 'molkerei', icon: '🥛', menge: '', notiz: ''
        }], 'nurNeue');

        expect(anzahl).toBe(0);
        expect(zustand.artikel.get('milch').standardWunsch).toBe('6 Liter');
        expect(zustand.liste.get('milch').menge).toBe('6 Liter');
        expect(dbDoppel.legeViele).not.toHaveBeenCalled();
    });

    it('reaktiviert bei nurNeue einen erledigten Artikel mit seinen lokalen Angaben', async () => {
        zustand.liste.set('milch', {
            artikelId: 'milch',
            menge: '6 Liter',
            notiz: 'lokale Notiz',
            erledigt: true,
            erledigtAm: 123456789
        });

        const anzahl = await importAnwenden([{
            id: 'milch', name: 'Milch', kategorieId: 'molkerei', icon: '🥛',
            menge: '1 Liter', notiz: 'fremde Notiz'
        }], 'nurNeue');

        expect(anzahl).toBe(1);
        expect(zustand.artikel.get('milch').standardWunsch).toBe('6 Liter');
        expect(zustand.liste.get('milch')).toEqual({
            artikelId: 'milch',
            menge: '6 Liter',
            notiz: 'lokale Notiz',
            erledigt: false,
            erledigtAm: null
        });
        expect(dbDoppel.legeViele).toHaveBeenCalledTimes(1);
        expect(dbDoppel.legeViele).toHaveBeenCalledWith(
            'liste',
            [expect.objectContaining({ artikelId: 'milch', menge: '6 Liter', erledigt: false })]
        );
    });

    /* Der Produktwunsch hängt nicht an der Liste: Er entsteht beim Abhaken,
       steht im Artikelblatt und setzt die Vorgabe für jedes künftige
       Aufnehmen. Eine fremde Liste, in der der Artikel gerade nicht steht,
       hat ihn trotzdem einmal überschrieben – „nur neue" verspricht das
       Gegenteil. */
    it('lässt bei nurNeue den Produktwunsch auch dann stehen, wenn der Artikel nicht auf der Liste ist', async () => {
        zustand.liste = new Map();

        const anzahl = await importAnwenden([{
            id: 'milch', name: 'Milch', kategorieId: 'molkerei', icon: '🥛',
            menge: '1 Liter fettarm', notiz: ''
        }], 'nurNeue');

        expect(anzahl).toBe(1);
        expect(zustand.artikel.get('milch').standardWunsch).toBe('6 Liter');
        expect(zustand.liste.get('milch').menge).toBe('6 Liter');
    });

    /* Die Gegenprobe: Ohne eigenen Wunsch wird der aus der Datei übernommen.
       Das überschreibt nichts – es ist der erste Eintrag. */
    it('übernimmt bei nurNeue den Wunsch aus der Datei, wenn der Artikel noch keinen hat', async () => {
        zustand.liste = new Map();
        delete zustand.artikel.get('milch').standardWunsch;

        await importAnwenden([{
            id: 'milch', name: 'Milch', kategorieId: 'molkerei', icon: '🥛',
            menge: '1 Liter fettarm', notiz: ''
        }], 'nurNeue');

        expect(zustand.artikel.get('milch').standardWunsch).toBe('1 Liter fettarm');
        expect(zustand.liste.get('milch').menge).toBe('1 Liter fettarm');
    });

    it('behandelt reine Leerzeichen in Menge und Notiz als leeren Wunsch', async () => {
        const anzahl = await importAnwenden([{
            id: 'milch', name: 'Milch', kategorieId: 'molkerei', icon: '🥛',
            menge: '   ', notiz: '\n\t'
        }], 'alles');

        expect(anzahl).toBe(1);
        expect(zustand.artikel.get('milch').standardWunsch).toBe('');
        expect(zustand.liste.get('milch').menge).toBe('');
        expect(zustand.liste.get('milch').menge).not.toContain('·');
    });
});

/* Das Abhaken ist der einzige Ort, an dem Foxi etwas lernt – und damit auch
   der einzige, an dem ein Produktwunsch zum Vorschlag wird. Ein nur getippter
   Wunsch zählt bewusst nicht: Er lag nie im Wagen. */
describe('Gelernte Mengen beim Abhaken', () => {
    beforeEach(() => {
        dbDoppel.lege.mockClear();
        zustand.artikel = new Map([[
            'milch',
            { id: 'milch', name: 'Milch', kategorieId: 'molkerei', icon: '🥛', zaehler: 0, letzteKaeufe: [] }
        ]]);
        zustand.liste = new Map([[
            'milch',
            { artikelId: 'milch', menge: '2 Liter', notiz: '', erledigt: false, erledigtAm: null }
        ]]);
    });

    it('merkt sich den Produktwunsch, der beim Abhaken an der Zeile stand', async () => {
        await abhaken('milch');
        const artikel = zustand.artikel.get('milch');
        expect(artikel.letzteMengen).toHaveLength(1);
        expect(artikel.letzteMengen[0].text).toBe('2 Liter');
        /* Derselbe Zeitstempel wie in `letzteKaeufe` und `erledigtAm` – daran
           findet „Rückgängig" den Eintrag wieder. */
        expect(artikel.letzteMengen[0].zeit).toBe(zustand.liste.get('milch').erledigtAm);
        expect(artikel.letzteMengen[0].zeit).toBe(artikel.letzteKaeufe.at(-1));
    });

    it('merkt sich nichts, wenn die Zeile ohne Produktwunsch abgehakt wird', async () => {
        zustand.liste.get('milch').menge = '   ';
        await abhaken('milch');
        expect(zustand.artikel.get('milch').letzteMengen).toBeUndefined();
    });

    /* „Rückgängig" heißt rückgängig. Bliebe der gelernte Wunsch stehen,
       schlüge Foxi im Blatt etwas vor, das nie gekauft wurde. */
    it('nimmt den gelernten Wunsch beim Zurückholen wieder zurück', async () => {
        await abhaken('milch');
        await zurueckholen('milch');
        expect(zustand.artikel.get('milch').letzteMengen).toEqual([]);
        expect(zustand.artikel.get('milch').letzteKaeufe).toEqual([]);
    });

    it('kappt die Historie bei 20 Einträgen', async () => {
        const artikel = zustand.artikel.get('milch');
        artikel.letzteMengen = Array.from({ length: 20 }, (_, i) => ({ text: `${i} Liter`, zeit: i + 1 }));
        await abhaken('milch');
        expect(artikel.letzteMengen).toHaveLength(20);
        expect(artikel.letzteMengen[0].text).toBe('1 Liter');
        expect(artikel.letzteMengen.at(-1).text).toBe('2 Liter');
    });
});
