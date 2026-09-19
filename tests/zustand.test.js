import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbDoppel = vi.hoisted(() => ({
    legeViele: vi.fn(async () => {})
}));

vi.mock('../src/db.js', () => ({
    SPEICHER: {
        ARTIKEL: 'artikel',
        LISTE: 'liste'
    },
    legeViele: dbDoppel.legeViele
}));

import { importAnwenden, zustand } from '../src/zustand.js';

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
