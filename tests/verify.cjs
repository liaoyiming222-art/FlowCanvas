const {chromium} = require('C:/Users/122305/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const root = path.resolve(__dirname,'..'), out = path.join(__dirname,'results');
fs.mkdirSync(out,{recursive:true});
const results = [], errors = [];
function pass(name) { results.push({name,pass:true}); console.log('PASS',name); }
function patchDuration(buffer,ms) {
  function vint(pos,id=false) { let width=1; while(width<=8 && !(buffer[pos] & (1 << (8-width)))) width++; let value = id ? buffer[pos] : buffer[pos] & ((1 << (8-width))-1); for(let i=1;i<width;i++) value=value*256+buffer[pos+i]; return {width,value}; }
  function find(start,end,id) { for(let pos=start;pos<end;) {const a=vint(pos,true),b=vint(pos+a.width),data=pos+a.width+b.width; if(a.value===id)return {pos,sizePos:pos+a.width,size:b.value,width:b.width,data,end:data+b.value};pos=data+b.value;} }
  const segment=find(0,buffer.length,0x18538067),info=find(segment.data,buffer.length,0x1549a966);
  const extra=Buffer.alloc(11);extra.set([0x44,0x89,0x88]);extra.writeDoubleBE(ms,3);
  let size=info.size+extra.length;const encoded=Buffer.alloc(info.width);for(let i=info.width-1;i>=0;i--){encoded[i]=size%256;size=Math.floor(size/256);}encoded[0]|=1 << (8-info.width);
  assert.equal(size,0);return Buffer.concat([buffer.subarray(0,info.sizePos),encoded,buffer.subarray(info.data,info.end),extra,buffer.subarray(info.end)]);
}
(async()=>{
  const browser = await chromium.launch({channel:'msedge',headless:true});
  const context = await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
  const page = await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  try {
    const response=await page.goto('http://127.0.0.1:4173'); assert.equal(response.status(),200);
    await page.waitForFunction(()=>document.getElementById('saveStatus').textContent.includes('0/16'));
    assert.equal(await page.locator('.case-card').count(),10);
    assert.equal(await page.locator('.case-card img,.case-card video').count(),0);
    const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'workflows.js'),'utf8').replace(/\r\n/g,'\n')).digest('hex');
    assert.ok(fs.readFileSync(path.join(root,'执行计划与验收.md'),'utf8').includes(hash));
    const templateStart = await page.evaluate(()=>JSON.stringify(prompts));
    pass('初始清空素材；10 个图片卡片；工作流与提示词校验一致');

    const imageFixture = async(width,height,color) => Buffer.from(await page.evaluate(async({width,height,color})=>{
      const c=document.createElement('canvas');c.width=width;c.height=height;const x=c.getContext('2d');x.fillStyle=color;x.fillRect(0,0,width,height);x.fillStyle='#fff';x.fillRect(width*.1,height*.1,width*.3,height*.2);return c.toDataURL('image/png').split(',')[1];
    },{width,height,color}),'base64');
    const landscape=await imageFixture(800,450,'#227d95'),portrait=await imageFixture(450,800,'#da9062'),tall=await imageFixture(200,1400,'#677fa1');
    const upload=async(id,side,buffer,name='sample.png',mimeType='image/png')=>{
      const title = side==='before'?'原始素材':'生成效果';
      await page.locator(`[data-id="${id}"] input[type=file]`).nth(side==='before'?0:1).setInputFiles({name,mimeType,buffer});
      await page.waitForFunction(()=>!document.body.classList.contains('saving'));
      assert.ok((await page.locator(`[data-id="${id}"] .upload-slot`).nth(side==='before'?0:1).innerText()).includes(name));
    };
    const otherY=await page.locator('[data-id="object"]').evaluate(el=>el.getBoundingClientRect().top+scrollY);
    await upload('material','before',landscape,'before.png');
    assert.equal(await page.locator('[data-id="material"] .compare-slider').count(),0);
    await upload('material','after',portrait,'after.png');
    assert.equal(await page.locator('[data-id="material"] .compare-slider').count(),1);
    const ratio=await page.locator('[data-id="material"] .case-stage').evaluate(el=>el.clientWidth/el.clientHeight);
    assert.ok(Math.abs(ratio-450/800)<.01);
    const newOtherY=await page.locator('[data-id="object"]').evaluate(el=>el.getBoundingClientRect().top+scrollY);
    assert.equal(otherY,newOtherY);
    assert.deepEqual(await page.locator('[data-id="material"] img').evaluateAll(els=>els.map(el=>getComputedStyle(el).objectFit)),['contain','contain']);
    pass('双素材独立上传；单素材回退；以效果比例适配；完整显示；其他列位置稳定');
    const slider=page.locator('[data-id="material"] .compare-slider');
    await slider.focus();await slider.press('ArrowRight');
    assert.equal(await slider.inputValue(),'51');
    assert.match(await page.locator('[data-id="material"] .after-media').getAttribute('style'),/51%/);
    assert.equal(await page.locator('#prompt').inputValue(),'');
    await page.locator('[data-id="material"] .use-workflow').click();
    assert.ok((await page.locator('#prompt').inputValue()).includes('原始场景图 @图片1'));
    pass('键盘调整对比分割线；对比不误填模板；使用按钮填入原模板');
    await upload('object','after',tall,'tall.png');
    const tallRatio=await page.locator('[data-id="object"] .case-stage').evaluate(el=>el.clientWidth/el.clientHeight);
    assert.ok(Math.abs(tallRatio-.5)<.01);
    await page.locator('[data-id="object"] .original-actions button').click();
    assert.equal(await page.locator('#mediaDialog').evaluate(el=>el.open),true);
    assert.match(await page.locator('#dialogTitle').innerText(),/200 × 1400/);
    await page.keyboard.press('Escape');assert.equal(await page.locator('#mediaDialog').evaluate(el=>el.open),false);
    pass('极端比例限制高度；可打开原始尺寸素材并用 Escape 关闭');
    await page.reload(); await page.waitForFunction(()=>document.querySelectorAll('[data-id="material"] img').length===2);
    assert.equal(await page.locator('[data-id="material"] .compare-slider').count(),1);
    await page.getByRole('switch',{name:'编辑案例'}).click();assert.equal(await page.locator('.upload-slots').count(),0);
    assert.equal(await page.locator('[data-id="material"] img').count(),2);
    await page.getByRole('switch',{name:'编辑案例'}).click();
    pass('刷新恢复前后素材；展示模式隐藏编辑入口且保留对比');
    await upload('material','after',landscape,'replacement.png');
    await page.getByRole('button',{name:'材质替换删除生成效果',exact:true}).click();
    await page.waitForFunction(()=>!document.body.classList.contains('saving'));
    assert.equal(await page.locator('[data-id="material"] img').count(),1);
    await page.reload();await page.waitForSelector('[data-id="material"] img');assert.equal(await page.locator('[data-id="material"] img').count(),1);
    await upload('material','after',portrait,'after.png');
    pass('替换、删除及删除后的刷新恢复正确');
    await page.locator('[data-id="material"] input[type=file]').nth(1).setInputFiles({name:'bad.png',mimeType:'image/png',buffer:Buffer.from('broken image')});
    await page.waitForFunction(()=>!document.body.classList.contains('saving'));
    assert.ok((await page.locator('[data-id="material"] .upload-slot').nth(1).innerText()).includes('after.png'));
    assert.match(await page.locator('#toast').innerText(),/无法解码/);
    pass('损坏图片拒绝保存，原素材不受影响');
    await page.locator('#search').fill('不存在的工作流');assert.equal(await page.locator('.case-card').count(),0);assert.equal(await page.locator('#emptySearch').isVisible(),true);
    await page.locator('#search').fill('材质');assert.equal(await page.locator('.case-card').count(),1);await page.locator('#search').fill('');
    await page.locator('[data-tab="video"]').click();assert.equal(await page.locator('.case-card').count(),6);
    pass('搜索及空结果反馈；视频分类保留 6 个工作流');
    const videoRaw=Buffer.from(await page.evaluate(async()=>{
      const c=document.createElement('canvas');c.width=320;c.height=180;const x=c.getContext('2d');
      const stream=c.captureStream(15),rec=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8'}),chunks=[];
      const done=new Promise(resolve=>{rec.ondataavailable=e=>chunks.push(e.data);rec.onstop=async()=>resolve(Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer())));});
      rec.start();let frame=0;const timer=setInterval(()=>{x.fillStyle='#136d80';x.fillRect(0,0,320,180);x.fillStyle='#f4a477';x.fillRect((frame++*6)%280,50,40,70);},60);
      await new Promise(r=>setTimeout(r,2300));clearInterval(timer);rec.stop();stream.getTracks().forEach(t=>t.stop());return await done;
    }));
    const video=patchDuration(videoRaw,2300);
    await upload('videoPerson','before',video,'before.webm','video/webm');
    await upload('videoPerson','after',video,'after.webm','video/webm');
    const videoCard=page.locator('[data-id="videoPerson"]');assert.equal(await videoCard.locator('video').count(),2);
    await videoCard.getByRole('button',{name:'播放',exact:true}).click();
    await page.waitForFunction(()=>Array.from(document.querySelectorAll('[data-id="videoPerson"] video')).every(v=>!v.paused && v.currentTime>.3));
    const times=await videoCard.locator('video').evaluateAll(v=>v.map(x=>x.currentTime));assert.ok(Math.abs(times[0]-times[1])<.2);
    await videoCard.getByRole('button',{name:'暂停',exact:true}).click();
    await videoCard.locator('.video-seek').fill('1');
    await page.waitForFunction(()=>Array.from(document.querySelectorAll('[data-id="videoPerson"] video')).every(v=>Math.abs(v.currentTime-1)<.15));
    await videoCard.getByRole('button',{name:'播放',exact:true}).click();
    await page.waitForFunction(()=>Array.from(document.querySelectorAll('[data-id="videoPerson"] video')).every(v=>v.paused && v.currentTime>2),{},{timeout:7000});
    pass('视频双素材对比、共同播放暂停、进度跳转、结束停止');
    await upload('img2video','before',landscape,'source.png');await upload('img2video','after',video,'result.webm','video/webm');
    assert.equal(await page.locator('[data-id="img2video"] img').count(),1);assert.equal(await page.locator('[data-id="img2video"] video').count(),1);
    await page.screenshot({path:path.join(out,'video-comparison.png'),fullPage:true});
    pass('图片转视频混合素材对比可用');
    const downloadPromise=page.waitForEvent('download');await page.locator('#exportCases').click();const download=await downloadPromise;
    const bundlePath=path.join(out,'roundtrip.aicases');await download.saveAs(bundlePath);
    const dataBefore=await page.evaluate(async()=> (await readRecords()).map(r=>({key:r.key,name:r.name,size:r.blob.size})).sort((a,b)=>a.key.localeCompare(b.key)));
    await page.getByRole('button',{name:'人物替换删除生成效果',exact:true}).click();await page.waitForFunction(()=>!document.body.classList.contains('saving'));
    await page.locator('#importCases').setInputFiles(bundlePath);await page.waitForSelector('#importDialog[open]');await page.locator('#cancelImport').click();
    assert.equal(await page.locator('[data-id="videoPerson"] video').count(),1);
    await page.locator('#importCases').setInputFiles(bundlePath);await page.waitForSelector('#importDialog[open]');await page.locator('#confirmImport').click();
    await page.waitForFunction(()=>!document.getElementById('importDialog').open);
    const dataAfter=await page.evaluate(async()=> (await readRecords()).map(r=>({key:r.key,name:r.name,size:r.blob.size})).sort((a,b)=>a.key.localeCompare(b.key)));
    assert.deepEqual(dataAfter,dataBefore);assert.equal(await page.evaluate(()=>JSON.stringify(prompts)),templateStart);
    pass('案例包完整往返；取消不修改；导入恢复全部素材且不改提示词');
    const bundle=fs.readFileSync(bundlePath);
    await page.locator('#importCases').setInputFiles({name:'truncated.aicases',mimeType:'application/octet-stream',buffer:bundle.subarray(0,bundle.length-100)});
    await page.waitForFunction(()=>!document.body.classList.contains('saving'));
    assert.match(await page.locator('#toast').innerText(),/导入未执行/);
    assert.equal(await page.locator('#importDialog').evaluate(el=>el.open),false);
    assert.deepEqual(await page.evaluate(async()=> (await readRecords()).map(r=>({key:r.key,name:r.name,size:r.blob.size})).sort((a,b)=>a.key.localeCompare(b.key))),dataBefore);
    pass('截断案例包拒绝导入，原保存内容保持完整');
    await page.locator('[data-tab="image"]').click();
    await page.locator('#topUpload').setInputFiles({name:'composer.png',mimeType:'image/png',buffer:landscape});assert.equal(await page.locator('#assetStrip img').count(),1);
    await page.locator('#assetStrip button').click();assert.equal(await page.locator('#assetStrip img').count(),0);
    await page.locator('.auto-wrap > button').click();await page.locator('[data-ratio="16:9"]').click();assert.match(await page.locator('[data-ratio="16:9"]').getAttribute('class'),/active/);
    await page.locator('.segmented[data-group="quality"] button').last().click();assert.match(await page.locator('.segmented[data-group="quality"] button').last().getAttribute('class'),/active/);
    await page.locator('.title').click();
    pass('原顶部素材上传删除、比例与质量选择仍可操作');
    await page.screenshot({path:path.join(out,'desktop-comparison.png'),fullPage:true});
    for(const width of [1024,768,390,320]) {
      await page.setViewportSize({width,height:900});
      await page.waitForFunction(expected=>document.querySelectorAll('.case-column').length===expected,width<=560?1:width<=900?2:3);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`overflow at ${width}`);
      assert.equal(await page.locator('.case-column').count(),width<=560?1:width<=900?2:3);
    }
    await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'mobile-comparison.png'),fullPage:true});
    await page.locator('.auto-wrap > button').click();
    const panelBox=await page.locator('#autoPanel').boundingBox();assert.ok(panelBox.x>=0 && panelBox.x+panelBox.width<=390);
    pass('320/390/768/1024/1440 宽度布局；移动端无横向溢出；参数面板可见');
    assert.deepEqual(errors,[]);pass('浏览器无未捕获脚本错误');
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({passed:results.length,results,errors},null,2));
  } catch(e) {
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({results,errors,failure:e.stack},null,2));
    await page.screenshot({path:path.join(out,'failure.png'),fullPage:true});throw e;
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
