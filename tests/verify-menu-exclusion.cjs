const {chromium}=require('C:/Users/122305/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4173');await page.waitForFunction(()=>!busy);
const mode=page.locator('#modeLabel'),params=page.locator('#parameterButton');
async function state(m,p){assert.equal(await page.locator('#modeBtn').evaluate(e=>e.classList.contains('open')),m);assert.equal(await page.locator('#autoPanel').isVisible(),p);assert.equal(await params.getAttribute('aria-expanded'),String(p));}
await mode.click();await state(true,false);await params.click();await state(false,true);
await page.locator('[data-ratio="16:9"]').click();await page.locator('[data-group="resolution"]').getByText('2K',{exact:true}).click();await page.locator('[data-group="count"]').getByText('3',{exact:true}).click();await state(false,true);
await mode.click();await state(true,false);await page.locator('[data-mode="video"]').click();await state(false,false);assert.equal(await mode.innerText(),'视频生成');
await params.click();await state(false,true);assert.equal(await params.innerText(),'16:9 · 2K · 3');await params.click();await state(false,false);
await mode.click();await mode.click();await state(false,false);await mode.click();await page.keyboard.press('Escape');await state(false,false);
await params.click();await page.keyboard.press('Escape');await state(false,false);await mode.click();await page.locator('#prompt').click();await state(false,false);await params.click();await page.locator('#prompt').click();await state(false,false);
assert.equal(await mode.innerText(),'视频生成');assert.equal(await params.innerText(),'16:9 · 2K · 3');assert.deepEqual(errors,[]);console.log('PASS 双向互斥、重复点击关闭、Esc和外部关闭、连续参数选择、模式选择关闭、选项保留');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
