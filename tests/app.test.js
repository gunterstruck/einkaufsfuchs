import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const doppel = vi.hoisted(() => ({
    aenderung: null,
    bereichswechsel: null,
    aktiverBereich: 'liste',
    fensterZuhoerer: new Map(),
    dokumentZuhoerer: new Map(),
    zeichneListe: vi.fn(),
    zeichneKatalog: vi.fn(),
    synchronisiereKacheln: vi.fn(),
    zeichneMehr: vi.fn()
}));

vi.mock('../src/zustand.js', () => ({
    starte: vi.fn(async () => {}),
    beiAenderung: vi.fn((rueckruf) => { doppel.aenderung = rueckruf; })
}));

vi.mock('../src/ui/schale.js', () => ({
    schaleVerdrahten: vi.fn(),
    aktiverBereich: vi.fn(() => doppel.aktiverBereich),
    beiBereichswechsel: vi.fn((rueckruf) => { doppel.bereichswechsel = rueckruf; }),
    zeigeBereich: vi.fn((bereich) => {
        doppel.aktiverBereich = bereich;
        doppel.bereichswechsel?.(bereich);
    })
}));

vi.mock('../src/ui/liste.js', () => ({
    listeVerdrahten: vi.fn(),
    zeichneListe: doppel.zeichneListe
}));

vi.mock('../src/ui/katalog.js', () => ({
    katalogVerdrahten: vi.fn(),
    zeichneKatalog: doppel.zeichneKatalog,
    synchronisiereKacheln: doppel.synchronisiereKacheln
}));

vi.mock('../src/ui/mehr.js', () => ({
    mehrVerdrahten: vi.fn(),
    zeichneMehr: doppel.zeichneMehr
}));

vi.mock('../src/pwa-update.js', () => ({ initPwaUpdate: vi.fn() }));

async function wechsleZu(bereich) {
    doppel.aktiverBereich = bereich;
    doppel.bereichswechsel?.(bereich);
    await Promise.resolve();
}

describe('Aktualisierung der Ansichten', () => {
    beforeAll(async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 8, 20, 23, 59, 58));

        vi.stubGlobal('window', {
            addEventListener: vi.fn((art, rueckruf) => doppel.fensterZuhoerer.set(art, rueckruf)),
            setTimeout,
            clearTimeout
        });
        vi.stubGlobal('document', {
            visibilityState: 'visible',
            addEventListener: vi.fn((art, rueckruf) => doppel.dokumentZuhoerer.set(art, rueckruf)),
            getElementById: vi.fn(() => null)
        });

        await import('../src/app.js');
        await Promise.resolve();
        await Promise.resolve();
    });

    afterAll(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('synchronisiert Katalogkacheln auch dann, wenn der Katalog gerade verdeckt ist', async () => {
        await wechsleZu('katalog');
        await wechsleZu('mehr');
        doppel.synchronisiereKacheln.mockClear();

        doppel.aenderung('liste');

        expect(doppel.synchronisiereKacheln).toHaveBeenCalledOnce();
    });

    it('zeichnet datumsabhängige Ansichten am Tageswechsel und bei Rückkehr neu', async () => {
        await wechsleZu('mehr');
        await wechsleZu('liste');
        doppel.zeichneListe.mockClear();
        doppel.zeichneMehr.mockClear();

        await vi.advanceTimersByTimeAsync(3000);
        expect(doppel.zeichneListe).toHaveBeenCalledOnce();

        await wechsleZu('mehr');
        expect(doppel.zeichneMehr).toHaveBeenCalledOnce();

        doppel.zeichneMehr.mockClear();
        vi.setSystemTime(new Date(2026, 8, 22, 12, 0, 0));
        doppel.fensterZuhoerer.get('focus')?.();
        expect(doppel.zeichneMehr).toHaveBeenCalledOnce();
    });
});
