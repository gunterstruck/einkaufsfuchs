import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const doppel = vi.hoisted(() => ({
    aenderung: null,
    bereichswechsel: null,
    aktiverBereich: 'liste',
    angedockt: false,
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
    }),
    katalogAngedockt: vi.fn(() => doppel.angedockt)
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

/* Seit dem QR-Code hängt `app.js` auch am Teilen-Modul: Es liest beim
   Start den Adressanker. Hier steht nur ein Doppel – geprüft wird der Weg
   in `tests/qrliste.test.js` und im Durchlauf. */
vi.mock('../src/ui/teilen.js', () => ({ qrAusAdresseUebernehmen: vi.fn(async () => false) }));

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

    /* Am Schreibtisch steht der Katalog dauerhaft links. Dann ist er nicht
       mehr „der Bereich, den niemand ansieht" – er muss mitgezeichnet
       werden, sonst steht dort eine veraltete Kachelwand. */
    it('zeichnet den angedockten Katalog mit, obwohl die Liste vorn steht', async () => {
        doppel.angedockt = true;
        await wechsleZu('liste');
        doppel.zeichneKatalog.mockClear();

        doppel.aenderung('abhaken');
        expect(doppel.zeichneKatalog).toHaveBeenCalledOnce();

        /* Ein Artikel, der nur auf die Liste wandert, ändert keine
           Reihenfolge. Dafür 480 Kacheln neu zu bauen wäre bei jedem Tipp
           spürbar – eine Kachel wechselt die Farbe, mehr nicht. */
        doppel.zeichneKatalog.mockClear();
        doppel.synchronisiereKacheln.mockClear();
        doppel.aenderung('liste');
        expect(doppel.zeichneKatalog).not.toHaveBeenCalled();
        expect(doppel.synchronisiereKacheln).toHaveBeenCalledOnce();

        doppel.angedockt = false;
    });
});
