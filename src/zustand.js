/**
 * Der Zustand von Foxi: einmal aus der Datenbank gelesen, im Speicher
 * gehalten, bei jeder Änderung zurückgeschrieben.
 *
 * Warum eine Kopie im Speicher? Der Katalog hat rund 480 Artikel, und die
 * Kachelwand wird bei jedem Tipp neu sortiert. Ein IndexedDB-Lauf pro
 * Bildaufbau wäre auf einem älteren Telefon sichtbar. Geschrieben wird
 * trotzdem sofort – wer im Laden abhakt, darf die App jederzeit wegwischen.
 */

import * as db from './db.js';

const zuhoerer = new Set();

export const zustand = {
    artikel: new Map(),      // id → { id, name, kategorieId, icon, zaehler, letzteKaeufe[] }
    kategorien: [],          // [{ id, name, icon, position }]
    liste: new Map(),        // artikelId → { artikelId, menge, notiz, erledigt, erledigtAm }
    bilder: new Map(),       // artikelId → lokales, komprimiertes Produktfoto
    rezepte: [],             // [{ id, name, artikelIds[] }]
    einstellungen: { modus: 'basis' },
    bereit: false
};

/** Änderungen anmelden. Gibt eine Funktion zum Abmelden zurück. */
export function beiAenderung(rueckruf) {
    zuhoerer.add(rueckruf);
    return () => zuhoerer.delete(rueckruf);
}

function melde(grund) {
    for (const rueckruf of zuhoerer) rueckruf(grund);
}

/* ────────────────────────────────────────────────────────────────────────
   Start
   ──────────────────────────────────────────────────────────────────────── */

/**
 * Erststart: Katalog und Beispielrezepte aus den mitgelieferten JSON-Dateien
 * in die Datenbank legen. Danach werden diese Dateien nie wieder gelesen –
 * ab dem zweiten Start läuft Foxi ohne eine einzige Anfrage.
 */
async function erstbefuellung(basisPfad) {
    const [katalog, rezepte] = await Promise.all([
        fetch(`${basisPfad}src/daten/katalog.json`).then((a) => a.json()),
        fetch(`${basisPfad}src/daten/rezepte.json`).then((a) => a.json())
    ]);

    const artikel = katalog.artikel.map((a) => ({
        id: a.id,
        name: a.name,
        kategorieId: a.kategorieId,
        icon: a.icon,
        zaehler: 0,
        letzteKaeufe: [],
        eigen: false
    }));

    /* `ursprung` merkt sich die Reihenfolge, mit der Foxi ausgeliefert wurde.
       Ohne sie gäbe es keinen Weg zurück, nachdem jemand die Kategorien
       einmal durcheinandergezogen hat. */
    const kategorien = katalog.kategorien.map((k) => ({ ...k, ursprung: k.position }));
    await db.legeViele(db.SPEICHER.KATEGORIEN, kategorien);
    await db.legeViele(db.SPEICHER.ARTIKEL, artikel);
    await db.legeViele(db.SPEICHER.REZEPTE, rezepte.rezepte);
    await db.lege(db.SPEICHER.EINSTELLUNGEN, { schluessel: 'modus', wert: 'basis' });
    await db.lege(db.SPEICHER.EINSTELLUNGEN, { schluessel: 'katalogVersion', wert: katalog.version });
}

export async function starte(basisPfad = './') {
    let kategorien = await db.alle(db.SPEICHER.KATEGORIEN);
    if (kategorien.length === 0) {
        await erstbefuellung(basisPfad);
        kategorien = await db.alle(db.SPEICHER.KATEGORIEN);
    }

    const [artikel, liste, rezepte, einstellungen, bilder] = await Promise.all([
        db.alle(db.SPEICHER.ARTIKEL),
        db.alle(db.SPEICHER.LISTE),
        db.alle(db.SPEICHER.REZEPTE),
        db.alle(db.SPEICHER.EINSTELLUNGEN),
        db.alle(db.SPEICHER.BILDER)
    ]);

    zustand.kategorien = kategorien.sort((a, b) => a.position - b.position);
    zustand.artikel = new Map(artikel.map((a) => [a.id, a]));
    zustand.liste = new Map(liste.map((e) => [e.artikelId, e]));
    zustand.rezepte = rezepte;
    zustand.bilder = new Map(bilder.map((bild) => [bild.artikelId, bild]));
    for (const eintrag of einstellungen) zustand.einstellungen[eintrag.schluessel] = eintrag.wert;
    if (zustand.einstellungen.modus !== 'experte') zustand.einstellungen.modus = 'basis';
    /* Alte Mengen/Notizen werden beim ersten Start der neuen Fassung zum
       dauerhaften Produktwunsch. Damit geht beim Umbau kein Text verloren. */
    const geaenderteArtikel = [];
    const geaenderteEintraege = [];
    for (const eintrag of zustand.liste.values()) {
        const artikelEintrag = zustand.artikel.get(eintrag.artikelId);
        if (!artikelEintrag) continue;
        const alt = [eintrag.menge, eintrag.notiz].filter(Boolean).join(' · ').trim();
        if (!artikelEintrag.standardWunsch && alt) {
            artikelEintrag.standardWunsch = alt;
            geaenderteArtikel.push(artikelEintrag);
        }
        if (eintrag.notiz) {
            eintrag.menge = alt;
            eintrag.notiz = '';
            geaenderteEintraege.push(eintrag);
        }
    }
    await Promise.all([
        geaenderteArtikel.length ? db.legeViele(db.SPEICHER.ARTIKEL, geaenderteArtikel) : null,
        geaenderteEintraege.length ? db.legeViele(db.SPEICHER.LISTE, geaenderteEintraege) : null
    ]);
    zustand.bereit = true;
    melde('start');
}

/* ────────────────────────────────────────────────────────────────────────
   Liste
   ──────────────────────────────────────────────────────────────────────── */

export function aufDerListe(artikelId) {
    return zustand.liste.has(artikelId);
}

export function offeneEintraege() {
    return [...zustand.liste.values()].filter((e) => !e.erledigt);
}

export function erledigteEintraege() {
    return [...zustand.liste.values()]
        .filter((e) => e.erledigt)
        .sort((a, b) => (b.erledigtAm || 0) - (a.erledigtAm || 0));
}

export async function aufListeSetzen(artikelId) {
    if (!zustand.artikel.has(artikelId)) return null;
    const artikel = zustand.artikel.get(artikelId);
    const eintrag = { artikelId, menge: artikel.standardWunsch || '', notiz: '', erledigt: false, erledigtAm: null };
    zustand.liste.set(artikelId, eintrag);
    await db.lege(db.SPEICHER.LISTE, eintrag);
    melde('liste');
    return eintrag;
}

export async function vonListeNehmen(artikelId) {
    if (!zustand.liste.has(artikelId)) return;
    zustand.liste.delete(artikelId);
    await db.loesche(db.SPEICHER.LISTE, artikelId);
    melde('liste');
}

/** Kachel im Katalog: drauf oder runter. Ein Tipp, zwei Richtungen. */
export async function umschalten(artikelId) {
    if (aufDerListe(artikelId)) {
        await vonListeNehmen(artikelId);
        return false;
    }
    await aufListeSetzen(artikelId);
    return true;
}

/**
 * Abhaken – der einzige Ort, an dem Foxi etwas lernt.
 *
 * Der Zeitstempel wandert in `letzteKaeufe` des Artikels; daraus speist sich
 * die Reihenfolge im Katalog. Die Historie wird bei 60 Einträgen gekappt:
 * Was zwei Jahre zurückliegt, wiegt nach der Halbwertszeit ohnehin nichts
 * mehr, kostet aber Platz in jeder Sicherung.
 */
export async function abhaken(artikelId) {
    const eintrag = zustand.liste.get(artikelId);
    const artikel = zustand.artikel.get(artikelId);
    if (!eintrag || !artikel || eintrag.erledigt) return;

    const jetzt = Date.now();
    eintrag.erledigt = true;
    eintrag.erledigtAm = jetzt;
    artikel.letzteKaeufe = [...(artikel.letzteKaeufe || []), jetzt].slice(-60);
    artikel.zaehler = (artikel.zaehler || 0) + 1;

    await Promise.all([
        db.lege(db.SPEICHER.LISTE, eintrag),
        db.lege(db.SPEICHER.ARTIKEL, artikel)
    ]);
    melde('abhaken');
}

/** Rückgängig: der Zeitstempel dieses Abhakens verschwindet wieder. */
export async function zurueckholen(artikelId) {
    const eintrag = zustand.liste.get(artikelId);
    const artikel = zustand.artikel.get(artikelId);
    if (!eintrag || !artikel || !eintrag.erledigt) return;

    const zeitpunkt = eintrag.erledigtAm;
    eintrag.erledigt = false;
    eintrag.erledigtAm = null;
    if (zeitpunkt) {
        const stelle = (artikel.letzteKaeufe || []).lastIndexOf(zeitpunkt);
        if (stelle >= 0) artikel.letzteKaeufe.splice(stelle, 1);
        artikel.zaehler = Math.max(0, (artikel.zaehler || 1) - 1);
    }

    await Promise.all([
        db.lege(db.SPEICHER.LISTE, eintrag),
        db.lege(db.SPEICHER.ARTIKEL, artikel)
    ]);
    melde('liste');
}

export async function erledigteAufraeumen() {
    const erledigte = erledigteEintraege();
    for (const eintrag of erledigte) zustand.liste.delete(eintrag.artikelId);
    await Promise.all(erledigte.map((e) => db.loesche(db.SPEICHER.LISTE, e.artikelId)));
    melde('liste');
    return erledigte.length;
}

export async function listeLeeren() {
    zustand.liste.clear();
    await db.leere(db.SPEICHER.LISTE);
    melde('liste');
}

/** Menge und Notiz (Experte). Leere Zeichenketten bleiben leer, nicht `null` –
 *  so muss die Oberfläche nie zwei Abwesenheiten unterscheiden. */
export async function eintragAendern(artikelId, felder) {
    const eintrag = zustand.liste.get(artikelId);
    if (!eintrag) return;
    if ('menge' in felder) eintrag.menge = String(felder.menge || '').trim();
    if ('notiz' in felder) eintrag.notiz = String(felder.notiz || '').trim();
    await db.lege(db.SPEICHER.LISTE, eintrag);
    melde('liste');
}

/* ────────────────────────────────────────────────────────────────────────
   Artikel
   ──────────────────────────────────────────────────────────────────────── */

/** Eigener Artikel – der Ausnahmefall, wenn der Katalog etwas nicht kennt. */
export async function artikelAnlegen(name, kategorieId, icon = '🛒') {
    const sauber = String(name || '').trim();
    if (!sauber) return null;
    const id = `eigen-${Date.now().toString(36)}`;
    const artikel = {
        id,
        name: sauber,
        kategorieId: kategorieId || 'sonstiges',
        icon,
        zaehler: 0,
        letzteKaeufe: [],
        eigen: true
    };
    zustand.artikel.set(id, artikel);
    await db.lege(db.SPEICHER.ARTIKEL, artikel);
    melde('artikel');
    return artikel;
}

export function alleArtikel() {
    return [...zustand.artikel.values()];
}

export function produktfoto(artikelId) {
    return zustand.bilder.get(artikelId)?.datenUrl || '';
}

export async function produktfotoSetzen(artikelId, datenUrl) {
    if (!zustand.artikel.has(artikelId)) return false;
    if (!/^data:image\/(?:jpeg|png|webp);base64,/i.test(datenUrl) || datenUrl.length > 900000) return false;
    const bild = { artikelId, datenUrl, aktualisiert: Date.now() };
    zustand.bilder.set(artikelId, bild);
    await db.lege(db.SPEICHER.BILDER, bild);
    melde('produktfoto');
    return true;
}

export async function produktfotoLoeschen(artikelId) {
    zustand.bilder.delete(artikelId);
    await db.loesche(db.SPEICHER.BILDER, artikelId);
    melde('produktfoto');
}

export async function produktwunschSetzen(artikelId, wert) {
    const artikel = zustand.artikel.get(artikelId);
    if (!artikel) return;
    artikel.standardWunsch = String(wert || '').trim().slice(0, 180);
    const eintrag = zustand.liste.get(artikelId);
    if (eintrag) { eintrag.menge = artikel.standardWunsch; eintrag.notiz = ''; }
    await Promise.all([
        db.lege(db.SPEICHER.ARTIKEL, artikel),
        eintrag ? db.lege(db.SPEICHER.LISTE, eintrag) : null
    ]);
    melde('produktwunsch');
}

/* ────────────────────────────────────────────────────────────────────────
   Rezepte

   Ein Rezept ist ein Name und eine Artikelliste. Kein Web-Import, keine
   Rezeptdatenbank, keine Bilder, keine Mengenangaben pro Zutat – das wäre
   eine Kochbuch-App, und die ist Foxi nicht.
   ──────────────────────────────────────────────────────────────────────── */

export async function rezeptAnlegen(name, artikelIds) {
    const sauber = String(name || '').trim();
    if (!sauber || !artikelIds?.length) return null;
    const rezept = {
        id: `rezept-eigen-${Date.now().toString(36)}`,
        name: sauber,
        artikelIds: [...new Set(artikelIds)],
        eigen: true
    };
    zustand.rezepte = [...zustand.rezepte, rezept];
    await db.lege(db.SPEICHER.REZEPTE, rezept);
    melde('rezepte');
    return rezept;
}

export async function rezeptLoeschen(id) {
    zustand.rezepte = zustand.rezepte.filter((r) => r.id !== id);
    await db.loesche(db.SPEICHER.REZEPTE, id);
    melde('rezepte');
}

/**
 * Alle Zutaten auf einmal. Was schon auf der Liste steht, bleibt wie es ist –
 * ein Rezept darf eine von Hand gesetzte Menge nicht überschreiben.
 * Zutaten, die es im Katalog nicht mehr gibt, werden übersprungen.
 */
export async function rezeptAufListe(id) {
    const rezept = zustand.rezepte.find((r) => r.id === id);
    if (!rezept) return 0;

    const neue = rezept.artikelIds.filter(
        (artikelId) => zustand.artikel.has(artikelId) && !zustand.liste.has(artikelId)
    );
    const eintraege = neue.map((artikelId) => ({
        artikelId, menge: zustand.artikel.get(artikelId)?.standardWunsch || '', notiz: '', erledigt: false, erledigtAm: null
    }));
    for (const eintrag of eintraege) zustand.liste.set(eintrag.artikelId, eintrag);
    if (eintraege.length) await db.legeViele(db.SPEICHER.LISTE, eintraege);
    melde('liste');
    return eintraege.length;
}

/* ────────────────────────────────────────────────────────────────────────
   Import
   ──────────────────────────────────────────────────────────────────────── */

/**
 * Eine eingelesene Liste übernehmen.
 *
 * `modus` ist entweder `nurNeue` (Mengen auf dieser Seite bleiben stehen)
 * oder `alles` (die Datei gewinnt). Unbekannte Artikel werden angelegt, mit
 * ihrer Kategorie aus der Datei – kennt dieses Gerät die Kategorie nicht,
 * landen sie unter „Sonstiges" statt im Nichts.
 */
export async function importAnwenden(fremdeArtikel, modus = 'nurNeue') {
    const bekannteKategorien = new Set(zustand.kategorien.map((k) => k.id));
    const neueArtikel = [];
    const neueEintraege = [];

    for (const fremd of fremdeArtikel) {
        const vorhandenerEintrag = zustand.liste.get(fremd.id);
        const nurReaktivieren = modus !== 'alles' && vorhandenerEintrag?.erledigt;
        if (vorhandenerEintrag && modus !== 'alles' && !nurReaktivieren) continue;

        if (!zustand.artikel.has(fremd.id)) {
            const artikel = {
                id: fremd.id,
                name: fremd.name,
                kategorieId: bekannteKategorien.has(fremd.kategorieId) ? fremd.kategorieId : 'sonstiges',
                icon: fremd.icon || '🛒',
                zaehler: 0,
                letzteKaeufe: [],
                eigen: true
            };
            zustand.artikel.set(artikel.id, artikel);
            neueArtikel.push(artikel);
        }

        const artikel = zustand.artikel.get(fremd.id);
        /* „Nur neue“ betrachtet einen abgehakten Artikel als neuen Bedarf,
           bewahrt aber die Angaben dieses Haushalts. Die fremde Datei darf
           lokale Menge, Notiz und Produktwunsch erst bei „Alles übernehmen“
           ersetzen. */
        if (nurReaktivieren) {
            const eintrag = {
                ...vorhandenerEintrag,
                artikelId: fremd.id,
                erledigt: false,
                erledigtAm: null
            };
            zustand.liste.set(eintrag.artikelId, eintrag);
            neueEintraege.push(eintrag);
            continue;
        }

        const wunsch = [fremd.menge, fremd.notiz]
            .map((teil) => typeof teil === 'string' ? teil.trim() : '')
            .filter(Boolean)
            .join(' · ');
        /* Bei „Alles übernehmen“ gewinnt auch ein bewusst leerer Wert aus
           der Datei. Andernfalls würde der lokale Produktwunsch die gewählte
           Importentscheidung unmittelbar wieder überschreiben. */
        const bisherigerWunsch = artikel?.standardWunsch || '';
        if (artikel && (modus === 'alles' || wunsch) && bisherigerWunsch !== wunsch) {
            artikel.standardWunsch = wunsch.slice(0, 180);
            if (!neueArtikel.includes(artikel)) neueArtikel.push(artikel);
        }

        /* Ein bereits abgehakter Eintrag wird durch den Import wieder offen:
           Wenn das andere Gerät ihn schickt, fehlt er dort noch. */
        const eintrag = {
            artikelId: fremd.id,
            menge: artikel?.standardWunsch || wunsch,
            notiz: '',
            erledigt: false,
            erledigtAm: null
        };
        zustand.liste.set(eintrag.artikelId, eintrag);
        neueEintraege.push(eintrag);
    }

    if (neueArtikel.length) await db.legeViele(db.SPEICHER.ARTIKEL, neueArtikel);
    if (neueEintraege.length) await db.legeViele(db.SPEICHER.LISTE, neueEintraege);
    melde('import');
    return neueEintraege.length;
}

/* ────────────────────────────────────────────────────────────────────────
   Einstellungen
   ──────────────────────────────────────────────────────────────────────── */

export function modus() {
    return zustand.einstellungen.modus;
}

export function istExperte() {
    return zustand.einstellungen.modus === 'experte';
}

/**
 * Umschalten zwischen Basis und Experte.
 *
 * Verlustfrei, und zwar wörtlich: Der Schalter berührt nur diesen einen Wert.
 * Mengen und Notizen, die im Expertenmodus entstanden sind, bleiben in der
 * Datenbank stehen und tauchen unverändert wieder auf – Basis zeigt sie nur
 * nicht an.
 */
export async function modusSetzen(neuerModus) {
    const wert = neuerModus === 'experte' ? 'experte' : 'basis';
    zustand.einstellungen.modus = wert;
    await db.lege(db.SPEICHER.EINSTELLUNGEN, { schluessel: 'modus', wert });
    melde('modus');
}

/** Kategorie-Reihenfolge (Experte). */
export async function kategorienNeuOrdnen(idsInReihenfolge) {
    const nachId = new Map(zustand.kategorien.map((k) => [k.id, k]));
    const neu = [];
    idsInReihenfolge.forEach((id, position) => {
        const kategorie = nachId.get(id);
        if (kategorie) { kategorie.position = position; neu.push(kategorie); nachId.delete(id); }
    });
    let position = neu.length;
    for (const rest of nachId.values()) { rest.position = position++; neu.push(rest); }
    zustand.kategorien = neu;
    await db.legeViele(db.SPEICHER.KATEGORIEN, neu);
    melde('kategorien');
}

/**
 * Postleitzahl und Ort.
 *
 * Das einzige Feld in Foxi, das nach draußen zeigt – und auch das nur, weil
 * ein Mensch den kopierten Text selbst weitergibt. Die App fragt damit
 * nichts ab, schlägt nichts nach und schickt nichts weg; der Wert liegt in
 * IndexedDB wie alles andere.
 */
export function ort() {
    return zustand.einstellungen.ort || '';
}

export async function ortSetzen(wert) {
    const sauber = String(wert || '').trim();
    zustand.einstellungen.ort = sauber;
    await db.lege(db.SPEICHER.EINSTELLUNGEN, { schluessel: 'ort', wert: sauber });
    melde('einstellungen');
}

export function maerkte() {
    return Array.isArray(zustand.einstellungen.maerkte) ? zustand.einstellungen.maerkte : [];
}

export function aktiveMaerkte() {
    return maerkte().filter((markt) => markt.aktiv !== false);
}

export async function marktSpeichern(eingabe) {
    const haendler = String(eingabe.haendler || '').trim().slice(0, 80);
    const markt = String(eingabe.markt || '').trim().slice(0, 200);
    if (!haendler || !markt) return null;
    const aktuell = [...maerkte()];
    const id = eingabe.id || `markt-${Date.now().toString(36)}`;
    const wert = { id, haendler, markt, angebotsseite: String(eingabe.angebotsseite || '').trim().slice(0, 500), aktiv: eingabe.aktiv !== false };
    const index = aktuell.findIndex((eintrag) => eintrag.id === id);
    if (index >= 0) aktuell[index] = wert; else aktuell.push(wert);
    zustand.einstellungen.maerkte = aktuell;
    await db.lege(db.SPEICHER.EINSTELLUNGEN, { schluessel: 'maerkte', wert: aktuell });
    melde('maerkte');
    return wert;
}

export async function marktAktivSetzen(id, aktiv) {
    const markt = maerkte().find((eintrag) => eintrag.id === id);
    if (!markt) return;
    await marktSpeichern({ ...markt, aktiv });
}

export async function marktLoeschen(id) {
    const wert = maerkte().filter((markt) => markt.id !== id);
    zustand.einstellungen.maerkte = wert;
    await db.lege(db.SPEICHER.EINSTELLUNGEN, { schluessel: 'maerkte', wert });
    melde('maerkte');
}

/**
 * Letztes eingelesenes Ergebnis des Angebotschecks.
 *
 * Es liegt wie alle Einstellungen ausschließlich in IndexedDB. Foxi holt
 * selbst keine Angebote; der Mensch fügt die geprüfte Ergebnisdatei ein.
 */
export function angebotsergebnis() {
    return zustand.einstellungen.angebotsergebnis || null;
}

export async function angebotsergebnisSetzen(daten) {
    zustand.einstellungen.angebotsergebnis = daten;
    await db.lege(db.SPEICHER.EINSTELLUNGEN, {
        schluessel: 'angebotsergebnis',
        wert: daten
    });
    melde('angebote');
}

/** Die große Einführung ist nur bis zum ersten verstandenen Durchlauf nötig.
 * Ein bereits eingelesenes Ergebnis gilt ebenfalls als eindeutiger Beleg,
 * dass der Weg funktioniert hat – wichtig für Nutzer der vorherigen Fassung. */
export function angebotseinfuehrungErledigt() {
    return Boolean(zustand.einstellungen.angebotseinfuehrungErledigt || angebotsergebnis());
}

export async function angebotseinfuehrungAbschliessen() {
    zustand.einstellungen.angebotseinfuehrungErledigt = true;
    await db.lege(db.SPEICHER.EINSTELLUNGEN, {
        schluessel: 'angebotseinfuehrungErledigt',
        wert: true
    });
    melde('angebote');
}

export async function kategorienZuruecksetzen() {
    const nachUrsprung = [...zustand.kategorien].sort(
        (a, b) => (a.ursprung ?? a.position) - (b.ursprung ?? b.position)
    );
    await kategorienNeuOrdnen(nachUrsprung.map((k) => k.id));
}

export async function allesZuruecksetzen() {
    await db.loescheDatenbank();
    zustand.artikel.clear();
    zustand.liste.clear();
    zustand.bilder.clear();
    zustand.kategorien = [];
    zustand.rezepte = [];
    zustand.einstellungen = { modus: 'basis' };
    zustand.bereit = false;
}
