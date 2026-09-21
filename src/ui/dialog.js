/**
 * Ein Dialog, mehr nicht.
 *
 * Foxi braucht genau zwei: „Wie soll das Rezept heißen?" und „Was soll aus
 * der eingelesenen Datei übernommen werden?". Für zwei Fälle lohnt keine
 * Bibliothek – und `confirm()`/`prompt()` reichen nicht, weil der
 * Zusammenführungs-Dialog mehr zeigen muss als eine Zeile.
 *
 * Bewusst nicht `<dialog>`: Das Element ist auf iOS erst ab 15.4 da, und sein
 * eigener Hintergrund (`::backdrop`) lässt sich nicht überall gleich
 * gestalten. Eine feste Auflage mit eigenem Hintergrund verhält sich
 * überall gleich.
 */

import { t } from '../texte.js';

let offen = null;

/**
 * @param {object} inhalt
 * @param {string} inhalt.titel
 * @param {Node[]} inhalt.koerper   frei gestaltbarer Inhalt
 * @param {{text:string, wirkung:Function, betont?:boolean}[]} inhalt.knoepfe
 * @param {boolean} [inhalt.fokus]  ins erste Feld springen (siehe unten)
 */
export function zeigeDialog({ titel, koerper = [], knoepfe = [], fokus = false }) {
    schliesseDialog();

    const auflage = document.createElement('div');
    auflage.className = 'dialog-auflage';
    auflage.setAttribute('role', 'dialog');
    auflage.setAttribute('aria-modal', 'true');
    auflage.setAttribute('aria-label', titel);

    const karte = document.createElement('div');
    karte.className = 'dialog';

    const ueberschrift = document.createElement('h2');
    ueberschrift.className = 'dialog-titel';
    ueberschrift.textContent = titel;

    const rumpf = document.createElement('div');
    rumpf.className = 'dialog-koerper';
    rumpf.append(...koerper);

    const leiste = document.createElement('div');
    leiste.className = 'dialog-knoepfe';
    for (const angabe of knoepfe) {
        const knopf = document.createElement('button');
        knopf.type = 'button';
        knopf.textContent = angabe.text;
        if (angabe.betont) knopf.className = 'primary';
        knopf.addEventListener('click', () => {
            /* Erst schließen, dann wirken: Eine Wirkung, die den Bildschirm
               neu zeichnet, soll nicht gegen einen offenen Dialog arbeiten. */
            if (!angabe.offenLassen) schliesseDialog();
            angabe.wirkung?.();
        });
        leiste.append(knopf);
    }

    const abbrechen = document.createElement('button');
    abbrechen.type = 'button';
    abbrechen.className = 'dialog-abbruch';
    abbrechen.textContent = t('allgemein.abbrechen');
    abbrechen.addEventListener('click', schliesseDialog);
    leiste.append(abbrechen);

    karte.append(ueberschrift, rumpf, leiste);
    auflage.append(karte);

    /* Ein Tipp neben die Karte schließt – das erwartet man von einer Auflage.
       Ein Tipp AUF die Karte darf es nicht, sonst schließt jeder Fehlgriff
       beim Tippen den Dialog. */
    auflage.addEventListener('click', (ereignis) => {
        if (ereignis.target === auflage) schliesseDialog();
    });
    document.addEventListener('keydown', beiTaste);

    document.body.append(auflage);
    offen = auflage;

    /* Von selbst in ein Eingabefeld springen nur dort, wo Tippen der Zweck
       des Dialogs ist – beim Rezeptnamen etwa. Sonst öffnet jedes geöffnete
       Blatt die Bildschirmtastatur: Sie verdeckt genau das, was man ansehen
       wollte, und auf iOS schiebt sie den sichtbaren Ausschnitt nach oben,
       der danach manchmal oben stehen bleibt (`rahmenZurueckholen` in
       `schale.js` holt ihn zurück). Der Fokus wandert trotzdem in den
       Dialog – auf den ersten Knopf –, damit Tastatur und Vorlesehilfe
       nicht hinter der Auflage weiterlaufen. */
    /* Ohne Tippabsicht bekommt die **Karte** den Fokus, nicht der erste
       Knopf. Der erste Knopf steht unten in der Leiste: Ihn zu fokussieren
       rollt einen langen Dialog sofort ans Ende – die Überschrift stand dann
       oberhalb des Sichtbaren, und man sah einen Bildschirm ohne Titel.
       Die Karte ist per `tabindex="-1"` fokussierbar, ohne in die
       Tabulatorreihenfolge zu geraten. */
    karte.tabIndex = -1;
    const erstesFeld = fokus ? rumpf.querySelector('input, textarea') : null;
    setTimeout(() => (erstesFeld || karte).focus(), 0);
    return auflage;
}

function beiTaste(ereignis) {
    if (ereignis.key === 'Escape') schliesseDialog();
}

export function schliesseDialog() {
    document.removeEventListener('keydown', beiTaste);
    /* Erst den Fokus aus dem Feld nehmen, dann die Auflage entfernen.
       Verschwindet ein fokussiertes Feld aus dem Dokument, schließt iOS die
       Tastatur zwar, holt den dafür verschobenen Ausschnitt aber nicht
       zuverlässig zurück – und dann steht die untere Leiste außerhalb des
       Bildes. Ein ordentliches `blur` löst außerdem `focusout` aus, worauf
       die Schale nachsieht. */
    if (offen?.contains(document.activeElement)) document.activeElement.blur();
    offen?.remove();
    offen = null;
}

/** Eine Zeile Text im Dialogkörper. */
export function dialogZeile(text, klasse = '') {
    const absatz = document.createElement('p');
    if (klasse) absatz.className = klasse;
    absatz.textContent = text;
    return absatz;
}

/** Ein Eingabefeld im Dialogkörper. `bestaetigen` löst die Eingabetaste aus. */
export function dialogFeld({ platzhalter = '', wert = '', beschriftung = '', bestaetigen = null }) {
    const feld = document.createElement('input');
    feld.type = 'text';
    feld.value = wert;
    feld.placeholder = platzhalter;
    feld.enterKeyHint = 'done';
    if (beschriftung) feld.setAttribute('aria-label', beschriftung);
    if (bestaetigen) {
        feld.addEventListener('keydown', (ereignis) => {
            if (ereignis.key !== 'Enter') return;
            ereignis.preventDefault();
            const eingabe = feld.value;
            schliesseDialog();
            bestaetigen(eingabe);
        });
    }
    return feld;
}
