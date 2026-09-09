const {chromium}=require('C:/Users/122305/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');const fs=require('node:fs');
function pack(m){const b=Buffer.from(JSON.stringify(m));const h=Buffer.alloc(12);h.write('AICASES1');h.writeUInt32LE(b.length,8);return Buffer.concat([h,b]);}
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{const page=await browser.newPage({acceptDownloads:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4173');await page.waitForFunction(()=>!busy);
const toggle=()=>page.locator('#editCases').click();
await toggle();assert.equal(await page.locator('#exportCases').isVisible(),false);assert.equal(await page.locator('.import-label').isVisible(),false);assert.equal(await page.locator('.use-workflow').count(),0);
await page.locator('[data-id="material"] .case-stage').click();assert.match(await page.locator('#prompt').inputValue(),/原始场景图/);
await page.locator('#prompt').fill('保留输入');await page.locator('[data-id="background"] .case-stage').click();assert.equal(await page.locator('#prompt').inputValue(),'保留输入');
await page.locator('[data-id="object"]').focus();await page.keyboard.press('Enter');assert.match(await page.locator('#prompt').inputValue(),/需要替换的物品/);
await toggle();
async function prepare(m){await page.locator('#importCases').setInputFiles({name:'test.aicases',mimeType:'application/octet-stream',buffer:pack(m)});await page.waitForFunction(()=>!busy);}
async function commit(){await page.locator('#confirmImport').click();await page.waitForFunction(()=>!busy);}
const m={format:2,workflows:['background','material'],templates:[{workflowId:'background',content:'导入的背景模板\n第二行'},{workflowId:'material',content:''}],assets:[]};
await prepare(m);await page.locator('#cancelImport').click();assert.equal(await page.evaluate(()=>templateFor(imageWorkflows[3])),'');
await prepare(m);await commit();await page.reload();await page.waitForFunction(()=>!busy);assert.equal(await page.evaluate(()=>templateFor(imageWorkflows[3])),m.templates[0].content);assert.equal(await page.evaluate(()=>templateFor(imageWorkflows[0])),'');
await toggle();await page.locator('[data-id="background"] .case-stage').click();assert.equal(await page.locator('#prompt').inputValue(),m.templates[0].content);await toggle();
await prepare({format:1,workflows:['background'],assets:[]});await commit();assert.equal(await page.evaluate(()=>templateFor(imageWorkflows[3])),m.templates[0].content);
await prepare({...m,templates:[{workflowId:'background',content:3}]});assert.equal(await page.locator('#importDialog').isVisible(),false);assert.equal(await page.evaluate(()=>templateFor(imageWorkflows[3])),m.templates[0].content);
const downloading=page.waitForEvent('download');await page.locator('#exportCases').click();const d=await downloading;const b=fs.readFileSync(await d.path());const exported=JSON.parse(b.subarray(12,12+b.readUInt32LE(8)));assert.equal(exported.format,3);assert.equal(exported.templates.length,16);assert.equal(exported.templates.find(t=>t.workflowId==='background').content,m.templates[0].content);
// Populate comparison media in this isolated browser only.
await page.evaluate(async()=>{const w=imageWorkflows[1];const c=document.createElement('canvas');c.width=200;c.height=200;const blob=await new Promise(r=>c.toBlob(r));await changeAsset(w,'before',new File([blob],'before.png',{type:'image/png'}));await changeAsset(w,'after',new File([blob],'after.png',{type:'image/png'}));});
await toggle();await page.locator('#prompt').fill('拖动不填入');const slider=page.locator('[data-id="object"] .compare-slider');await slider.scrollIntoViewIfNeeded();const box=await slider.boundingBox();await page.mouse.move(box.x+box.width*.3,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.7,box.y+box.height*.5,{steps:10});await page.mouse.up();assert.equal(await page.locator('#prompt').inputValue(),'拖动不填入');await slider.click({position:{x:20,y:20}});assert.match(await page.locator('#prompt').inputValue(),/需要替换的物品/);
assert.deepEqual(errors,[]);console.log('PASS 新增验收：编辑状态、整卡点击、键盘、无模板、取消导入、模板持久化、空模板、旧包兼容、无效模板、导出内容、对比拖动与单击');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
