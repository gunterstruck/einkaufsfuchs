/**
 * Das Artikelblatt: aufgeklappt, was in der Listenzeile nur als Marke steht.
 *
 * Erreichbar ist es über den Knopf **neben** der Zeile – nicht über die Zeile
 * selbst. Das ist Absicht und die wichtigste Entscheidung an diesem Blatt:
 * Die Karte bleibt ungeteilt das Ziel zum Abhaken. Ein geteiltes Ziel (Kreis
 * hakt ab, Mitte öffnet) würde das häufigste Ziel der App um ein Vielfaches
 * verkleinern – für die eine Handlung, die einhändig im Gehen passiert. Und
 * es wäre eine Regel, die man wissen müsste.
 *
 * Der Knopf neben der Zeile gab es ohnehin schon; er klappte bisher ein
 * Formular unter der Zeile auf. Er führt jetzt hierher, weil hier mehr Platz
 * ist als unter einer Zeile: Produktwunsch, Foto **und** die Angebote mit
 * Herkunft.
 */

import { t } from '../texte.js';
import { datumDeutsch } from '../logik.js';
import { angeboteFuerArtikel, preisDeutsch } from '../angebotsradar.js';
import {
    angebotsergebnis, produktfoto, produktfotoSetzen, produktfotoLoeschen,
    produktwunschSetzen
} from '../zustand.js';
import { zeigeDialog, schliesseDialog } from './dialog.js';
import { melde } from './schale.js';

/**
 * Was von einem gruppierten Angebot im Blatt steht – als reine Angabe, ohne
 * DOM. So lässt sich die Darstellung prüfen, ohne einen Browser zu starten.
 *
 * `markieren` trägt die zwei Aussagen, die man nicht übersehen darf: dass es
 * sich um ein **ähnliches** Produkt handelt, und welches Angebot den
 * niedrigsten Grundpreis hat. Alles andere ist beschreibend.
 */
export function angebotDetails(angebot) {
    const marken = [];
    if (angebot.treffer === 'alternative') marken.push(t('blatt.alternative'));
    if (angebot.niedrigsterGefundenerGrundpreis) marken.push(t('blatt.guenstigster'));

    const maerkte = Array.isArray(angebot.maerkte) ? angebot.maerkte : [];
    const hinweis = typeof angebot.hinweis === 'string' ? angebot.hinweis.trim() : '';

    return {
        kopf: `${preisDeutsch(angebot.preis)} · ${angebot.haendler}`,
        produkt: angebot.produkt || '',
        /* Der Grundpreis ist die eigentliche Vergleichszahl – 0,99 € sagt
           nichts, 0,99 €/kg sagt alles. Deshalb steht er neben der Menge. */
        preisangabe: [angebot.menge, angebot.grundpreis].filter(Boolean).join(' · '),
        gueltig: t('blatt.gueltigBis', datumDeutsch(new Date(`${angebot.gueltigBis}T12:00:00`))),
        marken,
        hinweis,
        maerkte,
        /* Nur eine Quelle je Angebot: Die Gruppierung sammelt zwar alle, aber
           sie zeigen auf dieselbe Angebotsseite des Händlers. Eine Liste
           gleicher Links wäre Lärm. */
        quelle: Array.isArray(angebot.quellen) ? angebot.quellen[0] || '' : angebot.quelle || ''
    };
}

/* ────────────────────────────────────────────────────────────────────────
   Aufbau
   ──────────────────────────────────────────────────────────────────────── */

function zeile(text, klasse) {
    const el = document.createElement('p');
    el.className = klasse;
    el.textContent = text;
    return el;
}

function angebotsKarte(angebot) {
    const angaben = angebotDetails(angebot);
    const karte = document.createElement('li');
    karte.className = 'blatt-angebot';

    const kopf = document.createElement('p');
    kopf.className = 'blatt-angebot-kopf';
    kopf.textContent = angaben.kopf;
    karte.append(kopf);

    if (angaben.marken.length) {
        const marken = document.createElement('p');
        marken.className = 'blatt-marken';
        for (const text of angaben.marken) {
            const marke = document.createElement('span');
            marke.className = text === t('blatt.alternative')
                ? 'blatt-marke ist-alternative'
                : 'blatt-marke';
            marke.textContent = text;
            marken.append(marke);
        }
        karte.append(marken);
    }

    if (angaben.produkt) karte.append(zeile(angaben.produkt, 'blatt-produkt'));
    if (angaben.preisangabe) karte.append(zeile(angaben.preisangabe, 'blatt-preisangabe'));
    karte.append(zeile(angaben.gueltig, 'blatt-gueltig'));
    if (angaben.hinweis) karte.append(zeile(angaben.hinweis, 'blatt-hinweis'));

    if (angaben.maerkte.length) {
        const maerkte = document.createElement('ul');
        maerkte.className = 'blatt-maerkte';
        for (const markt of angaben.maerkte) {
            const eintrag = document.createElement('li');
            eintrag.textContent = markt;
            maerkte.append(eintrag);
        }
        karte.append(maerkte);
    }

    /* Der Link führt aus der App heraus – und das ist mit dem Grundsatz
       vereinbar: Ein Mensch tippt und geht, Foxi stellt keine Anfrage. Dass
       die Adresse HTTPS auf der Erlaubnisliste offizieller Händler ist,
       garantiert `pruefeAngebotsergebnis()` schon beim Einlesen; ein
       manipuliertes Agentenergebnis kommt gar nicht erst bis hierher.
       `noopener noreferrer` und die Kopfzeile `Referrer-Policy: no-referrer`
       sorgen dafür, dass der Händler nicht erfährt, woher der Klick kam. */
    if (angaben.quelle) {
        const verweis = document.createElement('a');
        verweis.className = 'blatt-quelle';
        verweis.href = angaben.quelle;
        verweis.target = '_blank';
        verweis.rel = 'noopener noreferrer';
        verweis.textContent = t('blatt.beimHaendler');
        verweis.setAttribute('aria-label', t('blatt.quelleBeschriftung', angebot.haendler));
        karte.append(verweis);
    }

    return karte;
}

function angebotsTeil(artikelId) {
    const angebote = angeboteFuerArtikel(angebotsergebnis(), artikelId);
    const block = document.createElement('section');
    block.className = 'blatt-angebote';

    if (angebote.length === 0) {
        block.append(zeile(t('blatt.keineAngebote'), 'muted small'));
        return block;
    }

    const titel = document.createElement('h3');
    titel.className = 'blatt-abschnitt';
    titel.textContent = t('blatt.angeboteTitel', angebote.length);
    block.append(titel);

    const liste = document.createElement('ul');
    liste.className = 'blatt-angebotsliste';
    for (const angebot of angebote) liste.append(angebotsKarte(angebot));
    block.append(liste);
    return block;
}

function wunschTeil(eintrag, neuZeichnen) {
    const form = document.createElement('form');
    /* Klassenname aus der früheren Inline-Fassung übernommen: Die Prüfstrecke
       und die Gestaltung hängen daran, und es ist weiterhin dasselbe
       Formular – nur an einem Ort mit mehr Platz. */
    form.className = 'mengen-editor';

    const wunsch = document.createElement('input');
    wunsch.type = 'text';
    wunsch.maxLength = 180;
    wunsch.value = eintrag.artikel.standardWunsch
        || [eintrag.menge, eintrag.notiz].filter(Boolean).join(' · ');
    wunsch.placeholder = t('menge.wunschPlatzhalter');
    wunsch.setAttribute('aria-label', t('menge.wunschBeschriftung'));
    wunsch.enterKeyHint = 'done';

    const fotoAktionen = document.createElement('div');
    fotoAktionen.className = 'produktfoto-aktionen';
    const fotoWahl = document.createElement('input');
    fotoWahl.type = 'file';
    fotoWahl.accept = 'image/*';
    fotoWahl.hidden = true;
    fotoWahl.setAttribute('capture', 'environment');

    const fotoKnopf = document.createElement('button');
    fotoKnopf.type = 'button';
    fotoKnopf.textContent = produktfoto(eintrag.artikelId)
        ? t('menge.fotoAendern')
        : t('menge.fotoHinzufuegen');
    fotoKnopf.addEventListener('click', () => fotoWahl.click());

    fotoWahl.addEventListener('change', async () => {
        const datei = fotoWahl.files?.[0];
        if (!datei) return;
        try {
            /* Den bis hierher getippten Wunsch zuerst sichern: Das Blatt wird
               nach dem Foto neu aufgebaut, und genau dieser Text wäre sonst
               nach der Rückkehr von der Kamera verschwunden. */
            await produktwunschSetzen(eintrag.artikelId, wunsch.value);
            const datenUrl = await bildKomprimieren(datei);
            if (!await produktfotoSetzen(eintrag.artikelId, datenUrl)) throw new Error('zu gross');
            neuZeichnen();
        } catch (fehler) {
            console.warn('Produktfoto konnte nicht verarbeitet werden', fehler);
            melde(t('menge.fotoFehler'));
        }
    });

    fotoAktionen.append(fotoKnopf, fotoWahl);
    if (produktfoto(eintrag.artikelId)) {
        const loeschen = document.createElement('button');
        loeschen.type = 'button';
        loeschen.textContent = t('menge.fotoLoeschen');
        loeschen.addEventListener('click', async () => {
            await produktwunschSetzen(eintrag.artikelId, wunsch.value);
            await produktfotoLoeschen(eintrag.artikelId);
            neuZeichnen();
        });
        fotoAktionen.append(loeschen);
    }

    /* „Fertig" steht nicht hier im Formular, sondern unten in der
       Knopfleiste des Dialogs – neben „Abbrechen". Zwei schließende
       Aktionen auf zwei verschiedenen Höhen sind eine Zumutung: Die
       wichtigere lag optisch begraben zwischen Fotoknopf und Angeboten.
       Die Eingabetaste im Feld tut trotzdem dasselbe. */
    form.addEventListener('submit', (ereignis) => {
        ereignis.preventDefault();
        sichern();
    });

    async function sichern() {
        schliesseDialog();
        await produktwunschSetzen(eintrag.artikelId, wunsch.value);
    }

    form.append(wunsch, fotoAktionen);
    return { form, sichern };
}

/**
 * Das Blatt öffnen. `eintrag` ist der Listeneintrag samt `artikel`.
 *
 * Das Blatt ändert von sich aus nichts: Wer es über „Abbrechen", die Auflage
 * oder Escape verlässt, hinterlässt den Artikel genauso, wie er ihn
 * vorgefunden hat. Gespeichert wird nur über „Fertig" – oder beim Foto, weil
 * die Kamera den Bildschirm ohnehin verlässt.
 */
export function zeigeArtikelblatt(eintrag) {
    const neuZeichnen = () => zeigeArtikelblatt(eintrag);

    const kopf = document.createElement('div');
    kopf.className = 'blatt-kopf';
    const foto = produktfoto(eintrag.artikelId);
    const bild = foto ? document.createElement('img') : document.createElement('span');
    bild.className = foto ? 'blatt-foto' : 'blatt-icon';
    bild.setAttribute('aria-hidden', 'true');
    if (foto) bild.src = foto; else bild.textContent = eintrag.artikel.icon || '🛒';
    kopf.append(bild);

    const { form, sichern } = wunschTeil(eintrag, neuZeichnen);

    zeigeDialog({
        titel: eintrag.artikel.name,
        koerper: [kopf, form, angebotsTeil(eintrag.artikelId)],
        knoepfe: [{ text: t('menge.fertig'), betont: true, wirkung: sichern }]
    });
}

/* Bilder bleiben auf dem Gerät: Die Datei wird im Browser verkleinert und als
   `data:`-URL in IndexedDB gelegt. Deshalb erlaubt die CSP `img-src 'self'
   data:` – und deshalb verlässt auch ein Foto das Gerät nicht. */
function bildKomprimieren(datei) {
    if (!datei.type.startsWith('image/') || datei.size > 12 * 1024 * 1024) {
        return Promise.reject(new Error('bild'));
    }
    return new Promise((resolve, reject) => {
        const bild = new Image();
        bild.onload = () => {
            const faktor = Math.min(1, 720 / Math.max(bild.width, bild.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(bild.width * faktor));
            canvas.height = Math.max(1, Math.round(bild.height * faktor));
            canvas.getContext('2d').drawImage(bild, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.78));
        };
        bild.onerror = reject;
        const leser = new FileReader();
        leser.onload = () => { bild.src = leser.result; };
        leser.onerror = reject;
        leser.readAsDataURL(datei);
    });
}
