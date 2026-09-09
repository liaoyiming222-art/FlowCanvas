function setMode(mode){
  const names={agent:"Agent 模式",image:"图片生成",video:"视频生成"};
  document.getElementById("modeLabel").textContent=names[mode];
  document.querySelectorAll(".mode-item").forEach(el=>{
    const active=el.dataset.mode===mode; el.classList.toggle("active",active);
    el.innerHTML=names[el.dataset.mode]+(active?" <span>✓</span>":"");
  });
}

const modeBtn=document.getElementById("modeBtn");
modeBtn.addEventListener("click",e=>{e.stopPropagation();modeBtn.classList.toggle("open")});
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


document.addEventListener("DOMContentLoaded",()=>{
  const panel=document.getElementById("autoPanel");
  if(!panel)return;
  const wrap=panel.closest(".auto-wrap");
  const trigger=wrap.querySelector("button");
  trigger.addEventListener("click",(e)=>{
    e.stopPropagation();
    panel.classList.toggle("open");
  });
  panel.addEventListener("click",e=>e.stopPropagation());
  document.addEventListener("click",()=>panel.classList.remove("open"));

  panel.querySelectorAll(".ratio-option").forEach(btn=>{
    btn.addEventListener("click",()=>{
      panel.querySelectorAll(".ratio-option").forEach(x=>x.classList.remove("active"));
      btn.classList.add("active");
    });
  });
  panel.querySelectorAll(".segmented").forEach(group=>{
    group.querySelectorAll("button").forEach(btn=>{
      btn.addEventListener("click",()=>{
        group.querySelectorAll("button").forEach(x=>x.classList.remove("active"));
        btn.classList.add("active");
      });
    });
  });
});
