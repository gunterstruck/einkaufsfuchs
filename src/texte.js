/**
 * Alle sichtbaren Texte an einem Ort.
 *
 * Foxi spricht Deutsch. Eine Übersetzung ist heute nicht gebaut – aber sie
 * soll später keine Suche durch dreißig Dateien werden. Deshalb steht hier
 * jeder Satz, den ein Mensch zu sehen bekommt, und nirgendwo sonst.
 *
 * Zwei Ausnahmen, bewusst: „EinkaufsFuchs" und „Foxi" werden nicht übersetzt.
 * Der Name ist der Name.
 */

export const SPRACHE = 'de';

const DE = {
    /**
     * Zwei Namen für dieselbe App – und eine Regel, wann welcher gilt.
     *
     * `name` steht dort, wo die App sich vorstellt: Fenstertitel,
     * Startbildschirm-Eintrag, Fußzeile, weitergegebene Texte. Er stellt sie
     * neben TourFuchs und SoundFuchs, wo sie hingehört.
     *
     * `kurz` steht dort, wo sie benutzt wird. „Hol das mal in Foxi rein"
     * sagt sich leichter als das Kompositum, und in einer Kopfzeile von
     * 360 px konkurriert er nicht mit dem Tiefenschalter.
     *
     * `anspruch` gehört nur zur Kurzform: Neben „EinkaufsFuchs" wäre
     * „Einkauf" eine Wiederholung.
     */
    app: {
        name: 'EinkaufsFuchs',
        kurz: 'Foxi',
        anspruch: 'Einkauf',
        titel: 'EinkaufsFuchs – Einkaufsliste'
    },

    tiefe: {
        basis: '🌱 Basis',
        experte: '🛠️ Experte',
        beschriftung: 'Ansichtstiefe wählen',
        hinweis: 'Basis zeigt nur Liste und Katalog · Experte blendet zusätzliche Angaben ein',
        gewechseltZuBasis: 'Basis. Nichts geht verloren – es wird nur weniger angezeigt.',
        /* Der Satz nennt nur, was es schon gibt. Rezepte, Teilen und Statistik
           kommen dazu, sobald sie gebaut sind – bis dahin verspricht der
           Schalter sie nicht. */
        gewechseltZuExperte: 'Experte. Produktwünsche und Fotos sind jetzt da.'
    },

    bereiche: {
        liste: 'Liste',
        katalog: 'Katalog',
        mehr: 'Mehr',
        beschriftung: 'Bereiche'
    },

    liste: {
        titel: 'Einkaufsliste',
        leerTitel: 'Noch nichts auf der Liste',
        leerText: 'Tipp im Katalog auf eine Kachel – der Artikel steht sofort hier.',
        leerKnopf: 'Zum Katalog',
        erledigt: 'Erledigt',
        erledigtAufraeumen: 'Erledigte entfernen',
        erledigteEntfernt: 'Erledigte entfernt',
        abgehakt: (name) => `${name} abgehakt`,
        zurueckgeholt: (name) => `${name} zurück auf der Liste`,
        entfernt: (name) => `${name} entfernt`,
        offeneAnzahl: (n) => (n === 1 ? '1 Artikel offen' : `${n} Artikel offen`),
        artikelEntfernen: 'Von der Liste nehmen',
        /* Für Vorlesehilfen: Die Zeile ist ein Knopf, und was er tut, hängt
           davon ab, ob der Artikel schon abgehakt ist. */
        stimmeOffen: (name) => `${name} – antippen zum Abhaken`,
        stimmeErledigt: (name) => `${name} – erledigt, antippen zum Zurückholen`,
        stimmeMenge: (name) => `Produktwunsch und Foto für ${name}`
    },

    katalog: {
        titel: 'Katalog',
        suche: 'Artikel suchen…',
        sucheBeschriftung: 'Im Katalog suchen',
        oftGebraucht: 'Oft gebraucht',
        keinTreffer: 'Nichts gefunden.',
        keinTrefferAnlegen: (name) => `„${name}" anlegen`,
        angelegt: (name) => `${name} angelegt und auf der Liste`,
        hinzugefuegt: (name) => `${name} auf der Liste`,
        entfernt: (name) => `${name} von der Liste genommen`,
        aufDerListe: 'auf der Liste'
    },

    mehr: {
        titel: 'Mehr',
        ueberTitel: 'Über EinkaufsFuchs',
        ueberText:
            'EinkaufsFuchs – kurz Foxi – ist eine Einkaufsliste für den Haushalt. ' +
            'Alles, was du eingibst, bleibt auf diesem Gerät: kein Konto, kein Login, ' +
            'keine Cloud, keine Werbung, keine Auswertung. Foxi funktioniert ohne Internet.',
        datenTitel: 'Deine Daten',
        listeLeeren: 'Liste leeren',
        listeLeerenFrage: 'Alle Artikel von der Liste nehmen?',
        listeGeleert: 'Liste ist leer',
        allesZuruecksetzen: 'Foxi zurücksetzen',
        allesZuruecksetzenFrage:
            'Liste, Kaufhistorie und eigene Artikel löschen und den Katalog neu aufsetzen?',
        allesZurueckgesetzt: 'Foxi ist zurückgesetzt',
        version: (v) => `Version ${v}`,
        lizenz: 'MIT-Lizenz · frei zu benutzen und weiterzugeben'
    },

    rezepte: {
        titel: 'Rezepte',
        erklaerung: 'Ein Tipp legt alle Zutaten auf einmal auf die Liste.',
        leer: 'Noch keine Rezepte. Leg deine aktuelle Liste als Rezept ab.',
        ausListe: 'Aktuelle Liste als Rezept sichern',
        ausListeLeer: 'Dafür muss etwas auf der Liste stehen.',
        nameFrage: 'Wie soll das Rezept heißen?',
        namePlatzhalter: 'z. B. Sonntagsfrühstück',
        gesichert: (name) => `„${name}" gesichert`,
        uebertragen: (name, n) =>
            n === 0 ? `Alles aus „${name}" steht schon auf der Liste`
                : n === 1 ? `1 Zutat aus „${name}" auf die Liste`
                    : `${n} Zutaten aus „${name}" auf die Liste`,
        loeschen: 'Löschen',
        loeschenFrage: (name) => `Rezept „${name}" löschen?`,
        geloescht: (name) => `„${name}" gelöscht`,
        zutaten: (n) => (n === 1 ? '1 Zutat' : `${n} Zutaten`)
    },

    kategorien: {
        titel: 'Reihenfolge im Laden',
        erklaerung:
            'Zieh die Kategorien in die Reihenfolge, in der du den Laden abläufst. ' +
            'Die Liste sortiert sich danach.',
        griff: (name) => `${name} verschieben`,
        hoch: 'Nach oben',
        runter: 'Nach unten',
        gespeichert: 'Reihenfolge gemerkt',
        zuruecksetzen: 'Ursprüngliche Reihenfolge'
    },

    teilen: {
        titel: 'Teilen und Sichern',
        erklaerung:
            'Foxi verschickt nichts von selbst. Die Liste wird zu einer Datei, ' +
            'und du entscheidest, wohin sie geht.',
        alsDatei: 'Liste als Datei teilen',
        alsText: 'Liste als Text kopieren',
        importieren: 'Datei einlesen',
        dateiName: (datum) => `einkaufsfuchs-liste-${datum}.json`,
        kopiert: 'Liste in der Zwischenablage',
        kopiertArtikel: (name) => `„${name}" kopiert`,
        geteilt: 'Geteilt',
        abgebrochen: 'Nicht geteilt',
        leerNichtsZuTeilen: 'Die Liste ist leer.',
        geladen: 'Datei geladen',
        keineFoxiDatei: 'Das ist keine EinkaufsFuchs-Datei.',
        kaputteDatei: 'Die Datei lässt sich nicht lesen.',
        langDrueckenHinweis: 'Lange auf eine Kachel drücken kopiert den Artikelnamen.',
        stammartikel: 'Stammartikel kopieren',
        stammartikelLeer: 'Dafür muss erst ein paar Mal abgehakt worden sein.',
        stammartikelKopiert: (n) =>
            n === 1 ? '1 Stammartikel in der Zwischenablage' : `${n} Stammartikel in der Zwischenablage`
    },

    ort: {
        titel: 'Dein Ort',
        erklaerung:
            'Nur für die Texte, die du selbst weitergibst: Steht hier eine Postleitzahl, ' +
            'trägt sie der kopierte Text mit – dann weiß das Gegenüber, um welche Läden es geht. ' +
            'Foxi selbst fragt damit nichts ab und schickt nichts weg.',
        platzhalter: 'z. B. 45136 Essen',
        beschriftung: 'Postleitzahl und Ort',
        gemerkt: 'Ort gemerkt',
        geloescht: 'Ort entfernt'
    },

    angebote: {
        titel: 'Wochenangebote mit KI',
        erklaerung:
            'Foxi erstellt den Rechercheauftrag. Ein KI-Assistent prüft öffentliche Angebotsseiten. ' +
            'Du übernimmst seine Treffer anschließend wieder in Foxi.',
        einfuehrung:
            'Einmal geführt einrichten – danach genügen im Alltag Auftrag kopieren und Ergebnis übernehmen.',
        datenschutz:
            'Im Auftrag stehen nur dein gespeicherter Ort, aktivierte Märkte und passende Produktwünsche – kein Foto und keine Wohnadresse.',
        gefuehrtEinrichten: 'Geführt einrichten',
        soGehts: 'So funktioniert’s',
        auftragTitel: 'Foxi-Rechercheauftrag',
        auftragKopieren: 'Rechercheauftrag kopieren',
        auftragKopiert: 'Rechercheauftrag in der Zwischenablage',
        erneutPruefen: 'Erneut recherchieren',
        ergebnisEinfuegen: 'Aus Zwischenablage übernehmen',
        ergebnisdatei: 'Ergebnisdatei auswählen',
        ergebnisTitel: 'Ergebnis des KI-Assistenten übernehmen',
        ergebnisPlatzhalter: '{ "typ": "foxi-angebote", … }',
        ergebnisBeschriftung: 'Ergebnis des KI-Recherche-Assistenten',
        uebernehmen: 'Angebote übernehmen',
        ergebnisUngueltig: 'Das ist kein gültiges Foxi-Angebotsergebnis.',
        ergebnisZuGross: 'Die Ergebnisdatei ist zu groß.',
        ergebnisUebernommen: (n) =>
            n === 1 ? '1 aktuelles Angebot übernommen' : `${n} aktuelle Angebote übernommen`,
        nochKeinErgebnis: 'Noch kein Ergebnis eingelesen.',
        keineAktuellen: 'Das letzte Ergebnis enthält keine heute gültigen Treffer.',
        statusAktuell: (angebote, artikel, datum, bis) =>
            `${angebote} aktuelle Angebote für ${artikel} Artikel · gültig bis ${bis} · übernommen ${datum}`,
        meineMaerkte: (n) => `Meine Märkte (${n})`,
        maerkteHinweis: 'Nur aktivierte Märkte und ihr Ort werden in den kopierten Rechercheauftrag aufgenommen.',
        marktHinzufuegen: 'Markt hinzufügen',
        haendler: 'Händler',
        marktBeschriftung: 'Filiale oder Adresse',
        marktPlatzhalter: 'z. B. Steeler Straße 187, Essen',
        marktLokal: 'Die Auswahl bleibt in Foxi auf diesem Gerät. Erst du selbst übergibst sie mit dem kopierten Auftrag an eine KI.',
        marktFehlt: 'Bitte gib die Filiale oder Adresse an.',
        marktGespeichert: 'Markt lokal gespeichert.',
        angeboteAnzeigen: (n) => n === 1 ? '1 Angebot anzeigen' : `${n} Angebote anzeigen`,
        filialen: (n) => n === 1 ? '1 ausgewählte Filiale' : `${n} ausgewählte Filialen`,
        filialenAnzeigen: 'Filialen anzeigen',
        trefferAlternative: 'Alternative',
        niedrigsterGrundpreis: 'Niedrigster gefundener Grundpreis',
        gueltigBis: (datum) => `bis ${datum}`,
        quelle: 'Quelle',
        listenTreffer: (preis, haendler, bis, filialen) => `Angebot · ${preis} · ${haendler}${filialen > 1 ? ` · ${filialen} Filialen` : ''} · bis ${bis}`,
        listenAlternative: (preis, haendler, bis, filialen) => `Alternative · ${preis} · ${haendler}${filialen > 1 ? ` · ${filialen} Filialen` : ''} · bis ${bis}`,
        listenMehrere: (n, preis, bis) => `${n} Angebote · ab ${preis} · bis ${bis}`,
        keineMaerkte: 'Lege zuerst mindestens einen Markt unter „Meine Märkte“ an.',

        hilfeTitel: 'Wochenangebote mit KI einrichten',
        hilfeIntro:
            'Ein KI-Recherche-Assistent kann denselben Auftrag regelmäßig ausführen und Foxi ein Ergebnis zum Einlesen zurückgeben.',
        hilfeDatenschutz:
            'Erst wenn du den kopierten Auftrag in eine KI einfügst, verlassen die darin sichtbaren Angaben dein Gerät. Foxi überträgt nichts automatisch.',
        schritt1Titel: 'Auftrag aus Foxi kopieren',
        schritt1Text:
            'Der Auftrag enthält Suchregeln, gewünschte Artikel, ausgewählte Märkte und das Rückgabeformat.',
        schritt2Titel: 'KI-Recherche-Assistent wählen',
        schritt2Text:
            'Füge den Auftrag in einen Assistenten mit Webrecherche ein. Optional kannst du ihn dort als wöchentliche Aufgabe planen.',
        schritt3Titel: 'Treffer zurück zu Foxi',
        schritt3Text:
            'Der Assistent liefert möglichst eine Foxi-Datei. Alternativ kopierst du sein vollständiges Ergebnis und fügst es hier ein.',
        assistentOeffnen: 'Öffnen',
        anleitungOeffnen: 'Aufgaben einrichten',
        claudeText: 'Cowork kann wiederkehrende Webrecherchen und Dateien bearbeiten.',
        chatgptText: 'Geplante Aufgaben können regelmäßig im Web nach Änderungen suchen.',
        verstanden: 'Verstanden'
    },

    zusammenfuehren: {
        titel: 'Was soll übernommen werden?',
        neu: (n) => (n === 1 ? '1 neuer Artikel' : `${n} neue Artikel`),
        doppelt: (n) => (n === 1 ? '1 Artikel ist schon da' : `${n} Artikel sind schon da`),
        ueberschrieben: (n) =>
            n === 1 ? '1 Artikel bekommt eine andere Menge' : `${n} Artikel bekommen andere Mengen`,
        nichtsNeues: 'Nichts Neues in der Datei.',
        nurNeue: 'Nur die neuen übernehmen',
        allesUebernehmen: 'Alles übernehmen (Mengen überschreiben)',
        uebernommen: (n) => (n === 1 ? '1 Artikel übernommen' : `${n} Artikel übernommen`),
        unbekannteArtikel: (n) =>
            n === 1 ? '1 unbekannter Artikel wird angelegt' : `${n} unbekannte Artikel werden angelegt`
    },

    statistik: {
        titel: 'Was ihr oft kauft',
        erklaerung: 'Gezählt wird beim Abhaken. Die Zahlen bleiben auf diesem Gerät.',
        leer: 'Noch nichts abgehakt.',
        malGekauft: (n) => (n === 1 ? '1×' : `${n}×`),
        seit: (datum) => `zuletzt am ${datum}`
    },

    menge: {
        beschriftung: 'Menge',
        platzhalter: 'z. B. 1 kg',
        notizBeschriftung: 'Notiz',
        notizPlatzhalter: 'z. B. die kleinen',
        wunschBeschriftung: 'Was genau möchtest du kaufen?',
        wunschPlatzhalter: 'z. B. 1 kg · die kleinen',
        fotoHinzufuegen: 'Foto hinzufügen',
        fotoAendern: 'Foto ändern',
        fotoLoeschen: 'Foto entfernen',
        fotoFehler: 'Das Foto konnte nicht lokal gespeichert werden.',
        fertig: 'Fertig'
    },

    /**
     * Das Artikelblatt – aufgeklappt, was in der Zeile nur als Marke steht.
     *
     * Erreichbar über den Knopf neben der Zeile, nicht über die Zeile selbst:
     * Die Karte bleibt ungeteilt das Ziel zum Abhaken. Siehe KONZEPT 4.1.
     */
    blatt: {
        oeffnen: (name) => `${name} – Details und Angebote`,
        angeboteTitel: (n) => (n === 1 ? '1 Angebot' : `${n} Angebote`),
        keineAngebote: 'Zurzeit kein Angebot für diesen Artikel.',
        /* „alternative" heißt: ein ähnliches Produkt, nicht das gesuchte.
           Das muss dastehen – sonst behauptet die App ein Angebot, das es so
           nicht gibt. */
        alternative: 'Ähnliches Produkt',
        guenstigster: 'günstigster Grundpreis',
        gueltigBis: (datum) => `gültig bis ${datum}`,
        filialen: (n) => (n === 1 ? '1 Filiale' : `${n} Filialen`),
        beimHaendler: 'Beim Händler ansehen',
        quelleBeschriftung: (haendler) => `Angebot bei ${haendler} ansehen (öffnet extern)`,
        schliessen: 'Schließen'
    },

    allgemein: {
        abbrechen: 'Abbrechen',
        schliessen: 'Schließen',
        rueckgaengig: 'Rückgängig',
        laedt: 'Foxi startet…'
    }
};

const KATALOGE = { de: DE };

/**
 * Text holen. `t('liste.leerTitel')`.
 * Funktionen im Katalog werden mit den übergebenen Argumenten aufgerufen:
 * `t('liste.abgehakt', 'Milch')`.
 */
export function t(pfad, ...werte) {
    const wurzel = KATALOGE[SPRACHE] || DE;
    let wert = wurzel;
    for (const teil of pfad.split('.')) {
        if (wert == null) break;
        wert = wert[teil];
    }
    if (wert == null) return pfad;
    return typeof wert === 'function' ? wert(...werte) : wert;
}

export default DE;
