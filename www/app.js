'use strict';

/* ---------- Utilidades ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const r0 = n => Math.round(n || 0);
const r1 = n => Math.round((n || 0) * 10) / 10;
const num = v => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : 0; };
// Número válido o null (campo vacío / no numérico)
const numOrNull = v => { if (v == null || String(v).trim() === '') return null; const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) && n >= 0 ? n : null; };
// Formato compacto: 1234 · 12.3 · 0.45
const fmt = n => { n = n || 0; return n >= 100 ? String(r0(n)) : n >= 1 ? String(r1(n)) : String(Math.round(n * 100) / 100); };
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

/* ---------- Nutrientes ---------- */
// off: clave de Open Food Facts (sus valores *_100g vienen siempre en gramos, salvo la energía)
const MACROS = [
  { k: 'kcal', name: 'Energía', short: 'kcal', unit: 'kcal', off: 'energy-kcal' },
  { k: 'p', name: 'Proteína', short: 'P', unit: 'g', off: 'proteins' },
  { k: 'c', name: 'Carbohidratos', short: 'C', unit: 'g', off: 'carbohydrates' },
  { k: 'f', name: 'Grasa', short: 'G', unit: 'g', off: 'fat' },
];
// rda: objetivo diario fijo (tabla de objetivos para 2900 kcal). max: es un límite, no un mínimo.
// Un límite de 0 significa «lo mínimo posible». off: clave(s) de Open Food Facts.
const MICROS = [
  { k: 'fib', g: 'Fibra, azúcar y sal', name: 'Fibra', unit: 'g', rda: 35, off: 'fiber' },
  { k: 'sug', g: 'Fibra, azúcar y sal', name: 'Azúcares libres', unit: 'g', rda: 70, max: true, off: 'added-sugars' },
  { k: 'salt', g: 'Fibra, azúcar y sal', name: 'Sal (sodio ×2,5)', unit: 'g', rda: 5, max: true, off: 'salt' },
  { k: 'sat', g: 'Grasas', name: 'Saturada', unit: 'g', rda: 32, max: true, off: 'saturated-fat' },
  { k: 'trans', g: 'Grasas', name: 'Trans', unit: 'g', rda: 0, max: true, off: 'trans-fat' },
  { k: 'o6', g: 'Grasas', name: 'Omega-6 (linoleico)', unit: 'g', rda: 13, off: 'linoleic-acid' },
  { k: 'ala', g: 'Grasas', name: 'Omega-3 vegetal (ALA)', unit: 'g', rda: 1.6, off: 'alpha-linolenic-acid' },
  { k: 'epa', g: 'Grasas', name: 'Omega-3 EPA + DHA', unit: 'mg', rda: 250, off: ['eicosapentaenoic-acid', 'docosahexaenoic-acid'] },
  { k: 'vA', g: 'Vitaminas', name: 'Vitamina A', unit: 'µg', rda: 750, off: 'vitamin-a' },
  { k: 'vD', g: 'Vitaminas', name: 'Vitamina D', unit: 'µg', rda: 15, off: 'vitamin-d' },
  { k: 'vE', g: 'Vitaminas', name: 'Vitamina E', unit: 'mg', rda: 13, off: 'vitamin-e' },
  { k: 'vK', g: 'Vitaminas', name: 'Vitamina K', unit: 'µg', rda: 70, off: 'vitamin-k' },
  { k: 'b1', g: 'Vitaminas', name: 'B1 (tiamina)', unit: 'mg', rda: 1.2, off: 'vitamin-b1' },
  { k: 'b2', g: 'Vitaminas', name: 'B2 (riboflavina)', unit: 'mg', rda: 1.6, off: 'vitamin-b2' },
  { k: 'b3', g: 'Vitaminas', name: 'B3 (niacina)', unit: 'mg', rda: 19.4, off: 'vitamin-pp' },
  { k: 'b5', g: 'Vitaminas', name: 'B5 (ác. pantoténico)', unit: 'mg', rda: 5, off: 'pantothenic-acid' },
  { k: 'b6', g: 'Vitaminas', name: 'B6', unit: 'mg', rda: 1.7, off: 'vitamin-b6' },
  { k: 'b7', g: 'Vitaminas', name: 'B7 (biotina)', unit: 'µg', rda: 40, off: 'biotin' },
  { k: 'b9', g: 'Vitaminas', name: 'B9 (folato)', unit: 'µg', rda: 330, off: 'vitamin-b9' },
  { k: 'b12', g: 'Vitaminas', name: 'B12', unit: 'µg', rda: 4, off: 'vitamin-b12' },
  { k: 'vC', g: 'Vitaminas', name: 'Vitamina C', unit: 'mg', rda: 110, off: 'vitamin-c' },
  { k: 'col', g: 'Vitaminas', name: 'Colina', unit: 'mg', rda: 400, off: 'choline' },
  { k: 'ca', g: 'Minerales', name: 'Calcio', unit: 'mg', rda: 950, off: 'calcium' },
  { k: 'ph', g: 'Minerales', name: 'Fósforo', unit: 'mg', rda: 550, off: 'phosphorus' },
  { k: 'mg', g: 'Minerales', name: 'Magnesio', unit: 'mg', rda: 350, off: 'magnesium' },
  { k: 'k', g: 'Minerales', name: 'Potasio', unit: 'mg', rda: 3500, off: 'potassium' },
  { k: 'cl', g: 'Minerales', name: 'Cloro', unit: 'mg', rda: 3100, off: 'chloride' },
  { k: 'fe', g: 'Minerales', name: 'Hierro', unit: 'mg', rda: 11, off: 'iron' },
  { k: 'zn', g: 'Minerales', name: 'Zinc', unit: 'mg', rda: 11.7, off: 'zinc' },
  { k: 'cu', g: 'Minerales', name: 'Cobre', unit: 'mg', rda: 1.6, off: 'copper' },
  { k: 'mn', g: 'Minerales', name: 'Manganeso', unit: 'mg', rda: 3, off: 'manganese' },
  { k: 'se', g: 'Minerales', name: 'Selenio', unit: 'µg', rda: 70, off: 'selenium' },
  { k: 'io', g: 'Minerales', name: 'Yodo', unit: 'µg', rda: 150, off: 'iodine' },
  { k: 'mo', g: 'Minerales', name: 'Molibdeno', unit: 'µg', rda: 65, off: 'molybdenum' },
  { k: 'fl', g: 'Minerales', name: 'Flúor', unit: 'mg', rda: 3.4, off: 'fluoride' },
  { k: 'agua', g: 'Agua', name: 'Agua (comida + bebida)', unit: 'ml', rda: 2500 },
];
const ALL = [...MACROS, ...MICROS];
const GROUPS = [...new Set(MICROS.map(m => m.g))];
const UNIT_SCALE = { g: 1, mg: 1e3, 'µg': 1e6 };
const isComplete = f => ALL.every(n => typeof f[n.k] === 'number' && isFinite(f[n.k]));
const missingCount = f => ALL.filter(n => !(typeof f[n.k] === 'number' && isFinite(f[n.k]))).length;

/* ---------- Datos (localStorage) ---------- */
const STORE_KEY = 'kcal-count:v1';
const SEED_VERSION = 3;

// Valores por 100 g, aproximados (tablas USDA/BEDCA; biotina, yodo, molibdeno, cloro y flúor son estimaciones).
// Se pueden corregir desde «Alimentos».
const SEED_KEYS = ['kcal', 'p', 'c', 'f', 'fib', 'sug', 'sat', 'salt', 'vA', 'vC', 'vD', 'vE', 'vK', 'b1', 'b2', 'b3', 'b6', 'b9', 'b12',
  'ca', 'fe', 'mg', 'ph', 'k', 'zn', 'se',
  'trans', 'o6', 'ala', 'epa', 'agua', 'b5', 'b7', 'col', 'cl', 'cu', 'mn', 'io', 'mo', 'fl'];
const SEED_FOODS = [
  ['Pechuga de pollo (cruda)', [120, 22.5, 0, 2.6, 0, 0, 0.56, 0.11, 9, 0, 0.1, 0.2, 0.3, 0.09, 0.18, 9.6, 0.81, 9, 0.21, 5, 0.37, 28, 213, 334, 0.68, 22.8,
    0.02, 0.37, 0.01, 10, 74, 0.82, 2, 85, 70, 0.04, 0.01, 6, 3, 0.01]],
  ['Arroz blanco cocido', [130, 2.7, 28.2, 0.3, 0.4, 0, 0.08, 0, 0, 0, 0, 0.04, 0, 0.02, 0.01, 0.4, 0.09, 3, 0, 10, 0.2, 12, 43, 35, 0.49, 7.5,
    0, 0.08, 0.01, 0, 68.4, 0.39, 1, 2.1, 5, 0.07, 0.47, 1, 25, 0.04]],
  ['Huevo', [143, 12.6, 0.7, 9.5, 0, 0, 3.1, 0.36, 160, 0, 2, 1.05, 0.3, 0.04, 0.46, 0.08, 0.17, 47, 0.89, 56, 1.75, 12, 198, 138, 1.29, 30.7,
    0.04, 1.15, 0.05, 40, 76, 1.53, 20, 294, 170, 0.07, 0.03, 50, 15, 0.05], [60, 'huevo']],
  ['Copos de avena', [379, 13.2, 67.7, 6.5, 10.1, 0, 1.1, 0.02, 0, 0, 0, 0.4, 2, 0.46, 0.16, 1.1, 0.1, 32, 0, 52, 4.3, 138, 410, 362, 3.6, 28.9,
    0, 2.2, 0.1, 0, 10, 1.1, 20, 40, 60, 0.6, 4.9, 1, 60, 0.05], [40, 'ración']],
  ['Plátano', [89, 1.1, 22.8, 0.3, 2.6, 0, 0.11, 0, 3, 8.7, 0, 0.1, 0.5, 0.03, 0.07, 0.67, 0.37, 20, 0, 5, 0.26, 27, 22, 358, 0.15, 1,
    0, 0.05, 0.03, 0, 74.9, 0.33, 2.6, 9.8, 79, 0.08, 0.27, 1, 1, 0], [120, 'unidad']],
  ['Manzana', [52, 0.3, 13.8, 0.2, 2.4, 0, 0.03, 0, 3, 4.6, 0, 0.18, 2.2, 0.02, 0.03, 0.09, 0.04, 3, 0, 6, 0.12, 5, 11, 107, 0.04, 0,
    0, 0.04, 0.01, 0, 85.6, 0.06, 1, 3.4, 2, 0.03, 0.04, 1, 1, 0], [180, 'unidad']],
  ['Aceite de oliva', [884, 0, 0, 100, 0, 0, 13.8, 0, 0, 0, 0, 14.4, 60.2, 0, 0, 0, 0, 0, 0, 1, 0.56, 0, 0, 1, 0, 0,
    0, 9.8, 0.76, 0, 0, 0, 0, 0.3, 0, 0, 0, 0, 0, 0], [10, 'cucharada']],
  ['Leche semidesnatada', [46, 3.3, 4.8, 1.6, 0, 0, 1, 0.11, 20, 1, 0, 0.03, 0.1, 0.04, 0.18, 0.09, 0.04, 5, 0.45, 120, 0.03, 11, 92, 150, 0.4, 2,
    0.06, 0.04, 0.01, 0, 89.6, 0.36, 2, 16, 100, 0.01, 0, 20, 4, 0.01], [250, 'vaso']],
  ['Yogur griego natural', [97, 9, 4, 5, 0, 0, 3.3, 0.09, 45, 0.5, 0.1, 0.1, 0.2, 0.03, 0.2, 0.2, 0.06, 7, 0.6, 100, 0.05, 11, 135, 140, 0.5, 9.7,
    0.15, 0.1, 0.03, 0, 81, 0.33, 3, 15, 100, 0.01, 0.01, 20, 4, 0.01], [125, 'unidad']],
  ['Queso fresco batido 0%', [46, 8, 3.5, 0.1, 0, 0, 0.07, 0.1, 1, 0, 0, 0, 0, 0.03, 0.25, 0.1, 0.07, 12, 0.7, 110, 0.05, 10, 140, 150, 0.5, 7,
    0, 0, 0, 0, 87, 0.3, 3, 15, 100, 0.02, 0.01, 15, 4, 0.01], [250, 'tarrina']],
  ['Pan integral', [247, 13, 41, 3.4, 6.8, 3, 0.7, 1.13, 0, 0, 0, 0.3, 7.8, 0.39, 0.17, 4.4, 0.2, 42, 0, 107, 2.4, 75, 212, 250, 1.8, 25.8,
    0, 1.2, 0.08, 0, 38, 0.6, 6, 27, 700, 0.26, 2.1, 3, 25, 0.05], [30, 'rebanada']],
  ['Atún al natural (escurrido)', [116, 25.5, 0, 0.8, 0, 0, 0.23, 0.85, 17, 0, 1.7, 0.3, 0, 0.03, 0.07, 13.3, 0.35, 4, 2.5, 11, 1.3, 27, 163, 237, 0.77, 80.4,
    0.01, 0.01, 0, 225, 73, 0.21, 2, 29, 520, 0.05, 0.01, 15, 2, 0.03], [52, 'lata']],
  ['Lentejas cocidas', [116, 9, 20, 0.4, 7.9, 0, 0.05, 0, 0, 1.5, 0, 0.11, 1.7, 0.17, 0.07, 1.06, 0.18, 181, 0, 19, 3.3, 36, 180, 369, 1.27, 2.8,
    0, 0.14, 0.04, 0, 69.6, 0.64, 5, 32.7, 10, 0.25, 0.49, 1, 40, 0.01]],
  ['Patata cocida', [87, 1.9, 20, 0.1, 1.8, 0, 0.03, 0.01, 0, 7.4, 0, 0.01, 2.1, 0.1, 0.02, 1.3, 0.27, 9, 0, 8, 0.3, 20, 40, 328, 0.27, 0.3,
    0, 0.03, 0.01, 0, 77.5, 0.51, 0.5, 13.2, 50, 0.16, 0.14, 1, 3, 0.01]],
  ['Pasta cocida', [158, 5.8, 30.9, 0.9, 1.8, 0, 0.17, 0, 0, 0, 0, 0.06, 0.1, 0.02, 0.02, 0.4, 0.05, 7, 0, 7, 0.5, 18, 58, 44, 0.5, 26.4,
    0, 0.3, 0.01, 0, 62, 0.11, 1, 6.4, 5, 0.1, 0.32, 1, 15, 0.02]],
  ['Salmón', [208, 20, 0, 13, 0, 0, 3.1, 0.15, 58, 3.9, 11, 3.55, 0.5, 0.21, 0.16, 8.7, 0.64, 26, 3.2, 9, 0.34, 27, 240, 363, 0.36, 24,
    0.02, 0.86, 0.24, 1966, 64.9, 1.55, 5, 78.5, 60, 0.05, 0.01, 20, 3, 0.02]],
  ['Ternera magra', [137, 21, 0, 5.5, 0, 0, 2.2, 0.14, 0, 0, 0.1, 0.2, 1.2, 0.06, 0.18, 6, 0.6, 6, 2, 5, 2.2, 22, 200, 330, 4.5, 22,
    0.25, 0.2, 0.03, 10, 72, 0.65, 2, 70, 60, 0.08, 0.01, 5, 5, 0.02]],
  ['Almendras', [579, 21, 22, 50, 12.5, 0, 3.8, 0, 0, 0, 0, 25.6, 0, 0.2, 1.14, 3.6, 0.14, 44, 0, 269, 3.7, 270, 481, 733, 3.1, 4.1,
    0, 12.3, 0, 0, 4.4, 0.47, 57, 52, 40, 1.03, 2.18, 2, 30, 0.05], [30, 'puñado']],
  ['Aguacate', [160, 2, 8.5, 14.7, 6.7, 0, 2.1, 0.02, 7, 10, 0, 2.07, 21, 0.07, 0.13, 1.74, 0.26, 81, 0, 12, 0.55, 29, 52, 485, 0.64, 0.4,
    0, 1.67, 0.11, 0, 73.2, 1.39, 3.6, 14.2, 6, 0.19, 0.14, 1, 1, 0.01], [100, 'medio']],
  ['Brócoli', [34, 2.8, 6.6, 0.4, 2.6, 0, 0.04, 0.08, 31, 89.2, 0, 0.78, 101.6, 0.07, 0.12, 0.64, 0.18, 63, 0, 47, 0.73, 21, 66, 316, 0.41, 2.5,
    0, 0.02, 0.02, 0, 89.3, 0.57, 1, 18.7, 40, 0.05, 0.21, 2, 5, 0.01]],
  ['Tomate', [18, 0.9, 3.9, 0.2, 1.2, 0, 0.03, 0.01, 42, 13.7, 0, 0.54, 7.9, 0.04, 0.02, 0.59, 0.08, 15, 0, 10, 0.27, 11, 24, 237, 0.17, 0,
    0, 0.08, 0, 0, 94.5, 0.09, 1, 6.7, 50, 0.06, 0.11, 1, 2, 0], [120, 'unidad']],
  ['Agua', [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 100, 0, 0, 0, 0, 0, 0, 0, 0, 0], [250, 'vaso']],
].map(([name, vals, s]) => ({
  id: 'seed-' + name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/-$/, ''),
  name, brand: '',
  ...Object.fromEntries(SEED_KEYS.map((k, i) => [k, vals[i]])),
  serving: s ? s[0] : null, servingName: s ? s[1] : '',
  source: 'base',
}));

const DEFAULT_STATE = {
  goals: { kcal: 2900, p: 125, c: 420, f: 80 },
  foods: SEED_FOODS,
  seedVersion: SEED_VERSION,
  log: {},       // { 'YYYY-MM-DD': [{ id, meal, grams, food }] }
  recent: {},    // { foodId: timestamp }
  reminder: { on: false, time: '21:00' },
};

let state;
function migrate(s) {
  delete s.profile;
  delete s.rda;
  // Objetivos por defecto antiguos → nuevos
  if (s.goals && s.goals.kcal === 2000 && s.goals.p === 150 && s.goals.c === 200 && s.goals.f === 67) s.goals = { ...DEFAULT_STATE.goals };
  if (s.seedVersion !== SEED_VERSION) {
    // Sustituir los alimentos base sin modificar por la versión actual (con micronutrientes)
    const custom = s.foods.filter(f => f.source !== 'base');
    s.foods = [...SEED_FOODS.filter(sf => !custom.some(f => f.id === sf.id)), ...custom];
    s.seedVersion = SEED_VERSION;
  }
  return s;
}
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    state = raw ? migrate({ ...structuredClone(DEFAULT_STATE), ...JSON.parse(raw) }) : structuredClone(DEFAULT_STATE);
  } catch {
    state = structuredClone(DEFAULT_STATE);
  }
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
  catch { toast('No se pudo guardar (almacenamiento lleno)'); }
}

/* ---------- Cálculos ---------- */
function scaled(food, grams) {
  const k = grams / 100;
  return Object.fromEntries(ALL.map(n => [n.k, (food[n.k] || 0) * k]));
}
const entryNutrients = e => scaled(e.food || e, e.grams);
function sum(list) {
  const t = Object.fromEntries(ALL.map(n => [n.k, 0]));
  list.forEach(x => ALL.forEach(n => (t[n.k] += x[n.k] || 0)));
  return t;
}
const dayEntries = k => state.log[k] || [];
const dayTotals = k => sum(dayEntries(k).map(entryNutrients));

function macroLine(m) {
  return `<span class="macros">P ${fmt(m.p)} · C ${fmt(m.c)} · G ${fmt(m.f)}</span>`;
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

/* ---------- Componentes ---------- */
function ring(value, goal) {
  const R = 54, C = 2 * Math.PI * R;
  const pct = goal > 0 ? Math.min(value / goal, 1) : 0;
  const over = value > goal;
  return `
    <div class="ring ${over ? 'over' : ''}">
      <svg viewBox="0 0 132 132">
        <circle cx="66" cy="66" r="${R}" fill="none" class="ring-track" stroke-width="8"/>
        <circle cx="66" cy="66" r="${R}" fill="none" class="ring-fill" stroke-width="8"
          stroke-linecap="round" stroke-dasharray="${C * pct} ${C}"/>
      </svg>
      <div class="center">
        <span class="big">${r0(Math.abs(goal - value))}</span>
        <span class="small muted">${over ? 'kcal de más' : 'kcal restantes'}</span>
      </div>
    </div>`;
}
function bar(label, value, goal, unit, { max = false } = {}) {
  const pct = goal > 0 ? value / goal * 100 : 0;
  const over = max ? pct > 100 : pct > 105;
  return `
    <div class="bar ${over ? 'over' : ''}">
      <div class="lbl"><span>${label}</span><span class="muted">${fmt(value)} / ${fmt(goal)} ${unit}${max ? ' máx' : ''}</span></div>
      <div class="track"><div class="fill" style="width:${Math.min(pct, 100)}%"></div></div>
    </div>`;
}
// Lista de micronutrientes frente al valor diario recomendado
function microRows(t) {
  return GROUPS.map(g => `
    <h3>${g}</h3>
    ${MICROS.filter(m => m.g === g).map(m => {
      const minimal = m.max && m.rda === 0;
      const pct = m.rda > 0 ? t[m.k] / m.rda * 100 : 0;
      const over = m.max && pct > 100;
      return `
        <div class="mrow ${over ? 'over' : ''}">
          <span class="mname">${m.name}</span>
          <span class="mval muted">${minimal ? `${fmt(t[m.k])} ${m.unit} · lo mínimo` : `${fmt(t[m.k])}/${fmt(m.rda)} ${m.unit}${m.max ? ' máx' : ''}`}</span>
          <span class="mpct">${minimal ? '' : r0(pct) + '%'}</span>
          <div class="track"><div class="fill" style="width:${Math.min(pct, 100)}%"></div></div>
        </div>`;
    }).join('')}`).join('');
}

/* ---------- Hoy ---------- */
function renderToday() {
  const entries = dayEntries(currentDay);
  const t = dayTotals(currentDay), g = state.goals;
  const meals = MEALS.map(m => {
    const list = entries.filter(e => e.meal === m.id);
    const mt = sum(list.map(entryNutrients));
    return `
      <div class="card">
        <div class="meal-head">
          <div><h2>${m.name}</h2><span class="small muted">${r0(mt.kcal)} kcal</span></div>
          <button class="btn ghost" data-add="${m.id}">Añadir</button>
        </div>
        ${list.map(e => {
          const n = entryNutrients(e);
          return `
          <div class="entry" data-entry="${e.id}">
            <div class="grow">
              <div class="ellipsis">${esc(e.food?.name || e.name)}</div>
              <div class="small muted">${r0(e.grams)} g · ${macroLine(n)}</div>
            </div>
            <div class="kc">${r0(n.kcal)}</div>
          </div>`;
        }).join('')}
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
        ${bar('Proteína', t.p, g.p, 'g')}
        ${bar('Carbohidratos', t.c, g.c, 'g')}
        ${bar('Grasa', t.f, g.f, 'g')}
      </div>
    </div>
    ${meals}
    ${entries.length === 0 && dayEntries(addDays(currentDay, -1)).length
      ? `<button class="btn block" id="copyYesterday">Copiar comidas del día anterior</button>` : ''}
    <div class="card">
      <h2>Micronutrientes</h2>
      ${microRows(t)}
    </div>
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

function foodItem(f) {
  const incomplete = !isComplete(f);
  return `
    <div class="item" data-food="${esc(f.id)}">
      <div class="grow">
        <div class="ellipsis">${esc(f.name)}${f.brand ? ` <span class="muted small">· ${esc(f.brand)}</span>` : ''}</div>
        <div class="small muted">${f.kcal != null ? r0(f.kcal) + ' kcal/100 g · ' + macroLine(f) : 'sin datos'}</div>
      </div>
      ${incomplete ? '<span class="badge">incompleto</span>' : ''}
    </div>`;
}

// Un alimento solo se puede registrar con todos sus nutrientes; si falta algo, primero se completa
function useFood(food, meal) {
  if (isComplete(food)) return openQuantity(food, meal);
  openFoodEditor(food, f => openQuantity(f, meal));
}

function openAddFood(meal) {
  openSheet(`
    <div class="row between"><h2>${esc(MEALS.find(m => m.id === meal).name)}</h2>
      <button class="btn ghost" id="close">Cerrar</button></div>
    <div class="row" style="margin-top:10px">
      <input id="q" class="grow" type="search" placeholder="Buscar alimento" autocomplete="off">
      <button class="btn" id="scan">Escanear</button>
    </div>
    <div class="list" id="results"></div>
    <div id="online"></div>
    <button class="btn block" id="offBtn" hidden></button>
    <button class="btn block" id="newFood">Crear alimento</button>
  `, sh => {
    let onlineResults = [];
    const q = $('#q', sh);
    const draw = () => {
      const text = q.value.trim();
      const local = searchLocal(text).slice(0, text ? 40 : 15);
      $('#results', sh).innerHTML = (!text ? '<h3>Recientes</h3>' : '') +
        (local.length ? local.map(foodItem).join('') : '<div class="empty">Sin resultados</div>');
      const ob = $('#offBtn', sh);
      ob.hidden = text.length < 2;
      ob.textContent = `Buscar «${text}» en Open Food Facts`;
      bind();
    };
    const bind = () => $$('[data-food]', sh).forEach(el => el.onclick = () => {
      const f = state.foods.find(x => x.id === el.dataset.food) || onlineResults.find(x => x.id === el.dataset.food);
      if (f) useFood(f, meal);
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
          (onlineResults.length ? onlineResults.map(foodItem).join('') : '<div class="empty">Nada encontrado</div>') + '</div>';
        bind();
      } catch {
        box.innerHTML = '<div class="empty">Sin conexión</div>';
      }
    };
    draw();
  });
}

/* ---------- Cantidad ---------- */
function openQuantity(food, meal, entry = null) {
  const hasServing = food.serving > 0;
  let unit = entry ? 'g' : hasServing ? 'serv' : 'g';
  const amount = entry ? entry.grams : hasServing ? 1 : 100;
  let selMeal = entry ? entry.meal : meal;

  openSheet(`
    <div class="row between"><h2 class="ellipsis grow">${esc(food.name)}</h2>
      <button class="btn ghost" id="close">Cerrar</button></div>
    ${food.brand ? `<div class="small muted">${esc(food.brand)}</div>` : ''}
    <div class="row" style="margin-top:12px">
      <input id="amt" class="grow" type="number" inputmode="decimal" min="0" step="any" value="${amount}">
      <select id="unit" style="width:auto">
        <option value="g">gramos</option>
        ${hasServing ? `<option value="serv">${esc(food.servingName || 'ración')} (${r0(food.serving)} g)</option>` : ''}
      </select>
    </div>
    <div class="chips" id="quick"></div>
    <div class="preview" id="prev"></div>
    <div class="chips" id="meals">
      ${MEALS.map(m => `<button class="chip" data-meal="${m.id}">${m.name}</button>`).join('')}
    </div>
    <button class="btn primary block" id="ok">${entry ? 'Guardar' : 'Añadir'}</button>
    ${entry ? '<button class="btn danger block" id="del">Eliminar</button>' : ''}
    <div id="micros"></div>
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
      const m = scaled(food, grams());
      $('#prev', sh).innerHTML = `
        <div><b>${r0(m.kcal)}</b><span class="small muted">kcal</span></div>
        <div><b>${fmt(m.p)}</b><span class="small muted">prot</span></div>
        <div><b>${fmt(m.c)}</b><span class="small muted">carb</span></div>
        <div><b>${fmt(m.f)}</b><span class="small muted">grasa</span></div>`;
      $('#micros', sh).innerHTML = '<h3>Aporte diario</h3>' + microRows(m);
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
      const snapshot = { id: food.id, name: food.name, brand: food.brand, serving: food.serving, servingName: food.servingName,
        ...Object.fromEntries(ALL.map(n => [n.k, food[n.k]])) };
      const data = { grams: g, meal: selMeal, food: snapshot };
      const list = state.log[currentDay] = dayEntries(currentDay);
      if (entry) {
        const i = list.findIndex(e => e.id === entry.id);
        list[i] = { id: entry.id, ...data };
      } else list.push({ id: uid(), ...data });
      save(); closeSheet(); render();
      toast(entry ? 'Guardado' : `Añadido: ${r0(scaled(food, g).kcal)} kcal`);
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
function nutrientInput(n, food) {
  const v = food[n.k];
  return `<div><label for="n-${n.k}">${n.name} (${n.unit})</label>
    <input id="n-${n.k}" data-n="${n.k}" type="number" inputmode="decimal" min="0" step="any" value="${v ?? ''}"></div>`;
}

function openFoodEditor(food = {}, onSaved) {
  const isNew = !food.id || !state.foods.some(f => f.id === food.id);
  const missing = food.id ? missingCount(food) : 0;
  openSheet(`
    <div class="row between"><h2>${isNew ? 'Nuevo alimento' : 'Editar alimento'}</h2>
      <button class="btn ghost" id="close">Cerrar</button></div>
    ${missing ? `<div class="notice">Faltan ${missing} valores. Cópialos de la etiqueta; pon 0 si no lo contiene.</div>` : ''}
    <button class="btn block" id="zeros">Rellenar vacíos con 0</button>
    <label for="name">Nombre</label><input id="name" value="${esc(food.name ?? '')}">
    <label for="brand">Marca</label><input id="brand" value="${esc(food.brand ?? '')}">
    <h3>Por 100 g</h3>
    <div class="grid2">${MACROS.map(n => nutrientInput(n, food)).join('')}</div>
    <div class="small muted" id="kcalHint" style="margin-top:6px"></div>
    ${GROUPS.map(g => `<h3>${g}</h3><div class="grid2">${MICROS.filter(m => m.g === g).map(n => nutrientInput(n, food)).join('')}</div>`).join('')}
    <h3>Ración</h3>
    <div class="grid2">
      <div><label for="serving">Gramos por ración</label><input id="serving" type="number" inputmode="decimal" step="any" value="${food.serving ?? ''}"></div>
      <div><label for="servingName">Nombre de la ración</label><input id="servingName" value="${esc(food.servingName ?? '')}"></div>
    </div>
    <label for="barcode">Código de barras</label><input id="barcode" inputmode="numeric" value="${esc(food.barcode ?? '')}">
    <button class="btn primary block" id="ok">Guardar</button>
    ${!isNew ? '<button class="btn danger block" id="del">Eliminar alimento</button>' : ''}
  `, sh => {
    const inputs = $$('[data-n]', sh);
    const mark = () => inputs.forEach(i => i.classList.toggle('missing', numOrNull(i.value) === null));
    const hint = () => {
      const est = 4 * num($('#n-p', sh).value) + 4 * num($('#n-c', sh).value) + 9 * num($('#n-f', sh).value);
      $('#kcalHint', sh).textContent = est > 0 ? `Según macros ≈ ${r0(est)} kcal` : '';
    };
    inputs.forEach(i => i.addEventListener('input', () => { i.classList.toggle('missing', numOrNull(i.value) === null); hint(); }));
    if (missing) mark();
    hint();
    $('#zeros', sh).onclick = () => {
      if (!confirm('¿Poner 0 en todos los valores vacíos?')) return;
      inputs.forEach(i => { if (numOrNull(i.value) === null) i.value = 0; });
      mark(); hint();
    };
    $('#close', sh).onclick = closeSheet;
    $('#ok', sh).onclick = () => {
      const name = $('#name', sh).value.trim();
      if (!name) { $('#name', sh).focus(); return toast('Falta el nombre'); }
      mark();
      const empty = inputs.filter(i => numOrNull(i.value) === null);
      if (empty.length) {
        empty[0].scrollIntoView({ block: 'center', behavior: 'smooth' });
        return toast(`Faltan ${empty.length} valores (pon 0 si no lo contiene)`);
      }
      const out = {
        id: food.id || 'u-' + uid(),
        name, brand: $('#brand', sh).value.trim(),
        ...Object.fromEntries(inputs.map(i => [i.dataset.n, numOrNull(i.value)])),
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
      if (!confirm(`¿Eliminar «${food.name}»? Lo ya registrado se mantiene.`)) return;
      state.foods = state.foods.filter(x => x.id !== food.id);
      save(); closeSheet(); render();
    };
  });
}

/* ---------- Open Food Facts ---------- */
const OFF_FIELDS = 'code,product_name,product_name_es,brands,nutriments,serving_quantity';
function fromOFF(p) {
  const n = p.nutriments || {};
  const val = key => { const v = n[key + '_100g']; return v === '' || v == null || !isFinite(+v) ? undefined : +v; };
  let kcal = val('energy-kcal');
  if (kcal == null && val('energy') != null) kcal = val('energy') / 4.184;
  const food = {
    id: 'off-' + p.code, barcode: p.code,
    name: (p.product_name_es || p.product_name || '').trim(),
    brand: (p.brands || '').split(',')[0].trim(),
    kcal: kcal == null ? undefined : r0(kcal),
    serving: num(p.serving_quantity) || null, servingName: num(p.serving_quantity) ? 'ración' : '',
    source: 'off',
  };
  for (const m of [...MACROS.slice(1), ...MICROS]) {
    const keys = m.off ? [].concat(m.off) : [];
    const vals = keys.map(val).filter(v => v != null);
    const v = keys.length && vals.length === keys.length ? vals.reduce((a, b) => a + b, 0) : undefined;
    food[m.k] = v == null ? undefined : Math.round(v * (UNIT_SCALE[m.unit] || 1) * 1000) / 1000;
  }
  return food;
}
async function searchOFF(q) {
  const url = `https://es.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=25&fields=${OFF_FIELDS}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(res.status);
  const data = await res.json();
  return (data.products || []).filter(p => p.code).map(fromOFF).filter(f => f.name);
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
    if (f) useFood(f, meal);
    else { toast('Producto no encontrado'); openFoodEditor({ barcode: code }, nf => openQuantity(nf, meal)); }
  } catch {
    toast('Error de conexión');
  }
}

// manualOnly: formulario para escribir el código (si no hay escáner disponible)
function openScanner(meal, manualOnly = false) {
  if (Native && !manualOnly) return nativeScan(meal);
  const supported = !manualOnly && 'BarcodeDetector' in window && navigator.mediaDevices?.getUserMedia;
  openSheet(`
    <div class="row between"><h2>Código de barras</h2>
      <button class="btn ghost" id="close">Cerrar</button></div>
    ${supported ? '<video id="video" playsinline muted></video><div class="small muted" id="scanMsg" style="margin-top:6px">Apunta al código de barras</div>'
      : '<div class="small muted">No se puede escanear con la cámara. Escribe el código:</div>'}
    <div class="row" style="margin-top:10px"><input id="code" class="grow" inputmode="numeric" placeholder="8410000000000">
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
          if (m) m.textContent = 'No se pudo acceder a la cámara. Escribe el código.';
        }
      })();
    }
    return stop;
  });
}

/* ---------- Alimentos ---------- */
function renderFoods() {
  $('#view').innerHTML = `
    <h1>Alimentos</h1>
    <div class="row">
      <input id="fq" class="grow" type="search" placeholder="Buscar">
      <button class="btn primary" id="add">Nuevo</button>
    </div>
    <div class="card list" id="flist" style="margin-top:12px"></div>
  `;
  const draw = () => {
    const list = searchLocal($('#fq').value.trim()).sort((a, b) => a.name.localeCompare(b.name));
    $('#flist').innerHTML = list.length ? list.map(foodItem).join('') : '<div class="empty">No hay alimentos</div>';
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
    if (dayEntries(k).length) last7.push(dayTotals(k));
  }
  const avg = last7.length ? Object.fromEntries(ALL.map(n => [n.k, last7.reduce((a, d) => a + d[n.k], 0) / last7.length])) : null;

  $('#view').innerHTML = `
    <h1>Historial</h1>
    <div class="card">
      <h2>Media 7 días</h2>
      ${avg ? `
        <div class="small muted" style="margin-top:4px">${last7.length} día(s) con registros</div>
        <div class="preview">
          <div><b>${r0(avg.kcal)}</b><span class="small muted">kcal</span></div>
          <div><b>${r0(avg.p)}</b><span class="small muted">prot</span></div>
          <div><b>${r0(avg.c)}</b><span class="small muted">carb</span></div>
          <div><b>${r0(avg.f)}</b><span class="small muted">grasa</span></div>
        </div>
        ${microRows(avg)}` : '<div class="empty">Sin datos</div>'}
    </div>
    <div class="card">
      ${days.length ? days.slice(0, 60).map(k => {
        const t = dayTotals(k);
        return `
          <div class="hday" data-day="${k}">
            <div class="row between"><span>${esc(dayLabel(k))}</span>
              <span><b>${r0(t.kcal)}</b> <span class="muted small">/ ${r0(g.kcal)} kcal</span></span></div>
            <div class="bar ${t.kcal > g.kcal ? 'over' : ''}" style="margin:4px 0"><div class="track"><div class="fill" style="width:${Math.min(t.kcal / g.kcal * 100, 100)}%"></div></div></div>
            ${macroLine(t)}
          </div>`;
      }).join('') : '<div class="empty">Sin registros</div>'}
    </div>
  `;
  $$('[data-day]').forEach(el => el.onclick = () => { currentDay = el.dataset.day; currentTab = 'today'; render(); });
}

/* ---------- Ajustes ---------- */
function renderSettings() {
  const g = state.goals;
  $('#view').innerHTML = `
    <h1>Ajustes</h1>
    <div class="card">
      <h2>Objetivos diarios</h2>
      <div class="grid2">
        ${MACROS.map(n => `<div><label for="g-${n.k}">${n.name} (${n.unit})</label>
          <input id="g-${n.k}" data-goal="${n.k}" type="number" inputmode="numeric" value="${g[n.k]}"></div>`).join('')}
      </div>
      <div class="small muted" id="gsum" style="margin-top:6px"></div>
      <button class="btn primary block" id="saveGoals">Guardar</button>
    </div>

    ${Native ? `
    <div class="card">
      <h2>Recordatorio diario</h2>
      <div class="row" style="margin-top:10px">
        <label class="row grow" style="margin:0;color:var(--text)"><input id="remOn" type="checkbox" style="width:auto"> Activado</label>
        <input id="remTime" type="time" style="width:auto" value="${esc(state.reminder.time)}">
      </div>
    </div>` : ''}

    <div class="card">
      <h2>Datos</h2>
      <div class="small muted">Todo se guarda solo en este dispositivo.</div>
      <button class="btn block" id="export">Exportar copia</button>
      <button class="btn block" id="import">Importar copia</button>
      <input type="file" id="file" accept="application/json,.json" hidden>
      <button class="btn danger block" id="reset">Borrar todos los datos</button>
    </div>
    <div class="small muted" style="text-align:center">Datos de productos: Open Food Facts (ODbL)</div>
  `;

  const gsum = () => {
    const fromMacros = 4 * num($('#g-p').value) + 4 * num($('#g-c').value) + 9 * num($('#g-f').value);
    $('#gsum').textContent = `Los macros suman ${r0(fromMacros)} kcal`;
  };
  $$('[data-goal]').forEach(i => i.oninput = gsum); gsum();
  $('#saveGoals').onclick = () => {
    $$('[data-goal]').forEach(i => (state.goals[i.dataset.goal] = num(i.value)));
    save(); toast('Guardado');
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
      state = migrate({ ...structuredClone(DEFAULT_STATE), ...data });
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
