const {chromium}=require('C:/Users/122305/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
const page=await browser.newPage();await page.route('**/defaults/default.aicases', route=>route.fulfill({status:404,body:''}));await page.goto('http://127.0.0.1:4173');await page.waitForFunction(()=>!busy);
const input=id=>page.locator(`[data-id="${id}"] .workflow-name-editor input`);
await input('material').fill('已保存名称');await input('object').fill('尚未保存的物品名称');await input('background').fill('');
await page.locator('[data-id="material"]').getByText('保存名称',{exact:true}).click();await page.waitForFunction(()=>!busy);
assert.equal(await input('object').inputValue(),'尚未保存的物品名称');assert.equal(await input('background').inputValue(),'');
await page.locator('#search').fill('已保存');await page.locator('#search').fill('');assert.equal(await input('object').inputValue(),'尚未保存的物品名称');
await page.locator('[data-tab="video"]').click();await page.locator('[data-tab="image"]').click();assert.equal(await input('object').inputValue(),'尚未保存的物品名称');
await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>document.querySelectorAll('.case-column').length===1);assert.equal(await input('object').inputValue(),'尚未保存的物品名称');
await page.locator('#editCases').click();await page.locator('#editCases').click();assert.equal(await input('object').inputValue(),'尚未保存的物品名称');
await page.locator('[data-id="object"]').getByText('保存名称',{exact:true}).click();await page.waitForFunction(()=>!busy);await page.reload();await page.waitForFunction(()=>!busy);assert.equal(await input('object').inputValue(),'尚未保存的物品名称');assert.equal(await input('material').inputValue(),'已保存名称');assert.equal(await input('background').inputValue(),'背景替换');
console.log('PASS 保存单项保留其他草稿（含空值）、搜索、分类切换、响应式重排、编辑切换、逐项保存及刷新恢复');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
