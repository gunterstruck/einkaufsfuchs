/**
 * Ein QR-Erzeuger, so klein wie er sein darf und so genau wie er sein muss.
 *
 * Warum selbst gebaut: Foxi hat **keine Laufzeit-Abhängigkeit** und keinen
 * Bauschritt, und die Auslieferung setzt `default-src 'self'`. Eine Bibliothek
 * von einem fremden Server einzubinden verstieße gegen beides. Also steht der
 * Erzeuger hier – vollständig, lesbar und ohne Netz.
 *
 * Umfang mit Absicht begrenzt:
 *
 * - nur **Byte-Modus** (UTF-8). Foxi codiert base64url; der alphanumerische
 *   Modus wäre dichter, kennt aber keine Kleinbuchstaben.
 * - nur Stufe **L** und **M**. Bildschirm → Kamera ist ein sauberer Kanal;
 *   hohe Fehlerkorrektur kostet hier nur Kapazität.
 * - Versionen **1–25**. Version 25 sind 117×117 Module und fasst weit mehr,
 *   als eine Einkaufsliste je braucht. Alles darüber liest eine Handykamera
 *   vom Bildschirm ohnehin nicht mehr zuverlässig.
 *
 * Geprüft wird nicht gegen sich selbst: `tests/qr.test.js` vergleicht die
 * erzeugten Module Punkt für Punkt mit den Fingerabdrücken einer unabhängigen
 * Umsetzung (`qrcode` auf npm), über alle Versionen und beide Stufen.
 */

/* ────────────────────────────────────────────────────────────────────────
   Tabellen aus der Norm

   Alle drei sind aus der Referenzumsetzung erzeugt, nicht abgetippt.
   ──────────────────────────────────────────────────────────────────────── */

/** Codewörter (Daten + Fehlerkorrektur) je Version. */
const GESAMT_CODEWOERTER = [
    26, 44, 70, 100, 134, 172, 196, 242, 292, 346, 404, 466, 532, 581, 655,
    733, 815, 901, 991, 1085, 1156, 1258, 1364, 1474, 1588
];

/** Je Version: [Anzahl Blöcke, Fehlerkorrektur-Codewörter insgesamt]. */
const BLOECKE = {
    L: [[1, 7], [1, 10], [1, 15], [1, 20], [1, 26], [2, 36], [2, 40], [2, 48],
        [2, 60], [4, 72], [4, 80], [4, 96], [4, 104], [4, 120], [6, 132],
        [6, 144], [6, 168], [6, 180], [7, 196], [8, 224], [8, 224], [9, 252],
        [9, 270], [10, 300], [12, 312]],
    M: [[1, 10], [1, 16], [1, 26], [2, 36], [2, 48], [4, 64], [4, 72], [4, 88],
        [5, 110], [5, 130], [5, 150], [8, 176], [9, 198], [9, 216], [10, 240],
        [10, 280], [11, 308], [13, 338], [14, 364], [16, 416], [17, 442],
        [17, 476], [18, 504], [20, 560], [21, 588]]
};

/** Mittelpunkte der Ausrichtungsmuster je Version. */
const AUSRICHTUNG = [
    [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42],
    [6, 26, 46], [6, 28, 50], [6, 30, 54], [6, 32, 58], [6, 34, 62],
    [6, 26, 46, 66], [6, 26, 48, 70], [6, 26, 50, 74], [6, 30, 54, 78],
    [6, 30, 56, 82], [6, 30, 58, 86], [6, 34, 62, 90], [6, 28, 50, 72, 94],
    [6, 26, 50, 74, 98], [6, 30, 54, 78, 102], [6, 28, 54, 80, 106],
    [6, 32, 58, 84, 110]
];

/** Die zwei Bits, mit denen die Stufe im Formatfeld steht. */
const STUFENBITS = { L: 0b01, M: 0b00 };

export const HOECHSTE_VERSION = GESAMT_CODEWOERTER.length;

/* ────────────────────────────────────────────────────────────────────────
   Rechnen im Galois-Feld GF(256)

   Die Fehlerkorrektur rechnet nicht mit gewöhnlichen Zahlen, sondern in
   einem endlichen Körper. Zwei Tabellen ersetzen die Multiplikation.
   ──────────────────────────────────────────────────────────────────────── */

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
    let x = 1;
    for (let i = 0; i < 255; i++) {
        EXP[i] = x;
        LOG[x] = i;
        x <<= 1;
        if (x & 0x100) x ^= 0x11d;   /* das Normpolynom x⁸+x⁴+x³+x²+1 */
    }
    for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

const mal = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

/**
 * Das Generatorpolynom für `anzahl` Fehlerkorrektur-Codewörter:
 * (x−α⁰)(x−α¹)…(x−α^(anzahl−1)).
 *
 * Die Schleife baut es mit dem kleinsten Glied vorn auf; zurückgegeben wird
 * es **umgedreht**, also mit dem höchsten Glied zuerst. Das ist die
 * Reihenfolge, die die Division unten erwartet – dieselbe Rechnung in der
 * falschen Richtung liefert lauter plausible, aber falsche Codewörter.
 */
function generator(anzahl) {
    let poly = [1];
    for (let i = 0; i < anzahl; i++) {
        const neu = new Array(poly.length + 1).fill(0);
        for (let j = 0; j < poly.length; j++) {
            neu[j] ^= mal(poly[j], EXP[i]);
            neu[j + 1] ^= poly[j];
        }
        poly = neu;
    }
    return poly.reverse();
}

/** Die Fehlerkorrektur-Codewörter zu einem Datenblock. */
function fehlerkorrektur(daten, anzahl) {
    const poly = generator(anzahl);
    const rest = new Uint8Array(anzahl);
    for (const wort of daten) {
        const faktor = wort ^ rest[0];
        rest.copyWithin(0, 1);
        rest[anzahl - 1] = 0;
        if (faktor !== 0) {
            for (let i = 0; i < anzahl; i++) rest[i] ^= mal(poly[i + 1], faktor);
        }
    }
    return rest;
}

/* ────────────────────────────────────────────────────────────────────────
   Von der Zeichenkette zu den Codewörtern
   ──────────────────────────────────────────────────────────────────────── */

function datenCodewoerter(bytes, version, stufe) {
    const [anzahlBloecke, ecGesamt] = BLOECKE[stufe][version - 1];
    const gesamt = GESAMT_CODEWOERTER[version - 1];
    const datenWoerter = gesamt - ecGesamt;

    /* Modus 0100 (Byte), dann die Länge: bis Version 9 in 8 Bit, darüber in
       16. Genau hier springt die Kapazität, weshalb die Versionswahl die
       Länge mitrechnen muss. */
    const laengenBits = version < 10 ? 8 : 16;
    const bits = [];
    const schreibe = (wert, anzahl) => {
        for (let i = anzahl - 1; i >= 0; i--) bits.push((wert >> i) & 1);
    };
    schreibe(0b0100, 4);
    schreibe(bytes.length, laengenBits);
    for (const b of bytes) schreibe(b, 8);

    /* Abschluss, dann auf volle Codewörter auffüllen, dann mit dem in der
       Norm festgelegten Muster 11101100 00010001 bis zum Ende. */
    const kapazitaet = datenWoerter * 8;
    for (let i = 0; i < 4 && bits.length < kapazitaet; i++) bits.push(0);
    while (bits.length % 8 !== 0) bits.push(0);

    const woerter = [];
    for (let i = 0; i < bits.length; i += 8) {
        let wort = 0;
        for (let j = 0; j < 8; j++) wort = (wort << 1) | bits[i + j];
        woerter.push(wort);
    }
    const fueller = [0xec, 0x11];
    for (let i = 0; woerter.length < datenWoerter; i++) woerter.push(fueller[i % 2]);

    /* Blöcke: Die kurzen zuerst, die langen danach – und am Ende werden sie
       verschränkt, damit ein Kratzer über den Code nicht einen einzelnen
       Block zerstört, sondern sich auf alle verteilt. */
    const ecJeBlock = ecGesamt / anzahlBloecke;
    const kurzeBloecke = anzahlBloecke - (datenWoerter % anzahlBloecke);
    const kurzeLaenge = Math.floor(datenWoerter / anzahlBloecke);

    const daten = [];
    const ec = [];
    let gelesen = 0;
    for (let b = 0; b < anzahlBloecke; b++) {
        const laenge = kurzeLaenge + (b < kurzeBloecke ? 0 : 1);
        const block = woerter.slice(gelesen, gelesen + laenge);
        gelesen += laenge;
        daten.push(block);
        ec.push(fehlerkorrektur(block, ecJeBlock));
    }

    const folge = [];
    for (let i = 0; i <= kurzeLaenge; i++) {
        for (const block of daten) if (i < block.length) folge.push(block[i]);
    }
    for (let i = 0; i < ecJeBlock; i++) {
        for (const block of ec) folge.push(block[i]);
    }
    return folge;
}

/** Die kleinste Version, in die `bytes` bei dieser Stufe passen. */
function passendeVersion(bytes, stufe, hoechste) {
    for (let version = 1; version <= hoechste; version++) {
        const [, ecGesamt] = BLOECKE[stufe][version - 1];
        const datenBits = (GESAMT_CODEWOERTER[version - 1] - ecGesamt) * 8;
        const laengenBits = version < 10 ? 8 : 16;
        if (4 + laengenBits + bytes.length * 8 <= datenBits) return version;
    }
    return 0;
}

/* ────────────────────────────────────────────────────────────────────────
   Das Bild
   ──────────────────────────────────────────────────────────────────────── */

/* Zwei Felder statt eines mit Merkbits: `module` trägt hell/dunkel, `fest`
   merkt sich, wo ein Muster steht, das weder Daten aufnimmt noch maskiert
   wird. Getrennt gehalten, weil ein Merkbit im selben Byte genau die Art
   Fehler ergibt, die man später stundenlang sucht. */
function leeresFeld(groesse) {
    return {
        groesse,
        module: new Uint8Array(groesse * groesse),
        fest: new Uint8Array(groesse * groesse)
    };
}

const bei = (feld, zeile, spalte) => zeile * feld.groesse + spalte;
const dunkel = (feld, zeile, spalte) => feld.module[bei(feld, zeile, spalte)];

function setzeMuster(feld, version) {
    const groesse = feld.groesse;
    const setze = (zeile, spalte, wert) => {
        if (zeile < 0 || spalte < 0 || zeile >= groesse || spalte >= groesse) return;
        feld.module[bei(feld, zeile, spalte)] = wert;
        feld.fest[bei(feld, zeile, spalte)] = 1;
    };

    /* Die drei Suchmuster in den Ecken, mit ihrem hellen Rand. */
    for (const [zeile, spalte] of [[0, 0], [0, groesse - 7], [groesse - 7, 0]]) {
        for (let i = -1; i <= 7; i++) {
            for (let j = -1; j <= 7; j++) {
                const rand = i === -1 || i === 7 || j === -1 || j === 7;
                const ring = i === 0 || i === 6 || j === 0 || j === 6;
                const kern = i >= 2 && i <= 4 && j >= 2 && j <= 4;
                setze(zeile + i, spalte + j, rand ? 0 : (ring || kern) ? 1 : 0);
            }
        }
    }

    /* Die Taktlinien zwischen den Suchmustern. */
    for (let i = 8; i < groesse - 8; i++) {
        const wert = i % 2 === 0 ? 1 : 0;
        setze(6, i, wert);
        setze(i, 6, wert);
    }

    /* Die Ausrichtungsmuster – überall dort, wo kein Suchmuster steht. */
    const punkte = AUSRICHTUNG[version - 1];
    for (const zeile of punkte) {
        for (const spalte of punkte) {
            const beiSuchmuster =
                (zeile <= 8 && spalte <= 8) ||
                (zeile <= 8 && spalte >= groesse - 9) ||
                (zeile >= groesse - 9 && spalte <= 8);
            if (beiSuchmuster) continue;
            for (let i = -2; i <= 2; i++) {
                for (let j = -2; j <= 2; j++) {
                    const ring = Math.max(Math.abs(i), Math.abs(j));
                    setze(zeile + i, spalte + j, ring === 1 ? 0 : 1);
                }
            }
        }
    }

    /* Das eine immer dunkle Modul und die Plätze des Formatfelds, das erst
       nach der Maskenwahl geschrieben wird – belegt, damit dort keine Daten
       landen. */
    setze(groesse - 8, 8, 1);
    for (let i = 0; i <= 8; i++) {
        if (!feld.fest[bei(feld, 8, i)]) setze(8, i, 0);
        if (!feld.fest[bei(feld, i, 8)]) setze(i, 8, 0);
    }
    for (let i = 0; i < 8; i++) {
        if (!feld.fest[bei(feld, 8, groesse - 1 - i)]) setze(8, groesse - 1 - i, 0);
        if (!feld.fest[bei(feld, groesse - 1 - i, 8)]) setze(groesse - 1 - i, 8, 0);
    }

    /* Ab Version 7 steht die Versionsnummer zweimal im Bild. */
    if (version >= 7) {
        let rest = version;
        for (let i = 0; i < 12; i++) rest = (rest << 1) ^ ((rest >>> 11) * 0x1f25);
        const bits = (version << 12) | rest;
        for (let i = 0; i < 18; i++) {
            const bit = (bits >> i) & 1;
            setze(Math.floor(i / 3), groesse - 11 + (i % 3), bit);
            setze(groesse - 11 + (i % 3), Math.floor(i / 3), bit);
        }
    }
}

/** Die Datenbits im Zickzack von rechts unten nach links oben. */
function setzeDaten(feld, codewoerter) {
    const groesse = feld.groesse;
    let bit = 0;
    const naechstes = () => {
        const wort = codewoerter[bit >> 3];
        const wert = wort === undefined ? 0 : (wort >> (7 - (bit & 7))) & 1;
        bit++;
        return wert;
    };

    for (let rechts = groesse - 1; rechts >= 1; rechts -= 2) {
        if (rechts === 6) rechts = 5;   /* die senkrechte Taktlinie wird übersprungen */
        for (let schritt = 0; schritt < groesse; schritt++) {
            const aufwaerts = ((rechts + 1) & 2) === 0;
            const zeile = aufwaerts ? groesse - 1 - schritt : schritt;
            for (const spalte of [rechts, rechts - 1]) {
                if (feld.fest[bei(feld, zeile, spalte)]) continue;
                feld.module[bei(feld, zeile, spalte)] = naechstes();
            }
        }
    }
}

const MASKEN = [
    (z, s) => (z + s) % 2 === 0,
    (z) => z % 2 === 0,
    (z, s) => s % 3 === 0,
    (z, s) => (z + s) % 3 === 0,
    (z, s) => (Math.floor(z / 2) + Math.floor(s / 3)) % 2 === 0,
    (z, s) => ((z * s) % 2) + ((z * s) % 3) === 0,
    (z, s) => (((z * s) % 2) + ((z * s) % 3)) % 2 === 0,
    (z, s) => (((z + s) % 2) + ((z * s) % 3)) % 2 === 0
];

/**
 * Die Strafpunkte aus der Norm. Sie bewerten, wie schwer ein Bild zu lesen
 * ist: lange gleichfarbige Strecken, Blöcke, Muster, die dem Suchmuster
 * ähneln, und ein schiefes Verhältnis von Hell zu Dunkel.
 */
function strafpunkte(feld) {
    const groesse = feld.groesse;
    const w = (z, s) => dunkel(feld, z, s);
    let punkte = 0;

    for (let z = 0; z < groesse; z++) {
        for (const waagerecht of [true, false]) {
            let lauf = 1;
            for (let s = 1; s < groesse; s++) {
                const a = waagerecht ? w(z, s) : w(s, z);
                const b = waagerecht ? w(z, s - 1) : w(s - 1, z);
                if (a === b) {
                    lauf++;
                    if (lauf === 5) punkte += 3;
                    else if (lauf > 5) punkte += 1;
                } else lauf = 1;
            }
        }
    }

    for (let z = 0; z < groesse - 1; z++) {
        for (let s = 0; s < groesse - 1; s++) {
            const eck = w(z, s);
            if (eck === w(z, s + 1) && eck === w(z + 1, s) && eck === w(z + 1, s + 1)) {
                punkte += 3;
            }
        }
    }

    /* Regel 3: das Streifenmuster des Suchmusters (1011101) mit vier hellen
       Modulen davor oder dahinter – 40 Punkte je Fund. Es wird mit einem
       gleitenden Fenster von elf Modulen gesucht, das komplett im Symbol
       liegen muss. Der Rand außerhalb zählt ausdrücklich **nicht** als hell;
       täte er es, fände man das Muster an jeder Kante, und die Maskenwahl
       liefe auf eine andere als bei jedem gängigen Leser hinaus. */
    const VORNE = 0b10111010000;
    const HINTEN = 0b00001011101;
    for (let z = 0; z < groesse; z++) {
        let zeileFenster = 0;
        let spalteFenster = 0;
        for (let s = 0; s < groesse; s++) {
            zeileFenster = ((zeileFenster << 1) & 0x7ff) | w(z, s);
            spalteFenster = ((spalteFenster << 1) & 0x7ff) | w(s, z);
            if (s < 10) continue;
            if (zeileFenster === VORNE || zeileFenster === HINTEN) punkte += 40;
            if (spalteFenster === VORNE || spalteFenster === HINTEN) punkte += 40;
        }
    }

    let dunkleModule = 0;
    for (let z = 0; z < groesse; z++) {
        for (let s = 0; s < groesse; s++) dunkleModule += w(z, s);
    }
    /* Der Anteil dunkler Module soll nahe der Hälfte liegen. Gerundet wird
       wie in der Norm auf das nächste Vielfache von fünf Prozent – nicht
       abgeschnitten, sonst fällt eine Maske bei 47 % durch und eine bei
       53 % nicht. */
    const anteil = (dunkleModule * 100) / (groesse * groesse);
    punkte += (Math.abs(Math.ceil(anteil / 5) * 5 - 50) / 5) * 10;
    return punkte;
}

function setzeFormat(feld, stufe, maske) {
    const groesse = feld.groesse;
    const roh = (STUFENBITS[stufe] << 3) | maske;
    let rest = roh;
    for (let i = 0; i < 10; i++) rest = (rest << 1) ^ ((rest >>> 9) * 0x537);
    const bits = ((roh << 10) | rest) ^ 0x5412;

    const setze = (zeile, spalte, wert) => {
        feld.module[bei(feld, zeile, spalte)] = wert;
        feld.fest[bei(feld, zeile, spalte)] = 1;
    };

    /* Fünfzehn Bits, zweimal im Bild: einmal um die linke obere Ecke herum,
       einmal verteilt an den beiden anderen Suchmustern. Eine beschädigte
       Ecke macht das Symbol so nicht unlesbar. */
    for (let i = 0; i < 15; i++) {
        const bit = (bits >> i) & 1;
        if (i < 6) setze(i, 8, bit);
        else if (i === 6) setze(7, 8, bit);
        else if (i === 7) setze(8, 8, bit);
        else if (i === 8) setze(8, 7, bit);
        else setze(8, 14 - i, bit);

        if (i < 8) setze(8, groesse - 1 - i, bit);
        else setze(groesse - 15 + i, 8, bit);
    }
}

/**
 * Einen QR-Code erzeugen.
 *
 * @param {string} text
 * @param {{stufe?: 'L'|'M', hoechsteVersion?: number}} [wahl]
 * @returns {{version: number, groesse: number, module: Uint8Array}}
 *          `module` ist zeilenweise, 1 = dunkel.
 * @throws wenn der Text in keine erlaubte Version passt.
 */
export function qrErzeugen(text, { stufe = 'L', hoechsteVersion = HOECHSTE_VERSION } = {}) {
    if (!(stufe in STUFENBITS)) throw new Error(`Unbekannte Stufe: ${stufe}`);
    const bytes = new TextEncoder().encode(String(text));
    const grenze = Math.min(hoechsteVersion, HOECHSTE_VERSION);
    const version = passendeVersion(bytes, stufe, grenze);
    if (!version) throw new Error('Zu viele Daten für einen QR-Code');

    const groesse = version * 4 + 17;
    const codewoerter = datenCodewoerter(bytes, version, stufe);

    /* Acht Masken, acht Bilder, das mit den wenigsten Strafpunkten gewinnt.
       Die Norm schreibt die Wahl so vor; sie verhindert Bilder, in denen
       große gleichfarbige Flächen oder suchmusterähnliche Streifen stehen. */
    let bestes = null;
    let bestPunkte = Infinity;
    MASKEN.forEach((maske, nummer) => {
        const feld = leeresFeld(groesse);
        setzeMuster(feld, version);
        setzeDaten(feld, codewoerter);
        for (let z = 0; z < groesse; z++) {
            for (let s = 0; s < groesse; s++) {
                if (feld.fest[bei(feld, z, s)]) continue;
                if (maske(z, s)) feld.module[bei(feld, z, s)] ^= 1;
            }
        }
        setzeFormat(feld, stufe, nummer);
        const punkte = strafpunkte(feld);
        if (punkte < bestPunkte) { bestPunkte = punkte; bestes = feld; }
    });

    return { version, groesse, module: bestes.module };
}

/**
 * Den Code auf ein Canvas malen. Immer schwarz auf weiß und mit dem hellen
 * Rand von vier Modulen, den die Norm verlangt: Ohne ihn findet eine Kamera
 * das Symbol auf einem farbigen Untergrund nicht.
 */
export function qrZeichnen(canvas, code, kantenlaenge = 320) {
    const rand = 4;
    const gesamt = code.groesse + rand * 2;
    const punkt = Math.max(1, Math.floor(kantenlaenge / gesamt));
    const seite = punkt * gesamt;

    canvas.width = seite;
    canvas.height = seite;
    const stift = canvas.getContext('2d');
    stift.fillStyle = '#ffffff';
    stift.fillRect(0, 0, seite, seite);
    stift.fillStyle = '#000000';
    for (let z = 0; z < code.groesse; z++) {
        for (let s = 0; s < code.groesse; s++) {
            if (!code.module[z * code.groesse + s]) continue;
            stift.fillRect((s + rand) * punkt, (z + rand) * punkt, punkt, punkt);
        }
    }
    return seite;
}
