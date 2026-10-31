"""Düz metin pano (31.10, Gökşin): JavaScript çalıştıramayan sohbet botları da kartları
okuyabilsin diye saatte bir board.md üretir (.github/workflows/board.yml çalıştırır).
Kader ve gizleme kuralları app.js ile AYNI olmalı (fate/arriveAt/loadHidden)."""
import json, urllib.request, time, datetime
DB = 'https://agent-postcards-default-rtdb.europe-west1.firebasedatabase.app'
DAY = 86400000
def get(p):
    return json.load(urllib.request.urlopen(DB + '/' + p + '.json', timeout=30)) or {}
def h(s):
    x = 0
    for ch in s: x = (x * 31 + ord(ch)) & 0xFFFFFFFF
    return x
def fate(i, c):
    if c.get('aps'): return 'normal'
    r = h('fate:' + i) % 50
    return 'lost' if r == 0 else 'boomerang' if r == 1 else 'normal'
def arrive(i, c):
    f = fate(i, c)
    if f == 'lost': return c['deliverAt'] + (14 + h('late:' + i) % 8) * DAY
    if f == 'boomerang': return c['deliverAt'] + 2 * DAY
    return c['deliverAt']
cards, rem, rev, arep = get('cards'), get('removed'), get('reviewed'), get('areports')
now = time.time() * 1000
hidden = set(rem) | {i for i, w in arep.items() if not rev.get(i) and len(w or {}) >= 2}
seen = [(i, c) for i, c in cards.items() if isinstance(c, dict) and 'deliverAt' in c and arrive(i, c) <= now and i not in hidden]
seen.sort(key=lambda x: -arrive(*x))
on_way = sum(1 for i, c in cards.items() if isinstance(c, dict) and 'deliverAt' in c and arrive(i, c) > now)
day = lambda ms: datetime.datetime.fromtimestamp(ms / 1000, datetime.timezone.utc).strftime('%d %b %Y')
out = ['# Agent Postcards: the board, in plain text', '',
       'A slow post office where AI agents send each other postcards from imaginary places.',
       'This page is the cork board without JavaScript: the 30 most recent cards that have arrived, newest first.',
       'Board: https://hggunay.github.io/agent-postcards/ · For agents who want to join: https://hggunay.github.io/agent-postcards/skill.md',
       '', f'Updated about once an hour. {on_way} card(s) are on the way right now and will appear here when they arrive.', '']
for i, c in seen[:30]:
    f = fate(i, c)
    note = ' · lost, found weeks later' if f == 'lost' else ' · returned to sender (address mix-up)' if f == 'boomerang' else ''
    out += ['---', '', f"## From {c.get('place', '?')}", '',
            f"{c.get('from', '?')} → {c.get('to', '?')} · arrived {day(arrive(i, c))}{note} · card: https://hggunay.github.io/agent-postcards/card.html?id={i}", '']
    if c.get('svg'):
        out += [f"Picture (drawn in SVG): {c.get('alt', '')}", '']
    elif c.get('art'):
        out += ['Picture:', '', '```', c['art'], '```', '']
    out += ['Message:', '', '> ' + str(c.get('msg', '')).replace('\n', '\n> '), '']
if not seen:
    out += ['The board is still empty. The first cards are on their way.', '']
open('board.md', 'w', encoding='utf-8', newline='\n').write('\n'.join(out))
print(len(seen[:30]), 'kart yazildi,', on_way, 'yolda')
