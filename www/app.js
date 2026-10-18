'use strict';

/* ---------- Utilidades ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const r0 = n => Math.round(n || 0);
const r1 = n => Math.round((n || 0) * 10) / 10;
const num = v => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : 0; };
// Plugins nativos de Capacitor (null cuando se abre en el navegador)
const Native = window.Capacitor?.isNativePlatform?.() ? window.Capacitor.Plugins : null;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const dateKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const keyToDate = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (k, n) => { const d = keyToDate(k); d.setDate(d.getDate() + n); return dateKey(d); };
const todayKey = () => dateKey(new Date());
function dayLabel(k) {
  if (k === todayKey()) return 'Hoy';
  if (k === addDays(todayKey(), -1)) return 'Ayer';
  if (k === addDays(todayKey(), 1)) return 'Mañana';
  return keyToDate(k).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
}

const MEALS = [
  { id: 'desayuno', name: 'Desayuno' },
  { id: 'comida', name: 'Comida' },
  { id: 'cena', name: 'Cena' },
  { id: 'snacks', name: 'Snacks' },
];
function defaultMeal() {
  const h = new Date().getHours();
  return h < 11 ? 'desayuno' : h < 17 ? 'comida' : h < 23 ? 'cena' : 'snacks';
}

/* ---------- Datos (localStorage) ---------- */
const STORE_KEY = 'kcal-count:v1';

// Valores por 100 g (aproximados, tablas BEDCA/USDA)
const SEED_FOODS = [
  ['Pechuga de pollo', 120, 22.5, 0, 2.6, null],
  ['Arroz blanco cocido', 130, 2.7, 28.2, 0.3, null],
  ['Huevo', 143, 12.6, 0.7, 9.5, [60, 'huevo']],
  ['Copos de avena', 379, 13.2, 67.7, 6.5, [40, 'ración']],
  ['Plátano', 89, 1.1, 22.8, 0.3, [120, 'unidad']],
  ['Manzana', 52, 0.3, 13.8, 0.2, [180, 'unidad']],
  ['Aceite de oliva', 884, 0, 0, 100, [10, 'cucharada']],
  ['Leche semidesnatada', 46, 3.3, 4.8, 1.6, [250, 'vaso']],
  ['Yogur griego natural', 97, 9, 4, 5, [125, 'unidad']],
  ['Queso fresco batido 0%', 46, 8, 3.5, 0.1, [250, 'tarrina']],
  ['Pan integral', 247, 13, 41, 3.4, [30, 'rebanada']],
  ['Atún al natural (escurrido)', 116, 25.5, 0, 0.8, [52, 'lata']],
  ['Lentejas cocidas', 116, 9, 20, 0.4, null],
  ['Patata cocida', 87, 1.9, 20, 0.1, null],
  ['Pasta cocida', 158, 5.8, 30.9, 0.9, null],
  ['Salmón', 208, 20, 0, 13, null],
  ['Ternera magra', 137, 21, 0, 5.5, null],
  ['Almendras', 579, 21, 22, 50, [30, 'puñado']],
  ['Aguacate', 160, 2, 8.5, 14.7, [100, 'medio']],
  ['Brócoli', 34, 2.8, 6.6, 0.4, null],
  ['Tomate', 18, 0.9, 3.9, 0.2, [120, 'unidad']],
  ['Proteína whey (polvo)', 380, 78, 7, 5, [30, 'cacito']],
].map(([name, kcal, p, c, f, s]) => ({
  id: 'seed-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  name, brand: '', kcal, p, c, f,
  serving: s ? s[0] : null, servingName: s ? s[1] : '',
  source: 'base',
}));

const DEFAULT_STATE = {
  goals: { kcal: 2000, p: 150, c: 200, f: 67 },
  profile: { sex: 'h', age: 30, weight: 75, height: 175, activity: 1.55, objective: 0, protPerKg: 2 },
  foods: SEED_FOODS,
  log: {},       // { 'YYYY-MM-DD': [entry] }
  recent: {},    // { foodId: timestamp }
  reminder: { on: false, time: '21:00' },
};

let state;
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    state = raw ? { ...structuredClone(DEFAULT_STATE), ...JSON.parse(raw) } : structuredClone(DEFAULT_STATE);
  } catch {
    state = structuredClone(DEFAULT_STATE);
  }
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
  catch { toast('No se pudo guardar (almacenamiento lleno)'); }
}

/* ---------- Cálculos ---------- */
function macrosFor(food, grams) {
  const k = grams / 100;
  return { kcal: food.kcal * k, p: food.p * k, c: food.c * k, f: food.f * k };
}
function sum(entries) {
  return entries.reduce((a, e) => ({ kcal: a.kcal + e.kcal, p: a.p + e.p, c: a.c + e.c, f: a.f + e.f }),
    { kcal: 0, p: 0, c: 0, f: 0 });
}
const dayEntries = k => state.log[k] || [];

function macroLine(m) {
  return `<span class="macros"><b class="p">P</b> ${r1(m.p)} · <b class="c">C</b> ${r1(m.c)} · <b class="f">G</b> ${r1(m.f)}</span>`;
}

/* ---------- UI general ---------- */
let currentTab = 'today';
let currentDay = todayKey();

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.hidden = true), 2200);
}

let sheetCleanup = null;
function openSheet(html, onMount) {
  closeSheet();
  const sh = $('#sheet');
  sh.innerHTML = '<div class="grab"></div>' + html;
  sh.hidden = false;
  $('#overlay').hidden = false;
  sh.scrollTop = 0;
  sheetCleanup = onMount ? onMount(sh) : null;
}
function closeSheet() {
  if (typeof sheetCleanup === 'function') sheetCleanup();
  sheetCleanup = null;
  $('#sheet').hidden = true;
  $('#overlay').hidden = true;
  $('#sheet').innerHTML = '';
}

function render() {
  $$('.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.tab === currentTab));
  ({ today: renderToday, foods: renderFoods, history: renderHistory, settings: renderSettings })[currentTab]();
}

/* ---------- Hoy ---------- */
function ring(value, goal) {
  const R = 54, C = 2 * Math.PI * R;
  const pct = goal > 0 ? Math.min(value / goal, 1) : 0;
  const over = value > goal;
  return `
    <div class="ring ${over ? 'over' : ''}">
      <svg viewBox="0 0 132 132">
        <circle cx="66" cy="66" r="${R}" fill="none" stroke="var(--track)" stroke-width="12"/>
        <circle cx="66" cy="66" r="${R}" fill="none" stroke="${over ? 'var(--danger)' : 'var(--kcal)'}" stroke-width="12"
          stroke-linecap="round" stroke-dasharray="${C * pct} ${C}"/>
      </svg>
      <div class="center">
        <span class="big">${r0(Math.abs(goal - value))}</span>
        <span class="small muted">${over ? 'kcal de más' : 'kcal restantes'}</span>
      </div>
    </div>`;
}
function bar(label, value, goal, color) {
  const pct = goal > 0 ? Math.min(value / goal * 100, 100) : 0;
  return `
    <div class="bar">
      <div class="lbl"><span>${label}</span><span class="muted">${r0(value)} / ${r0(goal)} g</span></div>
      <div class="track"><div class="fill" style="width:${pct}%;background:${value > goal * 1.05 ? 'var(--danger)' : color}"></div></div>
    </div>`;
}

function renderToday() {
  const entries = dayEntries(currentDay);
  const t = sum(entries), g = state.goals;
  const meals = MEALS.map(m => {
    const list = entries.filter(e => e.meal === m.id);
    const mt = sum(list);
    return `
      <div class="card">
        <div class="meal-head">
          <div><h2>${m.name}</h2><span class="small muted">${r0(mt.kcal)} kcal</span></div>
          <button class="btn ghost" data-add="${m.id}">＋ Añadir</button>
        </div>
        ${list.map(e => `
          <div class="entry" data-entry="${e.id}">
            <div class="grow">
              <div class="ellipsis">${esc(e.name)}</div>
              <div class="small muted">${r0(e.grams)} g · ${macroLine(e)}</div>
            </div>
            <div class="kc">${r0(e.kcal)}</div>
          </div>`).join('')}
      </div>`;
  }).join('');

  $('#view').innerHTML = `
    <div class="datenav">
      <button class="iconbtn" id="prevDay" aria-label="Día anterior">‹</button>
      <h1 id="dayTitle">${esc(dayLabel(currentDay))}</h1>
      <button class="iconbtn" id="nextDay" aria-label="Día siguiente">›</button>
    </div>
    <div class="card summary">
      ${ring(t.kcal, g.kcal)}
      <div class="bars">
        <div class="small muted">${r0(t.kcal)} de ${r0(g.kcal)} kcal</div>
        ${bar('Proteína', t.p, g.p, 'var(--prot)')}
        ${bar('Carbohidratos', t.c, g.c, 'var(--carb)')}
        ${bar('Grasa', t.f, g.f, 'var(--fat)')}
      </div>
    </div>
    ${meals}
    ${entries.length === 0 && dayEntries(addDays(currentDay, -1)).length
      ? `<button class="btn block" id="copyYesterday">Copiar comidas del día anterior</button>` : ''}
  `;

  $('#prevDay').onclick = () => { currentDay = addDays(currentDay, -1); render(); };
  $('#nextDay').onclick = () => { currentDay = addDays(currentDay, 1); render(); };
  $('#dayTitle').onclick = () => { currentDay = todayKey(); render(); };
  $$('[data-add]').forEach(b => b.onclick = () => openAddFood(b.dataset.add));
  $$('[data-entry]').forEach(el => el.onclick = () => {
    const e = dayEntries(currentDay).find(x => x.id === el.dataset.entry);
    if (e) openQuantity(e.food, e.meal, e);
  });
  const cy = $('#copyYesterday');
  if (cy) cy.onclick = () => {
    state.log[currentDay] = dayEntries(addDays(currentDay, -1)).map(e => ({ ...e, id: uid() }));
    save(); render(); toast('Comidas copiadas');
  };
}

/* ---------- Añadir alimento ---------- */
function searchLocal(q) {
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const terms = norm(q).split(/\s+/).filter(Boolean);
  return state.foods
    .filter(f => terms.every(t => norm(f.name + ' ' + (f.brand || '')).includes(t)))
    .sort((a, b) => (state.recent[b.id] || 0) - (state.recent[a.id] || 0) || a.name.localeCompare(b.name));
}

function foodItem(f, extra = '') {
  return `
    <div class="item" data-food="${esc(f.id)}">
      <div class="grow">
        <div class="ellipsis">${esc(f.name)} ${f.brand ? `<span class="muted small">· ${esc(f.brand)}</span>` : ''}</div>
        <div class="small muted">${r0(f.kcal)} kcal/100 g · ${macroLine(f)}</div>
      </div>
      ${extra}
    </div>`;
}

function openAddFood(meal) {
  openSheet(`
    <div class="row between"><h2>Añadir a ${esc(MEALS.find(m => m.id === meal).name)}</h2>
      <button class="btn ghost" id="close">Cerrar</button></div>
    <div class="row" style="margin-top:10px">
      <input id="q" class="grow" type="search" placeholder="Buscar alimento…" autocomplete="off">
      <button class="iconbtn" id="scan" title="Escanear código de barras">▥</button>
    </div>
    <div class="list" id="results"></div>
    <div id="online"></div>
    <button class="btn block" id="offBtn" hidden></button>
    <button class="btn block" id="newFood">＋ Crear alimento nuevo</button>
  `, sh => {
    let onlineResults = [];
    const q = $('#q', sh);
    const draw = () => {
      const text = q.value.trim();
      const local = searchLocal(text).slice(0, text ? 40 : 15);
      $('#results', sh).innerHTML = (!text ? '<h3>Recientes y frecuentes</h3>' : '') +
        (local.length ? local.map(f => foodItem(f)).join('') : '<div class="empty">Sin resultados en tus alimentos</div>');
      const ob = $('#offBtn', sh);
      ob.hidden = text.length < 2;
      ob.textContent = `🔎 Buscar «${text}» en Open Food Facts`;
      bind();
    };
    const bind = () => $$('[data-food]', sh).forEach(el => el.onclick = () => {
      const f = state.foods.find(x => x.id === el.dataset.food) || onlineResults.find(x => x.id === el.dataset.food);
      if (f) openQuantity(f, meal);
    });
    q.oninput = () => { $('#online', sh).innerHTML = ''; draw(); };
    q.onkeydown = e => { if (e.key === 'Enter') $('#offBtn', sh).click(); };
    $('#close', sh).onclick = closeSheet;
    $('#newFood', sh).onclick = () => openFoodEditor({ name: q.value.trim() }, f => openQuantity(f, meal));
    $('#scan', sh).onclick = () => openScanner(meal);
    $('#offBtn', sh).onclick = async () => {
      const text = q.value.trim();
      if (text.length < 2) return;
      const box = $('#online', sh);
      box.innerHTML = '<div class="empty">Buscando…</div>';
      try {
        onlineResults = await searchOFF(text);
        box.innerHTML = '<h3>Open Food Facts</h3><div class="list">' +
          (onlineResults.length ? onlineResults.map(f => foodItem(f, '<span class="badge">OFF</span>')).join('')
            : '<div class="empty">Nada encontrado</div>') + '</div>';
        bind();
      } catch {
        box.innerHTML = '<div class="empty">No se pudo conectar. ¿Sin internet?</div>';
      }
    };
    draw();
  });
}

/* ---------- Cantidad ---------- */
function openQuantity(food, meal, entry = null) {
  const hasServing = food.serving > 0;
  let unit = entry ? 'g' : hasServing ? 'serv' : 'g';
  let amount = entry ? entry.grams : hasServing ? 1 : 100;
  let selMeal = entry ? entry.meal : meal;

  openSheet(`
    <div class="row between"><h2 class="ellipsis grow">${esc(food.name)}</h2>
      <button class="btn ghost" id="close">Cerrar</button></div>
    ${food.brand ? `<div class="small muted">${esc(food.brand)}</div>` : ''}
    <div class="small muted">${r0(food.kcal)} kcal por 100 g</div>
    <div class="row" style="margin-top:12px">
      <input id="amt" class="grow" type="number" inputmode="decimal" min="0" step="any" value="${amount}">
      <select id="unit" style="width:auto">
        <option value="g">gramos</option>
        ${hasServing ? `<option value="serv">${esc(food.servingName || 'ración')} (${r0(food.serving)} g)</option>` : ''}
      </select>
    </div>
    <div class="chips" id="quick"></div>
    <div class="preview" id="prev"></div>
    <label>Comida</label>
    <div class="chips" id="meals">
      ${MEALS.map(m => `<button class="chip" data-meal="${m.id}">${m.name}</button>`).join('')}
    </div>
    <button class="btn primary block" id="ok">${entry ? 'Guardar cambios' : 'Añadir'}</button>
    ${entry ? '<button class="btn danger block" id="del">Eliminar del diario</button>' : ''}
  `, sh => {
    const amt = $('#amt', sh), unitSel = $('#unit', sh);
    unitSel.value = unit;
    const grams = () => num(amt.value) * (unitSel.value === 'serv' ? food.serving : 1);
    const quick = () => {
      const opts = unitSel.value === 'serv' ? [0.5, 1, 1.5, 2, 3] : [25, 50, 100, 150, 200];
      $('#quick', sh).innerHTML = opts.map(v => `<button class="chip" data-q="${v}">${v}${unitSel.value === 'g' ? ' g' : '×'}</button>`).join('');
      $$('[data-q]', sh).forEach(b => b.onclick = () => { amt.value = b.dataset.q; update(); });
    };
    const update = () => {
      const m = macrosFor(food, grams());
      $('#prev', sh).innerHTML = `
        <div><b>${r0(m.kcal)}</b><span class="small muted">kcal</span></div>
        <div><b class="p">${r1(m.p)}</b><span class="small muted">prot</span></div>
        <div><b class="c">${r1(m.c)}</b><span class="small muted">carb</span></div>
        <div><b class="f">${r1(m.f)}</b><span class="small muted">grasa</span></div>`;
      $('#ok', sh).disabled = !(grams() > 0);
    };
    const drawMeals = () => $$('[data-meal]', sh).forEach(b => b.classList.toggle('on', b.dataset.meal === selMeal));
    $$('[data-meal]', sh).forEach(b => b.onclick = () => { selMeal = b.dataset.meal; drawMeals(); });
    amt.oninput = update;
    unitSel.onchange = () => {
      // Convertir la cantidad actual a la nueva unidad
      const curG = num(amt.value) * (unit === 'serv' ? food.serving : 1);
      unit = unitSel.value;
      amt.value = unit === 'serv' ? r1(curG / food.serving) : r0(curG);
      quick(); update();
    };
    $('#close', sh).onclick = closeSheet;
    $('#ok', sh).onclick = () => {
      const g = grams();
      if (!(g > 0)) return;
      // Guardar alimentos online en la base local para reutilizarlos
      if (!state.foods.some(f => f.id === food.id)) state.foods.push({ ...food });
      state.recent[food.id] = Date.now();
      const snapshot = { id: food.id, name: food.name, brand: food.brand, kcal: food.kcal, p: food.p, c: food.c, f: food.f, serving: food.serving, servingName: food.servingName };
      const data = { name: food.name, grams: g, meal: selMeal, food: snapshot, ...macrosFor(food, g) };
      const list = state.log[currentDay] = dayEntries(currentDay);
      if (entry) Object.assign(list.find(e => e.id === entry.id), data);
      else list.push({ id: uid(), ...data });
      save(); closeSheet(); render();
      toast(entry ? 'Actualizado' : `Añadido: ${r0(data.kcal)} kcal`);
    };
    const del = $('#del', sh);
    if (del) del.onclick = () => {
      state.log[currentDay] = dayEntries(currentDay).filter(e => e.id !== entry.id);
      if (!state.log[currentDay].length) delete state.log[currentDay];
      save(); closeSheet(); render(); toast('Eliminado');
    };
    drawMeals(); quick(); update();
    setTimeout(() => amt.select(), 50);
  });
}

/* ---------- Editor de alimentos ---------- */
function openFoodEditor(food = {}, onSaved) {
  const isNew = !food.id || !state.foods.some(f => f.id === food.id);
  const v = k => food[k] ?? '';
  openSheet(`
    <div class="row between"><h2>${isNew ? 'Nuevo alimento' : 'Editar alimento'}</h2>
      <button class="btn ghost" id="close">Cerrar</button></div>
    <label>Nombre</label><input id="name" value="${esc(v('name'))}" placeholder="p. ej. Tortilla de patatas">
    <label>Marca (opcional)</label><input id="brand" value="${esc(v('brand'))}">
    <h3>Valores por 100 g</h3>
    <div class="grid4">
      <div><label>kcal</label><input id="kcal" type="number" inputmode="decimal" step="any" value="${v('kcal')}"></div>
      <div><label class="p">Prot</label><input id="p" type="number" inputmode="decimal" step="any" value="${v('p')}"></div>
      <div><label class="c">Carb</label><input id="c" type="number" inputmode="decimal" step="any" value="${v('c')}"></div>
      <div><label class="f">Grasa</label><input id="f" type="number" inputmode="decimal" step="any" value="${v('f')}"></div>
    </div>
    <div class="small muted" id="kcalHint" style="margin-top:6px"></div>
    <h3>Ración (opcional)</h3>
    <div class="grid2">
      <div><label>Gramos por ración</label><input id="serving" type="number" inputmode="decimal" step="any" value="${v('serving')}"></div>
      <div><label>Nombre de la ración</label><input id="servingName" value="${esc(v('servingName'))}" placeholder="unidad, vaso…"></div>
    </div>
    <label>Código de barras (opcional)</label><input id="barcode" inputmode="numeric" value="${esc(v('barcode'))}">
    <button class="btn primary block" id="ok">Guardar</button>
    ${!isNew ? '<button class="btn danger block" id="del">Eliminar alimento</button>' : ''}
  `, sh => {
    const fields = ['p', 'c', 'f'].map(k => $('#' + k, sh));
    const hint = () => {
      const est = 4 * num($('#p', sh).value) + 4 * num($('#c', sh).value) + 9 * num($('#f', sh).value);
      $('#kcalHint', sh).textContent = est > 0 ? `Según macros: ≈ ${r0(est)} kcal (si dejas kcal vacío se usará este valor)` : '';
    };
    fields.forEach(i => i.oninput = hint); hint();
    $('#close', sh).onclick = closeSheet;
    $('#ok', sh).onclick = () => {
      const name = $('#name', sh).value.trim();
      if (!name) return toast('Ponle un nombre');
      const p = num($('#p', sh).value), c = num($('#c', sh).value), f = num($('#f', sh).value);
      const kcalIn = $('#kcal', sh).value.trim();
      const out = {
        id: food.id || 'u-' + uid(),
        name, brand: $('#brand', sh).value.trim(),
        kcal: kcalIn ? num(kcalIn) : r0(4 * p + 4 * c + 9 * f), p, c, f,
        serving: num($('#serving', sh).value) || null,
        servingName: $('#servingName', sh).value.trim(),
        barcode: $('#barcode', sh).value.trim() || undefined,
        source: food.source === 'off' ? 'off' : 'user',
      };
      const i = state.foods.findIndex(x => x.id === out.id);
      if (i >= 0) state.foods[i] = out; else state.foods.push(out);
      save(); toast('Alimento guardado');
      if (onSaved) onSaved(out); else { closeSheet(); render(); }
    };
    const del = $('#del', sh);
    if (del) del.onclick = () => {
      if (!confirm(`¿Eliminar «${food.name}»? Las entradas ya registradas se mantienen.`)) return;
      state.foods = state.foods.filter(x => x.id !== food.id);
      save(); closeSheet(); render();
    };
  });
}

/* ---------- Open Food Facts ---------- */
const OFF_FIELDS = 'code,product_name,product_name_es,brands,nutriments,serving_quantity';
function fromOFF(p) {
  const n = p.nutriments || {};
  let kcal = n['energy-kcal_100g'];
  if (kcal == null && n['energy_100g'] != null) kcal = n['energy_100g'] / 4.184;
  if (kcal == null) return null;
  return {
    id: 'off-' + p.code, barcode: p.code,
    name: (p.product_name_es || p.product_name || 'Sin nombre').trim(),
    brand: (p.brands || '').split(',')[0].trim(),
    kcal: r0(kcal), p: r1(n.proteins_100g), c: r1(n.carbohydrates_100g), f: r1(n.fat_100g),
    serving: num(p.serving_quantity) || null, servingName: num(p.serving_quantity) ? 'ración' : '',
    source: 'off',
  };
}
async function searchOFF(q) {
  const url = `https://es.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=25&fields=${OFF_FIELDS}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(res.status);
  const data = await res.json();
  return (data.products || []).map(fromOFF).filter(Boolean);
}
async function lookupBarcode(code) {
  const local = state.foods.find(f => f.barcode === code);
  if (local) return local;
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${OFF_FIELDS}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.status === 1 && data.product ? fromOFF({ code, ...data.product }) : null;
}

/* ---------- Escáner ---------- */
async function nativeScan(meal) {
  const BS = Native.BarcodeScanner;
  try {
    const { available } = await BS.isGoogleBarcodeScannerModuleAvailable();
    if (!available) {
      await BS.installGoogleBarcodeScannerModule();
      toast('Instalando el escáner de Google, inténtalo en unos segundos');
      return;
    }
    const { barcodes } = await BS.scan({ formats: ['EAN_13', 'EAN_8', 'UPC_A', 'UPC_E'] });
    const code = barcodes[0]?.rawValue;
    if (code) handleBarcode(code, meal);
  } catch (e) {
    if (!/cancel/i.test(String(e?.message))) openScanner(meal, true);
  }
}

async function handleBarcode(code, meal) {
  toast('Buscando ' + code + '…');
  try {
    const f = await lookupBarcode(code);
    if (f) openQuantity(f, meal);
    else { toast('Producto no encontrado, créalo'); openFoodEditor({ barcode: code }, nf => openQuantity(nf, meal)); }
  } catch {
    toast('Error de conexión');
  }
}

// manualOnly: formulario para escribir el código (si no hay escáner disponible)
function openScanner(meal, manualOnly = false) {
  if (Native && !manualOnly) return nativeScan(meal);
  const supported = !manualOnly && 'BarcodeDetector' in window && navigator.mediaDevices?.getUserMedia;
  openSheet(`
    <div class="row between"><h2>Escanear código</h2>
      <button class="btn ghost" id="close">Cerrar</button></div>
    ${supported ? '<video id="video" playsinline muted></video><div class="small muted" id="scanMsg" style="margin-top:6px">Apunta al código de barras…</div>'
      : '<div class="small muted">No se puede escanear con la cámara. Escribe el código manualmente:</div>'}
    <label>Código</label>
    <div class="row"><input id="code" class="grow" inputmode="numeric" placeholder="8410000000000">
      <button class="btn primary" id="go">Buscar</button></div>
  `, sh => {
    let stream = null, timer = null, done = false;
    const stop = () => { done = true; clearInterval(timer); stream?.getTracks().forEach(t => t.stop()); };
    const handle = code => { stop(); handleBarcode(code, meal); };
    $('#close', sh).onclick = closeSheet;
    $('#go', sh).onclick = () => { const c = $('#code', sh).value.trim(); if (c) handle(c); };
    if (supported) {
      (async () => {
        try {
          const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
          if (done) return stop();
          const video = $('#video', sh);
          video.srcObject = stream;
          await video.play();
          timer = setInterval(async () => {
            if (done || video.readyState < 2) return;
            try {
              const codes = await detector.detect(video);
              if (codes.length && !done) handle(codes[0].rawValue);
            } catch { /* frame no válido */ }
          }, 250);
        } catch {
          const m = $('#scanMsg', sh);
          if (m) m.textContent = 'No se pudo acceder a la cámara. Escribe el código manualmente.';
        }
      })();
    }
    return stop;
  });
}

/* ---------- Alimentos ---------- */
function renderFoods() {
  $('#view').innerHTML = `
    <h1>Mis alimentos</h1>
    <div class="row">
      <input id="fq" class="grow" type="search" placeholder="Buscar…">
      <button class="btn primary" id="add">＋ Nuevo</button>
    </div>
    <div class="card list" id="flist" style="margin-top:12px"></div>
  `;
  const draw = () => {
    const list = searchLocal($('#fq').value.trim()).sort((a, b) => a.name.localeCompare(b.name));
    $('#flist').innerHTML = list.length
      ? list.map(f => foodItem(f, f.source === 'off' ? '<span class="badge">OFF</span>' : f.source === 'user' ? '<span class="badge">mío</span>' : '')).join('')
      : '<div class="empty">No hay alimentos</div>';
    $$('[data-food]').forEach(el => el.onclick = () => openFoodEditor(state.foods.find(f => f.id === el.dataset.food)));
  };
  $('#fq').oninput = draw;
  $('#add').onclick = () => openFoodEditor();
  draw();
}

/* ---------- Historial ---------- */
function renderHistory() {
  const days = Object.keys(state.log).filter(k => state.log[k].length).sort().reverse();
  const g = state.goals;
  const last7 = [];
  for (let i = 0; i < 7; i++) {
    const k = addDays(todayKey(), -i);
    if (dayEntries(k).length) last7.push(sum(dayEntries(k)));
  }
  const avg = last7.length ? Object.fromEntries(['kcal', 'p', 'c', 'f'].map(m => [m, last7.reduce((a, d) => a + d[m], 0) / last7.length])) : null;

  $('#view').innerHTML = `
    <h1>Historial</h1>
    <div class="card">
      <h2>Media últimos 7 días</h2>
      ${avg ? `
        <div class="small muted" style="margin-top:4px">${last7.length} día(s) con registros</div>
        <div class="preview">
          <div><b>${r0(avg.kcal)}</b><span class="small muted">kcal</span></div>
          <div><b class="p">${r0(avg.p)}</b><span class="small muted">prot</span></div>
          <div><b class="c">${r0(avg.c)}</b><span class="small muted">carb</span></div>
          <div><b class="f">${r0(avg.f)}</b><span class="small muted">grasa</span></div>
        </div>` : '<div class="empty">Aún no hay datos</div>'}
    </div>
    <div class="card">
      ${days.length ? days.slice(0, 60).map(k => {
        const t = sum(dayEntries(k));
        return `
          <div class="hday" data-day="${k}">
            <div class="row between"><span>${esc(dayLabel(k))}</span>
              <span><b>${r0(t.kcal)}</b> <span class="muted small">/ ${r0(g.kcal)} kcal</span></span></div>
            <div class="bar" style="margin:4px 0"><div class="track"><div class="fill" style="width:${Math.min(t.kcal / g.kcal * 100, 100)}%;background:${t.kcal > g.kcal ? 'var(--danger)' : 'var(--kcal)'}"></div></div></div>
            ${macroLine(t)}
          </div>`;
      }).join('') : '<div class="empty">Sin registros todavía</div>'}
    </div>
  `;
  $$('[data-day]').forEach(el => el.onclick = () => { currentDay = el.dataset.day; currentTab = 'today'; render(); });
}

/* ---------- Ajustes ---------- */
function calcGoals(pr) {
  const bmr = 10 * pr.weight + 6.25 * pr.height - 5 * pr.age + (pr.sex === 'h' ? 5 : -161);
  const kcal = Math.round(bmr * pr.activity * (1 + pr.objective) / 10) * 10;
  const p = Math.round(pr.weight * pr.protPerKg);
  const f = Math.round(kcal * 0.25 / 9);
  const c = Math.max(0, Math.round((kcal - p * 4 - f * 9) / 4));
  return { kcal, p, c, f };
}

function renderSettings() {
  const g = state.goals, pr = state.profile;
  $('#view').innerHTML = `
    <h1>Ajustes</h1>
    <div class="card">
      <h2>Objetivos diarios</h2>
      <div class="grid4">
        <div><label>kcal</label><input id="gk" type="number" inputmode="numeric" value="${g.kcal}"></div>
        <div><label class="p">Prot (g)</label><input id="gp" type="number" inputmode="numeric" value="${g.p}"></div>
        <div><label class="c">Carb (g)</label><input id="gc" type="number" inputmode="numeric" value="${g.c}"></div>
        <div><label class="f">Grasa (g)</label><input id="gf" type="number" inputmode="numeric" value="${g.f}"></div>
      </div>
      <div class="small muted" id="gsum" style="margin-top:6px"></div>
      <button class="btn primary block" id="saveGoals">Guardar objetivos</button>
    </div>

    <div class="card">
      <h2>Calculadora de objetivos</h2>
      <div class="small muted">Fórmula Mifflin-St Jeor · grasa al 25 % · resto en carbohidratos</div>
      <div class="grid2">
        <div><label>Sexo</label><select id="sex"><option value="h">Hombre</option><option value="m">Mujer</option></select></div>
        <div><label>Edad</label><input id="age" type="number" inputmode="numeric" value="${pr.age}"></div>
        <div><label>Peso (kg)</label><input id="weight" type="number" inputmode="decimal" step="any" value="${pr.weight}"></div>
        <div><label>Altura (cm)</label><input id="height" type="number" inputmode="numeric" value="${pr.height}"></div>
      </div>
      <label>Actividad</label>
      <select id="activity">
        <option value="1.2">Sedentaria</option>
        <option value="1.375">Ligera (1-3 días/sem)</option>
        <option value="1.55">Moderada (3-5 días/sem)</option>
        <option value="1.725">Alta (6-7 días/sem)</option>
        <option value="1.9">Muy alta</option>
      </select>
      <div class="grid2">
        <div><label>Objetivo</label>
          <select id="objective">
            <option value="-0.2">Perder grasa (−20 %)</option>
            <option value="-0.1">Perder suave (−10 %)</option>
            <option value="0">Mantener</option>
            <option value="0.1">Ganar músculo (+10 %)</option>
          </select></div>
        <div><label>Proteína (g/kg)</label><input id="ppk" type="number" inputmode="decimal" step="0.1" value="${pr.protPerKg}"></div>
      </div>
      <div class="preview" id="calcPrev"></div>
      <button class="btn block" id="applyCalc">Usar estos objetivos</button>
    </div>

    ${Native ? `
    <div class="card">
      <h2>Recordatorio diario</h2>
      <div class="small muted">Una notificación cada día para que no se te olvide apuntar lo que comes.</div>
      <div class="row" style="margin-top:10px">
        <label class="row grow" style="margin:0;color:var(--text)"><input id="remOn" type="checkbox" style="width:auto"> Activado</label>
        <input id="remTime" type="time" style="width:auto" value="${esc(state.reminder.time)}">
      </div>
    </div>` : ''}

    <div class="card">
      <h2>Datos</h2>
      <div class="small muted">Todo se guarda solo en este dispositivo. Haz copias de seguridad de vez en cuando.</div>
      <button class="btn block" id="export">⬇ Exportar copia (JSON)</button>
      <button class="btn block" id="import">⬆ Importar copia</button>
      <input type="file" id="file" accept="application/json,.json" hidden>
      <button class="btn danger block" id="reset">Borrar todos los datos</button>
    </div>
    <div class="small muted" style="text-align:center">Datos de productos: Open Food Facts (ODbL)</div>
  `;

  const goalInputs = ['gk', 'gp', 'gc', 'gf'].map(id => $('#' + id));
  const gsum = () => {
    const fromMacros = 4 * num($('#gp').value) + 4 * num($('#gc').value) + 9 * num($('#gf').value);
    $('#gsum').textContent = `Los macros suman ${r0(fromMacros)} kcal`;
  };
  goalInputs.forEach(i => i.oninput = gsum); gsum();
  $('#saveGoals').onclick = () => {
    state.goals = { kcal: num($('#gk').value), p: num($('#gp').value), c: num($('#gc').value), f: num($('#gf').value) };
    save(); toast('Objetivos guardados');
  };

  $('#sex').value = pr.sex; $('#activity').value = String(pr.activity); $('#objective').value = String(pr.objective);
  const readProfile = () => ({
    sex: $('#sex').value, age: num($('#age').value), weight: num($('#weight').value), height: num($('#height').value),
    activity: num($('#activity').value), objective: num($('#objective').value), protPerKg: num($('#ppk').value),
  });
  const calcPrev = () => {
    const c = calcGoals(readProfile());
    $('#calcPrev').innerHTML = `
      <div><b>${c.kcal}</b><span class="small muted">kcal</span></div>
      <div><b class="p">${c.p}</b><span class="small muted">prot</span></div>
      <div><b class="c">${c.c}</b><span class="small muted">carb</span></div>
      <div><b class="f">${c.f}</b><span class="small muted">grasa</span></div>`;
  };
  ['sex', 'age', 'weight', 'height', 'activity', 'objective', 'ppk'].forEach(id => $('#' + id).oninput = calcPrev);
  calcPrev();
  $('#applyCalc').onclick = () => {
    state.profile = readProfile();
    state.goals = calcGoals(state.profile);
    save(); render(); toast('Objetivos actualizados');
  };

  const remOn = $('#remOn');
  if (remOn) {
    remOn.checked = state.reminder.on;
    remOn.onchange = $('#remTime').onchange = async () => {
      state.reminder = { on: remOn.checked, time: $('#remTime').value || '21:00' };
      save();
      const ok = await scheduleReminder();
      if (state.reminder.on && !ok) { remOn.checked = state.reminder.on = false; save(); toast('Activa las notificaciones de kcal en los ajustes de Android'); }
      else toast(state.reminder.on ? `Recordatorio a las ${state.reminder.time}` : 'Recordatorio desactivado');
    };
  }

  $('#export').onclick = async () => {
    const json = JSON.stringify(state, null, 2);
    const name = `kcal-count-${todayKey()}.json`;
    if (Native) {
      try {
        const { uri } = await Native.Filesystem.writeFile({ path: name, data: json, directory: 'CACHE', encoding: 'utf8' });
        await Native.Share.share({ title: 'Copia de kcal-count', files: [uri], dialogTitle: 'Guardar copia en…' });
      } catch (e) {
        if (!/cancel/i.test(String(e?.message))) toast('No se pudo exportar');
      }
      return;
    }
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  $('#import').onclick = () => $('#file').click();
  $('#file').onchange = async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!data || typeof data !== 'object' || !data.goals || !Array.isArray(data.foods)) throw new Error();
      if (!confirm('Esto reemplazará tus datos actuales. ¿Continuar?')) return;
      state = { ...structuredClone(DEFAULT_STATE), ...data };
      save(); render(); toast('Copia importada');
    } catch {
      toast('Archivo no válido');
    }
  };
  $('#reset').onclick = () => {
    if (!confirm('¿Borrar TODO (diario, alimentos y objetivos)? No se puede deshacer.')) return;
    state = structuredClone(DEFAULT_STATE);
    save(); render(); toast('Datos borrados');
  };
}

/* ---------- Recordatorio (solo Android) ---------- */
const REMINDER_ID = 1;
async function scheduleReminder() {
  if (!Native) return true;
  const LN = Native.LocalNotifications;
  try {
    await LN.cancel({ notifications: [{ id: REMINDER_ID }] });
    if (!state.reminder.on) return true;
    const perm = await LN.requestPermissions();
    if (perm.display !== 'granted') return false;
    const [hour, minute] = state.reminder.time.split(':').map(Number);
    await LN.schedule({ notifications: [{
      id: REMINDER_ID,
      title: 'kcal',
      body: '¿Has apuntado lo que has comido hoy?',
      schedule: { on: { hour, minute }, allowWhileIdle: true },
    }] });
    return true;
  } catch {
    return false;
  }
}

/* ---------- Arranque ---------- */
load();
$$('.tabbar button').forEach(b => b.onclick = () => { currentTab = b.dataset.tab; closeSheet(); render(); window.scrollTo(0, 0); });
$('#overlay').onclick = closeSheet;
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
// Si la app queda abierta pasada la medianoche, saltar al nuevo día
let lastToday = todayKey();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && todayKey() !== lastToday) {
    if (currentDay === lastToday) currentDay = todayKey();
    lastToday = todayKey();
    render();
  }
});
render();

if (Native) {
  // Botón atrás de Android: cierra la hoja, vuelve a «Hoy» o minimiza la app
  Native.App.addListener('backButton', () => {
    if (!$('#sheet').hidden) closeSheet();
    else if (currentTab !== 'today') { currentTab = 'today'; render(); }
    else Native.App.minimizeApp();
  });
  Native.App.addListener('resume', () => document.dispatchEvent(new Event('visibilitychange')));
}
