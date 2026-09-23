# Wochenangebote mit KI ausprobieren

Foxi kann passende Wochenangebote anzeigen, ohne selbst Händlerseiten
aufzurufen oder im Hintergrund Daten zu versenden. Die Arbeit ist bewusst
geteilt:

1. **Foxi kennt den Bedarf:** ausgewählte Artikel, Region und Märkte.
2. **Ein KI-Recherche-Assistent sucht:** Er prüft die öffentlichen
   Angebotsseiten nach Foxis festen Regeln.
3. **Der Mensch gibt das Ergebnis zurück:** als Foxi-Datei oder vollständigen
   JSON-Text.

Beim ersten Öffnen erklärt Foxi diesen Ablauf in drei Schritten. Danach bleibt
eine kompakte Alltagskarte mit Recherche, Import und einer jederzeit
erreichbaren Hilfe.

## Was im Demo-Profil steht

- Region `45136 Essen`
- zwei ALDI-Nord-Filialen in Essen
- ein REWE-Markt in Essen-Bergerhausen
- eine ALDI-Süd-Filiale in Mülheim an der Ruhr
- 15 erfundene, alltägliche Stammartikel mit groben Gewichten

Die Kaufgewohnheiten sind vollständig erfunden. Eine Wohnadresse steht weder
im Auftrag noch im Repository. Region und ausgewählte Märkte reichen für den
Versuch aus.

## Einmal einrichten

1. Unter **Mehr → Wochenangebote mit KI → Meine Märkte** zunächst die eigenen Filialen hinterlegen. Angeboten werden ALDI Nord, ALDI Süd, Lidl, REWE, EDEKA, Kaufland, Netto Marken-Discount, PENNY und Sonstiger Laden. Bei sonstigen Läden Name und Adresse sowie für die Recherche eine offizielle HTTPS-Angebotsseite eintragen. Anschließend **Geführt einrichten** öffnen.
2. **Rechercheauftrag kopieren** wählen.
3. Den Auftrag in Claude Cowork, ChatGPT oder einen anderen Assistenten mit
   Webrecherche einfügen und ausführen lassen.
4. Die erzeugte Datei über **Ergebnisdatei auswählen** einlesen. Falls der
   Assistent keine Datei erzeugt, sein vollständiges JSON über
   **Aus Zwischenablage übernehmen** einfügen.
5. Foxi prüft das Ergebnis. Gültige Treffer erscheinen in der Wochenkarte und
   direkt an den passenden offenen Artikeln der Einkaufsliste.

Die Einführung verlinkt die offiziellen Anleitungen für geplante Aufgaben:

- [Claude Cowork: wiederkehrende Aufgaben](https://support.claude.com/en/articles/13854387-schedule-recurring-tasks-in-claude-cowork)
- [ChatGPT: geplante Aufgaben](https://help.openai.com/en/articles/10291617/scheduled-tasks-in-chatgpt)

Welche Funktionen ein Konto oder Tarif tatsächlich anbietet, entscheidet der
jeweilige Anbieter. Foxi benötigt für den manuellen Ablauf keine Bindung an
einen bestimmten Dienst.

## Wiederkehrend recherchieren

Der einmal kopierte Auftrag kann im gewählten Assistenten als wöchentliche
Aufgabe gespeichert werden, beispielsweise montagmorgens. Empfohlener Name:
`Foxi – Wochenangebote`.

Kann der Assistent eine Datei erzeugen, soll sie
`foxi-angebote-JJJJ-MM-TT.json` heißen. Foxi überwacht keinen Ordner und liest
nichts automatisch ein: Der Nutzer wählt die neue Datei bewusst aus. Diese
Grenze hält den Ablauf verständlich und verhindert überraschende Zugriffe.

## Was Foxi beim Import prüft

Foxi nimmt Ergebnisse mit der Kennung `foxi-angebote` bis zur aktuellen
Version 2 an. Jeder Treffer muss unter anderem enthalten:

- Foxi-Artikel und konkretes Händlerprodukt
- Händler und Markt
- Preis, Packungsgröße und Grundpreis
- Beginn und Ende der Gültigkeit
- Kennzeichnung als genauer Treffer oder Alternative
- eine öffentliche HTTPS-Quelle eines der acht angebotenen Händler oder die für genau diesen eigenen Laden lokal hinterlegte Quelle

In Version 2 muss der Grundpreis eine positive Zahl und einen eindeutigen
Nenner tragen, beispielsweise `0,99 €/l`, `1,49 €/kg` oder
`0,25 €/Stück`. Bereits gespeicherte Ergebnisse der Version 1 bleiben
lesbar. Ein alter, nicht eindeutig parsebarer Grundpreistext wird angezeigt,
aber nie für eine Bestpreis-Markierung verwendet. Erkennbare Null- und
Negativwerte weist Foxi in beiden Versionen ab.

Freier Grundpreistext in Version 2, fremde Quellen, ungültige Preise und
widersprüchliche Gültigkeitsdaten werden nicht übernommen. Importiertes HTML
wird nie ausgeführt. Identische Angebote desselben Händlers in mehreren
Filialen fasst Foxi zusammen; die einzelnen Märkte bleiben aufklappbar.

**Jedes Angebot braucht eine Filiale aus „Meine Märkte“.** Vor der Prüfung
ordnet Foxi Händler und Markt einer gespeicherten Filiale zu – auch in
anderer Schreibweise, etwa „Rellinghauser Str. 239, 45136 Essen“ für
„Rellinghauser Straße 239, Essen“. Angebote ohne passende Filiale, zum
Beispiel „alle Filialen“ oder „bundesweit“, lässt Foxi weg; die Meldung nach
dem Einlesen nennt ihre Zahl. Ein Demo-Ergebnis wird am Demo-Profil gemessen.

Optional darf das Ergebnis eine Liste `nichtGelesen` tragen: höchstens 20
Einträge mit `haendler`, `markt` und einem kurzen `grund`. Foxi zeigt sie
unter dem Status an, damit „kein Angebot“ nicht mit „nicht nachgesehen“
verwechselt wird.

## Was die Preismarkierung bedeutet

Foxi behauptet nicht, den gesamten Markt zu kennen. Sind für denselben
Foxi-Artikel mindestens zwei vergleichbare Grundpreise vorhanden, markiert es
den niedrigsten davon als **Niedrigster gefundener Grundpreis**. Angaben pro
Gramm oder 100 Gramm werden dafür auf Kilogramm umgerechnet, Angaben pro
Milliliter oder 100 Milliliter auf Liter. Schreibweisen wie `1 l`, `Liter`
und `l` sowie `Stück` und `Stk.` gelten als gleich. Kilogramm wird weiterhin
nicht mit Liter verglichen. Ein einzelner Fund erhält keine
Bestpreis-Auszeichnung.

Ein Wochenangebot ist außerdem nicht automatisch der günstigste Gesamtpreis.
Reguläre Preise, Marken, Packungsgrößen sowie App- und Couponbedingungen
können das Ergebnis verändern. Die belastbare Aussage lautet deshalb:

> Unter den eingelesenen und vergleichbaren Treffern ist dies der niedrigste
> gefundene Grundpreis.

Nicht:

> Dieser Händler ist garantiert überall am günstigsten.

Die Prüfung bestätigt zulässiges Format, echte Kalenderdaten und erlaubte Quellenhosts. Sie ist keine unabhängige Prüfung des Händlerpreises. Eine optionale Kartenauswahl (etwa Google Maps) bleibt für eine spätere Fassung vorgemerkt.
