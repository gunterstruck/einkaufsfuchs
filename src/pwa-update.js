/**
 * Hält eine installierte oder lange geöffnete Foxi-PWA auf dem aktuellen
 * Stand. Die Einkaufsdaten liegen davon getrennt in IndexedDB und werden bei
 * einem Anwendungsneustart weder verändert noch gelöscht.
 *
 * Browser prüfen Service Worker zwar auch selbst, aber Zeitpunkt und
 * Häufigkeit unterscheiden sich deutlich. Foxi fragt deshalb zusätzlich:
 * sofort beim Start, nach der Rückkehr in die App und einmal pro Minute,
 * solange die App sichtbar ist.
 */

const PRUEFABSTAND_MS = 60 * 1000;
const RUECKKEHR_DROSSEL_MS = 15 * 1000;

let anmeldung = null;
let letzteRueckkehrpruefung = 0;
let neustartBegonnen = false;

async function pruefeAufUpdate() {
    if (!anmeldung || document.visibilityState === 'hidden') return;
    try {
        await anmeldung.update();
    } catch (fehler) {
        /* Offline ist im Supermarkt ein Normalzustand. Die App bleibt nutzbar
           und versucht es bei der nächsten Rückkehr erneut. */
        console.debug('[Foxi] Updateprüfung derzeit nicht möglich', fehler);
    }
}

function pruefeBeiRueckkehr() {
    const jetzt = Date.now();
    if (jetzt - letzteRueckkehrpruefung < RUECKKEHR_DROSSEL_MS) return;
    letzteRueckkehrpruefung = jetzt;
    void pruefeAufUpdate();
}

export function initPwaUpdate() {
    if (!('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return;

    let hatteController = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        /* Die erste Übernahme nach einer Neuinstallation ist kein Update. */
        if (!hatteController) {
            hatteController = true;
            return;
        }
        if (neustartBegonnen) return;
        neustartBegonnen = true;

        /* Reguläre Updates warten auf geschlossene Fenster. Falls ein Browser
           trotzdem den Controller wechselt, bleibt ein offener Editor erhalten. */
        const sicherNeuladen = () => {
            if (document.querySelector('.dialog-auflage') || document.activeElement?.matches('input, textarea, select')) {
                window.setTimeout(sicherNeuladen, 1000);
                return;
            }
            window.location.reload();
        };
        window.setTimeout(sicherNeuladen, 250);
    });

    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
            .then((registrierung) => {
                anmeldung = registrierung;
                void pruefeAufUpdate();

                window.setInterval(() => void pruefeAufUpdate(), PRUEFABSTAND_MS);
                window.addEventListener('focus', pruefeBeiRueckkehr);
                document.addEventListener('visibilitychange', () => {
                    if (document.visibilityState === 'visible') pruefeBeiRueckkehr();
                });
            })
            .catch((fehler) => {
                console.warn('[Foxi] Service Worker nicht registriert', fehler);
            });
    });
}
