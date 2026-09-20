import { describe, it, expect } from 'vitest';
import {
    kaufScore, sortiereArtikel, oftGebraucht, sucheArtikel, gelernteMengen,
    gruppiereListe, alsKlartext, alsStammartikelText, kaufStatistik,
    TAG_MS, HALBWERTSZEIT_TAGE
} from '../src/logik.js';

const JETZT = new Date('2026-08-30T10:00:00Z').getTime();

function artikel(id, name, kategorieId = 'obst', kaeufe = []) {
    return { id, name, kategorieId, icon: '🛒', zaehler: kaeufe.length, letzteKaeufe: kaeufe };
}

/** n Käufe, jeweils `abstandTage` auseinander, der letzte `vorTagen` her. */
function kaufreihe(n, abstandTage = 7, vorTagen = 0) {
    return Array.from({ length: n }, (_, i) => JETZT - (vorTagen + i * abstandTage) * TAG_MS);
}

describe('kaufScore', () => {
    it('ist ohne Käufe null', () => {
        expect(kaufScore([], JETZT)).toBe(0);
        expect(kaufScore(undefined, JETZT)).toBe(0);
    });

    it('zählt einen Kauf von heute voll', () => {
        expect(kaufScore([JETZT], JETZT)).toBeCloseTo(1, 6);
    });

    it('halbiert einen Kauf nach der Halbwertszeit', () => {
        const vorEinerHalbwertszeit = JETZT - HALBWERTSZEIT_TAGE * TAG_MS;
        expect(kaufScore([vorEinerHalbwertszeit], JETZT)).toBeCloseTo(0.5, 6);
    });

    it('gewichtet frische Käufe höher als alte', () => {
        const frisch = kaufScore(kaufreihe(3, 7, 0), JETZT);
        const alt = kaufScore(kaufreihe(3, 7, 180), JETZT);
        expect(frisch).toBeGreaterThan(alt * 10);
    });
});

describe('der lernende Katalog', () => {
    /* Abnahmekriterium 5: „Nach zehn simulierten Einkäufen stehen die
       häufigsten Artikel oben im Katalog." */
    it('hebt nach zehn Einkäufen die häufigsten Artikel nach oben', () => {
        const standard = ['Milch', 'Brot', 'Butter'];
        const rest = ['Zimt', 'Kapern', 'Sardellenpaste', 'Vanilleextrakt', 'Lorbeerblätter'];

        const katalog = [
            ...rest.map((name, i) => artikel(`selten-${i}`, name)),
            ...standard.map((name, i) => artikel(`oft-${i}`, name, 'obst', kaufreihe(10, 7)))
        ];
        /* Ein Ausreißer: einmal gekauft, aber gestern. */
        katalog.push(artikel('einmal', 'Ananas', 'obst', [JETZT - TAG_MS]));

        const sortiert = sortiereArtikel(katalog, JETZT);
        expect(sortiert.slice(0, 3).map((a) => a.name).sort()).toEqual(['Brot', 'Butter', 'Milch']);
        expect(sortiert[3].name).toBe('Ananas');
        /* Nie Gekauftes steht hinten – und dort alphabetisch, nicht zufällig. */
        expect(sortiert.slice(4).map((a) => a.name))
            .toEqual(['Kapern', 'Lorbeerblätter', 'Sardellenpaste', 'Vanilleextrakt', 'Zimt']);
    });

    it('zeigt „Oft gebraucht" nur für tatsächlich Gekauftes', () => {
        const katalog = [
            artikel('a', 'Milch', 'obst', kaufreihe(5, 7)),
            artikel('b', 'Brot', 'obst', kaufreihe(3, 7)),
            artikel('c', 'Kapern')
        ];
        const oft = oftGebraucht(katalog, 12, JETZT);
        expect(oft.map((a) => a.name)).toEqual(['Milch', 'Brot']);
    });

    it('deckelt „Oft gebraucht" auf die gewünschte Anzahl', () => {
        const katalog = Array.from({ length: 30 }, (_, i) =>
            artikel(`a${i}`, `Artikel ${i}`, 'obst', kaufreihe(i + 1, 7))
        );
        expect(oftGebraucht(katalog, 12, JETZT)).toHaveLength(12);
    });
});

describe('Suche', () => {
    const katalog = [
        artikel('milch', 'Milch'),
        artikel('mandelmilch', 'Mandelmilch'),
        artikel('milchreis', 'Milchreis'),
        artikel('h-milch', 'H-Milch'),
        artikel('brot', 'Brot')
    ];

    it('stellt den Wortanfang vor die Wortmitte', () => {
        const treffer = sucheArtikel(katalog, 'milch', JETZT).map((a) => a.name);
        expect(treffer[0]).toBe('Milch');
        expect(treffer.indexOf('H-Milch')).toBeLessThan(treffer.indexOf('Mandelmilch'));
    });

    it('findet ohne Rücksicht auf Umlaute und Groß-/Kleinschreibung', () => {
        const mitUmlaut = [artikel('kaese', 'Käse')];
        expect(sucheArtikel(mitUmlaut, 'KASE', JETZT)).toHaveLength(1);
        expect(sucheArtikel(mitUmlaut, 'käse', JETZT)).toHaveLength(1);
    });

    it('gibt bei leerem Begriff nichts zurück', () => {
        expect(sucheArtikel(katalog, '   ', JETZT)).toEqual([]);
    });
});

describe('Gelernte Mengen', () => {
    const verlauf = [
        { text: '1 Liter', zeit: 1 },
        { text: '2 Liter', zeit: 2 },
        { text: '1 Liter', zeit: 3 },
        { text: 'die haltbare', zeit: 4 }
    ];

    it('schlägt die jüngsten Wünsche zuerst vor, jeden Wortlaut nur einmal', () => {
        expect(gelernteMengen(verlauf)).toEqual(['die haltbare', '1 Liter', '2 Liter']);
    });

    it('zeigt höchstens drei', () => {
        const viele = ['a', 'b', 'c', 'd', 'e'].map((text, i) => ({ text, zeit: i }));
        expect(gelernteMengen(viele)).toEqual(['e', 'd', 'c']);
    });

    /* Ein Vorschlag, der genau das einsetzt, was schon im Feld steht, ist
       kein Vorschlag, sondern ein Knopf, der nichts tut. */
    it('lässt weg, was ohnehin schon im Feld steht', () => {
        expect(gelernteMengen(verlauf, 'die haltbare')).toEqual(['1 Liter', '2 Liter']);
        expect(gelernteMengen(verlauf, '  DIE HALTBARE ')).toEqual(['1 Liter', '2 Liter']);
    });

    it('behält die zuletzt getippte Schreibweise', () => {
        const gemischt = [{ text: '2 LITER', zeit: 1 }, { text: '2 liter', zeit: 2 }];
        expect(gelernteMengen(gemischt)).toEqual(['2 liter']);
    });

    it('kommt mit fehlender Historie und kaputten Einträgen zurecht', () => {
        expect(gelernteMengen(undefined)).toEqual([]);
        expect(gelernteMengen([{ zeit: 1 }, { text: '   ', zeit: 2 }, null])).toEqual([]);
    });
});

describe('Gruppierung der Liste', () => {
    const kategorien = [
        { id: 'molkerei', name: 'Molkerei', icon: '🧀', position: 1 },
        { id: 'obst', name: 'Obst & Gemüse', icon: '🥕', position: 0 },
        { id: 'trocken', name: 'Trocken', icon: '🍝', position: 2 }
    ];
    const artikelNachId = new Map([
        ['milch', artikel('milch', 'Milch', 'molkerei')],
        ['butter', artikel('butter', 'Butter', 'molkerei')],
        ['karotten', artikel('karotten', 'Karotten', 'obst')]
    ]);
    const eintraege = [
        { artikelId: 'milch', menge: '2', notiz: '', erledigt: false },
        { artikelId: 'karotten', menge: '1kg', notiz: '', erledigt: false },
        { artikelId: 'butter', menge: '', notiz: '', erledigt: false }
    ];

    it('folgt der eingestellten Kategorie-Reihenfolge', () => {
        const gruppen = gruppiereListe(eintraege, artikelNachId, kategorien);
        expect(gruppen.map((g) => g.kategorie.id)).toEqual(['obst', 'molkerei']);
    });

    it('lässt leere Kategorien weg', () => {
        const gruppen = gruppiereListe(eintraege, artikelNachId, kategorien);
        expect(gruppen.some((g) => g.kategorie.id === 'trocken')).toBe(false);
    });

    it('sortiert innerhalb der Gruppe alphabetisch', () => {
        const gruppen = gruppiereListe(eintraege, artikelNachId, kategorien);
        const molkerei = gruppen.find((g) => g.kategorie.id === 'molkerei');
        expect(molkerei.eintraege.map((e) => e.artikel.name)).toEqual(['Butter', 'Milch']);
    });

    it('fängt Artikel mit unbekannter Kategorie auf, statt sie zu verlieren', () => {
        const mitFremd = new Map(artikelNachId);
        mitFremd.set('unbekannt', artikel('unbekannt', 'Grillanzünder', 'gibt-es-nicht'));
        const gruppen = gruppiereListe(
            [...eintraege, { artikelId: 'unbekannt', menge: '', notiz: '', erledigt: false }],
            mitFremd,
            kategorien
        );
        const letzte = gruppen[gruppen.length - 1];
        expect(letzte.kategorie.name).toBe('Sonstiges');
        expect(letzte.eintraege[0].artikel.name).toBe('Grillanzünder');
    });

    it('überspringt Einträge, deren Artikel es nicht mehr gibt', () => {
        const gruppen = gruppiereListe(
            [{ artikelId: 'weg', menge: '', notiz: '', erledigt: false }],
            artikelNachId,
            kategorien
        );
        expect(gruppen).toEqual([]);
    });
});

describe('Klartext-Export', () => {
    const kategorien = [
        { id: 'obst', name: 'Obst & Gemüse', icon: '🥕', position: 0 },
        { id: 'molkerei', name: 'Molkerei', icon: '🧀', position: 1 },
        { id: 'trocken', name: 'Trocken', icon: '🍝', position: 2 }
    ];
    const artikelNachId = new Map([
        ['karotten', artikel('karotten', 'Karotten', 'obst')],
        ['aepfel', artikel('aepfel', 'Äpfel', 'obst')],
        ['milch', artikel('milch', 'Milch', 'molkerei')],
        ['butter', artikel('butter', 'Butter', 'molkerei')],
        ['bulgur', artikel('bulgur', 'Bulgur', 'trocken')],
        ['sardellenpaste', artikel('sardellenpaste', 'Sardellenpaste', 'trocken')]
    ]);

    it('entspricht dem Format aus dem Briefing', () => {
        const eintraege = [
            { artikelId: 'karotten', menge: '1kg', notiz: '' },
            { artikelId: 'aepfel', menge: '', notiz: '' },
            { artikelId: 'milch', menge: '2', notiz: '' },
            { artikelId: 'butter', menge: '', notiz: '' },
            { artikelId: 'bulgur', menge: '', notiz: '' },
            { artikelId: 'sardellenpaste', menge: '', notiz: '' }
        ];
        const gruppen = gruppiereListe(eintraege, artikelNachId, kategorien);
        expect(alsKlartext(gruppen, new Date('2026-08-30T12:00:00'))).toBe(
            [
                'Einkaufsliste (30.08.2026)',
                '',
                'Obst & Gemüse: Äpfel, Karotten (1kg)',
                'Molkerei: Butter, Milch (2)',
                'Trocken: Bulgur, Sardellenpaste'
            ].join('\n')
        );
    });

    it('hängt keine Frage an – der Mensch schreibt sie selbst', () => {
        const gruppen = gruppiereListe(
            [{ artikelId: 'milch', menge: '', notiz: '' }],
            artikelNachId,
            kategorien
        );
        const text = alsKlartext(gruppen, new Date('2026-08-30T12:00:00'));
        expect(text).not.toMatch(/\?/);
        expect(text.trim().endsWith('Molkerei: Milch')).toBe(true);
    });

    it('trägt den Ort nur, wenn einer hinterlegt ist', () => {
        const gruppen = gruppiereListe(
            [{ artikelId: 'milch', menge: '', notiz: '' }],
            artikelNachId,
            kategorien
        );
        const ohne = alsKlartext(gruppen, new Date('2026-08-30T12:00:00'));
        expect(ohne.split('\n')[1]).toBe('');

        const mit = alsKlartext(gruppen, new Date('2026-08-30T12:00:00'), '45136 Essen');
        expect(mit.split('\n')[1]).toBe('Ort: 45136 Essen');
        expect(mit.split('\n')[2]).toBe('');
    });

    it('nimmt Menge und Notiz gemeinsam in die Klammer', () => {
        const gruppen = gruppiereListe(
            [{ artikelId: 'milch', menge: '2', notiz: 'laktosefrei' }],
            artikelNachId,
            kategorien
        );
        expect(alsKlartext(gruppen, new Date('2026-08-30T12:00:00')))
            .toContain('Milch (2, laktosefrei)');
    });
});

describe('Stammartikel-Export', () => {
    const artikelMitHistorie = (id, name, kaeufe) => ({
        id, name, kategorieId: 'obst', icon: '🛒', letzteKaeufe: kaeufe
    });
    const katalog = [
        artikelMitHistorie('milch', 'Milch', Array.from({ length: 10 }, (_, i) => JETZT - i * TAG_MS)),
        artikelMitHistorie('brot', 'Brot', Array.from({ length: 4 }, (_, i) => JETZT - i * TAG_MS)),
        artikelMitHistorie('kapern', 'Kapern', [])
    ];

    it('nennt jeden Artikel mit seiner Kaufzahl, häufigste zuerst', () => {
        const text = alsStammartikelText(
            kaufStatistik(katalog, 20), new Date('2026-08-30T12:00:00')
        );
        expect(text).toBe(
            ['Stammartikel (EinkaufsFuchs, Stand 30.08.2026)', '', 'Milch (10×), Brot (4×)'].join('\n')
        );
    });

    it('lässt nie Gekauftes weg', () => {
        const text = alsStammartikelText(kaufStatistik(katalog, 20), new Date());
        expect(text).not.toContain('Kapern');
    });

    it('nimmt den Ort mit, wenn er gesetzt ist', () => {
        const text = alsStammartikelText(
            kaufStatistik(katalog, 20), new Date('2026-08-30T12:00:00'), '45136 Essen'
        );
        expect(text.split('\n')[1]).toBe('Ort: 45136 Essen');
    });

    /* Auch dieser Export bleibt ein reiner Befund. Wer ihn einfügt, schreibt
       selbst dazu, was er wissen will. */
    it('hängt keine Frage an', () => {
        const text = alsStammartikelText(kaufStatistik(katalog, 20), new Date(), '45136 Essen');
        expect(text).not.toMatch(/\?/);
    });

    it('bleibt bei leerer Historie ein leerer, aber gültiger Text', () => {
        const text = alsStammartikelText([], new Date('2026-08-30T12:00:00'));
        expect(text.split('\n')[0]).toBe('Stammartikel (EinkaufsFuchs, Stand 30.08.2026)');
    });
});
