
/* TB1 Flashcards – Units 1–6
   - Vocab cards (FR↔EN random per card, stable within deck)
   - Examples EN visible, FR hidden toggle
   - Grammar tab with real technical cases + exercises
   - Tests tab (vocab / grammar / mixed)
*/

const $ = (id) => document.getElementById(id);

function shuffle(arr){
  const a = arr.slice();
  for(let i=a.length-1; i>0; i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}

function hash32(str){
  // simple deterministic hash
  let h = 2166136261;
  for(let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function primaryFr(fr){
  if(!fr) return "";
  let s = fr.split(";")[0];
  s = s.split(",")[0];
  s = s.replace(/\(.*?\)/g, "").trim();
  return s || fr.trim();
}

function baseVerb(en){
  return en.replace(/^to\s+/i,"").trim();
}

const CONNECTORS = {
  contrast: new Set(["however","nevertheless","although","though","whereas","while","yet","on the other hand"]),
  cause: new Set(["because","since","as","therefore","thus","so","as a result","consequently","hence"]),
  addition: new Set(["moreover","furthermore","in addition","also","besides","what is more"]),
  example: new Set(["for example","e.g.","such as"]),
  clarify: new Set(["that is","i.e.","in other words"])
};

function isConnector(term){
  const t = term.toLowerCase();
  return CONNECTORS.contrast.has(t) || CONNECTORS.cause.has(t) || CONNECTORS.addition.has(t) ||
         CONNECTORS.example.has(t) || CONNECTORS.clarify.has(t);
}

function connectorType(term){
  const t = term.toLowerCase();
  if(CONNECTORS.contrast.has(t)) return "contrast";
  if(CONNECTORS.cause.has(t)) return "cause";
  if(CONNECTORS.addition.has(t)) return "addition";
  if(CONNECTORS.example.has(t)) return "example";
  if(CONNECTORS.clarify.has(t)) return "clarify";
  return "other";
}

function pickTwoTemplates(templates, seed){
  if(templates.length <= 2) return templates.slice(0,2);
  const a = templates[Math.abs(seed) % templates.length];
  const b = templates[Math.abs(seed*2654435761) % templates.length];
  return (a === b) ? [a, templates[(Math.abs(seed)+1) % templates.length]] : [a,b];
}

function getExamples(card){
  const seed = hash32(card.en + "|" + card.fr + "|" + card.unit);
  const fr0 = primaryFr(card.fr);
  const enTerm = card.en;
  const unit = card.unit;

  // Templates
  const verbT = [
    {
      en: (v) => `During commissioning, we had to ${v} the setpoints to match the design values.`,
      fr: (vf) => `Lors de la mise en service, nous avons dû ${vf} les consignes pour respecter les valeurs de projet.`
    },
    {
      en: (v) => `The technician will ${v} the readings and update the test report.`,
      fr: (vf) => `Le technicien va ${vf} les mesures et mettre à jour le rapport d’essais.`
    },
    {
      en: (v) => `Before handover, we need to ${v} the system and document the results.`,
      fr: (vf) => `Avant la réception, il faut ${vf} le système et documenter les résultats.`
    }
  ];

  const nounT = [
    {
      en: (t) => `We checked ${t} on site and recorded it in the inspection report.`,
      fr: (tf) => `Nous avons vérifié ${tf} sur site et l’avons noté dans le rapport d’inspection.`
    },
    {
      en: (t) => `Correct ${t} is essential for safe operation and maintenance.`,
      fr: (tf) => `Un(e) ${tf} correct(e) est essentiel(le) pour l’exploitation et la maintenance.`
    },
    {
      en: (t) => `The project documentation includes ${t} with reference values and tolerances.`,
      fr: (tf) => `La documentation du projet inclut ${tf} avec des valeurs de référence et des tolérances.`
    }
  ];

  const adjT = [
    {
      en: (t) => `We selected a ${t} solution to reduce risk and improve reliability.`,
      fr: (tf) => `Nous avons choisi une solution ${tf} pour réduire le risque et améliorer la fiabilité.`
    },
    {
      en: (t) => `The measured value is ${t} within the required tolerance.`,
      fr: (tf) => `La valeur mesurée est ${tf} dans la tolérance exigée.`
    },
    {
      en: (t) => `Use a ${t} method to keep the results consistent across tests.`,
      fr: (tf) => `Utilise une méthode ${tf} pour garder des résultats cohérents entre les essais.`
    }
  ];

  const advT = [
    {
      en: (t) => `The airflow is ${t} higher than expected during peak demand.`,
      fr: (tf) => `Le débit d’air est ${tf} plus élevé que prévu en pointe.`
    },
    {
      en: (t) => `The pressure drop is ${t} stable after balancing.`,
      fr: (tf) => `La perte de charge est ${tf} stable après l’équilibrage.`
    }
  ];

  const connectorTemplates = {
    contrast: [
      {
        en: (c) => `The airflow meets the design value; ${c}, the noise level is still high.`,
        fr: (cf) => `Le débit respecte la valeur de projet ; ${cf}, le niveau sonore reste élevé.`
      },
      {
        en: (c) => `${c}, the fan speed was reduced to keep the room within comfort limits.`,
        fr: (cf) => `${cf}, la vitesse du ventilateur a été réduite pour rester dans les limites de confort.`
      }
    ],
    cause: [
      {
        en: (c) => `The filter was clogged ${c} the pressure drop increased.`,
        fr: (cf) => `Le filtre était encrassé ${cf} la perte de charge a augmenté.`
      },
      {
        en: (c) => `The valve was stuck; ${c}, the coil could not be balanced.`,
        fr: (cf) => `La vanne était bloquée ; ${cf}, la batterie n’a pas pu être équilibrée.`
      }
    ],
    addition: [
      {
        en: (c) => `${c}, we verified the BMS trend logs before closing the report.`,
        fr: (cf) => `${cf}, nous avons vérifié les tendances GTB avant de clôturer le rapport.`
      },
      {
        en: (c) => `We measured temperature; ${c}, we logged humidity for 24 hours.`,
        fr: (cf) => `Nous avons mesuré la température ; ${cf}, nous avons enregistré l’humidité pendant 24 h.`
      }
    ],
    example: [
      {
        en: (c) => `Use certified instruments, ${c} a calibrated manometer.`,
        fr: (cf) => `Utilise des instruments certifiés, ${cf} un manomètre étalonné.`
      },
      {
        en: (c) => `Typical defects include leaks, ${c} damaged seals.`,
        fr: (cf) => `Les défauts typiques incluent les fuites, ${cf} des joints endommagés.`
      }
    ],
    clarify: [
      {
        en: (c) => `Use calibrated instruments, ${c}, devices with valid certificates.`,
        fr: (cf) => `Utilise des instruments étalonnés, ${cf}, avec certificats valides.`
      },
      {
        en: (c) => `Record average values, ${c}, 10‑minute means.`,
        fr: (cf) => `Enregistre des valeurs moyennes, ${cf}, des moyennes sur 10 minutes.`
      }
    ],
    other: [
      {
        en: (c) => `In technical writing, "${c}" helps connect ideas clearly.`,
        fr: (cf) => `En rédaction technique, « ${cf} » aide à relier les idées clairement.`
      },
      {
        en: (c) => `Use "${c}" to structure the reasoning in a report.`,
        fr: (cf) => `Utilise « ${cf} » pour structurer le raisonnement dans un rapport.`
      }
    ]
  };

  const enLower = enTerm.toLowerCase();
  const isVerb = /^to\s+/i.test(enTerm);
  const isAdv = enLower.endsWith("ly") || ["about","roughly","approximately","almost","nearly","virtually","practically"].includes(enLower);
  const nounPhrase = /\s/.test(enTerm) || /^(a|an|the)\s/i.test(enTerm);

  // Unit 5 terms often are connectors; prioritize that
  if(unit === "Unit 5" && isConnector(enTerm)){
    const t = connectorType(enTerm);
    const pool = connectorTemplates[t] || connectorTemplates.other;
    const [a,b] = pickTwoTemplates(pool, seed);
    return [
      {en: a.en(enTerm), fr: a.fr(fr0)},
      {en: b.en(enTerm), fr: b.fr(fr0)}
    ];
  }

  if(isVerb){
    const v = baseVerb(enTerm);
    const [a,b] = pickTwoTemplates(verbT, seed);
    return [
      {en: a.en(v), fr: a.fr(fr0)},
      {en: b.en(v), fr: b.fr(fr0)}
    ];
  }

  if(isAdv || unit === "Unit 4"){
    const [a,b] = pickTwoTemplates(advT, seed);
    return [
      {en: a.en(enTerm), fr: a.fr(fr0)},
      {en: b.en(enTerm), fr: b.fr(fr0)}
    ];
  }

  if(nounPhrase){
    const [a,b] = pickTwoTemplates(nounT, seed);
    return [
      {en: a.en(enTerm), fr: a.fr(fr0)},
      {en: b.en(enTerm), fr: b.fr(fr0)}
    ];
  }

  // adjective/other single words
  const [a,b] = pickTwoTemplates(adjT, seed);
  return [
    {en: a.en(enTerm), fr: a.fr(fr0)},
    {en: b.en(enTerm), fr: b.fr(fr0)}
  ];
}

/* ---------------- Tabs ---------------- */

function setTab(tabId){
  ["tabVocab","tabGrammar","tabTests"].forEach(id=>{
    $(id).classList.toggle("active", id===tabId);
  });
  ["panelVocab","panelGrammar","panelTests"].forEach(id=>{
    $(id).classList.toggle("active", id===("panel"+tabId.replace("tab","")));
  });
  localStorage.setItem("tb1_tab", tabId);
}

function initTabs(){
  $("tabVocab").addEventListener("click", ()=>setTab("tabVocab"));
  $("tabGrammar").addEventListener("click", ()=>setTab("tabGrammar"));
  $("tabTests").addEventListener("click", ()=>setTab("tabTests"));

  const saved = localStorage.getItem("tb1_tab") || "tabVocab";
  setTab(saved);
}

/* ---------------- Vocab ---------------- */

let baseCards = ALL_CARDS.slice();
let working = [];
let deck = [];
let current = 0;
let isFlipped = false;
let status = [];
let dir = []; // "fr_en" or "en_fr" for each card index in deck
let showFrExamples = false;

function buildWorkingSet(){
  const unitFilter = $("unitFilter").value;
  const q = ($("searchBox").value || "").trim().toLowerCase();
  working = baseCards.filter(c=>{
    const okUnit = (unitFilter==="all") ? true : (c.unit === unitFilter);
    if(!okUnit) return false;
    if(!q) return true;
    return (c.en.toLowerCase().includes(q) || c.fr.toLowerCase().includes(q));
  });
  $("countText").textContent = `${working.length} cartes`;
}

function buildDirections(){
  const mode = $("directionMode").value;
  if(mode === "fr_en" || mode === "en_fr"){
    dir = Array(deck.length).fill(mode);
  } else {
    dir = deck.map(()=> (Math.random()<0.5 ? "fr_en" : "en_fr"));
  }
}

function newQuiz(){
  buildWorkingSet();
  deck = shuffle(working);
  current = 0;
  status = Array(deck.length).fill(null);
  buildDirections();
  renderCard();
}

function setFlip(state){
  isFlipped = state;
  $("card3d").classList.toggle("flipped", isFlipped);
  $("hint").textContent = isFlipped ? "Choisis : je connais / je connais pas" : "Clique sur la carte pour la retourner";
  $("actions").style.display = isFlipped ? "flex" : "none";
}

function renderCard(){
  if(deck.length === 0){
    $("unitBadge").textContent = "—";
    $("frontLabel").textContent = "—";
    $("backLabel").textContent = "—";
    $("frontWord").textContent = "Aucune carte (filtre / recherche trop stricts).";
    $("backWord").textContent = "—";
    $("progressText").textContent = `0 / 0`;
    $("progressBar").style.width = `0%`;
    $("examplesEn").innerHTML = "—";
    $("examplesFr").innerHTML = "";
    $("examplesFr").style.display = "none";
    setFlip(false);
    return;
  }

  const c = deck[current];
  const mode = dir[current] || "fr_en";

  const frontText = (mode === "fr_en") ? c.fr : c.en;
  const backText  = (mode === "fr_en") ? c.en : c.fr;

  $("unitBadge").textContent = c.unit;
  $("frontLabel").textContent = (mode === "fr_en") ? "Français" : "English";
  $("backLabel").textContent  = (mode === "fr_en") ? "English" : "Français";
  $("frontWord").textContent = frontText;
  $("backWord").textContent = backText;

  // Examples
  const ex = getExamples(c);
  $("examplesEn").innerHTML = `• ${ex[0].en}<br>• ${ex[1].en}`;
  $("examplesFr").innerHTML = `• ${ex[0].fr}<br>• ${ex[1].fr}`;
  $("examplesFr").style.display = "none";

  // Progress
  $("progressText").textContent = `${current+1} / ${deck.length}`;
  $("progressBar").style.width = `${((current+1)/deck.length)*100}%`;

  setFlip(false);
}

function nextCard(){
  if(deck.length === 0) return;
  current = Math.min(current+1, deck.length-1);
  renderCard();
}

function prevCard(){
  if(deck.length === 0) return;
  current = Math.max(current-1, 0);
  renderCard();
}

function mark(known){
  if(deck.length === 0) return;
  status[current] = known ? "yes" : "no";
  // move forward
  if(current < deck.length-1){
    current++;
    renderCard();
  } else {
    // finished
    $("frontWord").textContent = "Terminé ✅";
    $("backWord").textContent = "Tu peux remélanger ou changer les filtres.";
    $("hint").textContent = `Score: ${status.filter(x=>x==="yes").length} / ${status.length}`;
    $("actions").style.display = "none";
    $("examplesEn").innerHTML = "—";
    $("examplesFr").innerHTML = "";
    $("examplesFr").style.display = "none";
  }
}

function toggleExamplesTranslation(){
  const box = $("examplesFr");
  box.style.display = (box.style.display === "none" || !box.style.display) ? "block" : "none";
}

function initVocab(){
  // populate unit filter
  const units = ["all","Unit 1","Unit 2","Unit 3","Unit 4","Unit 5","Unit 6"];
  units.forEach(u=>{
    const opt = document.createElement("option");
    opt.value = u === "all" ? "all" : u;
    opt.textContent = (u==="all") ? "Toutes les unités" : u;
    $("unitFilter").appendChild(opt);
  });

  // restore settings
  const savedDir = localStorage.getItem("tb1_dir") || "random";
  $("directionMode").value = savedDir;

  $("directionMode").addEventListener("change", ()=>{
    localStorage.setItem("tb1_dir", $("directionMode").value);
    buildDirections();
    renderCard();
  });

  $("unitFilter").addEventListener("change", newQuiz);
  $("searchBox").addEventListener("input", ()=>{
    // don't reshuffle on every keypress; just rebuild working set + re-render current if in range
    buildWorkingSet();
    deck = working.slice();
    current = 0;
    status = Array(deck.length).fill(null);
    buildDirections();
    renderCard();
  });

  $("btnShuffle").addEventListener("click", newQuiz);
  $("btnPrev").addEventListener("click", prevCard);
  $("btnNext").addEventListener("click", nextCard);
  $("btnYes").addEventListener("click", ()=>mark(true));
  $("btnNo").addEventListener("click", ()=>mark(false));
  $("btnToggleTr").addEventListener("click", toggleExamplesTranslation);

  $("scene").addEventListener("click", ()=>setFlip(!isFlipped));

  newQuiz();
}

/* ---------------- Grammar ---------------- */

function renderGrammar(){
  const root = $("grammarRoot");
  root.innerHTML = "";

  GRAMMAR_UNITS.forEach((u, idx)=>{
    const wrap = document.createElement("div");
    wrap.className = "grammar-unit";

    const header = document.createElement("div");
    header.className = "grammar-header";
    header.innerHTML = `<h2>${u.unit} — ${u.title}</h2><div class="chev">▾</div>`;
    wrap.appendChild(header);

    const body = document.createElement("div");
    body.className = "grammar-body";

    u.rules.forEach(r=>{
      const div = document.createElement("div");
      div.className = "rule";
      const patterns = (r.patterns && r.patterns.length) ? `<div class="note"><b>Patterns:</b> ${r.patterns.join(" · ")}</div>` : "";
      const exHtml = (r.examples||[]).map(e=>`<div class="ex">• ${e.en}<div class="fr">→ ${e.fr}</div></div>`).join("");
      div.innerHTML = `<div class="name">${r.name}</div><div class="note">${r.note}</div>${patterns}${exHtml}`;
      body.appendChild(div);
    });

    // exercises
    const exTitle = document.createElement("div");
    exTitle.style.marginTop = "12px";
    exTitle.style.fontWeight = "900";
    exTitle.textContent = "Mini‑exercices";
    body.appendChild(exTitle);

    u.exercises.forEach((ex, exIdx)=>{
      const exWrap = document.createElement("div");
      exWrap.className = "exercise";
      const exId = `g_${idx}_${exIdx}`;

      let inputHtml = "";
      if(ex.type === "mcq"){
        inputHtml = `<div class="opts">${
          ex.options.map((o,i)=>`
            <label style="display:flex; gap:10px; align-items:flex-start;">
              <input type="radio" name="${exId}" value="${o}" style="margin-top:3px;">
              <span>${o}</span>
            </label>
          `).join("")
        }</div>`;
      } else {
        inputHtml = `<input type="text" id="${exId}" placeholder="Réponse…">`;
      }

      exWrap.innerHTML = `
        <div class="prompt">${ex.prompt}</div>
        ${inputHtml}
        <button class="check" data-unit="${idx}" data-ex="${exIdx}">Vérifier</button>
        <div class="result" id="${exId}_res"></div>
      `;
      body.appendChild(exWrap);
    });

    wrap.appendChild(body);

    header.addEventListener("click", ()=>{
      const opened = body.style.display === "block";
      body.style.display = opened ? "none" : "block";
      header.querySelector(".chev").textContent = opened ? "▾" : "▴";
    });

    root.appendChild(wrap);
  });

  // delegate checks
  root.addEventListener("click", (e)=>{
    const btn = e.target.closest("button.check");
    if(!btn) return;
    const unitIdx = parseInt(btn.dataset.unit,10);
    const exIdx = parseInt(btn.dataset.ex,10);
    const ex = GRAMMAR_UNITS[unitIdx].exercises[exIdx];

    const resEl = btn.parentElement.querySelector(".result");

    let user = "";
    if(ex.type === "mcq"){
      const name = `g_${unitIdx}_${exIdx}`;
      const checked = btn.parentElement.querySelector(`input[name="${name}"]:checked`);
      user = checked ? checked.value : "";
    } else {
      user = (btn.parentElement.querySelector("input[type='text']").value || "").trim();
    }

    const ok = checkExercise(ex, user);
    resEl.innerHTML = ok
      ? `<span class="good">✅ Correct</span> — ${escapeHtml(ex.explain || "")}`
      : `<span class="bad">❌ Pas encore</span> — Réponse: <b>${escapeHtml(ex.answer)}</b>. ${escapeHtml(ex.explain || "")}`;
  }, { once:false });
}

function normalize(s){ return (s||"").trim().toLowerCase().replace(/\s+/g," "); }

function checkExercise(ex, userAnswer){
  const u = normalize(userAnswer);
  const a = normalize(ex.answer);
  if(!u) return false;
  if(u === a) return true;
  if(ex.alts && ex.alts.some(x=>normalize(x)===u)) return true;
  return false;
}

function escapeHtml(s){
  return (s||"").replace(/[&<>"]/g, (c)=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));
}

/* ---------------- Tests ---------------- */

let testState = null;

function startTest(){
  const mode = $("testMode").value;
  const count = parseInt($("testCount").value,10) || 20;

  const questions = [];
  const poolCards = (working && working.length) ? working : baseCards;

  function addVocabQ(card){
    const dir = (Math.random()<0.5) ? "fr_en" : "en_fr";
    const q = (dir==="fr_en") ? card.fr : card.en;
    const ans = (dir==="fr_en") ? card.en : card.fr;
    questions.push({
      kind:"vocab",
      unit: card.unit,
      prompt:`Traduire: ${q}`,
      answer: ans
    });
  }

  function addGrammarQ(ex, unit){
    if(ex.type === "mcq"){
      questions.push({
        kind:"grammar",
        unit,
        prompt: ex.prompt,
        type:"mcq",
        options: ex.options,
        answer: ex.answer,
        explain: ex.explain || ""
      });
    } else {
      questions.push({
        kind:"grammar",
        unit,
        prompt: ex.prompt,
        type:"fill",
        answer: ex.answer,
        alts: ex.alts || [],
        explain: ex.explain || ""
      });
    }
  }

  if(mode === "vocab" || mode === "mixed"){
    const pick = shuffle(poolCards).slice(0, count);
    pick.forEach(addVocabQ);
  }

  if(mode === "grammar" || mode === "mixed"){
    const allEx = [];
    GRAMMAR_UNITS.forEach(u=>{
      u.exercises.forEach(ex=>allEx.push({ex, unit:u.unit}));
    });
    const pick = shuffle(allEx).slice(0, count);
    pick.forEach(x=>addGrammarQ(x.ex, x.unit));
  }

  // For mixed, we might have 2*count; normalize to count by mixing half/half
  let finalQs = questions;
  if(mode === "mixed"){
    const half = Math.floor(count/2);
    const vocabQs = shuffle(finalQs.filter(q=>q.kind==="vocab")).slice(0, half);
    const gramQs  = shuffle(finalQs.filter(q=>q.kind==="grammar")).slice(0, count-half);
    finalQs = shuffle([...vocabQs, ...gramQs]);
  } else {
    finalQs = shuffle(finalQs).slice(0, count);
  }

  testState = { mode, qs: finalQs, i: 0, score: 0 };
  renderTestQ();
}

function renderTestQ(){
  const box = $("testQ");
  if(!testState || testState.qs.length === 0){
    box.innerHTML = `<div class="notice">Choisis un mode et démarre un test.</div>`;
    $("testScore").textContent = "—";
    return;
  }

  const q = testState.qs[testState.i];
  $("testScore").textContent = `${testState.score} / ${testState.qs.length} (Q${testState.i+1})`;

  if(q.kind === "vocab"){
    box.innerHTML = `
      <div class="tests-q">
        <div class="meta">${q.unit} · Vocab</div>
        <div class="question">${escapeHtml(q.prompt)}</div>
        <input id="testInput" type="text" placeholder="Ta réponse…">
        <div class="tests-actions">
          <button class="primary" id="btnCheck">Valider</button>
          <button class="secondary" id="btnReveal">Voir réponse</button>
        </div>
        <div id="testFeedback" class="result"></div>
      </div>
    `;
    $("btnCheck").addEventListener("click", ()=>checkTestAnswer());
    $("btnReveal").addEventListener("click", ()=>revealTestAnswer());
    $("testInput").addEventListener("keydown", (e)=>{ if(e.key==="Enter") checkTestAnswer(); });
    $("testInput").focus();
  } else {
    if(q.type === "mcq"){
      box.innerHTML = `
        <div class="tests-q">
          <div class="meta">${q.unit} · Grammaire</div>
          <div class="question">${escapeHtml(q.prompt)}</div>
          <div class="opts" id="testOpts">
            ${q.options.map(o=>`
              <label style="display:flex; gap:10px; align-items:flex-start; margin-bottom:8px;">
                <input type="radio" name="test_mcq" value="${escapeHtml(o)}" style="margin-top:3px;">
                <span>${escapeHtml(o)}</span>
              </label>
            `).join("")}
          </div>
          <div class="tests-actions">
            <button class="primary" id="btnCheck">Valider</button>
            <button class="secondary" id="btnReveal">Voir réponse</button>
          </div>
          <div id="testFeedback" class="result"></div>
        </div>
      `;
      $("btnCheck").addEventListener("click", ()=>checkTestAnswer());
      $("btnReveal").addEventListener("click", ()=>revealTestAnswer());
    } else {
      box.innerHTML = `
        <div class="tests-q">
          <div class="meta">${q.unit} · Grammaire</div>
          <div class="question">${escapeHtml(q.prompt)}</div>
          <input id="testInput" type="text" placeholder="Ta réponse…">
          <div class="tests-actions">
            <button class="primary" id="btnCheck">Valider</button>
            <button class="secondary" id="btnReveal">Voir réponse</button>
          </div>
          <div id="testFeedback" class="result"></div>
        </div>
      `;
      $("btnCheck").addEventListener("click", ()=>checkTestAnswer());
      $("btnReveal").addEventListener("click", ()=>revealTestAnswer());
      $("testInput").addEventListener("keydown", (e)=>{ if(e.key==="Enter") checkTestAnswer(); });
      $("testInput").focus();
    }
  }
}

function currentTestUserAnswer(){
  const q = testState.qs[testState.i];
  if(q.kind === "vocab" || q.type === "fill"){
    return ($("testInput").value || "").trim();
  }
  // mcq
  const checked = document.querySelector("input[name='test_mcq']:checked");
  return checked ? checked.value : "";
}

function isCorrectTestAnswer(q, user){
  const u = normalize(user);
  const a = normalize(q.answer);
  if(!u) return false;
  if(u === a) return true;
  if(q.alts && q.alts.some(x=>normalize(x)===u)) return true;
  return false;
}

function checkTestAnswer(){
  const q = testState.qs[testState.i];
  const user = currentTestUserAnswer();
  const ok = isCorrectTestAnswer(q, user);

  const fb = $("testFeedback");
  if(ok){
    testState.score++;
    fb.innerHTML = `<span class="good">✅ Correct</span>`;
  } else {
    fb.innerHTML = `<span class="bad">❌</span> Réponse: <b>${escapeHtml(q.answer)}</b>${q.explain ? " — "+escapeHtml(q.explain) : ""}`;
  }

  // go next after short delay
  setTimeout(()=>{
    if(testState.i < testState.qs.length-1){
      testState.i++;
      renderTestQ();
    } else {
      $("testQ").innerHTML = `<div class="notice">Test terminé ✅ Score: <b>${testState.score} / ${testState.qs.length}</b></div>`;
      $("testScore").textContent = `${testState.score} / ${testState.qs.length}`;
    }
  }, 650);
}

function revealTestAnswer(){
  const q = testState.qs[testState.i];
  const fb = $("testFeedback");
  fb.innerHTML = `Réponse: <b>${escapeHtml(q.answer)}</b>${q.explain ? " — "+escapeHtml(q.explain) : ""}`;
}

function initTests(){
  $("btnStartTest").addEventListener("click", startTest);
  $("btnRestartTest").addEventListener("click", startTest);
  renderTestQ();
}

/* ---------------- Boot ---------------- */

window.addEventListener("DOMContentLoaded", ()=>{
  initTabs();
  initVocab();
  renderGrammar();
  initTests();
});
