'use strict';
const TYPES = {
  'sp+hu+': { name: 'Funkenflug', lead: 'Du verliebst dich in Leichtigkeit und gemeinsames Lachen.', tr: ['Spontan und neugierig', 'Humor ist dein Liebesbeweis', 'Langeweile ist dein Dealbreaker'], h: [30, 345] },
  'sp+hu-': { name: 'Nachtwanderer', lead: 'Du suchst Abenteuer, aber mit Tiefe.', tr: ['Bricht gern spontan auf', 'Will verstehen, nicht nur erleben', 'Beste Gespräche nach Mitternacht'], h: [265, 200] },
  'sp-hu+': { name: 'Sonntagsherz', lead: 'Du baust Nähe über Rituale und viel Lachen.', tr: ['Verlässlich und warm', 'Alltagshumor schlägt große Gesten', 'Liebt gemeinsame Gewohnheiten'], h: [40, 150] },
  'sp-hu-': { name: 'Kaminfeuer', lead: 'Du liebst langsam, tief und beständig.', tr: ['Nimmt sich Zeit', 'Sucht echte Gespräche', 'Bleibt, wenn es ernst wird'], h: [10, 290] }
};
const WORDS = { sp: ['spontan', 'planvoll'], na: ['nähesuchend', 'freiheitsliebend'], hu: ['verspielt', 'tiefgründig'], ge: ['gesellig', 'ruhig'] };
const CMP = { spontan: 'spontaner', planvoll: 'planvoller', 'nähesuchend': 'nähesuchender', freiheitsliebend: 'freiheitsliebender', verspielt: 'verspielter', 'tiefgründig': 'tiefgründiger', gesellig: 'geselliger', ruhig: 'ruhiger' };
const norm = ax => { const o = {}; for (const k of ['sp', 'na', 'hu', 'ge']) o[k] = Math.max(-1, Math.min(1, (Number(ax?.[k]) || 0) / 3.2)); return o; };
const typeKey = ax => { const u = norm(ax); return (u.sp >= 0 ? 'sp+' : 'sp-') + (u.hu >= 0 ? 'hu+' : 'hu-'); };
module.exports = { TYPES, WORDS, CMP, norm, typeKey };
