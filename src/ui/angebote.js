/**
 * Bedienwege des Angebotschecks.
 *
 * Hinaus geht ein kopierter Text, herein kommt ausschließlich JSON, das die
 * reinen Regeln in `angebotsradar.js` angenommen haben. Diese Datei zeichnet
 * die Ergebniskarte nicht selbst; sie führt nur die zwei bewussten Übergaben
 * zwischen Foxi und dem frei gewählten Agenten aus.
 */

import {
    aktiveAngebote,
    alsAngebotsauftrag,
    demoAngebotsprofil,
    persoenlichesAngebotsprofil,
    gruppiereAngebote,
    pruefeAngebotsergebnis
} from '../angebotsradar.js';
import {
    angebotsergebnis, zustand, offeneEintraege, alleArtikel, aktiveMaerkte, ort,
    angebotsergebnisSetzen,
    angebotseinfuehrungAbschliessen
} from '../zustand.js';
import { maerkte } from '../zustand.js';
import { t } from '../texte.js';
import { zeigeDialog } from './dialog.js';
import { melde } from './schale.js';
import { kopiereText } from './teilen.js';

const MAX_DATEIGROESSE = 256 * 1024;

export function demoAuftragAlsText() {
    return alsAngebotsauftrag(demoAngebotsprofil());
}

export function persoenlicherAuftragAlsText() {
    const offen = offeneEintraege();
    const ids = new Set();
    const artikel = [];
    for (const eintrag of offen) {
        const stamm = zustand.artikel.get(eintrag.artikelId);
        if (!stamm) continue;
        ids.add(stamm.id);
        artikel.push({ id: stamm.id, name: stamm.name, wunsch: stamm.standardWunsch || eintrag.menge || '', gewicht: 100, haeufigkeit: 'aktuell auf der Liste' });
    }
    const oft = alleArtikel()
        .filter((stamm) => !ids.has(stamm.id) && (stamm.zaehler > 0 || stamm.standardWunsch))
        .sort((a, b) => (b.zaehler || 0) - (a.zaehler || 0));
    for (const stamm of oft.slice(0, Math.max(0, 30 - artikel.length))) {
        artikel.push({ id: stamm.id, name: stamm.name, wunsch: stamm.standardWunsch || '', gewicht: stamm.zaehler || 1, haeufigkeit: 'häufig gekauft' });
    }
    return alsAngebotsauftrag(persoenlichesAngebotsprofil({ region: ort(), maerkte: aktiveMaerkte(), artikel }));
}

export async function rechercheAuftragKopieren() {
    if (aktiveMaerkte().length === 0) {
        melde(t('angebote.keineMaerkte'));
        return false;
    }
    await kopiereText(
        persoenlicherAuftragAlsText(),
        t('angebote.auftragKopiert'),
        t('angebote.auftragTitel')
    );
    return true;
}

async function ergebnisUebernehmen(daten) {
    if (!pruefeAngebotsergebnis(daten, maerkte()).gueltig) {
        melde(t('angebote.ergebnisUngueltig'));
        return false;
    }
    await angebotsergebnisSetzen(daten);
    await angebotseinfuehrungAbschliessen();
    melde(t('angebote.ergebnisUebernommen', gruppiereAngebote(aktiveAngebote(daten, new Date(), maerkte())).length));
    return true;
}

export function ergebnisEinfuegen() {
    const feld = document.createElement('textarea');
    feld.className = 'dialog-text angebote-eingabe';
    feld.rows = 12;
    feld.placeholder = t('angebote.ergebnisPlatzhalter');
    feld.setAttribute('aria-label', t('angebote.ergebnisBeschriftung'));

    zeigeDialog({
        titel: t('angebote.ergebnisTitel'),
        /* Dieser Dialog existiert, um etwas einzufügen. */
        fokus: true,
        koerper: [feld],
        knoepfe: [{
            text: t('angebote.uebernehmen'),
            betont: true,
            wirkung: async () => {
                try {
                    await ergebnisUebernehmen(JSON.parse(feld.value));
                } catch {
                    melde(t('angebote.ergebnisUngueltig'));
                }
            }
        }]
    });
}

export function ergebnisdateiEinlesen() {
    const feld = document.createElement('input');
    feld.type = 'file';
    feld.accept = 'application/json,.json';
    feld.hidden = true;
    document.body.append(feld);

    feld.addEventListener('change', async () => {
        const datei = feld.files?.[0];
        feld.remove();
        if (!datei) return;
        if (datei.size > MAX_DATEIGROESSE) {
            melde(t('angebote.ergebnisZuGross'));
            return;
        }
        try {
            await ergebnisUebernehmen(JSON.parse(await datei.text()));
        } catch {
            melde(t('angebote.ergebnisUngueltig'));
        }
    });

    feld.click();
}

export function aktuelleAngebote() {
    return aktiveAngebote(angebotsergebnis(), new Date(), maerkte());
}

function absatz(text, klasse = '') {
    const element = document.createElement('p');
    if (klasse) element.className = klasse;
    element.textContent = text;
    return element;
}

function aktionsknopf(text, wirkung, betont = false) {
    const element = document.createElement('button');
    element.type = 'button';
    element.textContent = text;
    element.className = `angebote-hilfe-aktion${betont ? ' primary' : ''}`;
    element.addEventListener('click', wirkung);
    return element;
}

function externerLink(text, href, klasse = '') {
    const link = document.createElement('a');
    link.textContent = text;
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.className = klasse;
    return link;
}

function schritt(zahl, titel, erklaerung, ...aktionen) {
    const element = document.createElement('section');
    element.className = 'angebote-hilfe-schritt';

    const kopf = document.createElement('div');
    kopf.className = 'angebote-hilfe-kopf';
    const nummer = document.createElement('span');
    nummer.className = 'angebote-hilfe-nummer';
    nummer.textContent = String(zahl);
    const ueberschrift = document.createElement('h3');
    ueberschrift.textContent = titel;
    kopf.append(nummer, ueberschrift);

    element.append(kopf, absatz(erklaerung, 'muted'));
    if (aktionen.length > 0) {
        const leiste = document.createElement('div');
        leiste.className = 'angebote-hilfe-aktionen';
        leiste.append(...aktionen);
        element.append(leiste);
    }
    return element;
}

function assistentenAuswahl() {
    const auswahl = document.createElement('div');
    auswahl.className = 'angebote-assistenten';

    const assistent = (name, beschreibung, oeffnen, hilfe) => {
        const karte = document.createElement('div');
        karte.className = 'angebote-assistent';
        const titel = document.createElement('strong');
        titel.textContent = name;
        const text = document.createElement('span');
        text.textContent = beschreibung;
        const links = document.createElement('div');
        links.append(
            externerLink(t('angebote.assistentOeffnen'), oeffnen),
            externerLink(t('angebote.anleitungOeffnen'), hilfe)
        );
        karte.append(titel, text, links);
        return karte;
    };

    auswahl.append(
        assistent(
            'Claude Cowork',
            t('angebote.claudeText'),
            'https://claude.ai/',
            'https://support.claude.com/en/articles/13854387-schedule-recurring-tasks-in-claude-cowork'
        ),
        assistent(
            'ChatGPT',
            t('angebote.chatgptText'),
            'https://chatgpt.com/',
            'https://help.openai.com/en/articles/10291617-scheduled-tasks-in-chatgpt'
        )
    );
    return auswahl;
}

/** Einmalige Schulung und später jederzeit über „So funktioniert's" erneut
 * erreichbar. Kein Link übergibt Daten automatisch; der Nutzer kopiert den
 * Auftrag bewusst selbst in den gewählten Assistenten. */
export function zeigeAngebotsEinfuehrung() {
    const assistenten = assistentenAuswahl();
    zeigeDialog({
        titel: t('angebote.hilfeTitel'),
        koerper: [
            absatz(t('angebote.hilfeIntro')),
            absatz(t('angebote.hilfeDatenschutz'), 'angebote-datenschutz'),
            schritt(
                1,
                t('angebote.schritt1Titel'),
                t('angebote.schritt1Text'),
                aktionsknopf(t('angebote.auftragKopieren'), rechercheAuftragKopieren, true)
            ),
            schritt(
                2,
                t('angebote.schritt2Titel'),
                t('angebote.schritt2Text'),
                assistenten
            ),
            schritt(
                3,
                t('angebote.schritt3Titel'),
                t('angebote.schritt3Text'),
                aktionsknopf(t('angebote.ergebnisEinfuegen'), ergebnisEinfuegen),
                aktionsknopf(t('angebote.ergebnisdatei'), ergebnisdateiEinlesen)
            )
        ],
        knoepfe: [{
            text: t('angebote.verstanden'),
            betont: true,
            wirkung: angebotseinfuehrungAbschliessen
        }]
    });
}
