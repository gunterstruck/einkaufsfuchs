/**
 * Die Prüfstrecke: fährt Foxi in einem echten Browser durch und prüft die
 * Abnahmekriterien, die man nicht mit Unit-Tests erreicht.
 *
 *   1. Von „App geöffnet" bis „erster Artikel auf der Liste" sind es
 *      höchstens zwei Tipps.
 *   2. Im Netzwerk-Tab steht im Normalbetrieb keine fremde Adresse.
 *   3. Nach zehn simulierten Einkäufen stehen die häufigsten Artikel oben
 *      im Katalog.
 *
 * Nebenbei entstehen die Bilder in `docs/bilder/`. Der Lauf endet mit
 * Rückgabewert 1, wenn eine Prüfung fällt – damit taugt er als Tor.
 *
 *   npm i --no-save playwright && npx playwright install chromium
 *   node tools/durchlauf.mjs
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium, devices } from 'playwright';

const hier = dirname(fileURLToPath(import.meta.url));
const wurzel = join(hier, '..');
const bilder = join(wurzel, 'docs', 'bilder');
const HAFEN = Number(process.env.PORT || 8123);
const ADRESSE = `http://localhost:${HAFEN}/`;

mkdirSync(bilder, { recursive: true });

const befunde = [];
function pruefe(bedingung, satz) {
    befunde.push({ gut: Boolean(bedingung), satz });
    console.log(`${bedingung ? '✓' : '✗'} ${satz}`);
}

const server = spawn(process.execPath, [join(hier, 'server.mjs')], {
    env: { ...process.env, PORT: String(HAFEN) },
    stdio: 'ignore'
});
process.on('exit', () => server.kill());

/* Kurz warten, bis der Server steht – ohne feste Pause, sondern indem man
   fragt. */
for (let versuch = 0; versuch < 50; versuch++) {
    try { await fetch(ADRESSE); break; } catch { await new Promise((r) => setTimeout(r, 100)); }
}

const browser = await chromium.launch(
    process.env.FOXI_CHROMIUM ? { executablePath: process.env.FOXI_CHROMIUM } : {}
);
const kontext = await browser.newContext({
    ...devices['iPhone 13'],
    isMobile: true,
    hasTouch: true,
    /* Für die Prüfung des Briefing-Exports: Ohne diese Rechte wirft
       `navigator.clipboard.writeText` im Kopflosen, und die Ersatzkette
       verdeckte, ob der Text überhaupt stimmt. */
    permissions: ['clipboard-read', 'clipboard-write']
});
const seite = await kontext.newPage();

/* Jede Anfrage mitschreiben. Erwartet werden ausschließlich Adressen der
   eigenen Herkunft. */
const fremdeAnfragen = [];
seite.on('request', (anfrage) => {
    if (!anfrage.url().startsWith(ADRESSE.slice(0, -1))) fremdeAnfragen.push(anfrage.url());
});

/* Der Entwicklungsserver schickt dieselbe Content-Security-Policy wie die
   Auslieferung. Ein Verstoß landet als Konsolenfehler – hier eingesammelt,
   damit er den Lauf durchfallen lässt statt erst im Betrieb aufzufallen. */
const fehlerAufDerSeite = [];
seite.on('console', (nachricht) => {
    if (nachricht.type() === 'error') fehlerAufDerSeite.push(nachricht.text());
});
seite.on('pageerror', (fehler) => fehlerAufDerSeite.push(String(fehler)));

await seite.goto(ADRESSE, { waitUntil: 'networkidle' });
await seite.waitForSelector('.leer');

pruefe(await seite.locator('.leer h2').isVisible(), 'Erststart zeigt den leeren Zustand');

/* Die zwei Namen: Auf dem Handy die Kurzform, und der Kopf darf dabei nicht
   überlaufen – er teilt sich die Zeile mit dem Tiefenschalter. */
pruefe(await seite.locator('.brand-kurz').isVisible() && !(await seite.locator('.brand-lang').isVisible()),
    'Auf dem Handy steht „Foxi" in der Kopfzeile');
const kopfPasst = await seite.evaluate(() => {
    const leiste = document.querySelector('.topbar');
    return leiste.scrollWidth <= leiste.clientWidth + 1;
});
pruefe(kopfPasst, 'Die Kopfzeile läuft nicht über');
const navigationPasst = await seite.evaluate(() => {
    const leiste = document.querySelector('.tableiste')?.getBoundingClientRect();
    const buehne = document.querySelector('#buehne')?.getBoundingClientRect();
    return Boolean(leiste && buehne && leiste.height >= 56 &&
        leiste.top >= buehne.bottom - 1 && leiste.bottom <= innerHeight + 1);
});
pruefe(navigationPasst, 'Die drei unteren Reiter bleiben vollständig im Smartphone-Fenster');

const familienDesign = await seite.evaluate(async () => {
    const manifest = await fetch('manifest.webmanifest').then((antwort) => antwort.json());
    const anmeldung = await navigator.serviceWorker.ready;
    const klassisch = await fetch('favicon.ico', { cache: 'no-store' });
    const pngFallback = await fetch(
        document.querySelector('link[rel="icon"][type="image/png"]')?.href,
        { cache: 'no-store' }
    );
    return {
        leitton: getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim(),
        theme: document.querySelector('meta[name="theme-color"]')?.getAttribute('content'),
        icon: document.querySelector('.brand-icon')?.getAttribute('src') || '',
        manifestTheme: manifest.theme_color,
        updateOhneCache: anmeldung.updateViaCache,
        klassisch: { status: klassisch.status, typ: klassisch.headers.get('content-type') },
        pngFallback: { status: pngFallback.status, typ: pngFallback.headers.get('content-type') }
    };
});
pruefe(familienDesign.leitton === '#0d9488', 'Foxi verwendet exakt den Leitton der Fuchs-Familie');
pruefe(familienDesign.theme === '#0d9488' && familienDesign.manifestTheme === '#0d9488',
    'Browserleiste und Manifest verwenden denselben Leitton');
pruefe(familienDesign.icon.includes('icons/foxi.svg?v='),
    'Im Kopf steht das gespeicherte Foxi-Zeichen statt eines fremden Emoji');
pruefe(familienDesign.klassisch.status === 200 &&
    familienDesign.klassisch.typ === 'image/x-icon' &&
    familienDesign.pngFallback.status === 200 &&
    familienDesign.pngFallback.typ === 'image/png',
    'Klassische Dashboard-Crawler erhalten ICO- und PNG-Favicons');
pruefe(familienDesign.updateOhneCache === 'none',
    'Der Browser prüft den Service Worker ohne einen alten HTTP-Zwischenspeicher');
await seite.screenshot({ path: join(bilder, '01-liste-leer.png') });

/* ── Zwei Tipps ─────────────────────────────────────────────────────────── */
await seite.locator('#tab-katalog').tap();                       // Tipp 1
await seite.waitForSelector('.kachel');
await seite.screenshot({ path: join(bilder, '02-katalog.png') });

await seite.locator('.kachel').first().tap();                    // Tipp 2
/* Auf die Zahl am Reiter warten, nicht auf die grüne Kachel: Die Kachel
   färbt sich absichtlich sofort um, noch bevor der Zustand geschrieben ist
   (siehe `kachel()` in ui/katalog.js). Wer auf sie wartet, misst den
   Lidschlag davor – der Zähler stand dann gemessen noch auf 0. */
await seite.waitForSelector('#tab-liste-zahl:not([hidden])');
const nachZweiTipps = await seite.locator('#tab-liste-zahl').textContent();
pruefe(nachZweiTipps === '1', `Zwei Tipps genügen für den ersten Artikel (Zähler: ${nachZweiTipps})`);

/* ── Ein Einkauf mit mehreren Artikeln ──────────────────────────────────── */
const wunschzettel = ['Milch', 'Brot', 'Butter', 'Äpfel', 'Kaffee', 'Eier', 'Bananen', 'Nudeln'];
for (const name of wunschzettel) {
    await seite.locator('#katalog-suche').fill(name);
    const treffer = seite.locator('.kachel').first();
    if (await treffer.count()) {
        const schonDrauf = await treffer.evaluate((el) => el.classList.contains('ist-drauf'));
        if (!schonDrauf) await treffer.tap();
    }
}
await seite.locator('#katalog-suche').fill('');
await seite.locator('#tab-liste').tap();
await seite.waitForSelector('.listenkarte');
await seite.screenshot({ path: join(bilder, '03-liste-gefuellt.png') });

/* Auf `#bereich-liste` eingeschränkt: Der Katalog ist nur `hidden`, seine
   Gruppenköpfe stehen weiter im Dokument und würden mitgezählt. */
const gruppen = await seite.locator('#bereich-liste .gruppe-kopf').count();
pruefe(gruppen >= 2, `Die Liste gruppiert nach Kategorie (${gruppen} Gruppen)`);

/* ── Abhaken ────────────────────────────────────────────────────────────── */
await seite.locator('.listenkarte').first().tap();
await seite.waitForSelector('.erledigt-block');
pruefe(await seite.locator('.listenkarte.ist-erledigt').count() > 0, 'Ein Tipp hakt ab');
await seite.screenshot({ path: join(bilder, '04-abgehakt.png') });

/* ── Experte ────────────────────────────────────────────────────────────── */
await seite.locator('#modus-schalter .seg[data-modus="experte"]').tap();
await seite.waitForSelector('.karte-stift');
pruefe(await seite.locator('.karte-stift').first().isVisible(), 'Experte zeigt den dauerhaften Produktwunsch');
/* Das Artikelblatt hängt am Knopf NEBEN der Zeile. Die Karte selbst bleibt
   ungeteilt das Ziel zum Abhaken – geprüft ein paar Zeilen weiter unten. */
await seite.locator('.karte-stift').first().tap();
await seite.waitForSelector('.dialog .mengen-editor');
pruefe(await seite.locator('.dialog-titel').isVisible(),
    'Der Knopf neben der Zeile öffnet das Artikelblatt');

/* Das Blatt darf nicht von selbst ins Eingabefeld springen. Auf iOS zieht
   das die Bildschirmtastatur hoch: Sie verdeckt die Angebote, und sie
   verschiebt den sichtbaren Ausschnitt – der danach manchmal oben stehen
   bleibt und die untere Leiste mitnimmt. Der Fokus geht trotzdem in den
   Dialog, sonst liefe die Tastaturbedienung hinter der Auflage weiter. */
await seite.waitForTimeout(80);
const fokusImBlatt = await seite.evaluate(() => ({
    marke: document.activeElement?.tagName || '',
    imDialog: document.querySelector('.dialog')?.contains(document.activeElement) === true,
    istDialog: document.activeElement?.classList.contains('dialog') === true
}));
pruefe(fokusImBlatt.marke !== 'INPUT' && fokusImBlatt.marke !== 'TEXTAREA',
    `Das Blatt öffnet keine Tastatur (Fokus: ${fokusImBlatt.marke || 'nichts'})`);
pruefe(fokusImBlatt.imDialog || fokusImBlatt.istDialog,
    'Der Fokus steht trotzdem im Dialog');

/* Die zweite Hälfte desselben Problems: Unter 16 px zoomt iOS beim
   Hineintippen die Seite heran und nicht zuverlässig wieder heraus – danach
   steht die untere Leiste außerhalb des Ausschnitts. Geprüft wird hier alles,
   was gerade im Dokument steht: das Feld im Blatt und die Katalogsuche. */
const zuKleineFelder = await seite.evaluate(() => [...document.querySelectorAll(
    'input:not([type="checkbox"]):not([type="range"]):not([type="file"]), textarea, select'
)].map((el) => ({
    was: el.id || el.className || el.tagName,
    groesse: Math.round(parseFloat(getComputedStyle(el).fontSize) * 10) / 10
})).filter((feld) => feld.groesse < 16));
pruefe(zuKleineFelder.length === 0,
    `Kein Eingabefeld unter 16 px${zuKleineFelder.length ? `: ${zuKleineFelder.map((f) => `${f.was} ${f.groesse}px`).join(', ')}` : ''}`);

/* Abbrechen darf nichts ändern: Das Blatt zeigt an, es speichert nicht. */
await seite.locator('.dialog input[type="text"]').fill('wird verworfen');
await seite.locator('.dialog-abbruch').tap();
await seite.waitForTimeout(200);
pruefe(await seite.locator('.dialog').count() === 0 &&
    await seite.locator('.karte-zusatz').count() === 0,
    'Abbrechen schließt das Blatt, ohne etwas zu speichern');

await seite.locator('.karte-stift').first().tap();
await seite.waitForSelector('.dialog .mengen-editor');
await seite.locator('.mengen-editor input[type="text"]').fill('2 Liter · die kleinen');
const [fotowaehler] = await Promise.all([
    seite.waitForEvent('filechooser'),
    seite.locator('.produktfoto-aktionen button', { hasText: 'Foto hinzufügen' }).tap()
]);
await fotowaehler.setFiles(join(wurzel, 'icons', 'favicon-64.png'));
await seite.waitForSelector('.produktfoto-aktionen button', { hasText: 'Foto ändern' });
await seite.locator('.dialog-knoepfe button.primary').tap();
await seite.waitForSelector('.karte-zusatz');
pruefe((await seite.locator('.karte-zusatz').first().textContent())?.includes('2 Liter · die kleinen'),
    'Der Produktwunsch steht an der Zeile');
pruefe(await seite.locator('.karte-produktfoto').count() === 1,
    'Das lokal komprimierte Produktfoto steht am Artikel');
await seite.screenshot({ path: join(bilder, '05-experte.png') });

/* Die wichtigste Zusicherung dieses Umbaus: Die Karte ist weiterhin EIN
   ungeteiltes Ziel. Ein Tipp irgendwo darauf hakt ab und öffnet kein Blatt –
   sonst wäre das häufigste Ziel der App um ein Vielfaches geschrumpft. */
const offeneKarte = seite.locator('.listenkarte:not(.ist-erledigt)').first();
const kartenKasten = await offeneKarte.boundingBox();
const artikelVorher = await offeneKarte.locator('.karte-name').textContent();
await seite.mouse.click(kartenKasten.x + 24, kartenKasten.y + kartenKasten.height / 2);
await seite.waitForTimeout(250);
pruefe(await seite.locator('.dialog').count() === 0,
    'Ein Tipp auf die Karte öffnet kein Blatt');
pruefe(await seite.locator(`.listenkarte.ist-erledigt .karte-name`, { hasText: artikelVorher }).count() === 1,
    `Ein Tipp am linken Kartenrand hakt ab (${artikelVorher})`);
await seite.locator('.listenkarte.ist-erledigt', { hasText: artikelVorher }).tap();
await seite.waitForTimeout(200);

/* Verlustfrei zurück: Basis blendet den Wunsch aus, löscht ihn aber nicht. */
await seite.locator('#modus-schalter .seg[data-modus="basis"]').tap();
await seite.waitForTimeout(150);
pruefe(await seite.locator('.karte-zusatz').count() > 0, 'Basis zeigt die benötigte Menge ebenfalls');
await seite.locator('#modus-schalter .seg[data-modus="experte"]').tap();
await seite.waitForTimeout(150);
pruefe((await seite.locator('.karte-zusatz').first().textContent())?.includes('2 Liter'),
    'Der Rückweg nach Experte bringt sie unverändert wieder');
await seite.locator('#modus-schalter .seg[data-modus="basis"]').tap();

/* ── Zehn Einkäufe ──────────────────────────────────────────────────────── */
const haushalt = ['Milch', 'Brot', 'Butter'];
for (let einkauf = 0; einkauf < 10; einkauf++) {
    await seite.locator('#tab-katalog').tap();
    for (const name of haushalt) {
        await seite.locator('#katalog-suche').fill(name);
        const treffer = seite.locator('.kachel').first();
        const drauf = await treffer.evaluate((el) => el.classList.contains('ist-drauf'));
        if (!drauf) await treffer.tap();
    }
    await seite.locator('#katalog-suche').fill('');
    await seite.locator('#tab-liste').tap();
    await seite.waitForSelector('.listenkarte:not(.ist-erledigt)');
    let offen = await seite.locator('.listenkarte:not(.ist-erledigt)').count();
    while (offen > 0) {
        await seite.locator('.listenkarte:not(.ist-erledigt)').first().tap();
        await seite.waitForTimeout(60);
        offen = await seite.locator('.listenkarte:not(.ist-erledigt)').count();
    }
    await seite.locator('.erledigt-kopf button').tap();
    await seite.waitForTimeout(80);
}

await seite.locator('#tab-katalog').tap();
await seite.waitForSelector('.kachel');
const obenImKatalog = await seite.locator('.kachelwand').first().locator('.kachel-name')
    .evaluateAll((elemente) => elemente.slice(0, 6).map((e) => e.textContent));
const ersteGruppe = await seite.locator('#bereich-katalog .gruppe-kopf').first().textContent();
pruefe(ersteGruppe?.includes('Oft gebraucht'), 'Der Katalog führt jetzt mit „Oft gebraucht"');
pruefe(haushalt.every((name) => obenImKatalog.includes(name)),
    `Die Standardartikel des Haushalts stehen oben (${obenImKatalog.join(', ')})`);
await seite.screenshot({ path: join(bilder, '06-katalog-gelernt.png') });

await seite.locator('#tab-mehr').tap();
await seite.waitForSelector('.karte');
await seite.waitForSelector('#toast', { state: 'hidden' });
await seite.evaluate(() => window.scrollTo(0, 0));
await seite.screenshot({ path: join(bilder, '07-mehr.png') });

/* ── Basis zeigt nichts Erklärungsbedürftiges ───────────────────────────── */
const karteninBasis = await seite.locator('#bereich-mehr .karte:not(.experte-nur)').count();
const karteninBasisSichtbar = await seite.locator('#bereich-mehr .karte:visible').count();
pruefe(karteninBasisSichtbar === karteninBasis,
    `Basis zeigt in „Mehr" nur die Grundkarten einschließlich Wochenangeboten (${karteninBasisSichtbar})`);

/* ── Basis: einmalig geführter Angebotscheck ───────────────────────────── */
pruefe(await seite.locator('.angebote-karte').isVisible(),
    'Der Angebotscheck ist als Alltagsfunktion schon in Basis sichtbar');
await seite.locator('.meine-maerkte > summary').tap();
await seite.locator('.meine-maerkte button', { hasText: 'Markt hinzufügen' }).tap();
await seite.waitForSelector('.dialog select');
await seite.locator('.dialog select').selectOption('REWE');
await seite.getByRole('textbox', { name: 'Filiale oder Adresse', exact: true }).fill('Rellinghauser Straße 239, Essen');
await seite.locator('.dialog .primary').tap();
await seite.waitForSelector('.maerkte-liste');
pruefe((await seite.locator('.maerkte-liste').textContent())?.includes('REWE'),
    'Ein üblicher Markt lässt sich lokal speichern und aktivieren');
await seite.locator('button', { hasText: 'Geführt einrichten' }).tap();
await seite.waitForSelector('.angebote-hilfe-schritt');
pruefe(await seite.locator('.angebote-hilfe-schritt').count() === 3,
    'Die Einführung erklärt den Ablauf in genau drei Schritten');
const hilfetext = await seite.locator('.dialog-koerper').textContent();
pruefe(hilfetext?.includes('Claude Cowork') && hilfetext.includes('ChatGPT') &&
    hilfetext.includes('Foxi überträgt nichts automatisch'),
    'Die Einführung nennt Assistenten und die lokale Datenschutzgrenze');
await seite.screenshot({ path: join(bilder, '07a-angebote-einfuehrung.png') });
await seite.locator('.dialog button', { hasText: 'Rechercheauftrag kopieren' }).tap();
await seite.waitForTimeout(300);
const angebotsauftrag = await seite.evaluate(() => navigator.clipboard.readText().then(text => text.replace(/\r\n/g, '\n')));
pruefe(angebotsauftrag.includes('WÖCHENTLICHER FOXI-ANGEBOTSRADAR') &&
    angebotsauftrag.includes('foxi-persoenlich'),
    'Der Rechercheauftrag trägt Regelwerk und Profil');
pruefe(angebotsauftrag.includes('REWE') && angebotsauftrag.includes('Rellinghauser Straße'),
    'Der Auftrag nennt nur den aktivierten Markt');
const profilText = angebotsauftrag.split(/Eingabeprofil:\r?\n/)[1];
const profilImAuftrag = JSON.parse(profilText);
pruefe(profilImAuftrag.demo === false &&
    !Object.hasOwn(profilImAuftrag, 'wohnadresse') &&
    !Object.hasOwn(profilImAuftrag, 'koordinaten') &&
    !JSON.stringify(profilImAuftrag).includes('datenUrl'),
    'Der persönliche Auftrag enthält weder Wohnadresse noch Produktfoto');
await seite.locator('.dialog-knoepfe .primary').tap();
const erneutRecherchieren = seite.locator('.angebote-karte button', { hasText: 'Erneut recherchieren' });
await erneutRecherchieren.waitFor({ state: 'visible' });
pruefe(await erneutRecherchieren.count() === 1,
    'Nach der Einführung bleibt eine kompakte Alltagskarte zurück');

/* ── Experte: Rezepte ───────────────────────────────────────────────────── */
await seite.locator('#modus-schalter .seg[data-modus="experte"]').tap();
await seite.waitForSelector('.rezeptliste');
const rezeptAnzahl = await seite.locator('.rezept-knopf').count();
pruefe(rezeptAnzahl >= 6, `Die Beispielrezepte sind da (${rezeptAnzahl})`);

await seite.locator('.rezept-knopf', { hasText: 'Linsensuppe' }).tap();
await seite.waitForSelector('#bereich-liste .listenkarte');
const nachRezept = Number(await seite.locator('#tab-liste-zahl').textContent());
pruefe(nachRezept >= 8, `Ein Tipp legt alle Zutaten auf einmal ab (${nachRezept} offen)`);
await seite.screenshot({ path: join(bilder, '08-rezept-uebertragen.png') });

/* Eigenes Rezept aus der aktuellen Liste. */
await seite.locator('#tab-mehr').tap();
await seite.locator('button', { hasText: 'Aktuelle Liste als Rezept sichern' }).tap();
await seite.waitForSelector('.dialog input');
/* Die Ausnahme von der Regel weiter unten: Hier ist Tippen der Zweck des
   Dialogs, also springt der Fokus ins Feld – und die Tastatur kommt sofort. */
await seite.waitForTimeout(80);
pruefe(await seite.evaluate(() => document.activeElement?.tagName) === 'INPUT',
    'Wo Tippen der Zweck ist, springt der Fokus ins Feld');
await seite.locator('.dialog input').fill('Wochenende');
await seite.locator('.dialog .primary').tap();
await seite.waitForTimeout(200);
pruefe(await seite.locator('.rezept-knopf', { hasText: 'Wochenende' }).count() === 1,
    'Die Liste lässt sich als eigenes Rezept sichern');

/* ── Experte: Reihenfolge im Laden ──────────────────────────────────────── */
const ersteKategorieVorher = await seite.locator('.zieh-name').first().textContent();
await seite.locator('.ziehzeile').nth(1).locator('.zieh-griff').focus();
await seite.keyboard.press('ArrowUp');
await seite.waitForTimeout(250);
const ersteKategorieNachher = await seite.locator('.zieh-name').first().textContent();
pruefe(ersteKategorieVorher !== ersteKategorieNachher,
    `Die Kategorie-Reihenfolge lässt sich ändern (${ersteKategorieVorher} → ${ersteKategorieNachher})`);

/* Dieselbe Liste per Zeiger ziehen – der Weg, den ein Finger nimmt.

   `boundingBox()` scrollt im Gegensatz zu `tap()` nicht von selbst hin.
   Ohne das Scrollen liefert es Koordinaten unterhalb des Fensters, die Maus
   zielte ins Leere und der Zug bewegte nichts – gemessen und behoben. */
const zweite = seite.locator('.ziehzeile').nth(2);
const drittesZiel = seite.locator('.ziehzeile').nth(5);
await zweite.scrollIntoViewIfNeeded();
await drittesZiel.scrollIntoViewIfNeeded();
await zweite.scrollIntoViewIfNeeded();
const vonKasten = await zweite.locator('.zieh-griff').boundingBox();
const nachKasten = await drittesZiel.boundingBox();
const gezogeneKategorie = await zweite.locator('.zieh-name').textContent();
await seite.mouse.move(vonKasten.x + vonKasten.width / 2, vonKasten.y + vonKasten.height / 2);
await seite.mouse.down();
await seite.mouse.move(nachKasten.x + nachKasten.width / 2, nachKasten.y + nachKasten.height - 2, { steps: 12 });
await seite.mouse.up();
await seite.waitForTimeout(250);
/* Nicht auf einen festen Platz prüfen: Die Liste sortiert sich unter dem
   Zeiger laufend um, deshalb hängt die Endstelle vom gefahrenen Weg ab.
   Die Eigenschaft, auf die es ankommt, ist „sie ist nach unten gewandert
   und die neue Reihenfolge steht in der Datenbank". */
const reihenfolgeNachher = await seite.locator('.zieh-name').allTextContents();
const neueStelle = reihenfolgeNachher.indexOf(gezogeneKategorie);
pruefe(neueStelle > 2,
    `Ziehen mit dem Zeiger verschiebt die Kategorie (${gezogeneKategorie}: Platz 3 → ${neueStelle + 1})`);
await seite.screenshot({ path: join(bilder, '09-reihenfolge.png') });

/* Wirkt die Reihenfolge auf die Liste? */
await seite.locator('button', { hasText: 'Ursprüngliche Reihenfolge' }).tap();
await seite.waitForTimeout(200);
await seite.locator('#tab-liste').tap();
await seite.waitForSelector('#bereich-liste .gruppe-kopf');
const ersteListenGruppe = await seite.locator('#bereich-liste .gruppe-kopf').first().textContent();
pruefe(ersteListenGruppe?.includes('Obst'),
    `Die Liste folgt der Kategorie-Reihenfolge (erste Gruppe: ${ersteListenGruppe?.trim()})`);

/* ── Experte: Ort ───────────────────────────────────────────────────────── */
await seite.locator('#tab-mehr').tap();
await seite.waitForSelector('.ort-feld');
await seite.locator('.ort-feld').fill('45136 Essen');
await seite.locator('.ort-feld').blur();
await seite.waitForTimeout(250);
await seite.locator('#tab-liste').tap();
await seite.locator('#tab-mehr').tap();
await seite.waitForSelector('.ort-feld');
pruefe(await seite.locator('.ort-feld').inputValue() === '45136 Essen',
    'Der Ort überlebt den Bereichswechsel');

/* ── Experte: Briefing-Export ───────────────────────────────────────────── */
await seite.locator('button', { hasText: 'Liste als Text kopieren' }).tap();
await seite.waitForTimeout(300);
const ausDerZwischenablage = await seite.evaluate(() => navigator.clipboard.readText().then(text => text.replace(/\r\n/g, '\n')));
const klartextZeilen = ausDerZwischenablage.split('\n');
pruefe(/^Einkaufsliste \(\d{2}\.\d{2}\.\d{4}\)$/.test(klartextZeilen[0]),
    'Der Klartext beginnt mit der Überschrift');
/* Kopf und Inhalt trennt eine Leerzeile – mit Ortszeile also die dritte. */
pruefe(klartextZeilen[2] === '', 'Eine Leerzeile trennt Kopf und Inhalt');
pruefe(/\n[^:\n]+: .+/.test(ausDerZwischenablage),
    'Er führt die Kategorien als „Kategorie: Artikel, Artikel"');
/* Keine vorgefertigte Frage: Der Mensch schreibt selbst, was er wissen will. */
pruefe(!ausDerZwischenablage.includes('?'), 'Er hängt keine Frage an');
pruefe(ausDerZwischenablage.split('\n')[1] === 'Ort: 45136 Essen',
    'Der hinterlegte Ort steht in der zweiten Zeile');

/* ── Experte: Stammartikel ──────────────────────────────────────────────── */
await seite.locator('button', { hasText: 'Stammartikel kopieren' }).tap();
await seite.waitForTimeout(300);
const stammtext = await seite.evaluate(() => navigator.clipboard.readText().then(text => text.replace(/\r\n/g, '\n')));
pruefe(/^Stammartikel \(EinkaufsFuchs, Stand \d{2}\.\d{2}\.\d{4}\)\nOrt: 45136 Essen\n\n/.test(stammtext),
    'Der Stammartikel-Export trägt Kopf und Ort');
/* Nach zehn Einkäufen von Milch, Brot und Butter müssen genau die vorn
   stehen – das ist derselbe Befund wie im Katalog, nur als Text zum
   Weitergeben. */
pruefe(/Milch \(10×\)/.test(stammtext) && /Butter \(10×\)/.test(stammtext),
    `Er nennt die Stammartikel mit ihrer Kaufzahl (${stammtext.split('\n')[3]?.slice(0, 60)}…)`);
pruefe(!stammtext.includes('?'), 'Auch er hängt keine Frage an');

/* ── Angebotscheck: Ergebnis zurück zu Foxi ────────────────────────────── */

const heute = new Date();
const tag = (datum) => datum.toISOString().slice(0, 10);
const inSechsTagen = new Date(heute);
inSechsTagen.setDate(inSechsTagen.getDate() + 6);
const agentenergebnis = {
    typ: 'foxi-angebote',
    version: 1,
    profilId: 'demo-45136-essen',
    demo: true,
    erzeugt: heute.toISOString(),
    angebote: [{
        artikelId: 'milch',
        artikelName: 'Milch',
        haendler: 'ALDI Nord',
        markt: 'Schürmannstraße 43b, 45136 Essen',
        produkt: 'MILSANI Frische Vollmilch',
        preis: 0.99,
        waehrung: 'EUR',
        menge: '1 l',
        grundpreis: '0,99 €/l',
        gueltigVon: tag(heute),
        gueltigBis: tag(inSechsTagen),
        treffer: 'genau',
        hinweis: '',
        quelle: 'https://www.aldi-nord.de/angebote.html'
    }]
};
const angebotsPfad = join(tmpdir(), 'foxi-agentenergebnis.json');
await seite.locator('button', { hasText: 'Aus Zwischenablage übernehmen' }).tap();
await seite.waitForSelector('.angebote-eingabe');
await seite.locator('.angebote-eingabe').fill(JSON.stringify(agentenergebnis, null, 2));
await seite.locator('.dialog-knoepfe .primary').tap();
await seite.waitForSelector('.angebote-details', { state: 'attached' });
await seite.locator('.angebote-details > summary').tap();
await seite.waitForSelector('.angebotsliste');
const eingefuegterText = await seite.locator('.angebotsliste').textContent();
pruefe(eingefuegterText?.includes('Milch') && eingefuegterText.includes('0,99 €'),
    'Ein kopiertes JSON-Ergebnis lässt sich direkt einfügen');

/* Ein persönliches Ergebnis, wie ein Assistent es schreibt: die gespeicherte
   REWE-Filiale in anderer Schreibweise, ein Angebot „für alle Filialen" und
   eine Filiale, die er nicht lesen konnte. Foxi ordnet die erste zu, lässt
   das zweite sichtbar weg und zeigt das dritte an. */
const persoenlichesErgebnis = {
    ...structuredClone(agentenergebnis),
    profilId: 'foxi-persoenlich',
    demo: false,
    angebote: [
        {
            ...structuredClone(agentenergebnis.angebote[0]),
            haendler: 'REWE',
            markt: 'Rellinghauser Str. 239, 45136 Essen',
            produkt: 'ja! Frische Vollmilch',
            preis: 1.05,
            grundpreis: '1,05 €/l',
            quelle: 'https://www.rewe.de/angebote/'
        },
        {
            ...structuredClone(agentenergebnis.angebote[0]),
            haendler: 'REWE',
            markt: 'alle Filialen',
            quelle: 'https://www.rewe.de/angebote/'
        }
    ],
    nichtGelesen: [{ haendler: 'REWE', markt: 'Rellinghauser Straße 239, Essen', grund: 'Prospekt nicht lesbar' }]
};
await seite.waitForSelector('#toast', { state: 'hidden' });
await seite.locator('button', { hasText: 'Aus Zwischenablage übernehmen' }).tap();
await seite.waitForSelector('.angebote-eingabe');
await seite.locator('.angebote-eingabe').fill(JSON.stringify(persoenlichesErgebnis, null, 2));
await seite.locator('.dialog-knoepfe .primary').tap();
await seite.waitForSelector('#toast:not([hidden])');
const zuordnungsMeldung = await seite.locator('#toast').textContent();
pruefe(zuordnungsMeldung?.includes('1 aktuelles Angebot übernommen') &&
    zuordnungsMeldung.includes('1 ohne Filiale'),
    `Ein Angebot ohne Filiale aus „Meine Märkte" wird sichtbar ausgelassen (${zuordnungsMeldung})`);
await seite.waitForSelector('.angebote-details', { state: 'attached' });
await seite.locator('.angebote-details > summary').tap();
const zugeordnet = await seite.locator('.angebotsliste').textContent();
pruefe(zugeordnet?.includes('REWE · Rellinghauser Straße 239, Essen'),
    'Eine andere Schreibweise wird der gespeicherten Filiale zugeordnet');
pruefe((await seite.locator('.angebote-nichtgelesen > summary').textContent())
    ?.includes('1 Filiale konnte der Assistent nicht lesen'),
    'Was der Assistent nicht lesen konnte, steht mit Filiale in der Karte');

const dateiErgebnis = structuredClone(agentenergebnis);
dateiErgebnis.angebote.push({
    ...structuredClone(agentenergebnis.angebote[0]),
    markt: 'Steeler Straße 187, 45138 Essen'
});
dateiErgebnis.angebote.push({
    artikelId: 'butter',
    artikelName: 'Butter',
    haendler: 'ALDI Süd',
    markt: 'Humboldtring 5, 45472 Mülheim an der Ruhr',
    produkt: 'MILSANI Deutsche Markenbutter',
    preis: 1.49,
    waehrung: 'EUR',
    menge: '250 g',
    grundpreis: '5,96 €/kg',
    gueltigVon: tag(heute),
    gueltigBis: tag(inSechsTagen),
    treffer: 'alternative',
    hinweis: 'Beispiel für eine plausible Alternative.',
    quelle: 'https://www.aldi-sued.de/angebote'
});
writeFileSync(angebotsPfad, JSON.stringify(dateiErgebnis, null, 2), 'utf8');

const [angebotsDateiwaehler] = await Promise.all([
    seite.waitForEvent('filechooser'),
    seite.locator('button', { hasText: 'Ergebnisdatei auswählen' }).tap()
]);
await angebotsDateiwaehler.setFiles(angebotsPfad);
await seite.waitForSelector('.angebote-details', { state: 'attached' });
await seite.locator('.angebote-details > summary').tap();
await seite.waitForSelector('.angebotsliste > li:nth-child(2)');
const angebotsText = await seite.locator('.angebotsliste').textContent();
pruefe(angebotsText?.includes('Milch') && angebotsText.includes('0,99 €') &&
    angebotsText.includes('ALDI Nord') && angebotsText.includes('Butter') &&
    angebotsText.includes('ALDI Süd'),
    `Ein geprüftes Rechercheergebnis erscheint in Foxi (${angebotsText?.trim()})`);
pruefe(await seite.locator('.angebotsliste > li').count() === 2 &&
    angebotsText.includes('ALDI Nord · Schürmannstraße 43b, Steeler Straße 187'),
    'Dasselbe Angebot aus zwei Filialen erscheint nur einmal – mit beiden Filialen beim Namen');
await seite.locator('.angebote-karte').scrollIntoViewIfNeeded();
await seite.waitForSelector('#toast', { state: 'hidden' });
await seite.screenshot({ path: join(bilder, '13-angebotsradar.png') });

/* Der konkrete Mehrwert steht nicht nur unter „Mehr", sondern direkt an
   den passenden offenen Artikeln. */
await seite.locator('#tab-katalog').tap();
for (const name of ['Milch', 'Butter']) {
    await seite.locator('#katalog-suche').fill(name);
    const treffer = seite.locator('.kachel').first();
    if (!(await treffer.evaluate((element) => element.classList.contains('ist-drauf')))) {
        await treffer.tap();
    }
}
await seite.locator('#katalog-suche').fill('');
await seite.locator('#tab-liste').tap();
await seite.waitForSelector('[data-artikel-id="milch"] .karte-angebot');
const milchAngebot = await seite.locator('[data-artikel-id="milch"] .karte-angebot').textContent();
const butterAngebot = await seite.locator('[data-artikel-id="butter"] .karte-angebot').textContent();
pruefe(milchAngebot?.includes('0,99 €') && milchAngebot.includes('ALDI Nord'),
    `Die Einkaufsliste zeigt den passenden Preis direkt an (${milchAngebot})`);
pruefe(milchAngebot?.includes('ALDI Nord Schürmannstraße 43b + 1 weitere Filiale') &&
    butterAngebot?.includes('ALDI Süd Humboldtring 5'),
    `Die Einkaufsliste nennt immer die Filiale (${butterAngebot})`);
pruefe(butterAngebot?.includes('Alternative') && butterAngebot.includes('1,49 €'),
    `Alternativen sind auf der Liste eindeutig gekennzeichnet (${butterAngebot})`);
await seite.waitForSelector('#toast', { state: 'hidden' });
await seite.locator('#bereich-liste [data-artikel-id="butter"]').evaluate(
    (element) => element.scrollIntoView({ block: 'center' })
);
await seite.screenshot({ path: join(bilder, '14-liste-mit-angeboten.png') });

/* ── Das Artikelblatt mit Angeboten ─────────────────────────────────────── */
await seite.locator('#modus-schalter .seg[data-modus="experte"]').tap();
await seite.waitForSelector('#bereich-liste [data-artikel-id="butter"] ~ .karte-stift');
await seite.locator('#bereich-liste [data-artikel-id="butter"] ~ .karte-stift').tap();
await seite.waitForSelector('.blatt-angebot');

const blattText = await seite.locator('.dialog').textContent();
pruefe(blattText?.includes('1,49 €') && blattText.includes('ALDI Süd'),
    'Das Blatt führt Preis und Händler auf');
pruefe(await seite.locator('.blatt-marke.ist-alternative').count() === 1,
    'Ein ähnliches Produkt ist im Blatt eigens gekennzeichnet');
pruefe(await seite.locator('.blatt-maerkte li').count() >= 1,
    'Das Blatt nennt die Filialen, in denen das Angebot gilt');

/* Jeder angezeigte Verweis muss HTTPS auf einem offiziellen Händler-Host
   sein – dieselbe Erlaubnisliste, an der schon `pruefeAngebotsergebnis()`
   misst. Ein manipuliertes Agentenergebnis darf das Blatt nicht in eine
   Phishing-Fläche verwandeln. */
const verweise = await seite.locator('.blatt-quelle').evaluateAll(
    (elemente) => elemente.map((element) => element.href)
);
const erlaubt = ['aldi-nord.de', 'aldi-sued.de', 'rewe.de'];
pruefe(verweise.length > 0 && verweise.every((adresse) => {
    const ziel = new URL(adresse);
    return ziel.protocol === 'https:' &&
        erlaubt.some((host) => ziel.hostname === host || ziel.hostname.endsWith(`.${host}`));
}), `Jeder Angebotsverweis zeigt per HTTPS auf einen offiziellen Händler (${verweise.join(', ')})`);
pruefe(await seite.locator('.blatt-quelle').first().getAttribute('rel') === 'noopener noreferrer',
    'Der Verweis verrät dem Händler nicht, woher der Klick kam');
await seite.screenshot({ path: join(bilder, '15-artikelblatt.png') });

await seite.locator('.dialog-abbruch').tap();
await seite.waitForTimeout(200);

/* ── Gelernte Mengen ────────────────────────────────────────────────────────

   Zwei Einkäufe mit verschiedenen Wünschen, dann muss der ältere im Blatt
   als Knopf stehen. Der Weg ist der echte: Wunsch eintragen, abhaken,
   erledigte entfernen, Artikel erneut auf die Liste. */
async function butterKaufen(wunsch) {
    await seite.waitForSelector('#toast', { state: 'hidden' });
    await seite.locator('#bereich-liste [data-artikel-id="butter"] ~ .karte-stift').tap();
    await seite.waitForSelector('.dialog .mengen-editor');
    await seite.locator('.mengen-editor input[type="text"]').fill(wunsch);
    await seite.locator('.dialog-knoepfe button.primary').tap();
    await seite.waitForSelector('.dialog', { state: 'detached' });
    await seite.locator('#bereich-liste [data-artikel-id="butter"]').tap();
    await seite.waitForSelector('.erledigt-block');
    await seite.locator('.erledigt-kopf button').tap();
    await seite.waitForTimeout(120);
    await seite.locator('#tab-katalog').tap();
    await seite.locator('#katalog-suche').fill('Butter');
    await seite.waitForSelector('.kachel');
    await seite.locator('.kachel').first().tap();
    await seite.locator('#katalog-suche').fill('');
    await seite.locator('#tab-liste').tap();
    await seite.waitForSelector('#bereich-liste [data-artikel-id="butter"]');
}

await butterKaufen('1 Stück');
await butterKaufen('250 g Markenbutter');

await seite.waitForSelector('#toast', { state: 'hidden' });
await seite.locator('#bereich-liste [data-artikel-id="butter"] ~ .karte-stift').tap();
await seite.waitForSelector('.dialog .mengen-editor');
const chips = await seite.locator('.mengen-chips button').allTextContents();
pruefe(chips.includes('1 Stück'),
    `Das Blatt bietet an, was zuletzt tatsächlich gekauft wurde (${chips.join(', ') || 'nichts'})`);
/* Der Wunsch, der ohnehin im Feld steht, ist kein Vorschlag, sondern ein
   Knopf, der nichts tut. */
pruefe(!chips.includes('250 g Markenbutter') && chips.length <= 3,
    'Der aktuelle Wunsch steht nicht noch einmal als Knopf daneben');
await seite.locator('.mengen-chips button', { hasText: '1 Stück' }).tap();
pruefe(await seite.locator('.mengen-editor input[type="text"]').inputValue() === '1 Stück',
    'Ein Tipp auf den Knopf füllt das Feld');
await seite.screenshot({ path: join(bilder, '16-gelernte-mengen.png') });

/* Abbrechen, damit dieser Abschnitt den Artikel so hinterlässt, wie er ihn
   vorgefunden hat. */
await seite.locator('.dialog-abbruch').tap();
await seite.waitForTimeout(200);
/* Den Modus so hinterlassen, wie dieser Abschnitt ihn vorgefunden hat: Der
   Lauf steht hier auf Experte, und das lange Drücken weiter unten gibt es
   nur dort. Ein „aufgeräumtes" Zurückschalten ließ genau diese zwei
   Prüfungen fallen. */

/* Langes Drücken auf eine Kachel: nur dieser eine Artikelname. */
await seite.locator('#tab-katalog').tap();
await seite.locator('#katalog-suche').fill('Sardellenpaste');
await seite.waitForSelector('.kachel');
const kachelKasten = await seite.locator('.kachel').first().boundingBox();
await seite.mouse.move(kachelKasten.x + kachelKasten.width / 2, kachelKasten.y + kachelKasten.height / 2);
await seite.mouse.down();
await seite.waitForTimeout(700);
await seite.mouse.up();
await seite.waitForTimeout(200);
pruefe(await seite.evaluate(() => navigator.clipboard.readText().then(text => text.replace(/\r\n/g, '\n'))) === 'Sardellenpaste',
    'Langes Drücken kopiert nur den Artikelnamen');
pruefe(await seite.locator('.kachel').first().evaluate((el) => !el.classList.contains('ist-drauf')),
    'Langes Drücken legt den Artikel nicht zusätzlich auf die Liste');
await seite.locator('#katalog-suche').fill('');

/* ── Die Liste als QR-Code, von Gerät zu Gerät ──────────────────────────────

   Der einzige Weg in Foxi, der ohne Datei und ohne Zwischenablage auskommt.
   Geprüft wird er deshalb auch als echter Rundlauf: Das erste Gerät erzeugt
   den Code, ein **zweiter Browserkontext** – eigene Datenbank, eigener
   Speicher, also ein anderes Gerät – öffnet die darin steckende Adresse und
   muss dieselbe Liste bekommen. */
await seite.locator('#tab-liste').tap();
await seite.waitForSelector('#bereich-liste .listenkarte');
const listeVorQr = await seite.locator('#bereich-liste .listenkarte:not(.ist-erledigt) .karte-name')
    .allTextContents();

await seite.locator('#tab-mehr').tap();
await seite.getByRole('button', { name: 'Liste an ein anderes Gerät', exact: true }).tap();
await seite.waitForSelector('.qr-bild');
const qrBild = await seite.evaluate(() => {
    const bild = document.querySelector('.qr-bild');
    const punkte = bild.getContext('2d').getImageData(0, 0, bild.width, bild.height).data;
    let dunkel = 0;
    for (let i = 0; i < punkte.length; i += 4) if (punkte[i] < 128) dunkel++;
    return { breite: bild.width, anteil: dunkel / (bild.width * bild.height) };
});
/* Ein leeres oder vollflächiges Bild wäre auch „gezeichnet". Ein echter
   QR-Code liegt bei ungefähr der Hälfte dunkler Module, der helle Rand zieht
   ihn etwas herunter. */
pruefe(qrBild.breite >= 200 && qrBild.anteil > 0.15 && qrBild.anteil < 0.6,
    `Der QR-Code ist gezeichnet (${qrBild.breite} px, ${Math.round(qrBild.anteil * 100)} % dunkel)`);
/* Ein langer Dialog darf nicht schon beim Öffnen am Ende stehen: Der Fokus
   gehört an den Anfang, sonst sieht man einen Bildschirm ohne Überschrift. */
pruefe(await seite.locator('.dialog-titel').isVisible(),
    'Der Dialog steht beim Öffnen oben, nicht am Ende');
await seite.screenshot({ path: join(bilder, '18-qr-code.png') });

/* Dieselbe Adresse, die im Bild steckt – über das Modul geholt, damit die
   Prüfstrecke keinen Testzugang im Auslieferungsstand braucht. */
const qrAdresse = await seite.evaluate(async () => {
    const modul = await import('./src/ui/teilen.js');
    return modul.aktuelleQrAdresse();
});
pruefe(qrAdresse.startsWith(ADRESSE) && /#lz?=/.test(qrAdresse),
    `Die Adresse trägt die Liste hinter der Raute (${qrAdresse.length} Zeichen)`);
/* Alles vor der Raute geht zum Server, alles dahinter nie. Deshalb darf vor
   der Raute nichts aus der Liste stehen. */
pruefe(qrAdresse.slice(0, qrAdresse.indexOf('#')) === ADRESSE,
    'Vor der Raute steht nichts als die App-Adresse');

/* Nicht die verpackte Zeichenkette absuchen – die ist gepackt und enthielte
   ohnehin nichts Lesbares. Geprüft wird der **entpackte** Inhalt. */
const qrInhalt = await seite.evaluate(async (adresse) => {
    const modul = await import('./src/qrliste.js');
    const pruefung = await modul.pruefeQrListe(
        modul.qrAnteilAusAdresse(adresse.slice(adresse.indexOf('#')))
    );
    return { gueltig: pruefung.gueltig, text: JSON.stringify(pruefung.daten) };
}, qrAdresse);
pruefe(qrInhalt.gueltig && !qrInhalt.text.includes('data:image') &&
    !/letzteKaeufe|letzteMengen|zaehler|angebot/i.test(qrInhalt.text),
    'Weder Foto noch Kaufhistorie noch Angebote fahren mit');

const zweitesGeraet = await browser.newContext({
    ...devices['iPhone 13'], isMobile: true, hasTouch: true
});
const zweiteSeite = await zweitesGeraet.newPage();
const fremdeAnfragenZwei = [];
zweiteSeite.on('request', (anfrage) => {
    if (!anfrage.url().startsWith(ADRESSE.slice(0, -1))) fremdeAnfragenZwei.push(anfrage.url());
});
zweiteSeite.on('console', (nachricht) => {
    if (nachricht.type() === 'error') fehlerAufDerSeite.push(`[Gerät 2] ${nachricht.text()}`);
});
zweiteSeite.on('pageerror', (fehler) => fehlerAufDerSeite.push(`[Gerät 2] ${fehler}`));

await zweiteSeite.goto(qrAdresse, { waitUntil: 'networkidle' });
await zweiteSeite.waitForSelector('.dialog');
const frageText = await zweiteSeite.locator('.dialog-koerper').textContent();
pruefe(/Neu:/.test(frageText || ''),
    `Das zweite Gerät fragt erst, bevor es übernimmt (${frageText?.trim()})`);

await zweiteSeite.locator('.dialog-knoepfe button').first().tap();
await zweiteSeite.waitForSelector('#bereich-liste .listenkarte');
const listeDanach = await zweiteSeite.locator('#bereich-liste .karte-name').allTextContents();
pruefe(listeVorQr.length > 0 && listeVorQr.every((name) => listeDanach.includes(name)),
    `Dieselbe Liste steht auf dem zweiten Gerät (${listeDanach.length} von ${listeVorQr.length})`);
pruefe(await zweiteSeite.locator('.karte-produktfoto').count() === 0,
    'Auf dem zweiten Gerät ist kein Produktfoto angekommen');
/* Sonst führte jedes Neuladen denselben Import noch einmal vor – und die
   Liste eines fremden Haushalts bliebe in der Adresszeile stehen. */
pruefe(!zweiteSeite.url().includes('#l='), 'Der Anker ist nach dem Lesen aus der Adresse verschwunden');
pruefe(fremdeAnfragenZwei.length === 0,
    `Auch das zweite Gerät fragt keine fremde Adresse${fremdeAnfragenZwei.length ? `: ${fremdeAnfragenZwei.join(', ')}` : ''}`);
await zweiteSeite.screenshot({ path: join(bilder, '19-qr-empfangen.png') });
await zweitesGeraet.close();

/* ── Derselbe Inhalt als Link ───────────────────────────────────────────────

   Der Fall, für den der QR-Code nichts taugt: Einer ist zu Hause, der andere
   im Laden. Ohne Systemdialog (wie hier im Kopflosen) fällt „Als Link senden"
   auf die Zwischenablage zurück – geprüft wird, dass dort dieselbe Adresse
   landet. */
await seite.evaluate(() => navigator.clipboard.writeText('noch nichts'));
await seite.locator('.dialog-knoepfe button.primary').tap();
await seite.waitForTimeout(300);
const ablage = await seite.evaluate(() => navigator.clipboard.readText().then(text => text.replace(/\r\n/g, '\n')));
pruefe(ablage === qrAdresse, 'Der Knopf legt denselben Link in die Zwischenablage');

/* Und die Gegenrichtung auf einem dritten Gerät: Link aus der Nachricht
   kopieren, eigene Foxi öffnen, einfügen. Das ist der Weg, der den
   eingebauten Browser eines Messengers umgeht – dessen eigener Speicher
   wäre eine Sackgasse. */
const drittesGeraet = await browser.newContext({
    ...devices['iPhone 13'], isMobile: true, hasTouch: true,
    permissions: ['clipboard-read', 'clipboard-write']
});
const dritteSeite = await drittesGeraet.newPage();
dritteSeite.on('console', (nachricht) => {
    if (nachricht.type() === 'error') fehlerAufDerSeite.push(`[Gerät 3] ${nachricht.text()}`);
});
dritteSeite.on('pageerror', (fehler) => fehlerAufDerSeite.push(`[Gerät 3] ${fehler}`));
await dritteSeite.goto(ADRESSE, { waitUntil: 'networkidle' });
await dritteSeite.waitForSelector('#liste-inhalt');
await dritteSeite.evaluate((link) => navigator.clipboard.writeText(link), qrAdresse);
await dritteSeite.locator('#modus-schalter .seg[data-modus="experte"]').tap();
await dritteSeite.locator('#tab-mehr').tap();
await dritteSeite.getByRole('button', { name: 'Link einfügen', exact: true }).tap();
await dritteSeite.waitForSelector('.dialog');
const dritterText = await dritteSeite.locator('.dialog-koerper').textContent();
pruefe(/Neu:/.test(dritterText || ''),
    `Ein eingefügter Link fragt ebenso vor dem Übernehmen (${dritterText?.trim()})`);
await dritteSeite.locator('.dialog-knoepfe button').first().tap();
await dritteSeite.locator('#tab-liste').tap();
await dritteSeite.waitForSelector('#bereich-liste .listenkarte');
const listeAusLink = await dritteSeite.locator('#bereich-liste .karte-name').allTextContents();
pruefe(listeVorQr.every((name) => listeAusLink.includes(name)),
    `Dieselbe Liste kommt auch über den Link an (${listeAusLink.length} von ${listeVorQr.length})`);
await drittesGeraet.close();

/* Ein Text ohne Foxi-Liste darf nicht stillschweigend etwas tun. */
await seite.locator('#tab-mehr').tap();
await seite.evaluate(() => navigator.clipboard.writeText('https://example.org/irgendwas'));
await seite.getByRole('button', { name: 'Link einfügen', exact: true }).tap();
await seite.waitForSelector('.dialog input');
await seite.locator('.dialog input').fill('https://example.org/ohne-liste');
await seite.locator('.dialog-knoepfe button.primary').tap();
await seite.waitForTimeout(250);
pruefe((await seite.locator('#toast').textContent())?.includes('keine EinkaufsFuchs-Liste'),
    'Ein Link ohne Liste sagt das und tut nichts');
/* Der Dialog schließt sich selbst, sobald ein Knopf gewirkt hat – hier ist
   also nichts mehr wegzuräumen. */
pruefe(await seite.locator('.dialog').count() === 0, 'Danach steht kein Dialog mehr offen');

/* ── Experte: Teilen und Einlesen ───────────────────────────────────────── */
const fremdeListe = {
    typ: 'foxi-liste',
    version: 1,
    erzeugt: new Date().toISOString(),
    artikel: [
        { id: 'sekt', name: 'Sekt', kategorieId: 'getraenke', kategorieName: 'Getränke', icon: '🥂', menge: '2', notiz: '' },
        { id: 'grillanzuender', name: 'Grillanzünder', kategorieId: 'gibt-es-nicht', kategorieName: '', icon: '🔥', menge: '', notiz: '' }
    ]
};
const fremdePfad = join(tmpdir(), 'foxi-fremde-liste.json');
writeFileSync(fremdePfad, JSON.stringify(fremdeListe, null, 2), 'utf8');

await seite.locator('#tab-mehr').tap();
const [dateiwaehler] = await Promise.all([
    seite.waitForEvent('filechooser'),
    seite.getByRole('button', { name: 'Datei einlesen', exact: true }).tap()
]);
await dateiwaehler.setFiles(fremdePfad);
await seite.waitForSelector('.dialog');
const dialogText = await seite.locator('.dialog-koerper').textContent();
pruefe(dialogText?.includes('2 neue Artikel'),
    `Der Zusammenführungs-Dialog zeigt, was passieren würde (${dialogText?.trim()})`);
await seite.screenshot({ path: join(bilder, '10-zusammenfuehren.png') });

await seite.locator('.dialog-knoepfe .primary').tap();
await seite.waitForTimeout(300);
await seite.locator('#tab-liste').tap();
await seite.waitForSelector('#bereich-liste .listenkarte');
const listenNamen = await seite.locator('#bereich-liste .karte-name').allTextContents();
pruefe(listenNamen.includes('Sekt'), 'Ein eingelesener Artikel steht auf der Liste');
pruefe(listenNamen.includes('Grillanzünder'),
    'Ein unbekannter Artikel wird angelegt statt verworfen');
const sonstiges = await seite.locator('#bereich-liste .gruppe-kopf', { hasText: 'Sonstiges' }).count();
pruefe(sonstiges === 1, 'Er landet unter „Sonstiges", nicht in der ersten Kategorie');

/* ── Experte: Statistik ─────────────────────────────────────────────────── */
await seite.locator('#tab-mehr').tap();
await seite.waitForSelector('.statistikliste');
/* Ausdrücklich an einem benannten Artikel statt am ersten Eintrag: Butter
   steht inzwischen bei zwölf, weil der Abschnitt über die gelernten Mengen
   zweimal echt eingekauft hat. Milch ist die Zeile, die genau die zehn
   Durchgänge zählt – und die Prüfung sagt jetzt, welche sie meint. */
const stat = await seite.locator('.statistikliste li', { hasText: 'Milch' }).first().textContent();
pruefe(/10×/.test(stat || ''), `Die Statistik zählt die zehn Einkäufe (${stat?.trim()})`);
/* `fullPage` bringt hier nichts: Bei Foxi scrollt nicht die Seite, sondern
   der Bereich darin (`.bereich` liegt absolut mit eigenem Überlauf). Ein
   Ganzseiten-Bild zeigt deshalb nur den Ausschnitt am Anfang – hin scrollen
   ist der einzige Weg zu einem Bild, das hält, was der Dateiname verspricht. */
await seite.locator('.statistikliste').scrollIntoViewIfNeeded();
await seite.waitForTimeout(150);
await seite.screenshot({ path: join(bilder, '11-statistik.png') });

await seite.locator('.ort-feld').scrollIntoViewIfNeeded();
await seite.waitForTimeout(150);
await seite.screenshot({ path: join(bilder, '12-ort-und-teilen.png') });

/* ── Der volle Name auf dem breiten Schirm ──────────────────────────────── */
await seite.setViewportSize({ width: 768, height: 900 });
await seite.waitForTimeout(200);
pruefe(await seite.locator('.brand-lang').isVisible() && !(await seite.locator('.brand-kurz').isVisible()),
    'Ab 420 px steht „EinkaufsFuchs" in der Kopfzeile');
const kopfPasstBreit = await seite.evaluate(() => {
    const leiste = document.querySelector('.topbar');
    return leiste.scrollWidth <= leiste.clientWidth + 1;
});
pruefe(kopfPasstBreit, 'Auch mit vollem Namen läuft die Kopfzeile nicht über');
await seite.screenshot({ path: join(bilder, '13-name-breit.png') });

/* ── Die Schreibtisch-Ansicht ───────────────────────────────────────────────

   Quer und groß genug: Leiste links, Katalog dauerhaft daneben, Liste als
   Arbeitsfläche. Hoch oder klein: dieselbe App im Handy-Schnitt. Geprüft
   werden alle vier Formate, die im Haushalt vorkommen. */
async function schnitt() {
    return seite.evaluate(() => {
        const leiste = document.querySelector('.tableiste').getBoundingClientRect();
        const katalog = document.getElementById('bereich-katalog');
        const liste = document.getElementById('bereich-liste');
        return {
            leisteLinks: Math.round(leiste.left),
            leisteOben: Math.round(leiste.top),
            leisteBreite: Math.round(leiste.width),
            leisteHoehe: Math.round(leiste.height),
            katalogSichtbar: !katalog.hidden,
            katalogLinks: Math.round(katalog.getBoundingClientRect().left),
            listeSichtbar: !liste.hidden,
            listeLinks: Math.round(liste.getBoundingClientRect().left),
            katalogReiter: getComputedStyle(document.getElementById('tab-katalog')).display,
            fensterbreite: window.innerWidth
        };
    });
}

await seite.locator('#tab-liste').tap();
await seite.setViewportSize({ width: 1280, height: 800 });
await seite.waitForTimeout(250);
const schreibtisch = await schnitt();
pruefe(schreibtisch.leisteLinks === 0 && schreibtisch.leisteHoehe > 400 &&
    schreibtisch.leisteBreite < 160,
    `Am Schreibtisch steht die Leiste links (${schreibtisch.leisteBreite}×${schreibtisch.leisteHoehe} px)`);
pruefe(schreibtisch.katalogSichtbar && schreibtisch.listeSichtbar &&
    schreibtisch.katalogLinks < schreibtisch.listeLinks,
    'Katalog und Liste stehen nebeneinander, der Katalog links');
/* Der Reiter hätte kein Ziel mehr – die Kachelwand steht ja schon da. */
pruefe(schreibtisch.katalogReiter === 'none', 'Der Katalog-Reiter ist ausgeblendet');

/* Der eigentliche Gewinn: Kachel links antippen, Zeile rechts erscheint –
   ohne Bereichswechsel. */
const vorher = Number((await seite.locator('#tab-liste-zahl').textContent()) || '0');
await seite.locator('#katalog-suche').fill('Zitronen');
await seite.waitForSelector('#bereich-katalog .kachel');
await seite.locator('#bereich-katalog .kachel').first().click();
await seite.waitForTimeout(250);
const nachher = await schnitt();
pruefe(Number(await seite.locator('#tab-liste-zahl').textContent()) === vorher + 1 &&
    nachher.listeSichtbar && nachher.katalogSichtbar,
    'Ein Tipp in der Katalogspalte füllt die Liste daneben');
await seite.locator('#katalog-suche').fill('');
await seite.waitForTimeout(150);
await seite.screenshot({ path: join(bilder, '17-schreibtisch.png') });

/* Tablet quer: dasselbe. Tablet hoch: Handy-Schnitt – obwohl breit genug. */
await seite.setViewportSize({ width: 1112, height: 834 });
await seite.waitForTimeout(250);
pruefe((await schnitt()).katalogSichtbar, 'Das Tablet im Querformat bekommt die Schreibtisch-Ansicht');

await seite.setViewportSize({ width: 834, height: 1112 });
await seite.waitForTimeout(250);
const tabletHoch = await schnitt();
pruefe(!tabletHoch.katalogSichtbar && tabletHoch.leisteLinks === 0 &&
    tabletHoch.leisteBreite === tabletHoch.fensterbreite,
    'Das Tablet im Hochformat bleibt in der Handy-Ansicht');

/* Und das Telefon bleibt in der Handy-Ansicht, auch quer: über 900 px breit,
   aber keine 480 px hoch. */
await seite.setViewportSize({ width: 926, height: 428 });
await seite.waitForTimeout(250);
const telefonQuer = await schnitt();
pruefe(!telefonQuer.katalogSichtbar && telefonQuer.katalogReiter !== 'none',
    'Das Telefon bleibt auch quer in der Handy-Ansicht');

/* ── Der Rahmen sitzt noch ──────────────────────────────────────────────────

   Nach einem ganzen Durchlauf mit Dialogen, Feldern und Bereichswechseln muss
   die untere Leiste noch im Bild stehen. Ist der Rahmen verschoben, kommt man
   an Katalog und Mehr nicht mehr heran – man sitzt in der Liste fest. Am
   Schreibtisch kann das nur eine Verschiebung des Fensters auslösen; auf iOS
   kommt die Bildschirmtastatur dazu, gegen die `rahmenZurueckholen()` in
   `schale.js` steht. */
await seite.setViewportSize({ width: 390, height: 844 });
await seite.locator('#tab-liste').tap();
await seite.waitForTimeout(200);
const rahmen = await seite.evaluate(() => {
    const leiste = document.querySelector('.tableiste').getBoundingClientRect();
    return {
        scrollY: window.scrollY,
        versatz: window.visualViewport?.offsetTop || 0,
        unterkante: Math.round(leiste.bottom),
        fensterhoehe: window.innerHeight
    };
});
pruefe(rahmen.scrollY === 0 && rahmen.versatz === 0,
    `Das Fenster steht unverschoben (Rollstand ${rahmen.scrollY}, Versatz ${rahmen.versatz})`);
pruefe(rahmen.unterkante <= rahmen.fensterhoehe + 1 && rahmen.unterkante > rahmen.fensterhoehe - 120,
    `Die untere Leiste steht im Bild (Unterkante ${rahmen.unterkante} von ${rahmen.fensterhoehe})`);

/* Doppeltipp-Zoom: Zweimal kurz auf dieselbe Zeile (abhaken, zurückholen)
   darf die App nicht heranzoomen – sonst liegt die Leiste außerhalb. Den
   Zoom selbst kann Chromium nicht nachstellen, die Sperre schon. */
const beruehrung = await seite.evaluate(() => ({
    karte: getComputedStyle(document.querySelector('.listenkarte')).touchAction,
    reiter: getComputedStyle(document.querySelector('.tab')).touchAction,
    seite: getComputedStyle(document.body).touchAction
}));
pruefe(Object.values(beruehrung).every((wert) => wert === 'manipulation'),
    `Ein Doppeltipp zoomt nicht heran (${Object.values(beruehrung).join(', ')})`);

/* Die Leiste folgt dem Fenster, wenn es seine Höhe ändert – so wie beim
   Zurückkehren aus dem Hintergrund oder nach der Tastatur. */
const vorherGroesse = seite.viewportSize();
await seite.setViewportSize({ width: vorherGroesse.width, height: vorherGroesse.height - 150 });
await seite.waitForTimeout(150);
const kleiner = await seite.evaluate(() => Math.round(document.querySelector('.tableiste').getBoundingClientRect().bottom) - window.innerHeight);
await seite.setViewportSize(vorherGroesse);
await seite.waitForTimeout(150);
const wieder = await seite.evaluate(() => Math.round(document.querySelector('.tableiste').getBoundingClientRect().bottom) - window.innerHeight);
pruefe(Math.abs(kleiner) <= 1 && Math.abs(wieder) <= 1,
    `Die Leiste bleibt am unteren Rand, auch wenn sich die Fensterhöhe ändert (${kleiner}, ${wieder})`);

/* ── Netz und Regeln ────────────────────────────────────────────────────── */
pruefe(fremdeAnfragen.length === 0,
    `Keine fremde Adresse im Netzwerk${fremdeAnfragen.length ? `: ${fremdeAnfragen.join(', ')}` : ''}`);
pruefe(fehlerAufDerSeite.length === 0,
    `Kein Fehler und kein CSP-Verstoß auf der Seite${fehlerAufDerSeite.length ? `: ${fehlerAufDerSeite.join(' | ')}` : ''}`);

await browser.close();
server.kill();

const gefallen = befunde.filter((b) => !b.gut);
console.log(`\n${befunde.length - gefallen.length}/${befunde.length} Prüfungen bestanden.`);
console.log(`Bilder in ${bilder}`);
process.exit(gefallen.length ? 1 : 0);
