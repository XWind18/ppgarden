// 只在 tests/fixtures/flower-trade.html 的模拟接口环境执行。
(async () => {
  const output = document.querySelector('#trade-check-result');
  const fixture = window.tradeFixture;
  const panel = document.querySelector('#ppg-trade-panel');
  const launcher = document.querySelector('#ppg-trade-open');
  const results = panel.querySelector('#ppg-trade-results');
  const status = panel.querySelector('#ppg-trade-status');
  const passed = [];
  const assert = (condition, text) => {
    if (!condition) throw new Error(text);
    passed.push(text);
  };
  const tick = () => new Promise(resolve => setTimeout(resolve, 40));
  const wait = async () => {
    for (let i = 0; i < 200 && results.getAttribute('aria-busy') === 'true'; i++) await tick();
    assert(results.getAttribute('aria-busy') === 'false', '读取结束后退出忙碌状态');
  };
  const refresh = async (scenario, expire = true) => {
    if (expire) fixture.advance(61000);
    fixture.scenario = scenario;
    fixture.calls.length = 0;
    panel.querySelector('[data-trade="refresh"]').click();
    await wait();
  };
  const group = id => results.querySelector(`[data-account="${id}"]`);
  const row = (id, key) => group(id).querySelector(`[data-flower="${key}"]`);
  const until = async read => {
    for (let i = 0; i < 200; i++) { if (read()) return; await tick(); }
    throw new Error('快捷入口未完成预期操作：' + document.querySelector('#ppg-trade-notice').textContent);
  };
  try {
    assert(fixture && panel.tagName === 'DIV' && panel.hidden, '使用独立 div 悬浮窗，初始关闭');
    assert(!launcher.hidden && fixture.calls.length === 0, '仅在交易页显示入口，未打开时不读取接口');
    launcher.focus();
    launcher.click();
    assert(!panel.hidden && launcher.getAttribute('aria-expanded') === 'true', '点击入口打开悬浮窗');
    assert(document.activeElement === panel.querySelector('[data-trade="close"]'), '打开时聚焦关闭按钮，不弹出手机键盘');
    await tick();
    assert(results.getAttribute('aria-busy') === 'true' && results.querySelector('li'), '查询尚未完成时已显示首批可交易结果');
    group('account-a').open = false;
    const focusedRequest = row('account-b', '1:5').dataset.request;
    row('account-b', '1:5').querySelector('.pt-action').focus();
    await wait();
    assert(!group('account-a').open, '逐步更新结果时保留用户折叠的账号');
    assert(document.activeElement.classList.contains('pt-action')
      && document.activeElement.closest('details').dataset.account === 'account-b'
      && document.activeElement.closest('li').dataset.request === focusedRequest, '逐步更新结果时保留同一账号同一求购的按钮焦点');
    group('account-a').open = true;
    assert([...results.querySelectorAll('details')].map(d => d.dataset.account).join(',') === 'account-a,account-b,account-c,account-d', '按页面账号顺序分组，兼容多个渠道');
    assert(group('account-a').querySelectorAll('li').length === 4, '主号只列有库存且已通过核验的四种花');
    assert([...group('account-a').querySelectorAll('.pt-price strong')].map(n => n.textContent).join(',') === '80,60,20,10', '每个账号按每组出价数值降序排列');
    assert(row('account-a', '1:5').dataset.request === '2', '最高报价被该账号阻止时，选择下一张能成交的报价');
    assert(row('account-b', '1:5').dataset.request === '1' && group('account-b').querySelectorAll('li').length === 1, '另一账号保留最高报价，相同花品质只列一次');
    assert(row('account-a', '1:5').textContent.includes('可卖 3 组'), '可卖组数受买家剩余需求限制');
    assert(row('account-a', '3:1').textContent.includes('可卖 2 组'), '可卖组数受服务器可售组数限制');
    assert(row('account-b', '1:5').textContent.includes('实得 100 分钟/组'), '实得读取服务器金额，保留向下取整结果');
    assert(!row('account-b', '2:4'), '仓库快照缺失的花不当作有货');
    assert(row('account-c', '1:5')?.dataset.request === '1', '出售模块暂停时，仍展示手动报价接口明确允许的有货花朵');
    assert(fixture.calls.filter(c => c.path.includes('/listings?')).length === 4
      && !fixture.calls.some(c => c.path.includes('sellable-stock')), '按账号读取原始库存，不用受自动出售开关影响的库存接口');
    assert(group('account-d').querySelectorAll('li').length === 1 && !row('account-a', '3:1').textContent.includes('25分钟'), '按渠道分别读取，不混入其他渠道报价');
    assert(results.textContent.includes('<img src=x') && !results.querySelector('img'), '账号与花名用纯文本渲染，不能注入 HTML');
    const ids = fixture.calls.filter(c => c.path.includes('sell-quote')).map(c => Number(c.path.match(/requests\/(\d+)/)[1]));
    assert(ids.join(',') === '1,2,3,4,5,21', '排除无库存、自有、过期、排队已满、游戏中、已满足、暂停及非法求购；重复单不重复读取');
    assert(status.textContent.includes('跳过 1 张较低报价'), '各有货账号都已有更高报价后，跳过同花更低价求购');
    const quoteTimes = fixture.calls.filter(c => c.path.includes('sell-quote')).map(c => c.at);
    assert(quoteTimes.slice(1).every((at, i) => at - quoteTimes[i] >= 700), '实际报价请求之间至少约800ms，避免瞬间连续读取');
    assert(row('account-a', '1:5').querySelector('.pt-action').textContent === '接单'
      && row('account-b', '1:5').querySelector('.pt-action').textContent === '卖给他', '按求购类型显示接单或卖给他按钮');
    assert(fixture.calls.every(c => c.method === 'GET'), '所有数据读取仅用 GET');
    assert(!document.querySelector('dialog'), '悬浮窗不使用原生 dialog');
    const bottom = launcher.getBoundingClientRect();
    const nav = document.querySelector('.bottom-tabs').getBoundingClientRect();
    assert(bottom.bottom <= nav.top - 11, '悬浮入口避开底部导航并留出12px间距');
    assert(launcher.getBoundingClientRect().height >= 44 && [...panel.querySelectorAll('button')].every(b => b.getBoundingClientRect().height >= 44), '所有操作按钮触控高度至少44px');
    assert(panel.getBoundingClientRect().left >= 0 && panel.getBoundingClientRect().right <= innerWidth
      && document.documentElement.scrollWidth <= innerWidth, '悬浮窗完整落在视口内，页面无横向溢出');
    const lightBackground = getComputedStyle(panel).backgroundColor;
    document.documentElement.dataset.theme = 'dark';
    assert(getComputedStyle(panel).backgroundColor !== lightBackground, '深色主题跟随页面切换');
    document.documentElement.removeAttribute('data-theme');
    await refresh('normal', false);
    assert(fixture.calls.length === 1 && fixture.calls[0].path === '/api/trade/meta'
      && results.querySelectorAll('li').length === 7 && status.textContent.includes('缓存'), '30秒内复用求购库存及报价缓存，交易权限仍每次读取');
    await refresh('empty');
    assert(!results.querySelector('li') && status.textContent.includes('0 项可交易'), '无库存时显示空结果');
    assert(fixture.calls.some(c => c.path.includes('/listings?')), '缓存过期后重新读取仓库，不继续使用旧数据');
    assert(!fixture.calls.some(c => c.path.includes('sell-quote')), '无可卖库存时不逐张请求核验');
    await refresh('paused');
    assert(results.querySelectorAll('li').length === 7, '全部账号自动出售暂停、库存未启用出售时，仍按手动报价显示可卖花朵');
    await refresh('user-paused');
    assert(!results.querySelector('li') && fixture.calls.length === 1 && results.textContent.includes('全部账号交易已暂停'), '用户级交易暂停仍阻止手动交易');
    await refresh('garden-paused');
    assert(!group('account-b').querySelector('li') && row('account-c', '1:5')
      && !fixture.calls.some(c => c.path.includes('gardenId=account-b')), '本号交易暂停只排除对应账号，其他账号继续核验');
    await refresh('team');
    assert(results.textContent.includes('团单时段') && !results.querySelector('li'), '团单暂停时段不列立即可交易花');
    await refresh('quote-paused');
    assert(row('account-b', '1:5').dataset.request === '2', '服务器核验暂停后使用下一张有效报价');
    await refresh('seller-blocked');
    assert(!group('account-c').querySelector('li') && row('account-b', '1:5'), '自动出售暂停账号若被手动报价接口阻止，仍不列为可交易');
    await refresh('quote-empty');
    assert(!row('account-a', '1:5'), '核验时买家需求归零后不列该报价');
    await refresh('gone');
    assert(!row('account-a', '2:4') && status.textContent.includes('已变动'), '求购变动409时跳过并给出提示');
    await refresh('truncated');
    assert(status.dataset.error === 'true' && status.textContent.includes('不完整'), '接口截断时明确说明结果覆盖范围');
    await refresh('limited');
    assert(status.textContent.includes('过于频繁') && status.textContent.includes('部分核验结果'), '429停止读取，并把保留结果标为不完整');
    assert(fixture.calls.filter(c => c.path.includes('sell-quote')).length === 3, '429后不继续请求剩余求购');
    const callsBeforeCooldown = fixture.calls.length;
    panel.querySelector('[data-trade="refresh"]').click();
    await tick();
    assert(fixture.calls.length === callsBeforeCooldown && document.querySelector('#ppg-trade-notice').textContent.includes('等待'), '遵守Retry-After冷却时间，重复刷新不再请求接口');
    await refresh('denied');
    assert(status.textContent.includes('权限') && !results.querySelector('li'), '登录失效提示，不保留上次可交易清单');
    await refresh('malformed');
    assert(status.textContent.includes('格式已变化'), '响应字段变化时明确报错');
    await refresh('invalid-stock');
    assert(status.textContent.includes('库存或求购数据格式已变化') && !results.querySelector('li'), '库存账号与请求不匹配时停止使用数据');
    await refresh('invalid-quote');
    assert(status.textContent.includes('核验数据格式已变化') && !results.querySelector('li'), '报价请求ID不匹配时停止使用数据');
    fixture.scenario = 'normal';
    fixture.delay = 200;
    panel.querySelector('[data-trade="refresh"]').click();
    panel.querySelector('[data-trade="close"]').click();
    await tick();
    assert(panel.hidden && fixture.aborted > 0 && document.activeElement === launcher, '关闭时取消请求并恢复入口焦点');
    fixture.delay = 0;
    launcher.click();
    await wait();
    assert(results.querySelector('li') && !panel.hidden, '重新打开会重新读取结果');
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert(panel.hidden && launcher.getAttribute('aria-expanded') === 'false', 'Esc收起悬浮窗并同步入口状态');
    const page = document.querySelector('.trd-page');
    page.classList.remove('trd-page');
    page.append(document.createElement('span'));
    await tick();
    assert(launcher.hidden, '切到其他页面时隐藏交易入口');
    page.classList.add('trd-page');
    page.lastChild.remove();
    await tick();
    assert(!launcher.hidden, '单页应用切回交易页恢复入口');
    const overlay = document.querySelector('.garden-account-overlay');
    overlay.dataset.open = 'true';
    await tick();
    assert(launcher.hidden, '原站账号菜单打开时隐藏入口，避免遮挡');
    overlay.dataset.open = 'false';
    await tick();
    assert(!launcher.hidden, '账号菜单关闭后恢复入口');
    const oldNav = document.querySelector('.bottom-tabs');
    const newNav = oldNav.cloneNode(true);
    newNav.style.height = '96px';
    oldNav.replaceWith(newNav);
    await tick();
    assert(launcher.getBoundingClientRect().bottom <= newNav.getBoundingClientRect().top - 11, '底部导航替换和增高后重新避让');
    newNav.replaceWith(oldNav);
    await tick();
    launcher.click();
    await wait();
    const priceFilter = document.querySelector('select[aria-label="价格筛选"]');
    priceFilter.value = 'le10';
    priceFilter.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector('[role="switch"]').click();
    fixture.opened.length = 0;
    row('account-a', '1:5').querySelector('.pt-locate').click();
    await until(() => document.querySelector('#ppg-trade-notice').textContent.includes('已定位'));
    assert(panel.hidden && priceFilter.value === 'all' && document.querySelector('[role="switch"]').getAttribute('aria-checked') === 'false', '定位时收起悬浮窗并清除会隐藏目标的筛选');
    assert(fixture.opened.join(',') === '999,2' && !document.querySelector('.trd-sheet__panel')
      && document.querySelector('[data-fixture-request="2"]').classList.contains('ppg-trade-target'), '同花同价时逐一核对原站求购编号，只高亮正确卡片');
    launcher.click();
    await wait();
    row('account-a', '1:5').querySelector('.pt-action').click();
    await until(() => document.querySelector('.trd-sheet__panel select')?.value === 'account-a');
    assert(document.querySelector('.trd-sheet__panel').getAttribute('aria-labelledby') === 'trd-req-detail-2'
      && fixture.selected.at(-1) === 'account-a', '快捷接单打开准确的原站求购详情并预选当前行所属账号');
    assert(fixture.submitted === 0 && fixture.calls.every(c => c.method === 'GET'), '快捷按钮只打开网站确认，不提交成交请求');
    document.querySelector('.trd-sheet__panel [aria-label="关闭"]').click();
    launcher.click();
    await wait();
    row('account-d', '3:1').querySelector('.pt-action').click();
    await until(() => document.querySelector('.trd-sheet__panel select')?.value === 'account-d');
    assert(fixture.activeAccount === 'account-d'
      && document.querySelector('.trd-sheet__panel').getAttribute('aria-labelledby') === 'trd-req-detail-21', '跨渠道入口先切换正确账号，再打开对应求购');
    document.querySelector('.trd-sheet__panel [aria-label="关闭"]').click();
    launcher.click();
    await wait();
    fixture.hideTarget = true;
    row('account-a', '1:5').querySelector('.pt-action').click();
    await until(() => document.querySelector('#ppg-trade-notice').textContent.includes('未找到对应求购编号'));
    assert(!document.querySelector('.trd-sheet__panel') && fixture.submitted === 0, '编号已经消失时不把相似求购当成目标，不触发成交');
    fixture.hideTarget = false;
    output.textContent = `PASS ${passed.length}\n${passed.join('\n')}`;
  } catch (error) {
    output.textContent = `FAIL after ${passed.length}: ${error.message}`;
    console.error('[花朵交易自检]', error);
  }
})();
