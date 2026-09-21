import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import * as db from '../src/db.js';
import * as z from '../src/zustand.js';
import { kaufStatistik, wiederkaufVorschlaege, gelernterLaufweg, vergleicheListenstand, TAG_MS } from '../src/logik.js';
import { HAENDLER, pruefeAngebotsergebnis } from '../src/angebotsradar.js';
import { pruefeSicherung } from '../src/sicherung.js';
const jetzt = Date.UTC(2026,8,21,12);
const artikel = (id='milch') => ({ id, name:id, kategorieId:'molkerei', icon:'x', zaehler:0, letzteKaeufe:[] });
const angebot = (extra={}) => ({ artikelId:'milch', artikelName:'Milch', haendler:'Lidl', markt:'Berlin', produkt:'Milch', preis:1, waehrung:'EUR', menge:'1 l', grundpreis:'1,00 €/l', gueltigVon:'2026-09-21', gueltigBis:'2026-09-26', treffer:'genau', hinweis:'', quelle:'https://www.lidl.de/angebote', ...extra });
const ergebnis = a => ({typ:'foxi-angebote', version:2, profilId:'x', demo:false, erzeugt:'2026-09-21T12:00:00Z', angebote:[a]});

beforeEach(async () => {
    await z.allesZuruecksetzen();
    vi.stubGlobal('fetch', vi.fn(async url => ({json:async () => JSON.parse(readFileSync(new URL('../'+url.replace('./',''),import.meta.url),'utf8'))})));
});

describe('Reparaturen und atomare Datenhaltung', () => {
    it('repariert einen unterbrochenen Erststart und bewahrt eigene Artikel', async () => {
        await db.lege(db.SPEICHER.KATEGORIEN,{id:'molkerei',name:'Eigene Kategorie',icon:'x',position:0});
        await db.lege(db.SPEICHER.ARTIKEL,artikel('eigen'));
        await z.starte();
        expect(z.zustand.artikel.size).toBeGreaterThan(400);
        expect(z.zustand.artikel.has('eigen')).toBe(true);
        expect(z.zustand.kategorien.find(k=>k.id==='molkerei').name).toBe('Eigene Kategorie');
        expect(await db.hole(db.SPEICHER.EINSTELLUNGEN,'katalogVersion')).toBeTruthy();
    });
    it('rollt einen fehlgeschlagenen Schreibvorgang über alle Speicher zurück', async () => {
        await expect(db.atomar({artikel:[artikel()],liste:[{}]})).rejects.toBeTruthy();
        expect(await db.alle('artikel')).toEqual([]);
        expect(await db.alle('liste')).toEqual([]);
    });
    it('reaktiviert erledigte Rezeptzutaten und erhält offene Mengen', async () => {
        z.zustand.artikel=new Map([['milch',artikel()],['brot',artikel('brot')]]);
        z.zustand.liste=new Map([['milch',{artikelId:'milch',erledigt:true}],['brot',{artikelId:'brot',menge:'3',erledigt:false}]]);
        z.zustand.rezepte=[{id:'r',artikelIds:['milch','brot']}];
        expect(await z.rezeptAufListe('r')).toBe(1);
        expect(z.zustand.liste.get('milch').erledigt).toBe(false);
        expect(z.zustand.liste.get('brot').menge).toBe('3');
    });
    it('zeigt den Gesamtzähler jenseits der gekappten Historie', () => {
        expect(kaufStatistik([{...artikel(),zaehler:85,letzteKaeufe:Array(60).fill(jetzt)}])[0].anzahl).toBe(85);
    });
    it.each(['2026-02-30','2026-02-29','2026-04-31'])('weist unmögliche Daten %s ab', datum => {
        expect(pruefeAngebotsergebnis(ergebnis(angebot({gueltigVon:datum}))).gueltig).toBe(false);
    });
});

describe('Händler und selbst hinterlegte Quellen', () => {
    it.each(HAENDLER)('nimmt offizielle Quellen von $name an', h => {
        expect(pruefeAngebotsergebnis(ergebnis(angebot({haendler:h.name,quelle:h.url}))).gueltig).toBe(true);
    });
    it('vertraut eigenen Hosts nur aus lokalen Markteinstellungen, niemals aus dem Ergebnis', () => {
        const a=angebot({haendler:'Sonstiger Laden',markt:'Bioladen, Berlin',quelle:'https://bio.example/angebote'});
        expect(pruefeAngebotsergebnis(ergebnis(a)).gueltig).toBe(false);
        const maerkte=[{haendler:a.haendler,markt:a.markt,angebotsseite:'https://bio.example/'}];
        expect(pruefeAngebotsergebnis(ergebnis(a),maerkte).gueltig).toBe(true);
        expect(pruefeAngebotsergebnis(ergebnis({...a,quelle:'https://bio.example.evil.test/'}),maerkte).gueltig).toBe(false);
        expect(pruefeAngebotsergebnis(ergebnis({...a,quelle:'http://bio.example/'}),maerkte).gueltig).toBe(false);
    });
});

describe('Wiederkauf und Laufwege', () => {
    const a={...artikel(),letzteKaeufe:[28,21,14,7].map(t=>jetzt-t*TAG_MS)};
    it('erklärt einen stabilen Rhythmus und respektiert Snooze/offene Liste', () => {
        expect(wiederkaufVorschlaege([a],new Map(),{},jetzt)[0]).toMatchObject({rhythmus:7,seit:7});
        expect(wiederkaufVorschlaege([a],new Map([['milch',{erledigt:false}]]),{},jetzt)).toEqual([]);
        expect(wiederkaufVorschlaege([a],new Map(),{milch:jetzt+TAG_MS},jetzt)).toEqual([]);
    });
    it('empfiehlt nichts mit zu wenigen oder sehr alten Käufen', () => {
        expect(wiederkaufVorschlaege([{...a,letzteKaeufe:a.letzteKaeufe.slice(0,2)}],new Map(),{},jetzt)).toEqual([]);
        expect(wiederkaufVorschlaege([a],new Map(),{},jetzt+100*TAG_MS)).toEqual([]);
    });
    it('lernt erst nach drei Einkäufen und ergänzt ungesehene Kategorien', () => {
        const k=['a','b','c','d'].map((id,position)=>({id,position}));
        const e={kategorien:['c','b','a']};
        expect(gelernterLaufweg([e,e],k)).toBeNull();
        expect(gelernterLaufweg([e,e,e],k)).toEqual(['c','b','a','d']);
    });
    it('speichert Laufweg und Snooze lokal, Undo entfernt den Schritt', async () => {
        await z.starte();
        const markt=await z.marktSpeichern({haendler:'Lidl',markt:'Berlin'});
        await z.einkaufStarten(markt.id); await z.aufListeSetzen('milch'); await z.abhaken('milch');
        expect(z.zustand.einstellungen.laufenderEinkauf.schritte).toHaveLength(1);
        await z.zurueckholen('milch');
        expect(z.zustand.einstellungen.laufenderEinkauf.schritte).toHaveLength(0);
        await z.wiederkaufVerschieben('milch');
        expect((await db.hole('einstellungen','wiederkaufSpaeter')).wert.milch).toBeGreaterThan(Date.now());
    });
});

describe('Stände vergleichen und sichern', () => {
    const a={id:'milch',name:'Milch',menge:'1 l'};
    it('erkennt Mengenänderungen, Löschungen und lokale Konflikte getrennt', () => {
        expect(vergleicheListenstand([{...a,menge:'2 l'}],[a],new Map([['milch',{...a,menge:'3 l'}]]))[0]).toMatchObject({art:'geaendert',konflikt:true});
        expect(vergleicheListenstand([],[a],new Map([['milch',a]]))[0]).toMatchObject({art:'entfernt',konflikt:false});
        expect(vergleicheListenstand([a],[a],new Map([['milch',{...a,erledigt:true}]]))).toEqual([]);
    });
    it('bewahrt gleiche Teilmarken bei unverändertem Inhalt', async () => {
        await z.starte(); await z.aufListeSetzen('milch');
        const erste=await z.neueTeilmarke();
        expect(await z.neueTeilmarke()).toEqual(erste);
        await z.produktwunschSetzen('milch','2 l');
        expect((await z.neueTeilmarke()).revision).toBe(erste.revision+1);
    });
    it('sichert und stellt alle Speicher atomar wieder her', async () => {
        await z.starte(); await z.aufListeSetzen('milch'); await z.produktwunschSetzen('milch','2 l'); await z.abhaken('milch');
        const backup=await db.sicherungLesen();
        expect(pruefeSicherung(backup)).toBe(true);
        await z.listeLeeren(); await db.sicherungErsetzen(backup.daten);
        expect((await db.hole('liste','milch')).menge).toBe('2 l');
        expect((await db.hole('artikel','milch')).zaehler).toBe(1);
        backup.daten.bilder=[{artikelId:'milch',datenUrl:'data:image/svg+xml,<svg onload=alert(1)>'}];
        expect(pruefeSicherung(backup)).toBe(false);
    });
});
