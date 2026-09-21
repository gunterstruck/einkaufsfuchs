/**
 * Die Schale: Kopfbereich, Bereichswechsel, Rückmeldung.
 *
 * Alles, was um die drei Bildschirme herum steht und immer da ist.
 */

import { t } from '../texte.js';
import { istExperte, modusSetzen, offeneEintraege, beiAenderung } from '../zustand.js';

let aktuellerBereich = 'liste';
let toastZeitgeber = null;
const bereichsZuhoerer = new Set();

/**
 * Texte einsetzen. Das Markup trägt Kennungen (`data-text="liste.titel"`),
 * nicht die Sätze selbst – so bleibt `texte.js` der einzige Ort, an dem
 * Sprache steht, und eine spätere Übersetzung braucht keine Suche durchs
 * Markup.
 */
export function texteEinsetzen(wurzel = document) {
    for (const el of wurzel.querySelectorAll('[data-text]')) {
        el.textContent = t(el.dataset.text);
    }
    for (const el of wurzel.querySelectorAll('[data-platzhalter]')) {
        el.setAttribute('placeholder', t(el.dataset.platzhalter));
    }
    for (const el of wurzel.querySelectorAll('[data-beschriftung]')) {
        el.setAttribute('aria-label', t(el.dataset.beschriftung));
    }
    for (const el of wurzel.querySelectorAll('[data-titel]')) {
        el.setAttribute('title', t(el.dataset.titel));
    }
}

/* ────────────────────────────────────────────────────────────────────────
   Bereiche
   ──────────────────────────────────────────────────────────────────────── */

/** Wird gerufen, bevor ein Bereich sichtbar wird – dort zeichnet `app.js`
 *  nach, was in der Zwischenzeit veraltet ist. */
export function beiBereichswechsel(rueckruf) {
    bereichsZuhoerer.add(rueckruf);
    return () => bereichsZuhoerer.delete(rueckruf);
}

/**
 * Die Schreibtisch-Ansicht: quer, breit und hoch genug für zwei Spalten.
 *
 * Wortgleich steht diese Abfrage in `foxi.css`; dort schneidet sie das
 * Raster, hier entscheidet sie, dass der Katalog nicht versteckt wird. Ein
 * Test hält beide Fassungen zusammen – liefen sie auseinander, stünde die
 * linke Spalte leer. Die Begründung der drei Bedingungen steht im CSS.
 */
export const DESKTOP_ABFRAGE = '(min-width: 900px) and (min-height: 480px) and (orientation: landscape)';

/** Steht der Katalog dauerhaft links, statt hinter seinem Reiter? */
export function katalogAngedockt() {
    return window.matchMedia?.(DESKTOP_ABFRAGE).matches === true;
}

export function zeigeBereich(name) {
    const angedockt = katalogAngedockt();
    /* Am Schreibtisch ist der Katalog immer da. Ein Wechsel „zum Katalog"
       hätte kein Ziel mehr – der Reiter ist dort ausgeblendet, und was doch
       noch dorthin schickt (der leere Zustand der Liste), landet bei der
       Liste, neben der die Kachelwand ohnehin schon steht. */
    if (angedockt && name === 'katalog') name = 'liste';

    aktuellerBereich = name;
    for (const rueckruf of bereichsZuhoerer) rueckruf(name);
    for (const abschnitt of document.querySelectorAll('.bereich')) {
        const gefragt = abschnitt.id === `bereich-${name}`;
        abschnitt.hidden = !(gefragt || (angedockt && abschnitt.id === 'bereich-katalog'));
    }
    for (const tab of document.querySelectorAll('.tab')) {
        const aktiv = tab.dataset.bereich === name;
        tab.classList.toggle('active', aktiv);
        tab.setAttribute('aria-selected', aktiv ? 'true' : 'false');
    }
    /* Beim Wechsel oben anfangen. Wer aus dem Katalog zur Liste geht, will die
       Liste sehen und nicht die Stelle, an der er vorhin stehen geblieben ist. */
    const sichtbar = document.getElementById(`bereich-${name}`);
    if (sichtbar) sichtbar.scrollTop = 0;
}

export function aktiverBereich() {
    return aktuellerBereich;
}

/* ────────────────────────────────────────────────────────────────────────
   Rückmeldung
   ──────────────────────────────────────────────────────────────────────── */

/**
 * Ein Satz über der unteren Leiste, optional mit einer einzigen Handlung.
 * Zwei Sekunden ohne Handlung, vier mit – lange genug zum Lesen, kurz genug,
 * um nicht im Weg zu stehen.
 */
export function melde(text, handlung = null) {
    const toast = document.getElementById('toast');
    if (!toast) return;

    clearTimeout(toastZeitgeber);
    toast.textContent = '';

    const satz = document.createElement('span');
    satz.textContent = text;
    toast.append(satz);

    if (handlung) {
        const knopf = document.createElement('button');
        knopf.type = 'button';
        knopf.textContent = handlung.text;
        knopf.addEventListener('click', () => {
            versteckeToast();
            handlung.tun();
        });
        toast.append(knopf);
    }

    toast.hidden = false;
    requestAnimationFrame(() => toast.classList.add('sichtbar'));
    toastZeitgeber = setTimeout(versteckeToast, handlung ? 4000 : 2000);
}

function versteckeToast() {
    const toast = document.getElementById('toast');
    if (!toast) return;
    clearTimeout(toastZeitgeber);
    toast.classList.remove('sichtbar');
    setTimeout(() => { if (!toast.classList.contains('sichtbar')) toast.hidden = true; }, 200);
}

/* ────────────────────────────────────────────────────────────────────────
   Tiefe
   ──────────────────────────────────────────────────────────────────────── */

export function tiefeAnzeigen() {
    const experte = istExperte();
    document.body.classList.toggle('modus-experte', experte);
    document.body.classList.toggle('modus-basis', !experte);
    for (const seg of document.querySelectorAll('#modus-schalter .seg')) {
        const aktiv = (seg.dataset.modus === 'experte') === experte;
        seg.classList.toggle('active', aktiv);
        seg.setAttribute('aria-pressed', aktiv ? 'true' : 'false');
    }
}

/** Die Zahl auf dem Reiter „Liste": offene Artikel, sonst nichts. */
export function zaehlerAnzeigen() {
    const offen = offeneEintraege().length;
    const zahl = document.getElementById('tab-liste-zahl');
    if (zahl) {
        zahl.textContent = String(offen);
        zahl.hidden = offen === 0;
    }
    const kopfzahl = document.getElementById('liste-zahl');
    if (kopfzahl) kopfzahl.textContent = offen > 0 ? t('liste.offeneAnzahl', offen) : '';
}

/* ────────────────────────────────────────────────────────────────────────
   Der Rahmen

   Foxi ist genau so hoch wie der Bildschirm: Kopf oben, Inhalt in der Mitte,
   Leiste unten. Gerollt wird ausschließlich *innerhalb* des Inhalts. Genau
   deshalb ist jede Verschiebung des Fensters selbst ein Fehler und nicht nur
   ein Schönheitsfleck: Sie schiebt die untere Leiste aus dem Bild, und dann
   kommt man an Katalog und Mehr nicht mehr heran – man sitzt in der Liste
   fest, kann darin rollen und sonst nichts.

   Verschoben wird der Ausschnitt von der Bildschirmtastatur. iOS verkleinert
   die Seite nicht, sondern schiebt den sichtbaren Ausschnitt über sie hinweg,
   damit das Feld über der Tastatur steht. Geht die Tastatur, soll er
   zurückspringen – und tut es manchmal nicht, besonders wenn das fokussierte
   Feld beim Schließen aus dem Dokument verschwindet.

   Der Weg zurück ist billig und ungefährlich: Steht kein Feld im Fokus, darf
   der Ausschnitt gar nicht verschoben sein. Ist er es doch, wird er
   zurückgeholt.
   ──────────────────────────────────────────────────────────────────────── */

/** Reine Entscheidung, damit sie prüfbar ist: Muss der Rahmen zurück? */
export function rahmenVerschoben({ scrollY = 0, versatz = 0, tippt = false } = {}) {
    /* Während getippt wird, ist die Verschiebung gewollt – sie hält das Feld
       über der Tastatur. Sie zurückzuholen hieße, dem Nutzer beim Schreiben
       das Feld unter den Fingern wegzuziehen. */
    if (tippt) return false;
    return Math.abs(scrollY) > 1 || Math.abs(versatz) > 1;
}

function tipptGerade() {
    const el = document.activeElement;
    if (!el) return false;
    return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable === true;
}

/** Den Rahmen zurückholen, falls nötig. Gibt zurück, ob etwas zu tun war. */
export function rahmenZurueckholen() {
    const verschoben = rahmenVerschoben({
        scrollY: window.scrollY || 0,
        versatz: window.visualViewport?.offsetTop || 0,
        tippt: tipptGerade()
    });
    if (!verschoben) return false;
    window.scrollTo(0, 0);
    return true;
}

function rahmenUeberwachen() {
    /* Der kleine Verzug lässt dem Browser den Vortritt: Meistens räumt er
       selbst auf, und dann findet die Prüfung nichts mehr zu tun. */
    const spaeter = () => setTimeout(rahmenZurueckholen, 150);
    document.addEventListener('focusout', spaeter);
    window.addEventListener('orientationchange', spaeter);
    window.addEventListener('pageshow', spaeter);
    /* Die Tastatur meldet sich als Größenänderung des sichtbaren
       Ausschnitts – beim Auf- *und* beim Zugehen. */
    window.visualViewport?.addEventListener('resize', spaeter);
}

/* ────────────────────────────────────────────────────────────────────────
   Verdrahtung
   ──────────────────────────────────────────────────────────────────────── */

export function schaleVerdrahten() {
    texteEinsetzen();
    rahmenUeberwachen();

    /* Wer das Tablet dreht, wechselt den Schnitt. Ohne diese Zeile bliebe
       die Katalogspalte leer, bis jemand einen Reiter antippt – und im
       umgekehrten Fall stünden nach dem Zurückdrehen zwei Bereiche
       übereinander. */
    window.matchMedia?.(DESKTOP_ABFRAGE)
        .addEventListener('change', () => zeigeBereich(aktiverBereich()));

    for (const tab of document.querySelectorAll('.tab')) {
        tab.addEventListener('click', () => zeigeBereich(tab.dataset.bereich));
    }

    for (const seg of document.querySelectorAll('#modus-schalter .seg')) {
        seg.addEventListener('click', async () => {
            const gewuenscht = seg.dataset.modus;
            if ((gewuenscht === 'experte') === istExperte()) return;
            await modusSetzen(gewuenscht);
            melde(t(gewuenscht === 'experte' ? 'tiefe.gewechseltZuExperte' : 'tiefe.gewechseltZuBasis'));
        });
    }

    beiAenderung(() => {
        tiefeAnzeigen();
        zaehlerAnzeigen();
    });

    tiefeAnzeigen();
    zaehlerAnzeigen();
}
