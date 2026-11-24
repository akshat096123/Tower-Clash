import React, { useMemo, useState } from 'react';
import { Search, Shield, Skull } from 'lucide-react';
import { TOWER_CATALOG } from '../engine/Tower';
import { BASE_BOT_HP, BASE_BOT_SPEED, ENEMY_ARCHETYPES } from '../engine/balance';
import { Trie } from '../dsa/strings';
import { HashTable } from '../dsa/hashing';

const ENEMY_CODEX = Object.values(ENEMY_ARCHETYPES).map((spec) => ({
  type: spec.type,
  name: spec.name,
  hp: Math.round(BASE_BOT_HP * spec.hpMult),
  speed: Math.round(BASE_BOT_SPEED * spec.speedMult),
  armor: spec.armor,
  reward: spec.reward,
  ability: spec.description,
}));

export const TowerCollection: React.FC = () => {
  const [query, setQuery] = useState('');

  const { trie, hashTable, allNames } = useMemo(() => {
    const t = new Trie();
    const ht = new HashTable<{ kind: 'tower' | 'enemy'; name: string }>('chaining', 29);
    const names: string[] = [];

    for (const tw of Object.values(TOWER_CATALOG)) {
      t.insert(tw.name);
      ht.insert(tw.name.toLowerCase(), { kind: 'tower', name: tw.name });
      names.push(tw.name);
    }
    for (const en of ENEMY_CODEX) {
      t.insert(en.name);
      ht.insert(en.name.toLowerCase(), { kind: 'enemy', name: en.name });
      names.push(en.name);
    }
    return { trie: t, hashTable: ht, allNames: names };
  }, []);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allNames.map((n) => n.toLowerCase());
    return trie.autocomplete(q);
  }, [query, trie, allNames]);

  const exactHashMatch = query.trim() ? hashTable.get(query.trim().toLowerCase()) : undefined;

  const filteredTowers = Object.values(TOWER_CATALOG).filter(
    (t) =>
      !query.trim() ||
      suggestions.includes(t.name.toLowerCase()) ||
      t.name.toLowerCase().includes(query.toLowerCase()) ||
      t.specialAbility.toLowerCase().includes(query.toLowerCase())
  );

  const filteredEnemies = ENEMY_CODEX.filter(
    (e) =>
      !query.trim() ||
      suggestions.includes(e.name.toLowerCase()) ||
      e.name.toLowerCase().includes(query.toLowerCase()) ||
      e.ability.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Tower &amp; Enemy Armory</h1>
          <p className="text-sm text-slate-400">
            Powered by our custom <strong className="text-cyan-300">Trie</strong> prefix autocomplete &amp;{' '}
            <strong className="text-emerald-300">HashTable</strong> O(1) lookup.
          </p>
        </div>

        <search className="w-full sm:w-80">
          <label htmlFor="codex-search" className="block text-xs font-medium text-slate-300 mb-1">
            Trie Prefix Search (e.g. &quot;rail&quot;, &quot;pulse&quot;, &quot;kernel&quot;)
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" aria-hidden="true" />
            <input
              id="codex-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search towers or enemies..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#0b1324] border border-cyan-500/30 text-sm text-white"
            />
          </div>
          {query.trim() && (
            <p className="text-[11px] text-cyan-300 mt-1">
              Trie matches: {suggestions.length}
              {exactHashMatch ? ` • HashTable exact hit (${exactHashMatch.kind})` : ''}
            </p>
          )}
        </search>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-cyan-300 flex items-center gap-2">
          <Shield className="w-5 h-5" aria-hidden="true" />
          Defensive Towers (6 Classes)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTowers.map((t) => (
            <article
              key={t.type}
              className="rounded-xl border border-slate-800 bg-[#0b1324] p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-4 h-4 rounded-full inline-block"
                    style={{ backgroundColor: t.color }}
                    aria-hidden="true"
                  />
                  <h3 className="font-bold text-white">{t.name}</h3>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  {t.cost} Coins
                </span>
              </div>
              <p className="text-xs text-slate-400">{t.description}</p>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded bg-slate-900/80 p-2">
                  <p className="text-slate-400">Damage</p>
                  <p className="font-bold text-white">{t.damage}</p>
                </div>
                <div className="rounded bg-slate-900/80 p-2">
                  <p className="text-slate-400">Speed</p>
                  <p className="font-bold text-cyan-300">{t.attackSpeed}/s</p>
                </div>
                <div className="rounded bg-slate-900/80 p-2">
                  <p className="text-slate-400">Range</p>
                  <p className="font-bold text-emerald-300">{t.range}px</p>
                </div>
              </div>
              <p className="text-[11px] font-medium text-purple-300 bg-purple-500/10 border border-purple-500/20 rounded-lg px-2.5 py-1.5">
                {t.specialAbility}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-rose-300 flex items-center gap-2">
          <Skull className="w-5 h-5" aria-hidden="true" />
          Hostile Units (6 Classes)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEnemies.map((e) => (
            <article
              key={e.type}
              className="rounded-xl border border-slate-800 bg-[#0b1324] p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white">{e.name}</h3>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300">
                  +{e.reward}g bounty
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded bg-slate-900/80 p-2">
                  <p className="text-slate-400">Base HP</p>
                  <p className="font-bold text-rose-300">{e.hp}</p>
                </div>
                <div className="rounded bg-slate-900/80 p-2">
                  <p className="text-slate-400">Speed</p>
                  <p className="font-bold text-amber-300">{e.speed}</p>
                </div>
                <div className="rounded bg-slate-900/80 p-2">
                  <p className="text-slate-400">Armor</p>
                  <p className="font-bold text-slate-200">{e.armor}</p>
                </div>
              </div>
              <p className="text-xs text-slate-400">{e.ability}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};

