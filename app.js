"use strict";

/* ============================================================
   STORAGE
============================================================ */
const K_SETTINGS = "nutrition_settings";
const K_FOODS    = "nutrition_foods";
const K_LOG      = "nutrition_log";
const K_WEIGHTS  = "nutrition_weights";
const K_DAYFLAGS = "nutrition_dayflags";

function lsGet(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    if(!raw) return fallback;
    return JSON.parse(raw);
  }catch{
    return fallback;
  }
}
function lsSet(key, value){
  localStorage.setItem(key, JSON.stringify(value));
}

/* ============================================================
   HELPERS
============================================================ */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function uid(){ return Math.random().toString(16).slice(2) + Date.now().toString(16); }

function todayISO(){
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}
function daysBackISO(n){
  const d = new Date();
  d.setDate(d.getDate()-n);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}
function addDaysISO(dateISO, delta){
  const d = new Date(dateISO + "T00:00:00");
  d.setDate(d.getDate() + delta);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}

function fmt0(n){
  const x = Number(n);
  if(!Number.isFinite(x)) return "0";
  return Math.round(x).toString();
}
function round1(n){
  const x = Number(n);
  if(!Number.isFinite(x)) return 0;
  return Math.round(x*10)/10;
}
function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }
function escapeHtml(str){
  return String(str ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

/* iPhone decimal: accept "0,5" "1.2" "1," etc without resetting */
function numVal(v){
  if(v === null || v === undefined) return 0;
  let s = String(v).trim();
  if(!s) return 0;

  // keep digits + separators + minus
  s = s.replace(/[^\d,.\-]/g, "");

  // allow partial input (ends with dot/comma)
  if(/[,.]$/.test(s)) {
    const cut = s.slice(0, -1).replace(",", ".");
    const x = Number(cut);
    return Number.isFinite(x) ? x : 0;
  }

  // normalize comma -> dot (first comma)
  s = s.replace(",", ".");
  const x = Number(s);
  return Number.isFinite(x) ? x : 0;
}

function formatDateLabel(dateISO){
  const d = new Date(dateISO + "T00:00:00");
  try{
    return new Intl.DateTimeFormat("fr-CH", {
      weekday:"short",
      day:"2-digit",
      month:"short",
      year:"numeric"
    }).format(d);
  }catch{
    return dateISO;
  }
}
function updateHomeDateUI(){
  const date = $("#homeDate")?.value || todayISO();
  const label = $("#dateLabel");
  if(label) label.textContent = formatDateLabel(date);
}

/* ============================================================
   PRESET CATEGORIES
============================================================ */
const PRESET_CATS = [
  "Laitier","Légume","Viande","Poisson","Fruit",
  "Glucide","Lipide","Boisson","Snack","Autre"
];

function fillCategorySelects(){
  const selAdd = $("#fCatSelect");
  const selFilter = $("#foodCatFilter");

  if(selAdd){
    selAdd.innerHTML = "";
    for(const c of PRESET_CATS){
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      selAdd.appendChild(opt);
    }
    selAdd.value = "Laitier";
  }

  if(selFilter){
    // remove any old dynamic options (keep first "Toutes")
    const keep0 = selFilter.querySelector('option[value="__all__"]');
    selFilter.innerHTML = "";
    selFilter.appendChild(keep0);

    PRESET_CATS.filter(c => c !== "Autre").forEach(c=>{
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      selFilter.appendChild(opt);
    });
  }
}

function setupCategoryBehavior(){
  const sel = $("#fCatSelect");
  const wrap = $("#fCatCustomWrap");
  const inp = $("#fCatCustom");
  if(!sel || !wrap || !inp) return;

  const apply = () => {
    const isOther = sel.value === "Autre";
    wrap.style.display = isOther ? "flex" : "none";
    if(!isOther) inp.value = "";
  };

  sel.addEventListener("change", apply);
  apply();
}

/* ============================================================
   STATE
============================================================ */
const defaultSettings = {
  sex:"M", age:23, height:178, weight:90,
  activity:1.55, goal:"cut", rate:0.5,
  protKg:2.0, fatKg:0.7, fiber:30, sodium:2300, water:3.0,
  trainingDelta: +200,
  restDelta: 0,
  kcal:2200, p:170, c:220, f:70
};

let settings = lsGet(K_SETTINGS, structuredClone(defaultSettings));
let foods    = lsGet(K_FOODS, []);
let log      = lsGet(K_LOG, []);
let weights  = lsGet(K_WEIGHTS, []);
let dayFlags = lsGet(K_DAYFLAGS, {});

/* ============================================================
   CALC
============================================================ */
function mifflinBMR({sex, weight, height, age}){
  const s = (sex === "M") ? 5 : -161;
  return (10*weight) + (6.25*height) - (5*age) + s;
}

function calcTargetsFromInputs(s){
  const sexConst = (s.sex === "M") ? 5 : -161;
  const bmr = mifflinBMR(s);
  const tdee = bmr * Number(s.activity || 1.2);
  const daily = (Number(s.rate || 0) * 7700) / 7;

  let delta = 0;
  if(s.goal === "cut") delta = -daily;
  else if(s.goal === "bulk") delta = +daily;

  const targetKcal = tdee + delta;

  const protG = Number(s.protKg || 0) * Number(s.weight || 0);
  const fatG  = Number(s.fatKg  || 0) * Number(s.weight || 0);

  const kcalFromProt = protG * 4;
  const kcalFromFat  = fatG * 9;
  const remaining = Math.max(0, targetKcal - kcalFromProt - kcalFromFat);
  const carbG = remaining / 4;

  return {
    sexConst, bmr, tdee, delta,
    targetKcal, protG, fatG, carbG,
    fiber:Number(s.fiber||0),
    sodium:Number(s.sodium||0),
    water:Number(s.water||0)
  };
}

/* ============================================================
   DATA HELPERS
============================================================ */
function findFoodByName(name){
  const n = (name || "").trim().toLowerCase();
  return foods.find(f => f.name.trim().toLowerCase() === n) || null;
}

function macrosForItem(food, grams){
  const g = numVal(grams);
  const factor = g / 100;
  return {
    kcal: (numVal(food.kcal100) * factor),
    p: (numVal(food.p100) * factor),
    c: (numVal(food.g100) * factor),
    f: (numVal(food.l100) * factor)
  };
}

function totalsForDate(dateISO){
  let kcal=0,p=0,c=0,f=0;
  for(const it of log){
    if(it.date !== dateISO) continue;
    const food = findFoodByName(it.foodName);
    if(!food) continue;
    const m = macrosForItem(food, it.grams);
    kcal += m.kcal; p += m.p; c += m.c; f += m.f;
  }
  return {kcal,p,c,f};
}

/* ============================================================
   KPI STATES + COACH
============================================================ */
function kpiStateForCalories(pct){
  if(pct < 0.8) return {cls:"is-ok", badge:"OK"};
  if(pct <= 1.0) return {cls:"is-warn", badge:"À surveiller"};
  return {cls:"is-bad", badge:"Dépassé"};
}
function kpiStateForProtein(pct){
  if(pct < 0.7) return {cls:"is-bad", badge:"Trop bas"};
  if(pct < 0.9) return {cls:"is-warn", badge:"Bas"};
  return {cls:"is-ok", badge:"Bon"};
}
function kpiStateGeneric(pct){
  if(pct < 0.8) return {cls:"is-warn", badge:"Bas"};
  if(pct <= 1.0) return {cls:"is-ok", badge:"OK"};
  return {cls:"is-bad", badge:"Trop"};
}

function getAlerts(consumed, targets, hourNow){
  const out = [];
  if(targets.p > 0 && consumed.p < 0.7*targets.p && hourNow >= 14){
    out.push("Protéines basses : vise 40–50g au prochain repas.");
  }
  if(targets.f > 0 && consumed.f < 0.6*targets.f && hourNow >= 18){
    out.push("Lipides trop bas : ajoute 15–25g (huile d’olive, œufs, noix).");
  }
  if(targets.kcal > 0 && consumed.kcal > targets.kcal){
    out.push("Calories dépassées : reste light ce soir.");
  }
  if(out.length === 0){
    out.push("Régulier > parfait. Ajoute tes repas, ajuste ensuite.");
  }
  return out.slice(0,4);
}

/* ============================================================
   NAV / TABS
============================================================ */
function activateTab(key){
  $$(".tab").forEach(b => b.classList.toggle("is-active", b.dataset.tab === key));
  $$(".btab").forEach(b => b.classList.toggle("is-active", b.dataset.tab === key));

  $$(".panel").forEach(p => p.classList.remove("is-active"));
  const panel = $("#tab-" + key);
  if(panel) panel.classList.add("is-active");

  if(key === "stats") renderCharts();
}
function setupTabs(){
  const bind = (btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.tab;
      if(!key) return;
      activateTab(key);
    });
  };
  $$(".tab").forEach(bind);
  $$(".btab").forEach(bind);
}

/* ============================================================
   HOME
============================================================ */
function dayTypeFor(dateISO){ return dayFlags[dateISO] || "rest"; }
function setDayType(dateISO, type){
  dayFlags[dateISO] = type;
  lsSet(K_DAYFLAGS, dayFlags);
}

function effectiveTargetsForDate(dateISO){
  const base = {kcal:+settings.kcal||0, p:+settings.p||0, c:+settings.c||0, f:+settings.f||0};
  const type = dayTypeFor(dateISO);
  const delta = (type === "training") ? (+settings.trainingDelta||0) : (+settings.restDelta||0);
  const kcal = Math.max(0, base.kcal + delta);
  let c = base.c + (delta/4);
  c = Math.max(0, c);
  return {kcal, p:base.p, c, f:base.f, delta, type};
}

function setChip(id, remaining, unit){
  const el = $(id);
  el.textContent = `Restant ${fmt0(remaining)} ${unit}`;
  el.style.borderColor = "rgba(255,255,255,.10)";
  el.style.background  = "rgba(255,255,255,.05)";
  if(remaining < 0){
    el.style.borderColor = "rgba(239,68,68,.55)";
    el.style.background  = "rgba(239,68,68,.18)";
  }
}

function setKpiBlock(key, consumed, target, unit, stateFn){
  const card = $("#kpi_"+key);
  card.classList.remove("is-ok","is-warn","is-bad");

  const pctRaw = (target > 0) ? (consumed/target) : 0;
  const pct = clamp(pctRaw, 0, 1.2);
  const st = stateFn(pctRaw);

  card.classList.add(st.cls);
  $("#badge_"+key).textContent = st.badge;

  $("#val_"+key).textContent = fmt0(consumed);
  $("#sub_"+key).textContent = `${fmt0(consumed)} / ${fmt0(target)} ${unit}`;
  $("#bar_"+key).style.width = `${Math.round(pct*100)}%`;
}

function renderHome(){
  const date = $("#homeDate").value || todayISO();
  $("#homeDate").value = date;
  updateHomeDateUI();

  const type = dayTypeFor(date);
  const toggle = $("#dayTrainingToggle");
  toggle.checked = (type === "training");
  $("#dayTypeHint").textContent = toggle.checked ? "Entraînement" : "Repos";

  const consumed = totalsForDate(date);
  const targets = effectiveTargetsForDate(date);

  setKpiBlock("cal", consumed.kcal, targets.kcal, "kcal", kpiStateForCalories);
  setKpiBlock("p",   consumed.p,   targets.p,   "g",   kpiStateForProtein);
  setKpiBlock("c",   consumed.c,   targets.c,   "g",   kpiStateGeneric);
  setKpiBlock("f",   consumed.f,   targets.f,   "g",   kpiStateGeneric);

  setChip("#chip_cal", targets.kcal - consumed.kcal, "kcal");
  setChip("#chip_p",   targets.p   - consumed.p, "g");
  setChip("#chip_c",   targets.c   - consumed.c, "g");
  setChip("#chip_f",   targets.f   - consumed.f, "g");

  const hour = new Date().getHours();
  const alerts = getAlerts(consumed, targets, hour);
  const ul = $("#coachList");
  ul.innerHTML = "";
  for(const a of alerts){
    const li = document.createElement("li");
    li.textContent = a;
    ul.appendChild(li);
  }
}

/* Autocomplete iOS */
function setupFoodAutocomplete(){
  const input = $("#qaFood");
  const box = $("#qaFoodAuto");
  if(!input || !box) return;

  function hide(){ box.style.display = "none"; box.innerHTML = ""; }
  function show(){ box.style.display = "block"; }

  function renderList(term){
    const t = (term || "").trim().toLowerCase();
    box.innerHTML = "";
    if(!t){ hide(); return; }

    const matches = foods
      .filter(f => f.name.toLowerCase().includes(t))
      .slice(0, 30);

    if(matches.length === 0){ hide(); return; }

    for(const f of matches){
      const div = document.createElement("div");
      div.className = "autoItem";
      div.innerHTML = `${escapeHtml(f.name)}<small>${escapeHtml(f.category||"")}</small>`;
      div.addEventListener("click", () => {
        input.value = f.name;
        hide();
      });
      box.appendChild(div);
    }
    show();
  }

  input.addEventListener("input", () => renderList(input.value));
  input.addEventListener("focus", () => renderList(input.value));
  document.addEventListener("click", (e) => {
    if(e.target === input || box.contains(e.target)) return;
    hide();
  });
  input.addEventListener("keydown", (e) => {
    if(e.key === "Escape") hide();
  });
}

function setupHomeHandlers(){
  // date nav
  const prev = $("#datePrev");
  const next = $("#dateNext");
  const homeDate = $("#homeDate");

  if(homeDate){
    homeDate.value = homeDate.value || todayISO();
    homeDate.addEventListener("change", ()=>{
      updateHomeDateUI();
      renderHome();
    });
  }
  if(prev){
    prev.addEventListener("click", ()=>{
      const d = homeDate.value || todayISO();
      homeDate.value = addDaysISO(d, -1);
      updateHomeDateUI();
      renderHome();
    });
  }
  if(next){
    next.addEventListener("click", ()=>{
      const d = homeDate.value || todayISO();
      homeDate.value = addDaysISO(d, +1);
      updateHomeDateUI();
      renderHome();
    });
  }

  $("#dayTrainingToggle")?.addEventListener("change", ()=>{
    const date = $("#homeDate").value || todayISO();
    setDayType(date, $("#dayTrainingToggle").checked ? "training" : "rest");
    renderHome();
  });

  $("#btnRefreshHome")?.addEventListener("click", renderHome);

  $("#btnPlus50")?.addEventListener("click", ()=>{
    $("#qaGrams").value = Math.max(1, (numVal($("#qaGrams").value) || 0) + 50);
  });
  $("#btnPlus100")?.addEventListener("click", ()=>{
    $("#qaGrams").value = Math.max(1, (numVal($("#qaGrams").value) || 0) + 100);
  });
  $("#btnPlusPortion")?.addEventListener("click", ()=>{
    const foodName = $("#qaFood").value.trim();
    const f = findFoodByName(foodName);
    const portion = f ? (numVal(f.portionGrams)||0) : 0;
    if(portion > 0){
      $("#qaGrams").value = Math.max(1, (numVal($("#qaGrams").value) || 0) + portion);
    }else{
      alert("Pas de portion définie (mets Portion (g) dans Base aliments).");
    }
  });

  $("#quickAddForm")?.addEventListener("submit", (e)=>{
    e.preventDefault();

    const date = $("#homeDate").value || todayISO();
    const meal = $("#qaMeal").value || "";
    const foodName = $("#qaFood").value.trim();
    const grams = numVal($("#qaGrams").value);
    const note = $("#qaNote").value.trim();

    if(!meal){ alert("Choisis un repas."); return; }
    if(!foodName){ alert("Choisis un aliment."); return; }
    if(!(grams>0)){ alert("Quantité invalide."); return; }

    const food = findFoodByName(foodName);
    if(!food){
      alert("Aliment introuvable. Ajoute-le dans Base aliments.");
      return;
    }

    log.push({ id:uid(), date, meal, foodName, grams, note });
    lsSet(K_LOG, log);

    $("#qaGrams").value = 100;
    $("#qaNote").value = "";

    renderAll();
  });
}

/* ============================================================
   SETTINGS
============================================================ */
function renderCalculator(){
  $("#pSex").value = settings.sex;
  $("#pAge").value = settings.age;
  $("#pHeight").value = settings.height;
  $("#pWeight").value = String(settings.weight ?? "");
  $("#pActivity").value = String(settings.activity);
  $("#pGoal").value = settings.goal;
  $("#pRate").value = String(settings.rate ?? "");

  $("#pProtKg").value = String(settings.protKg ?? "");
  $("#pFatKg").value = String(settings.fatKg ?? "");
  $("#pFiber").value = settings.fiber;
  $("#pSodium").value = settings.sodium;
  $("#pWater").value = String(settings.water ?? "");

  $("#pTrainingDelta").value = settings.trainingDelta;
  $("#pRestDelta").value = settings.restDelta;

  const out = calcTargetsFromInputs(settings);
  $("#cSexConst").textContent = fmt0(out.sexConst);
  $("#cBmr").textContent = fmt0(out.bmr);
  $("#cTdee").textContent = fmt0(out.tdee);
  $("#cDelta").textContent = fmt0(out.delta);
  $("#cTarget").textContent = fmt0(out.targetKcal);
  $("#cProt").textContent = fmt0(out.protG);
  $("#cFat").textContent = fmt0(out.fatG);
  $("#cCarb").textContent = fmt0(out.carbG);
  $("#cFiber").textContent = fmt0(out.fiber);
  $("#cSodium").textContent = fmt0(out.sodium);
  $("#cWater").textContent = String(round1(out.water));
}

function readSettingsInputs(){
  settings.sex = $("#pSex").value;
  settings.age = numVal($("#pAge").value);
  settings.height = numVal($("#pHeight").value);

  settings.weight = numVal($("#pWeight").value);
  settings.activity = numVal($("#pActivity").value) || 1.2;
  settings.goal = $("#pGoal").value;
  settings.rate = numVal($("#pRate").value);

  settings.protKg = numVal($("#pProtKg").value);
  settings.fatKg = numVal($("#pFatKg").value);
  settings.fiber = numVal($("#pFiber").value);
  settings.sodium = numVal($("#pSodium").value);
  settings.water = numVal($("#pWater").value);

  settings.trainingDelta = numVal($("#pTrainingDelta").value);
  settings.restDelta = numVal($("#pRestDelta").value);

  lsSet(K_SETTINGS, settings);
}

function setupSettingsHandlers(){
  const live = [
    "#pSex","#pAge","#pHeight","#pWeight","#pActivity","#pGoal","#pRate",
    "#pProtKg","#pFatKg","#pFiber","#pSodium","#pWater","#pTrainingDelta","#pRestDelta"
  ];

  live.forEach(sel=>{
    $(sel)?.addEventListener("input", ()=>{
      readSettingsInputs();
      renderCalculator();
      renderHome();
    });
  });

  $("#btnApplyCalculator")?.addEventListener("click", ()=>{
    readSettingsInputs();
    if(!(settings.age>0 && settings.height>0 && settings.weight>0)){
      alert("Remplis au minimum âge / taille / poids.");
      return;
    }
    const out = calcTargetsFromInputs(settings);

    settings.kcal = Math.round(out.targetKcal);
    settings.p    = Math.round(out.protG);
    settings.f    = Math.round(out.fatG);
    settings.c    = Math.round(out.carbG);

    lsSet(K_SETTINGS, settings);
    renderAll();
    alert("Objectifs mis à jour ✅");
  });

  $("#btnResetSettings")?.addEventListener("click", ()=>{
    settings = structuredClone(defaultSettings);
    lsSet(K_SETTINGS, settings);
    renderAll();
  });
}

/* ============================================================
   FOODS
============================================================ */
function seedFoodsStarter(){
  const starter = [
    {name:"Pomme",category:"Fruit",kcal100:52,p100:0.3,g100:14,l100:0.2,portionGrams:180},
    {name:"Banane",category:"Fruit",kcal100:89,p100:1.1,g100:23,l100:0.3,portionGrams:120},
    {name:"Orange",category:"Fruit",kcal100:47,p100:0.9,g100:12,l100:0.1,portionGrams:180},
    {name:"Brocoli",category:"Légume",kcal100:34,p100:2.8,g100:7,l100:0.4,portionGrams:250},
    {name:"Épinards",category:"Légume",kcal100:23,p100:2.9,g100:3.6,l100:0.4,portionGrams:200},
    {name:"Riz (cuit)",category:"Glucide",kcal100:130,p100:2.4,g100:28,l100:0.3,portionGrams:250},
    {name:"Pâtes (cuites)",category:"Glucide",kcal100:150,p100:5,g100:30,l100:1,portionGrams:250},
    {name:"Poulet (blanc cuit)",category:"Viande",kcal100:165,p100:31,g100:0,l100:3.6,portionGrams:200},
    {name:"Skyr nature",category:"Laitier",kcal100:60,p100:11,g100:4,l100:0.2,portionGrams:300},
    {name:"Huile d'olive",category:"Lipide",kcal100:884,p100:0,g100:0,l100:100,portionGrams:10}
  ];

  for(const s of starter){
    if(findFoodByName(s.name)) continue;
    foods.push({ id:uid(), favorite:false, ...s });
  }
  lsSet(K_FOODS, foods);
}

function renderFoodsDatalist(){
  const dl = $("#foodsDatalist");
  if(!dl) return;
  dl.innerHTML = "";
  const sorted = [...foods].sort((a,b)=> a.name.localeCompare(b.name));
  for(const f of sorted){
    const opt = document.createElement("option");
    opt.value = f.name;
    dl.appendChild(opt);
  }
}

function getFoodsFiltered(){
  const term = ($("#foodSearch")?.value||"").trim().toLowerCase();
  const catValue = ($("#foodCatFilter")?.value || "__all__");
  const sort = $("#foodSort")?.value || "fav";

  let arr = foods.filter(f=>{
    const okTerm = !term || f.name.toLowerCase().includes(term);
    const okCat = (catValue === "__all__") || ((f.category || "") === catValue);
    return okTerm && okCat;
  });

  if(sort === "fav"){
    arr.sort((a,b)=> (Number(!!b.favorite)-Number(!!a.favorite)) || a.name.localeCompare(b.name));
  }else{
    arr.sort((a,b)=> a.name.localeCompare(b.name));
  }
  return arr;
}

function renderFoodsTable(){
  const tb = $("#foodsTable tbody");
  if(!tb) return;
  tb.innerHTML = "";

  for(const f of getFoodsFiltered()){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><button class="starBtn ${f.favorite ? "is-on":""}" data-star="${f.id}">${f.favorite ? "⭐" : "☆"}</button></td>
      <td>${escapeHtml(f.name)}</td>
      <td>${escapeHtml(f.category||"")}</td>
      <td>${round1(f.kcal100)}</td>
      <td>${round1(f.p100)}</td>
      <td>${round1(f.g100)}</td>
      <td>${round1(f.l100)}</td>
      <td>${f.portionGrams ? (round1(f.portionGrams) + " g") : "—"}</td>
      <td><button class="badgeDel" data-del-food="${f.id}">Supprimer</button></td>
    `;
    tb.appendChild(tr);
  }

  $$("[data-del-food]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.dataset.delFood;
      foods = foods.filter(x=>x.id!==id);
      lsSet(K_FOODS, foods);
      renderAll();
    });
  });

  $$("[data-star]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.dataset.star;
      const f = foods.find(x=>x.id===id);
      if(!f) return;
      f.favorite = !f.favorite;
      lsSet(K_FOODS, foods);
      renderAll();
    });
  });
}

function setupFoodHandlers(){
  $("#foodForm")?.addEventListener("submit", (e)=>{
    e.preventDefault();

    const name = $("#fName").value.trim();
    if(!name){ alert("Nom aliment manquant."); return; }
    if(findFoodByName(name)){ alert("Cet aliment existe déjà."); return; }

    const catSel = $("#fCatSelect").value;
    const catCustom = ($("#fCatCustom").value || "").trim();
    const category = (catSel === "Autre") ? catCustom : catSel;

    if(catSel === "Autre" && !category){
      alert("Écris une catégorie pour 'Autre'.");
      return;
    }

    const item = {
      id: uid(),
      favorite: false,
      name,
      category,
      kcal100: numVal($("#fKcal").value),
      p100: numVal($("#fP").value),
      g100: numVal($("#fC").value),
      l100: numVal($("#fF").value),
      portionGrams: numVal($("#fPortion").value) || 0
    };

    foods.push(item);
    lsSet(K_FOODS, foods);

    $("#foodForm").reset();
    $("#fCatSelect").value = "Laitier";
    $("#fCatCustomWrap").style.display = "none";
    $("#fCatCustom").value = "";

    renderAll();
  });

  $("#btnSeed")?.addEventListener("click", ()=>{
    seedFoodsStarter();
    renderAll();
    alert("Base starter ajoutée ✅");
  });

  $("#btnClearFoods")?.addEventListener("click", ()=>{
    if(!confirm("Vider la base aliments ?")) return;
    foods = [];
    lsSet(K_FOODS, foods);
    renderAll();
  });

  ["#foodSearch","#foodCatFilter","#foodSort"].forEach(sel=>{
    $(sel)?.addEventListener("input", renderFoodsTable);
    $(sel)?.addEventListener("change", renderFoodsTable);
  });
}

/* ============================================================
   LOG
============================================================ */
function inRangeByDays(dateISO, days){
  if(!days || days<=0) return true;
  return dateISO >= daysBackISO(days-1);
}

function renderLogGrouped(){
  const root = $("#logGrouped");
  if(!root) return;
  root.innerHTML = "";

  const term = ($("#logSearch").value||"").trim().toLowerCase();
  const range = numVal($("#logRange").value);

  let items = log.filter(it => inRangeByDays(it.date, range));
  if(term){
    items = items.filter(it =>
      it.date.toLowerCase().includes(term) ||
      (it.meal||"").toLowerCase().includes(term) ||
      (it.foodName||"").toLowerCase().includes(term) ||
      (it.note||"").toLowerCase().includes(term)
    );
  }

  const byDate = new Map();
  for(const it of items){
    if(!byDate.has(it.date)) byDate.set(it.date, []);
    byDate.get(it.date).push(it);
  }
  const dates = Array.from(byDate.keys()).sort((a,b)=> b.localeCompare(a));

  if(dates.length === 0){
    root.innerHTML = `<div class="hint">Aucune donnée sur cette période.</div>`;
    return;
  }

  const mealsOrder = ["Petit-déjeuner","Déjeuner","Dîner","Collation"];

  for(const d of dates){
    const block = document.createElement("div");
    block.className = "logDate";

    const totalDay = totalsForDate(d);

    block.innerHTML = `
      <div class="logDate__title">
        <div>${escapeHtml(d)}</div>
        <div class="hint">Total: ${fmt0(totalDay.kcal)} kcal · P ${fmt0(totalDay.p)} · G ${fmt0(totalDay.c)} · L ${fmt0(totalDay.f)}</div>
      </div>
    `;

    const itemsDate = byDate.get(d);
    const byMeal = new Map();
    for(const it of itemsDate){
      if(!byMeal.has(it.meal)) byMeal.set(it.meal, []);
      byMeal.get(it.meal).push(it);
    }

    for(const meal of mealsOrder){
      if(!byMeal.has(meal)) continue;
      const arr = byMeal.get(meal);

      let kcal=0,p=0,c=0,f=0;
      for(const it of arr){
        const food = findFoodByName(it.foodName);
        if(!food) continue;
        const m = macrosForItem(food, it.grams);
        kcal+=m.kcal; p+=m.p; c+=m.c; f+=m.f;
      }

      const mealEl = document.createElement("div");
      mealEl.className = "mealBlock";
      mealEl.innerHTML = `
        <div class="mealHead">
          <div>${escapeHtml(meal)} <small>— ${fmt0(kcal)} kcal</small></div>
          <div class="hint">P ${fmt0(p)} · G ${fmt0(c)} · L ${fmt0(f)}</div>
        </div>
        <div class="mealItems tableWrap">
          <table class="table">
            <thead>
              <tr>
                <th>Aliment</th><th>g</th><th>kcal</th><th>P</th><th>G</th><th>L</th><th>Note</th><th></th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
      `;

      const tbody = mealEl.querySelector("tbody");
      for(const it of arr){
        const food = findFoodByName(it.foodName);
        const m = food ? macrosForItem(food, it.grams) : {kcal:0,p:0,c:0,f:0};
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${escapeHtml(it.foodName)}</td>
          <td>${round1(it.grams)}</td>
          <td>${round1(m.kcal)}</td>
          <td>${round1(m.p)}</td>
          <td>${round1(m.c)}</td>
          <td>${round1(m.f)}</td>
          <td>${escapeHtml(it.note||"")}</td>
          <td><button class="badgeDel" data-del-meal="${it.id}">Supprimer</button></td>
        `;
        tbody.appendChild(tr);
      }

      block.appendChild(mealEl);
    }

    root.appendChild(block);
  }

  $$("[data-del-meal]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.dataset.delMeal;
      log = log.filter(x=>x.id!==id);
      lsSet(K_LOG, log);
      renderAll();
    });
  });
}

function setupLogHandlers(){
  $("#btnClearMeals")?.addEventListener("click", ()=>{
    if(!confirm("Vider le journal repas ?")) return;
    log = [];
    lsSet(K_LOG, log);
    renderAll();
  });

  ["#logSearch","#logRange"].forEach(sel=>{
    $(sel)?.addEventListener("input", renderLogGrouped);
    $(sel)?.addEventListener("change", renderLogGrouped);
  });
}

/* ============================================================
   CHARTS (responsive canvas)
============================================================ */
function movingAverage(values, windowSize){
  const w = Number(windowSize||0);
  if(!w || w<=1) return values;
  const out = [];
  for(let i=0;i<values.length;i++){
    const a = Math.max(0, i-w+1);
    const slice = values.slice(a, i+1);
    const avg = slice.reduce((s,x)=>s+x,0) / slice.length;
    out.push(avg);
  }
  return out;
}

function setCanvasSize(canvas){
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(320, Math.floor(rect.width * dpr));
  const h = Math.max(220, Math.floor(rect.height * dpr));
  canvas.width = w;
  canvas.height = h;
  return {W:w, H:h, dpr};
}

function drawLineChart(canvas, labels, values, opts){
  if(!canvas) return;
  const {W, H} = setCanvasSize(canvas);
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0,0,W,H);

  ctx.fillStyle = "rgba(0,0,0,0.10)";
  ctx.fillRect(0,0,W,H);

  const padL = 56, padR = 18, padT = 22, padB = 36;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const minV = Math.min(...values, 0);
  const maxV = Math.max(...values, 1);
  const lo = (opts && Number.isFinite(opts.min)) ? opts.min : minV;
  const hi = (opts && Number.isFinite(opts.max)) ? opts.max : maxV;
  const range = Math.max(1e-9, hi - lo);

  // grid
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  for(let i=0;i<=4;i++){
    const y = padT + (plotH * i/4);
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(padL+plotW, y);
    ctx.stroke();
  }

  // title
  ctx.fillStyle = "rgba(226,232,240,0.85)";
  ctx.font = "900 14px ui-sans-serif, system-ui, -apple-system, Segoe UI";
  ctx.fillText(opts?.title || "", padL, 16);

  const n = values.length;
  if(n <= 1){
    ctx.fillText("Pas assez de données", padL, padT + 24);
    return;
  }

  // line
  ctx.strokeStyle = "rgba(59,130,246,0.95)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for(let i=0;i<n;i++){
    const x = padL + (plotW * (i/(n-1)));
    const y = padT + plotH * (1 - ((values[i]-lo)/range));
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.stroke();

  // points
  ctx.fillStyle = "rgba(226,232,240,0.9)";
  for(let i=0;i<n;i++){
    const x = padL + (plotW * (i/(n-1)));
    const y = padT + plotH * (1 - ((values[i]-lo)/range));
    ctx.beginPath();
    ctx.arc(x,y,3.0,0,Math.PI*2);
    ctx.fill();
  }

  // labels bottom
  ctx.fillStyle = "rgba(148,163,184,0.9)";
  ctx.font = "900 12px ui-sans-serif, system-ui, -apple-system, Segoe UI";
  const idxMid = Math.floor((n-1)/2);
  ctx.fillText(labels[0] || "", padL, H-12);
  ctx.fillText(labels[idxMid] || "", padL + plotW/2 - 18, H-12);
  ctx.fillText(labels[n-1] || "", padL + plotW - 38, H-12);

  // y labels
  ctx.fillText(String(Math.round(hi)), 8, padT+12);
  ctx.fillText(String(Math.round(lo)), 8, padT+plotH);
}

function seriesForLastDays(days){
  const labels = [];
  const valuesK = [], valuesP=[], valuesC=[], valuesF=[];
  for(let i=days-1;i>=0;i--){
    const d = daysBackISO(i);
    labels.push(d.slice(5));
    const t = totalsForDate(d);
    valuesK.push(t.kcal);
    valuesP.push(t.p);
    valuesC.push(t.c);
    valuesF.push(t.f);
  }
  return {labels, valuesK, valuesP, valuesC, valuesF};
}

function renderWeightChart(){
  const canvas = $("#weightChart");
  const sorted = [...weights].sort((a,b)=> a.date.localeCompare(b.date));
  if(sorted.length === 0){
    drawLineChart(canvas, ["—"], [0], { title:"Poids (kg)" });
    return;
  }
  const slice = sorted.slice(Math.max(0, sorted.length-20));
  const labels = slice.map(x=> x.date.slice(5));
  const values = slice.map(x=> numVal(x.kg||0));
  drawLineChart(canvas, labels, values, { title:"Poids (kg)" });
}

function renderWeightsTable(){
  const tb = $("#weightsTable tbody");
  if(!tb) return;
  tb.innerHTML = "";

  const sorted = [...weights].sort((a,b)=> b.date.localeCompare(a.date));
  for(const w of sorted){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(w.date)}</td>
      <td>${round1(w.kg)} kg</td>
      <td><button class="badgeDel" data-del-weight="${w.id}">Supprimer</button></td>
    `;
    tb.appendChild(tr);
  }

  $$("[data-del-weight]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.dataset.delWeight;
      weights = weights.filter(x=>x.id!==id);
      lsSet(K_WEIGHTS, weights);
      renderCharts();
    });
  });
}

function renderCharts(){
  const days = numVal($("#statsRange")?.value) || 30;
  const metric = $("#statsMetric")?.value || "kcal";
  const smooth = numVal($("#statsSmooth")?.value) || 0;

  const {labels, valuesK, valuesP, valuesC, valuesF} = seriesForLastDays(days);

  let values = valuesK;
  let title = "Calories (kcal)";
  if(metric==="p"){ values = valuesP; title = "Protéines (g)"; }
  if(metric==="c"){ values = valuesC; title = "Glucides (g)"; }
  if(metric==="f"){ values = valuesF; title = "Lipides (g)"; }

  values = movingAverage(values, smooth);

  drawLineChart($("#macroChart"), labels, values, { title });

  const hint = $("#macroChartHint");
  if(hint){
    hint.textContent = `Fenêtre: ${days} jours · Lissage: ${smooth ? (smooth+" jours") : "aucun"} · Source: Journal repas`;
  }

  renderWeightsTable();
  renderWeightChart();
}

/* ============================================================
   WEIGHTS
============================================================ */
function setupWeightsHandlers(){
  const wDate = $("#wDate");
  const wKg = $("#wKg");

  if(wDate) wDate.value = todayISO();

  $("#weightForm")?.addEventListener("submit", (e)=>{
    e.preventDefault();
    const date = wDate?.value || todayISO();
    const kg = numVal(wKg?.value);
    if(!(kg>0)){ alert("Poids invalide."); return; }

    weights.push({ id:uid(), date, kg });
    lsSet(K_WEIGHTS, weights);

    if(wKg) wKg.value = "";
    renderCharts();
  });

  $("#btnClearWeights")?.addEventListener("click", ()=>{
    if(!confirm("Vider l'historique de poids ?")) return;
    weights = [];
    lsSet(K_WEIGHTS, weights);
    renderCharts();
  });

  $("#btnRefreshCharts")?.addEventListener("click", renderCharts);
  $("#statsRange")?.addEventListener("change", renderCharts);
  $("#statsMetric")?.addEventListener("change", renderCharts);
  $("#statsSmooth")?.addEventListener("change", renderCharts);

  // critical: resize charts on iPhone rotation / address bar changes
  window.addEventListener("resize", ()=>{
    if($("#tab-stats")?.classList.contains("is-active")) renderCharts();
  });
  window.addEventListener("orientationchange", ()=>{
    setTimeout(()=>{
      if($("#tab-stats")?.classList.contains("is-active")) renderCharts();
    }, 200);
  });
}

/* ============================================================
   SPLASH
============================================================ */
function hideSplash(){
  const splash = $("#splash");
  if(!splash) return;

  setTimeout(()=>{
    splash.style.opacity = "0";
    splash.style.pointerEvents = "none";
    setTimeout(()=> splash.remove(), 250);
  }, 1000);
}

/* ============================================================
   INIT + RENDER ALL
============================================================ */
function renderAll(){
  if(!foods || foods.length === 0){
    foods = [];
    seedFoodsStarter();
  }

  const homeDate = $("#homeDate");
  if(homeDate) homeDate.value = homeDate.value || todayISO();

  updateHomeDateUI();
  renderCalculator();
  renderFoodsDatalist();
  renderFoodsTable();
  renderLogGrouped();
  renderHome();

  // if already on stats tab, refresh
  if($("#tab-stats")?.classList.contains("is-active")) renderCharts();
}

function init(){
  setupTabs();
  fillCategorySelects();
  setupCategoryBehavior();

  setupHomeHandlers();
  setupSettingsHandlers();
  setupFoodHandlers();
  setupLogHandlers();
  setupWeightsHandlers();
  setupFoodAutocomplete();

  renderAll();
  activateTab("home");
  hideSplash();
}

document.addEventListener("DOMContentLoaded", init);
