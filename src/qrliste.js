/**
 * Die Einkaufsliste als QR-Code – Format, Verpackung und Prüfung.
 *
 * Der Weg ist Bildschirm → Kamera, ohne Netz, ohne Datei, ohne Server: Das
 * eine Gerät zeigt einen QR-Code, das andere hält seine gewöhnliche
 * Kamera-App darauf. Darin steckt eine Adresse mit den Daten **hinter dem
 * Rautezeichen** – und der Teil einer Adresse hinter der Raute wird von
 * keinem Browser zu irgendeinem Server geschickt. Grundsatz I bleibt heil.
 *
 * Warum kein eigener Scanner in Foxi: iPhone und Android erkennen QR-Codes
 * in ihrer Kamera von Haus aus. Ein eingebauter Scanner bräuchte eine
 * Kameraberechtigung, eine Bilderkennung und auf iOS die installierte App –
 * für dieselbe Handlung.
 *
 * Was NICHT mitfährt, und warum:
 *
 * - **Fotos.** Ein Produktfoto ist bis 900 KB groß, ein QR-Code fasst 2,9 KB.
 *   Das sind drei Größenordnungen; es ist keine Abwägung, sondern Arithmetik.
 * - **Kaufhistorie und gelernte Mengen.** Dieselbe Regel wie beim Teilen als
 *   Datei: Wer eine Liste weitergibt, gibt nicht mit, wie oft er Bier kauft.
 * - **Ort, Märkte, Angebotsergebnis.** Persönlich, gehört nicht in eine
 *   geteilte Liste.
 *
 * Und: Was hereinkommt, ist fremd. Eine Adresse kann aus jeder Quelle
 * stammen, nicht nur vom eigenen Bildschirm – deshalb prüft
 * `pruefeQrListe()` streng, und übernommen wird erst nach dem
 * Zusammenführungs-Dialog.
 */

/* Die Kennung bleibt, wie sie ist – sie steht in jedem erzeugten Code. Eine
   neue Kennung ließe Foxi seine eigenen älteren Codes abweisen. */
import { gueltigeTeilmarke } from './logik.js';

export const QR_TYP = 'foxi-qr';
export const QR_VERSION = 1;
/**
 * Zwei Schlüssel, ein Format: `lz` ist gepackt, `l` ist es nicht.
 *
 * Gepackt wird, weil JSON sich hervorragend packen lässt – dieselben kurzen
 * Schlüssel stehen in jeder Zeile. Gemessen an einer Liste mit 25 Artikeln:
 * ungepackt passt sie in **keinen** QR-Code, gepackt in einen mittleren.
 * Das ist der Unterschied zwischen „funktioniert für einen Wocheneinkauf"
 * und „funktioniert für zehn Artikel".
 *
 * Der ungepackte Weg bleibt, weil `CompressionStream` erst ab Safari 16.4
 * da ist. Ein älteres Gerät erzeugt dann einen dichteren Code für eine
 * kürzere Liste – und kann jeden gepackten trotzdem lesen, solange es
 * `DecompressionStream` hat. Hat es das nicht, sagt Foxi das auch.
 */
export const QR_SCHLUESSEL = 'l';          // …/#l=<base64url>
export const QR_SCHLUESSEL_GEPACKT = 'lz'; // …/#lz=<base64url(deflate-raw)>

export const QR_GRENZEN = Object.freeze({
    artikelAnzahl: 150,
    id: 200,
    name: 300,
    kategorieId: 200,
    icon: 64,
    menge: 500,
    /* Rohe Obergrenze für eingehende Daten, bevor überhaupt entpackt wird.
       Ein QR-Code fasst nie so viel; die Schranke gilt einer Adresse, die
       jemand von Hand zusammengebaut hat. */
    zeichen: 8000,
    /* Und eine zweite danach: Gepackte Daten können sich beim Entpacken
       vervielfachen. Eine Einkaufsliste braucht keine 200 000 Zeichen. */
    entpackt: 200000
});

/* ────────────────────────────────────────────────────────────────────────
   base64url – ohne Abhängigkeit, umlautfest

   Warum nicht einfach `encodeURIComponent(JSON)`: Jedes Anführungszeichen
   würde zu `%22`, drei Zeichen statt einem. base64url kostet ein Drittel
   Aufschlag und kennt dafür kein einziges Zeichen, das eine Adresse
   maskieren müsste.
   ──────────────────────────────────────────────────────────────────────── */

export function nachBase64Url(text) {
    const bytes = new TextEncoder().encode(text);
    let roh = '';
    for (const b of bytes) roh += String.fromCharCode(b);
    return btoa(roh).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function ausBase64Url(text) {
    const roh = atob(String(text).replace(/-/g, '+').replace(/_/g, '/'));
    return new TextDecoder().decode(Uint8Array.from(roh, (z) => z.charCodeAt(0)));
}

function bytesNachBase64Url(bytes) {
    let roh = '';
    for (const b of bytes) roh += String.fromCharCode(b);
    return btoa(roh).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlNachBytes(text) {
    const roh = atob(String(text).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(roh, (z) => z.charCodeAt(0));
}

async function durchStrom(bytes, strom) {
    const antwort = new Response(new Blob([bytes]).stream().pipeThrough(strom));
    return new Uint8Array(await antwort.arrayBuffer());
}

/** Packen, wenn der Browser es kann. Sonst unverändert zurück. */
export async function packe(text) {
    if (typeof CompressionStream !== 'function') return null;
    try {
        const bytes = new TextEncoder().encode(text);
        return bytesNachBase64Url(await durchStrom(bytes, new CompressionStream('deflate-raw')));
    } catch {
        return null;
    }
}

/** Entpacken. Gibt `null` zurück, wenn es nicht geht – der Grund steht dann
 *  in der Prüfung, nicht in einer Ausnahme. */
export async function entpacke(anteil) {
    if (typeof DecompressionStream !== 'function') return null;
    try {
        const bytes = base64UrlNachBytes(anteil);
        const roh = await durchStrom(bytes, new DecompressionStream('deflate-raw'));
        if (roh.length > QR_GRENZEN.entpackt) return null;
        return new TextDecoder().decode(roh);
    } catch {
        return null;
    }
}

/* ────────────────────────────────────────────────────────────────────────
   Packen
   ──────────────────────────────────────────────────────────────────────── */

/**
 * Die offenen Einträge als Nutzlast.
 *
 * Kurze Schlüssel, weil jedes Byte eine dichtere Kachelwand bedeutet:
 * `i` Kennung, `b` Bezeichnung, `m` Menge, `k` Kategorie, `s` Symbol.
 *
 * Die **Bezeichnung fährt immer mit**, obwohl beide Geräte denselben Katalog
 * mitbringen und die Kennung genügen würde. Sie kostet rund ein Drittel der
 * Nutzlast und eine QR-Version – und rettet den Fall, dass das andere Gerät
 * einen älteren Katalogstand hat. Ohne sie wäre eine unbekannte Kennung
 * stiller Datenverlust: ein Artikel, der einfach fehlt.
 *
 * Kategorie und Symbol dagegen fahren **nur bei selbst angelegten Artikeln**
 * mit. Für Katalogartikel stehen sie auf dem anderen Gerät ohnehin.
 */
export function alsQrNutzlast(eintraege, artikelNachId, teil = 1, gesamt = 1) {
    const artikel = [];
    for (const eintrag of eintraege) {
        const stamm = artikelNachId.get(eintrag.artikelId);
        if (!stamm) continue;
        const satz = { i: stamm.id, b: stamm.name };
        const menge = String(eintrag.menge || '').trim();
        if (menge) satz.m = menge;
        if (stamm.eigen) {
            satz.k = stamm.kategorieId || 'sonstiges';
            satz.s = stamm.icon || '🛒';
        }
        artikel.push(satz);
    }
    return { t: QR_TYP, v: QR_VERSION, n: teil, g: gesamt, a: artikel };
}

/**
 * Die vollständige Adresse, die im QR-Code steht.
 *
 * Der Ursprung kommt aus dem laufenden Fenster und wird nicht fest
 * verdrahtet: Sonst zeigte jeder gedruckte Code nach einem Umzug der App auf
 * eine tote Adresse.
 */
export async function qrAdresse(nutzlast, ursprung) {
    const text = JSON.stringify(nutzlast);
    const gepackt = await packe(text);
    return gepackt
        ? `${ursprung}#${QR_SCHLUESSEL_GEPACKT}=${gepackt}`
        : `${ursprung}#${QR_SCHLUESSEL}=${nachBase64Url(text)}`;
}

/** Der Teil der laufenden Adresse, auf den ein QR-Code zeigen soll. */
export function eigenerUrsprung(ort = window.location) {
    return `${ort.origin}${ort.pathname}`;
}

/* ────────────────────────────────────────────────────────────────────────
   Auspacken und prüfen
   ──────────────────────────────────────────────────────────────────────── */

const istText = (wert, grenze) => typeof wert === 'string' && wert.length <= grenze;

/**
 * Steckt in dieser Adresse eine Foxi-Liste? Gibt den rohen Anteil zurück
 * oder `null` – ohne ihn schon zu deuten.
 */
export function qrAnteilAusAdresse(anker) {
    const roh = String(anker || '').replace(/^#/, '');
    if (!roh) return null;
    for (const stueck of roh.split('&')) {
        const trenner = stueck.indexOf('=');
        if (trenner < 0) continue;
        const schluessel = stueck.slice(0, trenner);
        if (schluessel !== QR_SCHLUESSEL && schluessel !== QR_SCHLUESSEL_GEPACKT) continue;
        const wert = stueck.slice(trenner + 1);
        if (wert.length > QR_GRENZEN.zeichen) return null;
        return { schluessel, wert, gepackt: schluessel === QR_SCHLUESSEL_GEPACKT };
    }
    return null;
}

/**
 * Aus dem Anteil eine geprüfte Liste machen.
 *
 * Gibt `{ gueltig, grund, daten }` zurück statt zu werfen – „ungültig" allein
 * hilft niemandem weiter, und der Grund steht später im Hinweis.
 */
export async function pruefeQrListe(anteil) {
    const roh = typeof anteil === 'string' ? { wert: anteil, gepackt: false } : anteil;
    if (!roh || typeof roh.wert !== 'string') {
        return { gueltig: false, grund: 'kaputt', daten: null };
    }

    let text;
    if (roh.gepackt) {
        text = await entpacke(roh.wert);
        /* Kein `DecompressionStream`: Das Gerät ist zu alt für gepackte
           Codes. Das ist etwas anderes als ein kaputter Code, und der
           Hinweis soll es auch sagen. */
        if (text === null) {
            return {
                gueltig: false,
                grund: typeof DecompressionStream === 'function' ? 'kaputt' : 'zuAlt',
                daten: null
            };
        }
    } else {
        try {
            text = ausBase64Url(roh.wert);
        } catch {
            return { gueltig: false, grund: 'kaputt', daten: null };
        }
    }

    let daten;
    try {
        daten = JSON.parse(text);
    } catch {
        return { gueltig: false, grund: 'kaputt', daten: null };
    }
    if (!daten || typeof daten !== 'object' || Array.isArray(daten)) {
        return { gueltig: false, grund: 'kaputt', daten: null };
    }
    if (daten.t !== QR_TYP) return { gueltig: false, grund: 'fremd', daten: null };
    if (!Number.isInteger(daten.v) || daten.v < 1) {
        return { gueltig: false, grund: 'kaputt', daten: null };
    }
    if (daten.v > QR_VERSION) return { gueltig: false, grund: 'zuNeu', daten: null };

    /* Teil und Gesamtzahl: Heute erzeugt Foxi immer 1 von 1. Die Marke steht
       trotzdem im Format, damit zwei Codes später ohne Formatbruch möglich
       sind – dieselbe Lehre wie bei der Dateikennung. */
    const gesamt = daten.g === undefined ? 1 : daten.g;
    const teil = daten.n === undefined ? 1 : daten.n;
    if (!Number.isInteger(gesamt) || !Number.isInteger(teil) ||
        gesamt < 1 || teil < 1 || teil > gesamt) {
        return { gueltig: false, grund: 'kaputt', daten: null };
    }
    if (gesamt > 1) return { gueltig: false, grund: 'mehrteilig', daten: null };

    if (!Array.isArray(daten.a) || daten.a.length > QR_GRENZEN.artikelAnzahl) {
        return { gueltig: false, grund: 'kaputt', daten: null };
    }
    if (daten.x !== undefined && !gueltigeTeilmarke(daten.x)) return { gueltig: false, grund: 'kaputt', daten: null };
    if (new Set(daten.a.map(a => a?.i)).size !== daten.a.length) return { gueltig: false, grund: 'kaputt', daten: null };
    const artikelGueltig = daten.a.every((satz) => {
        if (!satz || typeof satz !== 'object' || Array.isArray(satz)) return false;
        if (!istText(satz.i, QR_GRENZEN.id) || !satz.i.trim()) return false;
        if (!istText(satz.b, QR_GRENZEN.name) || !satz.b.trim()) return false;
        if (satz.m !== undefined && !istText(satz.m, QR_GRENZEN.menge)) return false;
        if (satz.k !== undefined && !istText(satz.k, QR_GRENZEN.kategorieId)) return false;
        if (satz.s !== undefined && !istText(satz.s, QR_GRENZEN.icon)) return false;
        return true;
    });
    if (!artikelGueltig) return { gueltig: false, grund: 'kaputt', daten: null };

    return { gueltig: true, grund: null, daten };
}

/**
 * Die geprüfte Nutzlast in die Form bringen, die der vorhandene
 * Zusammenführungs-Weg erwartet. Damit teilen Datei-Import und QR-Import
 * denselben Dialog, dieselbe Vergleichslogik und dieselbe Übernahme – der
 * QR-Code ist nur ein anderer Transportweg, keine zweite Wahrheit.
 */
export function alsImportartikel(daten) {
    return daten.a.map((satz) => ({
        id: satz.i,
        name: satz.b,
        kategorieId: satz.k || '',
        kategorieName: '',
        icon: satz.s || '',
        menge: satz.m || '',
        notiz: ''
    }));
}
