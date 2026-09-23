/**
 * Warten, bis eine Bedingung **in der Seite** zutrifft.
 *
 * Warum nicht `page.waitForFunction()`: Mit einer `async`-Bedingung bekommt
 * es ein Promise-**Objekt** zurück, und ein Objekt ist immer „wahr". Die
 * Prüfung wartet dann überhaupt nicht, sondern läuft sofort weiter – und der
 * Lauf misst einen Zustand, den es noch gar nicht gibt.
 *
 * Genau das hat im Update-Lauf eine rote Prüfung erzeugt, die wie ein Fehler
 * der App aussah und einer der Prüfstrecke war: Die Fenster waren noch nicht
 * geschlossen, als schon geprüft wurde, ob der neue Service Worker
 * übernommen hat.
 *
 * `page.evaluate()` wartet ein Promise dagegen ordentlich ab. Deshalb hier
 * eine Schleife darum statt der eingebauten Hilfe.
 */
export async function warteBis(seite, bedingung, beschreibung, grenzeMs = 15000) {
    const ende = Date.now() + grenzeMs;
    let letzterFehler = null;
    while (Date.now() < ende) {
        try {
            if (await seite.evaluate(bedingung)) return;
        } catch (fehler) {
            /* Während eines Seitenwechsels kann die Auswertung kurz scheitern.
               Das ist kein Grund aufzugeben – nur einer, es gleich noch einmal
               zu versuchen und den Grund für den Abbruch zu behalten. */
            letzterFehler = fehler;
        }
        await new Promise((weiter) => setTimeout(weiter, 100));
    }
    throw new Error(
        `Zeitüberschreitung beim Warten auf: ${beschreibung}` +
        (letzterFehler ? ` (zuletzt: ${letzterFehler.message})` : '')
    );
}
