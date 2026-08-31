# EinkaufsFuchs – Konzept und Erkenntnisse

*Wissensbasis für Menschen und für KI-Agenten, die an diesem Projekt
weiterarbeiten. Wer nur wissen will, was die App tut, liest die
[README](../README.md). Wer verstehen will, **warum sie so ist**, liest hier.*

---

## 1. In einem Absatz

EinkaufsFuchs (kurz: Foxi) ist eine Einkaufsliste als Progressive Web App.
Artikel kommen durch Antippen einer Kachel auf die Liste, nicht durch
Schreiben. Der Katalog lernt aus dem Abhaken, was der Haushalt tatsächlich
braucht, und sortiert sich danach. Alles bleibt auf dem Gerät: kein Konto,
kein Backend, keine ausgehende Anfrage im Betrieb. Was die App nicht darf –
Preise, Angebote, Weltwissen – holt ein **KI-Agent außerhalb**, und ein
Mensch trägt den Text zwischen beiden hin und her. Kapitel 6 ist dieses
Konzept; es ist der interessanteste Teil des Projekts.

---

## 2. Die zwei Grundsätze

**I. Alle Daten bleiben auf dem Gerät.** Keine Cloud, kein Konto, kein
Login, kein Backend, kein Analytics, keine externen Anfragen im
Normalbetrieb. *Wenn eine Funktion diesen Grundsatz brechen würde, wird sie
nicht gebaut.*

**II. Einfachheit ist die Hauptfunktion.** Im Zweifel weglassen. Die App muss
ohne Erklärung bedienbar sein.

Diese beiden Sätze sind keine Präambel, sondern das Entscheidungsverfahren.
Fast jede Frage in diesem Projekt löst sich, indem man sie an Grundsatz I
oder II hält. Grundsatz I ist außerdem **technisch erzwungen**, nicht nur
zugesagt – siehe Kapitel 5.

Ein Nebeneffekt, der oft übersehen wird: Grundsatz I macht die App
*billiger*, nicht teurer. Kein Server, keine Datenschutzerklärung, keine
Auftragsverarbeitung, keine Betriebskosten, kein Wartungsvertrag. Das ist
der Grund, warum sie verschenkt werden kann.

---

## 3. Die zwei Namen

| | wo | Beispiel |
|---|---|---|
| **EinkaufsFuchs** | wo die App sich vorstellt | Fenstertitel, Startbildschirm, Fußzeile, weitergegebene Texte |
| **Foxi** | wo sie benutzt wird | Kopfzeile am Handy, „Foxi zurücksetzen", Erklärtexte |

Der volle Name stellt sie neben ihre Geschwister **TourFuchs** und
**SoundFuchs**; die Kurzform ist die, die ein Haushalt tatsächlich sagt.
Beides steht in `src/texte.js` als `app.name` und `app.kurz`.

Es ist zuerst eine Platzfrage: Auf 360 px teilt sich die Kopfzeile die Zeile
mit dem Basis/Experte-Schalter, und dreizehn Zeichen passen dort nicht neben
zwei Pillen. Ab 420 px wechselt sie auf den vollen Namen. Umgesetzt über
`display: none` statt über `aria-hidden` – das nimmt den jeweils anderen
Namen auch aus dem Barrierebaum, sodass Vorlesehilfen genau einen Namen zu
hören bekommen.

**Zwei Bezeichner bleiben `foxi` und dürfen nie umbenannt werden:**

- der Name der IndexedDB-Datenbank (`DB_NAME` in `src/db.js`)
- die Typkennung im Kopf der Austauschdatei (`DATEI_TYP` in `src/logik.js`)

Ein neuer Datenbankname wäre eine neue, **leere** Datenbank: Jede bestehende
Installation verlöre Liste, Kaufhistorie und eigene Artikel. Eine neue
Typkennung ließe die App ihre eigenen älteren Dateien als „fremd" abweisen.
Ein Bezeichner ist kein Schaufenster – er darf alt aussehen, solange er
stimmt.

---

## 4. Die vier Kernfunktionen

Abgeleitet aus einer Analyse erfolgreicher Apps am Markt (Bring!, AnyList).
Sie sind der Grund, warum Leute solche Apps behalten statt sie nach drei
Tagen zu löschen.

### 4.1 Kacheln statt Tippen

Artikel werden **angetippt, nicht geschrieben**. Getippt wird nur im
Ausnahmefall: wenn der Katalog etwas nicht kennt. Das ist der wichtigste
Punkt der ganzen App.

Die Kachel ist quadratisch, mindestens 98 px breit, mit einer Hand
erreichbar. Ein Tipp legt drauf, ein zweiter nimmt herunter – dieselbe
Kachel, beide Richtungen. Auf der Liste hakt ein Tipp ab.

**Keine weiteren Gesten.** Kein Wischen, kein Kontextmenü. Wer im Laden
steht, soll nicht raten müssen. Die einzige Ausnahme ist langes Drücken
(Kapitel 6.4), und die gibt es nur im Expertenmodus.

### 4.2 Automatische Kategorien

Jeder Artikel trägt eine Kategorie; die Liste gruppiert danach, in der
Reihenfolge eines Supermarkt-Laufwegs. Man geht den Laden einmal ab statt
viermal. Die Reihenfolge ist im Expertenmodus per Ziehen anpassbar.

Leere Kategorien fallen weg – die Liste zeigt den Laden, nicht das
Regalverzeichnis.

### 4.3 Rezepte

Ein Rezept ist **ein Name und eine Artikelliste**. Ein Tipp überträgt alle
Zutaten auf einmal. Kein Web-Import, keine Rezeptdatenbank, keine Bilder,
keine Mengen pro Zutat – das wäre eine Kochbuch-App.

Eigene Rezepte entstehen aus dem, was gerade auf der Liste steht. Das ist
der einzige Weg, und er ist Absicht: Ein eigener Zusammenbau-Bildschirm
(„Zutaten auswählen") wäre ein zweiter Katalog mit zweiter Suche, für eine
Aufgabe, die man einmal im Monat hat.

### 4.4 Der lernende Katalog

**Der eigentliche Zaubertrick, und er kostet fast nichts.**

Bei jedem Abhaken wandert ein Zeitstempel in `letzteKaeufe`. Daraus entsteht
ein Wert, der mit dem Alter abklingt:

```
score = Σ 0,5 ^ (alterInTagen / 30)
```

Der Katalog sortiert sich danach. Kein Menüpunkt, keine Einstellung, keine
Erklärung – es passiert einfach. Sobald es etwas zu zeigen gibt, führt der
Katalog mit einer Reihe „Oft gebraucht".

**Warum überhaupt vergessen?** Ohne Verfall gewinnt ewig, was man einmal
einen Monat lang täglich gekauft hat – und die Kachel stünde noch oben, wenn
das Kind längst ausgezogen ist. Die Halbwertszeit von 30 Tagen ist der
Kompromiss zwischen „reagiert auf Veränderung" und „vergisst nicht, was man
alle zwei Wochen braucht".

Nach etwa zwei Wochen stehen die zwölf Standardartikel des Haushalts auf dem
ersten Bildschirm. **Das ist der Moment, in dem sich die App „meine"
anfühlt** – und der einzige Punkt, an dem sie sich von einer Notizzettel-App
unterscheidet, ohne dass jemand etwas eingestellt hat.

---

## 5. Wie Grundsatz I durchgesetzt wird

Nicht durch Zusage, sondern durch drei Mechanismen, die einander stützen:

**Content-Security-Policy.** Die Auslieferung setzt
`default-src 'self'` (siehe `vercel.json`). Der Browser lässt fremde
Adressen gar nicht erst zu. Das geht nur, weil im Markup **kein einziges
Inline-Skript und keine Inline-Formatierung** steht – wer hier etwas ändert,
prüft das nach:

```bash
grep -rn "\.style\.\|innerHTML\|<style\|style=" src/ index.html | grep -v "^src/styles"
```

**Der Entwicklungsserver schickt dieselben Kopfzeilen.** `tools/server.mjs`
spiegelt die CSP aus `vercel.json`. Ohne das fiele ein Verstoß erst nach der
Veröffentlichung auf. Wer die eine Datei ändert, ändert die andere mit.

**Die Prüfstrecke schreibt jede Anfrage mit.** `tools/durchlauf.mjs` lässt
den Lauf durchfallen, sobald eine fremde Adresse auftaucht oder ein
Konsolenfehler entsteht.

Beim allerersten Start liest die App `src/daten/katalog.json` und
`rezepte.json` von derselben Herkunft und legt beides in IndexedDB ab.
Danach werden diese Dateien nie wieder gelesen; ab dem zweiten Start
beantwortet der Service Worker alles aus dem Zwischenspeicher.

---

## 6. ★ Das Zwei-Teile-Konzept: App offline, Agent online

**Dies ist der Teil, der EinkaufsFuchs von anderen Einkaufslisten
unterscheidet, und der Teil, den ein KI-Agent zuerst verstehen sollte.**

### 6.1 Das Problem

Eine Einkaufsliste, die nichts von der Welt weiß, kann viele nützliche
Fragen nicht beantworten:

- Ist etwas von dem, was wir ständig kaufen, gerade im Angebot?
- Was koche ich aus dem, was auf der Liste steht?
- Was ist Sardellenpaste eigentlich?

Der naheliegende Weg – Händler-Schnittstellen anbinden – wurde geprüft und
**verworfen**: Es gibt keine öffentlichen Schnittstellen, kommerzielle
Anbieter kosten Geld und sind rechtlich heikel, und jede solche Funktion
bräche Grundsatz I.

### 6.2 Die Lösung: die Brücke ist Text, der Träger ist ein Mensch

```
   ┌────────────────────────┐                    ┌─────────────────────────┐
   │  EinkaufsFuchs         │                    │  KI-Agent (Routine)     │
   │  auf dem Gerät         │                    │  läuft im Hintergrund   │
   │                        │                    │                         │
   │  • Liste               │   Klartext, vom    │  • ruft Angebotsseiten  │
   │  • Kaufhistorie        │   Menschen per     │    ab                   │
   │  • Kategorien          │   Zwischenablage   │  • gleicht gegen die    │
   │                        │   getragen         │    Stammartikel ab      │
   │  KEINE Netzverbindung  │  ───────────────▶  │  • liefert Treffer      │
   │  (per CSP erzwungen)   │                    │    mit Preisen          │
   └────────────────────────┘                    └─────────────────────────┘
```

Die App exportiert **Klartext**. Ein Mensch fügt ihn dort ein, wo er eine
Antwort will. Die App selbst baut nie eine Verbindung auf, kennt den Agenten
nicht und weiß nicht einmal, dass es ihn gibt.

**Die Trennung ist das Merkmal, nicht die Einschränkung.** Der Agent bekommt
nie Zugriff auf die App; es gibt keine Kopplung, die man absichern,
widerrufen oder erklären müsste. Was hinübergeht, entscheidet ein Mensch,
jedes Mal neu, durch eine Handlung, die er versteht: kopieren und einfügen.

### 6.3 Zwei Exporte, zwei Fragen

| Export | beantwortet | Format |
|---|---|---|
| **Liste als Text kopieren** | Was fehlt heute? | `Einkaufsliste (31.08.2026)` / `Ort: …` / `Obst & Gemüse: Karotten (1kg), Äpfel` |
| **Stammartikel kopieren** | Was brauchen wir *immer*? | `Stammartikel (EinkaufsFuchs, Stand …)` / `Milch (23×), Kaffee (11×), …` |

Der zweite ist der interessantere. „Was steht auf meiner Liste" beantwortet
man sich selbst; „ist etwas von dem, was ich ständig kaufe, gerade billiger"
kann man ohne Hilfe gar nicht beantworten – und die Antwort wechselt jede
Woche. Die Zahl in Klammern ist keine Zierde: Sie sagt dem Gegenüber, wie
ernst ein Artikel gemeint ist.

Beide Exporte tragen optional eine **Ortszeile**. Sie ist das einzige Feld
in der App, das über das Gerät hinausweist – und auch das nur, weil ein
Mensch den Text weitergibt. Ohne sie weiß das Gegenüber nicht, um welche
Läden es überhaupt geht.

### 6.4 Keine vorformulierte Frage – die wichtigste Designentscheidung

**An keinen Export wird eine Frage angehängt.** Kein „Was kann ich daraus
kochen?", kein „Bitte finde Angebote".

Der Grund: Derselbe Textblock trägt „was ist davon gerade im Angebot", „was
koche ich daraus" und „erklär mir Sardellenpaste". Eine mitgelieferte Frage
würde all das auf einen Fall verengen – und mit den Fähigkeiten der Modelle
altern. Ein reiner Befund wächst mit ihnen.

Zwei Tests halten das fest (`tests/logik.test.js`): Beide Exporte dürfen
kein Fragezeichen enthalten. Das ist kein Formalismus – es ist die
Absicherung einer Entscheidung, die ein wohlmeinender Beitrag sonst
rückgängig macht.

Dieselbe Logik im Kleinen: **Langes Drücken auf eine Kachel** kopiert nur den
Artikelnamen, nackt. Für Fragen zu einzelnen Produkten.

### 6.5 Der Agent im Hintergrund

Der zweite Teil lebt **außerhalb dieses Repositories** – als geplante
Routine (Scheduled Task) in einer KI-Umgebung. Er ist nicht Teil der
Auslieferung und keine Voraussetzung: EinkaufsFuchs funktioniert ohne ihn
vollständig.

**Aufbau der Routine:**

- **Takt:** zweimal wöchentlich, früh am Morgen (die deutschen Discounter
  starten ihre Aktionen montags und donnerstags).
- **Auftrag, in dieser Rangfolge:**
  1. Die **Stammartikel** des Haushalts gegen die aktuellen Angebote prüfen –
     das ist der eigentliche Auftrag.
  2. **Wunschkategorien**, die gerade interessieren (auch Non-Food).
  3. Sonstige auffällige Angebote – nur wenn Zeit bleibt.
- **Ergebnis:** zuerst eine kurze Antwort im Klartext, die man im
  Vorbeigehen liest; danach eine JSON-Datei mit allem Gefundenen.
- **Eingabe:** Stammartikel-Text und Ort stehen als Abschnitte im
  Routinen-Auftrag. Sie werden von Hand aktualisiert, wenn sich der Haushalt
  ändert. Der Agent fragt die App nicht ab und rät ihren Inhalt nicht.

**Warum das besser ist als eine eingebaute Angebotsfunktion:**

Am 30.08.2026 hat ein KI-Agent auf Zuruf 178 Lebensmittelangebote eines
Discounters von dessen Angebotsseite gelesen – mit Aktionspreis, Grundpreis
und Gebindegröße, in Minuten, ohne eine Zeile Code in der App. Eine
eingebaute Funktion bräuchte Netzverbindung, Anbieter und Rechtsprüfung –
und wäre in dem Moment veraltet, in dem die Agenten einen Schritt weiter
sind.

### 6.6 Erkenntnisse aus dem Betrieb der Routine

Wer eine solche Routine baut, läuft in dieselben drei Wände:

**Zwischenstände sichern, nicht am Ende schreiben.** Der erste Lauf erreichte
seine Nutzungsgrenze, *bevor* die Datei gespeichert war – Ergebnis: nichts.
Die Routine schreibt jetzt nach **jedem einzelnen Händler** neu. Lieber eine
Datei mit einem Händler darin als eine abgebrochene Sitzung ohne Ergebnis.

**Textseiten, keine Blätterkataloge.** Die Blätterkataloge der Händler sind
bildbasiert und kosten ein Vielfaches an Zeit und Kontingent.

**Das Kontingent teilt sich mit der eigenen Arbeit.** Ein Probelauf starb
eine Minute vor dem Zurücksetzen des Fünf-Stunden-Fensters – nicht an den
Händlerseiten, sondern daran, dass am selben Konto den ganzen Abend
gearbeitet worden war. Deshalb liegt der Takt früh am Morgen. Ein
Vier-Händler-Lauf kostete gemessen rund 2,30 $; wer sparen will, kürzt die
Händlerliste, nicht die Sicherungspunkte.

**Ehrlichkeit vor Vollständigkeit.** Der Auftrag verlangt ausdrücklich, eine
blockierte oder veränderte Seite mit konkretem Fehler zu melden, statt die
Lücke mit Plausiblem zu füllen. *Eine erfundene Zahl auf einem Preiszettel
ist schlimmer als eine fehlende – nach ihr fährt jemand in den Laden.*

---

## 7. Basis und Experte

Der Schalter im Kopfbereich blendet Funktionen ein und aus. **Es ist keine
Bezahlschranke** – alles ist immer kostenlos, es geht ausschließlich um
sichtbare Komplexität.

| | Basis (Standard) | Experte |
|---|---|---|
| Liste, Katalog, Abhaken | ✅ | ✅ |
| Mengen und Notizen | – | ✅ |
| Rezepte | – | ✅ |
| Kategorie-Reihenfolge ziehen | – | ✅ |
| Teilen, Export, Import | – | ✅ |
| Stammartikel-Export, Ort | – | ✅ |
| Statistik | – | ✅ |

Der Wechsel ist **verlustfrei, und zwar wörtlich**: Er berührt genau einen
Wert in den Einstellungen und setzt eine Klasse auf `<body>`. Was zur Tiefe
gehört, trägt `.experte-nur` und wird ausgeblendet, nicht gelöscht. Eine im
Expertenmodus erfasste Menge steht in der Datenbank weiter; Basis zeigt sie
nur nicht. Die Prüfstrecke fährt den Rückweg mit und vergleicht.

Prüfkriterium für Basis: **keine einzige Funktion, die man erklären müsste.**
Im Bildschirm „Mehr" heißt das konkret zwei Karten – „Über EinkaufsFuchs"
und „Deine Daten".

---

## 8. Architektur

```
index.html                 Gerüst: Kopf, drei Bereiche, untere Leiste
manifest.webmanifest       Installierbarkeit (name/short_name = die zwei Namen)
sw.js                      Service Worker (Zwischenspeicher = die ganze App)
vercel.json                Auslieferung + die Kopfzeilen aus Kapitel 5
src/
  app.js                   Start und Zusammenspiel
  zustand.js               Zustand im Speicher, Durchschreiben nach IndexedDB
  db.js                    IndexedDB, sonst nichts
  logik.js                 reine Rechenregeln (getestet, ohne DOM)
  texte.js                 alle sichtbaren Sätze an einem Ort
  daten/katalog.json       476 Artikel in 18 Kategorien
  ui/…                     die drei Bildschirme, Dialog, Teilen
  styles/stamm/            Zeile für Zeile aus TourFuchs übernommen
  styles/farben.css        die Grenzschicht: was Foxi anders macht
tools/                     Katalog bauen, Zeichen rastern, Server, Prüfstrecke
```

### 8.1 Kein Framework – und warum das hier kein Dogma ist

Drei Bildschirme, ein Zustand, keine Fremddaten. React oder Vue würden eine
Abhängigkeit, einen Bauschritt und eine Bündeldatei einführen, um Listen neu
zu zeichnen, die sich mit `textContent = ''` und einer Schleife genauso
schnell neu zeichnen lassen.

Der teuerste Vorgang – 476 Kacheln neu aufbauen – wird nicht dadurch
billiger, dass ein virtueller Baum davorsteht. Er wird dadurch billig, dass
er **meistens gar nicht stattfindet**: `veraltet` in `src/app.js` zeichnet
nur den sichtbaren Bereich neu, und ein reiner Listenwechsel färbt im
Katalog nur Kacheln um, statt das Raster neu zu bauen.

### 8.2 Die Gestaltungsgrenze

`src/styles/stamm/` ist Zeile für Zeile aus TourFuchs übernommen – so wie
SoundFuchs es hält. **Sobald man eine Stamm-Datei bearbeitet, kann niemand
mehr durch einen Vergleich feststellen, ob der Stamm noch der Stamm ist.**
Alles Eigene steht in `src/styles/farben.css` und `foxi.css`.

Der Unterschied zur Familie ist vier Werte groß:

| | TourFuchs / SoundFuchs | EinkaufsFuchs |
|---|---|---|
| `--color-primary` | `#0d9488` (3,74:1) | `#3f9142` (3,93:1) |
| `--color-primary-dark` | `#0f766e` | `#2f6f34` (6,10:1) |
| `--color-primary-light` | `#ccfbf1` | `#dff2df` |
| `--color-bg` | `#f8fafc` | `#f7faf5` |

Hausregel: gefüllte Flächen und Pillen tragen `--color-primary`, Text und
Links tragen `--color-primary-dark`.

### 8.3 Datenmodell

```
artikel     { id, name, kategorieId, icon, zaehler, letzteKaeufe[], eigen }
listeItem   { artikelId, menge, notiz, erledigt, erledigtAm }
kategorie   { id, name, icon, position, ursprung }
rezept      { id, name, artikelIds[], eigen }
einstellung { schluessel, wert }        // modus, ort, katalogVersion
```

`letzteKaeufe` ist das Herzstück: Aus ihm speist sich die lernende
Sortierung, die Statistik, der Stammartikel-Export – und später die
Rhythmus-Erkennung.

Die Austauschdatei trägt **bewusst keine `letzteKaeufe`**. Die Kaufhistorie
ist das Gedächtnis eines Haushalts, keine Beilage zu einer Einkaufsliste;
wer eine Liste weitergibt, gibt nicht mit, wie oft er Bier kauft. Ein Test
hält das fest.

---

## 9. Bewusst nicht gebaut

| Funktion | Grund |
|---|---|
| QR-Code-Sync | Kapazitätsgrenze ~1 KB, Aufwand steht in keinem Verhältnis |
| Barcode-Scan | Safari/iOS unterstützt `BarcodeDetector` nicht; eine Produktdatenbank wäre ein Netzwerk-Request |
| Kassenbon-OCR | Thermopapier ist der Worst Case für OCR; die Kaufhistorie entsteht ohnehin beim Abhaken |
| Spracheingabe | Die Web Speech API sendet Audio an Google/Apple – bricht Grundsatz I |
| Angebote und Preise von Händlern | Keine öffentlichen Schnittstellen, rechtlich heikel – **und durch Kapitel 6 besser gelöst** |
| Konto, Login, Cloud-Sync | Widerspricht Grundsatz I |

---

## 10. Erkenntnisse aus dem Bau

Sieben Dinge, die Zeit gekostet haben und die man nicht zweimal lernen muss.

**`insertBefore` löst die Pointer-Capture.** Die Kategorie-Reihenfolge ließ
sich genau *einmal* verschieben, dann stand der Zug still, und gespeichert
wurde nie etwas. Ursache: `griff.setPointerCapture(…)` plus `insertBefore` –
letzteres hängt die Zeile mitsamt Griff neu ein, und der Browser gibt die
Capture frei, sobald das erfassende Element aus dem Baum genommen wird.
**Lösung:** Zeigerereignisse am `document` statt am Griff; `touch-action:
none` auf dem Griff sichert, dass der Finger nicht scrollt.

**HTML5-Drag-and-drop gibt es auf iOS am Finger nicht.** Eine Reihenfolge,
die sich nur am Schreibtisch ändern lässt, ist für eine Einkaufs-App die
falsche Hälfte. Zeigerereignisse decken Maus, Finger und Stift ab. Für
Tastatur und Vorlesehilfe liegen Pfeiltasten auf dem Griff.

**Die CSP verbietet Inline-CSS – auch das eine `style`-Attribut.** Der
Statistik-Balken bekam seine Länge zuerst per `style.setProperty` und wäre
live stumm kaputtgegangen. Jetzt kommt sie aus Klassen in Zehnerschritten.
Gefunden hat es nur der Entwicklungsserver, weil er dieselben Kopfzeilen
schickt wie die Auslieferung.

**Optimistische Anzeige erzeugt Test-Wettläufe.** Die Kachel färbt sich
absichtlich um, *bevor* der Zustand geschrieben ist. Eine Prüfung, die auf
die grüne Kachel wartet und dann den Zähler liest, misst den Lidschlag davor
und findet eine 0. Auf den Zustand warten, nicht auf das Bild.

**`fullPage`-Bildschirmfotos greifen hier nicht.** Bei dieser App scrollt
nicht die Seite, sondern der Bereich darin (`.bereich` liegt absolut mit
eigenem Überlauf). Ein Ganzseitenbild zeigt nur den Anfang. Hinscrollen ist
der einzige Weg.

**`boundingBox()` scrollt nicht.** Anders als `tap()`. Wer damit Koordinaten
für eine Zeigergeste holt, zielt bei Elementen unterhalb des Fensters ins
Leere – die Geste passiert dann einfach nicht.

**Der blaue Tipp-Schimmer arbeitet gegen jedes Farbkonzept.** Mobile Browser
legen ihn über jedes angetippte Element, und als Rückmeldung taugt er
ohnehin nicht, weil er zu spät kommt.
`-webkit-tap-highlight-color: transparent` auf `#app`, dafür echte
`:active`-Zustände.

---

## 11. Prüfen

```bash
npm test                    # 48 Unit-Tests: Sortierung, Suche, Gruppierung,
                            # Exporte, Import, Datenintegrität
node tools/durchlauf.mjs    # 39 Prüfungen im echten Browser (Chromium,
                            # iPhone-13-Profil) + die Bilder in docs/bilder/
```

Die Prüfstrecke deckt ab, was Unit-Tests nicht erreichen: die Zwei-Tipp-
Regel, zehn simulierte Einkäufe, den verlustfreien Moduswechsel, Rezepte,
das Ziehen mit Zeiger *und* Tastatur, beide Exporte aus der **echten
Zwischenablage**, einen vollständigen Datei-Import samt
Zusammenführungs-Dialog, und die zwei Namen in beiden Bildschirmbreiten.

Zwei Tore laufen dabei ständig mit: **jede Netzwerkanfrage** wird
mitgeschrieben, und **jeder Konsolenfehler** (also auch jeder CSP-Verstoß)
lässt den Lauf durchfallen.

**Was nicht geprüft ist:** Alles läuft in Chromium unter Linux. Die Emoji
stammen aus der Schrift des Betriebssystems und sehen auf iOS anders aus;
`navigator.share` mit Dateien verhält sich dort anders; und ob das lange
Drücken sich gegen Safaris eigene Gesten durchsetzt, ist offen.

---

## 12. Was als Nächstes käme

- **Rhythmus:** aus `letzteKaeufe` die Kaufabstände mitteln und Artikel von
  selbst vorschlagen. Die Daten liegen längst da.
- **Ladenzuordnung:** nach dem Abhaken einmal „Wo warst du?" mit den letzten
  drei Läden als Kacheln. Kein GPS, keine Berechtigung.
- **Preise:** optionales Zahlenfeld beim Abhaken, daraus ein simpler
  Preisverlauf.
- **Karte mit Geschäften:** Supermarkt-Standorte aus OpenStreetMap über die
  Overpass-API, einmalig für eine Region geladen und lokal gespeichert –
  kein Live-Request. Nur sinnvoll mit einer Standort-Erinnerung.

---

## 13. Für KI-Agenten, die hier weiterarbeiten

Die kurze Fassung steht in [`AGENTS.md`](../AGENTS.md). Das Wichtigste in
drei Sätzen:

1. **Grundsatz I ist nicht verhandelbar.** Wenn eine Änderung eine
   Netzverbindung, ein Konto oder eine Auswertung einführen würde: nicht
   bauen, sondern über Kapitel 6 lösen.
2. **Prüfen, nicht behaupten.** `npm test` und `node tools/durchlauf.mjs`
   müssen grün sein. Die Prüfstrecke hat in diesem Projekt drei echte Fehler
   gefunden, die kein Nachdenken gefunden hätte.
3. **Texte gehören nach `src/texte.js`**, Farben nach `farben.css`, und
   `src/styles/stamm/` wird nicht angefasst.
