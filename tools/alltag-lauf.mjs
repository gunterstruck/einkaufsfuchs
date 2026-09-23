import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium, devices } from 'playwright';
import { warteBis } from './warten.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const url='http://localhost:8134/';
const server=spawn(process.execPath,[join(root,'tools/server.mjs')],{env:{...process.env,PORT:'8134'},stdio:'ignore'});
let browser;
const errors=[],foreign=[];
let checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks++;console.log('✓ '+message);};
try {
    for(let i=0;i<50;i++){try{await fetch(url);break;}catch{await new Promise(r=>setTimeout(r,100));}}
    /* Wie in `durchlauf.mjs`: Wo der Browser liegt, darf die Umgebung sagen.
       Ohne diesen Ausweg lässt sich der Lauf dort nicht starten, wo Chromium
       schon installiert ist, aber nicht an Playwrights Standardstelle. */
    browser=await chromium.launch(process.env.FOXI_CHROMIUM?{executablePath:process.env.FOXI_CHROMIUM}:{});
    const a=await browser.newContext({...devices['iPhone 13'],permissions:['clipboard-read','clipboard-write']});
    const b=await browser.newContext({...devices['iPhone 13']});
    const p=await a.newPage(),q=await b.newPage();
    for(const page of [p,q]){
        page.on('pageerror',e=>errors.push(String(e)));
        page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
        page.on('request',r=>{if(!r.url().startsWith(url)&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))foreign.push(r.url());});
        await page.goto(url,{waitUntil:'networkidle'});
        await warteBis(page, async()=> (await import('./src/zustand.js')).zustand.bereit, 'Foxi ist geladen');
    }
    await p.locator('#tab-mehr').click();
    await p.locator('.meine-maerkte summary').click();
    await p.getByRole('button',{name:'Markt hinzufügen',exact:true}).click();
    ok(await p.locator('.dialog select option').count()===9,'Acht Händler und Sonstiger Laden auswählbar');
    await p.locator('.dialog select').selectOption('Sonstiger Laden');
    await p.getByRole('textbox',{name:'Name des Ladens und genaue Adresse',exact:true}).fill('Bioladen Grün, Musterstraße 1, Berlin');
    await p.getByRole('textbox',{name:'Offizielle Angebotsseite (optional, https://…)',exact:true}).fill('javascript:alert(1)');
    await p.locator('.dialog-knoepfe .primary').click();
    ok(await p.locator('.dialog').count()===1,'Ungültige Händlerquelle lässt den Dialog zur Korrektur offen');
    await p.getByRole('textbox',{name:'Offizielle Angebotsseite (optional, https://…)',exact:true}).fill('https://bio.example/angebote');
    await p.locator('.dialog-knoepfe .primary').click();
    await warteBis(p, async()=> (await import('./src/zustand.js')).maerkte().length===1, 'der Markt ist gespeichert');
    ok(await p.evaluate(async()=> (await import('./src/ui/angebote.js')).persoenlicherAuftragAlsText().includes('bio.example')),'Eigener Laden und Quelle erscheinen im Rechercheauftrag');
    await p.evaluate(async()=> {
        const z=await import('./src/zustand.js'), db=await import('./src/db.js');
        const milch=z.zustand.artikel.get('milch');milch.letzteKaeufe=[28,21,14,7].map(n=>Date.now()-n*86400000);milch.zaehler=4;
        await db.lege('artikel',milch);await z.ortSetzen('Berlin');
    });
    await p.locator('#tab-liste').click();
    await p.locator('.wiederkauf summary').click();
    mkdirSync(join(root,'..','review-images'),{recursive:true});
    await p.screenshot({path:join(root,'..','review-images','wiederkauf.png')});
    ok((await p.locator('.wiederkauf').textContent()).includes('ungefähr alle 7 Tage'),'Wiederkauf zeigt nachvollziehbaren Rhythmus');
    await p.getByRole('button',{name:'Noch genug',exact:true}).click();
    await warteBis(p, async()=> Boolean((await import('./src/zustand.js')).zustand.einstellungen.wiederkaufSpaeter.milch), '„Noch genug" ist vermerkt');
    await p.reload({waitUntil:'networkidle'});
    ok(await p.locator('.wiederkauf').count()===0,'Noch genug überlebt einen Neustart');
    await p.evaluate(async()=> {
        const z=await import('./src/zustand.js'); const markt=z.maerkte()[0];
        const kat=z.zustand.kategorien.slice(0,3).reverse();
        for(let i=0;i<3;i++){
            await z.einkaufStarten(markt.id);
            for(const k of kat){const art=z.alleArtikel().find(a=>a.kategorieId===k.id);await z.aufListeSetzen(art.id);await z.abhaken(art.id);}
            await z.einkaufBeenden();await z.erledigteAufraeumen();
        }
    });
    await p.locator('.laufweg summary').click();
    await p.screenshot({path:join(root,'..','review-images','laufweg.png')});
    ok(await p.getByRole('button',{name:'Diesen Laufweg merken'}).count()===1,'Nach drei Einkäufen wird ein Laufweg angeboten');
    await p.getByRole('button',{name:'Diesen Laufweg merken'}).click();
    await warteBis(p, async()=> Object.values((await import('./src/zustand.js')).zustand.einstellungen.laufwege)[0].reihenfolge.length>0, 'der Laufweg ist gespeichert');
    await p.locator('.laufweg summary').click();
    await p.getByRole('button',{name:'Einkauf starten',exact:true}).click();
    await p.getByRole('button',{name:'Einkauf beenden',exact:true}).waitFor();
    ok(await p.evaluate(async()=> {const z=await import('./src/zustand.js'); return z.listenKategorien()[0].id===z.zustand.kategorien[2].id;}),'Gespeicherter Laufweg gilt für den gewählten Laden');
    await p.getByRole('button',{name:'Einkauf beenden',exact:true}).click();
    await p.evaluate(async()=>{const z=await import('./src/zustand.js');await z.listeLeeren();await z.aufListeSetzen('milch');await z.produktwunschSetzen('milch','1 l');await z.aufListeSetzen('butter');});
    const link1=await p.evaluate(async()=> (await import('./src/ui/teilen.js')).aktuelleQrAdresse());
    await q.goto(link1,{waitUntil:'networkidle'});
    await q.getByRole('button',{name:'Auswahl übernehmen'}).click();
    await warteBis(q, async()=> (await import('./src/zustand.js')).zustand.liste.size===2, 'das zweite Gerät hat zwei Artikel');
    await q.evaluate(async()=> (await import('./src/zustand.js')).produktwunschSetzen('milch','3 l'));
    await p.evaluate(async()=>{const z=await import('./src/zustand.js');await z.produktwunschSetzen('milch','2 l');await z.vonListeNehmen('butter');await z.aufListeSetzen('eier');});
    const link2=await p.evaluate(async()=> (await import('./src/ui/teilen.js')).aktuelleQrAdresse());
    await q.goto(link2,{waitUntil:'networkidle'});
    ok((await q.locator('.dialog-koerper').textContent()).includes('Auch bei dir geändert'),'Zweites Gerät erkennt parallele Mengenänderung');
    ok(await q.locator('.stand-aenderung input:checked').count()===1,'Nur konfliktfreie neue Artikel vorausgewählt');
    await q.getByRole('button',{name:'Auswahl übernehmen'}).click();
    await warteBis(q, async()=> (await import('./src/zustand.js')).zustand.liste.has('eier'), 'die Eier sind angekommen');
    ok(await q.evaluate(async()=>{const z=await import('./src/zustand.js');return z.zustand.liste.get('milch').menge==='3 l'&&z.zustand.liste.has('butter');}),'Lokale Menge und nicht bestätigte Löschung bleiben erhalten');
    await q.goto(link1,{waitUntil:'networkidle'});
    ok(await q.locator('.dialog').count()===0,'Älterer Link wird nicht erneut übernommen');
    await p.evaluate(async()=> (await import('./src/zustand.js')).listeLeeren());
    const leer=await p.evaluate(async()=> (await import('./src/ui/teilen.js')).aktuelleQrAdresse());
    await q.goto(leer,{waitUntil:'networkidle'});
    ok((await q.locator('.dialog-koerper').textContent()).includes('Entfernt:'),'Auch eine geleerte Liste überträgt eine Änderungsvorschau');
    await q.locator('.dialog-abbruch').click();
    await q.locator('#tab-mehr').click();
    const download= q.waitForEvent('download');
    await q.getByRole('button',{name:'Alles auf diesem Gerät sichern',exact:true}).click();
    const datei=await download;const pfad=await datei.path();
    await q.evaluate(async()=> (await import('./src/zustand.js')).listeLeeren());
    const chooser=q.waitForEvent('filechooser');
    await q.getByRole('button',{name:'Vollsicherung wiederherstellen',exact:true}).click();
    await (await chooser).setFiles(pfad);
    await Promise.all([q.waitForNavigation({waitUntil:'networkidle'}), q.getByRole('button',{name:'Lokale Daten durch Sicherung ersetzen',exact:true}).click()]);
    await warteBis(q, async()=> (await import('./src/zustand.js')).zustand.liste.has('milch'), 'die Milch ist angekommen');
    ok(await q.evaluate(async()=> (await import('./src/zustand.js')).zustand.liste.get('milch').menge==='3 l'),'Vollsicherung stellt Listeninhalt im Browser wieder her');
    await a.setOffline(true);await p.reload({waitUntil:'domcontentloaded'});
    await warteBis(p, async()=> (await import('./src/zustand.js')).zustand.bereit, 'Foxi ist nach dem Neustart bereit');
    ok(await p.locator('#liste-inhalt').isVisible(),'Neue Fassung startet vollständig offline');
    mkdirSync(join(root,'..','review-images'),{recursive:true});
    await q.screenshot({path:join(root,'..','review-images','alltag-mobil.png')});
    ok(errors.length===0,'Keine JavaScript- oder CSP-Fehler: '+errors.join('; '));
    ok(foreign.length===0,'Keine fremden Netzwerkanfragen');
    console.log(checks+'/'+checks+' Alltags-Prüfungen bestanden.');
} finally {await browser?.close();server.kill();}
