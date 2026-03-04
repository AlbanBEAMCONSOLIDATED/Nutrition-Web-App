/*
  TB1 Flashcards – App
  Safe loader build (fix)
*/

function showError(msg){
  const b = document.getElementById("errorBanner");
  if(!b) return;
  b.style.display = "block";
  b.textContent = msg;
}

const LS_KEYS = {
  vocab: "tb1_vocab_min_v1",
  theme: "tb1_theme_min_v1",
  seen: "tb1_seen_ids_v1",
  liked: "tb1_liked_ids_v1",
  srs: "tb1_srs_state_v1"
};

function $(id){ return document.getElementById(id); }

async function loadOptionalScript(src){
  return new Promise((resolve)=>{
    const s=document.createElement("script");
    s.src=src;
    s.onload=()=>resolve({ok:true});
    s.onerror=()=>resolve({ok:false});
    document.head.appendChild(s);
  });
}
async function bootOptionalLibraries(){
  // Load user-provided files WITHOUT breaking the app if they contain syntax errors.
  // (If they have 'export', loading as classic script will fail but the app stays alive.)
  const r1 = await loadOptionalScript("./datatexte.js");
  const r2 = await loadOptionalScript("./datadictionary.js");
  // Init text library after load attempt
  if(typeof initTextLibrary==="function") initTextLibrary();
  // Notify
  if(!r1.ok) showError("datatexte.js non chargé (ou erreur). Les textes n’apparaîtront pas.");
  if(!r2.ok) showError("datadictionary.js non chargé (ou erreur). Les indices synonymes seront désactivés.");
}

function $$ (sel){ return Array.from(document.querySelectorAll(sel)); }

function shuffle(arr){
  for(let i=arr.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
  return arr;
}
function uid(){
  return "id-" + Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}
function primaryFr(fr){
  if(!fr) return "";
  return String(fr).split(";")[0].split(",")[0].trim();
}


function getSelectedUnits(){
  const box = document.getElementById("unitsBox");
  if(!box) return new Set(["Unit 1","Unit 2","Unit 3","Unit 4","Unit 5","Unit 6"]);
  const checks = Array.from(box.querySelectorAll('input[type="checkbox"]'));
  const selected = checks.filter(c=>c.checked).map(c=>c.value);
  return new Set(selected.length ? selected : ["Unit 1","Unit 2","Unit 3","Unit 4","Unit 5","Unit 6"]);
}

function applyUnitPreset(preset){
  const box = document.getElementById("unitsBox");
  if(!box) return;
  const checks = Array.from(box.querySelectorAll('input[type="checkbox"]'));
  const setChecked = (vals)=>{
    const s = new Set(vals);
    checks.forEach(c=> c.checked = s.has(c.value));
  };
  if(preset==="all") setChecked(["Unit 1","Unit 2","Unit 3","Unit 4","Unit 5","Unit 6"]);
  if(preset==="1-3") setChecked(["Unit 1","Unit 2","Unit 3"]);
  if(preset==="4-6") setChecked(["Unit 4","Unit 5","Unit 6"]);
  if(preset==="none") checks.forEach(c=> c.checked=false);
}

function stripArticle(en){
  return String(en||"").replace(/^(a|an|the)\s+/i,"").trim();
}
function isVerb(en){ return /^to\s+/i.test(String(en||"").trim()); }

function normalizeTerm(s){
  return String(s||"").toLowerCase().trim();
}
function baseForms(en){
  const s = String(en||"").trim();
  if(/^to\s+/i.test(s)){
    const v = s.replace(/^to\s+/i,"").trim();
    return [v, v+"s", v+"ed", v+"ing"].map(x=>x.toLowerCase());
  }
  // simple plural
  const low = s.toLowerCase();
  const out = new Set([low]);
  if(/^[a-z][a-z-]*$/i.test(s) && !low.endsWith("s")) out.add(low+"s");
  return Array.from(out);
}
function findContextSentences(card){
  const lib = Array.isArray(window.PHRASE_LIBRARY) ? window.PHRASE_LIBRARY : [];
  if(!lib.length) return [];
  const forms = baseForms(card.en);
  const unit = card.unit;
  const scored = [];
  for(const it of lib){
    const txt = (it.en||"").toLowerCase();
    let score = 0;
    if(it.unit === unit) score += 2;
    for(const f of forms){
      // word boundary-ish
      if(new RegExp("\\b" + f.replace(/[.*+?^${}()|[\\]\\\\]/g,"\\$&") + "\\b","i").test(txt)) score += 4;
      if(txt.includes(f)) score += 1;
    }
    // tags
    if(Array.isArray(it.tags)){
      for(const f of forms){
        if(it.tags.map(t=>String(t).toLowerCase()).includes(f)) score += 2;
      }
    }
    if(score>0) scored.push([score, it]);
  }
  scored.sort((a,b)=>b[0]-a[0]);
  // take top 12 then randomize a bit
  const top = scored.slice(0, 12).map(x=>x[1]);
  // shuffle top
  for(let i=top.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [top[i],top[j]]=[top[j],top[i]];
  }
  return top.slice(0, 2);
}
function makeExamples(card){
  const picked = findContextSentences(card);
  if(picked.length>=2){
    return picked.map(p=>({en:p.en, fr:p.fr}));
  }
  // fallback: dictionary hint only
  const hint = (getDictHints(card.en)||[])[0] || primaryFr(card.fr) || "";
  return [
    {en:`(Context not found) ${card.en}`, fr: hint ? `Indice : ${hint}` : ""},
    {en:`(Tip) Add a sentence to phrasedata.js containing “${card.en}”.`, fr:"(Astuce) Ajoute une phrase dans phrasedata.js."}
  ];
}

/* -------- Data (local) -------- */
const DEFAULT_VOCAB = Array.isArray(window.DEFAULT_VOCAB) ? window.DEFAULT_VOCAB : [];
const DEFAULT_GRAMMAR = Array.isArray(window.DEFAULT_GRAMMAR) ? window.DEFAULT_GRAMMAR : [];

function loadVocab(){
  const raw = localStorage.getItem(LS_KEYS.vocab);
  if(!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
function saveVocab(cards){
  localStorage.setItem(LS_KEYS.vocab, JSON.stringify(cards));
}

function loadIdSet(key){
  const raw = localStorage.getItem(key);
  if(!raw) return new Set();
  try{
    const arr = JSON.parse(raw);
    if(Array.isArray(arr)) return new Set(arr.map(String));
  }catch(e){}
  return new Set();
}
function saveIdSet(key, setObj){
  try{
    localStorage.setItem(key, JSON.stringify(Array.from(setObj)));
  }catch(e){}
}

function nowTs(){
  return Date.now();
}
function loadSRS(){
  const raw = localStorage.getItem(LS_KEYS.srs);
  if(!raw) return {};
  try{
    const obj = JSON.parse(raw);
    return (obj && typeof obj === "object") ? obj : {};
  }catch(e){ return {}; }
}
function saveSRS(){
  try{ localStorage.setItem(LS_KEYS.srs, JSON.stringify(SRS)); }catch(e){}
}
function ensureSRS(id){
  const sid = String(id);
  if(!SRS[sid]){
    // box 0 = new, due now
    SRS[sid] = {box:0, due: nowTs(), reps:0, lapses:0};
  }
  return SRS[sid];
}

// Spacing schedule (ms): minutes/hours first, then days
const BOX_INTERVAL_MS = [
  10*60*1000,        // 0: 10 min
  60*60*1000,        // 1: 1 hour
  6*60*60*1000,      // 2: 6 hours
  24*60*60*1000,     // 3: 1 day
  3*24*60*60*1000,   // 4: 3 days
  7*24*60*60*1000,   // 5: 7 days
  14*24*60*60*1000,  // 6: 14 days
  30*24*60*60*1000   // 7: 30 days
];

function gradeCard(id, known){
  const s = ensureSRS(id);
  s.reps = (s.reps||0) + 1;

  if(known){
    s.box = Math.min(7, (s.box||0) + 1);
  } else {
    s.lapses = (s.lapses||0) + 1;
    s.box = 0;
  }

  const interval = BOX_INTERVAL_MS[s.box] ?? (10*60*1000);
  s.due = nowTs() + interval;

  SRS[String(id)] = s;
  saveSRS();
}

function isDue(id){
  const s = ensureSRS(id);
  return (s.due ?? nowTs()) <= nowTs();
}

function srsStatsForPool(pool){
  let due=0, learn=0;
  for(const c of pool){
    const s = ensureSRS(c.id);
    if((s.due ?? nowTs()) <= nowTs()) due++;
    if((s.box ?? 0) === 0) learn++;
  }
  return {due, learn, total: pool.length};
}

function formatDueMs(ms){
  if(ms <= 0) return "maintenant";
  const min = Math.round(ms/60000);
  if(min < 60) return `${min} min`;
  const h = Math.round(min/60);
  if(h < 48) return `${h} h`;
  const d = Math.round(h/24);
  return `${d} j`;
}


function updateQuickCounts(){
  const s = document.getElementById("seenCount");
  const l = document.getElementById("likedCount");
  const d = document.getElementById("dueCount");
  if(s) s.textContent = String(SEEN.size);
  if(l) l.textContent = String(LIKED.size);
  if(d){
    const units = getSelectedUnits();
    const pool = VOCAB.filter(c=>units.has(c.unit));
    const stats = srsStatsForPool(pool);
    d.textContent = String(stats.due);
  }
  const likeBtn = document.getElementById("btnLike");
  if(likeBtn && deck.length){
    const id = deck[current]?.id;
    const on = id && LIKED.has(String(id));
    likeBtn.textContent = on ? "⭐ Liké" : "⭐ Like";
  }
}



/* -------- App state -------- */
let VOCAB = [];
let deck = [];
let dir = [];
let current = 0;
let flipped = false;

let SEEN = new Set();
let LIKED = new Set();
let SRS = {}; // id -> {box, due, reps}

function buildDirections(){
  const mode = $("directionMode").value;
  if(mode==="fr_en" || mode==="en_fr"){
    dir = deck.map(()=>mode);
  } else {
    dir = deck.map(()=> (Math.random()<0.5 ? "fr_en" : "en_fr"));
  }
}

function hydrateUnitSelects(){
  const units = Array.from(new Set(VOCAB.map(c=>c.unit))).sort((a,b)=>{
    const na=parseInt((a.match(/\d+/)||["0"])[0],10);
    const nb=parseInt((b.match(/\d+/)||["0"])[0],10);
    return na-nb;
  });

  const fill = (el, includeAll)=>{
    el.innerHTML = "";
    if(includeAll){
      const o=document.createElement("option");
      o.value="ALL"; o.textContent="Toutes les units";
      el.appendChild(o);
    }
    units.forEach(u=>{
      const o=document.createElement("option");
      o.value=u; o.textContent=u;
      el.appendChild(o);
    });
  };

    fill($("dbUnitFilter"), true);
  fill($("editUnit"), false);

    $("dbUnitFilter").value="ALL";
  $("editUnit").value=units[0] || "Unit 1";
}

function setDeckFromFilters(){
  const units = getSelectedUnits();
  const q = ($("searchBox").value || "").trim().toLowerCase();

  deck = VOCAB.filter(c=>{
    const okU = units.has(c.unit);
    if(!okU) return false;
    if(!q) return true;
    return String(c.en||"").toLowerCase().includes(q) || String(c.fr||"").toLowerCase().includes(q);
  });

  if(deck.length===0) deck = [...VOCAB];

  const srsToggle = document.getElementById("srsMode");
  const srsOn = !srsToggle || srsToggle.checked;
  if(srsOn){
    const due = deck.filter(c=>isDue(c.id));
    const later = deck.filter(c=>!isDue(c.id));
    shuffle(due); shuffle(later);
    deck = due.concat(later);
  } else {
    shuffle(deck);
  }
  current = 0;
  buildDirections();
  renderCard();
}

function renderCard(){
  if(deck.length===0){
    $("frontWord").textContent = "—";
    $("backWord").textContent = "—";
    $("globalCount").textContent = "0 cartes";
    return;
  }

  const c = deck[current];
  const mode = dir[current] || "fr_en";

  const frontText = (mode==="fr_en") ? c.fr : c.en;
  const backText  = (mode==="fr_en") ? c.en : c.fr;

  $("frontLabel").textContent = (mode==="fr_en") ? "Français" : "English";
  $("backLabel").textContent  = (mode==="fr_en") ? "English" : "Français";

  $("frontWord").textContent = frontText;
  $("backWord").textContent = backText;
  $("unitBadge").textContent = c.unit || "—";

  // mark as seen
  if(c && c.id){
    SEEN.add(String(c.id));
    saveIdSet(LS_KEYS.seen, SEEN);
  }

  const ex = makeExamples(c);
  $("examplesEn").innerHTML = `• ${ex[0].en}<br>• ${ex[1].en}`;
  $("examplesFr").innerHTML = `• ${ex[0].fr}<br>• ${ex[1].fr}`;
  $("examplesFr").style.display = "none";

  flipped = false;
  $("card3d").classList.remove("flipped");

  $("progressText").textContent = `${current+1} / ${deck.length}`;
  $("progressBar").style.width = `${((current+1)/deck.length)*100}%`;
  $("globalCount").textContent = `${VOCAB.length} cartes`;
  updateQuickCounts();

  // Optional user libraries
  bootOptionalLibraries();
}

function flip(){
  flipped = !flipped;
  $("card3d").classList.toggle("flipped", flipped);
}

function next(){
  if(deck.length===0) return;
  current = (current+1) % deck.length;
  renderCard();
}
function prev(){
  if(deck.length===0) return;
  current = (current-1 + deck.length) % deck.length;
  renderCard();
}


function getVocabPool(scope){
  const units = getSelectedUnits();
  let pool = VOCAB.filter(c=>units.has(c.unit));
  if(scope==="seen"){
    pool = pool.filter(c=>SEEN.has(String(c.id)));
  } else if(scope==="liked"){
    pool = pool.filter(c=>LIKED.has(String(c.id)));
  }
  return pool;
}

function startQuickVocabTest(scope){
  const pool = getVocabPool(scope);
  if(pool.length === 0){
    alert(scope==="liked" ? "Aucun mot liké dans cette sélection d'units." : "Aucun mot vu dans cette sélection d'units.");
    return;
  }
  const count = Math.min(20, pool.length);
  const questions = pickRandom(pool, count).map(card=>{
    const d = Math.random()<0.5 ? "fr_en" : "en_fr";
    return {type:"vocab", prompt: d==="fr_en" ? card.fr : card.en, answer: d==="fr_en" ? card.en : card.fr, id: card.id};
  });
  testState = {mode:"vocab", questions, correct:0};
  setTab("tests");
  renderTest();
}

function toggleLikeCurrent(){
  if(deck.length===0) return;
  const id = deck[current]?.id;
  if(!id) return;
  const sid = String(id);
  if(LIKED.has(sid)) LIKED.delete(sid);
  else LIKED.add(sid);
  saveIdSet(LS_KEYS.liked, LIKED);
  updateQuickCounts();

  // Optional user libraries
  bootOptionalLibraries();
}



function startRevisionSession(){
  const units = getSelectedUnits();
  const pool = VOCAB.filter(c=>units.has(c.unit));
  const dueCards = pool.filter(c=>isDue(c.id));
  if(!dueCards.length){
    alert("Rien à réviser pour le moment (0 mot dû).");
    return;
  }
  deck = [...dueCards];
  shuffle(deck);
  current = 0;
  buildDirections();
  renderCard();
  if(typeof showToast==="function") showToast("Session révision : mots dû");
}


/* -------- Tabs -------- */
function setTab(name){
  $$(".tab").forEach(b=>b.classList.toggle("active", b.dataset.tab===name));
  ["vocab","grammar","texts","tests","db"].forEach(t=>{
    $("panel-"+t).classList.toggle("active", t===name);
  });
  if(name==="grammar") renderGrammar();
  if(name==="db") renderDbTable();
}

function initTabs(){
  $$(".tab").forEach(b=>{
    b.addEventListener("click", ()=>setTab(b.dataset.tab));
  });
}

/* -------- Grammar -------- */
let grammarRendered=false;
function renderGrammar(){
  if(grammarRendered) return;
  const root = $("grammarRoot");
  root.innerHTML = "";
  DEFAULT_GRAMMAR.forEach(unit=>{
    const d=document.createElement("details");
    const s=document.createElement("summary");
    s.textContent = `${unit.unit} — ${unit.title}`;
    d.appendChild(s);

    const body=document.createElement("div");
    (unit.sections||[]).forEach(sec=>{
      const h=document.createElement("div");
      h.style.fontWeight="1000";
      h.style.marginTop="10px";
      h.textContent = sec.title;
      body.appendChild(h);

      (sec.rules||[]).forEach(r=>{
        const p=document.createElement("div");
        p.className="rule";
        p.textContent = "• " + r;
        body.appendChild(p);
      });

      (sec.examples||[]).forEach(ex=>{
        const box=document.createElement("div");
        box.className="ex";
        box.innerHTML = `<div style="font-weight:1000;">${escapeHtml(ex.en)}</div><div class="small">${escapeHtml(ex.fr)}</div>`;
        body.appendChild(box);
      });

      (sec.exercises||[]).forEach((q, idx)=>{
        const box=document.createElement("div");
        box.className="quiz";
        box.innerHTML = `<div class="q">Exercice ${idx+1} — ${escapeHtml(q.q)}</div>`;
        const ans=document.createElement("div");
        ans.className="answer";

        if(q.type==="mcq"){
          (q.choices||[]).forEach((choice,i)=>{
            const btn=document.createElement("button");
            btn.className="choice-btn";
            btn.textContent=choice;
            btn.addEventListener("click", ()=>{
              const ok = i===q.answer;
              btn.style.borderColor = ok ? "rgba(22,163,74,.35)" : "rgba(220,38,38,.35)";
              btn.style.background = ok ? "rgba(22,163,74,.06)" : "rgba(220,38,38,.06)";
              ans.innerHTML = `Réponse : ${escapeHtml(q.choices[q.answer])}<br>${escapeHtml(q.why||"")}`;
            });
            box.appendChild(btn);
          });
        } else {
          const input=document.createElement("input");
          input.className="control";
          input.placeholder="Ta réponse…";
          const btn=document.createElement("button");
          btn.className="control btn";
          btn.textContent="Corriger";
          btn.addEventListener("click", ()=>{
            const val=(input.value||"").trim().toLowerCase();
            const exp=(q.a||"").trim().toLowerCase();
            ans.innerHTML = (val===exp) ? `OK. ${escapeHtml(q.why||"")}` : `Réponse : ${escapeHtml(q.a)}<br>${escapeHtml(q.why||"")}`;
          });
          box.appendChild(input);
          box.appendChild(btn);
        }

        box.appendChild(ans);
        body.appendChild(box);
      });
    });

    d.appendChild(body);
    root.appendChild(d);
  });
  grammarRendered=true;
}

function escapeHtml(s){
  return String(s||"")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;");
}

/* -------- Tests -------- */
let testState=null;

function pickRandom(arr, n){
  const copy=[...arr];
  shuffle(copy);
  return copy.slice(0,n);
}
function buildTestQuestions(mode, count){
  const q = [];
  const want = count;

  const vocabQs = Math.ceil(want * (mode==="grammar" ? 0 : (mode==="vocab" ? 1 : 0.6)));
  const gramQs  = want - vocabQs;

  if(mode==="vocab" || mode==="mixed"){
    pickRandom(VOCAB, vocabQs).forEach(card=>{
      const d = Math.random()<0.5 ? "fr_en" : "en_fr";
      q.push({
        type:"vocab",
        prompt: d==="fr_en" ? card.fr : card.en,
        answer: d==="fr_en" ? card.en : card.fr
      });
    });
  }

  if(mode==="grammar" || mode==="mixed"){
    const all=[];
    DEFAULT_GRAMMAR.forEach(u=> (u.sections||[]).forEach(s=> (s.exercises||[]).forEach(ex=> all.push(ex))));
    pickRandom(all, gramQs).forEach(ex=>{
      q.push({type:"grammar", ex});
    });
  }

  shuffle(q);
  return q;
}

function renderTest(){
  const root=$("testRoot");
  root.innerHTML = "";
  if(!testState){
    $("testScore").textContent="—";
    root.innerHTML = `<div class="small">Choisis un mode puis “Démarrer”.</div>`;
    return;
  }
  $("testScore").textContent = `${testState.correct} / ${testState.questions.length}`;

  testState.questions.forEach((q, idx)=>{
    const card=document.createElement("div");
    card.className="card-area";
    card.style.background="#fff";

    const title=document.createElement("div");
    title.style.fontWeight="1000";
    title.style.marginBottom="10px";
    title.textContent = q.type==="vocab"
      ? `Q${idx+1} (Vocab) — Traduire : ${q.prompt}`
      : `Q${idx+1} (Grammaire) — ${q.ex.q}`;
    card.appendChild(title);

    const ans=document.createElement("div");
    ans.className="answer";

    if(q.type==="vocab"){
      const input=document.createElement("input");
      input.className="control";
      input.placeholder="Ta réponse…";
      const btn=document.createElement("button");
      btn.className="control btn primary";
      btn.textContent="Valider";
      btn.addEventListener("click", ()=>{
        const val=(input.value||"").trim().toLowerCase();
        const exp=(q.answer||"").trim().toLowerCase();
        const ok = val===exp;
        if(!q._done){
          q._done=true;
          if(q.id){ gradeCard(q.id, ok); }
          if(ok) testState.correct++;
          $("testScore").textContent = `${testState.correct} / ${testState.questions.length}`;
        }
        ans.textContent = ok ? "OK." : ("Réponse : " + q.answer);
      });
      card.appendChild(input);
      card.appendChild(btn);
    } else {
      const ex=q.ex;
      if(ex.type==="mcq"){
        (ex.choices||[]).forEach((c,i)=>{
          const btn=document.createElement("button");
          btn.className="choice-btn";
          btn.textContent=c;
          btn.addEventListener("click", ()=>{
            const ok = i===ex.answer;
            if(!q._done){
              q._done=true;
              if(ok) testState.correct++;
              $("testScore").textContent = `${testState.correct} / ${testState.questions.length}`;
            }
            ans.textContent = "Réponse : " + ex.choices[ex.answer];
          });
          card.appendChild(btn);
        });
      } else {
        const input=document.createElement("input");
        input.className="control";
        input.placeholder="Ta réponse…";
        const btn=document.createElement("button");
        btn.className="control btn primary";
        btn.textContent="Valider";
        btn.addEventListener("click", ()=>{
          const val=(input.value||"").trim().toLowerCase();
          const exp=(ex.a||"").trim().toLowerCase();
          const ok = val===exp;
          if(!q._done){
            q._done=true;
            if(ok) testState.correct++;
            $("testScore").textContent = `${testState.correct} / ${testState.questions.length}`;
          }
          ans.textContent = ok ? "OK." : ("Réponse : " + ex.a);
        });
        card.appendChild(input);
        card.appendChild(btn);
      }
    }

    card.appendChild(ans);
    root.appendChild(card);
  });
}

function initTests(){
  $("btnStartTest").addEventListener("click", ()=>{
    const mode=$("testMode").value;
    const count=parseInt($("testCount").value,10);
    testState = {mode, questions: buildTestQuestions(mode,count), correct:0};
    renderTest();
  });
  $("btnRestartTest").addEventListener("click", ()=>{
    if(!testState) return renderTest();
    const mode=testState.mode;
    const count=testState.questions.length;
    testState = {mode, questions: buildTestQuestions(mode,count), correct:0};
    renderTest();
  });
  renderTest();
}

/* -------- DB (CRUD) -------- */
let selectedId=null;

function renderDbTable(){
  const u = $("dbUnitFilter").value;
  const q = ($("dbSearch").value||"").trim().toLowerCase();

  const rows = VOCAB.filter(c=>{
    const okU = (u==="ALL") ? true : (c.unit===u);
    if(!okU) return false;
    if(!q) return true;
    return String(c.en||"").toLowerCase().includes(q) || String(c.fr||"").toLowerCase().includes(q);
  });

  // Desktop table
  const body = $("dbTableBody");
  body.innerHTML = "";
  rows.slice(0, 2000).forEach(c=>{
    const tr=document.createElement("tr");
    if(c.id===selectedId) tr.classList.add("selected");
    tr.innerHTML = `<td>${escapeHtml(c.unit)}</td><td>${escapeHtml(c.en)}</td><td>${escapeHtml(c.fr)}</td>`;
    tr.addEventListener("click", ()=>{
      selectedId = c.id;
      $("editUnit").value = c.unit;
      $("editEn").value = c.en;
      $("editFr").value = c.fr;
      renderDbTable();
    });
    body.appendChild(tr);
  });

  // Mobile cards list
  const cards = $("dbCards");
  if(cards){
    cards.innerHTML = "";
    rows.slice(0, 400).forEach(c=>{
      const item=document.createElement("div");
      item.className = "db-card" + (c.id===selectedId ? " selected" : "");
      item.innerHTML = `<div class="u">${escapeHtml(c.unit)}</div><div class="en">${escapeHtml(c.en)}</div><div class="fr">${escapeHtml(c.fr)}</div>`;
      item.addEventListener("click", ()=>{
        selectedId = c.id;
        $("editUnit").value = c.unit;
        $("editEn").value = c.en;
        $("editFr").value = c.fr;
        renderDbTable();
      });
      cards.appendChild(item);
    });
  }
}


function upsert(mode){
  const unit=$("editUnit").value;
  const en=$("editEn").value.trim();
  const fr=$("editFr").value.trim();
  if(!unit || !en || !fr) return alert("Unit, EN et FR sont obligatoires.");

  if(mode==="add"){
    const card={id: uid(), unit, en, fr};
    VOCAB.unshift(card);
    selectedId=card.id;
  } else {
    if(!selectedId) return alert("Sélectionne une ligne à gauche.");
    const idx=VOCAB.findIndex(c=>c.id===selectedId);
    if(idx<0) return alert("Carte introuvable.");
    VOCAB[idx] = {...VOCAB[idx], unit, en, fr};
  }

  saveVocab(VOCAB);
  hydrateUnitSelects();
  renderDbTable();
  setDeckFromFilters();
}

function del(){
  if(!selectedId) return alert("Sélectionne une ligne à gauche.");
  if(!confirm("Supprimer cette carte ?")) return;
  VOCAB = VOCAB.filter(c=>c.id!==selectedId);
  selectedId=null;
  saveVocab(VOCAB);
  hydrateUnitSelects();
  renderDbTable();
  setDeckFromFilters();
}

function clearForm(){
  selectedId=null;
  $("editEn").value="";
  $("editFr").value="";
  renderDbTable();
}

function exportJSON(){
  const blob = new Blob([JSON.stringify(VOCAB, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download="tb1_vocab_custom.json";
  a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 500);
}

async function importJSON(file){
  const txt = await file.text();
  let obj;
  try{ obj=JSON.parse(txt); } catch { return alert("JSON invalide."); }
  if(!Array.isArray(obj)) return alert("Le JSON doit être un tableau.");

  const cleaned = obj.map(x=>({
    id: x.id || uid(),
    unit: x.unit || "Unit 1",
    en: String(x.en||"").trim(),
    fr: String(x.fr||"").trim()
  })).filter(x=>x.en && x.fr);

  if(!confirm(`Importer ${cleaned.length} cartes ? (remplace ta base locale)`)) return;
  VOCAB = cleaned;
  saveVocab(VOCAB);
  selectedId=null;
  hydrateUnitSelects();
  renderDbTable();
  setDeckFromFilters();
}

function bulkAdd(){
  const text = ($("bulkArea").value||"").trim();
  if(!text) return;
  const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);

  const toAdd=[];
  for(const line of lines){
    const parts = line.split(/\t|\s*;\s*/).map(x=>x.trim()).filter(Boolean);
    if(parts.length<2) continue;
    const en=parts[0], fr=parts[1];
    const unit=parts[2] || $("editUnit").value || "Unit 1";
    if(en && fr) toAdd.push({id: uid(), unit, en, fr});
  }
  if(toAdd.length===0) return alert("Format attendu : EN<TAB>FR<TAB>Unit");
  VOCAB = [...toAdd, ...VOCAB];
  saveVocab(VOCAB);
  $("bulkArea").value="";
  hydrateUnitSelects();
  renderDbTable();
  setDeckFromFilters();
}

function initDb(){
  $("dbUnitFilter").addEventListener("change", renderDbTable);
  $("dbSearch").addEventListener("input", ()=>{
    clearTimeout(window.__dbT);
    window.__dbT = setTimeout(renderDbTable, 120);
  });

  $("btnExport").addEventListener("click", exportJSON);
  $("fileImport").addEventListener("change", (e)=>{
    const f=e.target.files && e.target.files[0];
    if(f) importJSON(f);
    e.target.value="";
  });

  $("btnAdd").addEventListener("click", ()=>upsert("add"));
  $("btnUpdate").addEventListener("click", ()=>upsert("update"));
  $("btnDelete").addEventListener("click", del);
  $("btnClear").addEventListener("click", clearForm);

  $("btnBulkAdd").addEventListener("click", bulkAdd);
  $("btnBulkExample").addEventListener("click", ()=>{
    $("bulkArea").value = [
      "to calibrate\tcalibrer\tUnit 6",
      "pressure drop\tperte de charge\tUnit 1",
      "however\tcependant\tUnit 5"
    ].join("\n");
  });
}

/* -------- UI init -------- */
function initVocab(){

  // Bottom bar (mobile)
  const bbPrev = document.getElementById("bbPrev");
  const bbFlip = document.getElementById("bbFlip");
  const bbNext = document.getElementById("bbNext");
  const bbLike = document.getElementById("bbLike");
  if(bbPrev) bbPrev.addEventListener("click", (e)=>{ e.preventDefault(); prev(); });
  if(bbNext) bbNext.addEventListener("click", (e)=>{ e.preventDefault(); next(); });
  if(bbFlip) bbFlip.addEventListener("click", (e)=>{ e.preventDefault(); flip(); });
  if(bbLike) bbLike.addEventListener("click", (e)=>{ e.preventDefault(); toggleLikeCurrent(); showToast("⭐ ajouté / retiré"); });


  $("btnShuffle").addEventListener("click", setDeckFromFilters);
    $("directionMode").addEventListener("change", ()=>{
    buildDirections();
    renderCard();
  });

  const srsToggle = document.getElementById("srsMode");
  if(srsToggle){
    srsToggle.addEventListener("change", ()=>{ setDeckFromFilters(); });
  }
  $("searchBox").addEventListener("input", ()=>{
    clearTimeout(window.__qT);
    window.__qT = setTimeout(setDeckFromFilters, 150);
  });

  $("btnPrev").addEventListener("click", prev);
  $("btnNext").addEventListener("click", next);

  $("btnYes").addEventListener("click", ()=>{
    if(deck.length && deck[current]?.id){ gradeCard(deck[current].id, true); }
    if(typeof showToast==="function"){ const s=ensureSRS(deck[current].id); showToast("✅ Connu • prochain : " + formatDueMs((s.due-nowTs()))); }
    next();
  });
  $("btnNo").addEventListener("click", ()=>{
    if(deck.length && deck[current]?.id){ gradeCard(deck[current].id, false); }
    if(typeof showToast==="function"){ const s=ensureSRS(deck[current].id); showToast("🔁 À revoir • prochain : " + formatDueMs((s.due-nowTs()))); }
    if(deck.length>2){
      const c = deck.splice(current,1)[0];
      const insertAt = Math.min(deck.length, current + 5);
      deck.splice(insertAt,0,c);
    }
    renderCard();
  });

  
  // Quick bar
  const likeBtn = document.getElementById("btnLike");
  if(likeBtn) likeBtn.addEventListener("click", (e)=>{ e.preventDefault(); toggleLikeCurrent(); });

  const ts = document.getElementById("btnTestSeen");
  if(ts) ts.addEventListener("click", (e)=>{ e.preventDefault(); startQuickVocabTest("seen"); });

  const tl = document.getElementById("btnTestLiked");
  if(tl) tl.addEventListener("click", (e)=>{ e.preventDefault(); startQuickVocabTest("liked"); });

  const br = document.getElementById("btnRevSession");
  if(br) br.addEventListener("click", (e)=>{ e.preventDefault(); startRevisionSession(); });

$("btnToggleTr").addEventListener("click", (e)=>{
    e.preventDefault();
    e.stopPropagation();
    const el=$("examplesFr");
    el.style.display = (el.style.display==="none" || !el.style.display) ? "block" : "none";
  });

  // Prevent UI elements inside the card from flipping it
  ["btnToggleTr"].forEach(id=>{
    const el = $(id);
    if(el) el.addEventListener("mousedown", (e)=>{ e.stopPropagation(); }, true);
  });
$("card3d").addEventListener("click", flip);
  $("card3d").addEventListener("keydown", (e)=>{
    if(e.key===" " || e.key==="Enter"){
      e.preventDefault();
      flip();
    }
  });

  window.addEventListener("keydown", (e)=>{
    // avoid interfering when typing in inputs
    const tag = (document.activeElement && document.activeElement.tagName) || "";
    if(["INPUT","TEXTAREA","SELECT"].includes(tag)) return;

    const active = document.querySelector(".tab.active")?.dataset.tab;
    if(active!=="vocab") return;

    if(e.key==="ArrowRight") next();
    if(e.key==="ArrowLeft") prev();
    if(e.key===" "){ e.preventDefault(); flip(); }
  });
  // Units checkboxes
  const ub = document.getElementById("unitsBox");
  if(ub){
    ub.addEventListener("change", (e)=>{
      if(e.target && e.target.matches('input[type="checkbox"]')){
        setDeckFromFilters();
      }
    });
    ub.querySelectorAll(".unit-chip").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        applyUnitPreset(btn.dataset.preset);
        setDeckFromFilters();
      });
    });
  }

}


/* -------- Text library (datatexte.js) -------- */
function initTextLibrary(){
  const sel = document.getElementById("textTitleSelect");
  if(!sel) return;

  // Accept multiple possible globals
  // Preferred: window.TEXT_LIBRARY = [{id,title,text,...}]
  // Also accepted: window.TEXTS, window.TEXTS_LIBRARY
  const lib =
    (Array.isArray(window.TEXT_LIBRARY) ? window.TEXT_LIBRARY :
    (Array.isArray(window.TEXTS) ? window.TEXTS :
    (Array.isArray(window.TEXTS_LIBRARY) ? window.TEXTS_LIBRARY : [])));

  sel.innerHTML = "";
  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = lib.length ? "Choisir un texte…" : "Aucun texte (datatexte.js)";
  sel.appendChild(opt0);

  lib.forEach((t, i)=>{
    const o=document.createElement("option");
    const key = t.id || t.key || t.title || ("text_"+i);
    o.value = key;
    o.textContent = t.title || t.name || key;
    sel.appendChild(o);
  });

  function loadByKey(key){
    const item = lib.find((x, i)=> (x.id||x.key||x.title||("text_"+i)) === key);
    if(!item) return;
    const text = item.text || item.content || item.body || "";
    const box = document.getElementById("textSource");
    if(box) box.value = text;

    // Optional unit hint
    const u = item.unit;
    const unitSel = document.getElementById("textUnit");
    if(u && unitSel && unitSel.value === "ALL"){
      unitSel.value = u;
    }
    if(typeof showToast === "function") showToast("Texte chargé");
  }

  sel.addEventListener("change", ()=>{
    const v = sel.value;
    if(!v) return;
    loadByKey(v);
  });

  // Auto-load first text once (quality of life)
  if(lib.length){
    // keep user's current text if any
    const box = document.getElementById("textSource");
    if(box && !box.value.trim()){
      const key = lib[0].id || lib[0].key || lib[0].title || "text_0";
      sel.value = key;
      loadByKey(key);
    }
  }
}


/* -------- Boot -------- */

/* -------- Text trainer (paste your TB1/MCSE texts) -------- */
let textState = null;

// Bigger grammar target banks per unit (Units 1–6)
function grammarTargetsForUnit(unit){
  const U1 = [
    "how many","how much","how long","how far","how high","how deep","how wide","how thick",
    "length","width","height","depth","diameter","radius","area","volume","temperature","pressure",
    "flow","flow rate","airflow","velocity","rate","increase","decrease","rise","drop","measure","record"
  ];
  const U2 = [
    "always","usually","often","sometimes","rarely","never","generally","normally","regularly",
    "once","twice","every","each","daily","weekly","monthly","annually"
  ];
  const U3 = [
    "than","more","less","most","least","as ... as","the more","the less","higher","lower","bigger","smaller",
    "better","worse","faster","slower","as"
  ];
  const U4 = [
    "slightly","a bit","somewhat","roughly","approximately","about","nearly","almost",
    "highly","strongly","extremely","significantly","considerably"
  ];
  const U5 = [
    "because","since","due to","as a result","therefore","thus","so","consequently",
    "however","although","even though","whereas","while",
    "moreover","in addition","also","furthermore"
  ];
  const U6 = [
    "yesterday","today","currently","right now","already","yet","since","for","during","while","ago",
    "is","are","am","was","were","have","has","had","do","does","did","will","shall"
  ];

  const all = { "Unit 1":U1, "Unit 2":U2, "Unit 3":U3, "Unit 4":U4, "Unit 5":U5, "Unit 6":U6 };
  if(unit==="ALL") return Object.values(all).flat();
  return all[unit] || [];
}

// Hints for grammar (symbols)
function grammarHint(token){
  const t = token.toLowerCase();

  // Comparisons
  if(["more","higher","bigger","better","faster","the more"].some(x=>t.includes(x))) return "+++";
  if(["less","lower","smaller","worse","slower","the less"].some(x=>t.includes(x))) return "---";
  if(t.includes("than")) return "≠";
  if(t.includes("as ... as") || t==="as") return "=";

  // Link words
  if(["because","since","due to"].some(x=>t.includes(x))) return "CAUSE";
  if(["therefore","thus","as a result","consequently","so"].some(x=>t.includes(x))) return "⇒";
  if(["however","although","even though","whereas","while"].some(x=>t.includes(x))) return "↔";
  if(["moreover","in addition","furthermore","also"].some(x=>t.includes(x))) return "++";

  // Degree / approximation
  if(["extremely","highly","strongly","significantly","considerably"].some(x=>t.includes(x))) return "+++";
  if(["slightly","a bit","somewhat"].some(x=>t.includes(x))) return "-";
  if(["roughly","approximately","about","nearly","almost"].some(x=>t.includes(x))) return "≈";

  // Time / frequency
  if(["right now","currently","today","yesterday"].some(x=>t.includes(x))) return "⏱";
  if(["always","usually","often","sometimes","never","rarely"].some(x=>t.includes(x))) return "🔁";

  // Default
  return "•";
}

function unitTokens(){
  return [
    "mm","cm","m","km","kg","g","l","L","ml","kW","W","MW","Pa","kPa","bar","°C","C","%","m3/h","m³/h","l/s","L/s","rpm"
  ];
}

function escapeHtml2(s){
  return String(s||"")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;");
}

function findOccurrences(text, phrase){
  const parts = phrase.trim().split(/\s+/).filter(Boolean);
  if(parts.length===0) return [];
  const pat = "\\b" + parts.map(p=>p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+") + "\\b";
  const re = new RegExp(pat, "gi");
  const out = [];
  let m;
  while((m = re.exec(text)) !== null){
    out.push({start:m.index, end:m.index + m[0].length, value:m[0]});
  }
  return out;
}


function getDictHints(word){
  // Preferred: datadictionary_APP_OK.js exposes window.DICT_LOOKUP(query) -> {fr:[...]}
  // Fallback: window.DICT (object / array)
  const q = String(word||"").trim();
  if(!q) return [];

  // 1) Fast path: lookup function
  const lk = window.DICT_LOOKUP;
  if(typeof lk === "function"){
    try{
      const r = lk(q);
      if(r && Array.isArray(r.fr) && r.fr.length) return r.fr.slice(0,6);
    }catch(e){}
  }

  // 2) Previous formats
  const D = window.DICT;
  if(!D) return [];
  const k1 = q;
  const k2 = q.toLowerCase();
  try{
    if(Array.isArray(D)){
      if(!window.__DICT_CACHE){
        const m = new Map();
        D.forEach(item=>{
          if(!item) return;
          const en = String(item.en||item.EN||"").trim();
          if(!en) return;
          let fr = item.fr || item.FR || item.syn || item.synonyms || item.s;
          let arr = [];
          if(Array.isArray(fr)) arr = fr;
          else if(typeof fr === "string") arr = fr.split(/[;,/]/).map(s=>s.trim()).filter(Boolean);
          if(arr.length) m.set(en.toLowerCase(), arr);
        });
        window.__DICT_CACHE = m;
      }
      const arr = window.__DICT_CACHE.get(k2);
      return Array.isArray(arr) ? arr.slice(0,6) : [];
    }

    if(typeof D === "object"){
      // our wrapper shape supports _lookup()
      if(typeof D._lookup === "function"){
        const arr = D._lookup(q);
        return Array.isArray(arr) ? arr.slice(0,6) : [];
      }
      let v = D[k1] ?? D[k2];
      if(!v) return [];
      if(Array.isArray(v)) return v.slice(0,6);
      if(typeof v === "string") return v.split(/[;,/]/).map(s=>s.trim()).filter(Boolean).slice(0,6);
    }
  }catch(e){
    return [];
  }
  return [];
}



function normalizeHint(s){
  return String(s||"").trim().toLowerCase().replace(/[\s\-_/]+/g," ").replace(/[^\w\s]/g,"");
}
function chooseUsefulHint(answer, hints){
  const ansN = normalizeHint(answer);
  const clean = (hints||[]).map(h=>String(h||"").trim()).filter(Boolean);
  if(clean.length===0) return "";
  const useful = clean.filter(h => normalizeHint(h) && normalizeHint(h) !== ansN);
  if(useful.length) return useful[Math.floor(Math.random()*useful.length)];
  return clean[Math.floor(Math.random()*clean.length)];
}

function splitFrenchHints(fr){
  const raw = String(fr||"");
  const parts = raw.split(/[;,/]/).map(s=>s.trim()).filter(Boolean);
  return parts.filter(p=>p.length<=28);
}

function vocabVariants(en){
  const base = String(en||"").trim();
  if(!base) return [];
  const out = new Set([base]);

  if(/^to\s+/i.test(base)){
    const v = base.replace(/^to\s+/i,"").trim();
    if(v){
      out.add(v);
      out.add(v+"s");
      out.add(v+"ed");
      out.add(v+"ing");
    }
    return Array.from(out);
  }

  if(/^[a-zA-Z][a-zA-Z-]*$/.test(base) && !/s$/i.test(base)){
    out.add(base+"s");
  }
  return Array.from(out);
}

function buildVocabHintMap(){
  const map = new Map(); // lower phrase -> {frHints:[]}
  VOCAB.forEach(c=>{
    const hints = splitFrenchHints(c.fr);
    const dictHints = getDictHints(c.en) || [];
    const defaultHints = Array.from(new Set([...(hints.length ? hints : [String(c.fr||"").trim()]), ...dictHints]));
    vocabVariants(c.en).forEach(v=>{
      const k = v.toLowerCase();
      if(!map.has(k)){
        map.set(k, {frHints: defaultHints});
      } else {
        const obj = map.get(k);
        obj.frHints = Array.from(new Set([...(obj.frHints||[]), ...defaultHints]));
      }
    });
  });
  return map;
}

let VOCAB_HINT_MAP = null;

function buildLegend(focus){
  const parts = [];
  parts.push(`<div class="notice"><b>Consigne :</b> complète les trous en anglais. (50% = dur)</div>`);

  if(focus==="vocab" || focus==="mixed"){
    parts.push(`<div class="notice">• <b>Vocab</b> : indice FR (sens/définition). Exemple : <i>pressure drop</i> → “perte de charge”.</div>`);
    parts.push(`<div class="notice">• Si tu as un sigle type <b>RCI</b> et l’indice est identique : ajoute une entrée dans <b>datadictionary.js</b> : <code>"RCI": ["ventilation double flux", "heat recovery unit"]</code>.</div>`);
    parts.push(`<div class="notice">• Astuce : active <b>Banque de mots</b> → tu as une liste de réponses possibles à taper/coller.</div>`);
  }

  if(focus==="grammar" || focus==="mixed"){
    parts.push(`<div class="notice"><b>Grammaire – indices :</b></div>`);
    parts.push(`<div class="notice">• <span class="ghint">+++</span> = plus / more / higher → <i>more efficient than</i></div>`);
    parts.push(`<div class="notice">• <span class="ghint">---</span> = moins / less / lower → <i>less noisy than</i></div>`);
    parts.push(`<div class="notice">• <span class="ghint">≠</span> = comparaison → pense à <i>than</i></div>`);
    parts.push(`<div class="notice">• <span class="ghint">=</span> = égalité → pense à <i>as … as</i></div>`);
    parts.push(`<div class="notice">• <span class="ghint">CAUSE</span> → <i>because / due to</i></div>`);
    parts.push(`<div class="notice">• <span class="ghint">⇒</span> conséquence → <i>therefore / as a result</i></div>`);
    parts.push(`<div class="notice">• <span class="ghint">↔</span> opposition → <i>however / although</i></div>`);
    parts.push(`<div class="notice">• <span class="ghint">≈</span> approx → <i>about / roughly / approximately</i></div>`);
    parts.push(`<div class="notice">• <span class="ghint">🔁</span> fréquence → <i>usually / always / never</i></div>`);
    parts.push(`<div class="notice">• <span class="ghint">⏱</span> temps → <i>right now / yesterday</i></div>`);
  }

  parts.push(`<div class="notice">Boutons : <b>Corriger</b> → OK/KO • <b>Afficher réponses</b> → solutions.</div>`);
  return `<div style="margin-bottom:10px;">${parts.join("")}</div>`;
}


function renderWordBank(answers){
  const wb = document.getElementById("wordBank");
  const toggle = document.getElementById("useWordBank");
  if(!wb) return;

  const enabled = !!(toggle && toggle.checked);
  if(!enabled){
    wb.style.display = "none";
    wb.innerHTML = "";
    return;
  }

  const uniq = Array.from(new Set((answers||[]).map(a=>String(a||"").trim()).filter(Boolean)));
  shuffle(uniq);
  const shown = uniq.slice(0, 60);

  wb.style.display = shown.length ? "block" : "none";
  wb.innerHTML = `<div class="title">Banque de mots (tap → remplir le trou actif)</div><div class="chips"></div>`;
  const chips = wb.querySelector(".chips");

  shown.forEach(w=>{
    const b=document.createElement("div");
    b.className="chip";
    b.textContent=w;
    b.addEventListener("click", ()=>{
      const active = document.activeElement;
      if(active && active.tagName==="INPUT" && active.hasAttribute("data-ans")){
        active.value = w;
        active.focus();
        return;
      }
      const root = document.getElementById("clozeRoot");
      if(!root) return;
      const firstEmpty = Array.from(root.querySelectorAll('input[data-ans]')).find(i=>!(i.value||"").trim());
      if(firstEmpty){
        firstEmpty.value = w;
        firstEmpty.focus();
      }
    });
    chips.appendChild(b);
  });
}

function generateCloze(){
  const source = $("textSource").value || "";
  if(!source.trim()){
    $("textExercise").innerHTML = `<span class="notice">Colle un texte d'abord.</span>`;
    return;
  }

  const focus = $("textFocus").value;
  const unit = $("textUnit").value;
  const selectedUnits = getSelectedUnits();
  const rate = parseFloat($("blankRate").value || "0.50");
  const blankUnits = $("blankUnits").checked;

  if(!VOCAB_HINT_MAP) VOCAB_HINT_MAP = buildVocabHintMap();

  let candidates = [];

  if(focus==="vocab" || focus==="mixed"){
    const vocabPool = (unit==="ALL") ? VOCAB : VOCAB.filter(c=>c.unit===unit);
    vocabPool.forEach(c=>{
      vocabVariants(c.en).forEach(v=> candidates.push({phrase:v, type:"vocab"}));
    });
  }

  if(focus==="grammar" || focus==="mixed"){
    grammarTargetsForUnit(unit).forEach(t=> candidates.push({phrase:t, type:"grammar"}));
  }

  if(blankUnits){
    unitTokens().forEach(t=> candidates.push({phrase:t, type:"unit"}));
  }

  const uniq = new Map();
  candidates.forEach(c=>{
    const k = c.phrase.toLowerCase();
    if(!uniq.has(k)) uniq.set(k, c);
  });
  candidates = Array.from(uniq.values()).sort((a,b)=>b.phrase.length - a.phrase.length);

  let occ = [];
  const lowerSource = source.toLowerCase();

  candidates.forEach(c=>{
    const key = c.phrase.toLowerCase();
    if(!lowerSource.includes(key)) return;

    const found = findOccurrences(source, c.phrase);
    found.forEach(o=>{
      let hint = "";
      if(c.type==="vocab"){
        const info = VOCAB_HINT_MAP.get(key);
        const hints = (info && info.frHints && info.frHints.length) ? info.frHints : [];
        hint = chooseUsefulHint(o.value, hints);
        if(!hint) hint = "FR";
      } else if(c.type==="grammar"){
        hint = grammarHint(key);
      } else if(c.type==="unit"){
        hint = "UNIT";
      }
      occ.push({ ...o, type:c.type, hint });
    });
  });

  // extra word pool to reach 50% easier
  const wordOcc = [];
  const wordRe = /\b[a-zA-Z][a-zA-Z'-]{2,}\b/g;
  let m;
  while((m=wordRe.exec(source))!==null){
    wordOcc.push({start:m.index, end:m.index+m[0].length, value:m[0], type:"auto", hint:""});
  }

  // Remove exact duplicate spans
  const spanKey = (o)=> `${o.start}:${o.end}`;
  const seen = new Set();
  occ = occ.filter(o=>{
    const k=spanKey(o);
    if(seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const tokenCount = source.split(/\s+/).filter(Boolean).length;
  const desired = Math.max(1, Math.round(tokenCount * rate));
  const HARD_CAP = 140;
  const targetCount = Math.min(HARD_CAP, desired);

  const chosen = [];
  const used = [];

  function overlaps(o){
    return used.some(u => !(o.end <= u.start || o.start >= u.end));
  }

  shuffle(occ);
  for(const o of occ){
    if(chosen.length>=targetCount) break;
    if(overlaps(o)) continue;
    chosen.push(o);
    used.push({start:o.start, end:o.end});
  }

  shuffle(wordOcc);
  for(const o of wordOcc){
    if(chosen.length>=targetCount) break;
    if(overlaps(o)) continue;
    const w = o.value.toLowerCase();
    if(["the","and","for","with","that","this","from","into","over","under","then"].includes(w)) continue;
    chosen.push(o);
    used.push({start:o.start, end:o.end});
  }

  chosen.sort((a,b)=>b.start-a.start);
  let cursor = source.length;
  const parts = [];
  let idx = 1;

  for(const o of chosen){
    parts.unshift(escapeHtml2(source.slice(o.end, cursor)));

    const ans = source.slice(o.start, o.end);
    const safeAns = escapeHtml2(ans);

    let hintSpan = "";
    if(o.type==="vocab"){
      hintSpan = `<span class="hintfr">${escapeHtml2(o.hint || "")}</span>`;
    } else if(o.type==="grammar"){
      hintSpan = `<span class="ghint">${escapeHtml2(o.hint || "•")}</span>`;
    } else if(o.type==="unit"){
      hintSpan = `<span class="ghint">UNIT</span>`;
    } else if(o.type==="auto"){
      const dh = getDictHints(ans) || [];
      const h = chooseUsefulHint(ans, dh);
      if(h) hintSpan = `<span class="hintfr">${escapeHtml2(h)}</span>`;
    }

    const input = `<span class="num">(${idx})</span>` +
                  `<input data-ans="${safeAns}" placeholder="…" inputmode="text" autocomplete="off" autocapitalize="none" />` +
                  hintSpan +
                  `<span class="ans">[${safeAns}]</span>`;

    parts.unshift(input);
    cursor = o.start;
    idx++;
  }
  parts.unshift(escapeHtml2(source.slice(0, cursor)));

  const legend = buildLegend(focus);
  const clozeHtml = `${legend}<div class="cloze" id="clozeRoot">${parts.join("")}</div>`;

  textState = { answers: chosen.map(x=>source.slice(x.start, x.end)) };
  renderWordBank(textState.answers);


  $("textScore").textContent = "—";
  $("textExercise").innerHTML = clozeHtml;
}

function checkCloze(){
  const root = document.getElementById("clozeRoot");
  if(!root) return;
  const inputs = Array.from(root.querySelectorAll("input[data-ans]"));
  if(inputs.length===0) return;

  let ok=0;
  inputs.forEach(inp=>{
    const exp = (inp.getAttribute("data-ans")||"").trim().toLowerCase();
    const val = (inp.value||"").trim().toLowerCase();
    inp.classList.remove("ok","bad");
    if(val && val===exp){
      ok++;
      inp.classList.add("ok");
    } else {
      inp.classList.add("bad");
    }
  });
  $("textScore").textContent = `${ok} / ${inputs.length}`;
}

function revealCloze(){
  const root = document.getElementById("clozeRoot");
  if(!root) return;
  root.classList.toggle("reveal");
}

function initTexts(){
  const wbT = document.getElementById("useWordBank");
  if(wbT){ wbT.addEventListener("change", ()=>{ if(textState && textState.answers) renderWordBank(textState.answers); }); }

  $("btnGenText").addEventListener("click", (e)=>{
    e.preventDefault();
    generateCloze();
  });
  $("btnClearText").addEventListener("click", ()=>{
    $("textSource").value = "";
    $("textExercise").innerHTML = `<span class="notice">Colle un texte puis génère.</span>`;
    $("textScore").textContent = "—";
  });
  $("btnCheckText").addEventListener("click", (e)=>{
    e.preventDefault();
    checkCloze();
  });
  $("btnRevealText").addEventListener("click", (e)=>{
    e.preventDefault();
    revealCloze();
  });

  $("fileTextImport").addEventListener("change", async (e)=>{
    const f = e.target.files && e.target.files[0];
    if(!f) return;
    const txt = await f.text();
    $("textSource").value = txt;
    e.target.value="";
  });

  $("btnExampleText").addEventListener("click", ()=>{
    $("textSource").value =
`During commissioning, we measured the pressure drop across the filter. The airflow rate was approximately 500 m³/h, and the supply air temperature was about 18°C. However, the sensor was wired incorrectly; therefore, the controller did not regulate the setpoint correctly. We are calibrating the sensors right now, and we usually document each step in the report. This fan is quieter than the old one, but the new duct is slightly smaller.`;
  });

  $("textExercise").innerHTML = `<span class="notice">Colle un texte puis génère (50% = très dur).</span>`;
}


window.addEventListener("DOMContentLoaded", ()=>{
  try{
  // Load progress
  SEEN = loadIdSet(LS_KEYS.seen);
  LIKED = loadIdSet(LS_KEYS.liked);
  SRS = loadSRS();

  // Sanity check
  if(!Array.isArray(DEFAULT_VOCAB) || DEFAULT_VOCAB.length===0){
    showError("Aucune donnée vocab (data.js non chargé). Vérifie que data.js est bien dans le dossier et que tu ouvres index.html depuis le même dossier.");
  }

  // If user has no saved vocab yet, store defaults so CRUD works
  const stored = loadVocab();
  if(!stored){
    saveVocab(DEFAULT_VOCAB);
    VOCAB = [...DEFAULT_VOCAB];
  } else {
    VOCAB = stored;
  }

  // Safety: if data missing, still show something
  if(!Array.isArray(VOCAB) || VOCAB.length===0){
    VOCAB = [...DEFAULT_VOCAB];
  }

  initTabs();
  hydrateUnitSelects();

  initVocab();
  initDb();
  initTexts();
  // initTextLibrary will be called after optional script load
  initTests();

  setDeckFromFilters();
  renderDbTable();

  $("globalCount").textContent = `${VOCAB.length} cartes`;
  updateQuickCounts();

  // Optional user libraries
  bootOptionalLibraries();

  // Offline disabled (avoid cache issues)
  }catch(e){
    console.error(e);
    showError("Erreur JS: " + (e && e.message ? e.message : e));
  }
});
function showToast(msg){
  const t = document.getElementById("toast");
  if(!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(window.__toastT);
  window.__toastT = setTimeout(()=> t.classList.remove("show"), 1200);
}
