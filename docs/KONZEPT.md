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

**Die Karte bleibt ein ungeteiltes Ziel – auch als das Artikelblatt dazukam.**
Der naheliegende Vorschlag lautet irgendwann: Der Kreis hakt ab, ein Tipp in
die Mitte öffnet die Details. Das ist geprüft und verworfen, aus drei Gründen:

1. Es verkleinert das häufigste Ziel der App von rund 330 × 62 px auf einen
   Kreis von 28 px – ausgerechnet für die Handlung, die einhändig im Gehen
   passiert, mit dem Wagen in der anderen Hand.
2. Es macht Fehlgriffe schlimmer statt harmloser. Heute hakt ein Fehlgriff ab,
   und die Rückmeldung trägt „Rückgängig": ein Tipp, erledigt. Mit geteilter
   Karte öffnet er ein Blatt, das man erst wieder wegräumen muss.
3. Es wäre eine Regel, die man **wissen** muss – und der Basismodus hat als
   Kriterium, keine Funktion zu zeigen, die man erklären müsste.

Das Artikelblatt hängt deshalb am Knopf **neben** der Zeile. Den gab es
ohnehin schon; er klappte früher ein Formular unter der Zeile auf. Ein
vorhandener Griff, der mehr kann, schlägt ein neu erfundenes geteiltes Ziel.
Die Prüfstrecke hält beides fest: dass ein Tipp auf die Karte abhakt und kein
Blatt öffnet, und dass der Knopf daneben das Blatt öffnet.

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

**Die zweite gelernte Sache: wie dieser Haushalt einen Artikel kauft.** Beim
Abhaken merkt sich Foxi neben dem Zeitstempel auch den Produktwunsch, der in
diesem Moment an der Zeile stand (`letzteMengen`, gekappt bei 20 Einträgen).
Im Artikelblatt stehen die letzten drei **verschiedenen** als Knöpfe unter
dem Feld, überschrieben mit „Zuletzt so gekauft".

Drei Entscheidungen daran sind wichtiger, als sie aussehen:

1. **Gelernt wird beim Abhaken, nicht beim Tippen.** Ein Wunsch, der nur
   eingetippt und wieder verworfen wurde, lag nie im Wagen. Derselbe Ort und
   derselbe Zeitstempel wie bei `letzteKaeufe` – daran räumt „Rückgängig"
   beides zusammen wieder ab.
2. **Ein Tipp füllt nur das Feld.** Er speichert nicht und schließt nicht:
   Das Blatt ändert von sich aus nichts, und „2 Liter" ist oft der Anfang von
   „2 Liter, die haltbare".
3. **Was ohnehin im Feld steht, wird nicht angeboten** – sonst stünde neben
   dem aktuellen Wunsch ein Knopf, der nichts tut.

`letzteMengen` bleibt wie `letzteKaeufe` auf dem Gerät: nicht in der
geteilten Datei, nicht im KI-Auftrag. Wer eine Liste weitergibt, gibt nicht
mit, in welchen Mengen er einkauft.

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

### 6.7 Der Angebotsradar: aus der losen Brücke wird ein Vertrag

Die Kapitel 6.2 bis 6.5 beschreiben die Brücke in ihrer ersten Form: Text
hinaus, Antwort im Gespräch. Inzwischen gibt es daneben eine zweite,
**festgezurrte** Form – `src/angebotsradar.js` und `src/ui/angebote.js`.

Der Unterschied ist nicht die Technik, sondern die **Richtung der Antwort**:

| | Klartext-Exporte (6.3) | Angebotsradar (6.7) |
|---|---|---|
| hinaus | Befund, offen formuliert | **Auftrag** mit Regeln, erlaubten Quellen und Ausgabevertrag |
| zurück | im Gespräch, beim Menschen | **JSON, das wieder in die App geht** |
| Frage | bewusst keine (6.4) | fest, weil das Ergebnis maschinell weiterverarbeitet wird |

**Daraus folgt die Regel:** Was nur ein Mensch liest, darf offen bleiben. Was
zurück in die App fließt, muss überprüfbar sein. Die App ruft weiterhin keine
Händlerseite auf – sie erzeugt einen Text und nimmt später eine Datei
entgegen.

`alsAngebotsauftrag()` schreibt Aufgabe, Regeln, Märkte und ein vollständiges
JSON-Beispiel in einen Block. Derselbe Text taugt damit für den einmaligen
Zuruf **und** für eine wiederkehrende Hintergrundaufgabe – das ist Kapitel
6.5, nur in Form gegossen.

`pruefeAngebotsergebnis()` ist die eigentliche Arbeit. Ein Angebot wird nur
angenommen, wenn **jedes** Feld trägt:

- Preis endlich, größer als 0, höchstens 100 000; Währung genau `EUR`
- Grundpreis maschinell lesbar (ab Vertragsfassung 2 verpflichtend)
- `gueltigVon` ≤ `gueltigBis`, beide als Datum
- `treffer` ist `genau` oder `alternative` – nichts dazwischen
- **`quelle` ist HTTPS und liegt auf einer Erlaubnisliste offizieller
  Händler-Hosts** oder ist für diesen eigenen Laden lokal ausdrücklich hinterlegt
- höchstens 200 Angebote, höchstens 256 KB Datei

Diese Prüfung begrenzt fremde Eingaben und unerwünschte Quellen. Sie bestätigt jedoch nicht, dass ein Preis auf einer Händlerseite steht oder die Filiale ihn tatsächlich anbietet. Auch ein erfundener Preis mit formal erlaubtem Link kann die Formatprüfung bestehen. Die konkrete Quelle bleibt deshalb sichtbar.

Zwei weitere Entscheidungen lohnen die Erwähnung:

**Angebote laufen von selbst ab.** `aktiveAngebote()` zeigt nur, was heute
gültig ist. Niemand muss aufräumen, und nichts Abgelaufenes steht je im Weg.

**Filialen werden zusammengefasst.** Dasselbe Angebot in drei Märkten ist
eine Zeile, nicht drei. Markt und Quelle gehören deshalb absichtlich nicht
zum Gruppenschlüssel – sie werden gesammelt und bleiben im aufgeklappten
Detail vollständig nachvollziehbar.

**Alte Ergebnisse bleiben lesbar.** Vertragsfassung 1 erlaubte beliebigen
Grundpreistext. Solche gespeicherten Ergebnisse verschwinden nicht, nehmen
aber am Preisvergleich nicht teil – abwerten statt wegwerfen.

#### Die Filiale gehört zu jedem Angebot (0.14.0)

Ein Preis ohne Laden schickt einen in den falschen Markt. Bei REWE, EDEKA,
Kaufland, Netto und PENNY gilt ein Angebot ohnehin nur in der gewählten
Filiale; und selbst bei ALDI will man wissen, *welcher* ALDI gemeint ist.
Deshalb gilt an drei Stellen dieselbe Regel:

- **Im Auftrag:** Jedes Angebot nennt genau eine Filiale aus dem Profil,
  wortgleich. Keine Sammelangaben („alle Filialen", „bundesweit"); ein
  Angebot für mehrere Filialen wird je Filiale eingetragen – Foxi fasst es
  selbst wieder zusammen. Das Beispiel im Ausgabeformat zeigt die erste
  Filiale des Profils, weil ein Assistent am Beispiel schneller lernt als an
  einer Regel.
- **Beim Einlesen:** `filialenZuordnen()` ordnet jedes Angebot einer
  gespeicherten Filiale zu, auch in anderer Schreibweise (Groß-/Klein,
  ß/ss, Umlaute, „Str.", Satzzeichen). Passt nur Straße und Hausnummer, gilt
  das nur, wenn es genau **eine** Filiale trifft – zwischen zweien wird nicht
  geraten. Was keine Filiale trifft, wird **weggelassen und gezählt**, nicht
  still verschluckt und nicht zum Anlass, das ganze Ergebnis zu verwerfen.
  Ein Demo-Ergebnis wird am Demo-Profil gemessen, jedes andere an
  „Meine Märkte".
- **In der Anzeige:** Die Listenzeile nennt die Filiale beim Namen
  („REWE Rellinghauser Straße 239"), bei mehreren die erste und die Zahl der
  übrigen. Beim sonstigen Laden steht der Name im Feld `markt`, daher zählen
  dort Name *und* Straße.

#### Was die Händlerseiten hergeben – gemessen, nicht vermutet

Im September 2026 wurden die acht hinterlegten Angebotsseiten mit einem
echten Browser geöffnet (Chromium, vier Sekunden Nachladezeit), nicht nur
als Seitentext abgerufen:

| Händler | Ergebnis |
|---|---|
| ALDI Nord | Seite lädt, **kein Angebotspreis im Seitentext** |
| ALDI Süd | **abgewiesen (HTTP 403)** |
| Lidl | Seite lädt, nur ein Versandpreis, **keine Angebotspreise** |
| REWE | **abgewiesen (HTTP 403)** |
| EDEKA | **abgewiesen (HTTP 403)** |
| Kaufland | Seite lädt, **keine Preise im dargestellten Text** (im rohen HTML schon) |
| Netto Marken-Discount | **abgewiesen (HTTP 403)** |
| PENNY | Seite lädt, **verlangt ausdrücklich eine Marktwahl** |

Die Abweisungen können an der Rechenzentrums-Adresse der Messung liegen;
ein Assistent mit anderem Netzzugang kommt womöglich weiter. Die Folgerung
gilt trotzdem für alle acht: **Keine Seite gibt Preise beim bloßen Aufruf
her.** Sie stehen im Prospekt-Betrachter, werden nachgeladen oder erst nach
der Filialwahl gezeigt. Der Auftrag sagt das deshalb ausdrücklich – samt
der Liste, bei welchen Händlern *aus dem jeweiligen Profil* die Preise je
Filiale gelten (`marktgebunden` in `HAENDLER`). Er nennt nur Händler, die im
Profil vorkommen; ein Auftrag über zwei Märkte braucht keine Anleitung für
acht.

**Nicht gelesen statt geraten.** Kommt ein Assistent an eine Filiale nicht
heran, soll er nicht raten, sondern sie in `nichtGelesen` eintragen
(Händler, Filiale, kurzer Grund). Foxi zeigt diese Liste unter dem Status an.
Ohne sie ist „kein Angebot" nicht von „nicht nachgesehen" zu unterscheiden.
Das Feld ist freiwillig – die Vertragsfassung bleibt 2, ältere Ergebnisse
und ältere Foxi-Fassungen funktionieren unverändert –, wird aber, wenn es
da ist, so eng geprüft wie der Rest: höchstens 20 Einträge, jeder Text
begrenzt.

#### Der Weg zur KI-App (0.14.1)

Rückmeldung aus dem Alltag: Der Auftrag kam nicht in der Zwischenablage an,
und der Link auf den Assistenten öffnete nicht die eigene App mit dem
Arbeitskonto. Das Zweite ist kein Fehler, sondern die Plattform: Aus einer
installierten Web-App öffnet ein Link den Browser. Im Browser ist man meist
nicht oder mit einem anderen Konto angemeldet.

Deshalb ist der Hauptweg am Handy jetzt das **Teilen-Menü**
(`navigator.share({ text })`). Claude und ChatGPT stehen dort, sobald ihre
Apps installiert sind, und der Auftrag landet in der App, mit deren Konto.
Das umgeht Zwischenablage und Link zugleich, und es bleibt beim Grundsatz:
Ein Mensch tippt, wählt und schickt ab; Foxi sendet nichts selbst.

Kopieren bleibt daneben, am Computer ist es der Hauptweg. Es läuft jetzt auf
zwei unabhängigen Wegen: zuerst synchron über ein unsichtbares Textfeld und
`execCommand('copy')` (noch sicher innerhalb des Fingertipps), dann über
`navigator.clipboard`. Warum das eine Handy den Text nicht annahm, ließ sich
hier nicht nachstellen. Zwei Wege statt einer Vermutung. Der Alltagslauf
verweigert die moderne Schnittstelle absichtlich und prüft, dass der Auftrag
trotzdem ankommt. Die Gegenprobe ohne den synchronen Weg schlägt an.

**Die Erlaubnisliste bleibt eng.** Naheliegend wäre, Prospekt-Sammelseiten
(etwa kaufDA oder Marktguru) als Quelle zuzulassen, weil sie Preise oft
lesbarer zeigen. Das bleibt bewusst aus: Eine Quelle ist das, was der Mensch
antippt, um den Preis nachzuprüfen – und das soll die Seite des Händlers
sein, nicht die eines Dritten, der mit dem Klick eigene Interessen hat. Der
Auftrag lässt deshalb weiterhin nur Händlerseiten zu.

Und der Grundsatz aus Kapitel 3 gilt auch hier: Das mitgelieferte
**Demo-Profil trägt erfundene Kaufgewohnheiten**. Der echte Wohnort gehört
nicht in ein öffentliches Repository.

---

## 7. Basis und Experte

Der Schalter im Kopfbereich blendet Funktionen ein und aus. **Es ist keine
Bezahlschranke** – alles ist immer kostenlos, es geht ausschließlich um
sichtbare Komplexität.

| | Basis (Standard) | Experte |
|---|---|---|
| Liste, Katalog, Abhaken | ✅ | ✅ |
| Mengen und Notizen lesen | ✅ | ✅ |
| Produktwunsch bearbeiten | – | ✅ |
| Rezepte | – | ✅ |
| Kategorie-Reihenfolge ziehen | – | ✅ |
| Teilen, Export, Import und Vollsicherung | ✅ | ✅ |
| Stammartikel-Export | ✅ | ✅ |
| Ort bearbeiten | – | ✅ |
| Statistik | – | ✅ |

Der Wechsel ist **verlustfrei, und zwar wörtlich**: Er berührt genau einen
Wert in den Einstellungen und setzt eine Klasse auf `<body>`. Was zur Tiefe
gehört, trägt `.experte-nur` und wird ausgeblendet, nicht gelöscht. Eine im
Expertenmodus erfasste Menge steht in der Datenbank weiter; Basis zeigt sie ebenfalls. Die Prüfstrecke fährt den Rückweg mit und vergleicht.

Prüfkriterium für Basis: **keine einzige Funktion, die man erklären müsste.**
Im Bildschirm „Mehr“ stehen die Grundkarten einschließlich Teilen und dem optional nutzbaren Angebotscheck.

---

## 7a. Handy und Schreibtisch

Die zweite Achse neben Basis/Experte, und sie wird **nicht** eingestellt,
sondern gemessen. Es gibt zwei Schnitte derselben App:

| | Handy-Schnitt | Schreibtisch-Schnitt |
|---|---|---|
| Navigation | Leiste unten | Leiste links |
| Katalog | hinter seinem Reiter | dauerhaft in der linken Spalte |
| Arbeitsfläche | ein Bereich | Liste (oder Mehr) rechts daneben |

Der Schreibtisch-Schnitt gilt bei
`(min-width: 900px) and (min-height: 480px) and (orientation: landscape)`.

**Die Regel, die man sich merken kann: quer ist Schreibtisch, hoch ist
Handy.** Ein Tablet im Hochformat bleibt deshalb in der Handy-Ansicht, obwohl
es breit genug wäre – die Bedienung mit dem Daumen an der unteren Leiste ist
dort die bessere. Gedreht wechselt es den Schnitt.

Die Höhenbedingung ist die Zeile, die Telefone aussperrt: Ein großes Telefon
quer ist über 900 px breit, aber nur gut 400 px hoch. Zwei Spalten in 400 px
Höhe wären keine Schreibtisch-Ansicht, sondern ein Briefschlitz. **Auf dem
Telefon gibt es damit nur den Handy-Schnitt, in jeder Lage.**

**Warum der Katalog die linke Spalte bekommt** und nicht die Liste: Das ist
der Aufbau der Geschwister. Bei TourFuchs und SoundFuchs steht links die
Eingabeseite und rechts die Arbeitsfläche. Bei Foxi heißt Eingabe: Artikel
auf die Liste legen. Und es ist genau der Gewinn, den ein großer Bildschirm
hergibt – Kachel links antippen, Zeile rechts erscheinen sehen, ohne einen
Reiter zu wechseln.

Drei Dinge, die dabei zu beachten waren:

1. **Der Katalog-Reiter verschwindet**, sobald die Kachelwand ohnehin
   dasteht. Ein Reiter ohne Ziel ist schlimmer als kein Reiter. Wer trotzdem
   dorthin geschickt wird – etwa vom leeren Zustand der Liste –, landet bei
   der Liste, neben der der Katalog schon steht.
2. **Der angedockte Katalog ist kein verdeckter Bereich mehr.** `app.js`
   zeichnet absichtlich nur, was jemand ansieht; am Schreibtisch gehört der
   Katalog dazu. Ein Artikel, der bloß auf die Liste wandert, löst trotzdem
   keinen Neubau der 480 Kacheln aus – dafür genügt `synchronisiereKacheln()`.
3. **Die Abfrage steht zweimal:** im CSS, wo sie das Raster schneidet, und in
   `schale.js` als `DESKTOP_ABFRAGE`, wo sie entscheidet, dass der Katalog
   sichtbar bleibt. Ein Test vergleicht beide Zeichenketten – liefen sie
   auseinander, stünde die linke Spalte leer.

**Das Manifest darf die Ausrichtung nicht festnageln.** Es stand auf
`"orientation": "portrait"`; das verbietet der installierten App genau die
Drehung, aus der der Schreibtisch-Schnitt entsteht. Jetzt steht dort `"any"`.
Eine Sperre nur fürs Telefon gibt es nicht – das Manifest kennt die Geräte
nicht, nur die App. Das Telefon braucht sie auch nicht: Es bekommt in jeder
Lage denselben Schnitt.

Dieser Abschnitt beschreibt ausdrücklich nur den **Schnitt**. Funktionen, die
es nur am Schreibtisch gäbe, existieren nicht – und wenn welche kommen,
stehen sie hier zur Diskussion, nicht im Code. Grundsatz II gilt auf beiden
Bildschirmgrößen.

---

## 7b. Die Liste als QR-Code

Der einzige Weg in Foxi, der ohne Datei und ohne Zwischenablage von einem
Gerät zum anderen führt: **Bildschirm zeigt, Kamera liest.** Kein Netz, kein
Konto, kein Server.

### Warum das früher „nicht machbar" hieß

In Kapitel 9 stand QR-Sync jahrelang unter „bewusst nicht gebaut", Begründung:
*Kapazitätsgrenze ~1 KB.* Das stimmte – für das Format, das Foxi beim Teilen
als Datei benutzt. Gemessen, jeweils als fertige Adresse im Code:

| Liste | Austauschformat der Datei | QR-Code |
|---|---|---|
| 10 Artikel | 1.366 B | Version 26 – grenzwertig |
| 30 Artikel | 3.952 B | **passt in keinen QR-Code** |

Die Voraussetzung hat sich an zwei Stellen geändert:

1. **Beide Geräte haben denselben Katalog.** Name, Kategorie und Zeichen der
   476 mitgelieferten Artikel stehen auf dem anderen Gerät schon. Übertragen
   werden müssen Kennung und Produktwunsch.
2. **Gepackt wird im Browser.** `CompressionStream('deflate-raw')` schrumpft
   JSON mit immer denselben kurzen Schlüsseln auf ein Drittel.

Damit sieht dieselbe Tabelle so aus:

| Liste | Adresse | QR-Code |
|---|---|---|
| 10 Artikel | 285 B | Version 11 (61×61) |
| 25 Artikel | 484 B | Version 15 (77×77) |
| 40 Artikel | 705 B | Version 18 (89×89) |
| 60 Artikel | 973 B | Version 22 (105×105) |
| 100 Artikel | 1.517 B | passt nicht – dann als Datei teilen |

### Die zwei Hälften – und warum nur eine gebaut wurde

**Anzeigen** braucht einen QR-Erzeuger. Der steht in `src/qrcode.js`, selbst
gebaut: Eine Bibliothek von einem fremden Server einzubinden verstieße gegen
`default-src 'self'`, und eine mit Bauschritt gegen „kein Bauschritt".

**Scannen** braucht – nichts. Der Code enthält eine Adresse mit den Daten im
Anker (`…/#lz=…`). Das empfangende Gerät hält seine **gewöhnliche Kamera-App**
darauf; iPhone und Android erkennen QR-Codes von Haus aus, tippen auf die
Benachrichtigung öffnet Foxi mit der Liste. Ein eingebauter Scanner bräuchte
eine Bilderkennung, eine Kameraberechtigung und auf iOS die installierte App –
für dieselbe Handlung.

**Und der Anker bricht Grundsatz I nicht:** Alles hinter dem Rautezeichen
schickt kein Browser zu irgendeinem Server. Was über das Netz geht, ist die
App selbst – und auch die nur, wenn sie dort noch nicht installiert ist.

### Derselbe Inhalt als Link – und die Falle dabei

Bildschirm-an-Kamera setzt denselben Raum voraus; genau dann braucht man es
am wenigsten. Der eigentliche Fall ist: Einer ist zu Hause, der andere im
Laden. Dafür schickt „Als Link senden" **dieselbe Adresse** in eine
Nachricht – die Liste steht ja im Link.

Dabei lauert eine Falle, die den ganzen Weg stumm entwertet: **Ein
angetippter Link in einer Nachricht öffnet den eingebauten Browser des
Messengers.** Der hat seinen eigenen Speicher. Dort übernommen, ist die Liste
in der Foxi auf dem Startbildschirm **nie angekommen** – sie war drei
Sekunden lang zu sehen und ist dann weg. Dasselbe gilt auf iOS für den
QR-Code, weil die Kamera Safari öffnet und nicht die installierte App.

Deshalb gibt es die Gegenrichtung von Hand: **„Link einfügen"** neben „Datei
einlesen". Der Ablauf unterwegs ist damit: Link kopieren → die **eigene**
Foxi öffnen → einfügen → derselbe Zusammenführungs-Dialog. Der Satz dazu
steht im Sendedialog, damit ihn der Absender weitergeben kann.

Zwei Dinge sind beim Einfügen Absicht:

- **Der Ursprung im Link ist egal.** Ein Link von einer anderen Adresse
  derselben App – nach einem Umzug, aus einer alten Nachricht – trägt
  dieselben Daten hinter der Raute. Geprüft wird der Inhalt, nicht die
  Herkunft.
- **Zuerst die Zwischenablage, dann die Frage.** Geht `readText()` nicht
  (Safari ohne Geste, Firefox, verweigerte Berechtigung), erscheint ein Feld
  statt einer Fehlermeldung.

Und zur Einordnung, weil Foxi ein Versprechen gibt: Die Liste steht **im**
Link; wer die Nachricht hat, hat die Liste. Das ist dieselbe Kategorie wie
die Datei, die Foxi längst per Messenger teilt – ein Mensch entscheidet und
schickt. Immerhin: Was ein Messenger für die Linkvorschau holt, ist nur die
App-Adresse. Den Teil hinter der Raute bekommt auch dieser Abruf nie zu
sehen.

### Was nicht mitfährt

- **Fotos.** Ein Produktfoto ist bis 900 KB groß, ein QR-Code fasst 2,9 KB.
  Das sind drei Größenordnungen; es ist keine Abwägung, sondern Arithmetik.
- **Kaufhistorie und gelernte Mengen** – dieselbe Regel wie bei der Datei.
- **Ort, Märkte, Angebotsergebnis** – persönlich.

### Vier Entscheidungen im Format

1. **Die Bezeichnung fährt trotzdem mit**, obwohl die Kennung genügte. Sie
   kostet eine QR-Version und rettet den Fall, dass das andere Gerät einen
   älteren Katalogstand hat: Ohne sie wäre eine unbekannte Kennung stiller
   Datenverlust – ein Artikel, der einfach fehlt.
2. **Die Teilmarke steht von Anfang an im Format** (`n` von `g`), obwohl Foxi
   immer genau einen Code erzeugt. Zwei Codes wären erst jenseits von rund
   siebzig Artikeln nötig; kommen sie je, bleibt das Format kompatibel.
   Dieselbe Lehre wie bei `DATEI_TYP`.
3. **Zwei Schlüssel, ein Format:** `lz` gepackt, `l` ungepackt. Ein Gerät
   ohne `CompressionStream` (vor Safari 16.4) erzeugt einen dichteren Code
   für eine kürzere Liste und liest gepackte trotzdem – und wenn nicht, sagt
   Foxi das, statt „kaputt" zu behaupten.
4. **Was hereinkommt, ist fremd.** Eine Adresse kann jeder schicken, nicht
   nur der eigene Bildschirm. Deshalb prüft `pruefeQrListe()` so streng wie
   `pruefeAngebotsergebnis()`, und übernommen wird **nie** stillschweigend:
   Es erscheint derselbe Zusammenführungs-Dialog wie beim Datei-Import. Der
   QR-Code ist ein anderer Transportweg, keine zweite Wahrheit.

### Wie der Erzeuger geprüft ist

Ein selbst gebauter QR-Erzeuger ist nur so viel wert, wie er sich prüfen
lässt – und gegen sich selbst zu prüfen wäre wertlos. `tests/qr.test.js`
vergleicht das erzeugte Bild **Modul für Modul** mit den Fingerabdrücken
einer unabhängigen Umsetzung (`qrcode` auf npm), über alle 25 Versionen und
beide Fehlerkorrekturstufen. Beim Bauen hat genau das drei Fehler gefunden,
die jeder für sich einen unlesbaren Code ergeben hätten:

- ein Generatorpolynom in **umgekehrter Reihenfolge** – die Fehlerkorrektur
  war plausibel und falsch;
- eine Zuweisung im Mustervergleich, die nur den letzten Vergleich zählte;
- eine Rundung in Regel 4 der Maskenwahl, abgeschnitten statt gerundet.

Im Durchlauf kommt der Weg als Ganzes dazu: Das erste Gerät erzeugt den Code,
ein **zweiter Browserkontext** – eigene Datenbank, also ein anderes Gerät –
öffnet die Adresse und muss dieselbe Liste bekommen, ohne Foto und ohne
Historie.

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
  angebotsradar.js         Auftrag hinaus, geprüftes Ergebnis herein (Kap. 6.7)
  pwa-update.js            Service Worker und der vollständige Updateweg
  texte.js                 alle sichtbaren Sätze an einem Ort
  daten/katalog.json       476 Artikel in 18 Kategorien
  ui/…                     die drei Bildschirme, Dialog, Teilen, Angebote,
                           Artikelblatt
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

**Der Unterschied zur Familie ist ein einziger Wert groß** – und das ist
selbst eine Entscheidung, die einmal anders getroffen war.

Zuerst bekam EinkaufsFuchs einen eigenen grünen Leitton (`#3f9142`), passend
zum Thema Lebensmittel. Das ist verworfen: Zwei fast gleiche Leittöne
unterscheiden nicht, sie verwirren. Die Familie unterscheidet sich am
**Funktionszeichen über dem Fuchskopf** – Standort-Pin bei TourFuchs,
Schallwelle bei SoundFuchs, drei Zeilen einer Einkaufsliste bei Foxi –, nicht
an einem Petrol, das ein bisschen grüner ist. `stamm/variables.css` ist
deshalb die einzige Quelle für Leitton, Untergrund, Textfarben und Kontraste,
und `farben.css` enthält heute genau eine zusätzliche Zeile:
`--color-primary-soft` für die sehr helle Fläche einer schon vorgemerkten
Kachel.

Die Prüfstrecke hält das fest: Sie lässt den Lauf durchfallen, wenn
`--color-primary`, `theme-color` und das Manifest nicht alle drei auf
demselben Wert stehen.

Die verworfene Fassung, zum Nachschlagen – damit sie niemand in einem halben
Jahr erneut vorschlägt:

| | Familie (gilt) | eigener Ton (verworfen) |
|---|---|---|
| `--color-primary` | `#0d9488` | ~~`#3f9142`~~ |
| `--color-primary-dark` | `#0f766e` | ~~`#2f6f34`~~ |
| `--color-primary-light` | `#ccfbf1` | ~~`#dff2df`~~ |
| `--color-bg` | `#f8fafc` | ~~`#f7faf5`~~ |

Hausregel: gefüllte Flächen und Pillen tragen `--color-primary`, Text und
Links tragen `--color-primary-dark`.

### 8.3 Datenmodell

```
artikel     { id, name, kategorieId, icon, zaehler, letzteKaeufe[], eigen,
              standardWunsch?, letzteMengen?[{ text, zeit }] }
listeItem   { artikelId, menge, notiz, erledigt, erledigtAm }
kategorie   { id, name, icon, position, ursprung }
rezept      { id, name, artikelIds[], eigen }
einstellung { schluessel, wert }        // modus, ort, katalogVersion
```

`letzteKaeufe` ist das Herzstück: Aus ihm speist sich die lernende
Sortierung, die Statistik, der Stammartikel-Export – und später die
Rhythmus-Erkennung. `letzteMengen` steht daneben und beantwortet die zweite
Frage: nicht *ob*, sondern *wie* dieser Haushalt einen Artikel kauft
(Kapitel 4.4). Beide entstehen am selben Ort, beim Abhaken, und tragen
denselben Zeitstempel – nur deshalb kann „Rückgängig" beide wieder abräumen.
Die Felder mit `?` gibt es erst, sobald sie gebraucht werden; jeder Zugriff
rechnet mit ihrer Abwesenheit.

Die Austauschdatei trägt **bewusst weder `letzteKaeufe` noch
`letzteMengen`**. Die Kaufhistorie ist das Gedächtnis eines Haushalts, keine
Beilage zu einer Einkaufsliste; wer eine Liste weitergibt, gibt nicht mit,
wie oft er Bier kauft und in welcher Menge. Ein Test hält das fest.

---

## 9. Bewusst nicht gebaut

| Funktion | Grund |
|---|---|
| ~~QR-Code-Sync~~ | **Gebaut in 0.11.0.** Die Begründung stimmte für das damalige Format – siehe unten |
| Barcode-Scan | Safari/iOS unterstützt `BarcodeDetector` nicht; eine Produktdatenbank wäre ein Netzwerk-Request |
| Kassenbon-OCR | Thermopapier ist der Worst Case für OCR; die Kaufhistorie entsteht ohnehin beim Abhaken |
| Spracheingabe | Die Web Speech API sendet Audio an Google/Apple – bricht Grundsatz I |
| Angebote und Preise von Händlern | Keine öffentlichen Schnittstellen, rechtlich heikel – **und durch Kapitel 6 besser gelöst** |
| Konto, Login, Cloud-Sync | Widerspricht Grundsatz I |

---

## 10. Erkenntnisse aus dem Bau

Acht Dinge, die Zeit gekostet haben und die man nicht zweimal lernen muss.

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
`:active`-Zustände. **Nachtrag aus 0.9.1:** Dialoge hängen an `body`, nicht
an `#app` – der Schimmer lag dort weiter über jedem Knopf und fiel erst auf
dem Bildschirmfoto der gelernten Mengen auf. Eine Regel, die an einem
Container hängt, gilt eben nur für dessen Kinder; was über den Baum hinaus
gelten soll, gehört an beide Wurzeln.

**Ein Eingabefeld unter 16 px kostet die untere Leiste.** Aus dem Betrieb
gemeldet: „Manchmal komme ich unten nicht mehr an Katalog und Mehr – ich bin
nur noch in der Liste." Drei Dinge trafen zusammen, und alle drei hängen an
der Bildschirmtastatur:

1. iOS **zoomt die ganze Seite heran**, sobald ein Feld mit weniger als 16 px
   Schriftgröße den Fokus bekommt – und zoomt nicht zuverlässig wieder
   heraus. Der Stamm setzt 0,9rem (13,5 px). Danach ist der sichtbare
   Ausschnitt kleiner als die Seite, und die Leiste steht außerhalb.
2. iOS **verkleinert die Seite nicht**, wenn die Tastatur kommt, sondern
   schiebt den sichtbaren Ausschnitt darüber. Verschwindet das fokussierte
   Feld beim Schließen aus dem Dokument – genau das tat jeder Dialog –,
   bleibt der Ausschnitt manchmal oben stehen.
3. Der Dialog sprang **von selbst ins erste Feld**. Damit zog jedes geöffnete
   Artikelblatt die Tastatur hoch, auch wenn man nur die Angebote ansehen
   wollte.

Warum das ausgerechnet hier so weh tut: Foxi ist genau bildschirmhoch, die
Leiste ist eine Zeile im Raster und nicht separat am Bildschirm befestigt.
Jede Verschiebung des Fensters nimmt sie mit – und mit ihr den einzigen Weg
aus der Liste heraus.

Gegenmittel, in dieser Reihenfolge: **Felder auf 16 px** (Ursache), **kein
Fokus ohne Tippabsicht** (Auslöser), **`blur()` vor dem Entfernen** und
`rahmenZurueckholen()` in `schale.js` als Netz darunter – es prüft nach jedem
`focusout` und jeder Größenänderung des Ausschnitts, ob das Fenster
verschoben ist, während niemand tippt, und holt es zurück. Die Prüfstrecke
hält beides fest: dass kein Feld unter 16 px liegt und dass das Blatt keine
Tastatur öffnet.

---

## 11. Prüfen

```bash
npm test                    # 231 Unit-Tests: Sortierung, Suche, Gruppierung,
                            # Exporte, Import, Datenintegrität
node tools/durchlauf.mjs    # 103 Prüfungen im echten Browser (Chromium,
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

## 11a. Was dieses Dokument noch nicht beschreibt

Ehrlicher Lückenvermerk, damit niemand die Beschreibung für vollständig
hält. Im Code steht Folgendes, hier steht es noch nicht:

- **Das Produktgedächtnis** und die Verwaltung **persönlicher Märkte**
  (`aktiveMaerkte`). Kapitel 6.7 erklärt, wofür die Märkte gebraucht werden,
  aber nicht, wie man sie pflegt.
- **Die Mengenangabe** ist weiterhin ein freies Textfeld, und das bleibt sie.
  Zähler mit Einheiten wären der falsche Reflex – sie verlangten für 476
  Artikel je eine Einheit, und ausgerechnet beim Fleisch wäre sie strittig
  (Gramm? Stück? Packung?). Der Weg daraus war derselbe Trick wie beim
  lernenden Katalog: die zuletzt gekauften Mengen je Artikel merken und als
  Knöpfe anbieten – seit 0.9.1 gebaut, beschrieben in Kapitel 4.4. Offen
  bleibt der Fall, für den auch das nicht reicht: der Artikel, den man jedes
  Mal anders kauft.
- **Der Updateweg** der PWA (`src/pwa-update.js`, geprüft in
  `tests/pwa.test.js`), der Version, Manifest, Icon-Adressen und den
  Service-Worker-Zwischenspeicher zusammenhält.

Wer eine davon anfasst, trägt sie bitte hier nach – und zwar mit der
**Begründung**, nicht nur mit der Beschreibung. Das ist der Zweck dieses
Dokuments; eine reine Funktionsliste steht schon in der README.

---

## 12. Was als Nächstes käme

- **Rhythmus:** seit 0.13.0 umgesetzt, siehe Kapitel 14.
- **Ladenzuordnung:** seit 0.13.0 freiwillig vor dem Einkauf, siehe Kapitel 14.
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


## 14. Alltag und Zuverlässigkeit (0.13.0)

Die erste Befüllung schreibt Kategorien, Artikel, Rezepte und Abschlussmarkierung gemeinsam in einer IndexedDB-Transaktion. Fehlt die Markierung nach einem früheren Abbruch, werden nur fehlende Datensätze ergänzt. Vorhandene Haushaltsdaten bleiben bestehen. Eine synchron scheiternde Schreibarbeit bricht die ganze Transaktion ab.

Updates dürfen keinen geöffneten Editor verwerfen. Deshalb verwendet der Worker kein skipWaiting und navigiert keine Fenster. Der neue Cache wird vorbereitet, die Aktivierung wartet auf das Schließen aller alten Fenster. Auch die Startseite kommt aus dem aktiven Cache, damit neue HTML-Dateien nicht mit alten Modulen vermischt werden.

Wiederkauf-Vorschläge verwenden den Median der letzten Kaufabstände und eine Streuungsgrenze. Mindestens drei verschiedene Kauftage, zwei bis 90 Tage Rhythmus und ein höchstens dreifach überfälliger letzter Kauf begrenzen Fehlalarme. Offene Artikel und verschobene Vorschläge erscheinen nicht. Maximal fünf Vorschläge halten die Liste übersichtlich.

Laufwege entstehen nur in freiwillig gestarteten und beendeten Einkäufen. Rückgängig entfernt den zugehörigen Schritt. Die letzten acht Einkäufe pro Laden liefern normalisierte Kategoriepositionen; mindestens drei Beobachtungen je Kategorie sind nötig. Erst ein bestätigter Vorschlag ändert die Sortierung in diesem Laden. Die allgemeine Kategorie-Reihenfolge bleibt bestehen.

Beim Austausch tragen neue Dateien teilmarke und neue QR-Nutzlasten x mit Serie und Revision. Der Inhalt und die Revision bleiben bei unveränderter Liste gleich. Ein Empfänger merkt sich höchstens 20 Absenderstände. Gegen den letzten übernommenen Stand werden Änderungen ermittelt und mit der eigenen aktuellen Liste verglichen. Nur angehakte Änderungen werden übernommen, Konflikte und Löschungen sind zunächst abgewählt. Nicht gesendete eigene Artikel bleiben unberührt. Eine leere Folgeliste kann Löschungen vorschlagen. Ohne Teilmarke gilt der bisherige Import. Dies ist keine automatische Synchronisierung und keine Authentifizierung des Absenders.

Die Händlerauswahl umfasst acht verbreitete Ketten und Sonstiger Laden. Für eigene Läden darf ausschließlich eine lokal ausdrücklich hinterlegte HTTPS-Quelle als zusätzliche Quelle dienen; ein eingelesenes Ergebnis kann sich keine Erlaubnis selbst geben. Händler und Filialbezeichnung werden wortgleich aus dem Rechercheprofil übernommen. Die Prüfung bestätigt Format und erlaubten Host, nicht die Wahrheit eines Preises. Name, Adresse und Website werden weiterhin nur bewusst per Rechercheauftrag weitergegeben.

Vollsicherungen sind vom Listenaustausch getrennt. Sie enthalten auch Fotos, Kaufhistorie und alle Einstellungen, werden streng geprüft und ersetzen alle Speicher atomar. Die private, unverschlüsselte Datei ist bewusst als solche bezeichnet. Beim Wiederherstellen wird die eigene Teilmarke zurückgesetzt, damit kopierte Geräte keine gleichen Revisionszähler weiterführen.

Zurückgestellt: ein optionaler Google-Maps-Link oder eine andere Kartenauswahl zur Suche eines Ladenstandorts. Keine Karte und kein Standortzugriff sind Teil von 0.13.0.

Prüfung: npm test; node tools/durchlauf.mjs; node tools/alltag-lauf.mjs; node tools/update-lauf.mjs. Die Browserläufe prüfen einschließlich JavaScript-/CSP-Fehlern, externen Anfragen, zwei unabhängigen Geräten, Offline-Start und Wiederherstellung.
