/**
 * Bildschirm 3: Mehr.
 *
 * Im Basismodus stehen hier der geführte Angebotscheck und die wenigen
 * Grundlagen, die jeder verstehen muss. Seltene Werkzeuge tragen
 * `experte-nur` – sie sind nicht ausgebaut, sondern nur nicht im Bild.
 */

import { t } from '../texte.js';
import { VERSION } from '../version.js';
import { kaufStatistik, datumDeutsch } from '../logik.js';
import { HAENDLER, sichereAngebotsseite, angebotStatus, gruppiereAngebote, preisDeutsch, filialName, kurzeFiliale } from '../angebotsradar.js';
import {
    zustand, alleArtikel, offeneEintraege, listeLeeren, allesZuruecksetzen,
    rezeptAnlegen, rezeptLoeschen, rezeptAufListe,
    kategorienNeuOrdnen, kategorienZuruecksetzen, ort, ortSetzen, angebotsergebnis,
    angebotseinfuehrungErledigt, maerkte, marktSpeichern, marktAktivSetzen, marktLoeschen
} from '../zustand.js';
import { melde, zeigeBereich } from './schale.js';
import { zeigeDialog, dialogFeld, schliesseDialog } from './dialog.js';
import {
    vollsicherungExportieren, vollsicherungEinlesen, teileAlsDatei, kopiereListeAlsText, kopiereStammartikel, dateiEinlesen,
    zeigeQrCode, linkEinlesen
} from './teilen.js';
import {
    aktuelleAngebote, rechercheAuftragKopieren, rechercheAuftragSenden, kannAnAppSenden, ergebnisEinfuegen,
    ergebnisdateiEinlesen, zeigeAngebotsEinfuehrung
} from './angebote.js';

let behaelter = null;
let maerkteOffen = false;

export function mehrVerdrahten() {
    behaelter = document.getElementById('mehr-inhalt');
}

export function zeichneMehr() {
    if (!behaelter) return;
    behaelter.textContent = '';
    behaelter.append(
        angebotsradarKarte(),
        ueberFoxi(),
        rezepteKarte(),
        reihenfolgeKarte(),
        teilenKarte(),
        ortKarte(),
        statistikKarte(),
        datenKarte(),
        fusszeile()
    );
}

/* ────────────────────────────────────────────────────────────────────────
   Bausteine
   ──────────────────────────────────────────────────────────────────────── */

function karte(titel, { experte = false } = {}) {
    const abschnitt = document.createElement('section');
    abschnitt.className = 'karte' + (experte ? ' experte-nur' : '');
    const ueberschrift = document.createElement('h2');
    ueberschrift.textContent = titel;
    abschnitt.append(ueberschrift);
    return abschnitt;
}

function absatz(text, klasse = '') {
    const p = document.createElement('p');
    if (klasse) p.className = klasse;
    p.textContent = text;
    return p;
}

function knopfleiste(...knoepfe) {
    const leiste = document.createElement('div');
    leiste.className = 'karte-knoepfe';
    leiste.append(...knoepfe);
    return leiste;
}

function knopf(text, wirkung, { betont = false, gefahr = false } = {}) {
    const el = document.createElement('button');
    el.type = 'button';
    el.textContent = text;
    if (betont) el.className = 'primary';
    if (gefahr) el.className = 'danger';
    el.addEventListener('click', wirkung);
    return el;
}

/* ────────────────────────────────────────────────────────────────────────
   Über Foxi
   ──────────────────────────────────────────────────────────────────────── */

function ueberFoxi() {
    const abschnitt = karte(t('mehr.ueberTitel'));
    abschnitt.append(absatz(t('mehr.ueberText')));
    abschnitt.append(absatz(t('mehr.updateHinweis'), 'muted small'));
    return abschnitt;
}

/* ────────────────────────────────────────────────────────────────────────
   Rezepte
   ──────────────────────────────────────────────────────────────────────── */

function rezepteKarte() {
    const abschnitt = karte(t('rezepte.titel'), { experte: true });
    abschnitt.append(absatz(t('rezepte.erklaerung'), 'muted small'));

    if (zustand.rezepte.length === 0) {
        abschnitt.append(absatz(t('rezepte.leer'), 'muted'));
    } else {
        const liste = document.createElement('ul');
        liste.className = 'rezeptliste';
        for (const rezept of zustand.rezepte) liste.append(rezeptZeile(rezept));
        abschnitt.append(liste);
    }

    abschnitt.append(knopfleiste(knopf(t('rezepte.ausListe'), listeAlsRezept)));
    return abschnitt;
}

function rezeptZeile(rezept) {
    const zeile = document.createElement('li');

    const uebertragen = document.createElement('button');
    uebertragen.type = 'button';
    uebertragen.className = 'rezept-knopf';

    const name = document.createElement('span');
    name.className = 'rezept-name';
    name.textContent = rezept.name;

    const zahl = document.createElement('span');
    zahl.className = 'rezept-zahl';
    zahl.textContent = t('rezepte.zutaten', rezept.artikelIds.length);

    uebertragen.append(name, zahl);
    uebertragen.addEventListener('click', async () => {
        const anzahl = await rezeptAufListe(rezept.id);
        melde(t('rezepte.uebertragen', rezept.name, anzahl));
        if (anzahl > 0) zeigeBereich('liste');
    });

    const loeschen = document.createElement('button');
    loeschen.type = 'button';
    loeschen.className = 'rezept-loeschen';
    loeschen.textContent = '🗑️';
    loeschen.setAttribute('aria-label', `${t('rezepte.loeschen')}: ${rezept.name}`);
    loeschen.addEventListener('click', async () => {
        if (!confirm(t('rezepte.loeschenFrage', rezept.name))) return;
        await rezeptLoeschen(rezept.id);
        melde(t('rezepte.geloescht', rezept.name));
    });

    zeile.append(uebertragen, loeschen);
    return zeile;
}

/**
 * Ein Rezept entsteht aus dem, was gerade auf der Liste steht.
 *
 * Das ist der einzige Weg, und er ist Absicht: Ein eigener Zusammenbau-
 * Bildschirm („Zutaten auswählen") wäre ein zweiter Katalog mit zweiter
 * Suche – für eine Aufgabe, die man einmal im Monat hat. Wer ein Rezept
 * anlegen will, tippt es sich im Katalog zusammen wie einen Einkauf und
 * sichert es dann.
 */
function listeAlsRezept() {
    const eintraege = offeneEintraege();
    if (eintraege.length === 0) { melde(t('rezepte.ausListeLeer')); return; }

    const feld = dialogFeld({
        platzhalter: t('rezepte.namePlatzhalter'),
        beschriftung: t('rezepte.nameFrage'),
        bestaetigen: (wert) => sichern(wert, eintraege)
    });

    zeigeDialog({
        titel: t('rezepte.nameFrage'),
        /* Hier ist Tippen der ganze Zweck des Dialogs – die Tastatur soll
           gleich da sein. Warum das die Ausnahme ist: `zeigeDialog`. */
        fokus: true,
        koerper: [feld],
        knoepfe: [{
            text: t('menge.fertig'),
            betont: true,
            wirkung: () => sichern(feld.value, eintraege)
        }]
    });
}

async function sichern(name, eintraege) {
    const rezept = await rezeptAnlegen(name, eintraege.map((e) => e.artikelId));
    if (rezept) melde(t('rezepte.gesichert', rezept.name));
}

/* ────────────────────────────────────────────────────────────────────────
   Reihenfolge im Laden
   ──────────────────────────────────────────────────────────────────────── */

function reihenfolgeKarte() {
    const abschnitt = karte(t('kategorien.titel'), { experte: true });
    abschnitt.append(absatz(t('kategorien.erklaerung'), 'muted small'));

    const liste = document.createElement('ul');
    liste.className = 'ziehliste';
    for (const kategorie of zustand.kategorien) liste.append(kategorieZeile(kategorie, liste));
    abschnitt.append(liste);

    abschnitt.append(knopfleiste(knopf(t('kategorien.zuruecksetzen'), async () => {
        await kategorienZuruecksetzen();
        melde(t('kategorien.gespeichert'));
    })));
    return abschnitt;
}

function kategorieZeile(kategorie, liste) {
    const zeile = document.createElement('li');
    zeile.className = 'ziehzeile';
    zeile.dataset.kategorieId = kategorie.id;

    const griff = document.createElement('button');
    griff.type = 'button';
    griff.className = 'zieh-griff';
    griff.textContent = '⠿';
    griff.setAttribute('aria-label', t('kategorien.griff', kategorie.name));

    const icon = document.createElement('span');
    icon.className = 'zieh-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = kategorie.icon || '🛒';

    const name = document.createElement('span');
    name.className = 'zieh-name';
    name.textContent = kategorie.name;

    zeile.append(griff, icon, name);
    ziehenVerdrahten(griff, zeile, liste);
    return zeile;
}

/**
 * Ziehen mit Zeigerereignissen statt HTML5-Drag-and-drop.
 *
 * `dragstart` und Freunde gibt es auf iOS/Safari am Finger schlicht nicht –
 * eine Reihenfolge, die sich nur am Schreibtisch verschieben lässt, wäre für
 * eine Einkaufs-App die falsche Hälfte. Zeigerereignisse decken Maus,
 * Finger und Stift mit demselben Code ab.
 *
 * Die gezogene Zeile wird nicht verschoben, sondern an der Stelle neu
 * eingehängt, über der der Finger gerade steht. Das spart die ganze
 * Versatz-Rechnerei und sieht genauso aus.
 */
function ziehenVerdrahten(griff, zeile, liste) {
    griff.addEventListener('pointerdown', (ereignis) => {
        ereignis.preventDefault();
        zeile.classList.add('zieht');

        const bewegen = (bewegung) => {
            const unterDemFinger = document.elementFromPoint(bewegung.clientX, bewegung.clientY);
            const ziel = unterDemFinger?.closest('.ziehzeile');
            if (!ziel || ziel === zeile || ziel.parentElement !== liste) return;

            const kasten = ziel.getBoundingClientRect();
            const obereHaelfte = bewegung.clientY < kasten.top + kasten.height / 2;
            liste.insertBefore(zeile, obereHaelfte ? ziel : ziel.nextSibling);
        };

        const loslassen = async () => {
            document.removeEventListener('pointermove', bewegen);
            document.removeEventListener('pointerup', loslassen);
            document.removeEventListener('pointercancel', loslassen);
            zeile.classList.remove('zieht');
            await reihenfolgeSichern(liste);
        };

        /* Die Ereignisse hängen am Dokument, nicht am Griff – und das ist
           keine Geschmacksfrage.

           Zuerst stand hier `griff.setPointerCapture(…)`. Gemessen: Der Zug
           verschob die Zeile genau einmal und stand dann still, und
           gespeichert wurde nie etwas. Die Ursache ist `insertBefore` selbst:
           Es hängt die Zeile mitsamt Griff neu ein, und der Browser gibt die
           Pointer-Capture frei, sobald das erfassende Element aus dem Baum
           genommen wird. Danach erreichte weder `pointermove` noch
           `pointerup` je wieder den Griff.

           Am Dokument gibt es nichts freizugeben. Dass der Finger dabei
           nicht die Seite scrollt, sichert `touch-action: none` auf dem
           Griff – die Geste wird von dem Element bestimmt, auf dem sie
           beginnt. */
        document.addEventListener('pointermove', bewegen);
        document.addEventListener('pointerup', loslassen);
        document.addEventListener('pointercancel', loslassen);
    });

    /* Ohne Zeigegerät: Pfeiltasten auf dem Griff. Eine Reihenfolge, die man
       nur ziehen kann, ist mit Tastatur oder Vorlesehilfe unerreichbar. */
    griff.addEventListener('keydown', async (ereignis) => {
        const hoch = ereignis.key === 'ArrowUp';
        const runter = ereignis.key === 'ArrowDown';
        if (!hoch && !runter) return;
        ereignis.preventDefault();

        const nachbar = hoch ? zeile.previousElementSibling : zeile.nextElementSibling;
        if (!nachbar) return;
        liste.insertBefore(hoch ? zeile : nachbar, hoch ? nachbar : zeile);
        await reihenfolgeSichern(liste, { still: true });
        /* Nach dem Neuzeichnen ist der Griff ein anderes Element – den
           gleichnamigen wiederfinden, sonst springt der Fokus an den Anfang. */
        document.querySelector(`.ziehzeile[data-kategorie-id="${zeile.dataset.kategorieId}"] .zieh-griff`)?.focus();
    });
}

async function reihenfolgeSichern(liste, { still = false } = {}) {
    const ids = [...liste.querySelectorAll('.ziehzeile')].map((z) => z.dataset.kategorieId);
    const vorher = zustand.kategorien.map((k) => k.id).join(',');
    if (ids.join(',') === vorher) return;
    await kategorienNeuOrdnen(ids);
    if (!still) melde(t('kategorien.gespeichert'));
}

/* ────────────────────────────────────────────────────────────────────────
   Teilen
   ──────────────────────────────────────────────────────────────────────── */

function teilenKarte() {
    const abschnitt = karte(t('teilen.titel'));
    abschnitt.append(absatz(t('teilen.erklaerung'), 'muted small'));
    abschnitt.append(knopfleiste(
        knopf(t('qr.knopf'), zeigeQrCode, { betont: true }),
        knopf(t('teilen.alsDatei'), teileAlsDatei),
        knopf(t('teilen.alsText'), kopiereListeAlsText),
        knopf(t('teilen.stammartikel'), kopiereStammartikel),
        knopf(t('qr.linkEinfuegen'), linkEinlesen),
        knopf(t('teilen.importieren'), dateiEinlesen)
    ));
    abschnitt.append(absatz(t('sicherung.hinweis'), 'muted small'));
    abschnitt.append(knopfleiste(knopf(t('sicherung.exportieren'), vollsicherungExportieren), knopf(t('sicherung.wiederherstellen'), vollsicherungEinlesen)));
    abschnitt.append(absatz(t('teilen.langDrueckenHinweis'), 'muted small'));
    return abschnitt;
}

/**
 * Postleitzahl und Ort.
 *
 * Das einzige Feld in Foxi, das über das Gerät hinausweist – und selbst das
 * nur, weil ein Mensch den kopierten Text weitergibt. Deshalb steht die
 * Erklärung daneben und sagt ausdrücklich, was NICHT passiert: Foxi fragt
 * damit nichts ab und schickt nichts weg.
 *
 * Gesichert wird beim Verlassen des Feldes, nicht bei jedem Tastendruck.
 * Sonst schriebe jede Ziffer in die Datenbank, und die Karte zeichnete sich
 * beim Tippen unter dem Finger neu.
 */
function ortKarte() {
    const abschnitt = karte(t('ort.titel'), { experte: true });
    abschnitt.append(absatz(t('ort.erklaerung'), 'muted small'));

    const feld = document.createElement('input');
    feld.type = 'text';
    feld.className = 'ort-feld';
    feld.value = ort();
    feld.placeholder = t('ort.platzhalter');
    feld.setAttribute('aria-label', t('ort.beschriftung'));
    feld.enterKeyHint = 'done';
    feld.autocomplete = 'postal-code';

    const sichern = async () => {
        const neu = feld.value.trim();
        if (neu === ort()) return;
        await ortSetzen(neu);
        melde(t(neu ? 'ort.gemerkt' : 'ort.geloescht'));
    };
    feld.addEventListener('change', sichern);
    feld.addEventListener('keydown', (ereignis) => {
        if (ereignis.key !== 'Enter') return;
        ereignis.preventDefault();
        feld.blur();
    });

    abschnitt.append(feld);
    return abschnitt;
}

/* ────────────────────────────────────────────────────────────────────────
   Wochenangebote mit KI
   ──────────────────────────────────────────────────────────────────────── */

function angebotsradarKarte() {
    const abschnitt = karte(t('angebote.titel'));
    abschnitt.classList.add('angebote-karte');
    abschnitt.append(absatz(t('angebote.erklaerung'), 'muted small'));
    abschnitt.append(maerkteBereich());

    if (!angebotseinfuehrungErledigt()) {
        abschnitt.append(absatz(t('angebote.einfuehrung'), 'angebote-einfuehrung'));
        abschnitt.append(absatz(t('angebote.datenschutz'), 'angebote-datenschutz'));
        abschnitt.append(knopfleiste(
            knopf(t('angebote.gefuehrtEinrichten'), zeigeAngebotsEinfuehrung, { betont: true })
        ));
        return abschnitt;
    }

    const daten = angebotsergebnis();
    const status = angebotStatus(daten, new Date(), maerkte());
    if (status.vorhanden && status.angebote > 0) {
        abschnitt.append(absatz(
            t('angebote.statusAktuell', status.angebote, status.artikel, zeitpunktKurz(status.erzeugt), datumDeutsch(status.gueltigBis)),
            'angebote-status'
        ));
    } else {
        abschnitt.append(absatz(
            status.vorhanden ? t('angebote.keineAktuellen') : t('angebote.nochKeinErgebnis'),
            'angebote-status angebote-status-leer'
        ));
    }
    if (status.nichtGelesen.length) abschnitt.append(nichtGelesenBereich(status.nichtGelesen));

    /* Am Handy führt der Hauptknopf über das Teilen-Menü direkt in die
       KI-App; Kopieren bleibt daneben. Ohne Teilen-Menü (meist am
       Computer) bleibt es beim Kopieren. */
    const auftragsknoepfe = kannAnAppSenden()
        ? [
            knopf(t('angebote.anAppSenden'), rechercheAuftragSenden, { betont: true }),
            knopf(t('angebote.auftragKopieren'), rechercheAuftragKopieren)
        ]
        : [knopf(t('angebote.erneutPruefen'), rechercheAuftragKopieren, { betont: true })];
    abschnitt.append(knopfleiste(
        ...auftragsknoepfe,
        knopf(t('angebote.ergebnisEinfuegen'), ergebnisEinfuegen),
        knopf(t('angebote.ergebnisdatei'), ergebnisdateiEinlesen),
        knopf(t('angebote.soGehts'), zeigeAngebotsEinfuehrung)
    ));

    const angebote = gruppiereAngebote(aktuelleAngebote());
    if (angebote.length === 0) {
        return abschnitt;
    }

    const einzelheiten = document.createElement('details');
    einzelheiten.className = 'angebote-details';
    const zusammenfassung = document.createElement('summary');
    zusammenfassung.textContent = t('angebote.angeboteAnzeigen', angebote.length);

    const liste = document.createElement('ul');
    liste.className = 'angebotsliste';
    for (const angebot of angebote) liste.append(angebotszeile(angebot));
    einzelheiten.append(zusammenfassung, liste);
    abschnitt.append(einzelheiten);
    return abschnitt;
}

/** Welche Filialen der Assistent nicht lesen konnte – mit Grund. Zugeklappt,
 *  damit die Karte im Alltag kurz bleibt; die Überschrift sagt die Zahl. */
function nichtGelesenBereich(eintraege) {
    const details = document.createElement('details');
    details.className = 'angebote-nichtgelesen';
    const summary = document.createElement('summary');
    summary.textContent = t('angebote.nichtGelesen', eintraege.length);
    const liste = document.createElement('ul');
    for (const eintrag of eintraege) {
        const zeile = document.createElement('li');
        zeile.textContent = `${filialName(eintrag.haendler, eintrag.markt || '')}: ${eintrag.grund}`;
        liste.append(zeile);
    }
    details.append(summary, liste);
    return details;
}

function maerkteBereich() {
    const details = document.createElement('details');
    details.className = 'meine-maerkte';
    details.open = maerkteOffen;
    details.addEventListener('toggle', () => { maerkteOffen = details.open; });
    const summary = document.createElement('summary');
    summary.textContent = t('angebote.meineMaerkte', maerkte().length);
    details.append(summary);

    const hinweis = absatz(t('angebote.maerkteHinweis'), 'muted small');
    details.append(hinweis);
    if (maerkte().length) {
        const liste = document.createElement('ul');
        liste.className = 'maerkte-liste';
        for (const markt of maerkte()) {
            const zeile = document.createElement('li');
            const haken = document.createElement('input');
            haken.type = 'checkbox'; haken.checked = markt.aktiv !== false;
            haken.setAttribute('aria-label', `${markt.haendler} ${markt.markt} verwenden`);
            haken.addEventListener('change', () => marktAktivSetzen(markt.id, haken.checked));
            const text = document.createElement('span');
            text.textContent = `${markt.haendler} · ${markt.markt}`;
            const entfernen = knopf('Entfernen', () => marktLoeschen(markt.id));
            entfernen.className = 'link-knopf';
            zeile.append(haken, text, entfernen);
            liste.append(zeile);
        }
        details.append(liste);
    }
    details.append(knopf(t('angebote.marktHinzufuegen'), marktDialog));
    return details;
}

function marktDialog() {
    const haendler = document.createElement('select');
    haendler.setAttribute('aria-label', t('angebote.haendler'));
    for (const name of [...HAENDLER.map(h => h.name), t('angebote.sonstigerLaden')]) {
        const option = document.createElement('option'); option.value = name; option.textContent = name; haendler.append(option);
    }
    const filiale = dialogFeld({ platzhalter: t('angebote.marktPlatzhalter'), beschriftung: t('angebote.marktBeschriftung') });
    const quelle = dialogFeld({ platzhalter: t('angebote.eigeneQuelle'), beschriftung: t('angebote.eigeneQuelle') });
    quelle.type = 'url';
    const auswahl = () => {
        const sonstig = !HAENDLER.some(h => h.name === haendler.value);
        filiale.placeholder = t(sonstig ? 'angebote.nameUndAdresse' : 'angebote.marktPlatzhalter');
        filiale.setAttribute('aria-label', t(sonstig ? 'angebote.nameUndAdresse' : 'angebote.marktBeschriftung'));
        quelle.value = HAENDLER.find(h => h.name === haendler.value)?.url || '';
    };
    haendler.addEventListener('change', auswahl);
    auswahl();
    const sichern = async () => {
        if (quelle.value.trim() && !sichereAngebotsseite(quelle.value.trim())) { melde(t('angebote.quelleFehler')); return false; }
        const gespeichert = await marktSpeichern({ haendler: haendler.value, markt: filiale.value, angebotsseite: quelle.value.trim() });
        if (!gespeichert) { melde(t('angebote.marktFehlt')); return false; }
        schliesseDialog();
        melde(t('angebote.marktGespeichert'));
    };
    zeigeDialog({
        titel: t('angebote.marktHinzufuegen'),
        fokus: true,
        koerper: [haendler, filiale, quelle, absatz(t('angebote.quellenHinweis'), 'muted small'), absatz(t('angebote.marktLokal'), 'muted small')],
        knoepfe: [{ text: t('menge.fertig'), betont: true, offenLassen: true, wirkung: sichern }]
    });
}

function zeitpunktKurz(datum) {
    if (!(datum instanceof Date) || Number.isNaN(datum.getTime())) return '–';
    const zeit = datum.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    return `${datumDeutsch(datum)}, ${zeit} Uhr`;
}

function angebotszeile(angebot) {
    const zeile = document.createElement('li');

    const kopf = document.createElement('div');
    kopf.className = 'angebot-kopf';
    const name = document.createElement('strong');
    name.textContent = angebot.artikelName;
    const preis = document.createElement('strong');
    preis.className = 'angebot-preis';
    preis.textContent = preisDeutsch(angebot.preis);
    kopf.append(name, preis);

    const produkt = document.createElement('span');
    produkt.className = 'angebot-produkt';
    produkt.textContent = angebot.produkt;

    const markt = document.createElement('span');
    markt.className = 'angebot-markt';
    /* Die Filialen stehen beim Namen in der Zeile, nicht erst hinter einem
       Aufklapper. Die vollständigen Adressen folgen darunter. */
    markt.textContent = angebot.maerkte.length > 1
        ? `${angebot.haendler} · ${angebot.maerkte.map(kurzeFiliale).join(', ')}`
        : `${angebot.haendler} · ${angebot.maerkte[0]}`;

    const details = document.createElement('span');
    details.className = 'angebot-details';
    const datum = datumDeutsch(new Date(`${angebot.gueltigBis}T12:00:00`));
    details.textContent = `${angebot.menge} · ${angebot.grundpreis} · ${t('angebote.gueltigBis', datum)}`;

    zeile.append(kopf, produkt, markt, details);

    if (angebot.treffer === 'alternative') {
        const marke = document.createElement('span');
        marke.className = 'angebot-alternative';
        marke.textContent = t('angebote.trefferAlternative');
        zeile.append(marke);
    }
    if (angebot.niedrigsterGefundenerGrundpreis) {
        const marke = document.createElement('span');
        marke.className = 'angebot-niedrigster';
        marke.textContent = t('angebote.niedrigsterGrundpreis');
        zeile.append(marke);
    }
    if (angebot.hinweis) {
        const hinweis = document.createElement('span');
        hinweis.className = 'angebot-hinweis';
        hinweis.textContent = angebot.hinweis;
        zeile.append(hinweis);
    }

    if (angebot.maerkte.length > 1) {
        const filialen = document.createElement('details');
        filialen.className = 'angebot-filialen';
        const titel = document.createElement('summary');
        titel.textContent = t('angebote.filialenAnzeigen');
        const liste = document.createElement('ul');
        for (const marktname of angebot.maerkte) {
            const eintrag = document.createElement('li');
            eintrag.textContent = marktname;
            liste.append(eintrag);
        }
        filialen.append(titel, liste);
        zeile.append(filialen);
    }

    const quelle = document.createElement('a');
    quelle.href = angebot.quellen[0];
    quelle.target = '_blank';
    quelle.rel = 'noopener noreferrer';
    quelle.textContent = t('angebote.quelle');
    zeile.append(quelle);
    return zeile;
}

/* ────────────────────────────────────────────────────────────────────────
   Statistik
   ──────────────────────────────────────────────────────────────────────── */

function statistikKarte() {
    const abschnitt = karte(t('statistik.titel'), { experte: true });
    abschnitt.append(absatz(t('statistik.erklaerung'), 'muted small'));

    const zeilen = kaufStatistik(alleArtikel(), 15);
    if (zeilen.length === 0) {
        abschnitt.append(absatz(t('statistik.leer'), 'muted'));
        return abschnitt;
    }

    const hoechste = zeilen[0].anzahl;
    const liste = document.createElement('ul');
    liste.className = 'statistikliste';

    for (const eintrag of zeilen) {
        const zeile = document.createElement('li');

        const icon = document.createElement('span');
        icon.className = 'stat-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = eintrag.artikel.icon || '🛒';

        const name = document.createElement('span');
        name.className = 'stat-name';
        name.textContent = eintrag.artikel.name;

        /* Der Balken ist die Zahl, nur schneller zu lesen. Er trägt deshalb
           kein eigenes `aria`-Etikett – die Zahl steht daneben.

           Die Länge kommt aus einer Klasse in Zehnerschritten, nicht aus
           einem `style`-Attribut: Die Content-Security-Policy der
           Auslieferung erlaubt kein Inline-CSS, und dieser Balken ist kein
           Grund, sie aufzuweichen. Zehn Stufen reichen für einen Balken,
           neben dem die genaue Zahl steht. */
        const balken = document.createElement('span');
        balken.className = 'stat-balken';
        balken.setAttribute('aria-hidden', 'true');
        const stufe = Math.max(1, Math.round((eintrag.anzahl / hoechste) * 10));
        const fuellung = document.createElement('span');
        fuellung.className = `stat-fuellung fuell-${stufe}`;
        balken.append(fuellung);

        const zahl = document.createElement('span');
        zahl.className = 'stat-zahl';
        zahl.textContent = t('statistik.malGekauft', eintrag.anzahl);
        zahl.title = t('statistik.seit', datumDeutsch(new Date(eintrag.zuletzt)));

        zeile.append(icon, name, balken, zahl);
        liste.append(zeile);
    }

    abschnitt.append(liste);
    return abschnitt;
}

/* ────────────────────────────────────────────────────────────────────────
   Daten
   ──────────────────────────────────────────────────────────────────────── */

function datenKarte() {
    const abschnitt = karte(t('mehr.datenTitel'));
    abschnitt.append(knopfleiste(
        knopf(t('mehr.listeLeeren'), async () => {
            if (!confirm(t('mehr.listeLeerenFrage'))) return;
            await listeLeeren();
            melde(t('mehr.listeGeleert'));
        }),
        /* Der harte Knopf steht bewusst auch im Basismodus: Er ist der Weg
           zurück, wenn jemand die App weitergibt – und der Beweis dafür,
           dass alles auf diesem Gerät liegt. */
        knopf(t('mehr.allesZuruecksetzen'), async () => {
            if (!confirm(t('mehr.allesZuruecksetzenFrage'))) return;
            schliesseDialog();
            await allesZuruecksetzen();
            location.reload();
        }, { gefahr: true })
    ));
    return abschnitt;
}

function fusszeile() {
    const fuss = document.createElement('p');
    fuss.className = 'fusszeile';
    fuss.append(
        document.createTextNode(`${t('app.name')} · ${t('mehr.version', VERSION)}`),
        document.createElement('br'),
        document.createTextNode(t('mehr.lizenz'))
    );
    return fuss;
}
