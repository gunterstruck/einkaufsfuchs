/**
 * Bildschirm 1: die Liste.
 *
 * Nach Kategorie gruppiert, in der eingestellten Reihenfolge. Ein Tipp auf
 * eine Zeile hakt ab; ein Tipp auf eine abgehakte Zeile holt sie zurück.
 * Mehr Gesten gibt es nicht – kein Wischen, kein langes Drücken, kein
 * Kontextmenü. Wer im Laden steht, soll nicht raten müssen.
 */

import { t } from '../texte.js';
import { gruppiereListe, datumDeutsch } from '../logik.js';
import { angeboteFuerArtikel, preisDeutsch } from '../angebotsradar.js';
import {
    zustand, offeneEintraege, erledigteEintraege, abhaken, zurueckholen,
    erledigteAufraeumen, istExperte, angebotsergebnis, produktfoto
} from '../zustand.js';
import { melde, zeigeBereich } from './schale.js';
import { zeigeArtikelblatt } from './artikelblatt.js';

let behaelter = null;

/** Kompakter Angebotstext für die Listenkarte. Die Kaufbedingung gehört
 * zum ausgewählten günstigsten Treffer: Ohne sie würde ein „ab“-Preis etwa
 * trotz Mindestmenge wie ein frei verfügbarer Preis wirken. */
export function angebotHinweisFuerListe(angebote) {
    if (!Array.isArray(angebote) || angebote.length === 0) return '';
    const guenstigster = angebote.reduce(
        (bisher, angebot) => angebot.preis < bisher.preis ? angebot : bisher
    );
    const grundtext = angebote.length === 1
        ? t(
            guenstigster.treffer === 'alternative'
                ? 'angebote.listenAlternative'
                : 'angebote.listenTreffer',
            preisDeutsch(guenstigster.preis),
            guenstigster.haendler,
            datumDeutsch(new Date(`${guenstigster.gueltigBis}T12:00:00`)),
            guenstigster.maerkte.length
        )
        : t(
            'angebote.listenMehrere',
            angebote.length,
            preisDeutsch(guenstigster.preis),
            datumDeutsch(new Date(`${angebote.map((a) => a.gueltigBis).sort()[0]}T12:00:00`))
        );
    const kaufbedingung = typeof guenstigster.hinweis === 'string'
        ? guenstigster.hinweis.trim()
        : '';
    return kaufbedingung ? `${grundtext} · ${kaufbedingung}` : grundtext;
}

/** Sichtbarer Hinweis und zugängliche Beschriftung bleiben wortgleich. */
export function listenkartenBeschriftung(stimmtext, angebotHinweis = '') {
    return angebotHinweis ? `${stimmtext}. ${angebotHinweis}` : stimmtext;
}

export function listeVerdrahten() {
    behaelter = document.getElementById('liste-inhalt');
}

export function zeichneListe() {
    if (!behaelter) return;
    behaelter.textContent = '';

    const offen = offeneEintraege();
    const erledigt = erledigteEintraege();

    if (offen.length === 0 && erledigt.length === 0) {
        behaelter.append(leererZustand());
        return;
    }

    const gruppen = gruppiereListe(offen, zustand.artikel, zustand.kategorien);
    for (const gruppe of gruppen) behaelter.append(gruppeZeichnen(gruppe));

    if (erledigt.length > 0) behaelter.append(erledigtBlock(erledigt));
}

function leererZustand() {
    const block = document.createElement('div');
    block.className = 'leer';

    const icon = document.createElement('div');
    icon.className = 'leer-icon';
    icon.textContent = '🧺';

    const titel = document.createElement('h2');
    titel.textContent = t('liste.leerTitel');

    const text = document.createElement('p');
    text.textContent = t('liste.leerText');

    const knopf = document.createElement('button');
    knopf.type = 'button';
    knopf.className = 'primary';
    knopf.textContent = t('liste.leerKnopf');
    knopf.addEventListener('click', () => zeigeBereich('katalog'));

    block.append(icon, titel, text, knopf);
    return block;
}

function gruppeZeichnen(gruppe) {
    const block = document.createElement('section');
    block.className = 'gruppe';

    const kopf = document.createElement('h2');
    kopf.className = 'gruppe-kopf';
    const icon = document.createElement('span');
    icon.className = 'gruppe-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = gruppe.kategorie.icon || '🛒';
    const name = document.createElement('span');
    name.textContent = gruppe.kategorie.name;
    kopf.append(icon, name);

    const liste = document.createElement('ul');
    liste.className = 'listenliste';
    for (const eintrag of gruppe.eintraege) liste.append(zeileZeichnen(eintrag));

    block.append(kopf, liste);
    return block;
}

function zeileZeichnen(eintrag, erledigt = false) {
    const zeile = document.createElement('li');

    const karte = document.createElement('button');
    karte.type = 'button';
    karte.className = 'listenkarte' + (erledigt ? ' ist-erledigt' : '');
    karte.dataset.artikelId = eintrag.artikelId;

    const foto = produktfoto(eintrag.artikelId);
    const icon = foto ? document.createElement('img') : document.createElement('span');
    icon.className = foto ? 'karte-produktfoto' : 'karte-icon';
    icon.setAttribute('aria-hidden', 'true');
    if (foto) icon.src = foto; else icon.textContent = eintrag.artikel.icon || '🛒';

    const text = document.createElement('span');
    text.className = 'karte-text';
    const name = document.createElement('span');
    name.className = 'karte-name';
    name.textContent = eintrag.artikel.name;
    text.append(name);

    /* Produktwunsch und Foto stehen nur im Expertenmodus im Bild. In der
       Datenbank bleiben sie – wer zurück auf Basis schaltet, verliert nichts. */
    const zusatz = eintrag.artikel.standardWunsch || [eintrag.menge, eintrag.notiz].filter(Boolean).join(' · ');
    if (zusatz && istExperte()) {
        const zeileZusatz = document.createElement('span');
        zeileZusatz.className = 'karte-zusatz';
        zeileZusatz.textContent = zusatz;
        text.append(zeileZusatz);
    }

    /* Der Angebotscheck wird dort nützlich, wo die Kaufentscheidung fällt:
       direkt am offenen Artikel. Dieselben Händlerangebote aus mehreren
       Filialen sind hier bereits zusammengefasst. */
    let angebotHinweis = '';
    if (!erledigt) {
        const angebote = angeboteFuerArtikel(angebotsergebnis(), eintrag.artikelId);
        angebotHinweis = angebotHinweisFuerListe(angebote);
        if (angebotHinweis) {
            const marke = document.createElement('span');
            marke.className = 'karte-angebot';
            marke.textContent = angebotHinweis;
            text.append(marke);
            karte.classList.add('hat-angebot');
        }
    }

    const haken = document.createElement('span');
    haken.className = 'haken';
    haken.setAttribute('aria-hidden', 'true');
    haken.textContent = '✓';

    karte.append(icon, text, haken);
    const stimmtext = erledigt
        ? t('liste.stimmeErledigt', eintrag.artikel.name)
        : t('liste.stimmeOffen', eintrag.artikel.name);
    karte.setAttribute('aria-label', listenkartenBeschriftung(stimmtext, angebotHinweis));

    karte.addEventListener('click', async () => {
        if (erledigt) {
            await zurueckholen(eintrag.artikelId);
            return;
        }
        await abhaken(eintrag.artikelId);
        melde(t('liste.abgehakt', eintrag.artikel.name), {
            text: t('allgemein.rueckgaengig'),
            tun: () => zurueckholen(eintrag.artikelId)
        });
    });

    zeile.append(karte);

    if (!erledigt) zeile.append(...mengenTeil(eintrag));

    return zeile;
}

/**
 * Der Griff zum Artikelblatt (Experte).
 *
 * Bis 0.8.2 klappte hier ein Formular unter der Zeile auf. Das reichte für
 * zwei Textfelder, nicht mehr für das, was inzwischen zu einem Artikel
 * gehört: Wunsch, Foto und die Angebote mitsamt Händler, Grundpreis,
 * Filialen und Quelle. Der Knopf führt deshalb ins Artikelblatt.
 *
 * Was sich dabei ausdrücklich **nicht** ändert: Die Karte selbst bleibt ein
 * einziges, ungeteiltes Ziel zum Abhaken. Ein geteiltes Ziel (Kreis hakt ab,
 * Mitte öffnet) würde das häufigste Ziel der App um ein Vielfaches
 * verkleinern – ausgerechnet für die Handlung, die einhändig im Gehen
 * passiert.
 */
function mengenTeil(eintrag) {
    const griff = document.createElement('button');
    griff.type = 'button';
    griff.className = 'experte-nur karte-stift';
    griff.textContent = eintrag.artikel.standardWunsch || produktfoto(eintrag.artikelId) ? '✏️' : '＋';
    griff.setAttribute('aria-label', t('blatt.oeffnen', eintrag.artikel.name));
    griff.addEventListener('click', () => zeigeArtikelblatt(eintrag));
    return [griff];
}

function erledigtBlock(erledigt) {
    const block = document.createElement('section');
    block.className = 'erledigt-block';

    const kopf = document.createElement('div');
    kopf.className = 'erledigt-kopf';

    const titel = document.createElement('h2');
    titel.textContent = `${t('liste.erledigt')} (${erledigt.length})`;

    const aufraeumen = document.createElement('button');
    aufraeumen.type = 'button';
    aufraeumen.textContent = t('liste.erledigtAufraeumen');
    aufraeumen.addEventListener('click', async () => {
        const anzahl = await erledigteAufraeumen();
        if (anzahl > 0) melde(t('liste.erledigteEntfernt'));
    });

    kopf.append(titel, aufraeumen);

    const liste = document.createElement('ul');
    liste.className = 'listenliste';
    for (const eintrag of erledigt) {
        const artikel = zustand.artikel.get(eintrag.artikelId);
        if (!artikel) continue;
        liste.append(zeileZeichnen({ ...eintrag, artikel }, true));
    }

    block.append(kopf, liste);
    return block;
}
