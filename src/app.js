/**
 * Foxi – Start und Zusammenspiel.
 *
 * Diese Datei kennt alle drei Bildschirme und sonst niemand kennt sie. Sie
 * macht genau drei Dinge: den Zustand laden, die Oberfläche verdrahten und
 * bei jeder Änderung das Nötige neu zeichnen – nicht mehr.
 */

import { starte, beiAenderung } from './zustand.js';
import {
    schaleVerdrahten, zeigeBereich, aktiverBereich, beiBereichswechsel, katalogAngedockt
} from './ui/schale.js';
import { listeVerdrahten, zeichneListe } from './ui/liste.js';
import { katalogVerdrahten, zeichneKatalog, synchronisiereKacheln } from './ui/katalog.js';
import { mehrVerdrahten, zeichneMehr } from './ui/mehr.js';
import { initPwaUpdate } from './pwa-update.js';

/* Welcher Bildschirm ist gegenüber dem Zustand veraltet? Ein Bereich, den
   niemand ansieht, wird nicht gezeichnet – er merkt sich nur, dass er es
   nachholen muss. Das ist der Unterschied zwischen „flüssig" und „hakt beim
   Abhaken", sobald der Katalog 480 Kacheln hat. */
const veraltet = { liste: true, katalog: true, mehr: true };
let letzterTag = null;
let tageswechselZeitgeber = null;

function zeichneWennSichtbar() {
    /* Am Schreibtisch steht der Katalog dauerhaft in der linken Spalte. Dann
       ist er nicht „der Bereich, den niemand ansieht", sondern immer im
       Blick – und muss mitgezeichnet werden. Ein Artikel, der nur auf die
       Liste wandert, löst das nicht aus: Dafür genügt `synchronisiereKacheln`
       weiter unten, sonst würden 480 Kacheln bei jedem Tipp neu gebaut. */
    if (katalogAngedockt() && veraltet.katalog) {
        zeichneKatalog();
        veraltet.katalog = false;
    }

    const bereich = aktiverBereich();
    if (!veraltet[bereich]) return;
    if (bereich === 'liste') zeichneListe();
    else if (bereich === 'katalog') zeichneKatalog();
    else if (bereich === 'mehr') zeichneMehr();
    veraltet[bereich] = false;
}

function alsVeraltetMarkieren(...bereiche) {
    for (const bereich of bereiche) veraltet[bereich] = true;
}

/** Angebote sind kalendertagsabhängig. Der Schlüssel folgt bewusst der
 * lokalen Zeit des Geräts – genau dieselbe Sicht auf „heute“ verwendet die
 * Angebotslogik. */
function lokalerTag(zeitpunkt = new Date()) {
    const jahr = zeitpunkt.getFullYear();
    const monat = String(zeitpunkt.getMonth() + 1).padStart(2, '0');
    const tag = String(zeitpunkt.getDate()).padStart(2, '0');
    return `${jahr}-${monat}-${tag}`;
}

function aktualisiereNachTageswechsel() {
    const heute = lokalerTag();
    if (heute === letzterTag) return;
    letzterTag = heute;
    alsVeraltetMarkieren('liste', 'mehr');
    zeichneWennSichtbar();
}

function planeTageswechsel() {
    if (tageswechselZeitgeber !== null) window.clearTimeout(tageswechselZeitgeber);
    const jetzt = new Date();
    const morgen = new Date(jetzt);
    morgen.setHours(24, 0, 0, 0);
    const wartezeit = Math.max(1000, morgen.getTime() - jetzt.getTime() + 100);
    tageswechselZeitgeber = window.setTimeout(() => {
        aktualisiereNachTageswechsel();
        planeTageswechsel();
    }, wartezeit);
}

function tageswechselVerdrahten() {
    letzterTag = lokalerTag();
    const beiRueckkehr = () => {
        aktualisiereNachTageswechsel();
        /* Nach Schlafmodus oder Zeitzonenwechsel kann der alte Zeitgeber auf
           die falsche Mitternacht zeigen. Bei Rückkehr wird er neu berechnet. */
        planeTageswechsel();
    };
    window.addEventListener('focus', beiRueckkehr);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') beiRueckkehr();
    });
    planeTageswechsel();
}

async function los() {
    schaleVerdrahten();
    listeVerdrahten();
    katalogVerdrahten();
    mehrVerdrahten();

    beiBereichswechsel(() => queueMicrotask(zeichneWennSichtbar));

    beiAenderung((grund) => {
        if (grund === 'liste') {
            /* Ein Artikel kam auf die Liste oder ging herunter. Für den
               Katalog heißt das nur: eine Kachel wechselt die Farbe. */
            alsVeraltetMarkieren('liste');
            /* Auch der verdeckte Katalog bleibt im DOM. Deshalb dort sofort
               nachziehen; sonst trägt er nach „Liste leeren“ beim nächsten
               Öffnen noch die alten grünen Markierungen. */
            synchronisiereKacheln();
        } else {
            /* Abhaken, Modus, eigene Artikel, neue Reihenfolge: Hier kann
               sich auch die Sortierung ändern. Alles neu. */
            alsVeraltetMarkieren('liste', 'katalog', 'mehr');
        }
        zeichneWennSichtbar();
    });

    await starte('./');
    alsVeraltetMarkieren('liste', 'katalog', 'mehr');
    zeigeBereich('liste');
    zeichneWennSichtbar();
    tageswechselVerdrahten();
}

los().catch((fehler) => {
    console.error('[Foxi] Start fehlgeschlagen', fehler);
    const inhalt = document.getElementById('liste-inhalt');
    if (inhalt) {
        inhalt.textContent = 'Foxi konnte nicht starten. Bitte die Seite neu laden.';
    }
});

/* Über `file://` läuft Foxi weiterhin ohne Service Worker. Unter HTTP(S)
   übernimmt dieses Modul Offline-Speicher und den vollständigen Updateweg. */
initPwaUpdate();
