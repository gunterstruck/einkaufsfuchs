import { describe, expect, it } from 'vitest';
import { angebotHinweisFuerListe, listenkartenBeschriftung } from '../src/ui/liste.js';

function angebot(aenderung = {}) {
    return {
        preis: 1.49,
        haendler: 'REWE',
        gueltigBis: '2026-09-25',
        treffer: 'genau',
        maerkte: ['Rellinghauser Straße 239, Essen'],
        hinweis: '',
        ...aenderung
    };
}

describe('Angebotshinweis auf der Einkaufsliste', () => {
    it('nennt bei mehreren Angeboten die Bedingung des ausgewählten günstigsten Angebots', () => {
        const hinweis = angebotHinweisFuerListe([
            angebot({ preis: 1.49, hinweis: 'Nur mit App' }),
            angebot({ preis: 0.99, haendler: 'ALDI Nord', hinweis: 'Nur ab 6 Packungen' })
        ]);

        expect(hinweis).toContain('2 Angebote · ab 0,99 €');
        expect(hinweis).toContain('Nur ab 6 Packungen');
        expect(hinweis).not.toContain('Nur mit App');
    });

    it('nimmt dieselbe Kaufbedingung in die zugängliche Beschriftung auf', () => {
        const hinweis = angebotHinweisFuerListe([
            angebot({ preis: 0.99, hinweis: '  Nur ab 6 Packungen  ' })
        ]);

        expect(hinweis).toContain('Nur ab 6 Packungen');
        expect(listenkartenBeschriftung('Milch – antippen zum Abhaken', hinweis))
            .toBe(`Milch – antippen zum Abhaken. ${hinweis}`);
    });

    it('nennt bei einem Angebot immer die Filiale, nicht nur den Händler', () => {
        expect(angebotHinweisFuerListe([angebot()]))
            .toBe('Angebot · 1,49 € · REWE Rellinghauser Straße 239 · bis 25.09.2026');
    });

    it('nennt bei einem Angebot aus mehreren Filialen die erste beim Namen', () => {
        const hinweis = angebotHinweisFuerListe([angebot({
            haendler: 'ALDI Nord',
            treffer: 'alternative',
            maerkte: ['Schürmannstraße 43b, Essen', 'Steeler Straße 187, Essen', 'Frohnhauser Straße 1, Essen']
        })]);
        expect(hinweis)
            .toBe('Alternative · 1,49 € · ALDI Nord Schürmannstraße 43b + 2 weitere Filialen · bis 25.09.2026');
    });

    it('nennt bei mehreren Angeboten die Filiale des günstigsten', () => {
        const hinweis = angebotHinweisFuerListe([
            angebot({ preis: 1.49 }),
            angebot({ preis: 0.99, haendler: 'ALDI Nord', maerkte: ['Schürmannstraße 43b, Essen'] })
        ]);
        expect(hinweis).toBe('2 Angebote · ab 0,99 € bei ALDI Nord Schürmannstraße 43b · bis 25.09.2026');
    });
});
