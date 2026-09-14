function setMode(mode){
  const names={agent:"Agent 模式",image:"图片生成",video:"视频生成"};
  document.getElementById("modeLabel").textContent=names[mode];
  document.querySelectorAll(".mode-item").forEach(el=>{
    const active=el.dataset.mode===mode; el.classList.toggle("active",active);
    el.innerHTML=names[el.dataset.mode]+(active?" <span>✓</span>":"");
  });
}

const modeBtn=document.getElementById("modeBtn");
modeBtn.addEventListener("click",e=>{e.stopPropagation();closeParameters();modeBtn.classList.toggle("open")});
document.querySelectorAll(".mode-item").forEach(el=>el.addEventListener("click",e=>{e.stopPropagation();setMode(el.dataset.mode);modeBtn.classList.remove("open")}));
document.addEventListener("click",()=>modeBtn.classList.remove("open"));



/* 顶部输入框上传：多图/视频、缩略图、删除、拖拽 */
const upload=document.getElementById("topUpload");
const strip=document.getElementById("assetStrip");
const urls=new Set();
function addFiles(files){
  [...files].forEach(file=>{
    if(!file.type.startsWith("image/")&&!file.type.startsWith("video/"))return;
    const url=URL.createObjectURL(file); urls.add(url);
    const item=document.createElement("div"); item.className="asset";
    let preview;
    if(file.type.startsWith("image/")){preview=document.createElement("img");preview.src=url;preview.alt=file.name;}
    else{preview=document.createElement("video");preview.src=url;preview.muted=true;preview.playsInline=true;}
    const remove=document.createElement("button");remove.type="button";remove.textContent="×";
    remove.addEventListener("click",()=>{URL.revokeObjectURL(url);urls.delete(url);item.remove()});
    item.append(preview,remove);strip.appendChild(item);
  });
}
upload.addEventListener("change",e=>{addFiles(e.target.files);upload.value=""});
["dragenter","dragover"].forEach(evt=>composer.addEventListener(evt,e=>{e.preventDefault();composer.classList.add("drag")}));
["dragleave","drop"].forEach(evt=>composer.addEventListener(evt,e=>{e.preventDefault();composer.classList.remove("drag")}));
composer.addEventListener("drop",e=>addFiles(e.dataTransfer.files));
window.addEventListener("beforeunload",()=>urls.forEach(URL.revokeObjectURL));


const generationSettings = {ratio:'智能',resolution:'1K',count:1};
const panel=document.getElementById('autoPanel'), parameterButton=document.getElementById('parameterButton');
function positionParameters() {
  if(!panel.classList.contains('open'))return;
  const r=parameterButton.getBoundingClientRect();
  panel.style.left = `${Math.max(12,Math.min(r.left,innerWidth-panel.offsetWidth-12))}px`;
  panel.style.top = `${r.bottom+8}px`;
  panel.style.maxHeight = `${Math.max(80,innerHeight-r.bottom-20)}px`;
}
function closeParameters(){ panel.classList.remove('open'); parameterButton.setAttribute('aria-expanded','false'); }
parameterButton.addEventListener('click',e=>{
  e.stopPropagation(); modeBtn.classList.remove('open'); panel.classList.toggle('open');
  parameterButton.setAttribute('aria-expanded',String(panel.classList.contains('open'))); positionParameters();
});
panel.addEventListener('click',e=>e.stopPropagation());
document.addEventListener('click',closeParameters);
document.addEventListener('keydown',e=>{
  if(e.key!=='Escape')return;
  if(panel.classList.contains('open')){closeParameters();parameterButton.focus();}
  modeBtn.classList.remove('open');
});
window.addEventListener('resize',positionParameters);window.addEventListener('scroll',positionParameters,true);
function updateParameters(){
  parameterButton.textContent=`${generationSettings.ratio} · ${generationSettings.resolution} · ${generationSettings.count}`;
  panel.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.classList.contains('active'))));
}
panel.querySelectorAll('button').forEach(btn=>btn.addEventListener('click',()=>{
  const group=btn.closest('.ratio-grid,.segmented');
  group.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b===btn));
  if(btn.dataset.ratio)generationSettings.ratio=btn.dataset.ratio;
  else if(group.dataset.group==='count')generationSettings.count=Number(btn.textContent);
  else generationSettings.resolution=btn.textContent;
  updateParameters();positionParameters();
}));
updateParameters();
