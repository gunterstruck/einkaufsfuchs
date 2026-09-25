/**
 * IndexedDB – der einzige Ort, an dem Foxi etwas ablegt.
 *
 * Kein localStorage: Der Katalog ist rund 40 KB und wächst mit jeder
 * Kaufhistorie; localStorage ist dafür zu klein und blockiert außerdem den
 * Hauptfaden. Kein Server: siehe README.
 *
 * Die Zugriffe sind bewusst schlicht gehalten – `getAll`, `put`, `delete` –,
 * weil WebKit bei allem Ausgefalleneren (Cursor über Indizes in
 * verschachtelten Transaktionen) über die Jahre am meisten Eigenheiten
 * gezeigt hat.
 */

/* Der Datenbankname bleibt `foxi`, obwohl die App inzwischen
   EinkaufsFuchs heißt. Ein neuer Name wäre eine neue, leere Datenbank –
   jede bestehende Installation verlöre Liste, Kaufhistorie und eigene
   Artikel, ohne dass ein Mensch das je gewollt hätte. Ein Bezeichner ist
   kein Schaufenster: Er darf alt aussehen, solange er stimmt. */
export const DB_NAME = 'foxi';
export const DB_VERSION = 2;

export const SPEICHER = {
    ARTIKEL: 'artikel',
    LISTE: 'liste',
    KATEGORIEN: 'kategorien',
    REZEPTE: 'rezepte',
    EINSTELLUNGEN: 'einstellungen',
    BILDER: 'bilder'
};

let verbindung = null;
let verbindungLaeuft = null;

export function oeffne() {
    if (verbindung) return Promise.resolve(verbindung);
    /* Mehrere gleichzeitige Erstaufrufe teilen sich eine Anfrage. Ohne das
       öffnete jeder seine eigene Verbindung; alle bis auf die zuletzt
       zugewiesene blieben offen, ohne dass sie noch jemand schließen könnte –
       und eine offene Verbindung blockiert jedes spätere Upgrade und das
       Löschen der Datenbank. */
    if (verbindungLaeuft) return verbindungLaeuft;
    const laufend = new Promise((erfuellen, ablehnen) => {
        const anfrage = indexedDB.open(DB_NAME, DB_VERSION);
        anfrage.onupgradeneeded = () => {
            const db = anfrage.result;
            if (!db.objectStoreNames.contains(SPEICHER.ARTIKEL)) {
                db.createObjectStore(SPEICHER.ARTIKEL, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(SPEICHER.LISTE)) {
                db.createObjectStore(SPEICHER.LISTE, { keyPath: 'artikelId' });
            }
            if (!db.objectStoreNames.contains(SPEICHER.KATEGORIEN)) {
                db.createObjectStore(SPEICHER.KATEGORIEN, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(SPEICHER.REZEPTE)) {
                db.createObjectStore(SPEICHER.REZEPTE, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(SPEICHER.EINSTELLUNGEN)) {
                db.createObjectStore(SPEICHER.EINSTELLUNGEN, { keyPath: 'schluessel' });
            }
            if (!db.objectStoreNames.contains(SPEICHER.BILDER)) {
                db.createObjectStore(SPEICHER.BILDER, { keyPath: 'artikelId' });
            }
        };
        anfrage.onsuccess = () => {
            verbindung = anfrage.result;
            /* Ein zweiter Tab, der eine neuere Fassung öffnen will, hängt sonst
               ewig an dieser Verbindung fest. */
            verbindung.onversionchange = () => { verbindung.close(); verbindung = null; };
            /* Schließt der Browser die Verbindung von sich aus – Speicherdruck
               oder „Websitedaten löschen“ in einem anderen Tab –, muss der
               nächste Zugriff neu öffnen. Ohne das bliebe hier ein toter Griff
               stehen, an dem jedes weitere Schreiben scheitert, bis jemand die
               Seite neu lädt. */
            verbindung.onclose = () => { verbindung = null; };
            erfuellen(verbindung);
        };
        anfrage.onerror = () => ablehnen(anfrage.error);
        anfrage.onblocked = () => ablehnen(new Error('Datenbank durch ein anderes Fenster blockiert'));
    });
    /* Der Platzhalter gilt nur, solange geöffnet wird – danach übernimmt
       wieder `verbindung`, und ein Fehlschlag darf den nächsten Versuch nicht
       blockieren. */
    const aufraeumen = () => { if (verbindungLaeuft === laufend) verbindungLaeuft = null; };
    laufend.then(aufraeumen, aufraeumen);
    verbindungLaeuft = laufend;
    return laufend;
}

async function transaktion(speicher, modus, arbeit) {
    const db = await oeffne();
    return new Promise((erfuellen, ablehnen) => {
        const tx = db.transaction(speicher, modus);
        let ergebnis;
        tx.oncomplete = () => erfuellen(ergebnis);
        tx.onerror = () => ablehnen(tx.error);
        tx.onabort = () => ablehnen(tx.error || new Error('Transaktion abgebrochen'));
        try { ergebnis = arbeit(tx); }
        catch (fehler) { tx.abort(); ablehnen(fehler); }
    });
}

function alsVersprechen(anfrage) {
    return new Promise((erfuellen, ablehnen) => {
        anfrage.onsuccess = () => erfuellen(anfrage.result);
        anfrage.onerror = () => ablehnen(anfrage.error);
    });
}

export async function alle(speicher) {
    const db = await oeffne();
    return alsVersprechen(db.transaction(speicher, 'readonly').objectStore(speicher).getAll());
}

export async function hole(speicher, schluessel) {
    const db = await oeffne();
    return alsVersprechen(db.transaction(speicher, 'readonly').objectStore(speicher).get(schluessel));
}

/** Mehrere Speicher werden gemeinsam bestätigt oder vollständig zurückgerollt. */
export function atomar(sammlungen, loeschungen = {}) {
    const namen = [...new Set([...Object.keys(sammlungen), ...Object.keys(loeschungen)])];
    return transaktion(namen, 'readwrite', tx => {
        for (const [name, werte] of Object.entries(sammlungen)) {
            for (const wert of werte) tx.objectStore(name).put(wert);
        }
        for (const [name, ids] of Object.entries(loeschungen)) {
            for (const id of ids) tx.objectStore(name).delete(id);
        }
    });
}

export function lege(speicher, wert) {
    return transaktion(speicher, 'readwrite', (tx) => { tx.objectStore(speicher).put(wert); });
}

export function legeViele(speicher, werte) {
    return transaktion(speicher, 'readwrite', (tx) => {
        const store = tx.objectStore(speicher);
        for (const wert of werte) store.put(wert);
    });
}

export function loesche(speicher, schluessel) {
    return transaktion(speicher, 'readwrite', (tx) => { tx.objectStore(speicher).delete(schluessel); });
}

export function leere(speicher) {
    return transaktion(speicher, 'readwrite', (tx) => { tx.objectStore(speicher).clear(); });
}

/** Nur für „Foxi zurücksetzen". Löscht die Datenbank vollständig. */
export function loescheDatenbank() {
    if (verbindung) { verbindung.close(); verbindung = null; }
    verbindungLaeuft = null;
    return new Promise((erfuellen, ablehnen) => {
        const anfrage = indexedDB.deleteDatabase(DB_NAME);
        anfrage.onsuccess = () => erfuellen();
        anfrage.onerror = () => ablehnen(anfrage.error);
        anfrage.onblocked = () => ablehnen(new Error('Datenbank durch ein anderes Fenster blockiert'));
    });
}

/** Konsistentes Abbild aller Speicher in genau einer Lesetransaktion. */
export async function sicherungLesen() {
    const db = await oeffne();
    return new Promise((resolve,reject) => {
        const tx = db.transaction(Object.values(SPEICHER), 'readonly');
        const daten = {};
        for (const name of Object.values(SPEICHER)) {
            const request = tx.objectStore(name).getAll();
            request.onsuccess = () => { daten[name] = request.result; };
        }
        tx.oncomplete = () => resolve({ typ: 'foxi-sicherung', version: 1, erzeugt: new Date().toISOString(), daten });
        tx.onabort = tx.onerror = () => reject(tx.error);
    });
}

export function sicherungErsetzen(daten) {
    return transaktion(Object.values(SPEICHER), 'readwrite', tx => {
        for (const name of Object.values(SPEICHER)) {
            const store = tx.objectStore(name); store.clear();
            for (const eintrag of daten[name]) store.put(eintrag);
        }
    });
}
