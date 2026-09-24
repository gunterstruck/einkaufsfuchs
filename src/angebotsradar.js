/**
 * Der Angebotscheck: eine klar abgegrenzte Brücke zwischen Foxis lokalem
 * Gedächtnis und einem frei gewählten KI-Recherche-Assistenten.
 *
 * Foxi ruft selbst keine Händlerseite auf. Es erzeugt nur einen Auftrag und
 * nimmt später ein streng geprüftes Ergebnis entgegen. Das Demo-Profil trägt
 * erfundene Kaufgewohnheiten; der echte Wohnort gehört nicht in ein
 * öffentliches Repository. Für regionale Angebote genügen PLZ/Ort und die
 * ausgewählten Märkte.
 */

export const ANGEBOTSPROFIL_TYP = 'foxi-angebotsprofil';
export const ANGEBOTSPROFIL_VERSION = 1;
export const ANGEBOTSERGEBNIS_TYP = 'foxi-angebote';
export const ANGEBOTSERGEBNIS_VERSION = 2;

/**
 * Die acht Händler – und was man über ihre Angebotsseiten **gemessen** weiß.
 *
 * Zweite Messung am 23.09.2026, mit einem echten Browser und so, wie ein
 * Mensch die Seite benutzt: Cookie-Hinweis bestätigen, bis zum Ende
 * scrollen, Produktseiten öffnen. Die erste Messung (nur laden, vier
 * Sekunden warten) war zu streng – sie sah bei ALDI Nord keinen einzigen
 * Preis, wo nach dem Cookie-Hinweis über 600 im Text stehen. Die Tabelle
 * steht in KONZEPT 6.7.
 *
 * `hinweis` geht wörtlich in den Rechercheauftrag, aber nur für Händler,
 * die im Profil vorkommen. Er sagt, wo auf *dieser* Seite Preis und
 * Gültigkeit stehen – das ist bei jedem Händler anders.
 *
 * `marktgebunden`: Die Seite zeigt Angebote für eine gewählte Filiale oder
 * verlangt eine. ALDI Süd wählt selbst eine nach Standort („Ist Mülheim an
 * der Ruhr deine Filiale?") – falsch für jeden, der woanders wohnt.
 */
export const HAENDLER = Object.freeze([
    {
        name: 'ALDI Nord', url: 'https://www.aldi-nord.de/angebote.html', host: 'aldi-nord.de', marktgebunden: false,
        hinweis: 'Nach dem Cookie-Hinweis und Herunterscrollen stehen Produkte mit Preis und Grundpreis im Seitentext. Die Übersicht nennt nur den Aktionsbeginn („Aktion Mo. 21.9.“); die Gültigkeit steht auf der Produktseite („21.09 - 26.09“). Nimm die Produktseite als quelle.'
    },
    {
        name: 'ALDI Süd', url: 'https://www.aldi-sued.de/angebote', host: 'aldi-sued.de', marktgebunden: true,
        hinweis: 'Die Seite nennt den Zeitraum („Wochenangebote Mo., 21.9. – Sa., 26.9.“) und zeigt Preis und Grundpreis im Text. Sie wählt selbst eine Filiale nach Standort – stelle über „Filiale ändern“ die Filiale aus dem Profil ein.'
    },
    {
        name: 'Lidl', url: 'https://www.lidl.de/c/online-prospekte/s10005610/', host: 'lidl.de', marktgebunden: false,
        hinweis: 'Die Filial-Angebote stehen im „Aktionsprospekt“ der Woche (Titel mit Zeitraum, z. B. „21.09.2026 – 26.09.2026“). Der Prospekt besteht aus Seitenbildern ohne Text – lies die Seiten als Bild. Die Lidl-Suche zeigt den Onlineshop, nicht die Filial-Angebote.'
    },
    {
        name: 'REWE', url: 'https://www.rewe.de/angebote/', host: 'rewe.de', marktgebunden: true,
        hinweis: 'Bei der Prüfung stand vor der Seite eine Sicherheitsabfrage (HTTP 403). Kommt sie bei dir auch, nicht umgehen – dann in nichtGelesen.'
    },
    {
        name: 'EDEKA', url: 'https://www.edeka.de/angebote/', host: 'edeka.de', marktgebunden: true,
        hinweis: 'Ohne gewählten Markt zeigt die Seite nur wenige bundesweite Angebote. Über „Wähle deinen Markt“ die Filiale aus dem Profil einstellen. Der Zeitraum steht auf der Seite („Gültig vom … bis zum …“).'
    },
    {
        name: 'Kaufland', url: 'https://filiale.kaufland.de/angebote/uebersicht.html', host: 'kaufland.de', marktgebunden: true,
        hinweis: 'Preise und Zeitraum stehen im Seitentext („Gültig vom 17.09. bis 23.09.“); die Angebotswoche läuft Donnerstag bis Mittwoch. Filiale aus dem Profil wählen.'
    },
    {
        name: 'Netto Marken-Discount', url: 'https://www.netto-online.de/filialangebote', host: 'netto-online.de', marktgebunden: true,
        hinweis: 'Ohne gewählte Filiale zeigt die Seite keine Preise („wähle bitte einen Markt“). Über „Filiale auswählen“ die Filiale aus dem Profil einstellen.'
    },
    {
        name: 'PENNY', url: 'https://www.penny.de/angebote/', host: 'penny.de', marktgebunden: true,
        hinweis: 'Die Angebote stehen mit Preis als Liste im Text („Als Liste“). Über „Markt wählen“ die Filiale aus dem Profil einstellen.'
    }
]);

function istBekannterHaendler(haendler) {
    return HAENDLER.some((eintrag) => eintrag.name === haendler);
}

function gekuerzt(text, max) {
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Die Kurzform einer Filiale für enge Stellen: der Teil vor dem ersten
 *  Komma, also meist Straße und Hausnummer. „Schürmannstraße 43b, 45136
 *  Essen" wird zu „Schürmannstraße 43b". Wer in einem Viertel einkauft,
 *  erkennt seinen Laden an der Straße, nicht an der Postleitzahl. */
export function kurzeFiliale(markt) {
    const text = String(markt || '').trim();
    const vorKomma = text.split(',')[0].trim();
    return gekuerzt(vorKomma || text, 40);
}

/** Wie man eine Filiale im Alltag nennt: „REWE Rellinghauser Straße 239".
 *
 *  Beim sonstigen Laden steht der Händler nur als Sammelbegriff im Feld
 *  `haendler`; sein Name ist der erste Teil von `markt`. Dort zählen
 *  deshalb Name **und** Straße – „Sonstiger Laden Bioladen Grün" hülfe
 *  niemandem. */
export function filialName(haendler, markt) {
    if (!istBekannterHaendler(haendler)) {
        const teile = String(markt || '').split(',').map((teil) => teil.trim()).filter(Boolean);
        return gekuerzt(teile.slice(0, 2).join(', ') || String(haendler || ''), 60);
    }
    return `${haendler} ${kurzeFiliale(markt)}`.trim();
}

/** Filialangabe für eine zusammengefasste Angebotsgruppe: die erste Filiale
 *  beim Namen, die übrigen gezählt. Die vollständigen Adressen stehen im
 *  Artikelblatt und unter „Mehr". */
export function filialenKurz(haendler, maerkte) {
    const liste = Array.isArray(maerkte) ? maerkte : [];
    if (liste.length === 0) return String(haendler || '');
    const erste = filialName(haendler, liste[0]);
    const weitere = liste.length - 1;
    if (weitere === 0) return erste;
    return `${erste} + ${weitere} ${weitere === 1 ? 'weitere Filiale' : 'weitere Filialen'}`;
}

/** Schlüssel, unter dem zwei Schreibweisen derselben Filiale gleich sind:
 *  Groß- und Kleinschreibung, ß/ss, Umlaute, „Str." und Satzzeichen zählen
 *  nicht. „Rellinghauser Str. 239" trifft so „Rellinghauser Straße 239". */
function filialSchluessel(text) {
    return String(text || '')
        .toLocaleLowerCase('de')
        .replaceAll('ß', 'ss')
        .replaceAll('ä', 'ae')
        .replaceAll('ö', 'oe')
        .replaceAll('ü', 'ue')
        .replace(/str\.(?=[\s\d,]|$)/g, 'strasse')
        .replace(/[^a-z0-9]/g, '');
}

function findeFiliale(angebot, maerkte) {
    const haendler = filialSchluessel(angebot.haendler);
    const kandidaten = maerkte.filter((markt) => filialSchluessel(markt.haendler) === haendler);
    const genau = kandidaten.find((markt) => filialSchluessel(markt.markt) === filialSchluessel(angebot.markt));
    if (genau) return genau;
    /* Zweiter Versuch nur über Straße und Hausnummer – aber nur, wenn das
       genau eine gespeicherte Filiale trifft. Ein Assistent schreibt gern
       „…, 45136 Essen", wo „…, Essen" gespeichert ist. Raten zwischen zwei
       Filialen derselben Straße wäre schlimmer als weglassen. */
    const kurz = filialSchluessel(kurzeFiliale(angebot.markt));
    const ueberStrasse = kandidaten.filter((markt) => filialSchluessel(kurzeFiliale(markt.markt)) === kurz);
    return ueberStrasse.length === 1 ? ueberStrasse[0] : null;
}

/**
 * Jedes Angebot einer Filiale aus dem Profil zuordnen – vor der Prüfung.
 *
 * Ein Angebot ohne Filiale ist für den Einkauf wertlos: „ALDI Nord,
 * bundesweit" sagt nicht, in welchen Laden man gehen soll, und bei REWE,
 * EDEKA, Kaufland, Netto und PENNY gilt der Preis ohnehin nur im gewählten
 * Markt. Deshalb:
 *
 * - Trifft `haendler` + `markt` eine Filiale aus dem Profil (auch in anderer
 *   Schreibweise), übernimmt Foxi **deren** Schreibweise. So fasst die
 *   Gruppierung gleiche Angebote zusammen, und die Quellenprüfung eines
 *   sonstigen Ladens findet ihre hinterlegte Seite wieder.
 * - Trifft es keine, wird das Angebot **weggelassen und gezählt** – nicht
 *   still verschluckt, nicht das ganze Ergebnis verworfen.
 *
 * Welches Profil? Ein Demo-Ergebnis gehört zum Demo-Profil, jedes andere
 * zu den gespeicherten Märkten. Formal kaputte Angebote bleiben stehen,
 * damit `pruefeAngebotsergebnis()` sie wie bisher als kaputt erkennt.
 */
export function filialenZuordnen(daten, maerkte = []) {
    if (!daten || typeof daten !== 'object' || !Array.isArray(daten.angebote)) {
        return { daten, ausgelassen: 0 };
    }
    const profilMaerkte = daten.demo === true ? DEMO_MAERKTE : (Array.isArray(maerkte) ? maerkte : []);
    let ausgelassen = 0;
    const angebote = [];
    for (const angebot of daten.angebote) {
        if (!angebot || typeof angebot !== 'object' ||
            typeof angebot.haendler !== 'string' || typeof angebot.markt !== 'string') {
            angebote.push(angebot);
            continue;
        }
        const filiale = findeFiliale(angebot, profilMaerkte);
        if (!filiale) {
            ausgelassen += 1;
            continue;
        }
        angebote.push({ ...angebot, haendler: filiale.haendler, markt: filiale.markt });
    }
    return { daten: { ...daten, angebote }, ausgelassen };
}

const OFFIZIELLE_HOSTS = HAENDLER.map(h => h.host);
export function sichereAngebotsseite(wert) {
    try {
        const url = new URL(wert);
        if (url.protocol !== 'https:' || url.username || url.password || url.port ||
            !url.hostname.includes('.') || /^[\d.]+$/.test(url.hostname) || url.hostname.endsWith('.localhost')) return '';
        return url.href;
    } catch { return ''; }
}
const TREFFERARTEN = new Set(['genau', 'alternative']);

const DEMO_MAERKTE = [
    {
        id: 'aldi-nord-schuermannstrasse',
        haendler: 'ALDI Nord',
        markt: 'Schürmannstraße 43b, 45136 Essen',
        angebotsseite: 'https://www.aldi-nord.de/angebote.html'
    },
    {
        id: 'aldi-nord-steeler-strasse',
        haendler: 'ALDI Nord',
        markt: 'Steeler Straße 187, 45138 Essen',
        angebotsseite: 'https://www.aldi-nord.de/angebote.html'
    },
    {
        id: 'rewe-rellinghauser-strasse',
        haendler: 'REWE',
        markt: 'Rellinghauser Straße 239, 45136 Essen',
        angebotsseite:
            'https://www.rewe.de/marktseite/essen-bergerhausen/1940413/rewe-markt-rellinghauser-str-239/'
    },
    {
        id: 'aldi-sued-humboldtring',
        haendler: 'ALDI Süd',
        markt: 'Humboldtring 5, 45472 Mülheim an der Ruhr',
        angebotsseite: 'https://www.aldi-sued.de/angebote'
    }
];

/* Erfunden, aber absichtlich alltäglich. Die Zahlen sind keine vorgetäuschte
 * Historie, sondern nur Gewichte für den ersten Praxisversuch. */
const DEMO_ARTIKEL = [
    ['milch', 'Milch', 'oft', 18],
    ['kaffeebohnen', 'Kaffeebohnen', 'oft', 14],
    ['butter', 'Butter', 'oft', 12],
    ['eier', 'Eier', 'oft', 11],
    ['vollkornbrot', 'Vollkornbrot', 'oft', 10],
    ['gouda', 'Gouda', 'regelmäßig', 9],
    ['naturjoghurt', 'Naturjoghurt', 'regelmäßig', 9],
    ['spaghetti', 'Spaghetti', 'regelmäßig', 8],
    ['aepfel', 'Äpfel', 'regelmäßig', 8],
    ['bananen', 'Bananen', 'regelmäßig', 7],
    ['tomaten', 'Tomaten', 'regelmäßig', 6],
    ['mineralwasser', 'Mineralwasser', 'regelmäßig', 6],
    ['toilettenpapier', 'Toilettenpapier', 'gelegentlich', 5],
    ['waschmittel', 'Waschmittel', 'gelegentlich', 4],
    ['olivenoel', 'Olivenöl', 'gelegentlich', 4]
].map(([id, name, haeufigkeit, gewicht]) => ({ id, name, haeufigkeit, gewicht }));

export function demoAngebotsprofil(datum = new Date()) {
    return {
        typ: ANGEBOTSPROFIL_TYP,
        version: ANGEBOTSPROFIL_VERSION,
        profilId: 'demo-45136-essen',
        demo: true,
        erzeugt: datum.toISOString(),
        region: '45136 Essen',
        hinweis:
            'Alle Kaufgewohnheiten sind erfunden. Die Wohnadresse ist nicht Bestandteil dieses Profils.',
        maerkte: DEMO_MAERKTE.map((markt) => ({ ...markt })),
        artikel: DEMO_ARTIKEL.map((artikel) => ({ ...artikel }))
    };
}

/** Baut aus den ausschließlich lokal gepflegten Märkten und Produkten das
 * Profil für den selbst gewählten Recherche-Assistenten. Produktfotos sind
 * bewusst nie Bestandteil dieser Übergabe. */
export function persoenlichesAngebotsprofil({ region = '', maerkte = [], artikel = [], datum = new Date() } = {}) {
    return {
        typ: ANGEBOTSPROFIL_TYP,
        version: ANGEBOTSPROFIL_VERSION,
        profilId: 'foxi-persoenlich',
        demo: false,
        erzeugt: datum.toISOString(),
        region: String(region || '').trim(),
        hinweis: 'Das Profil wurde lokal in Foxi aus ausgewählten Märkten und Produktwünschen erstellt.',
        maerkte: maerkte.map((markt) => ({
            id: markt.id,
            haendler: markt.haendler,
            markt: markt.markt,
            angebotsseite: markt.angebotsseite || ''
        })),
        artikel: artikel.slice(0, 40).map((eintrag) => ({
            id: eintrag.id,
            name: eintrag.name,
            wunsch: String(eintrag.wunsch || '').trim(),
            haeufigkeit: eintrag.haeufigkeit || 'ausgewählt',
            gewicht: Number(eintrag.gewicht) || 1
        }))
    };
}

/**
 * Ein Auftrag statt freier Prosa. Der Agent bekommt seinen Eingabevertrag,
 * die erlaubten Quellen und den Ausgabevertrag in einem Block. Dadurch kann
 * derselbe Text manuell oder als wiederkehrende Cowork-Aufgabe laufen.
 */
export function alsAngebotsauftrag(profil = demoAngebotsprofil()) {
    const profilMaerkte = Array.isArray(profil.maerkte) ? profil.maerkte : [];
    /* Das Beispiel zeigt die erste Filiale des Profils, wie sie dort steht.
       Wortgleich übernehmen lernt ein Assistent am Beispiel schneller als an
       einer Regel. */
    const ersterMarkt = profilMaerkte[0];
    const beispielHaendler = ersterMarkt?.haendler || 'ALDI Nord';
    const beispielMarkt = ersterMarkt?.markt || 'Filiale wortgleich aus dem Eingabeprofil';
    const beispielQuelle = sichereAngebotsseite(ersterMarkt?.angebotsseite || '') ||
        HAENDLER.find((eintrag) => eintrag.name === beispielHaendler)?.url ||
        'https://www.aldi-nord.de/angebote.html';
    const beispiel = {
        typ: ANGEBOTSERGEBNIS_TYP,
        version: ANGEBOTSERGEBNIS_VERSION,
        profilId: profil.profilId,
        demo: Boolean(profil.demo),
        erzeugt: 'ISO-8601-Zeitpunkt',
        angebote: [
            {
                artikelId: 'milch',
                artikelName: 'Milch',
                haendler: beispielHaendler,
                markt: beispielMarkt,
                produkt: 'Vollständiger Produktname',
                preis: 0.99,
                waehrung: 'EUR',
                menge: '1 l',
                grundpreis: '0,99 €/l',
                gueltigVon: 'JJJJ-MM-TT',
                gueltigBis: 'JJJJ-MM-TT',
                treffer: 'genau',
                hinweis: '',
                quelle: beispielQuelle
            }
        ],
        nichtGelesen: []
    };

    /* Die Hinweise nennen nur Händler, die im Profil auch vorkommen. Ein
       Auftrag über zwei Märkte braucht keine Anleitung für acht. */
    const imProfil = new Set(profilMaerkte.map((markt) => markt.haendler));
    const gebunden = HAENDLER.filter((eintrag) => eintrag.marktgebunden && imProfil.has(eintrag.name));
    const einheitlich = HAENDLER.filter((eintrag) => !eintrag.marktgebunden && imProfil.has(eintrag.name));
    const mitSonstigem = profilMaerkte.some((markt) => !istBekannterHaendler(markt.haendler));
    const namen = (liste) => liste.map((eintrag) => eintrag.name).join(', ');

    const preiswege = [
        'So kommst du an die Preise:',
        '- Die meisten Angebotsseiten laden ihre Preise erst nach. Öffne sie mit einem Werkzeug, das sie wie ein Browser darstellt, bestätige oder schließe den Cookie-Hinweis und scrolle bis zum Ende. Ein reiner Textabruf findet oft nichts.'
    ];
    if (gebunden.length) {
        preiswege.push(`- Filiale wählen bei ${namen(gebunden)}: Nimm die angebotsseite der Filiale aus dem Eingabeprofil. Fragt die Seite nach dem Markt oder hat sie selbst einen gewählt, stelle über die öffentliche Marktsuche genau die Filiale aus dem Feld markt ein.`);
    }
    if (einheitlich.length) {
        preiswege.push(`- ${namen(einheitlich)}: Die Wochenangebote gelten in der Regel für alle Filialen. Trage jedes Angebot trotzdem für jede Filiale dieses Händlers aus dem Eingabeprofil ein, sofern die Seite nichts Abweichendes sagt.`);
    }
    for (const eintrag of HAENDLER.filter((h) => imProfil.has(h.name))) {
        preiswege.push(`- ${eintrag.name}: ${eintrag.hinweis}`);
    }
    if (mitSonstigem) {
        preiswege.push('- Sonstige Läden: nur die im Eingabeprofil hinterlegte angebotsseite.');
    }
    preiswege.push(
        '- Preise nur mit App, Kundenkarte oder Coupon („App Preis“, „Nur mit App“, „Mit Kaufland Card“, Lidl Plus) nicht als preis übernehmen. Nimm den Angebotspreis, der ohne App und Karte gilt; den App-Preis darfst du im hinweis nennen.',
        '- Die Gültigkeit (gueltigVon, gueltigBis) steht auf der Seite, im Prospekt oder auf der Produktseite. Nennt der Händler nur einen Beginn („Im Angebot ab 24.09“), setze gueltigBis auf den Samstag derselben Woche und schreibe in hinweis „Kein Enddatum angegeben – solange Vorrat reicht“. Sonst nicht raten.',
        '- Kommst du an eine Filiale nicht heran – Seite abgewiesen, Sicherheitsabfrage, Marktwahl nicht möglich, Prospekt nicht lesbar –, rate nicht. Trage sie in nichtGelesen ein und mach mit der nächsten weiter.'
    );

    return [
        'WÖCHENTLICHER FOXI-ANGEBOTSRADAR',
        '',
        'Aufgabe:',
        'Prüfe für jede Filiale im Eingabeprofil die aktuell gültigen und bereits veröffentlichten Wochenangebote.',
        'Suche ausschließlich nach Angeboten, die zu den Artikeln im Profil passen. Andere Angebote verwerfen.',
        '',
        ...preiswege,
        '',
        'Regeln:',
        `1. Verwende nur öffentlich erreichbare offizielle Händlerseiten: ${OFFIZIELLE_HOSTS.join(', ')}. Bei sonstigen Läden ausschließlich die im Eingabeprofil ausdrücklich hinterlegte Angebotsseite und deren Host. Ohne hinterlegte Seite keine Angebote für sonstige Läden erfinden.`,
        '2. Keine Anmeldung, keine App-Coupons hinter Login und keine Umgehung technischer Sperren. Eine abgewiesene Seite gehört in nichtGelesen.',
        '3. Jedes Angebot nennt genau eine Filiale: haendler und markt wortgleich aus dem Eingabeprofil; bei Sonstiger Laden steht der konkrete Name im Feld markt.',
        '   Keine Sammelangaben wie „alle Filialen“ oder „bundesweit“. Gilt ein Angebot in mehreren Filialen des Profils, trage es für jede Filiale einzeln ein – Foxi fasst gleiche Angebote selbst zusammen.',
        '   Angebote ohne Filiale aus dem Eingabeprofil lässt Foxi beim Einlesen weg.',
        '4. Ordne nur plausible Treffer zu. Eine andere Marke ist erlaubt, muss aber als „alternative“ markiert werden.',
        '5. Übernimm Preis, Packungsgröße, Grundpreis, Gültigkeit und als quelle die Seite, auf der der Preis steht. Nichts erfinden.',
        '   Schreibe den Grundpreis als positive Zahl mit eindeutigem Nenner, zum Beispiel „0,99 €/l“, „1,49 €/kg“ oder „0,25 €/Stück“.',
        '6. Falls kein passendes Angebot existiert, gib eine leere Angebotsliste zurück.',
        '   Nicht lesbare Filialen stehen in nichtGelesen, je Eintrag {"haendler": …, "markt": …, "grund": …}; grund kurz, zum Beispiel „Seite abgewiesen (403)“ oder „Marktwahl nicht möglich“.',
        '7. Erzeuge nach Möglichkeit eine Datei namens „foxi-angebote-JJJJ-MM-TT.json“ mit dem Ergebnis.',
        '8. Falls du keine Datei erzeugen kannst, antworte ausschließlich mit dem gültigen JSON – ohne Markdown, Einleitung oder Nachsatz.',
        '',
        'Ausgabeformat:',
        JSON.stringify(beispiel, null, 2),
        '',
        'Eingabeprofil:',
        JSON.stringify(profil, null, 2)
    ].join('\n');
}

function istText(wert, max = 300) {
    return typeof wert === 'string' && wert.trim().length > 0 && wert.length <= max;
}

function istDatum(wert) {
    if (typeof wert !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(wert)) return false;
    const datum = new Date(`${wert}T00:00:00Z`);
    return Number.isFinite(datum.getTime()) && datum.toISOString().slice(0, 10) === wert;
}

function lokalerTag(datum) {
    const zwei = (wert) => String(wert).padStart(2, '0');
    return `${datum.getFullYear()}-${zwei(datum.getMonth() + 1)}-${zwei(datum.getDate())}`;
}

function istOffizielleQuelle(wert, angebot, maerkte) {
    try {
        const adresse = new URL(wert);
        if (!sichereAngebotsseite(wert)) return false;
        const eigeneQuelle = maerkte.some(m => m.haendler === angebot.haendler && m.markt === angebot.markt && sichereAngebotsseite(m.angebotsseite) && new URL(m.angebotsseite).hostname === adresse.hostname);
        if (eigeneQuelle) return true;
        return OFFIZIELLE_HOSTS.some(
            (host) => adresse.hostname === host || adresse.hostname.endsWith(`.${host}`)
        );
    } catch {
        return false;
    }
}

function istAngebotGueltig(angebot, version, maerkte) {
    if (!angebot || typeof angebot !== 'object') return false;
    if (!istText(angebot.artikelId, 100) || !istText(angebot.artikelName, 120)) return false;
    if (!istText(angebot.haendler, 80) || !istText(angebot.markt, 200)) return false;
    if (!istText(angebot.produkt, 240)) return false;
    if (!Number.isFinite(angebot.preis) || angebot.preis <= 0 || angebot.preis > 100000) return false;
    if (angebot.waehrung !== 'EUR') return false;
    if (!istText(angebot.menge, 80) || !istText(angebot.grundpreis, 100)) return false;
    const grundpreis = analysiereGrundpreis(angebot.grundpreis);
    /* Version 1 erlaubte beliebigen Grundpreistext. Solche gespeicherten
       Ergebnisse bleiben sichtbar, nehmen aber nicht am Preisvergleich teil.
       Eindeutig erkennbare Null-/Negativwerte waren nie sinnvolle Daten. */
    if (grundpreis.art === 'ungueltig') return false;
    if (version >= 2 && grundpreis.art !== 'gueltig') return false;
    if (!istDatum(angebot.gueltigVon) || !istDatum(angebot.gueltigBis)) return false;
    if (angebot.gueltigVon > angebot.gueltigBis) return false;
    if (!TREFFERARTEN.has(angebot.treffer)) return false;
    if (typeof angebot.hinweis !== 'string' || angebot.hinweis.length > 300) return false;
    return istOffizielleQuelle(angebot.quelle, angebot, maerkte);
}

/** `nichtGelesen` ist freiwillig: Ältere Assistenten-Läufe und ältere
 *  Foxi-Fassungen kennen das Feld nicht, und es ändert kein Angebot. Wenn
 *  es da ist, wird es aber genauso eng geprüft wie der Rest – es ist
 *  ebenfalls fremder Text, der in der App angezeigt wird. */
function istNichtGelesenGueltig(liste) {
    if (liste === undefined) return true;
    if (!Array.isArray(liste) || liste.length > 20) return false;
    return liste.every((eintrag) =>
        eintrag && typeof eintrag === 'object' &&
        istText(eintrag.haendler, 80) &&
        (eintrag.markt === undefined || eintrag.markt === '' || istText(eintrag.markt, 200)) &&
        istText(eintrag.grund, 200)
    );
}

export function pruefeAngebotsergebnis(daten, maerkte = []) {
    if (!daten || typeof daten !== 'object') return { gueltig: false, grund: 'kaputt' };
    if (daten.typ !== ANGEBOTSERGEBNIS_TYP) return { gueltig: false, grund: 'fremd' };
    const version = Number(daten.version);
    if (Number.isInteger(version) && version > ANGEBOTSERGEBNIS_VERSION) {
        return { gueltig: false, grund: 'zuNeu' };
    }
    if (!Number.isInteger(version) || version < 1) return { gueltig: false, grund: 'kaputt' };
    if (!istText(daten.profilId, 100) || !istText(daten.erzeugt, 80) ||
        Number.isNaN(Date.parse(daten.erzeugt)) || typeof daten.demo !== 'boolean') {
        return { gueltig: false, grund: 'kaputt' };
    }
    if (!Array.isArray(daten.angebote) || daten.angebote.length > 200) {
        return { gueltig: false, grund: 'kaputt' };
    }
    if (!daten.angebote.every((angebot) => istAngebotGueltig(angebot, version, maerkte))) {
        return { gueltig: false, grund: 'kaputt' };
    }
    if (!istNichtGelesenGueltig(daten.nichtGelesen)) return { gueltig: false, grund: 'kaputt' };
    return { gueltig: true, grund: null };
}

export function aktiveAngebote(daten, heute = new Date(), maerkte = []) {
    if (!pruefeAngebotsergebnis(daten, maerkte).gueltig) return [];
    const tag = lokalerTag(heute);
    return daten.angebote
        .filter((angebot) => angebot.gueltigVon <= tag && angebot.gueltigBis >= tag)
        .sort((a, b) => a.artikelName.localeCompare(b.artikelName, 'de') || a.preis - b.preis);
}

/** Identische Händlerangebote aus mehreren Filialen nicht als Wiederholung
 * anzeigen. Markt und Quelle sind deshalb absichtlich nicht Teil des
 * Schlüssels; sie werden gesammelt und bleiben im aufgeklappten Detail
 * vollständig nachvollziehbar. */
function gruppenschluessel(angebot) {
    return [
        angebot.artikelId,
        angebot.haendler,
        angebot.produkt,
        angebot.preis,
        angebot.waehrung,
        angebot.menge,
        angebot.grundpreis,
        angebot.gueltigVon,
        angebot.gueltigBis,
        angebot.treffer,
        typeof angebot.hinweis === 'string' ? angebot.hinweis.trim() : ''
    ].join('\u001f');
}

export function gruppiereAngebote(angebote) {
    const gruppen = new Map();
    for (const angebot of angebote || []) {
        const schluessel = gruppenschluessel(angebot);
        let gruppe = gruppen.get(schluessel);
        if (!gruppe) {
            gruppe = {
                ...angebot,
                maerkte: [],
                quellen: [],
                niedrigsterGefundenerGrundpreis: false
            };
            gruppen.set(schluessel, gruppe);
        }
        if (!gruppe.maerkte.includes(angebot.markt)) gruppe.maerkte.push(angebot.markt);
        if (!gruppe.quellen.includes(angebot.quelle)) gruppe.quellen.push(angebot.quelle);
    }

    const ergebnis = [...gruppen.values()].sort(
        (a, b) => a.artikelName.localeCompare(b.artikelName, 'de') || a.preis - b.preis
    );
    markiereNiedrigsteGrundpreise(ergebnis);
    return ergebnis;
}

function zahlWert(zahl) {
    const vorzeichen = zahl.startsWith('-') ? -1 : 1;
    const ohneVorzeichen = /^[+-]/.test(zahl) ? zahl.slice(1) : zahl;
    /* Der Auftrag zeigt deutsche Preisnotation. Ein Punkt mit vollständigen
       Dreiergruppen ist deshalb ein Tausendertrennzeichen; der Dezimalpunkt
       bleibt für bisher akzeptierte Ergebnisse ohne Tausendergruppe erlaubt. */
    const deutsch = /^(?:[1-9]\d{0,2}(?:\.\d{3})+|0|[1-9]\d*)(?:,\d+)?$/;
    const mitDezimalpunkt = /^(?:0|[1-9]\d*)\.\d+$/;
    let normalisiert;
    if (deutsch.test(ohneVorzeichen)) {
        normalisiert = ohneVorzeichen.replaceAll('.', '').replace(',', '.');
    } else if (mitDezimalpunkt.test(ohneVorzeichen)) {
        normalisiert = ohneVorzeichen;
    } else {
        return null;
    }
    const wert = vorzeichen * Number(normalisiert);
    return Number.isFinite(wert) ? wert : null;
}

const GRUNDPREIS_EINHEITEN = new Map([
    ['kg', ['kg', 1]],
    ['kilogramm', ['kg', 1]],
    ['kilogram', ['kg', 1]],
    ['kilograms', ['kg', 1]],
    ['g', ['kg', 0.001]],
    ['gramm', ['kg', 0.001]],
    ['gram', ['kg', 0.001]],
    ['grams', ['kg', 0.001]],
    ['l', ['l', 1]],
    ['liter', ['l', 1]],
    ['litre', ['l', 1]],
    ['litres', ['l', 1]],
    ['ml', ['l', 0.001]],
    ['milliliter', ['l', 0.001]],
    ['millilitre', ['l', 0.001]],
    ['stück', ['stück', 1]],
    ['stueck', ['stück', 1]],
    ['stk', ['stück', 1]],
    ['stck', ['stück', 1]],
    ['st', ['stück', 1]],
    ['piece', ['stück', 1]],
    ['pieces', ['stück', 1]],
    ['wl', ['waschladung', 1]],
    ['waschladung', ['waschladung', 1]],
    ['waschladungen', ['waschladung', 1]],
    ['m', ['m', 1]],
    ['meter', ['m', 1]],
    ['cm', ['m', 0.01]],
    ['zentimeter', ['m', 0.01]],
    ['m2', ['m²', 1]],
    ['qm', ['m²', 1]],
    ['quadratmeter', ['m²', 1]],
    ['cm2', ['m²', 0.0001]],
    ['blatt', ['blatt', 1]],
    ['blätter', ['blatt', 1]],
    ['blaetter', ['blatt', 1]],
    ['rolle', ['rolle', 1]],
    ['rollen', ['rolle', 1]],
    ['paar', ['paar', 1]]
]);

function analysiereNenner(nennerText) {
    const normalisiert = nennerText.trim().normalize('NFKC').toLocaleLowerCase('de');
    const treffer = normalisiert.match(/^([+-]?\d[\d.,]*)?\s*([\p{L}]+(?:[23])?\.?)$/u);
    if (!treffer) return { art: 'unklar' };

    const menge = treffer[1] === undefined ? 1 : zahlWert(treffer[1]);
    if (menge === null) return { art: 'unklar' };
    if (menge <= 0) return { art: 'ungueltig' };

    const rohEinheit = treffer[2].replace(/\.$/, '');
    const [einheit, anteil] = GRUNDPREIS_EINHEITEN.get(rohEinheit) || [rohEinheit, 1];
    return { art: 'gueltig', einheit, menge: menge * anteil };
}

function analysiereGrundpreis(grundpreis) {
    if (typeof grundpreis !== 'string') return { art: 'unklar' };
    const bereinigt = grundpreis.trim().replace(/^[−–—]/u, '-');
    const treffer = bereinigt.match(/^([+-]?\d[\d.,]*)\s*€\s*\/\s*(.+)$/u);
    if (!treffer) return { art: 'unklar' };

    const preis = zahlWert(treffer[1]);
    if (preis === null) return { art: 'unklar' };
    if (preis <= 0) return { art: 'ungueltig' };

    const nenner = analysiereNenner(treffer[2]);
    if (nenner.art !== 'gueltig') return nenner;
    const wert = preis / nenner.menge;
    if (!Number.isFinite(wert) || wert <= 0) return { art: 'ungueltig' };
    return { art: 'gueltig', wert: Number(wert.toPrecision(12)), einheit: nenner.einheit };
}

function grundpreisWert(grundpreis) {
    const analyse = analysiereGrundpreis(grundpreis);
    return analyse.art === 'gueltig'
        ? { wert: analyse.wert, einheit: analyse.einheit }
        : null;
}

function markiereNiedrigsteGrundpreise(gruppen) {
    const vergleich = new Map();
    for (const gruppe of gruppen) {
        const grundpreis = grundpreisWert(gruppe.grundpreis);
        if (!grundpreis) continue;
        const schluessel = `${gruppe.artikelId}\u001f${grundpreis.einheit}`;
        if (!vergleich.has(schluessel)) vergleich.set(schluessel, []);
        vergleich.get(schluessel).push({ gruppe, wert: grundpreis.wert });
    }
    for (const kandidaten of vergleich.values()) {
        if (kandidaten.length < 2) continue;
        const niedrigster = Math.min(...kandidaten.map((kandidat) => kandidat.wert));
        /* Sind alle gleich teuer, ist keiner „der niedrigste" – die Marke
           stünde sonst an jedem Treffer und sagte nichts. So geschehen bei
           zwei Milchsorten zu je 1,11 €/l. Gleichstand *unten* bei einem
           teureren Dritten bleibt markiert: Dann stimmt die Aussage. */
        if (kandidaten.every((kandidat) => kandidat.wert === niedrigster)) continue;
        for (const kandidat of kandidaten) {
            if (kandidat.wert === niedrigster) kandidat.gruppe.niedrigsterGefundenerGrundpreis = true;
        }
    }
}

export function angeboteFuerArtikel(daten, artikelId, heute = new Date(), maerkte = []) {
    return gruppiereAngebote(
        aktiveAngebote(daten, heute, maerkte).filter((angebot) => angebot.artikelId === artikelId)
    );
}

export function angebotStatus(daten, heute = new Date(), maerkte = []) {
    if (!pruefeAngebotsergebnis(daten, maerkte).gueltig) {
        return { vorhanden: false, erzeugt: null, angebote: 0, artikel: 0, gueltigBis: null, nichtGelesen: [] };
    }
    const gruppen = gruppiereAngebote(aktiveAngebote(daten, heute, maerkte));
    return {
        vorhanden: true,
        erzeugt: new Date(daten.erzeugt),
        angebote: gruppen.length,
        artikel: new Set(gruppen.map((angebot) => angebot.artikelId)).size,
        gueltigBis: gruppen.length
            ? new Date(`${gruppen.map((angebot) => angebot.gueltigBis).sort()[0]}T12:00:00`)
            : null,
        nichtGelesen: Array.isArray(daten.nichtGelesen) ? daten.nichtGelesen : []
    };
}

export function preisDeutsch(wert) {
    return `${Number(wert).toFixed(2).replace('.', ',')} €`;
}
