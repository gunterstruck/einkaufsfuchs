import { describe, expect, it } from 'vitest';
import {
    ANGEBOTSERGEBNIS_VERSION,
    aktiveAngebote,
    angeboteFuerArtikel,
    angebotStatus,
    alsAngebotsauftrag,
    demoAngebotsprofil,
    persoenlichesAngebotsprofil,
    gruppiereAngebote,
    preisDeutsch,
    pruefeAngebotsergebnis
} from '../src/angebotsradar.js';

function ergebnis(angebote = [], version = ANGEBOTSERGEBNIS_VERSION) {
    return {
        typ: 'foxi-angebote',
        version,
        profilId: 'demo-45136-essen',
        demo: true,
        erzeugt: '2026-08-31T07:00:00.000Z',
        angebote
    };
}

function angebot(aenderung = {}) {
    return {
        artikelId: 'milch',
        artikelName: 'Milch',
        haendler: 'ALDI Nord',
        markt: 'Schürmannstraße 43b, 45136 Essen',
        produkt: 'MILSANI Frische Vollmilch',
        preis: 0.99,
        waehrung: 'EUR',
        menge: '1 l',
        grundpreis: '0,99 €/l',
        gueltigVon: '2026-08-31',
        gueltigBis: '2026-09-05',
        treffer: 'genau',
        hinweis: '',
        quelle: 'https://www.aldi-nord.de/angebote.html',
        ...aenderung
    };
}

describe('Angebotsprofil-Demo', () => {
    it('enthält erfundene Gewohnheiten und keine Wohnadresse', () => {
        const profil = demoAngebotsprofil(new Date('2026-08-31T07:00:00Z'));
        expect(profil.demo).toBe(true);
        expect(profil.region).toBe('45136 Essen');
        expect(profil.artikel.length).toBeGreaterThanOrEqual(12);
        expect(profil).not.toHaveProperty('wohnadresse');
        expect(profil).not.toHaveProperty('koordinaten');
    });

    it('nennt Nord, Süd und den konkreten REWE-Markt', () => {
        const namen = demoAngebotsprofil().maerkte.map((markt) => markt.haendler);
        expect(namen).toContain('ALDI Nord');
        expect(namen).toContain('ALDI Süd');
        expect(namen).toContain('REWE');
    });
});

describe('Agentenauftrag', () => {
    it('baut ein persönliches Profil ohne Foto- oder Adressautomatik', () => {
        const profil = persoenlichesAngebotsprofil({
            region: '45136 Essen',
            maerkte: [{ id: 'm1', haendler: 'REWE', markt: 'Filiale Bergerhausen', angebotsseite: 'https://www.rewe.de/angebote/' }],
            artikel: [{ id: 'brot', name: 'Roggenbrot', wunsch: '500 g · geschnitten', gewicht: 4 }],
            datum: new Date('2026-09-01T08:00:00Z')
        });
        expect(profil.demo).toBe(false);
        expect(profil.maerkte[0].markt).toBe('Filiale Bergerhausen');
        expect(profil.artikel[0].wunsch).toBe('500 g · geschnitten');
        expect(JSON.stringify(profil)).not.toContain('foto');
    });

    it('fordert offizielles, reines JSON und trägt das Profil mit', () => {
        const auftrag = alsAngebotsauftrag(
            demoAngebotsprofil(new Date('2026-08-31T07:00:00Z'))
        );
        expect(auftrag).toContain('antworte ausschließlich mit dem gültigen JSON');
        expect(auftrag).toContain('foxi-angebote-JJJJ-MM-TT.json');
        expect(auftrag).toContain('aldi-nord.de');
        expect(auftrag).toContain('rewe.de');
        expect(auftrag).toContain('demo-45136-essen');
        expect(auftrag).toContain('"version": 2');
    });
});

describe('Angebotsergebnis', () => {
    it('nimmt ein vollständiges Ergebnis von offizieller Quelle an', () => {
        expect(pruefeAngebotsergebnis(ergebnis([angebot()])))
            .toEqual({ gueltig: true, grund: null });
    });

    it('weist fremde Quellen, erfundene Preise und falsche Datumsfolgen ab', () => {
        expect(pruefeAngebotsergebnis(ergebnis([angebot({
            quelle: 'https://angebote.example.com/milch'
        })])).gueltig).toBe(false);
        expect(pruefeAngebotsergebnis(ergebnis([angebot({ preis: 0 })])).gueltig).toBe(false);
        expect(pruefeAngebotsergebnis(ergebnis([angebot({
            gueltigVon: '2026-09-06', gueltigBis: '2026-09-05'
        })])).gueltig).toBe(false);
    });

    it('zeigt nur heute gültige Treffer und sortiert nachvollziehbar', () => {
        const daten = ergebnis([
            angebot({ artikelId: 'butter', artikelName: 'Butter', preis: 1.49 }),
            angebot({ preis: 1.09 }),
            angebot({
                artikelId: 'alt',
                artikelName: 'Kaffee',
                gueltigVon: '2026-08-24',
                gueltigBis: '2026-08-30'
            })
        ]);
        const aktiv = aktiveAngebote(daten, new Date('2026-09-01T12:00:00Z'));
        expect(aktiv.map((eintrag) => eintrag.artikelName)).toEqual(['Butter', 'Milch']);
    });

    it('formatiert Preise deutsch', () => {
        expect(preisDeutsch(1.5)).toBe('1,50 €');
    });

    it('fasst dasselbe Angebot aus mehreren Filialen ohne Informationsverlust zusammen', () => {
        const gruppen = gruppiereAngebote([
            angebot(),
            angebot({
                markt: 'Steeler Straße 187, 45138 Essen',
                quelle: 'https://www.aldi-nord.de/angebote.html'
            })
        ]);
        expect(gruppen).toHaveLength(1);
        expect(gruppen[0].maerkte).toEqual([
            'Schürmannstraße 43b, 45136 Essen',
            'Steeler Straße 187, 45138 Essen'
        ]);
        expect(gruppen[0].quellen).toEqual(['https://www.aldi-nord.de/angebote.html']);
    });

    it('hält Filialangebote mit unterschiedlichen Kaufbedingungen getrennt', () => {
        const gruppen = gruppiereAngebote([
            angebot(),
            angebot({
                markt: 'Steeler Straße 187, 45138 Essen',
                hinweis: 'Nur ab 6 Packungen'
            })
        ]);

        expect(gruppen).toHaveLength(2);
        expect(gruppen.map((gruppe) => ({
            hinweis: gruppe.hinweis,
            maerkte: gruppe.maerkte
        }))).toEqual([
            {
                hinweis: '',
                maerkte: ['Schürmannstraße 43b, 45136 Essen']
            },
            {
                hinweis: 'Nur ab 6 Packungen',
                maerkte: ['Steeler Straße 187, 45138 Essen']
            }
        ]);
    });

    it('markiert nur bei vergleichbarer Einheit den niedrigsten gefundenen Grundpreis', () => {
        const gruppen = gruppiereAngebote([
            angebot(),
            angebot({
                haendler: 'REWE',
                markt: 'Rellinghauser Straße 239, 45136 Essen',
                produkt: 'REWE Bio Vollmilch',
                preis: 1.19,
                grundpreis: '1,19 €/l',
                quelle: 'https://www.rewe.de/angebote/nationale-angebote/'
            }),
            angebot({
                produkt: 'Milchpulver',
                preis: 2.49,
                menge: '500 g',
                grundpreis: '4,98 €/kg'
            })
        ]);
        expect(gruppen.find((gruppe) => gruppe.grundpreis === '0,99 €/l')
            .niedrigsterGefundenerGrundpreis).toBe(true);
        expect(gruppen.find((gruppe) => gruppe.grundpreis === '1,19 €/l')
            .niedrigsterGefundenerGrundpreis).toBe(false);
        expect(gruppen.find((gruppe) => gruppe.grundpreis === '4,98 €/kg')
            .niedrigsterGefundenerGrundpreis).toBe(false);
    });

    it('vergleicht deutsche Tausender- und Dezimaltrennzeichen korrekt', () => {
        const gruppen = gruppiereAngebote([
            angebot({
                produkt: 'Großpackung A',
                preis: 1099,
                menge: '1 kg',
                grundpreis: '1.099,00 €/kg'
            }),
            angebot({
                produkt: 'Großpackung B',
                preis: 899,
                menge: '1 kg',
                grundpreis: '899,00 €/kg'
            })
        ]);

        expect(gruppen.find((gruppe) => gruppe.grundpreis === '1.099,00 €/kg')
            .niedrigsterGefundenerGrundpreis).toBe(false);
        expect(gruppen.find((gruppe) => gruppe.grundpreis === '899,00 €/kg')
            .niedrigsterGefundenerGrundpreis).toBe(true);
    });

    it('zeigt alte v1-Grundpreistexte weiter an, wertet sie aber nicht als Bestpreis', () => {
        const daten = ergebnis([
            angebot({ produkt: 'Legacy-Milch', preis: 0.89, grundpreis: '0,89 Euro je Liter' }),
            angebot({ produkt: 'Milch A', grundpreis: '0,99 €/l' }),
            angebot({ produkt: 'Milch B', preis: 1.19, grundpreis: '1,19 €/1 l' })
        ], 1);

        expect(pruefeAngebotsergebnis(daten)).toEqual({ gueltig: true, grund: null });
        const gruppen = angeboteFuerArtikel(daten, 'milch', new Date('2026-09-01T12:00:00Z'));
        expect(gruppen).toHaveLength(3);
        expect(gruppen.find((gruppe) => gruppe.produkt === 'Legacy-Milch')
            .niedrigsterGefundenerGrundpreis).toBe(false);
        expect(gruppen.find((gruppe) => gruppe.produkt === 'Milch A')
            .niedrigsterGefundenerGrundpreis).toBe(true);
    });

    it('verlangt in v2 einen eindeutigen Grundpreis', () => {
        expect(pruefeAngebotsergebnis(ergebnis([
            angebot({ grundpreis: '1,2,3 €/l' })
        ])).gueltig).toBe(false);
        expect(pruefeAngebotsergebnis(ergebnis([
            angebot({ grundpreis: '1,00 €/' })
        ])).gueltig).toBe(false);
        expect(pruefeAngebotsergebnis(ergebnis([
            angebot({ grundpreis: '0,89 Euro je Liter' })
        ])).gueltig).toBe(false);
    });

    it('weist erkennbare Null- und Negativwerte in v1 und v2 ab', () => {
        for (const version of [1, 2]) {
            for (const grundpreis of ['0,00 €/l', '-1,00 €/kg', '−1,00 €/kg', '1,00 €/0 l']) {
                expect(pruefeAngebotsergebnis(ergebnis([
                    angebot({ grundpreis })
                ], version)).gueltig, `${grundpreis} in v${version}`).toBe(false);
            }
        }
    });

    it('zeichnet einen ungültigen Null-Grundpreis auch ohne Importprüfung nicht aus', () => {
        const gruppen = gruppiereAngebote([
            angebot({ grundpreis: '0,00 €/l' }),
            angebot({
                produkt: 'REWE Bio Vollmilch',
                preis: 1.19,
                grundpreis: '1,19 €/l'
            })
        ]);

        expect(gruppen.every((gruppe) => !gruppe.niedrigsterGefundenerGrundpreis)).toBe(true);
    });

    it('rechnet g und ml auf kg und l um und vereinheitlicht Stück-Aliase', () => {
        const masse = gruppiereAngebote([
            angebot({ produkt: 'Packung A', grundpreis: '0,95 €/100 g' }),
            angebot({ produkt: 'Packung B', preis: 9.9, grundpreis: '9,90 €/1 kg' })
        ]);
        expect(masse.find((gruppe) => gruppe.produkt === 'Packung A')
            .niedrigsterGefundenerGrundpreis).toBe(true);
        expect(masse.find((gruppe) => gruppe.produkt === 'Packung B')
            .niedrigsterGefundenerGrundpreis).toBe(false);

        const volumen = gruppiereAngebote([
            angebot({ produkt: 'Flasche A', grundpreis: '0,12 €/100 ml' }),
            angebot({ produkt: 'Flasche B', preis: 1.1, grundpreis: '1,10 €/Liter' }),
            angebot({ produkt: 'Flasche C', preis: 1.3, grundpreis: '1,30 €/1 l' })
        ]);
        expect(volumen.find((gruppe) => gruppe.produkt === 'Flasche B')
            .niedrigsterGefundenerGrundpreis).toBe(true);
        expect(volumen.filter((gruppe) => gruppe.niedrigsterGefundenerGrundpreis)).toHaveLength(1);

        const stueck = gruppiereAngebote([
            angebot({ produkt: 'Karton A', preis: 2, grundpreis: '2,00 €/10 Stück' }),
            angebot({ produkt: 'Karton B', preis: 0.25, grundpreis: '0,25 €/Stk.' })
        ]);
        expect(stueck.find((gruppe) => gruppe.produkt === 'Karton A')
            .niedrigsterGefundenerGrundpreis).toBe(true);
        expect(stueck.find((gruppe) => gruppe.produkt === 'Karton B')
            .niedrigsterGefundenerGrundpreis).toBe(false);
    });

    it('liefert für einen Listenartikel nur dessen aktive, gruppierte Treffer', () => {
        const daten = ergebnis([
            angebot(),
            angebot({ markt: 'Steeler Straße 187, 45138 Essen' }),
            angebot({ artikelId: 'butter', artikelName: 'Butter', preis: 1.49 })
        ]);
        const treffer = angeboteFuerArtikel(daten, 'milch', new Date('2026-09-01T12:00:00Z'));
        expect(treffer).toHaveLength(1);
        expect(treffer[0].maerkte).toHaveLength(2);
    });

    it('meldet gruppierte Angebote und betroffene Artikel für die Statuszeile', () => {
        const daten = ergebnis([
            angebot(),
            angebot({ markt: 'Steeler Straße 187, 45138 Essen' }),
            angebot({ artikelId: 'butter', artikelName: 'Butter', preis: 1.49 })
        ]);
        const status = angebotStatus(daten, new Date('2026-09-01T12:00:00Z'));
        expect(status.vorhanden).toBe(true);
        expect(status.angebote).toBe(2);
        expect(status.artikel).toBe(2);
        expect(status.gueltigBis.toISOString()).toContain('2026-09-05');
    });
});
