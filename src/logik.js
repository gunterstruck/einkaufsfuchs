/**
 * Die Rechenregeln von Foxi – reine Funktionen, kein DOM, keine Datenbank.
 *
 * Alles, was man prüfen können muss, steht hier: die lernende Sortierung, die
 * Gruppierung der Liste und der Klartext-Export. Die Oberfläche ruft diese
 * Funktionen auf; die Tests rufen dieselben auf.
 */

export const TAG_MS = 24 * 60 * 60 * 1000;

/** Halbwertszeit der Erinnerung. Ein Kauf von vor 30 Tagen zählt halb so viel
 *  wie einer von heute, einer von vor 60 Tagen ein Viertel. Warum überhaupt
 *  vergessen? Ohne Verfall gewinnt ewig, was man einmal einen Monat lang
 *  täglich gekauft hat – und die Kachel steht noch oben, wenn das Kind längst
 *  ausgezogen ist. */
export const HALBWERTSZEIT_TAGE = 30;

/**
 * Wie present ist ein Artikel? Summe aller Käufe, jeder mit dem Alter
 * abklingend. Kein Menüpunkt, keine Einstellung – die Zahl entsteht beim
 * Abhaken von selbst.
 */
export function kaufScore(letzteKaeufe, jetzt = Date.now(), halbwertszeitTage = HALBWERTSZEIT_TAGE) {
    if (!Array.isArray(letzteKaeufe) || letzteKaeufe.length === 0) return 0;
    let summe = 0;
    for (const zeitpunkt of letzteKaeufe) {
        const alterTage = Math.max(0, (jetzt - zeitpunkt) / TAG_MS);
        summe += Math.pow(0.5, alterTage / halbwertszeitTage);
    }
    return summe;
}

/** Sortierschlüssel: erst der Score (absteigend), bei Gleichstand der Name.
 *  Der Namensvergleich ist die stille Hälfte: Ohne ihn wäre die Reihenfolge
 *  frisch installierter Kataloge von der Datenbank abhängig statt vom Alphabet. */
export function vergleicheArtikel(a, b, jetzt = Date.now()) {
    const diff = kaufScore(b.letzteKaeufe, jetzt) - kaufScore(a.letzteKaeufe, jetzt);
    if (Math.abs(diff) > 1e-9) return diff;
    return a.name.localeCompare(b.name, 'de');
}

/** Der Katalog einer Kategorie, gelernt sortiert. */
export function sortiereArtikel(artikel, jetzt = Date.now()) {
    return [...artikel].sort((a, b) => vergleicheArtikel(a, b, jetzt));
}

/**
 * Die Kachelreihe ganz oben: was dieser Haushalt tatsächlich braucht.
 * Sie erscheint erst, wenn es etwas zu zeigen gibt – vor dem ersten Einkauf
 * wäre sie eine leere Behauptung.
 */
export function oftGebraucht(artikel, anzahl = 12, jetzt = Date.now()) {
    return artikel
        .filter((a) => kaufScore(a.letzteKaeufe, jetzt) > 0)
        .sort((a, b) => vergleicheArtikel(a, b, jetzt))
        .slice(0, anzahl);
}

/** Suche: Anfang eines Wortes zählt mehr als die Mitte, damit „Milch" bei
 *  „mil" vor „Mandelmilch" steht. */
export function sucheArtikel(artikel, begriff, jetzt = Date.now()) {
    const nadel = normalisiere(begriff);
    if (!nadel) return [];
    const treffer = [];
    for (const a of artikel) {
        const heu = normalisiere(a.name);
        const stelle = heu.indexOf(nadel);
        if (stelle < 0) continue;
        const wortanfang = stelle === 0 || heu[stelle - 1] === ' ' || heu[stelle - 1] === '-';
        treffer.push({ artikel: a, rang: stelle === 0 ? 0 : wortanfang ? 1 : 2 });
    }
    treffer.sort((x, y) => x.rang - y.rang || vergleicheArtikel(x.artikel, y.artikel, jetzt));
    return treffer.map((x) => x.artikel);
}

export function normalisiere(text) {
    return String(text || '')
        .toLowerCase()
        .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')
        .replace(/é|è|ê/g, 'e')
        .trim();
}

/**
 * Die Liste, gruppiert nach Kategorie in der eingestellten Reihenfolge.
 * Leere Kategorien fallen weg – die Liste zeigt den Laden, nicht das Regal-
 * verzeichnis.
 */
export function gruppiereListe(eintraege, artikelNachId, kategorien) {
    const reihenfolge = [...kategorien].sort((a, b) => a.position - b.position);
    const gruppen = new Map(reihenfolge.map((k) => [k.id, { kategorie: k, eintraege: [] }]));
    const ohneKategorie = { kategorie: { id: '_sonstiges', name: 'Sonstiges', icon: '🛒', position: 9999 }, eintraege: [] };

    for (const eintrag of eintraege) {
        const artikel = artikelNachId.get(eintrag.artikelId);
        if (!artikel) continue;
        const gruppe = gruppen.get(artikel.kategorieId) || ohneKategorie;
        gruppe.eintraege.push({ ...eintrag, artikel });
    }

    const ergebnis = [...gruppen.values()];
    if (ohneKategorie.eintraege.length) ergebnis.push(ohneKategorie);
    for (const gruppe of ergebnis) {
        gruppe.eintraege.sort((a, b) => a.artikel.name.localeCompare(b.artikel.name, 'de'));
    }
    return ergebnis.filter((g) => g.eintraege.length > 0);
}

/**
 * Der Klartext-Export („KI-Brücke").
 *
 * Bewusst ohne angehängte Frage. Wer den Text irgendwo einfügt, schreibt
 * selbst dazu, was er wissen will – „was koche ich daraus", „was fehlt noch",
 * „erklär mir Sardellenpaste". So altert die Funktion nicht mit den Modellen.
 */
export function alsKlartext(gruppen, datum = new Date(), ort = '') {
    const kopf = [`Einkaufsliste (${datumDeutsch(datum)})`];
    /* Die Ortszeile steht nur da, wenn jemand einen Ort hinterlegt hat. Foxi
       ermittelt ihn nicht und fragt ihn nirgends ab – er steht in den
       Einstellungen, weil er im weitergegebenen Text nützlich ist: Ohne ihn
       weiß das Gegenüber nicht, um welche Läden es überhaupt geht. */
    if (ort) kopf.push(`Ort: ${ort}`);

    const zeilen = gruppen.map((gruppe) => {
        const teile = gruppe.eintraege.map((e) => {
            const zusatz = [e.menge, e.notiz].filter(Boolean).join(', ');
            return zusatz ? `${e.artikel.name} (${zusatz})` : e.artikel.name;
        });
        return `${gruppe.kategorie.name}: ${teile.join(', ')}`;
    });
    return [...kopf, '', ...zeilen].join('\n');
}

/**
 * Der zweite Klartext-Export: nicht was heute fehlt, sondern was dieser
 * Haushalt **immer** braucht.
 *
 * Das ist die interessantere Frage nach draußen. „Was steht auf meiner Liste"
 * beantwortet man sich selbst; „ist etwas von dem, was ich ständig kaufe,
 * gerade billiger" kann man ohne Hilfe gar nicht beantworten – und die
 * Antwort ändert sich jede Woche.
 *
 * Die Zahl in Klammern ist keine Zierde: Sie sagt dem Gegenüber, wie ernst
 * ein Artikel gemeint ist. Ein 40× gekaufter Kaffee wiegt anders als etwas,
 * das zweimal vorkam.
 *
 * Auch hier: keine vorformulierte Frage. Nur der Befund.
 */
export function alsStammartikelText(zeilen, datum = new Date(), ort = '') {
    /* Nach draußen der volle Name: Wer den Text bekommt, soll wissen, woher
       er kommt – „Foxi" allein sagt einem Fremden nichts. */
    const kopf = [`Stammartikel (EinkaufsFuchs, Stand ${datumDeutsch(datum)})`];
    if (ort) kopf.push(`Ort: ${ort}`);
    const namen = zeilen.map((z) => `${z.artikel.name} (${z.anzahl}×)`);
    return [...kopf, '', namen.join(', ')].join('\n');
}

export function datumDeutsch(datum = new Date()) {
    const zz = (n) => String(n).padStart(2, '0');
    return `${zz(datum.getDate())}.${zz(datum.getMonth() + 1)}.${datum.getFullYear()}`;
}

export function datumFuerDateiname(datum = new Date()) {
    const zz = (n) => String(n).padStart(2, '0');
    return `${datum.getFullYear()}-${zz(datum.getMonth() + 1)}-${zz(datum.getDate())}`;
}

/* ────────────────────────────────────────────────────────────────────────
   Teilen als Datei

   Kein Server, kein Konto, kein Sync-Protokoll: Die Liste wird zu einer
   Datei, und der Mensch entscheidet, wohin sie geht. Die Endung ist `.json`
   und nichts Eigenes – Messenger zicken bei exotischen Endungen, und eine
   Datei, die WhatsApp nicht durchlässt, ist keine geteilte Liste.

   Jeder Eintrag trägt alles mit, was das Gegenüber zum Anzeigen braucht:
   Name, Kategorie und Zeichen. So funktioniert die Datei auch dann, wenn
   dort ein selbst angelegter Artikel unbekannt ist.

   Was die Datei NICHT enthält: `letzteKaeufe`. Die Kaufhistorie ist das
   Gedächtnis eines Haushalts, keine Beilage zu einer Einkaufsliste – wer
   eine Liste weitergibt, gibt nicht mit, wie oft er Bier kauft.
   ──────────────────────────────────────────────────────────────────────── */

/* Auch die Kennung im Dateikopf bleibt, wie sie ist. Sie steht in jeder
   bereits exportierten Datei; änderte man sie, wiese Foxi seine eigenen
   älteren Dateien als „fremd" ab. Der Dateiname trägt den neuen Namen –
   das ist der Teil, den ein Mensch sieht. */
export const DATEI_TYP = 'foxi-liste';
export const DATEI_VERSION = 1;
export const AUSTAUSCHDATEI_GRENZEN = Object.freeze({
    bytes: 2 * 1024 * 1024,
    artikelAnzahl: 1000,
    erzeugt: 80,
    id: 200,
    name: 300,
    kategorieId: 200,
    kategorieName: 300,
    icon: 64,
    menge: 500,
    notiz: 500
});

export function alsAustauschdatei(eintraege, artikelNachId, kategorienNachId, datum = new Date()) {
    return {
        typ: DATEI_TYP,
        version: DATEI_VERSION,
        erzeugt: datum.toISOString(),
        artikel: eintraege.flatMap((eintrag) => {
            const artikel = artikelNachId.get(eintrag.artikelId);
            if (!artikel) return [];
            return [{
                id: artikel.id,
                name: artikel.name,
                kategorieId: artikel.kategorieId,
                kategorieName: kategorienNachId.get(artikel.kategorieId)?.name || '',
                icon: artikel.icon,
                menge: eintrag.menge || '',
                notiz: eintrag.notiz || ''
            }];
        })
    };
}

/** Ist das überhaupt eine Foxi-Datei? Gibt einen Grund zurück statt eines
 *  Wahrheitswerts – „ungültig" allein hilft niemandem weiter. */
export function pruefeAustauschdatei(daten) {
    if (!daten || typeof daten !== 'object') return { gueltig: false, grund: 'kaputt' };
    if (daten.typ !== DATEI_TYP) return { gueltig: false, grund: 'fremd' };
    if (!Number.isInteger(daten.version) || daten.version < 1) {
        return { gueltig: false, grund: 'kaputt' };
    }
    if (daten.version > DATEI_VERSION) return { gueltig: false, grund: 'zuNeu' };
    if (!Array.isArray(daten.artikel) ||
        daten.artikel.length > AUSTAUSCHDATEI_GRENZEN.artikelAnzahl) {
        return { gueltig: false, grund: 'kaputt' };
    }
    if (daten.erzeugt !== undefined &&
        (typeof daten.erzeugt !== 'string' || daten.erzeugt.length > AUSTAUSCHDATEI_GRENZEN.erzeugt)) {
        return { gueltig: false, grund: 'kaputt' };
    }
    const textfelder = ['kategorieId', 'kategorieName', 'icon', 'menge', 'notiz'];
    const artikelGueltig = daten.artikel.every((artikel) => {
        if (!artikel || typeof artikel !== 'object' || Array.isArray(artikel)) return false;
        if (typeof artikel.id !== 'string' || !artikel.id.trim() ||
            artikel.id.length > AUSTAUSCHDATEI_GRENZEN.id) return false;
        if (typeof artikel.name !== 'string' || !artikel.name.trim() ||
            artikel.name.length > AUSTAUSCHDATEI_GRENZEN.name) return false;
        return textfelder.every((feld) => artikel[feld] === undefined || (
            typeof artikel[feld] === 'string' &&
            artikel[feld].length <= AUSTAUSCHDATEI_GRENZEN[feld]
        ));
    });
    if (!artikelGueltig) return { gueltig: false, grund: 'kaputt' };
    return { gueltig: true, grund: null };
}

/**
 * Was würde ein Import ändern? Drei Töpfe – neu, unverändert, abweichend.
 *
 * Der dritte ist der Grund, warum es überhaupt einen Dialog gibt: „Milch" auf
 * beiden Listen, hier ohne Menge, dort mit „2 Liter". Stillschweigend
 * überschreiben wäre Datenverlust; stillschweigend verwerfen wäre der Grund,
 * warum das Teilen dann niemand benutzt.
 */
export function vergleicheImport(fremdeArtikel, eigeneListe) {
    const neu = [];
    const doppelt = [];
    const abweichend = [];

    for (const fremd of fremdeArtikel) {
        const eigen = eigeneListe.get(fremd.id);
        if (!eigen) { neu.push(fremd); continue; }
        const gleicheMenge = (eigen.menge || '') === (fremd.menge || '');
        const gleicheNotiz = (eigen.notiz || '') === (fremd.notiz || '');
        /* Exportiert werden nur offene Einträge. Ist derselbe Artikel hier
           schon abgehakt, bedeutet sein Auftauchen in der fremden Datei
           deshalb eine echte Änderung: Er wird erneut gebraucht. */
        if (gleicheMenge && gleicheNotiz && !eigen.erledigt) doppelt.push(fremd);
        else abweichend.push(fremd);
    }

    return { neu, doppelt, abweichend };
}

/* ────────────────────────────────────────────────────────────────────────
   Statistik
   ──────────────────────────────────────────────────────────────────────── */

/** Was kauft dieser Haushalt wie oft? Rohe Zählung ohne Verfall – hier lautet
 *  die Frage „wie oft insgesamt", nicht „wie present gerade". */
export function kaufStatistik(artikel, anzahl = 20) {
    return artikel
        .filter((a) => (a.letzteKaeufe || []).length > 0)
        .map((a) => ({
            artikel: a,
            anzahl: a.letzteKaeufe.length,
            zuletzt: Math.max(...a.letzteKaeufe)
        }))
        .sort((x, y) => y.anzahl - x.anzahl || y.zuletzt - x.zuletzt)
        .slice(0, anzahl);
}
