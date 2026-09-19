/**
 * Bildschirm 2: der Katalog – die Kachelwand.
 *
 * Das wichtigste Bedienelement der App. Artikel kommen durch Antippen einer
 * Kachel auf die Liste, nicht durch Schreiben. Das Suchfeld ist die Ausnahme
 * für den seltenen Fall, dass man weiß, was man sucht, und es weit unten
 * liegt.
 *
 * Die Reihenfolge lernt mit: Wer oft Milch kauft, findet Milch oben. Dafür
 * gibt es keinen Schalter und keine Erklärung – es passiert einfach.
 */

import { t } from '../texte.js';
import { sortiereArtikel, oftGebraucht, sucheArtikel } from '../logik.js';
import {
    zustand, alleArtikel, aufDerListe, umschalten, artikelAnlegen, aufListeSetzen, istExperte
} from '../zustand.js';
import { melde } from './schale.js';
import { kopiereArtikel } from './teilen.js';

let behaelter = null;
let suchfeld = null;
let suchbegriff = '';

export function kachelBeschriftung(artikelName, drauf) {
    return drauf ? `${artikelName} – ${t('katalog.aufDerListe')}` : artikelName;
}

export function katalogVerdrahten() {
    behaelter = document.getElementById('katalog-inhalt');
    suchfeld = document.getElementById('katalog-suche');

    suchfeld.addEventListener('input', () => {
        suchbegriff = suchfeld.value;
        zeichneKatalog();
    });
    /* „Suchen" auf der Tastatur schließt die Tastatur, statt ein Formular
       abzuschicken, das es nicht gibt. */
    suchfeld.addEventListener('keydown', (ereignis) => {
        if (ereignis.key === 'Enter') { ereignis.preventDefault(); suchfeld.blur(); }
    });
}

export function zeichneKatalog() {
    if (!behaelter) return;
    behaelter.textContent = '';

    const artikel = alleArtikel();
    const jetzt = Date.now();

    if (suchbegriff.trim()) {
        const treffer = sucheArtikel(artikel, suchbegriff, jetzt);
        if (treffer.length === 0) {
            behaelter.append(keinTreffer(suchbegriff.trim()));
            return;
        }
        behaelter.append(wand(treffer));
        return;
    }

    /* Die gelernte Reihe steht nur da, wenn sie etwas zu sagen hat. Vor dem
       ersten Einkauf wäre „Oft gebraucht" eine leere Behauptung. */
    const oft = oftGebraucht(artikel, 12, jetzt);
    if (oft.length >= 4) {
        behaelter.append(abschnitt('⭐', t('katalog.oftGebraucht'), wand(oft)));
    }

    for (const kategorie of zustand.kategorien) {
        const inKategorie = artikel.filter((a) => a.kategorieId === kategorie.id);
        if (inKategorie.length === 0) continue;
        behaelter.append(
            abschnitt(kategorie.icon, kategorie.name, wand(sortiereArtikel(inKategorie, jetzt)))
        );
    }
}

/**
 * Nur die Markierungen nachziehen, ohne die Wand neu zu bauen.
 *
 * Der Katalog sind rund 480 Kacheln. Wenn jemand auf der Liste etwas abhakt,
 * während der Katalog offen ist, muss deshalb nicht das ganze Raster neu
 * entstehen – es ändert sich nur, welche Kachel grün ist. Neu gebaut wird
 * erst, wenn sich die Reihenfolge ändern kann (also beim Abhaken).
 */
export function synchronisiereKacheln() {
    if (!behaelter) return;
    for (const kachelKnopf of behaelter.querySelectorAll('.kachel')) {
        const artikelId = kachelKnopf.dataset.artikelId;
        const drauf = aufDerListe(artikelId);
        kachelKnopf.classList.toggle('ist-drauf', drauf);
        kachelKnopf.setAttribute('aria-pressed', drauf ? 'true' : 'false');
        const artikelName = zustand.artikel.get(artikelId)?.name
            || kachelKnopf.querySelector?.('.kachel-name')?.textContent
            || '';
        kachelKnopf.setAttribute('aria-label', kachelBeschriftung(artikelName, drauf));
    }
}

function abschnitt(icon, titel, inhalt) {
    const block = document.createElement('section');
    block.className = 'gruppe';

    const kopf = document.createElement('h2');
    kopf.className = 'gruppe-kopf';
    const zeichen = document.createElement('span');
    zeichen.className = 'gruppe-icon';
    zeichen.setAttribute('aria-hidden', 'true');
    zeichen.textContent = icon || '🛒';
    const name = document.createElement('span');
    name.textContent = titel;
    kopf.append(zeichen, name);

    block.append(kopf, inhalt);
    return block;
}

function wand(artikel) {
    const raster = document.createElement('div');
    raster.className = 'kachelwand';
    for (const eintrag of artikel) raster.append(kachel(eintrag));
    return raster;
}

function kachel(artikel) {
    const drauf = aufDerListe(artikel.id);

    const knopf = document.createElement('button');
    knopf.type = 'button';
    knopf.className = 'kachel' + (drauf ? ' ist-drauf' : '');
    knopf.dataset.artikelId = artikel.id;
    knopf.setAttribute('aria-pressed', drauf ? 'true' : 'false');
    knopf.setAttribute('aria-label', kachelBeschriftung(artikel.name, drauf));

    const icon = document.createElement('span');
    icon.className = 'kachel-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = artikel.icon || '🛒';

    const name = document.createElement('span');
    name.className = 'kachel-name';
    name.textContent = artikel.name;

    const marke = document.createElement('span');
    marke.className = 'kachel-marke';
    marke.setAttribute('aria-hidden', 'true');
    marke.textContent = '✓';

    knopf.append(icon, name, marke);

    knopf.addEventListener('click', async () => {
        /* Erst das Bild, dann die Datenbank: Die Kachel färbt sich im selben
           Lidschlag um, in dem der Finger sie verlässt. Der Zustandswechsel
           zeichnet gleich darauf ohnehin neu – aber das Auge hat seine
           Antwort schon. */
        const jetztDrauf = !knopf.classList.contains('ist-drauf');
        knopf.classList.toggle('ist-drauf', jetztDrauf);
        knopf.classList.remove('puls');
        void knopf.offsetWidth;
        knopf.classList.add('puls');

        await umschalten(artikel.id);
        melde(jetztDrauf ? t('katalog.hinzugefuegt', artikel.name) : t('katalog.entfernt', artikel.name));
    });

    langesDrueckenVerdrahten(knopf, artikel);
    return knopf;
}

/**
 * Langes Drücken auf eine Kachel kopiert den Artikelnamen – für Fragen zu
 * einzelnen Produkten („erklär mir Sardellenpaste").
 *
 * Der Name geht nackt in die Zwischenablage, ohne mitgelieferte Frage. Was
 * jemand wissen will, weiß er selbst; eine vorformulierte Frage würde mit
 * den Fähigkeiten der Modelle altern.
 *
 * Nur im Expertenmodus: Im Basismodus darf eine Kachel genau eine Sache tun.
 */
function langesDrueckenVerdrahten(knopf, artikel) {
    let zeitgeber = null;
    let ausgeloest = false;

    const abbrechen = () => { clearTimeout(zeitgeber); zeitgeber = null; };

    knopf.addEventListener('pointerdown', () => {
        if (!istExperte()) return;
        ausgeloest = false;
        zeitgeber = setTimeout(async () => {
            ausgeloest = true;
            /* Kurz rütteln, wo das Gerät es kann: Beim langen Drücken gibt es
               keine Bewegung auf dem Schirm, an der man den Auslösepunkt
               ablesen könnte. */
            navigator.vibrate?.(12);
            await kopiereArtikel(artikel);
        }, 500);
    });

    for (const art of ['pointerup', 'pointercancel', 'pointerleave', 'pointermove']) {
        knopf.addEventListener(art, abbrechen);
    }

    /* Nach dem langen Drücken darf der Finger beim Loslassen nicht auch noch
       den Artikel auf die Liste legen. */
    knopf.addEventListener('click', (ereignis) => {
        if (!ausgeloest) return;
        ausgeloest = false;
        ereignis.preventDefault();
        ereignis.stopImmediatePropagation();
    }, true);
}

/**
 * Nichts gefunden – der einzige Ort, an dem in Foxi getippt wird.
 * Der Katalog kennt rund 480 Artikel; was fehlt, legt man hier in einem
 * Schritt an und hat es zugleich auf der Liste.
 */
function keinTreffer(begriff) {
    const block = document.createElement('div');
    block.className = 'leer';

    const icon = document.createElement('div');
    icon.className = 'leer-icon';
    icon.textContent = '🔍';

    const text = document.createElement('p');
    text.textContent = t('katalog.keinTreffer');

    const knopf = document.createElement('button');
    knopf.type = 'button';
    knopf.className = 'primary';
    knopf.textContent = t('katalog.keinTrefferAnlegen', begriff);
    knopf.addEventListener('click', async () => {
        const artikel = await artikelAnlegen(begriff, 'sonstiges');
        if (!artikel) return;
        await aufListeSetzen(artikel.id);
        suchbegriff = '';
        if (suchfeld) suchfeld.value = '';
        zeichneKatalog();
        melde(t('katalog.angelegt', artikel.name));
    });

    block.append(icon, text, knopf);
    return block;
}
