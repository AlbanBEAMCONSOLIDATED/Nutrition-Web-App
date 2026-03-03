/*
  TB1 Flashcards – Minimal
  Important: works when opened directly (file://) because data is embedded in data.js
*/

const LS_KEYS = {
  vocab: "tb1_vocab_min_v1",
  theme: "tb1_theme_min_v1"
};

function $(id){ return document.getElementById(id); }
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
function stripArticle(en){
  return String(en||"").replace(/^(a|an|the)\s+/i,"").trim();
}
function isVerb(en){ return /^to\s+/i.test(String(en||"").trim()); }

function makeExamples(card){
  const en = String(card.en||"").trim();
  const fr0 = primaryFr(card.fr);
  const noun = stripArticle(en);

  if(isVerb(en)){
    const v = en.replace(/^to\s+/i,"").trim();
    return [
      { en: `On site, we often need to ${v} the system to meet the specification.`,
        fr: `Sur site, on doit souvent ${fr0} le système pour respecter les exigences.` },
      { en: `Before handover, the contractor had to ${v} and document the procedure.`,
        fr: `Avant la réception, l’entreprise a dû ${fr0} et documenter la procédure.` },
    ];
  }
  if(/(able|ous|ive|al|ic|ant|ent|ful|less|ly)$/i.test(en)){
    return [
      { en: `Accurate reporting requires the data to be ${en} and traceable.`,
        fr: `Un rapport fiable exige des données ${fr0} et traçables.` },
      { en: `During commissioning, we check that the system remains ${en} under normal conditions.`,
        fr: `Lors de la mise en service, on vérifie que le système reste ${fr0} en conditions normales.` },
    ];
  }
  return [
    { en: `The ${noun} must be specified in the technical report and BIM model.`,
      fr: `Le/la ${fr0} doit être indiqué(e) dans le rapport technique et la maquette BIM.` },
    { en: `During commissioning, we verified the ${noun} on site and recorded the results.`,
      fr: `Lors de la mise en service, on a vérifié le/la ${fr0} sur site et consigné les résultats.` },
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

/* -------- App state -------- */
let VOCAB = [];
let deck = [];
let dir = [];
let current = 0;
let flipped = false;

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

  fill($("unitFilter"), true);
  fill($("dbUnitFilter"), true);
  fill($("editUnit"), false);

  $("unitFilter").value="ALL";
  $("dbUnitFilter").value="ALL";
  $("editUnit").value=units[0] || "Unit 1";
}

function setDeckFromFilters(){
  const u = $("unitFilter").value;
  const q = ($("searchBox").value || "").trim().toLowerCase();

  deck = VOCAB.filter(c=>{
    const okU = (u==="ALL") ? true : (c.unit===u);
    if(!okU) return false;
    if(!q) return true;
    return String(c.en||"").toLowerCase().includes(q) || String(c.fr||"").toLowerCase().includes(q);
  });

  if(deck.length===0) deck = [...VOCAB];
  shuffle(deck);
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

  const ex = makeExamples(c);
  $("examplesEn").innerHTML = `• ${ex[0].en}<br>• ${ex[1].en}`;
  $("examplesFr").innerHTML = `• ${ex[0].fr}<br>• ${ex[1].fr}`;
  $("examplesFr").style.display = "none";

  flipped = false;
  $("card3d").classList.remove("flipped");

  $("progressText").textContent = `${current+1} / ${deck.length}`;
  $("progressBar").style.width = `${((current+1)/deck.length)*100}%`;
  $("globalCount").textContent = `${VOCAB.length} cartes`;
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
  $("btnShuffle").addEventListener("click", setDeckFromFilters);
  $("unitFilter").addEventListener("change", setDeckFromFilters);
  $("directionMode").addEventListener("change", ()=>{
    buildDirections();
    renderCard();
  });
  $("searchBox").addEventListener("input", ()=>{
    clearTimeout(window.__qT);
    window.__qT = setTimeout(setDeckFromFilters, 150);
  });

  $("btnPrev").addEventListener("click", prev);
  $("btnNext").addEventListener("click", next);

  $("btnYes").addEventListener("click", next);
  $("btnNo").addEventListener("click", next);

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
    const defaultHints = hints.length ? hints : [String(c.fr||"").trim()];
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
  parts.push(`<div class="notice"><b>Consigne :</b> complète les trous en anglais.</div>`);
  if(focus==="vocab" || focus==="mixed"){
    parts.push(`<div class="notice">• <b>Vocab</b> : indice en français (traduction / synonyme si dispo dans la liste FR).</div>`);
  }
  if(focus==="grammar" || focus==="mixed"){
    parts.push(`<div class="notice">• <b>Grammaire</b> : indices → <span class="ghint">+++</span> (plus), <span class="ghint">---</span> (moins), <span class="ghint">≈</span> (approx), <span class="ghint">⇒</span> (conséquence), <span class="ghint">↔</span> (opposition), <span class="ghint">🔁</span> (fréquence), <span class="ghint">⏱</span> (temps).</div>`);
  }
  parts.push(`<div class="notice">• <b>Corriger</b> : surligne OK/KO • <b>Afficher réponses</b> : montre les solutions.</div>`);
  return `<div style="margin-bottom:10px;">${parts.join("")}</div>`;
}

function generateCloze(){
  const source = $("textSource").value || "";
  if(!source.trim()){
    $("textExercise").innerHTML = `<span class="notice">Colle un texte d'abord.</span>`;
    return;
  }

  const focus = $("textFocus").value;
  const unit = $("textUnit").value;
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
        hint = hints.length ? hints[Math.floor(Math.random()*hints.length)] : "FR";
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
  initTests();

  setDeckFromFilters();
  renderDbTable();

  $("globalCount").textContent = `${VOCAB.length} cartes`;
});