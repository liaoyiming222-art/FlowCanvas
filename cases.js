'use strict';

const allWorkflows = [...imageWorkflows, ...videoWorkflows];
const masonry = document.getElementById('masonry');
const search = document.getElementById('search');
const promptBox = document.getElementById('prompt');
const composer = document.getElementById('composer');
let activeTab = 'image', selectedId = null, editing = true, busy = false;
let templates = new Map();
// Keep unsaved name edits across card rebuilds, filters and layout changes.
const nameDrafts = new Map();
const templateFor = w => templates.has(w.id) ? templates.get(w.id) : (prompts[w.promptKey] || '');
let records = new Map(), mediaUrls = new Map(), columns = 0, pendingImport = null;
const MAX_FILE = 200 * 1024 * 1024;
const imageTypes = ['image/png','image/jpeg','image/webp','image/gif','image/avif','image/bmp'];
const videoTypes = ['video/mp4','video/webm','video/ogg','video/quicktime'];
const saveStatus = document.getElementById('saveStatus');
let toastTimer;
function notify(message) {
  const el = document.getElementById('toast');
  el.textContent = message; el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.hidden = true, 5500);
}
function element(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}
function button(text, callback, className = 'small-button') {
  const el = element('button', className, text); el.type = 'button';
  el.addEventListener('click', callback); return el;
}
function countSaved() { return new Set([...records.values()].map(r => r.workflowId)).size; }
function saved(message) {
  saveStatus.textContent = message || `已保存到此浏览器 · ${countSaved()}/16 个案例`;
  saveStatus.classList.remove('error');
}
function lock(value) {
  busy = value; document.body.classList.toggle('saving', value);
  document.querySelectorAll('[data-mutation], #exportCases, #importCases, #editCases, #confirmImport, #cancelImport').forEach(el => el.disabled = value);
}
const dbPromise = new Promise((resolve, reject) => {
  const req = indexedDB.open('ai-workflow-cases', 3);
  req.onupgradeneeded = () => {
    if (!req.result.objectStoreNames.contains('assets')) req.result.createObjectStore('assets', { keyPath: 'key' });
    if (!req.result.objectStoreNames.contains('names')) req.result.createObjectStore('names', { keyPath: 'workflowId' });
    if (!req.result.objectStoreNames.contains('templates')) req.result.createObjectStore('templates', { keyPath: 'workflowId' });
  };
  req.onsuccess = () => { req.result.onversionchange = () => req.result.close(); resolve(req.result); };
  req.onerror = () => reject(new Error('无法打开本机保存，请检查浏览器存储权限。'));
  req.onblocked = () => reject(new Error('请关闭其他案例页面后重试。'));
});
async function readRecords() {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const req = db.transaction('assets').objectStore('assets').getAll();
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
  });
}
async function writeRecords(puts, deletes = [], promptRecords = [], nameRecords = []) {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['assets','templates','names'], 'readwrite'), store = tx.objectStore('assets');
    nameRecords.forEach(record => tx.objectStore('names').put(record));
    promptRecords.forEach(record => tx.objectStore('templates').put(record));
    deletes.forEach(key => store.delete(key)); puts.forEach(record => store.put(record));
    tx.oncomplete = resolve; tx.onabort = tx.onerror = () => reject(tx.error || new Error('保存失败'));
  });
}
function release(key) { if (mediaUrls.has(key)) URL.revokeObjectURL(mediaUrls.get(key)); mediaUrls.delete(key); }
function urlFor(record) {
  if (!mediaUrls.has(record.key)) mediaUrls.set(record.key, URL.createObjectURL(record.blob));
  return mediaUrls.get(record.key);
}
function allowed(workflow, side, type) {
  return workflow.type === 'image' ? imageTypes.includes(type) :
    side === 'after' ? videoTypes.includes(type) : [...imageTypes, ...videoTypes].includes(type);
}
async function inspectFile(blob, name, workflow, side) {
  if (!blob.size) throw new Error('文件为空，请选择有效的图片或视频。');
  if (blob.size > MAX_FILE) throw new Error('单份素材最多 200 MB，请压缩后再上传。');
  if (!allowed(workflow, side, blob.type)) throw new Error(workflow.type === 'image' ?
    '此工作流需要图片，请选择 PNG、JPG、WebP、GIF、AVIF 或 BMP。' :
    side === 'after' ? '生成效果需要视频，请选择浏览器可播放的 MP4 或 WebM。' : '请选择图片或浏览器可播放的视频。');
  const isVideo = videoTypes.includes(blob.type), url = URL.createObjectURL(blob);
  const media = document.createElement(isVideo ? 'video' : 'img');
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('文件读取超时，请尝试更小的文件。')), 20000);
      media[isVideo ? 'onloadeddata' : 'onload'] = () => { clearTimeout(timer); resolve(); };
      media.onerror = () => { clearTimeout(timer); reject(new Error('文件无法解码，请换用有效的图片或 H.264 MP4 / WebM 视频。')); };
      if (isVideo) { media.preload = 'auto'; media.muted = true; }
      media.src = url;
    });
    const width = isVideo ? media.videoWidth : media.naturalWidth;
    const height = isVideo ? media.videoHeight : media.naturalHeight;
    const duration = isVideo ? media.duration : 0;
    if (!width || !height || (isVideo && (!Number.isFinite(duration) || duration <= 0))) throw new Error('无法读取素材尺寸或时长。');
    return { key: `${workflow.id}:${side}`, workflowId: workflow.id, side, name: name.slice(0,240),
      type: blob.type, width, height, duration, blob, updatedAt: Date.now() };
  } finally { if (isVideo) { media.pause(); media.removeAttribute('src'); media.load(); } URL.revokeObjectURL(url); }
}
async function changeAsset(workflow, side, file) {
  if (!file || busy) return;
  lock(true); saveStatus.textContent = '正在读取并保存素材…';
  try {
    const record = await inspectFile(file, file.name, workflow, side);
    await writeRecords([record]);
    release(record.key); records.set(record.key, record); replaceCard(workflow); saved();
    notify(`${workflow.name} · ${side === 'before' ? '原始素材' : '生成效果'}已保存`);
  } catch (err) { saved(); notify(err.name === 'QuotaExceededError' ? '浏览器空间不足，原素材已保留。请先导出备份并释放空间。' : err.message); }
  finally { lock(false); }
}
async function removeAsset(workflow, side) {
  if (busy) return;
  lock(true); const key = `${workflow.id}:${side}`;
  try { await writeRecords([], [key]); release(key); records.delete(key); replaceCard(workflow); saved(); notify('素材已删除并保存'); }
  catch (err) { notify('删除未保存，原素材已保留。'); }
  finally { lock(false); }
}
function createMedia(record, className = '') {
  const video = record.type.startsWith('video/');
  const el = element(video ? 'video' : 'img', className);
  el.src = urlFor(record);
  if (video) { el.muted = true; el.playsInline = true; el.preload = 'metadata'; }
  else { el.alt = record.side === 'before' ? '原始素材' : '生成效果'; el.decoding = 'async'; }
  return el;
}
function showOriginal(workflow, record) {
  const dialog = document.getElementById('mediaDialog');
  document.querySelectorAll('.case-card video').forEach(v => v.pause());
  document.getElementById('dialogTitle').textContent = `${workflow.name} · ${record.side === 'before' ? '原始素材' : '生成效果'} · ${record.width} × ${record.height}`;
  const media = createMedia(record); if (media.tagName === 'VIDEO') media.controls = true;
  document.getElementById('dialogMedia').replaceChildren(media); dialog.showModal();
}
function attachPlayback(container, videos, assetRecords) {
  if (!videos.length) return;
  const controls = element('div','playback'), toggle = button('播放', async () => {
    if (videos.some(v => !v.paused)) { videos.forEach(v => v.pause()); return; }
    document.querySelectorAll('.case-card video').forEach(v => { if (!videos.includes(v)) v.pause(); });
    const t = videos[0].currentTime >= duration - .08 ? 0 : videos[0].currentTime;
    videos.forEach(v => v.currentTime = t);
    try { await Promise.all(videos.map(v => v.play())); }
    catch { videos.forEach(v => v.pause()); notify('视频暂时无法播放，请尝试 MP4 或 WebM 格式。'); }
  });
  const duration = Math.min(...assetRecords.filter(r => r.type.startsWith('video/')).map(r => r.duration));
  const seek = element('input','video-seek'); seek.type = 'range'; seek.min = 0; seek.max = duration; seek.step = .01; seek.value = 0;
  seek.setAttribute('aria-label','共同播放进度');
  const time = element('span','video-time');
  const fmt = n => `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2,'0')}`;
  function refresh() { toggle.textContent = videos.some(v => !v.paused) ? '暂停' : '播放'; seek.value = videos[0].currentTime; time.textContent = `${fmt(videos[0].currentTime)} / ${fmt(duration)}`; }
  seek.addEventListener('input', () => { videos.forEach(v => v.currentTime = Number(seek.value)); refresh(); });
  videos.forEach(v => { v.addEventListener('play',refresh); v.addEventListener('pause',refresh); });
  videos[0].addEventListener('timeupdate', () => {
    const t = videos[0].currentTime;
    if (t >= duration - .04) { videos.forEach(v => { v.pause(); if (Math.abs(v.currentTime-duration) > .02) v.currentTime = Math.min(duration,v.duration); }); }
    else videos.slice(1).forEach(v => { if (Math.abs(v.currentTime-t) > .15 && !v.seeking) v.currentTime = t; });
    refresh();
  });
  videos.forEach(v => v.addEventListener('ended',() => { videos.forEach(x => x.pause()); refresh(); }));
  controls.append(toggle,seek,time); container.append(controls); refresh();
  if (videos.length === 2 && Math.abs(assetRecords[0].duration-assetRecords[1].duration) > .2)
    container.append(element('p','media-note','时长不同，对比播放到较短视频结束；可分别查看完整视频。'));
}
function uploadSlot(workflow, side, record) {
  const slot = element('div','upload-slot');
  const labelText = side === 'before' ? '原始素材' : '生成效果';
  const title = element('div','slot-label', labelText);
  const label = element('label','upload-label',record ? '替换' : `＋ 上传${labelText}`);
  const input = document.createElement('input'); input.type = 'file'; input.dataset.mutation = '';
  input.setAttribute('aria-label',`${workflow.name}上传${labelText}`);
  input.accept = workflow.type === 'image' ? imageTypes.join(',') : side === 'after' ? videoTypes.join(',') : [...imageTypes,...videoTypes].join(',');
  input.addEventListener('change',() => { const file = input.files[0]; input.value = ''; changeAsset(workflow,side,file); });
  label.append(input); slot.append(title,label);
  if (record) {
    const remove = button('删除',() => removeAsset(workflow,side),'remove-button'); remove.dataset.mutation = '';
    remove.setAttribute('aria-label',`${workflow.name}删除${labelText}`); slot.append(remove);
    const info = element('div','file-info',`${record.width} × ${record.height} · ${record.name}`); info.title = record.name; slot.append(info);
  } else slot.append(element('div','file-info', workflow.type === 'image' ? '图片 · 自动识别比例' : side === 'after' ? '视频 · 自动识别比例' : '图片或视频'));
  return slot;
}
async function renameWorkflow(workflow, input) {
  if (busy || !editing) return;
  const name = input.value.trim();
  if (!name || name.length > 40) { notify('工作流名称需为 1–40 个字符。'); input.focus(); return; }
  if (name === workflow.name) { nameDrafts.delete(workflow.id); input.value = name; return; }
  lock(true);
  try {
    await writeRecords([], [], [], [{workflowId:workflow.id, name}]);
    workflow.name = name;
    nameDrafts.delete(workflow.id);
    render(); saved(); notify('工作流名称已保存');
  } catch { notify('名称保存失败，原名称已保留。'); }
  finally { lock(false); }
}
function makeCard(workflow) {
  const card = element('article','case-card'); card.dataset.id = workflow.id;
  card.classList.toggle('selected',selectedId === workflow.id);
  const before = records.get(`${workflow.id}:before`), after = records.get(`${workflow.id}:after`);
  const base = after || before, stage = element('div','case-stage');
  if (base) {
    stage.style.aspectRatio = String(Math.max(.5,Math.min(3,base.width/base.height)));
    stage.dataset.width = base.width; stage.dataset.height = base.height;
    const videos = [], sourceRecords = [];
    if (before && after) {
      const first = createMedia(before,'comparison-media'), second = createMedia(after,'comparison-media after-media');
      second.style.clipPath = 'inset(0 0 0 50%)';
      stage.append(first,second);
      [first,second].forEach((m,i) => { if(m.tagName === 'VIDEO') videos.push(m); sourceRecords.push(i ? after : before); });
      const divider = element('div','case-divider'); divider.style.left = '50%'; divider.append(element('span','case-grip','↔'));
      const range = element('input','compare-slider'); range.type = 'range'; range.min = 0; range.max = 100; range.value = 50;
      range.setAttribute('aria-label',`${workflow.name}前后对比分割位置`);
      range.addEventListener('input', () => { second.style.clipPath = `inset(0 0 0 ${range.value}%)`; divider.style.left = `${range.value}%`; });
      stage.append(element('span','case-label before','修改前'),element('span','case-label after','修改后'),divider,range);
    } else {
      const media = createMedia(base,'comparison-media'); stage.append(media);
      stage.append(element('span','case-label before',after ? '生成效果' : '原始素材'));
      if (media.tagName === 'VIDEO') videos.push(media); sourceRecords.push(base);
    }
    card.append(stage); attachPlayback(card,videos,sourceRecords);
    const originals = element('div','original-actions');
    if(before) originals.append(button('查看原始素材',() => showOriginal(workflow,before)));
    if(after) originals.append(button('查看生成效果',() => showOriginal(workflow,after)));
    card.append(originals);
  } else {
    stage.classList.add('case-empty');
    stage.append(element('span','empty-mark','＋'),element('span','empty-title','待添加案例'),element('span','empty-detail',editing ? '在下方上传前后素材' : '开启编辑案例后添加素材'));
    card.append(stage);
  }
  const head = element('div','case-heading');
  head.append(button(workflow.name,() => selectWorkflow(workflow),'case-title'),button('使用 →',() => selectWorkflow(workflow),'use-workflow'));
  card.append(head);
  if (editing) {
    const form = element('form','workflow-name-editor');
    const input = element('input'); input.type = 'text'; input.value = nameDrafts.has(workflow.id) ? nameDrafts.get(workflow.id) : workflow.name; input.maxLength = 40;
    input.addEventListener('input', () => {
      if (input.value === workflow.name) nameDrafts.delete(workflow.id);
      else nameDrafts.set(workflow.id, input.value);
    });
    input.setAttribute('aria-label', `${workflow.name}的工作流名称`); input.dataset.mutation = '';
    const save = element('button','small-button','保存名称'); save.type = 'submit'; save.dataset.mutation = '';
    form.addEventListener('submit', e => { e.preventDefault(); renameWorkflow(workflow,input); });
    form.append(input,save); card.append(form);
  }
  if (!editing) {
    head.querySelector('.use-workflow').remove();
    card.tabIndex = 0;
    card.setAttribute('aria-label', `${workflow.name}，使用提示词模板`);
    let origin = null, dragged = false;
    card.addEventListener('pointerdown', e => { origin = {x:e.clientX,y:e.clientY}; dragged = false; });
    card.addEventListener('pointermove', e => { if(origin && Math.hypot(e.clientX-origin.x,e.clientY-origin.y)>6) dragged = true; });
    card.addEventListener('pointercancel', () => { origin = null; dragged = true; });
    card.addEventListener('click', e => {
      if(e.target.closest('button, label, .playback, .original-actions')) return;
      if(!dragged) selectWorkflow(workflow);
      origin = null;
    });
    card.addEventListener('keydown', e => {
      if(e.target === card && ['Enter',' '].includes(e.key)) { e.preventDefault(); selectWorkflow(workflow); }
    });
  }
  if(editing) { const slots = element('div','upload-slots'); slots.append(uploadSlot(workflow,'before',before),uploadSlot(workflow,'after',after)); card.append(slots); }
  return card;
}
function getColumnCount() { return window.innerWidth <= 560 ? 1 : window.innerWidth <= 900 ? 2 : window.innerWidth <= 1180 ? 3 : 4; }
function render() {
  masonry.querySelectorAll('video').forEach(v => v.pause());
  columns = getColumnCount(); masonry.style.setProperty('--columns',columns);
  const colEls = Array.from({length:columns},() => element('div','case-column'));
  const list = activeTab === 'image' ? imageWorkflows : videoWorkflows;
  const q = search.value.trim().toLowerCase(); let visible = 0;
  list.forEach((w,i) => { if(w.name.toLowerCase().includes(q)) { colEls[i%columns].append(makeCard(w)); visible++; } });
  masonry.replaceChildren(...colEls); masonry.hidden = visible === 0;
  document.getElementById('emptySearch').hidden = visible !== 0;
}
function replaceCard(workflow) {
  const old = masonry.querySelector(`[data-id="${workflow.id}"]`);
  if(old) { old.querySelectorAll('video').forEach(v => v.pause()); old.replaceWith(makeCard(workflow)); }
}
function selectWorkflow(workflow) {
  selectedId = workflow.id; setMode(workflow.type);
  masonry.querySelectorAll('.case-card').forEach(c => c.classList.toggle('selected',c.dataset.id === selectedId));
  if (templateFor(workflow)) { promptBox.value = templateFor(workflow); promptBox.focus(); composer.scrollIntoView({behavior:'smooth',block:'center'}); }
  else notify('此工作流暂未配置提示词模板，当前输入已保留。');
}

// A binary bundle keeps media bytes separate from the small JSON manifest.
// Layout: 8-byte magic, uint32 little-endian manifest length, UTF-8 manifest, raw assets.
const PACKAGE_MAGIC = 'AICASES1';
async function exportCases() {
  if(busy || !editing) return; lock(true); saveStatus.textContent = '正在打包案例…';
  try {
    const snapshot = await readRecords(); let offset = 0;
    const manifest = { format:3, names:allWorkflows.map(w => ({workflowId:w.id,name:w.name})), workflows:allWorkflows.map(w => w.id), templates:allWorkflows.map(w => ({workflowId:w.id, content:templateFor(w)})), assets:snapshot.map(r => {
      const item = {workflowId:r.workflowId,side:r.side,name:r.name,type:r.type,offset,size:r.blob.size}; offset += r.blob.size; return item;
    }) };
    const bytes = new TextEncoder().encode(JSON.stringify(manifest)); const length = new Uint8Array(4); new DataView(length.buffer).setUint32(0,bytes.length,true);
    const blob = new Blob([PACKAGE_MAGIC,length,bytes,...snapshot.map(r => r.blob)],{type:'application/octet-stream'});
    const url = URL.createObjectURL(blob), anchor = element('a'); anchor.href = url; anchor.download = `AI工作流案例-${new Date().toISOString().slice(0,10)}.aicases`;
    document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url),60000);
    saved(); notify('案例包已生成，包含全部工作流的名称、案例素材和提示词模板。');
  } catch { saved(); notify('案例包导出失败，请重试。'); } finally { lock(false); }
}
async function prepareImport(file) {
  if(!file || busy || !editing) return; lock(true); saveStatus.textContent = '正在校验案例包…';
  try {
    if(file.size < 12) throw new Error('不是有效的案例包。');
    const header = new Uint8Array(await file.slice(0,12).arrayBuffer());
    if(new TextDecoder().decode(header.slice(0,8)) !== PACKAGE_MAGIC) throw new Error('请选择本页面导出的 .aicases 案例包。');
    const size = new DataView(header.buffer).getUint32(8,true);
    if(!size || size > 4 * 1024 * 1024 || 12+size > file.size) throw new Error('案例包目录损坏。');
    const manifest = JSON.parse(await file.slice(12,12+size).text());
    if(![1,2,3].includes(manifest.format) || !Array.isArray(manifest.workflows) || !Array.isArray(manifest.assets) ||
       manifest.workflows.length > 16 || manifest.assets.length > 32 || new Set(manifest.workflows).size !== manifest.workflows.length ||
       manifest.workflows.some(id => !allWorkflows.some(w => w.id === id))) throw new Error('案例包版本或工作流信息不兼容。');
    const promptRecords = manifest.format >= 2 ? manifest.templates : [];
    if (!Array.isArray(promptRecords) || (manifest.format >= 2 && promptRecords.length !== manifest.workflows.length) ||
        new Set(promptRecords.map(t => t && t.workflowId)).size !== promptRecords.length ||
        promptRecords.some(t => !t || !manifest.workflows.includes(t.workflowId) || typeof t.content !== 'string' || t.content.length > 100000))
      throw new Error('案例包提示词模板无效。');
    const nameRecords = manifest.format === 3 ? manifest.names : [];
    if (!Array.isArray(nameRecords) || (manifest.format === 3 && nameRecords.length !== manifest.workflows.length) ||
        new Set(nameRecords.map(n => n && n.workflowId)).size !== nameRecords.length ||
        nameRecords.some(n => !n || !manifest.workflows.includes(n.workflowId) || typeof n.name !== 'string' || !n.name.trim() || n.name.length > 40))
      throw new Error('案例包工作流名称无效。');
    const seen = new Set(); let expectedOffset = 0; const imported = [];
    for(const asset of manifest.assets) {
      const workflow = allWorkflows.find(w => w.id === asset.workflowId), key = `${asset.workflowId}:${asset.side}`;
      if(!workflow || !manifest.workflows.includes(asset.workflowId) || !['before','after'].includes(asset.side) || seen.has(key) ||
         !Number.isSafeInteger(asset.size) || asset.size <= 0 || asset.size > MAX_FILE || asset.offset !== expectedOffset ||
         typeof asset.name !== 'string' || typeof asset.type !== 'string') throw new Error('案例包素材目录无效。');
      expectedOffset += asset.size; if(12+size+expectedOffset > file.size) throw new Error('案例包不完整。');
      seen.add(key);
      const blob = file.slice(12+size+asset.offset,12+size+expectedOffset,asset.type);
      imported.push(await inspectFile(blob,asset.name,workflow,asset.side));
    }
    if(12+size+expectedOffset !== file.size) throw new Error('案例包长度不匹配。');
    pendingImport = { imported, ids:manifest.workflows, promptRecords, nameRecords };
    document.getElementById('importSummary').textContent = `已校验 ${manifest.workflows.length} 个工作流、${imported.length} 份素材。${manifest.format >= 2 ? '同时恢复对应提示词模板；第 3 版案例包也恢复工作流名称。' : '这是旧版案例包，现有提示词模板保持不变。'}`;
    document.getElementById('importDialog').showModal(); saved();
  } catch(err) { pendingImport = null; saved(); notify(`导入未执行：${err.message}`); }
  finally { lock(false); }
}
async function commitImport() {
  if(!pendingImport || busy || !editing) return; lock(true);
  const {imported,ids,promptRecords,nameRecords} = pendingImport;
  try {
    const deletes = ids.flatMap(id => [`${id}:before`,`${id}:after`]);
    await writeRecords(imported,deletes,promptRecords,nameRecords);
    nameRecords.forEach(n => { allWorkflows.find(w => w.id === n.workflowId).name = n.name.trim(); });
    promptRecords.forEach(t => templates.set(t.workflowId,t.content));
    deletes.forEach(key => { release(key); records.delete(key); }); imported.forEach(r => records.set(r.key,r));
    render(); saved(); notify('案例包已导入并保存，素材及包内提示词模板已恢复。'); pendingImport = null; document.getElementById('importDialog').close();
  } catch(err) { notify(err.name === 'QuotaExceededError' ? '空间不足，导入未保存，原案例已保留。' : '导入保存失败，原案例已保留。'); }
  finally { lock(false); }
}
document.getElementById('editCases').addEventListener('click',() => {
  if(busy) return; editing = !editing;
  document.getElementById('editCases').setAttribute('aria-checked',String(editing));
  document.getElementById('editCases').textContent = `编辑案例 · ${editing ? '开' : '关'}`;
  document.getElementById('editHint').hidden = !editing;
  document.getElementById('exportCases').hidden = !editing;
  document.querySelector('.import-label').hidden = !editing;
  render();
});
document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click',() => {
  activeTab = tab.dataset.tab; document.querySelectorAll('.tab').forEach(t => {t.classList.toggle('active',t === tab); t.setAttribute('aria-pressed',String(t===tab));}); render();
}));
search.addEventListener('input',render);
window.addEventListener('resize',() => {if(getColumnCount() !== columns) render();});
document.getElementById('exportCases').addEventListener('click',exportCases);
document.getElementById('importCases').addEventListener('change',e => {const file = e.target.files[0]; e.target.value = ''; prepareImport(file);});
document.getElementById('confirmImport').addEventListener('click',commitImport);
document.getElementById('cancelImport').addEventListener('click',() => document.getElementById('importDialog').close());
document.getElementById('importDialog').addEventListener('cancel',e => {if(busy) e.preventDefault();});
document.getElementById('importDialog').addEventListener('close',() => pendingImport = null);
document.getElementById('closeDialog').addEventListener('click',() => document.getElementById('mediaDialog').close());
document.getElementById('mediaDialog').addEventListener('close',() => { document.querySelectorAll('#dialogMedia video').forEach(v => v.pause()); document.getElementById('dialogMedia').replaceChildren(); });
document.addEventListener('visibilitychange',() => {if(document.hidden) document.querySelectorAll('video').forEach(v => v.pause());});
window.addEventListener('beforeunload',e => {if(busy) {e.preventDefault(); e.returnValue = '';}});
async function initCases() {
  lock(true);
  try {
    const db = await dbPromise;
    const storedNames = await new Promise((resolve,reject) => {
      const req = db.transaction('names').objectStore('names').getAll();
      req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
    });
    storedNames.forEach(n => { const w = allWorkflows.find(w => w.id === n.workflowId); if(w) w.name = n.name; });
    const storedTemplates = await new Promise((resolve,reject) => {
      const req = db.transaction('templates').objectStore('templates').getAll();
      req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
    });
    templates = new Map(storedTemplates.map(t => [t.workflowId,t.content]));
    const stored = await readRecords(); records = new Map(stored.map(r => [r.key,r])); render(); saved(); }
  catch { render(); saveStatus.textContent = '本机保存不可用，请检查浏览器存储权限后刷新。'; saveStatus.classList.add('error'); }
  finally { lock(false); }
}
initCases();
