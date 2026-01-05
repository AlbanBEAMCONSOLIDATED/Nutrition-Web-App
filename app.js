"use strict";

/* =========================================================
   Nutrition-Track — Single page "premium" settings → plan
   Vanilla JS, no deps.
========================================================= */

const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

// v5: defaults protéines revus + tour revient au début + UI "Plan du jour"
const LS_KEY = "nt_state_v5";
const TOUR_KEY = "nt_tour_done_v1";

const els = {
  modeSimple: $("#modeSimple"),
  modeAdvanced: $("#modeAdvanced"),
  stepper: $("#stepper"),
  stepMeta: $("#stepMeta"),
  panels: $$(".step-panel"),
  steps: $$(".step", $("#stepper")),
  backBtn: $("#backBtn"),
  nextBtn: $("#nextBtn"),
  resetBtn: $("#resetBtn"),

  sexControl: $("#sexControl"),
  age: $("#age"),
  height: $("#height"),
  weight: $("#weight"),

  activityCards: $("#activityCards"),
  goalCards: $("#goalCards"),

  paceWrap: $("#paceWrap"),
  pace: $("#pace"),
  paceValue: $("#paceValue"),
  paceHint: $("#paceHint"),

  collapse: $("#advancedCollapse"),
  collapseBtn: $("#collapseBtn"),
  collapseBody: $("#collapseBody"),

  carbProfileControl: $("#carbProfileControl"),
  proteinPerKg: $("#proteinPerKg"),
  fatMinPerKg: $("#fatMinPerKg"),
  carbMinPerKg: $("#carbMinPerKg"),
  fiber: $("#fiber"),
  water: $("#water"),
  sodium: $("#sodium"),

  resultCard: $("#resultCard"),
  kcalValue: $("#kcalValue"),
  chipTdee: $("#chipTdee"),
  chipDelta: $("#chipDelta"),
  pVal: $("#pVal"), fVal: $("#fVal"), cVal: $("#cVal"),
  cPct: $("#cPct"),
  fPct: $("#fPct"),
  pPct: $("#pPct"),
  pBar: $("#pBar"), fBar: $("#fBar"), cBar: $("#cBar"),
  waterVal: $("#waterVal"),
  fiberVal: $("#fiberVal"),
  sodiumVal: $("#sodiumVal"),
  alerts: $("#alerts"),
  cohValue: $("#cohValue"),
  cohRing: $("#cohRing"),

  sheetToggle: $("#sheetToggle"),

  todoKcal: $("#todoKcal"),

  todoP: $("#todoP"),

  todoWater: $("#todoWater"),

  todoFiber: $("#todoFiber"),

  copyPlanBtn: $("#copyPlanBtn"),

  sharePlanBtn: $("#sharePlanBtn"),

  setDailyBtn: $("#setDailyBtn"),

  toast: $("#toast"),

  toastText: $("#toastText"),

  legalMore: $("#legalMore"),

  legalModal: $("#legalModal"),

  legalClose: $("#legalClose"),
  legalOk: $("#legalOk"),

  legalOverlay: $("#legalOverlay"),

  scoreBtn: $("#scoreBtn"),

  scorePopover: $("#scorePopover"),

  scoreList: $("#scoreList"),

  scoreHint: $("#scoreHint"),

  dailyChip: $("#dailyChip"),

  exportBtn: $("#exportBtn"),
  importBtn: $("#importBtn"),
  importFile: $("#importFile"),

  startTourBtn: $("#startTourBtn"),

  tour: $("#tour"),
  tourOverlay: $("#tourOverlay"),
  tourBubble: $("#tourBubble"),
  tourTitle: $("#tourTitle"),
  tourText: $("#tourText"),
  tourBack: $("#tourBack"),
  tourNext: $("#tourNext"),
  tourSkip: $("#tourSkip"),
  tourDots: $("#tourDots"),
  tourSpot: $("#tourSpot"),
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const round = (v) => Math.round(v);
const fmt = (v) => (Number.isFinite(v) ? String(v) : "—");
const fmtKcal = (v) => (Number.isFinite(v) ? round(v).toString() : "—");

function isReducedMotion(){
  return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/* ----------------------------- State ----------------------------- */

let state = {
  mode: "simple", // simple | advanced
  step: 0,

  sex: null, // male | female
  age: null,
  height: null,
  weight: null,

  activity: null, // factor
  goal: null,     // cut | maintain | bulk
  pace: 0.5,      // kg/sem for cut/bulk

  advancedOpen: false,
  carbProfile: "balanced", // low | balanced | high

  proteinPerKg: null,
  fatMinPerKg: null,
  carbMinPerKg: null,

  fiber: null,   // g
  water: null,   // L
  sodium: null,  // mg
};

/* ----------------------------- Defaults ----------------------------- */

function defaultsFor(goal, sex, weight){
  // weight may be null; we still return sane defaults
  const w = Number(weight) || 80;

  // Base cohérente (durable + performante) — ajustable en Avancé
  // - Protéines (g/kg): plus haut en sèche pour préserver la masse maigre
  // - Lipides min (g/kg): garde-fou hormonal/satiété (on évite trop bas)
  // - Glucides min (g/kg): garde-fou perf/humeur (surtout si tu t’entraînes)
  let protein = 1.5;
  let fatMin = 0.7;
  let carbMin = 1.2;

  if(goal === "cut"){
    protein = 1.6;
    fatMin = 0.7;
    carbMin = 1.0;
  }else if(goal === "maintain"){
    protein = 1.5;
    fatMin = 0.7;
    carbMin = 1.2;
  }else if(goal === "bulk"){
    protein = 1.5;
    fatMin = 0.7;
    carbMin = 1.5;
  }

  // Fiber & water are "nice defaults"
  const fiber = (sex === "female") ? 25 : 30;
  const water = clamp((w * 0.035), 2.0, 6.0); // 35 ml/kg
  const sodium = 2500;

  return {
    proteinPerKg: protein,
    fatMinPerKg: fatMin,
    carbMinPerKg: carbMin,
    fiber,
    water: Math.round(water * 10)/10,
    sodium
  };
}

function applyAutoDefaultsIfMissing(){
  if(!state.goal) return;
  const d = defaultsFor(state.goal, state.sex, state.weight);

  if(state.proteinPerKg == null) state.proteinPerKg = d.proteinPerKg;
  if(state.fatMinPerKg == null) state.fatMinPerKg = d.fatMinPerKg;
  if(state.carbMinPerKg == null) state.carbMinPerKg = d.carbMinPerKg;
  if(state.fiber == null) state.fiber = d.fiber;
  if(state.water == null) state.water = d.water;
  if(state.sodium == null) state.sodium = d.sodium;
}

/* ----------------------------- Persistence ----------------------------- */

function save(){
  try{
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  }catch(_){}
}
function load(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(!raw) return;
    const s = JSON.parse(raw);
    state = {...state, ...s};
  }catch(_){}
}

/* ----------------------------- UI helpers ----------------------------- */

function setActiveSeg(controlEl, value){
  $$(".seg", controlEl).forEach(btn => {
    btn.classList.toggle("active", btn.dataset.value === value);
  });
}
function setSelectedOption(containerEl, predicate){
  $$(".option", containerEl).forEach(btn => {
    btn.classList.toggle("selected", predicate(btn));
  });
}

function showPanel(step){
  state.step = clamp(step, 0, 3);
  els.panels.forEach(p => p.classList.toggle("hidden", p.dataset.panel !== String(state.step)));

  els.steps.forEach(s => {
    const i = Number(s.dataset.step);
    s.classList.toggle("active", i === state.step);
    s.classList.toggle("done", i < state.step);
  });

  els.backBtn.disabled = (state.step === 0);
  els.nextBtn.textContent = (state.step === 3) ? "Terminé" : "Suivant";

  if(els.stepMeta){
    const totalSteps = 4;
    const pct = Math.round(((state.step + 1) / totalSteps) * 100);
    const remaining = (totalSteps - 1) - state.step;
    const micro = remaining > 0 ? `Encore ${remaining} étape${remaining>1?"s":""} → ton plan est prêt.` : `Plan prêt. Tu peux ajuster si besoin.`;
    els.stepMeta.textContent = `Étape ${state.step + 1}/${totalSteps} — ${pct}% • ${micro}`;
  }

  // In Simple mode, keep Adjust step available but collapse closed
  if(state.mode === "simple"){
    els.collapse.classList.remove("open");
    els.collapseBody.style.display = "none";
  }else{
    els.collapseBody.style.display = "";
    els.collapse.classList.toggle("open", !!state.advancedOpen);
    if(!state.advancedOpen) els.collapseBody.style.display = "none";
  }

  // Scroll nicely (desktop)
  if(!isReducedMotion()){
    window.scrollTo({top: 0, behavior: "smooth"});
  }else{
    window.scrollTo(0,0);
  }

  save();
}

function setMode(mode){
  state.mode = mode;
  els.modeSimple.classList.toggle("active", mode === "simple");
  els.modeAdvanced.classList.toggle("active", mode === "advanced");

  // When switching to simple, close advanced block
  if(mode === "simple"){
    state.advancedOpen = false;
  }
  save();
  render();
  renderDailyChip();
  showPanel(state.step);
}

/* ----------------------------- Validation ----------------------------- */

function setError(key, msg){
  const el = $(`[data-error-for="${key}"]`);
  if(el) el.textContent = msg || "";
}
function clearErrors(){
  ["sex","age","height","weight","activity","goal"].forEach(k => setError(k,""));
}

function numVal(inputEl){
  const v = Number(inputEl.value);
  return Number.isFinite(v) ? v : null;
}

function validateCore(){
  clearErrors();

  let ok = true;

  if(state.sex !== "male" && state.sex !== "female"){
    setError("sex","Choisis Homme ou Femme.");
    ok = false;
  }

  const age = Number(state.age);
  if(!Number.isFinite(age) || age < 10 || age > 90){
    setError("age","Âge: 10–90.");
    ok = false;
  }

  const h = Number(state.height);
  if(!Number.isFinite(h) || h < 120 || h > 220){
    setError("height","Taille: 120–220.");
    ok = false;
  }

  const w = Number(state.weight);
  if(!Number.isFinite(w) || w < 35 || w > 250){
    setError("weight","Poids: 35–250.");
    ok = false;
  }

  const a = Number(state.activity);
  if(!Number.isFinite(a)){
    setError("activity","Choisis ton activité.");
    ok = false;
  }

  if(!state.goal){
    setError("goal","Choisis un objectif.");
    ok = false;
  }

  return ok;
}

function canGoNext(){
  // progressive validation by step
  clearErrors();
  if(state.step === 0){
    let ok=true;
    if(state.sex !== "male" && state.sex !== "female"){ setError("sex","Choisis Homme ou Femme."); ok=false; }
    const age = Number(state.age);
    if(!Number.isFinite(age) || age < 10 || age > 90){ setError("age","Âge: 10–90."); ok=false; }
    const h = Number(state.height);
    if(!Number.isFinite(h) || h < 120 || h > 220){ setError("height","Taille: 120–220."); ok=false; }
    const w = Number(state.weight);
    if(!Number.isFinite(w) || w < 35 || w > 250){ setError("weight","Poids: 35–250."); ok=false; }
    return ok;
  }
  if(state.step === 1){
    const a = Number(state.activity);
    if(!Number.isFinite(a)){ setError("activity","Choisis ton activité."); return false; }
    return true;
  }
  if(state.step === 2){
    if(!state.goal){ setError("goal","Choisis un objectif."); return false; }
    if(state.goal !== "maintain"){
      const p = Number(state.pace);
      if(!Number.isFinite(p) || p <= 0){ setError("goal","Choisis un rythme."); return false; }
    }
    return true;
  }
  return true;
}

/* ----------------------------- Math engine ----------------------------- */

function calcPlan(){
  if(!validateCore()) return null;

  const sex = state.sex;
  const age = Number(state.age);
  const h = Number(state.height);
  const w = Number(state.weight);
  const pal = Number(state.activity);

  // Mifflin-St Jeor
  const bmr = (sex === "male")
    ? (10*w + 6.25*h - 5*age + 5)
    : (10*w + 6.25*h - 5*age - 161);

  const tdee = bmr * pal;

  // Goal delta
  let delta = 0; // kcal/day
  if(state.goal === "cut"){
    delta = -(Number(state.pace) * 7700 / 7);
  }else if(state.goal === "bulk"){
    delta = +(Number(state.pace) * 7700 / 7);
  }else{
    delta = 0;
  }

  // Round target early so macros can match the displayed kcal cleanly.
  const target = Math.round(tdee + delta);

  // Advanced defaults
  applyAutoDefaultsIfMissing();

  // In Simple mode, we enforce defaults (but still stored)
  const d = defaultsFor(state.goal, state.sex, state.weight);

  // Read user settings (advanced) or defaults (simple), then clamp to sane ranges.
  const proteinPerKgRaw = (state.mode === "simple") ? d.proteinPerKg : Number(state.proteinPerKg);
  const fatMinPerKgRaw  = (state.mode === "simple") ? d.fatMinPerKg  : Number(state.fatMinPerKg);
  const carbMinPerKgRaw = (state.mode === "simple") ? d.carbMinPerKg : Number(state.carbMinPerKg);

  const proteinPerKg = clamp(proteinPerKgRaw, 1.2, 3.0);
  const fatMinPerKg  = clamp(fatMinPerKgRaw, 0.4, 1.4);
  const carbMinPerKg = clamp(carbMinPerKgRaw, 0.0, 4.0);

  const fiber = (state.mode === "simple") ? d.fiber : Number(state.fiber);
  const water = (state.mode === "simple") ? d.water : Number(state.water);
  const sodium = (state.mode === "simple") ? d.sodium : Number(state.sodium);

  // Carb profile adjusts the *fat target* a bit (keeps look & feel "coach"),
  // BUT we always compute carbs as the remainder so kcal stay consistent.
  // (Low carbs → a bit more fat; High carbs → fat closer to the minimum.)
  let fatPerKgTarget = fatMinPerKg;
  if(state.carbProfile === "balanced") fatPerKgTarget = fatMinPerKg + 0.10;
  if(state.carbProfile === "low") fatPerKgTarget = fatMinPerKg + 0.25;
  if(state.carbProfile === "high") fatPerKgTarget = fatMinPerKg;

  // FLOATS first (to avoid rounding drift), then reconcile carbs last.
  let proteinGf = w * proteinPerKg;
  let fatGf = w * fatPerKgTarget;
  const fatGMinF = w * fatMinPerKg;
  if(fatGf < fatGMinF) fatGf = fatGMinF;

  // initial carbs (float)
  let carbGf = (target - (proteinGf*4) - (fatGf*9)) / 4;
  if(!Number.isFinite(carbGf)) carbGf = 0;
  carbGf = Math.max(0, carbGf);

  // If carbs are below the chosen minimum, try lowering fat down to its minimum.
  const carbMinGF = w * carbMinPerKg;
  if(carbGf < carbMinGF){
    fatGf = fatGMinF; // lowest we allow
    carbGf = (target - (proteinGf*4) - (fatGf*9)) / 4;
    carbGf = Math.max(0, Number.isFinite(carbGf) ? carbGf : 0);
  }

  // Round protein/fat, then set carbs as the exact remainder (best coherence).
  let proteinG = Math.round(proteinGf);
  let fatG = Math.round(fatGf);
  let carbG = Math.max(0, Math.round((target - proteinG*4 - fatG*9) / 4));

  // Enforce integer carb minimum if possible by reducing fat (down to min).
  const fatGMin = Math.round(fatGMinF);
  const carbMinG = Math.round(carbMinGF);
  if(carbG < carbMinG && fatG > fatGMin){
    const needCarbG = carbMinG - carbG;
    const needKcal = needCarbG * 4;
    const reducibleFatG = fatG - fatGMin;
    const reduceFatG = Math.min(reducibleFatG, Math.ceil(needKcal / 9));
    fatG -= reduceFatG;
    carbG = Math.max(0, Math.round((target - proteinG*4 - fatG*9) / 4));
  }

  // coherence score
  const coherence = computeCoherence({bmr, tdee, delta, target, proteinPerKg, fatMinPerKg, carbMinPerKg});

  // warnings
  const warnings = [];

  // If we still can't satisfy minimums, warn clearly (the kcal target is too low).
  if(carbG < carbMinG){
    warnings.push({type:"info", text:"Glucides sous ton minimum configuré (calories trop basses pour respecter tous les minimums)."});
  }
  if(state.goal === "cut" && Math.abs(delta) > 1000){
    warnings.push({type:"warn", text:"Déficit agressif (> 1000 kcal/j). Plus dur à tenir — surveille énergie, sommeil, faim."});
  }
  if(state.goal === "bulk" && delta > 600){
    warnings.push({type:"info", text:"Surplus élevé. Si tu prends trop vite, baisse le rythme pour limiter le gras."});
  }
  if(target < bmr){
    warnings.push({type:"warn", text:"Ta cible est sous ton BMR (très bas). Ajuste le rythme ou l’activité estimée."});
  }
  if(target < 1200){
    warnings.push({type:"warn", text:"Cible très basse (< 1200 kcal/j). Ce n'est généralement pas durable."});
  }

  return {
    bmr, tdee, delta, target,
    proteinG, fatG, carbG,
    fiber, water, sodium,
    coherence,
    warnings
  };
}

function computeCoherence({bmr, tdee, delta, target, proteinPerKg, fatMinPerKg, carbMinPerKg}){
  let score = 100;

  // deficit/surplus sanity
  if(delta < 0){
    const def = Math.abs(delta);
    if(def > 1100) score -= 35;
    else if(def > 900) score -= 18;
    // Très lent (ex: 0.10 kg/sem) = OK, juste moins "impact".
    else if(def < 60) score -= 12;
    else if(def < 120) score -= 6;
  }else if(delta > 0){
    if(delta > 650) score -= 25;
    else if(delta > 500) score -= 12;
    else if(delta < 80) score -= 10;
  }

  // protein/fat floors
  if(proteinPerKg < 1.6) score -= 18;
  if(proteinPerKg > 2.8) score -= 6;

  if(fatMinPerKg < 0.6) score -= 20;
  if(fatMinPerKg > 1.3) score -= 6;

  if(carbMinPerKg < 0.5) score -= 6;

  if(target < bmr) score -= 25;

  return clamp(score, 0, 100);
}

/* ----------------------------- Rendering ----------------------------- */

let lastNumbers = {kcal:null, p:null, f:null, c:null, coh:null};

function animateNumber(el, from, to, ms=260, formatter=(x)=>String(Math.round(x))){
  if(isReducedMotion() || from == null || !Number.isFinite(from) || !Number.isFinite(to)){
    el.textContent = formatter(to);
    return;
  }
  const start = performance.now();
  const diff = to - from;
  const ease = (t)=> (t<0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2);
  function frame(now){
    const t = clamp((now - start)/ms, 0, 1);
    const v = from + diff * ease(t);
    el.textContent = formatter(v);
    if(t < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function render(){
  // mode buttons
  els.modeSimple.classList.toggle("active", state.mode === "simple");
  els.modeAdvanced.classList.toggle("active", state.mode === "advanced");

  // segmented
  if(state.sex) setActiveSeg(els.sexControl, state.sex);
  setActiveSeg(els.carbProfileControl, state.carbProfile);

  // values
  els.age.value = state.age ?? "";
  els.height.value = state.height ?? "";
  els.weight.value = state.weight ?? "";

  // activity & goal cards
  setSelectedOption(els.activityCards, btn => Number(btn.dataset.factor) === Number(state.activity));
  setSelectedOption(els.goalCards, btn => btn.dataset.goal === state.goal);

  // pace
  const showPace = (state.goal === "cut" || state.goal === "bulk");
  els.paceWrap.classList.toggle("hidden", !showPace);

  if(showPace){
    if(state.goal === "cut"){
      // Oui: tu peux faire une sèche à 0.10 kg/sem (très douce) — l'app ne doit pas te bloquer.
      els.pace.min = "0.10"; els.pace.max = "1.00"; els.pace.step = "0.05";
      if(Number(state.pace) < 0.10 || Number(state.pace) > 1.00) state.pace = 0.50;
      els.paceHint.textContent = "Sèche: 0.10–1.00 kg/sem (doux = facile, rapide = plus dur).";
    }else{
      els.pace.min = "0.10"; els.pace.max = "0.50"; els.pace.step = "0.05";
      if(Number(state.pace) < 0.10 || Number(state.pace) > 0.50) state.pace = 0.25;
      els.paceHint.textContent = "Masse: 0.10–0.50 kg/sem (lent = plus propre).";
    }
    els.pace.value = String(state.pace);
    els.paceValue.textContent = Number(state.pace).toFixed(2);
  }

  // advanced inputs
  applyAutoDefaultsIfMissing();
  els.proteinPerKg.value = (state.proteinPerKg ?? "").toString();
  els.fatMinPerKg.value = (state.fatMinPerKg ?? "").toString();
  els.carbMinPerKg.value = (state.carbMinPerKg ?? "").toString();
  els.fiber.value = (state.fiber ?? "").toString();
  els.water.value = (state.water ?? "").toString();
  els.sodium.value = (state.sodium ?? "").toString();

  // collapse
  if(state.mode === "simple"){
    els.collapse.classList.remove("open");
    els.collapseBody.style.display = "none";
  }else{
    els.collapse.classList.toggle("open", !!state.advancedOpen);
    els.collapseBody.style.display = state.advancedOpen ? "" : "none";
  }

  // compute & paint result
  const plan = calcPlan();
  if(!plan){
    els.kcalValue.textContent = "—";
    els.chipTdee.textContent = "TDEE —";
    els.chipDelta.textContent = "Δ —";
    els.pVal.textContent = "— g";
    els.fVal.textContent = "— g";
    els.cVal.textContent = "— g";
    els.pBar.style.width = "0%";
    els.fBar.style.width = "0%";
    els.cBar.style.width = "0%";
    els.waterVal.textContent = "—";
    els.fiberVal.textContent = "—";
    els.sodiumVal.textContent = "—";
    els.alerts.innerHTML = "";
    els.cohValue.textContent = "—";
    els.resultCard.classList.remove("visible");
    return;
  }

  // make visible when valid
  els.resultCard.classList.add("visible");

  // animated values
  animateNumber(els.kcalValue, lastNumbers.kcal, plan.target, 280, (x)=>Math.round(x).toString());
  lastNumbers.kcal = plan.target;

  els.chipTdee.textContent = `TDEE ${Math.round(plan.tdee)}`;
  const deltaSign = plan.delta >= 0 ? "+" : "−";
  const deltaAbs = Math.round(Math.abs(plan.delta));
  els.chipDelta.textContent = `Δ ${deltaSign}${deltaAbs}`;

  // deficit/surplus chip coloring
  els.chipDelta.classList.remove("aggressive");
  if(state.goal === "cut" && Math.abs(plan.delta) > 1000){
    els.chipDelta.classList.add("aggressive");
  }

  animateNumber(els.pVal, lastNumbers.p, plan.proteinG, 240, (x)=>`${Math.round(x)} g`);
  animateNumber(els.fVal, lastNumbers.f, plan.fatG, 240, (x)=>`${Math.round(x)} g`);
  animateNumber(els.cVal, lastNumbers.c, plan.carbG, 240, (x)=>`${Math.round(x)} g`);
  lastNumbers.p = plan.proteinG; lastNumbers.f = plan.fatG; lastNumbers.c = plan.carbG;

  // bars (relative: based on kcal share)
  const pk = plan.proteinG*4;
  const fk = plan.fatG*9;
  const ck = plan.carbG*4;
  const total = Math.max(1, pk+fk+ck);
  els.pBar.style.width = `${clamp(pk/total*100, 2, 100)}%`;
  els.fBar.style.width = `${clamp(fk/total*100, 2, 100)}%`;
  els.cBar.style.width = `${clamp(ck/total*100, 2, 100)}%`;

  const pPct = Math.round(pk/total*100);
  const fPct = Math.round(fk/total*100);
  const cPct = Math.round(ck/total*100);
  if(els.pPct) els.pPct.textContent = `${pPct}%`;
  if(els.fPct) els.fPct.textContent = `${fPct}%`;
  if(els.cPct) els.cPct.textContent = `${cPct}%`;

  // premium: a short shine on update
  if(!isReducedMotion()){
    [els.pBar, els.fBar, els.cBar].forEach(el=>{
      if(!el) return;
      el.classList.remove("shine");
      // force reflow
      void el.offsetWidth;
      el.classList.add("shine");
    });
  }

  // "À faire aujourd’hui"
  if(els.todoKcal) els.todoKcal.textContent = `${Math.round(plan.target)} kcal`;
  if(els.todoP) els.todoP.textContent = `${plan.proteinG} g`;
  if(els.todoWater) els.todoWater.textContent = `${plan.water.toFixed(1)} L`;
  if(els.todoFiber) els.todoFiber.textContent = `${Math.round(plan.fiber)} g`;


  // advanced minis (always computed, but visible mostly on mobile expanded)
  els.waterVal.textContent = `${plan.water.toFixed(1)} L`;
  els.fiberVal.textContent = `${Math.round(plan.fiber)} g`;
  els.sodiumVal.textContent = `${Math.round(plan.sodium)} mg`;

  // coherence ring
  animateNumber(els.cohValue, lastNumbers.coh, plan.coherence, 260, (x)=>`${Math.round(x)}`);
  lastNumbers.coh = plan.coherence;

  // ring border color based on score
  let ringColor = "rgba(45,226,197,.45)";
  if(plan.coherence < 55) ringColor = "rgba(255,90,106,.45)";
  else if(plan.coherence < 75) ringColor = "rgba(255,138,76,.45)";
  els.cohRing.style.borderColor = ringColor;

  // score explanation (why not 100?)
  if(els.scoreHint && els.scoreList){
    const adds = [];
    const wkg = Number(state.weight) || 0;
    // Suggested thresholds
    const defAbs = Math.round(Math.abs(plan.delta));
    if(state.goal === "cut"){
      if(defAbs >= 600) adds.push({points:"+6", text:"si déficit < 600 kcal"});
      if(Number(state.proteinPerKg) < 1.6) adds.push({points:"+3", text:"si protéines ≥ 1.6 g/kg"});
      if(Number(state.fatMinPerKg) < 0.8) adds.push({points:"+4", text:"si lipides ≥ 0.8 g/kg"});
    }else{
      if(Number(state.proteinPerKg) < 1.5) adds.push({points:"+3", text:"si protéines ≥ 1.5 g/kg"});
      if(Number(state.fatMinPerKg) < 0.7) adds.push({points:"+4", text:"si lipides ≥ 0.7 g/kg"});
    }

    const label = (plan.coherence >= 80) ? "Bon équilibre" : (plan.coherence >= 60) ? "À optimiser" : "À corriger";
    els.scoreHint.textContent = `${plan.coherence} — ${label}`;
    els.scoreList.innerHTML = "";
    const base = document.createElement("div");
    base.className = "score-row";
    base.textContent = "Pourquoi pas 100 ?";
    els.scoreList.appendChild(base);

    if(adds.length === 0){
      const li = document.createElement("div");
      li.className = "score-item";
      li.textContent = "Tu es déjà dans une zone très propre. Ajuste surtout selon ton ressenti.";
      els.scoreList.appendChild(li);
    }else{
      adds.slice(0,3).forEach(a=>{
        const li = document.createElement("div");
        li.className = "score-item";
        li.innerHTML = `<span class="score-plus">${a.points}</span><span>${a.text}</span>`;
        els.scoreList.appendChild(li);
      });
    }
  }

  renderDailyChip();


  // alerts
  els.alerts.innerHTML = "";
  plan.warnings.forEach(w => {
    const div = document.createElement("div");
    div.className = `alert-soft ${w.type}`;
    div.textContent = w.text;
    els.alerts.appendChild(div);
  });

  save();
}


/* ----------------------------- Toast ----------------------------- */
let toastTimer = null;
function showToast(msg){
  if(!els.toast) return;
  els.toastText.textContent = msg;
  els.toast.classList.add("show");
  if(toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> els.toast.classList.remove("show"), 1800);
}

/* ----------------------------- Plan actions ----------------------------- */

function buildPlanText(plan){
  const d = new Date();
  const dateStr = d.toLocaleDateString("fr-CH", {weekday:"short", year:"numeric", month:"2-digit", day:"2-digit"});
  const deltaSign = plan.delta >= 0 ? "+" : "−";
  const deltaAbs = Math.round(Math.abs(plan.delta));
  return [
    `Nutrition-Track — Plan du jour (${dateStr})`,
    ``,
    `Calories : ${Math.round(plan.target)} kcal/j`,
    `Protéines : ${plan.proteinG} g`,
    `Lipides : ${plan.fatG} g`,
    `Glucides : ${plan.carbG} g`,
    ``,
    `Eau : ${Math.round(plan.water*10)/10} L`,
    `Fibres : ${Math.round(plan.fiber)} g`,
    `Sodium : ${Math.round(plan.sodium)} mg`,
    ``,
    `TDEE : ${Math.round(plan.tdee)} kcal  |  Δ ${deltaSign}${deltaAbs} kcal`
  ].join("\n");
}

async function copyPlan(plan){
  const text = buildPlanText(plan);
  try{
    await navigator.clipboard.writeText(text);
    showToast("Plan copié ✅");
  }catch(_){
    // fallback
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try{ document.execCommand("copy"); showToast("Plan copié ✅"); }catch(__){ showToast("Copie impossible"); }
    ta.remove();
  }
}

function setDailyPlan(plan){
  const payload = {
    dateISO: new Date().toISOString().slice(0,10),
    kcal: Math.round(plan.target),
    P: plan.proteinG,
    F: plan.fatG,
    C: plan.carbG,
    water: Math.round(plan.water*10)/10,
    fiber: Math.round(plan.fiber),
    sodium: Math.round(plan.sodium),
    tdee: Math.round(plan.tdee),
    delta: Math.round(plan.delta),
  };
  try{
    localStorage.setItem("nt_daily_plan_v1", JSON.stringify(payload));
    showToast("Plan du jour enregistré ✓");
  }catch(_){
    showToast("Stockage indisponible");
  }
}

function renderDailyChip(){
  if(!els.dailyChip) return;
  try{
    const raw = localStorage.getItem("nt_daily_plan_v1");
    if(!raw){ els.dailyChip.classList.add("hidden"); return; }
    const p = JSON.parse(raw);
    const today = new Date().toISOString().slice(0,10);
    if(p && p.dateISO === today){
      els.dailyChip.textContent = "Plan d’aujourd’hui";
      els.dailyChip.classList.remove("hidden");
    }else{
      els.dailyChip.classList.add("hidden");
    }
  }catch(_){
    els.dailyChip.classList.add("hidden");
  }
}

function sharePlanImage(plan){
  // simple PNG export via canvas (download)
  const w = 1080, h = 608;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");

  // background
  const g = ctx.createLinearGradient(0,0,w,h);
  g.addColorStop(0, "#0B1220");
  g.addColorStop(1, "#111B2E");
  ctx.fillStyle = g;
  ctx.fillRect(0,0,w,h);

  // accent strip
  const g2 = ctx.createLinearGradient(0,0,w,0);
  g2.addColorStop(0, "rgba(45,226,197,.9)");
  g2.addColorStop(1, "rgba(255,138,76,.9)");
  ctx.fillStyle = g2;
  ctx.fillRect(0,0,w,10);

  // text
  ctx.fillStyle = "#EAF0FF";
  ctx.font = "700 44px Inter, system-ui, -apple-system, Segoe UI, Roboto";
  ctx.fillText("Nutrition-Track — Plan du jour", 64, 110);

  ctx.font = "800 96px Inter, system-ui, -apple-system, Segoe UI, Roboto";
  ctx.fillText(`${Math.round(plan.target)} kcal`, 64, 220);

  ctx.font = "600 34px Inter, system-ui, -apple-system, Segoe UI, Roboto";
  ctx.fillStyle = "rgba(234,240,255,.85)";
  ctx.fillText(`P ${plan.proteinG} g   •   F ${plan.fatG} g   •   C ${plan.carbG} g`, 64, 290);

  ctx.fillStyle = "rgba(234,240,255,.75)";
  ctx.font = "500 28px Inter, system-ui, -apple-system, Segoe UI, Roboto";
  ctx.fillText(`TDEE ${Math.round(plan.tdee)}  |  Δ ${plan.delta>=0?"+":"−"}${Math.round(Math.abs(plan.delta))}`, 64, 350);
  ctx.fillText(`Eau ${Math.round(plan.water*10)/10} L  •  Fibres ${Math.round(plan.fiber)} g  •  Sodium ${Math.round(plan.sodium)} mg`, 64, 400);

  const url = c.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = `nutrition-plan-${new Date().toISOString().slice(0,10)}.png`;
  a.click();
  showToast("Image exportée ✓");
}

/* ----------------------------- Tooltips (info bubbles) ----------------------------- */

let tipEl = null;
function closeTip(){
  if(tipEl){
    tipEl.remove();
    tipEl = null;
    document.removeEventListener("click", onOutsideTip, true);
  }
}
function onOutsideTip(e){
  if(tipEl && !tipEl.contains(e.target) && !e.target.classList.contains("info")){
    closeTip();
  }
}
function openTip(anchor, text){
  closeTip();
  tipEl = document.createElement("div");
  tipEl.className = "tip";
  tipEl.textContent = text;
  document.body.appendChild(tipEl);

  const r = anchor.getBoundingClientRect();
  const x = clamp(r.left, 12, window.innerWidth - 300);
  const y = r.bottom + 10;
  tipEl.style.left = `${x}px`;
  tipEl.style.top = `${y}px`;

  requestAnimationFrame(()=> tipEl.classList.add("show"));
  document.addEventListener("click", onOutsideTip, true);
}

/* ----------------------------- Onboarding (mini tour) ----------------------------- */

const tourSteps = [
  {
    title: "1/3 — Profil",
    text: "Entre ton sexe, âge, taille et poids. Le plan se met à jour dès que tout est valide.",
    focus: () => $("#panelProfile"),
    gotoStep: 0
  },
  {
    title: "2/3 — Activité",
    text: "Choisis le niveau qui te ressemble. C’est la clé pour un TDEE réaliste.",
    focus: () => $("#panelActivity"),
    gotoStep: 1
  },
  {
    title: "3/3 — Résultat",
    text: "Ici : calories cibles + macros. Ajuste ensuite le rythme si tu veux affiner.",
    focus: () => $("#resultCard"),
    gotoStep: 2
  }
];
let tourIndex = 0;

function renderTourDots(){
  els.tourDots.innerHTML = "";
  tourSteps.forEach((_, i)=>{
    const d = document.createElement("div");
    d.className = "dot" + (i === tourIndex ? " active" : "");
    els.tourDots.appendChild(d);
  });
}

function positionTourSpot(targetEl){
  const r = targetEl.getBoundingClientRect();
  const pad = 8;
  els.tourSpot.style.left = `${r.left - pad}px`;
  els.tourSpot.style.top = `${r.top - pad}px`;
  els.tourSpot.style.width = `${r.width + pad*2}px`;
  els.tourSpot.style.height = `${r.height + pad*2}px`;
}

function openTour(force=false){
  if(!force){
    try{
      if(localStorage.getItem(TOUR_KEY) === "1") return;
    }catch(_){}
  }

  els.tour.classList.remove("hidden");
  tourIndex = 0;
  applyTourStep();
}

function closeTour(){
  els.tour.classList.add("hidden");
  try{ localStorage.setItem(TOUR_KEY, "1"); }catch(_){}

  // UX: après la visite, on revient au début (Profil) pour passer à l’action.
  showPanel(0);
  // Ensure focus/viewport is sane
  if(!isReducedMotion()){
    window.scrollTo({top: 0, behavior: "smooth"});
  }else{
    window.scrollTo(0,0);
  }
}

function applyTourStep(){
  const step = tourSteps[tourIndex];
  showPanel(step.gotoStep);
  render(); // ensure panel visible

  els.tourTitle.textContent = step.title;
  els.tourText.textContent = step.text;

  renderTourDots();

  const target = step.focus();
  if(target){
    // allow layout settle
    setTimeout(()=> positionTourSpot(target), 50);
  }

  els.tourBack.disabled = (tourIndex === 0);
  els.tourNext.textContent = (tourIndex === tourSteps.length - 1) ? "Terminé" : "Suivant";
}

/* ----------------------------- Events wiring ----------------------------- */

function wireSegmented(controlEl, getKey){
  controlEl.addEventListener("click", (e)=>{
    const btn = e.target.closest(".seg");
    if(!btn) return;
    const v = btn.dataset.value;
    state[getKey()] = v;
    setActiveSeg(controlEl, v);

    // applying defaults can happen after sex is known
    if(getKey() === "sex" && state.goal){
      state.proteinPerKg = null;
      state.fatMinPerKg = null;
      state.carbMinPerKg = null;
      state.fiber = null;
      state.water = null;
      state.sodium = null;
      applyAutoDefaultsIfMissing();
    }

    render();
  renderDailyChip();
  });
}

function wireOptions(containerEl, cb){
  containerEl.addEventListener("click", (e)=>{
    const btn = e.target.closest(".option");
    if(!btn) return;
    cb(btn);
    render();
  renderDailyChip();
  });
}

function init(){
  load();

  // Macro target bands (configurable via data-t0/data-t1)
  document.querySelectorAll(".bar[data-t0][data-t1]").forEach(b=>{
    const t0 = Number(b.dataset.t0) || 0;
    const t1 = Number(b.dataset.t1) || 100;
    b.style.setProperty("--t0", String(t0));
    b.style.setProperty("--t1", String(t1));
  });

  // Mode
  els.modeSimple.addEventListener("click", ()=> setMode("simple"));
  els.modeAdvanced.addEventListener("click", ()=> setMode("advanced"));

  // Step navigation
  els.backBtn.addEventListener("click", ()=>{
    showPanel(state.step - 1);
  });
  els.nextBtn.addEventListener("click", ()=>{
    if(state.step === 3){
      // no-op
      return;
    }
    if(!canGoNext()){
      // micro shake on panel
      const panel = $(`.step-panel[data-panel="${state.step}"]`);
      if(panel && !isReducedMotion()){
        panel.animate([{transform:"translateX(0)"},{transform:"translateX(-6px)"},{transform:"translateX(6px)"},{transform:"translateX(0)"}], {duration: 220});
      }
      return;
    }
    showPanel(state.step + 1);
  });

  els.steps.forEach(stepBtn=>{
    stepBtn.addEventListener("click", ()=>{
      const target = Number(stepBtn.dataset.step);
      // allow going back anytime; going forward requires current step valid
      if(target > state.step && !canGoNext()) return;
      showPanel(target);
    });
  });

  // Inputs
  wireSegmented(els.sexControl, ()=>"sex");
  wireSegmented(els.carbProfileControl, ()=>"carbProfile");

  const onInput = ()=>{
    state.age = els.age.value ? Number(els.age.value) : null;
    state.height = els.height.value ? Number(els.height.value) : null;
    state.weight = els.weight.value ? Number(els.weight.value) : null;

    // update water default when weight changes (if advanced not manually changed)
    if(state.goal && state.weight && state.mode === "simple"){
      // simple recalculates anyway
    }
    render();
  renderDailyChip();
  };
  ["input","change"].forEach(evt=>{
    els.age.addEventListener(evt, onInput);
    els.height.addEventListener(evt, onInput);
    els.weight.addEventListener(evt, onInput);
  });

  // Activity cards
  wireOptions(els.activityCards, (btn)=>{
    state.activity = Number(btn.dataset.factor);
    setSelectedOption(els.activityCards, b => b === btn);
  });

  // Goal cards
  wireOptions(els.goalCards, (btn)=>{
    state.goal = btn.dataset.goal;

    // reset defaults (so they adapt to new goal)
    state.proteinPerKg = null;
    state.fatMinPerKg = null;
    state.carbMinPerKg = null;
    state.fiber = null;
    state.water = null;
    state.sodium = null;

    // pace defaults
    if(state.goal === "cut") state.pace = clamp(Number(state.pace) || 0.5, 0.25, 1.0);
    if(state.goal === "bulk") state.pace = clamp(Number(state.pace) || 0.25, 0.10, 0.50);

    // if maintain, pace irrelevant
    setSelectedOption(els.goalCards, b => b === btn);
    applyAutoDefaultsIfMissing();
  });

  // Pace slider
  els.pace.addEventListener("input", ()=>{
    state.pace = Number(els.pace.value);
    els.paceValue.textContent = Number(state.pace).toFixed(2);
    render();
  renderDailyChip();
  });

  // Collapse
  els.collapseBtn.addEventListener("click", ()=>{
    if(state.mode === "simple") return;
    state.advancedOpen = !state.advancedOpen;
    els.collapse.classList.toggle("open", state.advancedOpen);
    els.collapseBody.style.display = state.advancedOpen ? "" : "none";
    save();
  });

  // Advanced inputs
  function bindAdv(inputEl, key){
    inputEl.addEventListener("input", ()=>{
      const v = Number(inputEl.value);
      state[key] = Number.isFinite(v) ? v : null;
      render();
  renderDailyChip();
    });
  }
  bindAdv(els.proteinPerKg, "proteinPerKg");
  bindAdv(els.fatMinPerKg, "fatMinPerKg");
  bindAdv(els.carbMinPerKg, "carbMinPerKg");
  bindAdv(els.fiber, "fiber");
  bindAdv(els.water, "water");
  bindAdv(els.sodium, "sodium");

  // Reset
  els.resetBtn.addEventListener("click", ()=>{
    try{ localStorage.removeItem(LS_KEY); }catch(_){}
    state = {
      mode: "simple", step: 0,
      sex: null, age: null, height: null, weight: null,
      activity: null, goal: null, pace: 0.5,
      advancedOpen: false,
      carbProfile: "balanced",
      proteinPerKg: null, fatMinPerKg: null, carbMinPerKg: null,
      fiber: null, water: null, sodium: null
    };
    lastNumbers = {kcal:null, p:null, f:null, c:null, coh:null};
    setMode("simple");
    showPanel(0);
    render();
  renderDailyChip();
  });

  // Mobile bottom sheet toggle
  els.sheetToggle.addEventListener("click", ()=>{
    els.resultCard.classList.toggle("expanded");
    els.sheetToggle.textContent = els.resultCard.classList.contains("expanded") ? "Réduire" : "Détails";
  });

  // Export / Import
  els.exportBtn.addEventListener("click", ()=>{
    const blob = new Blob([JSON.stringify(state, null, 2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "nutrition-track-settings.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  els.importBtn.addEventListener("click", ()=> els.importFile.click());
  els.importFile.addEventListener("change", async ()=>{
    const file = els.importFile.files && els.importFile.files[0];
    if(!file) return;
    try{
      const txt = await file.text();
      const obj = JSON.parse(txt);
      state = {...state, ...obj};
      // sanitize step/mode
      state.step = clamp(Number(state.step) || 0, 0, 3);
      state.mode = (state.mode === "advanced") ? "advanced" : "simple";
      save();
      setMode(state.mode);
      showPanel(state.step);
      render();
  renderDailyChip();
    }catch(e){
      alert("Import impossible : fichier JSON invalide.");
    }finally{
      els.importFile.value = "";
    }
  });

  // Tooltips
  document.addEventListener("click", (e)=>{
    const info = e.target.closest(".info");
    if(info){
      const text = info.getAttribute("data-tip") || "";
      openTip(info, text);
      e.stopPropagation();
      return;
    }
  });


  // Result actions
  if(els.scoreBtn && els.scorePopover){
    els.scoreBtn.addEventListener("click", (e)=>{
      els.scorePopover.classList.toggle("open");
      e.stopPropagation();
    });
    document.addEventListener("click", (e)=>{
      if(!els.scorePopover.classList.contains("open")) return;
      const inside = e.target.closest("#scorePopover") || e.target.closest("#scoreBtn");
      if(!inside) els.scorePopover.classList.remove("open");
    });
  }

  if(els.copyPlanBtn){
    els.copyPlanBtn.addEventListener("click", async ()=>{
      const plan = calcPlan();
      if(!plan){ showToast("Remplis d’abord ton profil"); return; }
      await copyPlan(plan);
    });
  }
  if(els.sharePlanBtn){
    els.sharePlanBtn.addEventListener("click", ()=>{
      const plan = calcPlan();
      if(!plan){ showToast("Remplis d’abord ton profil"); return; }
      sharePlanImage(plan);
    });
  }
  if(els.setDailyBtn){
    els.setDailyBtn.addEventListener("click", ()=>{
      const plan = calcPlan();
      if(!plan){ showToast("Remplis d’abord ton profil"); return; }
      setDailyPlan(plan);
      renderDailyChip();
    });
  }

  // Legal modal
  if(els.legalMore && els.legalModal){
    const openLegal = ()=> els.legalModal.classList.add("open");
    const closeLegal = ()=> els.legalModal.classList.remove("open");
    els.legalMore.addEventListener("click", openLegal);
    if(els.legalClose) els.legalClose.addEventListener("click", closeLegal);
    if(els.legalOk) els.legalOk.addEventListener("click", closeLegal);
    if(els.legalOverlay) els.legalOverlay.addEventListener("click", closeLegal);
  }

  // Toast close
  if(els.toast){
    els.toast.addEventListener("click", ()=> els.toast.classList.remove("show"));
  }

  // Tour
  els.startTourBtn.addEventListener("click", ()=> openTour(true));
  els.tourOverlay.addEventListener("click", closeTour);
  els.tourSkip.addEventListener("click", closeTour);
  els.tourBack.addEventListener("click", ()=>{
    tourIndex = clamp(tourIndex - 1, 0, tourSteps.length - 1);
    applyTourStep();
  });
  els.tourNext.addEventListener("click", ()=>{
    if(tourIndex === tourSteps.length - 1){
      closeTour();
      return;
    }
    tourIndex = clamp(tourIndex + 1, 0, tourSteps.length - 1);
    applyTourStep();
  });

  // Initial render
  setMode(state.mode);
  showPanel(state.step);
  render();
  renderDailyChip();

  // Auto tour once
  setTimeout(()=> openTour(false), 450);

  // Service worker
  if("serviceWorker" in navigator){
    navigator.serviceWorker.register("./sw.js").catch(()=>{});
  }
}

init();
