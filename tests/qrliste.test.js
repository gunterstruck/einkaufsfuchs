import { beforeAll, describe, expect, it } from 'vitest';
import {
    alsQrNutzlast, qrAdresse, qrAnteilAusAdresse, pruefeQrListe, alsImportartikel,
    nachBase64Url, ausBase64Url, QR_TYP, QR_GRENZEN
} from '../src/qrliste.js';
import { qrErzeugen } from '../src/qrcode.js';

/* `btoa`/`atob` gibt es in Node erst über den Umweg über Buffer nicht – in
   aktuellen Fassungen sind sie global vorhanden. Der Test sichert das ab,
   damit ein Fehlschlag nicht nach einem Formatfehler aussieht. */
beforeAll(() => {
    expect(typeof btoa).toBe('function');
    expect(typeof atob).toBe('function');
});

const katalog = new Map([
    ['milch', { id: 'milch', name: 'Milch', kategorieId: 'molkerei', icon: '🥛', eigen: false }],
    ['aepfel', { id: 'aepfel', name: 'Äpfel', kategorieId: 'obst', icon: '🍎', eigen: false }],
    ['eigen-1', { id: 'eigen-1', name: 'Spezialität vom Markt', kategorieId: 'sonstiges', icon: '🛒', eigen: true }]
]);

const eintraege = [
    { artikelId: 'milch', menge: '2 Liter' },
    { artikelId: 'aepfel', menge: '' },
    { artikelId: 'eigen-1', menge: 'zwei Stück' }
];

describe('Verpackung', () => {
    it('überlebt Umlaute und Emoji', () => {
        const text = 'Äpfel 🍎 · Müsli – 1 kg';
        expect(ausBase64Url(nachBase64Url(text))).toBe(text);
    });

    /* base64url darf in einer Adresse nicht maskiert werden müssen. */
    it('erzeugt nur adressfeste Zeichen', () => {
        expect(nachBase64Url('Milch 🥛 · Äpfel?&=#')).toMatch(/^[A-Za-z0-9_-]+$/);
    });
});

describe('Die Liste als Nutzlast', () => {
    it('nimmt Kennung, Bezeichnung und Menge mit', () => {
        const nutzlast = alsQrNutzlast(eintraege, katalog);
        expect(nutzlast.t).toBe(QR_TYP);
        expect(nutzlast.a[0]).toEqual({ i: 'milch', b: 'Milch', m: '2 Liter' });
        /* Ohne Produktwunsch bleibt das Feld weg statt leer dazustehen. */
        expect(nutzlast.a[1]).toEqual({ i: 'aepfel', b: 'Äpfel' });
    });

    /* Kategorie und Zeichen stehen für Katalogartikel auf dem anderen Gerät
       ohnehin. Nur was dort fehlen kann, fährt vollständig mit. */
    it('trägt Kategorie und Zeichen nur bei selbst angelegten Artikeln', () => {
        const nutzlast = alsQrNutzlast(eintraege, katalog);
        expect(nutzlast.a[0].k).toBeUndefined();
        expect(nutzlast.a[2]).toMatchObject({ i: 'eigen-1', k: 'sonstiges', s: '🛒' });
    });

    it('überspringt Einträge, deren Artikel es nicht mehr gibt', () => {
        const nutzlast = alsQrNutzlast([...eintraege, { artikelId: 'weg', menge: '' }], katalog);
        expect(nutzlast.a).toHaveLength(3);
    });

    it('trägt die Teilmarke, auch wenn es nur einen Teil gibt', () => {
        expect(alsQrNutzlast(eintraege, katalog)).toMatchObject({ n: 1, g: 1 });
    });
});

describe('Die Adresse', () => {
    let adresse;
    beforeAll(async () => {
        adresse = await qrAdresse(alsQrNutzlast(eintraege, katalog), 'https://beispiel.de/');
    });

    /* Alles hinter der Raute schickt kein Browser zu einem Server. Genau
       daran hängt, dass dieser Weg Grundsatz I nicht bricht. */
    it('legt die Daten hinter die Raute', () => {
        expect(/^https:\/\/beispiel\.de\/#lz?=/.test(adresse)).toBe(true);
        expect(adresse.slice(0, adresse.indexOf('#'))).not.toContain('milch');
    });

    it('findet ihren Anteil wieder', async () => {
        const anteil = qrAnteilAusAdresse(adresse.slice(adresse.indexOf('#')));
        expect((await pruefeQrListe(anteil)).gueltig).toBe(true);
    });

    it('lässt fremde Anker in Ruhe', () => {
        expect(qrAnteilAusAdresse('#bereich=katalog')).toBeNull();
        expect(qrAnteilAusAdresse('')).toBeNull();
        expect(qrAnteilAusAdresse('#l=abc&x=1')).toMatchObject({ wert: 'abc', gepackt: false });
        expect(qrAnteilAusAdresse('#lz=abc')).toMatchObject({ wert: 'abc', gepackt: true });
    });

    it('weist einen übergroßen Anker ab, bevor er entpackt wird', () => {
        expect(qrAnteilAusAdresse(`#l=${'a'.repeat(QR_GRENZEN.zeichen + 1)}`)).toBeNull();
    });
});

/**
 * Was hereinkommt, ist fremd: Eine Adresse kann jeder schicken. Deshalb hier
 * dieselbe Strenge wie bei `pruefeAngebotsergebnis()` – und im Zweifel ein
 * Grund statt eines bloßen „ungültig".
 */
describe('Prüfung eingehender Daten', () => {
    const verpackt = (wert) => nachBase64Url(JSON.stringify(wert));
    const gut = { t: QR_TYP, v: 1, n: 1, g: 1, a: [{ i: 'milch', b: 'Milch', m: '2 l' }] };

    it('nimmt eine saubere Liste an', async () => {
        const ergebnis = await pruefeQrListe(verpackt(gut));
        expect(ergebnis.gueltig).toBe(true);
        expect(ergebnis.daten.a).toHaveLength(1);
    });

    it('weist alles ab, was keine Foxi-Liste ist', async () => {
        expect((await pruefeQrListe(verpackt({ t: 'etwas-anderes', v: 1, a: [] }))).grund).toBe('fremd');
        expect((await pruefeQrListe('kein base64url ###')).grund).toBe('kaputt');
        expect((await pruefeQrListe(verpackt([1, 2, 3]))).grund).toBe('kaputt');
        expect((await pruefeQrListe(verpackt({ ...gut, a: 'keine Liste' }))).grund).toBe('kaputt');
    });

    it('weist eine neuere Formatfassung als solche ab', async () => {
        expect((await pruefeQrListe(verpackt({ ...gut, v: 99 }))).grund).toBe('zuNeu');
    });

    it('sagt bei einem mehrteiligen Code, dass es daran liegt', async () => {
        expect((await pruefeQrListe(verpackt({ ...gut, n: 1, g: 2 }))).grund).toBe('mehrteilig');
        expect((await pruefeQrListe(verpackt({ ...gut, n: 3, g: 2 }))).grund).toBe('kaputt');
    });

    it('weist Artikel ohne Kennung oder Bezeichnung ab', async () => {
        expect((await pruefeQrListe(verpackt({ ...gut, a: [{ b: 'Milch' }] }))).grund).toBe('kaputt');
        expect((await pruefeQrListe(verpackt({ ...gut, a: [{ i: 'milch' }] }))).grund).toBe('kaputt');
        expect((await pruefeQrListe(verpackt({ ...gut, a: [{ i: '  ', b: 'Milch' }] }))).grund).toBe('kaputt');
    });

    it('weist Felder ab, die keine Zeichenketten sind', async () => {
        expect((await pruefeQrListe(verpackt({ ...gut, a: [{ i: 'milch', b: 'Milch', m: 42 }] }))).grund).toBe('kaputt');
        expect((await pruefeQrListe(verpackt({ ...gut, a: [{ i: 'milch', b: 'Milch', s: { x: 1 } }] }))).grund).toBe('kaputt');
    });

    it('weist überlange Felder und überlange Listen ab', async () => {
        const langeMenge = { i: 'milch', b: 'Milch', m: 'x'.repeat(QR_GRENZEN.menge + 1) };
        expect((await pruefeQrListe(verpackt({ ...gut, a: [langeMenge] }))).grund).toBe('kaputt');
        const vieleArtikel = Array.from({ length: QR_GRENZEN.artikelAnzahl + 1 },
            (_, i) => ({ i: `a${i}`, b: `Artikel ${i}` }));
        expect((await pruefeQrListe(verpackt({ ...gut, a: vieleArtikel }))).grund).toBe('kaputt');
    });
});

/**
 * Warum überhaupt gepackt wird – und der Beleg, dass es nötig ist.
 *
 * JSON mit immer denselben kurzen Schlüsseln lässt sich hervorragend packen.
 * Ohne Packung passt ein Wocheneinkauf in **keinen** QR-Code; das ist keine
 * Feinheit, sondern der Unterschied zwischen brauchbar und nutzlos.
 */
describe('Packen', () => {
    const wocheneinkauf = Array.from({ length: 25 }, (_, i) => ({
        artikelId: `artikel-${i}`,
        menge: i % 4 === 0 ? '2 Liter' : ''
    }));
    const grosserKatalog = new Map(wocheneinkauf.map((e, i) => [e.artikelId, {
        id: e.artikelId, name: `Beispielartikel ${i}`, kategorieId: 'sonstiges',
        icon: '🛒', eigen: false
    }]));

    it('macht die Adresse deutlich kürzer', async () => {
        const nutzlast = alsQrNutzlast(wocheneinkauf, grosserKatalog);
        const gepackt = await qrAdresse(nutzlast, 'https://beispiel.de/');
        const roh = `https://beispiel.de/#l=${nachBase64Url(JSON.stringify(nutzlast))}`;
        expect(gepackt.includes('#lz=')).toBe(true);
        expect(gepackt.length).toBeLessThan(roh.length * 0.6);
    });

    /* Die eigentliche Abnahme: Ein Wocheneinkauf muss in einen einzigen Code
       passen, und zwar in einen, den eine Handykamera vom Bildschirm noch
       liest. Version 20 sind 97×97 Module – das ist die Grenze, die ich
       dafür setze. */
    it('lässt einen Wocheneinkauf in einen lesbaren Code passen', async () => {
        const adresse = await qrAdresse(alsQrNutzlast(wocheneinkauf, grosserKatalog), 'https://beispiel.de/');
        const code = qrErzeugen(adresse, { stufe: 'L' });
        expect(code.version).toBeLessThanOrEqual(20);
    });

    it('liest den gepackten Code wieder', async () => {
        const adresse = await qrAdresse(alsQrNutzlast(wocheneinkauf, grosserKatalog), 'https://beispiel.de/');
        const pruefung = await pruefeQrListe(qrAnteilAusAdresse(adresse.slice(adresse.indexOf('#'))));
        expect(pruefung.gueltig).toBe(true);
        expect(pruefung.daten.a).toHaveLength(25);
    });

    /* Ein gepackter Anteil, der kein gültiges Paket ist, darf nicht werfen –
       er kommt von außen. */
    it('verschluckt sich nicht an einem kaputten Paket', async () => {
        expect((await pruefeQrListe({ wert: 'nicht-wirklich-gepackt', gepackt: true })).gueltig).toBe(false);
    });
});

describe('Rundlauf', () => {
    it('kommt am anderen Ende unverändert an', async () => {
        const adresse = await qrAdresse(alsQrNutzlast(eintraege, katalog), 'https://beispiel.de/');
        const pruefung = await pruefeQrListe(qrAnteilAusAdresse(adresse.slice(adresse.indexOf('#'))));
        const artikel = alsImportartikel(pruefung.daten);

        expect(artikel).toHaveLength(3);
        expect(artikel[0]).toMatchObject({ id: 'milch', name: 'Milch', menge: '2 Liter' });
        expect(artikel[2]).toMatchObject({ id: 'eigen-1', kategorieId: 'sonstiges', icon: '🛒' });
        /* Die Form muss zum Datei-Import passen – beide teilen sich Dialog
           und Übernahme. */
        for (const satz of artikel) {
            expect(Object.keys(satz).sort()).toEqual(
                ['icon', 'id', 'kategorieId', 'kategorieName', 'menge', 'name', 'notiz']
            );
        }
    });
});
