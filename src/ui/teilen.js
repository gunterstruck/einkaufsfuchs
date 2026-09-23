/**
 * Teilen, Export, Import – und die KI-Brücke.
 *
 * Kein Sync-Server, kein Konto. Die Liste wird zu einer Datei oder zu
 * Klartext, und der Mensch entscheidet, wohin. `navigator.share` mit
 * `files` legt sie in den System-Teilen-Dialog; dort steht WhatsApp direkt
 * neben Mail und AirDrop.
 *
 * Jeder Weg hat eine Ersatzkette, weil keiner überall vorhanden ist:
 *   Datei  → share(files) → Download → Text in die Zwischenablage
 *   Text   → Zwischenablage → share(text) → Auswahl im Dialog
 * Nichts davon verlässt das Gerät, solange der Mensch es nicht schickt.
 */

import { sicherungLesen, sicherungErsetzen } from '../db.js';
import { pruefeSicherung } from '../sicherung.js';
import { t } from '../texte.js';
import {
    alsAustauschdatei, alsKlartext, alsStammartikelText, kaufStatistik,
    gruppiereListe, pruefeAustauschdatei, vergleicheImport, datumFuerDateiname,
    AUSTAUSCHDATEI_GRENZEN, DATEI_TYP, DATEI_VERSION
} from '../logik.js';
import {
    alsQrNutzlast, qrAdresse, eigenerUrsprung, qrAnteilAusAdresse,
    pruefeQrListe, alsImportartikel, QR_SCHLUESSEL, QR_SCHLUESSEL_GEPACKT
} from '../qrliste.js';
import { qrErzeugen, qrZeichnen } from '../qrcode.js';
import { neueTeilmarke, listenstandMerken, vonListeNehmen } from '../zustand.js';
import { vergleicheListenstand } from '../logik.js';
import { zustand, offeneEintraege, importAnwenden, alleArtikel, ort } from '../zustand.js';
import { melde } from './schale.js';
import { zeigeDialog, dialogZeile, dialogFeld } from './dialog.js';

/* ────────────────────────────────────────────────────────────────────────
   Hinaus
   ──────────────────────────────────────────────────────────────────────── */

function kategorienNachId() {
    return new Map(zustand.kategorien.map((k) => [k.id, k]));
}

export function listeAlsText() {
    const gruppen = gruppiereListe(offeneEintraege(), zustand.artikel, zustand.kategorien);
    return alsKlartext(gruppen, new Date(), ort());
}

export async function teileAlsDatei() {
    const eintraege = offeneEintraege();
    if (eintraege.length === 0 && !zustand.einstellungen.teilmarke) { melde(t('teilen.leerNichtsZuTeilen')); return; }

    const daten = alsAustauschdatei(eintraege, zustand.artikel, kategorienNachId());
    daten.teilmarke = await neueTeilmarke();
    const text = JSON.stringify(daten, null, 2);
    const dateiname = t('teilen.dateiName', datumFuerDateiname());
    const datei = new File([text], dateiname, { type: 'application/json' });

    /* `canShare` mit der konkreten Datei fragen, nicht nur `share` auf
       Vorhandensein prüfen: Manche Browser haben die Funktion, nehmen aber
       keine Dateien an – der Aufruf schlüge dann erst zur Laufzeit fehl. */
    if (navigator.canShare?.({ files: [datei] })) {
        try {
            await navigator.share({ files: [datei], title: t('app.name') });
            melde(t('teilen.geteilt'));
            return;
        } catch (fehler) {
            /* Abbruch durch den Menschen ist kein Fehler und braucht keine
               Ersatzkette – er wollte gerade nicht teilen. */
            if (fehler?.name === 'AbortError') { melde(t('teilen.abgebrochen')); return; }
        }
    }

    if (herunterladen(text, dateiname)) return;
    await kopiereText(text, t('teilen.kopiert'));
}

function herunterladen(text, dateiname) {
    try {
        const adresse = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
        const verweis = document.createElement('a');
        verweis.href = adresse;
        verweis.download = dateiname;
        document.body.append(verweis);
        verweis.click();
        verweis.remove();
        setTimeout(() => URL.revokeObjectURL(adresse), 10000);
        melde(t('teilen.geteilt'));
        return true;
    } catch {
        return false;
    }
}

/**
 * Der Briefing-Export: die Liste als Klartext.
 *
 * Bewusst **ohne angehängte Frage**. Wer den Text irgendwo einfügt, schreibt
 * selbst dazu, was er wissen will – „was koche ich daraus", „was fehlt noch",
 * „erklär mir Sardellenpaste". Eine mitgelieferte Frage würde mit den
 * Fähigkeiten der Modelle altern; ein reiner Textblock wächst mit ihnen.
 */
export async function kopiereListeAlsText() {
    const eintraege = offeneEintraege();
    if (eintraege.length === 0) { melde(t('teilen.leerNichtsZuTeilen')); return; }
    await kopiereText(listeAlsText(), t('teilen.kopiert'));
}

/**
 * Die Stammartikel als Klartext.
 *
 * Der Gegenpol zum Listen-Export: nicht was heute fehlt, sondern was dieser
 * Haushalt immer braucht. Damit lässt sich draußen die Frage stellen, die
 * Foxi selbst nie beantworten wird – „ist etwas davon gerade im Angebot" –,
 * ohne dass die App je eine Verbindung aufbaut.
 *
 * Zwanzig Einträge: genug, dass die Antwort etwas taugt, kurz genug, dass
 * der Text noch in eine Nachricht passt.
 */
export async function kopiereStammartikel() {
    const zeilen = kaufStatistik(alleArtikel(), 20);
    if (zeilen.length === 0) { melde(t('teilen.stammartikelLeer')); return; }
    await kopiereText(
        alsStammartikelText(zeilen, new Date(), ort()),
        t('teilen.stammartikelKopiert', zeilen.length)
    );
}

/** Langes Drücken auf eine Kachel: nur dieser eine Artikelname. */
export async function kopiereArtikel(artikel) {
    await kopiereText(artikel.name, t('teilen.kopiertArtikel', artikel.name));
}

/**
 * Der alte Kopierweg: markierter Text in einem unsichtbaren Feld, dann
 * `execCommand('copy')`. Veraltet, aber er läuft **synchron** – also noch
 * sicher innerhalb des Fingertipps, den Safari für die Zwischenablage
 * verlangt – und hängt nicht an der Berechtigung, an der
 * `navigator.clipboard` scheitern kann.
 *
 * Anlass: Auf einem Handy kam der Rechercheauftrag nicht in der
 * Zwischenablage an. Nachstellen ließ sich das hier nicht; deshalb gibt es
 * zwei unabhängige Wege statt einem, und erst wenn beide scheitern, zeigt
 * Foxi den Text zum Kopieren von Hand.
 */
function kopiereSynchron(text) {
    const feld = document.createElement('textarea');
    feld.className = 'kopierfeld';
    feld.value = text;
    /* `readonly` hält die Bildschirmtastatur fern; markieren lässt sich
       der Inhalt trotzdem. */
    feld.setAttribute('readonly', '');
    feld.setAttribute('aria-hidden', 'true');
    feld.tabIndex = -1;
    document.body.append(feld);
    const vorher = document.activeElement;
    let kopiert = false;
    try {
        feld.focus({ preventScroll: true });
        feld.select();
        feld.setSelectionRange(0, text.length);
        kopiert = document.execCommand('copy');
    } catch {
        kopiert = false;
    }
    feld.remove();
    if (vorher instanceof HTMLElement && vorher !== document.body) vorher.focus({ preventScroll: true });
    return kopiert;
}

/** Dieselbe ehrliche Ersatzkette auch für andere klar ausgelöste Exporte. */
export async function kopiereText(text, erfolgsmeldung, dialogTitel = t('teilen.alsText')) {
    /* Zuerst der synchrone Weg, solange der Fingertipp noch „frisch" ist,
       dann zusätzlich die moderne Schnittstelle. Einer von beiden genügt. */
    const synchron = kopiereSynchron(text);
    try {
        await navigator.clipboard.writeText(text);
        melde(erfolgsmeldung);
        return;
    } catch {
        if (synchron) { melde(erfolgsmeldung); return; }
        /* Beide Wege verweigert (kein sicherer Kontext, keine Berechtigung,
           Safari ohne Nutzergeste): Dann zeigen wir den Text und lassen ihn
           von Hand nehmen, statt zu behaupten, es sei kopiert. */
    }

    if (navigator.share) {
        try { await navigator.share({ text }); melde(t('teilen.geteilt')); return; }
        catch (fehler) { if (fehler?.name === 'AbortError') { melde(t('teilen.abgebrochen')); return; } }
    }

    const feld = document.createElement('textarea');
    feld.className = 'dialog-text';
    feld.readOnly = true;
    feld.rows = 10;
    feld.value = text;
    zeigeDialog({
        titel: dialogTitel,
        koerper: [feld],
        knoepfe: []
    });
    setTimeout(() => { feld.focus(); feld.select(); }, 0);
}

/* ────────────────────────────────────────────────────────────────────────
   Der QR-Code

   Der einzige Weg in Foxi, der ohne Datei und ohne Zwischenablage von einem
   Gerät zum anderen führt: Bildschirm zeigt, Kamera liest. Was dabei
   übertragen wird und warum keine Fotos mitfahren, steht in `qrliste.js`.
   ──────────────────────────────────────────────────────────────────────── */

/**
 * Die Adresse, die gerade im QR-Code stünde. Getrennt von der Anzeige, weil
 * die Prüfstrecke damit den ganzen Weg nachfahren kann: erzeugen, die
 * Adresse auf einem zweiten Gerät öffnen, Liste vergleichen.
 */
export async function aktuelleQrAdresse() {
    const eintraege = offeneEintraege();
    if (eintraege.length === 0 && !zustand.einstellungen.teilmarke) return '';
    const daten = alsQrNutzlast(eintraege, zustand.artikel);
    daten.x = await neueTeilmarke();
    return qrAdresse(daten, eigenerUrsprung());
}

export async function zeigeQrCode() {
    const eintraege = offeneEintraege();
    if (eintraege.length === 0 && !zustand.einstellungen.teilmarke) { melde(t('teilen.leerNichtsZuTeilen')); return; }

    let code;
    const adresse = await aktuelleQrAdresse();
    try {
        /* Stufe L: Bildschirm → Kamera ist ein sauberer Kanal ohne Knicke und
           Kaffeeflecken. Höhere Fehlerkorrektur kostete hier nur Kapazität
           und damit ein dichteres Bild. */
        code = qrErzeugen(adresse, { stufe: 'L' });
    } catch {
        melde(t('qr.zuLang'));
        return;
    }

    const bild = document.createElement('canvas');
    bild.className = 'qr-bild';
    qrZeichnen(bild, code, 360);
    bild.setAttribute('role', 'img');
    bild.setAttribute('aria-label', t('qr.bildBeschriftung', eintraege.length));

    const rahmen = document.createElement('div');
    rahmen.className = 'qr-rahmen';
    rahmen.append(bild);

    zeigeDialog({
        titel: t('qr.titel'),
        koerper: [
            rahmen,
            dialogZeile(t('qr.artikelZahl', eintraege.length), 'qr-zahl'),
            dialogZeile(t('qr.erklaerung'), 'muted small'),
            dialogZeile(t('qr.linkGegenseite'), 'muted small'),
            dialogZeile(t('qr.ohneFotos'), 'muted small')
        ],
        knoepfe: [{ text: t('qr.linkSenden'), betont: true, wirkung: teileQrLink }]
    });
}

/**
 * Derselbe Inhalt, anderer Weg: der Link in eine Nachricht.
 *
 * Für den Fall, für den der QR-Code nichts taugt – der eine ist zu Hause,
 * der andere im Laden. Bildschirm-an-Kamera setzt denselben Raum voraus;
 * genau dann braucht man es am wenigsten.
 *
 * Die Liste steht **im** Link. Das ist dieselbe Kategorie wie die Datei, die
 * Foxi schon heute per Messenger teilt: Ein Mensch entscheidet und schickt.
 * Was der Messenger für die Vorschau holt, ist nur die App-Adresse – den
 * Teil hinter der Raute bekommt kein Server zu sehen.
 */
export async function teileQrLink() {
    const adresse = await aktuelleQrAdresse();
    if (!adresse) { melde(t('teilen.leerNichtsZuTeilen')); return; }

    if (navigator.share) {
        try {
            /* `url` statt `text`: Messenger und die iOS-Teilen-Auswahl
               behandeln einen Link dann als Link. */
            await navigator.share({ title: t('app.name'), url: adresse });
            melde(t('teilen.geteilt'));
            return;
        } catch (fehler) {
            if (fehler?.name === 'AbortError') { melde(t('teilen.abgebrochen')); return; }
        }
    }
    await kopiereText(adresse, t('qr.linkKopiert'), t('qr.titel'));
}

/**
 * Die Gegenrichtung – und der Grund, warum es sie geben muss.
 *
 * Ein angetippter Link in einer Nachricht öffnet den eingebauten Browser des
 * Messengers. Der hat seinen eigenen Speicher: Dort übernommen, wäre die
 * Liste in der richtigen Foxi nie angekommen. Deshalb der Weg von Hand –
 * Link kopieren, eigene Foxi öffnen, hier einfügen.
 *
 * Erst wird die Zwischenablage gefragt; geht das nicht (Safari ohne Geste,
 * Firefox, verweigerte Berechtigung), fragt Foxi den Menschen.
 */
export async function linkEinlesen() {
    try {
        const ablage = await navigator.clipboard.readText();
        if (await linkUebernehmen(ablage)) return;
    } catch {
        /* Keine Zwischenablage: dann eben das Feld. */
    }

    const feld = dialogFeld({
        platzhalter: t('qr.linkPlatzhalter'),
        beschriftung: t('qr.linkTitel'),
        bestaetigen: (wert) => linkUebernehmen(wert, true)
    });
    zeigeDialog({
        titel: t('qr.linkTitel'),
        fokus: true,
        koerper: [feld, dialogZeile(t('qr.linkHinweis'), 'muted small')],
        knoepfe: [{
            text: t('qr.linkUebernehmen'),
            betont: true,
            wirkung: () => linkUebernehmen(feld.value, true)
        }]
    });
}

/**
 * Aus einem eingefügten Text eine Liste machen.
 *
 * Der Ursprung im Link ist absichtlich egal: Ein Link von einer anderen
 * Adresse derselben App – nach einem Umzug, aus einer älteren Nachricht –
 * trägt dieselben Daten hinter der Raute. Geprüft wird der Inhalt, nicht die
 * Herkunft; übernommen wird auch hier erst nach dem Dialog.
 */
async function linkUebernehmen(text, meldenWennNichts = false) {
    const roh = String(text || '');
    const raute = roh.indexOf('#');
    const anteil = raute < 0 ? null : qrAnteilAusAdresse(roh.slice(raute));
    if (!anteil) {
        if (meldenWennNichts) melde(t('qr.linkKeineListe'));
        return false;
    }
    return anteilUebernehmen(anteil);
}

/**
 * Eine Liste aus der Adresse übernehmen – der Empfangsweg.
 *
 * Aufgerufen beim Start und bei jeder Änderung des Adressankers, denn ein
 * zweiter Scan ändert nur den Anker und lädt die Seite nicht neu.
 *
 * Der Anker wird danach **immer** entfernt, auch wenn nichts übernommen
 * wurde: Sonst führte jedes Neuladen denselben Import noch einmal vor, und
 * die Liste eines anderen Haushalts bliebe in der Adresszeile stehen.
 */
export async function qrAusAdresseUebernehmen(ort = window.location) {
    const anteil = qrAnteilAusAdresse(ort?.hash);
    if (!anteil) return false;
    ankerEntfernen(ort);
    return anteilUebernehmen(anteil);
}

/** Der gemeinsame Rest beider Empfangswege: prüfen, dann fragen. */
async function anteilUebernehmen(anteil) {
    const pruefung = await pruefeQrListe(anteil);
    if (!pruefung.gueltig) {
        const hinweis = { mehrteilig: 'qr.mehrteilig', zuAlt: 'qr.zuAlt' }[pruefung.grund] || 'qr.ungueltig';
        melde(t(hinweis));
        return false;
    }
    /* Von hier an derselbe Weg wie beim Datei-Import: dieselbe Prüfung,
       derselbe Dialog, dieselbe Übernahme. QR-Code und Link sind andere
       Transportwege, keine zweite Wahrheit. */
    zeigeZusammenfuehrung({
        typ: DATEI_TYP,
        version: DATEI_VERSION,
        artikel: alsImportartikel(pruefung.daten),
        ...(pruefung.daten.x ? { teilmarke: pruefung.daten.x } : {})
    });
    return true;
}

function ankerEntfernen(ort) {
    const eigene = [QR_SCHLUESSEL, QR_SCHLUESSEL_GEPACKT];
    const rest = String(ort.hash || '').replace(/^#/, '')
        .split('&')
        .filter((stueck) => !eigene.includes(stueck.slice(0, stueck.indexOf('='))))
        .join('&');
    const neu = `${ort.pathname}${ort.search}${rest ? `#${rest}` : ''}`;
    window.history?.replaceState?.(null, '', neu);
}

/* ────────────────────────────────────────────────────────────────────────
   Herein
   ──────────────────────────────────────────────────────────────────────── */

/** Dateiauswahl öffnen. Das Feld lebt nur für diesen einen Griff. */
export function dateiEinlesen() {
    const feld = document.createElement('input');
    feld.type = 'file';
    /* Beides angeben: Manche Dateiverwaltungen filtern über die Endung,
       manche über den Typ – und manche Messenger legen eine geteilte Datei
       ohne Typangabe ab. */
    feld.accept = 'application/json,.json';
    feld.hidden = true;
    document.body.append(feld);

    feld.addEventListener('change', async () => {
        const datei = feld.files?.[0];
        feld.remove();
        if (!datei) return;
        /* Vor `text()` und `JSON.parse()` begrenzen: Die inhaltliche Prüfung
           kommt erst danach und kann einen unnötig großen Speicherverbrauch
           beim Einlesen nicht mehr verhindern. */
        if (datei.size > AUSTAUSCHDATEI_GRENZEN.bytes) {
            melde(t('teilen.kaputteDatei'));
            return;
        }
        try {
            zeigeZusammenfuehrung(JSON.parse(await datei.text()));
        } catch {
            melde(t('teilen.kaputteDatei'));
        }
    });

    feld.click();
}

/**
 * Der Zusammenführungs-Dialog.
 *
 * Er zeigt vor dem Übernehmen, was passieren würde: was neu ist, was schon
 * da ist, was eine andere Menge bekäme. Ohne diese drei Zeilen wäre jeder
 * Import ein Sprung ins Dunkle – und beim zweiten Mal würde ihn niemand
 * mehr wagen.
 */
export function zeigeZusammenfuehrung(daten) {
    const pruefung = pruefeAustauschdatei(daten);
    if (!pruefung.gueltig) {
        melde(t(pruefung.grund === 'fremd' ? 'teilen.keineFoxiDatei' : 'teilen.kaputteDatei'));
        return;
    }

    if (daten.teilmarke) { zeigeStandvergleich(daten); return; }
    const { neu, doppelt, abweichend } = vergleicheImport(daten.artikel, zustand.liste);
    const unbekannt = daten.artikel.filter((a) => !zustand.artikel.has(a.id));

    if (neu.length === 0 && abweichend.length === 0) {
        melde(t('zusammenfuehren.nichtsNeues'));
        return;
    }

    const koerper = [];
    if (neu.length) koerper.push(dialogZeile(`✅ ${t('zusammenfuehren.neu', neu.length)}`));
    if (doppelt.length) koerper.push(dialogZeile(`↔️ ${t('zusammenfuehren.doppelt', doppelt.length)}`, 'muted'));
    if (abweichend.length) koerper.push(dialogZeile(`✏️ ${t('zusammenfuehren.ueberschrieben', abweichend.length)}`, 'muted'));
    if (unbekannt.length) koerper.push(dialogZeile(`＋ ${t('zusammenfuehren.unbekannteArtikel', unbekannt.length)}`, 'muted'));

    const knoepfe = [{
        text: t('zusammenfuehren.nurNeue'),
        betont: abweichend.length === 0,
        wirkung: () => uebernehmen(daten.artikel, 'nurNeue')
    }];
    /* Der zweite Knopf erscheint nur, wenn es überhaupt etwas zu
       überschreiben gibt. Sonst wären es zwei Knöpfe mit derselben Wirkung. */
    if (abweichend.length) {
        knoepfe.push({
            text: t('zusammenfuehren.allesUebernehmen'),
            betont: true,
            wirkung: () => uebernehmen(daten.artikel, 'alles')
        });
    }

    zeigeDialog({ titel: t('zusammenfuehren.titel'), koerper, knoepfe });
}

async function uebernehmen(fremdeArtikel, modus) {
    const anzahl = await importAnwenden(fremdeArtikel, modus);
    melde(t('zusammenfuehren.uebernommen', anzahl));
}


function zeigeStandvergleich(daten) {
    const marke = daten.teilmarke;
    const bisher = zustand.einstellungen.empfangeneStaende?.[marke.serie];
    if (marke.serie === zustand.einstellungen.teilmarke?.serie) { melde(t('austausch.eigenerStand')); return; }
    if (bisher && marke.revision <= bisher.revision) { melde(t('austausch.alterStand')); return; }
    const aenderungen = structuredClone(vergleicheListenstand(daten.artikel, bisher?.artikel || [], zustand.liste));
    const koerper = [dialogZeile(t(bisher ? 'austausch.vergleich' : 'austausch.ersterStand'), 'muted')];
    const auswahl = [];
    const beschreibung = a => [a?.menge, a?.notiz].filter(Boolean).join(' · ') || '–';
    for (const a of aenderungen) {
        const label = document.createElement('label'); label.className = 'stand-aenderung';
        const haken = document.createElement('input'); haken.type = 'checkbox';
        haken.checked = !a.konflikt && a.art !== 'entfernt';
        const name = a.nachher?.name || a.vorher?.name || a.id;
        const titel = t('austausch.' + a.art, name);
        label.append(haken, document.createTextNode(titel));
        koerper.push(label);
        if (a.konflikt) koerper.push(dialogZeile(t('austausch.konflikt'), 'muted'));
        if (a.vorher) koerper.push(dialogZeile(t('austausch.vorher', beschreibung(a.vorher)), 'muted'));
        if (a.nachher) koerper.push(dialogZeile(t('austausch.nachher', beschreibung(a.nachher))));
        if (a.konflikt) koerper.push(dialogZeile(t('austausch.lokal', beschreibung(a.lokal), Boolean(a.lokal?.erledigt)), 'muted'));
        auswahl.push({ a, haken });
    }
    if (!aenderungen.length) koerper.push(dialogZeile(t('zusammenfuehren.nichtsNeues')));
    koerper.push(dialogZeile(t('austausch.regel'), 'muted small'));
    zeigeDialog({ titel: t('austausch.titel', aenderungen.length), koerper, knoepfe: [{
        text: t('austausch.uebernehmen'), betont: true, wirkung: async () => {
            const gewaehlt = auswahl.filter(e => e.haken.checked).map(e => e.a);
            // Auswahl gegen den aktuellen Zustand prüfen: zwischen Vorschau und Klick kann lokal etwas geändert worden sein.
            const aktuell = vergleicheListenstand(daten.artikel, bisher?.artikel || [], zustand.liste);
            if (JSON.stringify(aktuell) !== JSON.stringify(aenderungen)) { zeigeStandvergleich(daten); return; }
            await importAnwenden(gewaehlt.filter(a => a.nachher).map(a => a.nachher), 'alles');
            for (const a of gewaehlt.filter(a => !a.nachher)) await vonListeNehmen(a.id);
            await listenstandMerken(marke, daten.artikel);
            melde(t('austausch.erledigt', gewaehlt.length));
        }
    }] });
}


export async function vollsicherungExportieren() {
    try {
        const daten = await sicherungLesen();
        herunterladen(JSON.stringify(daten), 'einkaufsfuchs-sicherung-' + datumFuerDateiname() + '.json');
    } catch { melde(t('sicherung.fehler')); }
}

export function vollsicherungEinlesen() {
    const feld = document.createElement('input'); feld.type = 'file'; feld.accept = '.json,application/json';
    feld.addEventListener('change', async () => {
        const datei = feld.files?.[0]; if (!datei) return;
        try {
            if (datei.size > 50 * 1024 * 1024) throw new Error('size');
            const daten = JSON.parse(await datei.text());
            if (!pruefeSicherung(daten)) throw new Error('format');
            zeigeDialog({ titel: t('sicherung.wiederherstellen'),
                koerper: [dialogZeile(t('sicherung.ersetzt', daten.daten.artikel.length, daten.daten.liste.length))],
                knoepfe: [{ text: t('sicherung.bestaetigen'), wirkung: async () => {
                    try {
                        const kopie = structuredClone(daten.daten);
                        // Ein neues Gerät bekommt eine eigene Absenderkennung; keine kollidierenden Revisionen.
                        kopie.einstellungen = kopie.einstellungen.filter(e => e.schluessel !== 'teilmarke');
                        await sicherungErsetzen(kopie);
                        window.location.reload();
                    } catch { melde(t('sicherung.fehler')); }
                } }]
            });
        } catch { melde(t('sicherung.fehler')); }
    });
    feld.click();
}
