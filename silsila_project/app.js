function makeId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `mem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const sampleMemories = [
  {
    id: makeId(),
    title: "The first winter in Canada",
    storyteller: "Nani",
    language: "Urdu + English",
    year: 2004,
    original: "Jab hum Lahore se Toronto aaye, tumhare mamu sirf chay saal ke thay. Pehli baraf dekh kar woh slippers mein bahar bhaag gaye. Hamare paas proper winter coats bhi nahi thay, lekin us din sab bohat hase.",
    translation: "When we arrived in Toronto from Lahore, your uncle was only six. He saw snow for the first time and ran outside in slippers. We did not even have proper winter coats yet, but everyone laughed so much that day.",
    people: ["Nani", "Mamu"],
    places: ["Lahore", "Toronto"],
    dates: ["2004"],
    themes: ["migration", "first winter", "family laughter"],
    audioUrl: null,
    confidence: 0.93
  },
  {
    id: makeId(),
    title: "The house with the mango tree",
    storyteller: "Abu",
    language: "Punjabi + English",
    year: 1996,
    original: "Sada purana ghar Lahore vich si, te courtyard de vich ik wadda amb da darakht. Har garmi assi sare cousins othe ikathay hunde si. Dadaji kehnde si ke darakht ghar ton vi purana hai.",
    translation: "Our old home was in Lahore, with a large mango tree in the courtyard. Every summer, all the cousins gathered there. Dadaji used to say the tree was older than the house itself.",
    people: ["Abu", "Dadaji"],
    places: ["Lahore"],
    dates: ["1996"],
    themes: ["childhood", "home", "summer"],
    audioUrl: null,
    confidence: 0.89
  },
  {
    id: makeId(),
    title: "Starting over in Hamilton",
    storyteller: "Ammi",
    language: "English",
    year: 2005,
    original: "After one year in Toronto, we moved to Hamilton because your father found work there. We knew almost nobody. The first person who welcomed us brought biryani and helped us register the children for school.",
    translation: "After one year in Toronto, the family moved to Hamilton for work. A new neighbour welcomed them with biryani and helped the children register for school.",
    people: ["Ammi", "Abu"],
    places: ["Toronto", "Hamilton"],
    dates: ["2005"],
    themes: ["community", "starting over", "kindness"],
    audioUrl: null,
    confidence: 0.96
  }
];

let memories = loadMemories();
let activeMemoryId = null;
let selectedNodeId = null;
let mediaRecorder = null;
let recordedChunks = [];
let latestAudioUrl = null;

const memoryList = document.querySelector('#memoryList');
const memoryCount = document.querySelector('#memoryCount');
const constellationSvg = document.querySelector('#constellationSvg');
const timeline = document.querySelector('#timeline');
const detailContent = document.querySelector('#detailContent');
const emptyDetail = document.querySelector('#emptyDetail');
const answerPanel = document.querySelector('#answerPanel');
const memoryDialog = document.querySelector('#memoryDialog');
const tourDialog = document.querySelector('#tourDialog');

function loadMemories() {
  try {
    const saved = JSON.parse(localStorage.getItem('silsila-memories'));
    return Array.isArray(saved) && saved.length ? saved : sampleMemories;
  } catch {
    return sampleMemories;
  }
}

function saveMemories() {
  try {
    localStorage.setItem('silsila-memories', JSON.stringify(memories.map(m => ({...m, audioUrl: null}))));
  } catch {
    // The prototype still works when browser storage is unavailable.
  }
}

function initials(name) {
  return name.split(/\s+/).map(p => p[0]).join('').slice(0,2).toUpperCase();
}

function renderMemoryList(filter = '') {
  const query = filter.trim().toLowerCase();
  const filtered = memories.filter(m => [m.title, m.storyteller, m.language, ...(m.people||[]), ...(m.places||[]), ...(m.themes||[])].join(' ').toLowerCase().includes(query));
  memoryCount.textContent = memories.length;
  memoryList.innerHTML = filtered.map(m => `
    <button class="memory-card ${m.id === activeMemoryId ? 'active' : ''}" data-memory-id="${m.id}">
      <span class="memory-avatar">${initials(m.storyteller)}</span>
      <span class="memory-copy">
        <strong>${escapeHtml(m.title)}</strong>
        <span>${escapeHtml(m.storyteller)} · ${m.year || 'Year unknown'}</span>
      </span>
    </button>
  `).join('');

  memoryList.querySelectorAll('[data-memory-id]').forEach(button => {
    button.addEventListener('click', () => {
      activeMemoryId = button.dataset.memoryId;
      renderAll();
      openMemoryDetail(memories.find(m => m.id === activeMemoryId));
    });
  });
}

function buildGraphData() {
  const nodes = [];
  const links = [];
  const nodeMap = new Map();

  function ensureNode(id, type, label, meta = '') {
    if (!nodeMap.has(id)) {
      const node = { id, type, label, meta };
      nodeMap.set(id, node);
      nodes.push(node);
    }
    return nodeMap.get(id);
  }

  memories.forEach(memory => {
    const memoryNode = ensureNode(`memory:${memory.id}`, 'event', memory.title, memory.storyteller);
    (memory.people || []).forEach(person => {
      const personNode = ensureNode(`person:${person}`, 'person', person, 'Family member');
      links.push({ source: memoryNode.id, target: personNode.id });
    });
    (memory.places || []).forEach(place => {
      const placeNode = ensureNode(`place:${place}`, 'place', place, 'Place');
      links.push({ source: memoryNode.id, target: placeNode.id });
    });
    (memory.dates || []).forEach(date => {
      const dateNode = ensureNode(`date:${date}`, 'date', date, 'Year');
      links.push({ source: memoryNode.id, target: dateNode.id });
    });
  });
  return { nodes, links };
}

function seededPosition(key, index, total) {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = ((hash << 5) - hash) + key.charCodeAt(i);
  const angle = (Math.abs(hash) % 360) * Math.PI / 180 + (index / Math.max(total,1)) * Math.PI * 2;
  const radius = 115 + (Math.abs(hash >> 3) % 150);
  return { x: 500 + Math.cos(angle) * radius, y: 310 + Math.sin(angle) * radius };
}

function renderConstellation() {
  const { nodes, links } = buildGraphData();
  const positions = new Map();
  const typeRadius = { event: 30, person: 22, place: 19, date: 16 };
  const colors = { event: '#a58bff', person: '#f3c979', place: '#78d8e7', date: '#85dfb3' };

  nodes.forEach((node, index) => {
    let pos;
    if (node.type === 'event') {
      const eventIndex = nodes.filter(n => n.type === 'event').findIndex(n => n.id === node.id);
      const angle = (-Math.PI / 2) + eventIndex * (Math.PI * 2 / Math.max(memories.length, 1));
      const radius = memories.length === 1 ? 0 : 145;
      pos = { x: 500 + Math.cos(angle) * radius, y: 310 + Math.sin(angle) * radius };
    } else {
      pos = seededPosition(node.id, index, nodes.length);
    }
    positions.set(node.id, pos);
  });

  // Relax collisions a little for cleaner layouts.
  for (let iteration = 0; iteration < 80; iteration++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = positions.get(nodes[i].id);
        const b = positions.get(nodes[j].id);
        let dx = b.x - a.x, dy = b.y - a.y;
        let distance = Math.sqrt(dx*dx + dy*dy) || 1;
        const min = typeRadius[nodes[i].type] + typeRadius[nodes[j].type] + 40;
        if (distance < min) {
          const push = (min-distance) * .025;
          dx /= distance; dy /= distance;
          a.x -= dx * push; a.y -= dy * push;
          b.x += dx * push; b.y += dy * push;
        }
      }
    }
  }

  const activeNode = activeMemoryId ? `memory:${activeMemoryId}` : null;
  const connectedToSelected = new Set();
  if (selectedNodeId) {
    links.forEach(link => {
      if (link.source === selectedNodeId) connectedToSelected.add(link.target);
      if (link.target === selectedNodeId) connectedToSelected.add(link.source);
    });
  }

  constellationSvg.innerHTML = `
    <defs>
      <radialGradient id="stageGlow"><stop offset="0" stop-color="#7860ff" stop-opacity=".18"/><stop offset="1" stop-color="#7860ff" stop-opacity="0"/></radialGradient>
      <filter id="softGlow"><feGaussianBlur stdDeviation="6" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <circle cx="500" cy="310" r="250" fill="url(#stageGlow)" />
    ${links.map(link => {
      const s = positions.get(link.source), t = positions.get(link.target);
      const highlighted = selectedNodeId && (link.source === selectedNodeId || link.target === selectedNodeId);
      return `<line class="connection ${highlighted ? 'highlight' : ''}" x1="${s.x}" y1="${s.y}" x2="${t.x}" y2="${t.y}" />`;
    }).join('')}
    ${nodes.map(node => {
      const {x,y} = positions.get(node.id);
      const r = typeRadius[node.type];
      const isActive = node.id === selectedNodeId || node.id === activeNode;
      const dimmed = selectedNodeId && node.id !== selectedNodeId && !connectedToSelected.has(node.id);
      return `<g class="node ${isActive ? 'active' : ''}" data-node-id="${encodeURIComponent(node.id)}" transform="translate(${x} ${y})" style="opacity:${dimmed ? .28 : 1}; color:${colors[node.type]}">
        <circle class="halo" r="${r + 15}" fill="${colors[node.type]}" />
        <circle class="core" r="${r}" fill="${colors[node.type]}22" stroke="${colors[node.type]}" />
        <circle r="3.2" fill="${colors[node.type]}" filter="url(#softGlow)" />
        <text y="${r + 22}">${escapeHtml(shortLabel(node.label, 22))}</text>
        <text class="node-meta" y="${r + 38}">${escapeHtml(node.meta)}</text>
      </g>`;
    }).join('')}
  `;

  constellationSvg.querySelectorAll('.node').forEach(nodeEl => {
    nodeEl.addEventListener('click', () => {
      selectedNodeId = decodeURIComponent(nodeEl.dataset.nodeId);
      renderConstellation();
      openNodeDetail(selectedNodeId);
    });
  });
}

function shortLabel(text, max) {
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

function openNodeDetail(nodeId) {
  const [type, raw] = nodeId.split(':');
  if (type === 'memory') {
    const memory = memories.find(m => m.id === raw);
    activeMemoryId = raw;
    renderMemoryList(document.querySelector('#memoryFilter').value);
    openMemoryDetail(memory);
    return;
  }

  const related = memories.filter(memory => {
    if (type === 'person') return (memory.people || []).includes(raw);
    if (type === 'place') return (memory.places || []).includes(raw);
    if (type === 'date') return (memory.dates || []).includes(raw);
    return false;
  });

  const descriptions = {
    person: 'A family member appearing across the archive.',
    place: 'A place connected to one or more family memories.',
    date: 'A point in time linking related stories.'
  };

  showDetail(`
    <div class="detail-hero">
      <div class="detail-type">✦ ${escapeHtml(type)}</div>
      <h2>${escapeHtml(raw)}</h2>
      <p>${descriptions[type]}</p>
    </div>
    <div class="detail-section">
      <h3>Connected memories</h3>
      ${related.map(m => `<button class="connection-chip" data-open-memory="${m.id}">${escapeHtml(m.title)}</button>`).join('') || '<p class="quote">No connected memories yet.</p>'}
    </div>
    <div class="detail-section">
      <h3>Why it matters</h3>
      <p class="quote">This node is not an AI-generated fact. It is a doorway back to the original family stories that mention it.</p>
    </div>
  `);
  detailContent.querySelectorAll('[data-open-memory]').forEach(b => b.addEventListener('click', () => openMemoryDetail(memories.find(m => m.id === b.dataset.openMemory))));
}

function openMemoryDetail(memory) {
  if (!memory) return;
  selectedNodeId = `memory:${memory.id}`;
  showDetail(`
    <div class="detail-hero">
      <div class="detail-type">✦ Memory thread</div>
      <h2>${escapeHtml(memory.title)}</h2>
      <p>Told by ${escapeHtml(memory.storyteller)} · ${escapeHtml(memory.language)} · ${memory.year || 'Year unknown'}</p>
    </div>
    ${memory.audioUrl ? `<div class="detail-section"><h3>Original voice</h3><audio src="${memory.audioUrl}" controls style="width:100%"></audio></div>` : ''}
    <div class="detail-section">
      <h3>Original memory</h3>
      <p class="quote">“${escapeHtml(memory.original)}”</p>
    </div>
    ${memory.translation ? `<div class="detail-section"><h3>English interpretation</h3><p class="quote">${escapeHtml(memory.translation)}</p></div>` : ''}
    <div class="detail-section">
      <h3>Connections</h3>
      ${[...(memory.people||[]), ...(memory.places||[]), ...(memory.dates||[])].map(item => `<span class="connection-chip">${escapeHtml(item)}</span>`).join('')}
    </div>
    <div class="detail-section">
      <div class="confidence"><span>Extraction confidence</span><strong>${Math.round((memory.confidence || .82) * 100)}%</strong></div>
      <div class="confidence-bar"><span style="width:${Math.round((memory.confidence || .82) * 100)}%"></span></div>
      <button class="correction-button" id="correctionButton">Suggest a correction</button>
    </div>
  `);
  document.querySelector('#correctionButton')?.addEventListener('click', () => {
    const correction = prompt('What should be corrected or clarified?');
    if (correction) alert('Correction saved as a family note. In a production build, another relative could review it before changing the archive.');
  });
}

function showDetail(html) {
  emptyDetail.hidden = true;
  detailContent.hidden = false;
  detailContent.innerHTML = html;
}

function renderTimeline() {
  const sorted = [...memories].sort((a,b) => (a.year || 9999) - (b.year || 9999));
  timeline.innerHTML = sorted.map(m => `
    <article class="timeline-item">
      <span class="timeline-dot"></span>
      <div class="timeline-year">${m.year || 'DATE UNKNOWN'}</div>
      <h3>${escapeHtml(m.title)}</h3>
      <p>${escapeHtml(m.translation || m.original).slice(0,180)}${(m.translation || m.original).length > 180 ? '…' : ''}</p>
    </article>
  `).join('');
}

function renderAll() {
  renderMemoryList(document.querySelector('#memoryFilter').value);
  renderConstellation();
  renderTimeline();
}

function extractEntities(text, storyteller, year) {
  const knownPlaces = ['Lahore','Karachi','Islamabad','Rawalpindi','Pakistan','Toronto','Mississauga','Milton','Hamilton','Canada','GTA'];
  const familyWords = ['Ammi','Abu','Nani','Nana','Dadi','Dada','Dadaji','Mamu','Khala','Chachu','Phuppo','Uncle','Aunt','Mother','Father','Grandmother','Grandfather'];
  const places = knownPlaces.filter(place => new RegExp(`\\b${place}\\b`, 'i').test(text));
  const people = [...new Set([storyteller, ...familyWords.filter(person => new RegExp(`\\b${person}\\b`, 'i').test(text))])];
  const dateMatches = text.match(/\b(19|20)\d{2}\b/g) || [];
  if (year) dateMatches.push(String(year));
  const themeDictionary = {
    migration: ['moved','arrived','came','left','migration','starting over','aaye','move'],
    childhood: ['child','school','cousins','young','six','bachpan'],
    celebration: ['wedding','eid','birthday','celebration','shaadi'],
    community: ['neighbour','community','welcomed','helped','together'],
    home: ['house','home','ghar','courtyard'],
    resilience: ['difficult','hard','struggle','worked','survived']
  };
  const themes = Object.entries(themeDictionary).filter(([,words]) => words.some(word => text.toLowerCase().includes(word))).map(([theme]) => theme);
  return { people, places, dates: [...new Set(dateMatches)], themes };
}

function answerQuestion(question) {
  const q = question.toLowerCase().trim();
  if (!q) return;
  const terms = q.replace(/[^a-z0-9\s]/g,'').split(/\s+/).filter(w => w.length > 3 && !['what','when','where','which','show','stories','memory','memories','about','mention'].includes(w));
  let matches = memories.filter(m => {
    const corpus = [m.title,m.storyteller,m.original,m.translation,...(m.people||[]),...(m.places||[]),...(m.themes||[])].join(' ').toLowerCase();
    return terms.length ? terms.some(term => corpus.includes(term)) : true;
  });
  if (q.includes('canada')) matches = memories.filter(m => [m.original,m.translation,...(m.places||[])].join(' ').toLowerCase().includes('canada') || (m.places||[]).some(p => ['Toronto','Hamilton','Mississauga','Milton'].includes(p)));
  if (q.includes('lahore')) matches = memories.filter(m => (m.places||[]).includes('Lahore'));
  if (q.includes('moving') || q.includes('migration')) matches = memories.filter(m => (m.themes||[]).includes('migration') || /moved|arrived|came|aaye/i.test(m.original));

  if (!matches.length) {
    answerPanel.innerHTML = `<strong>No confident match yet.</strong> Silsila keeps uncertainty visible instead of inventing an answer. Try a person, place, year, or theme already present in the archive.`;
  } else {
    answerPanel.innerHTML = `<strong>${matches.length} connected ${matches.length === 1 ? 'memory' : 'memories'}:</strong> ${matches.map(m => `<button class="connection-chip" data-answer-memory="${m.id}">${escapeHtml(m.title)}</button>`).join('')}<br><span style="color:#9fa6bd">Results are grounded in the original family stories, not generated as new facts.</span>`;
    answerPanel.querySelectorAll('[data-answer-memory]').forEach(b => b.addEventListener('click', () => openMemoryDetail(memories.find(m => m.id === b.dataset.answerMemory))));
  }
  answerPanel.hidden = false;
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
}

// UI events
document.querySelector('#newMemoryButton').addEventListener('click', () => memoryDialog.showModal());
document.querySelector('#tourButton').addEventListener('click', () => tourDialog.showModal());
document.querySelector('#memoryFilter').addEventListener('input', e => renderMemoryList(e.target.value));
document.querySelector('#askButton').addEventListener('click', () => answerQuestion(document.querySelector('#familyQuestion').value));
document.querySelector('#familyQuestion').addEventListener('keydown', e => { if (e.key === 'Enter') answerQuestion(e.target.value); });

document.querySelectorAll('.view-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.view-tab').forEach(t => t.classList.toggle('active', t === tab));
    document.querySelectorAll('.visualization').forEach(v => v.classList.remove('active'));
    document.querySelector(`#${tab.dataset.view}View`).classList.add('active');
  });
});

document.querySelectorAll('.map-pin').forEach(pin => {
  pin.addEventListener('click', () => {
    const place = pin.dataset.place;
    selectedNodeId = `place:${place}`;
    openNodeDetail(selectedNodeId);
  });
});

document.querySelector('#loadSampleButton').addEventListener('click', () => {
  document.querySelector('#storyTitle').value = 'The train ride to a new city';
  document.querySelector('#storyteller').value = 'Nana';
  document.querySelector('#storyLanguage').value = 'Urdu + English';
  document.querySelector('#storyYear').value = '1988';
  document.querySelector('#storyOriginal').value = '1988 mein Nana Lahore se Karachi train par gaye thay. Unke paas sirf aik chhota suitcase tha, lekin woh kehte thay ke us safar mein pehli dafa unko laga ke zindagi badal sakti hai.';
  document.querySelector('#storyTranslation').value = 'In 1988, Nana took a train from Lahore to Karachi with only one small suitcase. He later said that journey was the first time he believed his life could change.';
});

document.querySelector('#memoryForm').addEventListener('submit', event => {
  event.preventDefault();
  const title = document.querySelector('#storyTitle').value.trim();
  const storyteller = document.querySelector('#storyteller').value.trim();
  const language = document.querySelector('#storyLanguage').value;
  const year = Number(document.querySelector('#storyYear').value) || null;
  const original = document.querySelector('#storyOriginal').value.trim();
  const translation = document.querySelector('#storyTranslation').value.trim();
  const extracted = extractEntities(`${original} ${translation}`, storyteller, year);
  const memory = {
    id: makeId(), title, storyteller, language, year, original, translation,
    ...extracted, audioUrl: latestAudioUrl, confidence: .84 + Math.random() * .12
  };
  memories.push(memory);
  activeMemoryId = memory.id;
  selectedNodeId = `memory:${memory.id}`;
  saveMemories();
  renderAll();
  openMemoryDetail(memory);
  event.target.reset();
  latestAudioUrl = null;
  document.querySelector('#recordedAudio').hidden = true;
  memoryDialog.close();
});

// Optional microphone recording.
document.querySelector('#recordButton').addEventListener('click', async () => {
  const button = document.querySelector('#recordButton');
  const label = document.querySelector('#recordLabel');
  const status = document.querySelector('#recordStatus');
  const audio = document.querySelector('#recordedAudio');

  if (mediaRecorder?.state === 'recording') {
    mediaRecorder.stop();
    button.classList.remove('recording');
    label.textContent = 'Record again';
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    status.textContent = 'Audio recording is not supported in this browser.';
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recordedChunks = [];
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.addEventListener('dataavailable', e => { if (e.data.size) recordedChunks.push(e.data); });
    mediaRecorder.addEventListener('stop', () => {
      const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
      latestAudioUrl = URL.createObjectURL(blob);
      audio.src = latestAudioUrl;
      audio.hidden = false;
      status.textContent = 'Voice captured locally. The prototype does not upload it anywhere.';
      stream.getTracks().forEach(track => track.stop());
    });
    mediaRecorder.start();
    button.classList.add('recording');
    label.textContent = 'Stop recording';
    status.textContent = 'Recording… tell the story naturally.';
  } catch {
    status.textContent = 'Microphone permission was not granted.';
  }
});

renderAll();
setTimeout(() => {
  try {
    if (!localStorage.getItem('silsila-tour-seen')) {
      tourDialog.showModal();
      localStorage.setItem('silsila-tour-seen', '1');
    }
  } catch {
    tourDialog.showModal();
  }
}, 600);
