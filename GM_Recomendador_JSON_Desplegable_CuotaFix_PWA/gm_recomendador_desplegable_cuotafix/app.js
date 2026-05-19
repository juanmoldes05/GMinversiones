const PHONE = '17549713882';
const DATA_URL = './unidades.json';

let rawData = null;
let units = [];
let openIndex = 0;
let state = {
  age: 'initial',
  objective: 'start',
  zone: 'north',
  product: 'residential',
  down: 'd75',
  monthly: 'm5000'
};

const questions = [
  {
    key: 'age',
    title: '¿En qué etapa estás?',
    hint: 'La edad no baja automáticamente el ticket. Solo ayuda a ordenar el lenguaje comercial.',
    options: [
      ['initial', '21 a 29', 'Primeros pasos patrimoniales'],
      ['middle', '30 a 40', 'Etapa de acumulación'],
      ['senior', '40+', 'Capital más consolidado']
    ]
  },
  {
    key: 'objective',
    title: '¿Cuál es tu objetivo principal?',
    hint: 'Esto reemplaza la experiencia inversora. Elegí el objetivo más cercano a tu situación.',
    options: [
      ['start', 'Empezar a invertir', 'Entrar al real estate con lógica simple'],
      ['rent', 'Buscar renta tradicional', 'Priorizar liquidez y alquiler futuro'],
      ['return', 'Volver o usar en Argentina', 'Pensar en uso futuro y ubicación'],
      ['grow', 'Aumentar capital de inversión', 'Escalar cartera, tickets o packs']
    ]
  },
  {
    key: 'zone',
    title: '¿Qué zona querés mirar?',
    hint: 'GBA es la opción más amplia: incluye CABA completa y Canning.',
    options: [
      ['north', 'Corredor norte', 'Palermo, Núñez, Colegiales, Belgrano y Saavedra'],
      ['caba', 'CABA general', 'Todas las opciones de Capital'],
      ['gba', 'GBA', 'Opción amplia: CABA + GBA / Canning']
    ]
  },
  {
    key: 'product',
    title: '¿Qué tipo de producto te interesa?',
    hint: 'Si tu capacidad lo permite, la app puede sugerir packs aunque no seas inversor experimentado.',
    options: [
      ['residential', 'Departamentos', 'Unidades residenciales para renta, reventa o uso futuro'],
      ['commercial', 'Locales comerciales', 'Productos comerciales o patrimoniales'],
      ['bulk', 'Packs / oportunidades', 'Combinaciones de unidades y compras por cantidad']
    ]
  },
  {
    key: 'down',
    title: '¿Qué anticipo te resulta cómodo?',
    hint: 'No es una reserva ni compromiso. Sirve para filtrar opciones realistas.',
    options: [
      ['d35', 'USD 35.000 o menos', 'Entrada más liviana'],
      ['d75', 'USD 35.000 - 75.000', 'Rango medio flexible'],
      ['d150', 'USD 75.000 - 150.000', 'Permite tickets sólidos'],
      ['dplus', 'USD 150.000+', 'Puede abrir locales, unidades grandes o packs']
    ]
  },
  {
    key: 'monthly',
    title: '¿Qué cuota mensual podrías sostener?',
    hint: 'La recomendación se guía principalmente por este número y por el anticipo.',
    options: [
      ['m2000', 'USD 2.000 o menos', 'Bajo impacto mensual'],
      ['m5000', 'USD 2.000 - 5.000', 'Capacidad media'],
      ['m10000', 'USD 5.000 - 10.000', 'Capacidad alta'],
      ['mplus', 'USD 10.000+', 'Capacidad para estrategias grandes']
    ]
  }
];

const money = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const topNorth = new Set(['Palermo Hollywood','Palermo','Núñez','Belgrano','Saavedra','Colegiales']);

function usd(v){
  const n = Number(v);
  return Number.isFinite(n) ? `USD ${money.format(n)}` : 'Dato no informado';
}
function fmtM2(v){
  const n = Number(v);
  return Number.isFinite(n) ? `${number.format(n)} m²` : 'Dato no informado';
}
function asNum(v){
  if(v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function norm(s){ return String(s || '').trim(); }
function isAvailable(u){ return norm(u.estado).toLowerCase() === 'disponible'; }
function isLocal(u){ return norm(u.tipo_producto).toLowerCase().includes('local'); }
function isResidential(u){ return norm(u.tipo_producto).toLowerCase().includes('residencial'); }
function isEmprendeprop(u){ return norm(u.desarrolladora).toLowerCase().includes('emprendeprop') || norm(u.desarrolladora).toLowerCase().includes('club conecta'); }
function isFuture(u){ return /2028|2029|futura|pozo|fideicomiso/i.test(`${u.entrega} ${u.estado_obra} ${u.forma_pago}`); }
function hasNumbers(u){ return asNum(u.precio) && asNum(u.anticipo) && asNum(u.cuota_estimada); }

function maxDown(p = state){
  return {d35:35000, d75:75000, d150:150000, dplus:99999999}[p.down] || 75000;
}
function maxMonth(p = state){
  return {m2000:2000, m5000:5000, m10000:10000, mplus:99999999}[p.monthly] || 5000;
}
function capacityLevel(p = state){
  // Capacidad comercial, sin convertir el rango USD 5.000 - 10.000 en presupuesto ilimitado.
  // Solo es capacidad máxima cuando el usuario eligió simultáneamente anticipo 150k+ y cuota 10k+.
  if(p.down === 'dplus' && p.monthly === 'mplus') return 'max';
  if(p.down === 'dplus' || p.monthly === 'mplus') return 'very_high';
  if(p.down === 'd150' || p.monthly === 'm10000') return 'high';
  if(p.down === 'd75' || p.monthly === 'm5000') return 'medium';
  return 'entry';
}
function highCapacity(p = state){ return ['high','very_high','max'].includes(capacityLevel(p)); }
function maxCapacity(p = state){ return p.down === 'dplus' && p.monthly === 'mplus'; }
function monthlyBudgetOkAmount(month, p = state){
  // La cuota elegida funciona como límite duro.
  // Ej.: si eligió hasta USD 10.000/mes, nunca aparece una opción o pack de USD 22.000/mes.
  const maxM = maxMonth(p);
  if(p.monthly !== 'mplus' && Number.isFinite(month) && month > maxM) return false;
  return true;
}
function monthlyBudgetOk(u, p = state){
  return monthlyBudgetOkAmount(asNum(u.cuota_estimada), p);
}

function zoneOk(u, p = state){
  if(p.zone === 'gba') return true; // opción amplia: CABA + GBA / Canning
  if(p.zone === 'caba') return norm(u.zona) === 'corredor_norte' || norm(u.zona) === 'caba_general';
  if(p.zone === 'north') return norm(u.zona) === 'corredor_norte' || topNorth.has(norm(u.barrio));
  return true;
}
function productOk(u, p = state){
  if(p.product === 'commercial') return isLocal(u);
  if(p.product === 'bulk') return !isLocal(u) && isResidential(u);
  return isResidential(u);
}
function objectiveLabel(){
  const q = questions.find(x => x.key === 'objective');
  return optionSubtitle(q, state.objective).split(' · ')[0] || 'perfil inversor';
}
function targetPriceRange(p = state){
  const c = capacityLevel(p);
  if(c === 'entry') return [0, 135000];
  if(c === 'medium') return [85000, 210000];
  if(c === 'high') return [135000, 320000];
  if(c === 'very_high') return [220000, 650000];
  return [280000, 5000000];
}

function locationScore(u, p, reasons){
  let s = 0;
  const barrio = norm(u.barrio);
  if(p.zone === 'north' && zoneOk(u,p)){ s += 34; reasons.push('encaja con corredor norte'); }
  else if(p.zone === 'caba' && zoneOk(u,p)){ s += 22; reasons.push('encaja con CABA general'); }
  else if(p.zone === 'gba'){ s += 12; reasons.push('entra dentro de GBA ampliado: CABA + GBA'); }
  if(['Palermo Hollywood','Núñez','Colegiales','Belgrano','Saavedra'].includes(barrio)){ s += 12; reasons.push('barrio líquido del corredor norte'); }
  return s;
}
function affordabilityScore(u, p, reasons){
  let s = 0;
  const down = asNum(u.anticipo), month = asNum(u.cuota_estimada);
  if(down === null || month === null) return -999;
  if(down <= maxDown(p)){ s += 26; reasons.push('anticipo dentro del rango indicado'); }
  else { s -= Math.min(38, (down / maxDown(p)) * 14); reasons.push('anticipo algo exigente frente al rango indicado'); }
  if(month <= maxMonth(p)){ s += 34; reasons.push('cuota dentro del rango cómodo'); }
  else { s -= Math.min(44, (month / maxMonth(p)) * 16); reasons.push('cuota por encima del rango cómodo'); }
  if(month <= maxMonth(p) * .62){ s += 6; reasons.push('buen margen mensual'); }
  return s;
}
function ticketScore(u, p, reasons){
  const price = asNum(u.precio) || 0;
  const [lo, hi] = targetPriceRange(p);
  let s = 0;
  if(price >= lo && price <= hi){ s += 24; reasons.push('ticket alineado con tu capacidad'); }
  if(price < lo){
    if(maxCapacity(p)){ s -= 34; reasons.push('ticket bajo para la capacidad ingresada'); }
    else s += 6;
  }
  if(price > hi && !maxCapacity(p)) s -= 18;
  if(maxCapacity(p)){
    if(price >= 300000) s += 28;
    else if(price >= 220000) s += 14;
  }
  return s;
}
function objectiveScore(u, p, reasons){
  let s = 0;
  const rooms = asNum(u.ambientes) || 0;
  const m2 = asNum(u.m2) || 0;
  const barrio = norm(u.barrio);
  const price = asNum(u.precio) || 0;
  if(p.objective === 'start'){
    if(!isLocal(u) && rooms <= 2) s += 15;
    if(asNum(u.cuota_estimada) <= maxMonth(p)) s += 10;
    if(isEmprendeprop(u)) s += 9;
    reasons.push('objetivo: empezar a invertir');
  }
  if(p.objective === 'rent'){
    if(!isLocal(u) && rooms <= 2) s += 18;
    if(['Palermo Hollywood','Núñez','Colegiales','Belgrano','Villa Devoto','Boedo'].includes(barrio)) s += 12;
    reasons.push('objetivo: renta tradicional');
  }
  if(p.objective === 'return'){
    if(!isLocal(u) && rooms >= 2) s += 14;
    if(m2 >= 48) s += 10;
    if(norm(u.zona) === 'corredor_norte') s += 14;
    if(isFuture(u)) s += 8;
    reasons.push('objetivo: regreso o uso futuro en Argentina');
  }
  if(p.objective === 'grow'){
    if(price >= 170000) s += 15;
    if(m2 >= 75) s += 10;
    if(isLocal(u)) s += 20;
    if(isEmprendeprop(u)) s += 12;
    reasons.push('objetivo: aumentar capital de inversión');
  }
  return s;
}
function productScore(u, p, reasons){
  if(p.product === 'commercial'){
    if(isLocal(u)){ reasons.push('producto comercial solicitado'); return 42; }
    return -100;
  }
  if(p.product === 'bulk'){
    reasons.push('producto compatible con compra por cantidad');
    return isLocal(u) ? -100 : 12;
  }
  if(isResidential(u)) return 10;
  return -100;
}
function valueScore(u, reasons){
  let s = 0;
  const psm = asNum(u.precio_m2);
  if(psm && psm <= 2100){ s += 14; reasons.push('precio/m² competitivo'); }
  else if(psm && psm <= 2500){ s += 7; }
  const cash = asNum(u.precio_contado), price = asNum(u.precio);
  if(cash && price && cash / price <= .84){ s += 8; reasons.push('contado atractivo frente al financiado'); }
  return s;
}
function qualityScore(u, reasons){
  let s = 0;
  const layout = norm(u.disposicion).toLowerCase();
  const piso = parseFloat(String(u.piso).replace(',', '.'));
  const ext = (asNum(u.m2_semicubiertos) || 0) + (asNum(u.m2_descubiertos) || 0);
  if(layout.includes('frente')){ s += 6; reasons.push('disposición al frente'); }
  if(Number.isFinite(piso) && piso >= 5){ s += 5; reasons.push('piso medio/alto'); }
  if(ext >= 25){ s += 9; reasons.push('metros exteriores diferenciales'); }
  return s;
}
function futureDeliveryScore(u, p, reasons){
  let s = 0;
  if(isEmprendeprop(u)){
    s += 24;
    reasons.push('Emprendeprop / Club Conecta ponderado como entrega futura planificable');
    if(p.zone === 'north') s += 14;
    if(['start','return','grow'].includes(p.objective)) s += 8;
  } else if(isFuture(u) && ['return','grow'].includes(p.objective)){
    s += 6;
    reasons.push('entrega futura útil para planificación en cuotas');
  }
  return s;
}
function scoreUnit(u, p, comparable){
  const reasons = [];
  let score = 0;
  score += affordabilityScore(u,p,reasons);
  score += ticketScore(u,p,reasons);
  score += locationScore(u,p,reasons);
  score += objectiveScore(u,p,reasons);
  score += productScore(u,p,reasons);
  score += valueScore(u,reasons);
  score += qualityScore(u,reasons);
  score += futureDeliveryScore(u,p,reasons);
  if(p.age === 'initial') reasons.push('la etapa inicial no limita el ticket si los números acompañan');
  return {...u, score, reasons: [...new Set(reasons)].slice(0,6), resultType: 'unit'};
}
function candidateUnits(p = state, tolerance = .18){
  const cap = capacityLevel(p);
  return units.filter(u => isAvailable(u) && hasNumbers(u) && zoneOk(u,p) && productOk(u,p)).filter(u => {
    if(!monthlyBudgetOk(u,p)) return false;
    if(cap === 'max') return true;
    const down = asNum(u.anticipo), month = asNum(u.cuota_estimada);
    let dTol = tolerance, mTol = 0;
    // Mantengo flexibilidad comercial en anticipo, pero no en cuota mensual.
    if(isLocal(u) || cap === 'very_high'){ dTol = Math.max(dTol,.35); }
    if(isEmprendeprop(u) && (p.zone === 'north' || p.zone === 'caba')){ dTol = Math.max(dTol,.28); }
    return down <= maxDown(p) * (1 + dTol) && month <= maxMonth(p) * (1 + mTol);
  });
}
function packTotals(arr){
  return arr.reduce((a,u) => {
    a.precio += asNum(u.precio) || 0;
    a.anticipo += asNum(u.anticipo) || 0;
    a.cuota += asNum(u.cuota_estimada) || 0;
    a.m2 += asNum(u.m2) || 0;
    a.contado += asNum(u.precio_contado) || 0;
    return a;
  }, {precio:0, anticipo:0, cuota:0, m2:0, contado:0});
}
function packAffordable(pack, p, relax = .12){
  if(!monthlyBudgetOkAmount(asNum(pack.cuota_estimada), p)) return false;
  if(maxCapacity(p)) return true;
  return pack.anticipo <= maxDown(p) * (1 + relax);
}
function uniqueByDevelopment(list, size){
  const out = [], used = new Set();
  for(const u of list){
    if(out.length >= size) break;
    const key = norm(u.desarrollo);
    if(!used.has(key)){ out.push(u); used.add(key); }
  }
  for(const u of list){
    if(out.length >= size) break;
    if(!out.some(x => x.id === u.id)) out.push(u);
  }
  return out;
}
function makePack(id, title, arr, p, reasons, score){
  if(!arr || !arr.length) return null;
  const t = packTotals(arr);
  return {
    id,
    resultType: 'pack',
    desarrollo: title,
    barrio: arr[0]?.barrio || 'Varios barrios',
    direccion: arr.map(x => x.direccion).filter(Boolean)[0] || 'Varias direcciones',
    unidad: 'Pack',
    piso: 'Varios',
    tipologia: `Pack ${arr.length} unidades`,
    ambientes: 'Varios',
    m2: t.m2,
    precio: t.precio,
    anticipo: t.anticipo,
    cuota_estimada: t.cuota,
    precio_contado: t.contado || null,
    precio_m2: t.m2 ? t.precio / t.m2 : null,
    entrega: 'Según unidades incluidas',
    forma_pago: 'Según unidades incluidas',
    perfil_inversor: maxCapacity(p) ? 'capitalización' : 'perfil medio',
    tipo_producto: 'pack',
    estado: 'disponible',
    packSize: arr.length,
    units: arr,
    reasons,
    score
  };
}
function packCandidates(p = state){
  const base = units.filter(u => isAvailable(u) && hasNumbers(u) && isResidential(u) && zoneOk(u,p));
  const scored = base.map(u => scoreUnit(u,p,base)).sort((a,b) => b.score - a.score);
  const byBarrio = new Map();
  for(const u of scored){
    const b = norm(u.barrio) || 'varios barrios';
    if(!byBarrio.has(b)) byBarrio.set(b, []);
    byBarrio.get(b).push(u);
  }
  const packs = [];
  for(const [barrio, list] of byBarrio.entries()){
    if(list.length < 2) continue;
    const size = maxCapacity(p) && list.length >= 5 ? 5 : Math.min(3, list.length);
    const arr = list.slice(0, size);
    const title = size >= 5 ? `Pack mayorista en ${barrio}` : `Pack con ofertas en ${barrio}`;
    const pack = makePack(`PACK-${barrio}-${size}`.replace(/\s+/g,'-'), title, arr, p, [
      `${size >= 5 ? 'pack mayorista' : 'pack con ofertas'} armado dinámicamente desde unidades disponibles`,
      'puede abrir conversación por condiciones especiales sujetas a disponibilidad',
      `foco en ${barrio}`
    ], 135 + size * 12 + (maxCapacity(p) ? 45 : 0) + (p.product === 'bulk' ? 48 : 0));
    if(pack && packAffordable(pack,p,maxCapacity(p) ? .50 : .18)) packs.push(pack);
  }
  const cabaNorth = scored.filter(u => norm(u.zona) === 'corredor_norte');
  if(cabaNorth.length >= 3){
    const arr = uniqueByDevelopment(cabaNorth, maxCapacity(p) ? 5 : 3);
    const title = arr.length >= 5 ? 'Pack mayorista corredor norte' : 'Pack con ofertas en corredor norte';
    const pack = makePack('PACK-CORREDOR-NORTE', title, arr, p, [
      'combinación de unidades en barrios líquidos del corredor norte',
      'pensado para diversificación y negociación por cantidad',
      'condiciones especiales sujetas a disponibilidad y aprobación'
    ], 160 + (maxCapacity(p) ? 58 : 0) + (p.product === 'bulk' ? 55 : 0));
    if(pack && packAffordable(pack,p,maxCapacity(p) ? .55 : .20)) packs.push(pack);
  }
  return packs.sort((a,b) => b.score - a.score).slice(0,6);
}
function recommend(p = state){
  let cands = candidateUnits(p,.16);
  if(!cands.length) cands = candidateUnits(p,.36);
  if(!cands.length) cands = units.filter(u => isAvailable(u) && hasNumbers(u) && zoneOk(u,p) && productOk(u,p) && monthlyBudgetOk(u,p));
  let ranked = cands.map(u => scoreUnit(u,p,cands)).sort((a,b) => b.score - a.score);
  if(maxCapacity(p)){
    const high = ranked.filter(u => (asNum(u.precio) || 0) >= 170000 || isLocal(u) || isEmprendeprop(u));
    if(high.length >= 3) ranked = high;
  }
  const packs = packCandidates(p);
  const selected = [];
  if(p.product === 'bulk' || maxCapacity(p)){
    for(const pk of packs){ if(selected.length >= 3) break; selected.push(pk); }
  } else if(highCapacity(p) && p.objective === 'grow' && packs.length){
    selected.push(packs[0]);
  }
  for(const item of ranked){
    if(selected.length >= 5) break;
    if(selected.some(x => x.id === item.id)) continue;
    selected.push(item);
  }
  if(selected.length < 5 && p.product !== 'commercial'){
    for(const pk of packs){
      if(selected.length >= 5) break;
      if(!selected.some(x => x.id === pk.id)) selected.push(pk);
    }
  }
  return selected.filter(x => monthlyBudgetOk(x,p)).slice(0,5).map(x => ({...x, roleName: roleName(x,p)}));
}
function roleName(u,p){
  if(u.resultType === 'pack') return u.desarrollo.includes('mayorista') ? 'pack mayorista' : 'pack con ofertas';
  if(isLocal(u)) return 'local comercial';
  if(p.objective === 'rent') return 'renta tradicional';
  if(p.objective === 'return') return 'uso futuro / regreso';
  if(p.objective === 'grow') return 'capitalización';
  if(asNum(u.cuota_estimada) <= 2000) return 'bajo impacto mensual';
  return norm(u.perfil_inversor) || 'opción compatible';
}
function profileName(){
  if(state.product === 'bulk' || maxCapacity()) return 'perfil de cartera / compra por cantidad';
  if(state.product === 'commercial') return 'perfil comercial o patrimonial';
  if(state.objective === 'grow') return 'inversor que busca aumentar capital';
  if(state.objective === 'return') return 'comprador con regreso futuro';
  if(state.objective === 'rent') return 'inversor orientado a renta tradicional';
  if(state.monthly === 'm2000') return 'primer inversor de bajo impacto mensual';
  return 'primer inversor con capacidad ordenada';
}

function optionSubtitle(q, value){
  if(!q) return '';
  const found = q.options.find(o => o[0] === value);
  return found ? `${found[1]} · ${found[2]}` : '';
}
function updateCounts(){
  const available = units.filter(u => isAvailable(u));
  const caba = available.filter(u => norm(u.zona) === 'corredor_norte' || norm(u.zona) === 'caba_general');
  const projects = new Set(available.map(u => u.desarrollo)).size;
  document.getElementById('countUnits').textContent = available.length;
  document.getElementById('countCaba').textContent = caba.length;
  document.getElementById('countProjects').textContent = projects;
}
function renderPanels(){
  const q = questions[openIndex];
  const progress = ((openIndex + 1) / questions.length) * 100;
  document.getElementById('stepCounter').textContent = `Paso ${openIndex + 1}`;
  document.getElementById('stepTotal').textContent = `de ${questions.length}`;
  document.getElementById('progressFill').style.width = `${progress}%`;
  document.getElementById('backBtn').disabled = openIndex === 0;
  document.getElementById('nextBtn').textContent = openIndex === questions.length - 1 ? 'Ver opciones' : 'Continuar';
  const reviewCompact = document.getElementById('reviewCompact');
  if(reviewCompact) reviewCompact.textContent = optionSubtitle(q,state[q.key]);
  document.getElementById('panels').innerHTML = `
    <article class="step-card" data-step="${q.key}">
      <div class="selection-pill"><i></i>${optionSubtitle(q,state[q.key])}</div>
      <div class="step-kicker">${q.key.replace('_',' ')}</div>
      <h2 class="step-title">${q.title}</h2>
      <p class="step-hint">${q.hint}</p>
      <div class="options">
        ${q.options.map(o => `<button class="option-card ${state[q.key] === o[0] ? 'selected' : ''}" type="button" onclick="selectOption('${q.key}','${o[0]}',${openIndex})"><span class="option-dot"></span><span class="option-text"><strong>${o[1]}</strong><span>${o[2]}</span></span></button>`).join('')}
      </div>
    </article>`;
  renderReview();
}
function renderReview(){
  const list = document.getElementById('reviewList');
  if(!list) return;
  list.innerHTML = questions.map((q,idx) => `<button class="review-row ${idx===openIndex?'active':''}" type="button" onclick="jumpTo(${idx})"><span><small>${q.title}</small><b>${optionSubtitle(q,state[q.key])}</b></span><em>Editar</em></button>`).join('');
}
function jumpTo(idx){
  openIndex = Math.max(0, Math.min(idx, questions.length - 1));
  renderPanels();
  document.getElementById('wizard').scrollIntoView({behavior:'smooth', block:'start'});
}
function selectOption(k,v,i){
  state[k] = v;
  renderPanels();
  if(i < questions.length - 1){
    setTimeout(() => { openIndex = i + 1; renderPanels(); }, 135);
  } else {
    setTimeout(calculate, 135);
  }
}
function nextStep(){
  if(openIndex >= questions.length - 1){ calculate(); return; }
  openIndex = Math.min(openIndex + 1, questions.length - 1);
  renderPanels();
}
function backStep(){
  openIndex = Math.max(openIndex - 1, 0);
  renderPanels();
}
function resetAll(){
  openIndex = 0;
  document.getElementById('results').classList.remove('show');
  document.getElementById('loading').classList.remove('show');
  document.getElementById('wizard').style.display = '';
  document.querySelector('.hero-card').style.display = '';
  document.querySelector('.data-strip').style.display = '';
  renderPanels();
  window.scrollTo({top:0, behavior:'smooth'});
}
function calculate(){
  document.getElementById('wizard').style.display = 'none';
  document.querySelector('.hero-card').style.display = 'none';
  document.querySelector('.data-strip').style.display = 'none';
  document.getElementById('loading').classList.add('show');
  window.scrollTo({top:0, behavior:'smooth'});
  setTimeout(() => {
    document.getElementById('loading').classList.remove('show');
    renderResults(recommend());
  }, 620);
}
function renderMetric(label,value){ return `<div class="metric"><small>${label}</small><b>${value}</b></div>`; }
function unitLine(u){ return `${u.desarrollo} ${u.unidad} (${u.barrio}, ${u.tipologia}, ${usd(u.precio)}, anticipo ${usd(u.anticipo)}, cuota ${usd(u.cuota_estimada)}/mes)`; }
function whatsappMessage(u, profile){
  if(u.resultType === 'pack'){
    const detail = (u.units || []).map(unitLine).join(' | ');
    return `Hola Juan, completé el recomendador y quiero consultar por este ${u.desarrollo}. Total financiado aprox: ${usd(u.precio)}. Anticipo total: ${usd(u.anticipo)}. Cuota total: ${usd(u.cuota_estimada)}/mes. Unidades incluidas: ${detail}. Perfil detectado: ${profile}. Entiendo que una compra por cantidad puede abrir conversación por condiciones especiales o descuentos, siempre sujeto a disponibilidad y aprobación. ¿Me pasás más información?`;
  }
  if(isLocal(u)){
    return `Hola Juan, completé el recomendador y quiero consultar por este local comercial: ${u.desarrollo} - ${u.unidad} - ${u.barrio} - ${usd(u.precio)}. Anticipo: ${usd(u.anticipo)}. Cuota: ${usd(u.cuota_estimada)}/mes. Perfil detectado: ${profile}. ¿Me pasás información sobre disponibilidad, condiciones comerciales, posibilidad de descuento y destino/habilitación del local?`;
  }
  return `Hola Juan, completé el recomendador y quiero consultar por esta unidad: ${u.desarrollo} - Unidad ${u.unidad} - ${u.barrio} - ${u.tipologia} - ${usd(u.precio)}. Anticipo: ${usd(u.anticipo)}. Cuota: ${usd(u.cuota_estimada)}/mes. Perfil detectado: ${profile}. ¿Me pasás más información?`;
}
function safeText(v){
  const t = norm(v);
  return t && t !== 'null' && t !== 'undefined' ? t : 'Dato no informado';
}
function renderDetailRow(label, value){
  return `<div class="detail-row"><small>${label}</small><b>${value}</b></div>`;
}
function renderUnitDetails(u){
  const rows = [
    ['Desarrollo', safeText(u.desarrollo)],
    ['Dirección', safeText(u.direccion)],
    ['Barrio', safeText(u.barrio)],
    ['Zona', safeText(u.zona)],
    ['Unidad', safeText(u.unidad)],
    ['Piso', safeText(u.piso)],
    ['Tipología', safeText(u.tipologia)],
    ['Disposición', safeText(u.disposicion)],
    ['Orientación', safeText(u.orientacion)],
    ['m² cubiertos', fmtM2(u.m2_cubiertos)],
    ['m² semicubiertos', fmtM2(u.m2_semicubiertos)],
    ['m² descubiertos', fmtM2(u.m2_descubiertos)],
    ['m² totales', fmtM2(u.m2)],
    ['Precio financiado', usd(u.precio)],
    ['Anticipo', usd(u.anticipo)],
    ['Cuota estimada', `${usd(u.cuota_estimada)}/mes`],
    ['Cantidad de cuotas', safeText(u.cantidad_cuotas)],
    ['Precio contado', usd(u.precio_contado)],
    ['Precio/m²', usd(u.precio_m2)],
    ['Entrega', safeText(u.entrega)],
    ['Forma de pago', safeText(u.forma_pago)],
    ['Perfil sugerido', safeText(u.perfil_inversor)],
    ['Amenities', safeText(u.amenities)],
    ['Terminaciones', safeText(u.terminaciones)],
    ['Cocheras', safeText(u.cocheras)],
    ['Datos faltantes', safeText(u.datos_faltantes)]
  ];
  return `<div class="detail-grid">${rows.map(([a,b]) => renderDetailRow(a,b)).join('')}</div>`;
}
function renderPackDetails(u){
  const lines = (u.units || []).map((item,idx) => `<div class="pack-unit-line"><strong>${idx+1}. ${item.desarrollo} · Unidad ${item.unidad}</strong><span>${item.barrio} · ${item.tipologia} · ${fmtM2(item.m2)} · ${usd(item.precio)} · anticipo ${usd(item.anticipo)} · cuota ${usd(item.cuota_estimada)}/mes</span></div>`).join('');
  return `<div class="pack-detail-box"><b>Unidades incluidas</b>${lines || '<p>Detalle no informado</p>'}</div>`;
}
function renderCard(u,i,profile){
  const msg = encodeURIComponent(whatsappMessage(u,profile));
  const isPack = u.resultType === 'pack';
  const isLocalCard = isLocal(u);
  const cardClass = isPack ? 'pack' : (isLocalCard ? 'local' : 'unit');
  const tags = isPack
    ? [u.roleName, `${u.packSize || 0} unidades`, 'Condiciones a negociar']
    : (isLocalCard ? ['Local comercial','Producto patrimonial','Confirmar habilitación'] : [u.perfil_inversor, u.forma_pago, u.barrio, isEmprendeprop(u) ? 'Club Conecta' : 'Moderna'].filter(Boolean).slice(0,4));
  const title = isPack ? u.desarrollo : `${u.desarrollo} · Unidad ${u.unidad}`;
  const subtitle = isPack ? `${u.packSize} unidades · ${usd(u.precio)} · ${usd(u.cuota_estimada)}/mes` : `${u.barrio} · ${u.tipologia} · ${usd(u.cuota_estimada)}/mes`;
  return `<details class="result-card ${cardClass}" ${i===0?'open':''}>
    <summary>
      <span class="result-index">${String(i+1).padStart(2,'0')}</span>
      <span class="result-main">
        <span class="result-title">${title}</span>
        <span class="result-sub">${subtitle}</span>
        <span class="role-badge">${u.roleName || 'opción compatible'}</span>
      </span>
      <span class="chevron">+</span>
    </summary>
    <div class="result-body">
      <div class="tag-row compact-tags">${tags.map(t => `<span>${t}</span>`).join('')}</div>
      <p class="mini-address">${isPack ? 'Pack armado dinámicamente desde unidades disponibles. La disponibilidad y condiciones mayoristas deben confirmarse antes de ofrecer.' : `${safeText(u.direccion)} · ${safeText(u.barrio)} · ${safeText(u.disposicion)} · Entrega: ${safeText(u.entrega)}`}</p>
      <div class="metrics">
        ${renderMetric('Precio', usd(u.precio))}
        ${renderMetric('Anticipo', usd(u.anticipo))}
        ${renderMetric('Cuota', `${usd(u.cuota_estimada)}/mes`)}
        ${renderMetric('m² totales', fmtM2(u.m2))}
      </div>
      <details class="why" open>
        <summary>Por qué aparece</summary>
        <ul>${(u.reasons || []).map(r => `<li>${r}</li>`).join('')}</ul>
      </details>
      <details class="full-info">
        <summary>Ver información completa</summary>
        ${isPack ? renderPackDetails(u) : renderUnitDetails(u)}
        ${!isPack ? `<p class="unit-desc">${u.descripcion || ''}</p>` : ''}
      </details>
      <a class="wa" target="_blank" rel="noopener" href="https://wa.me/${PHONE}?text=${msg}">Consultar por WhatsApp</a>
    </div>
  </details>`;
}
function renderResults(list){
  const profile = profileName();
  document.getElementById('summary').textContent = `Detecté un ${profile}. Las opciones se ordenan por tus números, zona y objetivo; no por escalera barato/intermedio/caro.`;
  document.getElementById('cards').innerHTML = list.length ? list.map((u,i) => renderCard(u,i,profile)).join('') : `<article class="result-card unit"><div class="card-main"><h3>No encontré coincidencias completas</h3><p class="subtitle">Revisá anticipo, cuota o zona. También podés cargar nuevas unidades en unidades.json.</p></div></article>`;
  document.getElementById('results').classList.add('show');
}
async function loadUnits(){
  try{
    const res = await fetch(`${DATA_URL}?v=${Date.now()}`, {cache:'no-store'});
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    rawData = await res.json();
    units = Array.isArray(rawData) ? rawData : (rawData.unidades || []);
    units = units.map((u,idx) => ({ id: u.id || `unidad-${idx}`, ...u }));
    updateCounts();
    renderPanels();
  } catch(err){
    console.error(err);
    document.getElementById('panels').innerHTML = `<article class="step-card"><div class="step-kicker">error</div><h2 class="step-title">No se pudo cargar unidades.json</h2><p class="step-hint">Verificá que el archivo exista en la raíz del proyecto y que el JSON no tenga comas o llaves mal cerradas.</p></article>`;
    document.getElementById('nextBtn').disabled = true;
  }
}

document.addEventListener('DOMContentLoaded', loadUnits);
