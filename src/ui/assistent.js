import { t } from '../texte.js';
import { wiederkaufVorschlaege, gelernterLaufweg } from '../logik.js';
import { zustand, alleArtikel, aufListeSetzen, wiederkaufVerschieben, maerkte,
    einkaufStarten, einkaufBeenden, laufwegUebernehmen } from '../zustand.js';

function text(tag, inhalt) { const e = document.createElement(tag); e.textContent = inhalt; return e; }
function knopf(label, tun) {
    const b = text('button', label); b.type = 'button';
    b.addEventListener('click', async () => { b.disabled = true; try { await tun(); } finally { b.disabled = false; } });
    return b;
}

export function assistentZeichnen() {
    const block = document.createElement('div'); block.className = 'alltagsassistent';
    const vorschlaege = wiederkaufVorschlaege(alleArtikel(), zustand.liste, zustand.einstellungen.wiederkaufSpaeter);
    if (vorschlaege.length) {
        const details = document.createElement('details'); details.className = 'karte wiederkauf';
        details.append(text('summary', t('alltag.wiederTitel', vorschlaege.length)));
        for (const v of vorschlaege) {
            const zeile = document.createElement('div'); zeile.className = 'assistent-zeile';
            zeile.append(text('p', t('alltag.rhythmus', v.artikel.name, v.rhythmus, v.seit)),
                knopf(t('alltag.dazu', v.artikel.name), () => aufListeSetzen(v.artikel.id)),
                knopf(t('alltag.genug'), () => wiederkaufVerschieben(v.artikel.id, Math.max(2, Math.min(7, Math.round(v.rhythmus/2))))));
            details.append(zeile);
        }
        block.append(details);
    }
    const laeden = maerkte();
    if (!laeden.length) return block;
    const details = document.createElement('details'); details.className = 'karte laufweg';
    const laufend = zustand.einstellungen.laufenderEinkauf;
    details.open = Boolean(laufend);
    details.append(text('summary', t(laufend ? 'alltag.unterwegs' : 'alltag.ladenTitel')));
    if (laufend) {
        const laden = laeden.find(m => m.id === laufend.marktId);
        details.append(text('p', laden ? `${laden.haendler} · ${laden.markt}` : t('alltag.unbekannterLaden')),
            knopf(t('alltag.beenden'), einkaufBeenden));
    } else {
        const auswahl = document.createElement('select'); auswahl.setAttribute('aria-label', t('alltag.ladenTitel'));
        for (const laden of laeden) {
            const option = text('option', `${laden.haendler} · ${laden.markt}`); option.value = laden.id; auswahl.append(option);
        }
        details.append(auswahl, text('p', t('alltag.lernenErklaerung')),
            knopf(t('alltag.starten'), () => einkaufStarten(auswahl.value)));
    }
    for (const laden of laeden) {
        const stand = zustand.einstellungen.laufwege?.[laden.id];
        const vorschlag = gelernterLaufweg(stand?.einkaeufe, zustand.kategorien);
        if (!vorschlag || JSON.stringify(vorschlag) === JSON.stringify(stand?.reihenfolge)) continue;
        const namen = vorschlag.map(id => zustand.kategorien.find(k => k.id === id)?.name).filter(Boolean);
        details.append(text('p', t('alltag.laufwegVorschlag', `${laden.haendler} · ${laden.markt}`)),
            text('p', namen.join(' → ')),
            knopf(t('alltag.laufwegMerken'), () => laufwegUebernehmen(laden.id, vorschlag)));
    }
    block.append(details);
    return block;
}
