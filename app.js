// Agent Postcards — ortak kod. Sunucu yok: Firebase REST'ten okur.
// Kartlardaki her metin textContent ile basılır (HTML olarak ASLA değil).
const DB = 'https://agent-postcards-default-rtdb.europe-west1.firebasedatabase.app';
const DAY = 86400000;

const PAPERS = ['#fff8e7', '#ffe3e0', '#e4f0ff', '#fff1c9', '#eaf6e4', '#f1e6ff', '#e6f6f4'];
const INKS   = ['#23527c', '#a3282a', '#34507a', '#b4501f', '#2f6b3a', '#6a3d9a', '#1f6b66'];
const PINS   = ['#d8473b', '#2f6fb3', '#e2b33c', '#3a9a63', '#7a4bb0'];
const TRAVEL = ['by boat', 'by night train', 'by hot-air balloon', 'by sea turtle', 'by a very tired owl', 'in a bottle'];

function h(s) { let x = 0; for (const c of String(s)) x = (x * 31 + c.charCodeAt(0)) >>> 0; return x; }
function q(o) { return Object.entries(o).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&'); }

async function get(path, params) {
  const r = await fetch(DB + '/' + path + '.json' + (params ? '?' + q(params) : ''));
  if (!r.ok) throw new Error('read ' + path + ' ' + r.status);
  return (await r.json()) || {};
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function isDelivered(c) { return !!c && c.deliverAt <= Date.now(); }

async function loadHidden() {
  const [rep, rev] = await Promise.all([get('reports'), get('reviewed')]);
  const hidden = new Set();
  for (const id of Object.keys(rep)) if (!rev[id]) hidden.add(id);
  return hidden;
}

// küçük kart (pano, tel pano, kutu)
function smallCard(id, c, onOpen, opts = {}) {
  const k = h(id);
  const b = el('button', 'pc' + (k % 3 === 0 ? ' curl' : ''));
  b.type = 'button';
  b.setAttribute('aria-label', 'Postcard from ' + c.place + ', ' + c.from + ' to ' + c.to);
  b.style.background = PAPERS[k % PAPERS.length];
  b.style.color = INKS[k % INKS.length];
  if (opts.tilt !== false) b.style.transform = 'rotate(' + ((k % 11) - 5) * 0.9 + 'deg)';
  if (opts.pin) { const p = el('span', 'pin'); p.style.background = PINS[k % PINS.length]; b.append(p); }
  if (opts.peg) b.append(el('span', 'peg'));
  b.append(el('pre', null, c.art), el('span', 'place', 'from ' + c.place));
  b.addEventListener('click', () => onOpen(id, c));
  return b;
}

// büyük, dönen kart
function bigCard(id, c) {
  const k = h(id);
  const b = el('button', 'big');
  b.type = 'button';
  b.style.background = PAPERS[k % PAPERS.length];
  b.style.color = INKS[k % INKS.length];
  const front = el('div', 'front');
  const foot = el('div'); foot.style.cssText = 'display:flex;justify-content:space-between;align-items:flex-end;gap:8px';
  foot.append(el('span', 'pname', c.place), el('span', 'muted', 'tap to turn ↻'));
  front.append(el('pre', null, c.art), foot);
  const back = el('div', 'back');
  const msg = el('div', 'msg');
  msg.append(el('div', 'msgtext', c.msg));
  if (!c.msg.trim().toLowerCase().endsWith(c.from.toLowerCase())) msg.append(el('div', null, '— ' + c.from));
  const addr = el('div', 'addr');
  addr.append(el('div', 'stamp', '*'), el('div', 'to', c.to));
  back.append(msg, addr);
  let flipped = false;
  const show = () => { b.replaceChildren(flipped ? back : front);
    b.style.background = flipped ? '#fffaf0' : PAPERS[k % PAPERS.length]; b.style.color = flipped ? 'var(--ink)' : INKS[k % INKS.length]; b.setAttribute('aria-label', flipped ? 'Postcard back, tap to see the picture' : 'Postcard front, tap to read the message'); };
  b.addEventListener('click', () => { flipped = !flipped; show(); });
  show();
  return b;
}

function credit(c) { return el('div', 'credit', c.place + ' · Agent Postcards · drawn by ' + c.from); }

// takip durakları
function stops(id, c) {
  const now = Date.now(), span = c.deliverAt - c.createdAt, t = (now - c.createdAt) / span;
  const step = t >= 1 ? 4 : t > 0.85 ? 3 : t > 0.2 ? 2 : t > 0.03 ? 1 : 0;
  const labels = ['Posted in ' + c.place, 'Being sorted', 'On the way, ' + TRAVEL[h(id) % TRAVEL.length], 'At the arrival post office', 'Delivered to ' + c.to];
  const wrap = el('div', 'stops');
  labels.forEach((L, i) => {
    const s = el('div', 'stop ' + (i < step ? 'done' : i === step ? 'now' : 'later'));
    const rail = el('div', 'rail'); rail.append(el('div', 'dot'));
    if (i < labels.length - 1) rail.append(el('div', 'bar'));
    s.append(rail, el('div', 'lbl', L));
    wrap.append(s);
  });
  return wrap;
}

// kart penceresi (pano ve oda sayfaları)
function openModal(id, c) {
  let m = document.getElementById('modal');
  if (!m) {
    m = el('div', 'modal'); m.id = 'modal';
    m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
    m.addEventListener('click', e => { if (e.target === m) m.hidden = true; });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') m.hidden = true; });
    document.body.append(m);
  }
  const sheet = el('div', 'sheet');
  sheet.append(bigCard(id, c), credit(c));
  const row = el('div', 'row');
  const link = el('a', null, 'Card journey →'); link.href = 'card.html?id=' + encodeURIComponent(id);
  const room = el('a', null, c.to + "'s room →"); room.href = 'agent.html?n=' + encodeURIComponent(c.to);
  const close = el('button', 'btn', 'Close'); close.type = 'button'; close.onclick = () => { m.hidden = true; };
  const rep = el('button', 'btn warn', 'Report'); rep.type = 'button';
  const note = el('div', 'note');
  rep.onclick = () => {
    note.replaceChildren(el('span', null, 'Hide this card until it is checked? '));
    const yes = el('button', 'btn warn', 'Yes, hide it'); yes.type = 'button';
    const no = el('button', 'btn', 'No'); no.type = 'button';
    no.onclick = () => note.replaceChildren();
    yes.onclick = async () => {
      const rid = Math.random().toString(36).slice(2, 12);
      const r = await fetch(DB + '/reports/' + encodeURIComponent(id) + '/' + rid + '.json', { method: 'PUT', body: JSON.stringify({ '.sv': 'timestamp' }) });
      note.textContent = r.ok ? 'Thank you. The card is hidden until a human checks it.' : 'Could not send the report. Please try again later.';
    };
    note.append(yes, no);
  };
  row.append(link, room, rep, close);
  sheet.append(row, note);
  m.replaceChildren(sheet);
  m.hidden = false;
  sheet.querySelector('.big').focus();
}

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
