# Für KI-Agenten und neue Mitarbeitende

Kurze Orientierung. Das Warum steht in [`docs/KONZEPT.md`](docs/KONZEPT.md) –
lies es, bevor du etwas Größeres änderst.

## Was das hier ist

**EinkaufsFuchs** (kurz: **Foxi**) – eine Einkaufsliste als PWA. Vanilla JS,
kein Framework, kein Bauschritt, keine Laufzeit-Abhängigkeit. Artikel werden
durch Antippen einer Kachel hinzugefügt; der Katalog lernt aus dem Abhaken,
was der Haushalt braucht, und sortiert sich danach.

## Die drei Regeln, die nicht verhandelbar sind

**1. Alle Daten bleiben auf dem Gerät.** Keine Cloud, kein Konto, kein
Backend, keine ausgehende Anfrage im Betrieb. Wenn eine Funktion das brechen
würde, wird sie nicht gebaut – sondern über die KI-Brücke gelöst
(`docs/KONZEPT.md`, Kapitel 6).

**2. Einfachheit ist die Hauptfunktion.** Im Zweifel weglassen. Der
Basismodus darf keine einzige Funktion zeigen, die man erklären müsste.

**3. Kein Inline-CSS, kein Inline-JavaScript.** Die Auslieferung setzt
`Content-Security-Policy: default-src 'self'`. Ein `style`-Attribut oder ein
`<script>` im Markup geht live stumm kaputt. Gegenprobe:

```bash
grep -rn "\.style\.\|innerHTML\|<style\|style=" src/ index.html | grep -v "^src/styles"
```

## Wo was hingehört

| | |
|---|---|
| Sichtbare Texte | **nur** `src/texte.js` |
| Farben, Radien, Schatten | `src/styles/farben.css` (Eigenes) |
| `src/styles/stamm/` | **nicht anfassen** – Zeile für Zeile aus TourFuchs |
| Reine Rechenregeln | `src/logik.js` (ohne DOM, deshalb testbar) |
| Zustand + IndexedDB | `src/zustand.js`, `src/db.js` |
| Die drei Bildschirme | `src/ui/liste.js`, `katalog.js`, `mehr.js` |

Zwei Bezeichner dürfen **nie** umbenannt werden, auch wenn sie alt aussehen:
`DB_NAME` in `db.js` (sonst verlieren alle Installationen ihre Daten) und
`DATEI_TYP` in `logik.js` (sonst weist die App ihre eigenen älteren Dateien
ab).

## Loslegen und prüfen

```bash
npm run dev                 # http://localhost:8080 – ohne npm install
npm install && npm test     # 48 Unit-Tests
node tools/durchlauf.mjs    # 39 Prüfungen im echten Browser + Bilder
```

Für die Prüfstrecke einmalig:
`npm i --no-save playwright && npx playwright install chromium`

**Beides muss grün sein, bevor du pushst.** Die Prüfstrecke hat in diesem
Projekt drei echte Fehler gefunden, die kein Nachdenken gefunden hätte – sie
fährt einen echten Browser, misst die Zwischenablage, zählt jede
Netzwerkanfrage und lässt bei jedem Konsolenfehler durchfallen.

## Häufige Stolpersteine

- **Nicht auf das Bild warten, sondern auf den Zustand.** Kacheln färben sich
  absichtlich um, bevor geschrieben ist.
- **`fullPage`-Screenshots funktionieren nicht** – es scrollt der Bereich,
  nicht die Seite.
- **Zwei Namen:** `app.name` (EinkaufsFuchs) nach außen, `app.kurz` (Foxi)
  im Gebrauch. Die Kopfzeile wechselt bei 420 px.

## Der Teil, der außerhalb dieses Repos lebt

Preise, Angebote und Weltwissen holt ein **KI-Agent im Hintergrund** – eine
geplante Routine, die zweimal wöchentlich läuft. Die App kennt ihn nicht und
baut nie eine Verbindung zu ihm auf; ein Mensch trägt Klartext per
Zwischenablage hinüber. Warum das so gebaut ist und was beim Betrieb der
Routine schiefgeht, steht in `docs/KONZEPT.md`, Kapitel 6.

**Wichtig dabei:** An die Exporte wird **nie** eine vorformulierte Frage
angehängt. Zwei Tests halten das fest.
