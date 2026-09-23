import { describe, expect, it } from 'vitest';
import {
    ANGEBOTSERGEBNIS_VERSION,
    HAENDLER,
    aktiveAngebote,
    angeboteFuerArtikel,
    angebotStatus,
    alsAngebotsauftrag,
    demoAngebotsprofil,
    filialenKurz,
    filialenZuordnen,
    filialName,
    kurzeFiliale,
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

describe('Filiale', () => {
    const meineMaerkte = [
        { id: 'r', haendler: 'REWE', markt: 'Rellinghauser Straße 239, Essen', angebotsseite: '', aktiv: true },
        { id: 'a1', haendler: 'ALDI Nord', markt: 'Schürmannstraße 43b, Essen', angebotsseite: '', aktiv: true },
        { id: 'a2', haendler: 'ALDI Nord', markt: 'Steeler Straße 187, Essen', angebotsseite: '', aktiv: true },
        { id: 'b', haendler: 'Sonstiger Laden', markt: 'Bioladen Grün, Hauptstraße 5, Essen',
            angebotsseite: 'https://bio.example/angebote', aktiv: true }
    ];
    const persoenlich = (angebote) => ({ ...ergebnis(angebote), profilId: 'foxi-persoenlich', demo: false });

    it('nennt eine Filiale so, wie man sie im Alltag nennt', () => {
        expect(kurzeFiliale('Schürmannstraße 43b, 45136 Essen')).toBe('Schürmannstraße 43b');
        expect(filialName('REWE', 'Rellinghauser Straße 239, Essen')).toBe('REWE Rellinghauser Straße 239');
        /* Beim sonstigen Laden ist der Name Teil von `markt`. */
        expect(filialName('Sonstiger Laden', 'Bioladen Grün, Hauptstraße 5, Essen'))
            .toBe('Bioladen Grün, Hauptstraße 5');
        expect(filialenKurz('ALDI Nord', ['Schürmannstraße 43b, Essen', 'Steeler Straße 187, Essen']))
            .toBe('ALDI Nord Schürmannstraße 43b + 1 weitere Filiale');
    });

    it('ordnet andere Schreibweisen der gespeicherten Filiale zu', () => {
        const { daten, ausgelassen } = filialenZuordnen(persoenlich([
            angebot({ haendler: 'REWE', markt: 'Rellinghauser Str. 239, 45136 Essen',
                quelle: 'https://www.rewe.de/angebote/' }),
            angebot({ haendler: 'aldi nord', markt: 'SCHÜRMANNSTRASSE 43B, Essen' })
        ]), meineMaerkte);
        expect(ausgelassen).toBe(0);
        expect(daten.angebote.map((eintrag) => `${eintrag.haendler}|${eintrag.markt}`)).toEqual([
            'REWE|Rellinghauser Straße 239, Essen',
            'ALDI Nord|Schürmannstraße 43b, Essen'
        ]);
        expect(pruefeAngebotsergebnis(daten, meineMaerkte).gueltig).toBe(true);
    });

    it('lässt Angebote ohne Filiale aus dem Profil weg und zählt sie', () => {
        const { daten, ausgelassen } = filialenZuordnen(persoenlich([
            angebot({ markt: 'alle Filialen' }),
            angebot({ markt: 'bundesweit' }),
            angebot({ haendler: 'PENNY', markt: 'Rellinghauser Straße 239, Essen',
                quelle: 'https://www.penny.de/angebote/' }),
            angebot({ markt: 'Steeler Straße 187, Essen' })
        ]), meineMaerkte);
        expect(ausgelassen).toBe(3);
        expect(daten.angebote).toHaveLength(1);
        expect(daten.angebote[0].markt).toBe('Steeler Straße 187, Essen');
    });

    it('rät nicht zwischen zwei Filialen derselben Straße', () => {
        const zwei = [
            { id: 'x', haendler: 'REWE', markt: 'Hauptstraße 1, Essen', angebotsseite: '', aktiv: true },
            { id: 'y', haendler: 'REWE', markt: 'Hauptstraße 1, Bochum', angebotsseite: '', aktiv: true }
        ];
        const { ausgelassen } = filialenZuordnen(persoenlich([
            angebot({ haendler: 'REWE', markt: 'Hauptstraße 1, 45000 Irgendwo', quelle: 'https://www.rewe.de/angebote/' })
        ]), zwei);
        expect(ausgelassen).toBe(1);
    });

    it('findet beim sonstigen Laden über die Zuordnung auch dessen hinterlegte Quelle', () => {
        const roh = persoenlich([angebot({
            haendler: 'Sonstiger Laden',
            markt: 'Bioladen Grün, Hauptstraße 5, 45127 Essen',
            quelle: 'https://bio.example/angebote/milch'
        })]);
        expect(pruefeAngebotsergebnis(roh, meineMaerkte).gueltig).toBe(false);
        const { daten } = filialenZuordnen(roh, meineMaerkte);
        expect(pruefeAngebotsergebnis(daten, meineMaerkte).gueltig).toBe(true);
    });

    it('misst ein Demo-Ergebnis am Demo-Profil, nicht an den gespeicherten Märkten', () => {
        const { ausgelassen } = filialenZuordnen(ergebnis([angebot()]), []);
        expect(ausgelassen).toBe(0);
    });

    it('lässt formal kaputte Angebote für die Prüfung stehen', () => {
        const { daten, ausgelassen } = filialenZuordnen(persoenlich([{ artikelId: 'milch' }]), meineMaerkte);
        expect(ausgelassen).toBe(0);
        expect(pruefeAngebotsergebnis(daten, meineMaerkte).gueltig).toBe(false);
        expect(filialenZuordnen(null, meineMaerkte)).toEqual({ daten: null, ausgelassen: 0 });
    });
});

describe('Nicht gelesene Filialen', () => {
    it('nimmt eine kurze Liste an und meldet sie im Status', () => {
        const daten = {
            ...ergebnis([angebot()]),
            nichtGelesen: [{ haendler: 'REWE', markt: 'Rellinghauser Straße 239, 45136 Essen', grund: 'Seite abgewiesen (403)' }]
        };
        expect(pruefeAngebotsergebnis(daten).gueltig).toBe(true);
        expect(angebotStatus(daten, new Date('2026-09-01T12:00:00Z')).nichtGelesen).toHaveLength(1);
    });

    it('bleibt freiwillig', () => {
        expect(angebotStatus(ergebnis([angebot()]), new Date('2026-09-01T12:00:00Z')).nichtGelesen).toEqual([]);
    });

    it('prüft die Einträge so eng wie den Rest', () => {
        const mit = (nichtGelesen) => pruefeAngebotsergebnis({ ...ergebnis([angebot()]), nichtGelesen });
        expect(mit('REWE').gueltig).toBe(false);
        expect(mit([{ haendler: 'REWE' }]).gueltig).toBe(false);
        expect(mit([{ haendler: 'REWE', grund: 'x'.repeat(201) }]).gueltig).toBe(false);
        expect(mit(Array.from({ length: 21 }, () => ({ haendler: 'REWE', grund: '403' }))).gueltig).toBe(false);
    });
});

describe('Auftrag mit Preiswegen', () => {
    const auftrag = alsAngebotsauftrag(demoAngebotsprofil(new Date('2026-08-31T07:00:00Z')));

    it('verlangt die Filiale wortgleich und verbietet Sammelangaben', () => {
        expect(auftrag).toContain('Jedes Angebot nennt genau eine Filiale');
        expect(auftrag).toContain('„alle Filialen“');
    });

    it('erklärt, wo die Preise stehen, und nennt nur die Händler aus dem Profil', () => {
        expect(auftrag).toContain('wie ein Browser darstellt');
        expect(auftrag).toContain('Cookie-Hinweis');
        /* Das Demo-Profil hat ALDI Nord, ALDI Süd und REWE. */
        expect(auftrag).toContain('Filiale wählen bei ALDI Süd, REWE:');
        expect(auftrag).toContain('- ALDI Nord: Die Wochenangebote gelten');
        expect(auftrag).toContain('- ALDI Nord: Nach dem Cookie-Hinweis');
        expect(auftrag).toContain('- ALDI Süd: Die Seite nennt den Zeitraum');
        expect(auftrag).toContain('- REWE: Bei der Prüfung stand vor der Seite eine Sicherheitsabfrage');
        expect(auftrag).not.toContain('- Lidl:');
        expect(auftrag).not.toContain('- EDEKA:');
    });

    it('hat für jeden der acht Händler einen gemessenen Hinweis', () => {
        for (const eintrag of HAENDLER) {
            expect(typeof eintrag.hinweis).toBe('string');
            expect(eintrag.hinweis.length).toBeGreaterThan(40);
        }
    });

    it('verlangt den Preis ohne App und Kundenkarte', () => {
        expect(auftrag).toContain('Preise nur mit App, Kundenkarte oder Coupon');
        expect(auftrag).toContain('ohne App und Karte');
    });

    it('regelt Angebote ohne Enddatum sichtbar statt stillschweigend', () => {
        expect(auftrag).toContain('Kein Enddatum angegeben – solange Vorrat reicht');
    });

    it('lässt nicht lesbare Filialen melden statt raten', () => {
        expect(auftrag).toContain('rate nicht');
        expect(auftrag).toContain('"nichtGelesen": []');
    });

    it('zeigt im Beispiel die erste Filiale des Profils', () => {
        const eigener = alsAngebotsauftrag(persoenlichesAngebotsprofil({
            maerkte: [{ id: 'm', haendler: 'PENNY', markt: 'Beispielweg 1, Essen', angebotsseite: '' }]
        }));
        const beispiel = JSON.parse(eigener.split('Ausgabeformat:\n')[1].split('\n\nEingabeprofil:')[0]);
        expect(beispiel.angebote[0].haendler).toBe('PENNY');
        expect(beispiel.angebote[0].markt).toBe('Beispielweg 1, Essen');
        expect(beispiel.angebote[0].quelle).toBe('https://www.penny.de/angebote/');
        expect(pruefeAngebotsergebnis({ ...beispiel, erzeugt: '2026-09-01T08:00:00Z',
            angebote: [{ ...beispiel.angebote[0], gueltigVon: '2026-09-01', gueltigBis: '2026-09-06' }] }).gueltig).toBe(true);
    });
});

describe('Niedrigster gefundener Grundpreis bei Gleichstand', () => {
    const milch = (produkt, grundpreis, preis) => angebot({ produkt, grundpreis, preis });

    it('markiert keinen, wenn alle gleich teuer sind', () => {
        const gruppen = gruppiereAngebote([
            milch('Frische Milch 3,5 %', '1,11 €/l', 1.11),
            milch('Frische Milch 1,5 %', '1,11 €/l', 1.11)
        ]);
        expect(gruppen.map((g) => g.niedrigsterGefundenerGrundpreis)).toEqual([false, false]);
    });

    it('markiert beide günstigsten, wenn es einen teureren gibt', () => {
        const gruppen = gruppiereAngebote([
            milch('Frische Milch 3,5 %', '1,11 €/l', 1.11),
            milch('Frische Milch 1,5 %', '1,11 €/l', 1.11),
            milch('Bio-Milch', '1,49 €/l', 1.49)
        ]);
        const marke = Object.fromEntries(gruppen.map((g) => [g.produkt, g.niedrigsterGefundenerGrundpreis]));
        expect(marke).toEqual({ 'Frische Milch 3,5 %': true, 'Frische Milch 1,5 %': true, 'Bio-Milch': false });
    });
});
