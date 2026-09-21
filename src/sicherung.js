import { pruefeAngebotsergebnis, sichereAngebotsseite } from './angebotsradar.js';
import { gueltigeTeilmarke, pruefeAustauschdatei } from './logik.js';

const objekt = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = (v, max = 500) => typeof v === 'string' && v.length <= max;
const id = v => text(v, 200) && v.length > 0 && !['__proto__', 'constructor', 'prototype'].includes(v);
const zahl = v => Number.isFinite(v) && v >= 0;
const menge = (v, max, test) => Array.isArray(v) && v.length <= max && v.every(test);
const eindeutig = (liste, feld) => new Set(liste.map(e => e[feld])).size === liste.length;
const stand = s => objekt(s) && Number.isSafeInteger(s.revision) && s.revision > 0 &&
    pruefeAustauschdatei({ typ: 'foxi-liste', version: 1, artikel: s.artikel }).gueltig;

/** Vollsicherungen sind absichtlich ein anderes Format als geteilte Listen. */
export function pruefeSicherung(daten) {
    try {
        if (!objekt(daten) || daten.typ !== 'foxi-sicherung' || daten.version !== 1 || !objekt(daten.daten)) return false;
        const d = daten.daten;
        if (!menge(d.kategorien, 100, k => objekt(k) && id(k.id) && text(k.name) && text(k.icon,64) && zahl(k.position)) || !d.kategorien.length || !eindeutig(d.kategorien,'id')) return false;
        const kategorien = new Set(d.kategorien.map(k => k.id));
        if (!menge(d.artikel, 10000, a => objekt(a) && id(a.id) && text(a.name,300) && kategorien.has(a.kategorieId) && text(a.icon,64) &&
            Number.isSafeInteger(a.zaehler) && a.zaehler >= 0 && menge(a.letzteKaeufe,60,zahl) &&
            (a.standardWunsch === undefined || text(a.standardWunsch,1003)) &&
            (a.letzteMengen === undefined || menge(a.letzteMengen,20,m => objekt(m) && text(m.text,180) && zahl(m.zeit))))) return false;
        if (!d.artikel.length || !eindeutig(d.artikel,'id')) return false;
        const artikel = new Set(d.artikel.map(a => a.id));
        if (!menge(d.liste,10000,e => objekt(e) && artikel.has(e.artikelId) && text(e.menge,1003) && text(e.notiz,500) && typeof e.erledigt === 'boolean' && (e.erledigtAm === null || zahl(e.erledigtAm))) || !eindeutig(d.liste,'artikelId')) return false;
        if (!menge(d.rezepte,1000,r => objekt(r) && id(r.id) && text(r.name,300) && menge(r.artikelIds,10000,i => artikel.has(i))) || !eindeutig(d.rezepte,'id')) return false;
        if (!menge(d.bilder,1000,b => objekt(b) && artikel.has(b.artikelId) && text(b.datenUrl,900000) && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(b.datenUrl)) || !eindeutig(d.bilder,'artikelId')) return false;
        if (!menge(d.einstellungen,30,e => objekt(e) && id(e.schluessel)) || !eindeutig(d.einstellungen,'schluessel')) return false;
        const e = Object.fromEntries(d.einstellungen.map(x => [x.schluessel,x.wert]));
        const erlaubt = new Set(['modus','katalogVersion','ort','maerkte','angebotsergebnis','angebotseinfuehrungErledigt','wiederkaufSpaeter','laufenderEinkauf','laufwege','teilmarke','empfangeneStaende']);
        if (Object.keys(e).some(k => !erlaubt.has(k))) return false;
        if (!['basis','experte'].includes(e.modus) || !(text(e.katalogVersion,100) || zahl(e.katalogVersion))) return false;
        if (e.ort !== undefined && !text(e.ort,1000)) return false;
        const maerkte = e.maerkte || [];
        if (!menge(maerkte,200,m => objekt(m) && id(m.id) && text(m.haendler,80) && text(m.markt,200) && text(m.angebotsseite,500) && (!m.angebotsseite || sichereAngebotsseite(m.angebotsseite)) && typeof m.aktiv === 'boolean')) return false;
        if (e.angebotsergebnis && !pruefeAngebotsergebnis(e.angebotsergebnis, maerkte).gueltig) return false;
        if (e.angebotseinfuehrungErledigt !== undefined && typeof e.angebotseinfuehrungErledigt !== 'boolean') return false;
        if (e.wiederkaufSpaeter !== undefined && (!objekt(e.wiederkaufSpaeter) || Object.entries(e.wiederkaufSpaeter).some(([k,v]) => !id(k) || !zahl(v)))) return false;
        if (e.laufenderEinkauf && (!objekt(e.laufenderEinkauf) || !id(e.laufenderEinkauf.marktId) || !zahl(e.laufenderEinkauf.gestartet) || !menge(e.laufenderEinkauf.schritte,1000,s => objekt(s) && artikel.has(s.artikelId) && kategorien.has(s.kategorieId) && zahl(s.zeit)))) return false;
        if (e.laufwege !== undefined && (!objekt(e.laufwege) || Object.entries(e.laufwege).some(([k,v]) => !id(k) || !objekt(v) || !menge(v.reihenfolge,100,i => kategorien.has(i)) || !menge(v.einkaeufe,8,r => objekt(r) && zahl(r.zeit) && menge(r.kategorien,100,i => kategorien.has(i)))))) return false;
        if (e.teilmarke && (!gueltigeTeilmarke(e.teilmarke) || !text(e.teilmarke.inhalt,2000000))) return false;
        if (e.empfangeneStaende !== undefined && (!objekt(e.empfangeneStaende) || Object.entries(e.empfangeneStaende).length > 20 || Object.entries(e.empfangeneStaende).some(([k,v]) => !id(k) || !stand(v)))) return false;
        return true;
    } catch { return false; }
}
