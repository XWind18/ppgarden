// 只在 tests/fixtures/flower-trade.html 的模拟接口环境执行。
(async () => {
  const output = document.querySelector('#trade-check-result');
  const fixture = window.tradeFixture;
  const panel = document.querySelector('#ppg-trade-panel');
  const launcher = document.querySelector('#ppg-trade-open');
  const results = panel.querySelector('#ppg-trade-results');
  const status = panel.querySelector('#ppg-trade-status');
  const autoRefresh = panel.querySelector('[data-trade="auto-refresh"]');
  const refreshMinutes = panel.querySelector('[data-trade="refresh-minutes"]');
  const dailyStatus = panel.querySelector('#ppg-trade-daily-status');
  const stockRefresh = panel.querySelector('[data-trade="stock-refresh"]');
  const inventory = () => new Map(JSON.parse(localStorage.getItem('ppg-trade-stock-cache-v1')) || []);
  const resumePoint = () => JSON.parse(localStorage.getItem('ppg-trade-checkpoint-v1'));
  const dailyPauses = () => JSON.parse(localStorage.getItem('ppg-trade-daily-pause-v1'))?.accounts || [];
  const nativeSetTimeout = window.setTimeout.bind(window);
  const nativeClearTimeout = window.clearTimeout.bind(window);
  const nativeRandom = Math.random;
  let randomIndex = 0;
  Math.random = () => [0, .5, .999999][randomIndex++ % 3];
  const timers = new Map();
  window.setTimeout = (callback, delay = 0, ...args) => {
    const id = nativeSetTimeout(() => { timers.delete(id); callback(...args); }, delay);
    timers.set(id, { at: Date.now() + Number(delay), delay: Number(delay), run: () => callback(...args) });
    return id;
  };
  window.clearTimeout = id => { timers.delete(id); nativeClearTimeout(id); };
  const flushTimers = () => {
    for (const [id, timer] of [...timers]) if (timer.at <= Date.now()) {
      window.clearTimeout(id);
      timer.run();
    }
  };
  let pageHidden = false;
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => pageHidden });
  const passed = [];
  const assert = (condition, text) => {
    if (!condition) throw new Error(text);
    passed.push(text);
  };
  // 用模拟时间推进短等待；自动刷新周期仍由各用例显式推进。
  const tick = async () => {
    const next = Math.min(...[...timers.values()].filter(timer => timer.delay <= 3000).map(timer => timer.at));
    if (next <= Date.now() + 3000) {
      fixture.advance(Math.max(0, next - Date.now()));
      flushTimers();
    }
    await new Promise(resolve => nativeSetTimeout(resolve, 40));
  };
  const wait = async () => {
    for (let i = 0; i < 200 && results.getAttribute('aria-busy') === 'true'; i++) await tick();
    assert(results.getAttribute('aria-busy') === 'false', '读取结束后退出忙碌状态');
  };
  const refresh = async (scenario, expire = true) => {
    if (expire) fixture.advance(61000);
    fixture.scenario = scenario;
    fixture.calls.length = 0;
    stockRefresh.click();
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
    assert(autoRefresh.getAttribute('aria-checked') === 'false' && autoRefresh.textContent.includes('关闭'), '首次安装默认关闭自动刷新，并明确显示开关状态');
    fixture.delay = 80;
    launcher.focus();
    launcher.click();
    assert(!panel.hidden && launcher.getAttribute('aria-expanded') === 'true', '点击入口打开悬浮窗');
    assert(document.activeElement === panel.querySelector('[data-trade="close"]'), '打开时聚焦关闭按钮，不弹出手机键盘');
    await until(() => results.querySelector('li'));
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
    assert([...group('account-a').querySelectorAll('.pt-price small')].map(n => n.textContent.match(/^出价 (\d+)/)[1]).join(',') === '80,60,20,10', '每个账号按每组出价数值降序排列');
    assert(row('account-a', '1:5').querySelector('.pt-price strong').textContent === '56'
      && row('account-a', '1:5').querySelector('.pt-net-label').textContent === '实得'
      && row('account-a', '1:5').querySelector('.pt-price small').textContent === '出价 80 分钟/组', '实得以主数值大字显示，原出价作为次要参考');
    assert(row('account-a', '1:5').dataset.request === '2', '最高报价被该账号阻止时，选择下一张能成交的报价');
    assert(row('account-b', '1:5').dataset.request === '1' && group('account-b').querySelectorAll('li').length === 1, '另一账号保留最高报价，相同花品质只列一次');
    assert(row('account-a', '1:5').textContent.includes('可卖 3 组'), '可卖组数受买家剩余需求限制');
    assert(row('account-a', '3:1').textContent.includes('可卖 2 组'), '可卖组数受服务器可售组数限制');
    assert(row('account-b', '1:5').querySelector('.pt-price strong').textContent === '100', '实得读取服务器金额，保留向下取整结果');
    assert(!row('account-b', '2:4'), '仓库快照缺失的花不当作有货');
    assert(row('account-c', '1:5')?.dataset.request === '1', '出售模块暂停时，仍展示手动报价接口明确允许的有货花朵');
    assert(fixture.calls.filter(c => c.path.includes('/listings?')).length === 4
      && !fixture.calls.some(c => c.path.includes('sellable-stock')), '按账号读取原始库存，不用受自动出售开关影响的库存接口');
    assert(group('account-d').querySelectorAll('li').length === 1 && !row('account-a', '3:1').textContent.includes('25分钟'), '按渠道分别读取，不混入其他渠道报价');
    assert(results.textContent.includes('<img src=x') && !results.querySelector('img'), '账号与花名用纯文本渲染，不能注入 HTML');
    const ids = fixture.calls.filter(c => c.path.includes('sell-quote')).map(c => Number(c.path.match(/requests\/(\d+)/)[1]));
    assert(ids.join(',') === '1,2,3,4,5,21', '排除无库存、自有、过期、排队已满、游戏中、已满足、暂停及非法求购；重复单不重复读取');
    assert(status.textContent.includes('跳过 1 张较低报价'), '各有货账号都已有更高报价后，跳过同花更低价求购');
    const gaps = fixture.calls.slice(1).map((call, i) => call.clockAt - fixture.calls[i].finishedAt);
    assert(gaps.every(gap => gap >= 2000), '账号、求购大厅、各账号库存及报价全部在上一次响应结束至少2秒后读取，无并发请求');
    assert(gaps.every((gap, i) => gap >= [2000, 2500, 3000][i % 3] && gap < [2000, 2500, 3000][i % 3] + 250), '每次独立生成0至1秒随机附加延迟，验证随机最小、中间及最大边界');
    assert(panel.querySelector('.pt-pacing').textContent.includes('2～3 秒'), '悬浮窗明确显示请求间隔与随机延迟');
    fixture.delay = 0;
    assert(row('account-a', '1:5').querySelector('.pt-action').textContent === '接单'
      && row('account-b', '1:5').querySelector('.pt-action').textContent === '卖给他', '按求购类型显示接单或卖给他按钮');
    assert(fixture.calls.every(c => c.method === 'GET'), '所有数据读取仅用 GET');
    assert(!document.querySelector('dialog'), '悬浮窗不使用原生 dialog');
    const bottom = launcher.getBoundingClientRect();
    const nav = document.querySelector('.bottom-tabs').getBoundingClientRect();
    assert(bottom.bottom <= nav.top - 11, '悬浮入口避开底部导航并留出12px间距');
    assert(launcher.getBoundingClientRect().height >= 44 && [...panel.querySelectorAll('button:not([hidden])')].every(b => b.getBoundingClientRect().height >= 44), '所有可见操作按钮触控高度至少44px');
    assert(panel.getBoundingClientRect().left >= 0 && panel.getBoundingClientRect().right <= innerWidth
      && document.documentElement.scrollWidth <= innerWidth, '悬浮窗完整落在视口内，页面无横向溢出');
    const lightBackground = getComputedStyle(panel).backgroundColor;
    document.documentElement.dataset.theme = 'dark';
    assert(getComputedStyle(panel).backgroundColor !== lightBackground, '深色主题跟随页面切换');
    document.documentElement.removeAttribute('data-theme');
    autoRefresh.click();
    assert(autoRefresh.getAttribute('aria-checked') === 'true' && autoRefresh.textContent.includes('10分钟'), '用户可手动开启每10分钟自动刷新');
    fixture.calls.length = 0;
    panel.querySelector('[data-trade="close"]').click();
    launcher.click();
    await tick();
    assert(fixture.calls.length === 0 && results.querySelectorAll('li').length === 7, '10分钟内重新打开窗口保留完整列表，不重新查询');
    fixture.advance(9 * 60000);
    flushTimers();
    await tick();
    assert(fixture.calls.length === 0, '未满10分钟不提前自动刷新');
    fixture.advance(60000);
    flushTimers();
    document.dispatchEvent(new Event('visibilitychange'));
    document.dispatchEvent(new Event('visibilitychange'));
    await wait();
    assert(fixture.calls.filter(c => c.path === '/api/trade/meta').length === 1
      && fixture.calls.some(c => c.path.includes('sell-quote')), '满10分钟自动读取新数据，重复唤醒不会并发查询');
    const previousRequest = fixture.calls.at(-1);
    await refresh('normal', false);
    assert(fixture.calls.filter(c => c.path === '/api/trade/meta').length === 1
      && fixture.calls.some(c => c.path.includes('/listings?')) && fixture.calls.some(c => c.path.includes('sell-quote')), '更新仓库重新读取账号、库存及报价，不复用旧接口数据');
    assert(fixture.calls[0].clockAt - previousRequest.finishedAt >= 2000
      && fixture.calls.slice(1).every((call, i) => call.clockAt - fixture.calls[i].finishedAt >= 2000), '立即手动刷新仍遵守跨轮与轮内统一请求间隔');
    autoRefresh.click();
    assert(autoRefresh.getAttribute('aria-checked') === 'false' && autoRefresh.textContent.includes('关闭')
      && localStorage.getItem('ppg-trade-auto-refresh-v1') === 'false', '关闭自动刷新有清晰提示，且保存开关设置');
    fixture.calls.length = 0;
    fixture.advance(610000);
    flushTimers();
    await tick();
    panel.querySelector('[data-trade="close"]').click();
    launcher.click();
    await tick();
    assert(fixture.calls.length === 0, '关闭开关后，满10分钟及重新打开均不自动查询');
    autoRefresh.click();
    await wait();
    assert(autoRefresh.getAttribute('aria-checked') === 'true'
      && localStorage.getItem('ppg-trade-auto-refresh-v1') === 'true'
      && fixture.calls.filter(c => c.path === '/api/trade/meta').length === 1, '重新开启自动刷新会更新过期列表，并保存开启状态');
    pageHidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    fixture.calls.length = 0;
    fixture.advance(610000);
    flushTimers();
    await tick();
    assert(fixture.calls.length === 0, '页面在后台时暂停自动查询');
    pageHidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    await wait();
    assert(fixture.calls.filter(c => c.path === '/api/trade/meta').length === 1, '回到前台时只补一次已到期刷新');
    await refresh('empty');
    assert(!results.querySelector('li') && status.textContent.includes('0 项可交易'), '无库存时显示空结果');
    assert(fixture.calls.some(c => c.path.includes('/listings?')), '更新仓库重新读取库存，不继续使用旧数据');
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
    const savedLimited = resumePoint();
    assert(savedLimited?.responses.some(([path]) => path.endsWith('/1/sell-quote'))
      && savedLimited.retryAt > Date.now() && savedLimited.nextRequestAt > 0
      && panel.querySelector('[data-trade="refresh"]').textContent === '继续读取', '429保留已完成步骤、冷却和请求间隔，提供继续读取入口');
    fixture.advance(61000);
    fixture.scenario = 'normal';
    fixture.calls.length = 0;
    panel.querySelector('[data-trade="refresh"]').click();
    await wait();
    assert(fixture.calls.filter(c => c.path.includes('sell-quote')).map(c => c.path.match(/requests\/(\d+)/)[1]).join(',') === '3,4,5,21'
      && !fixture.calls.some(c => c.path.includes('gardenId=account-a') || c.path.includes('gardenId=account-b') || c.path.includes('gardenId=account-c')), '429冷却结束后从失败求购继续，不重复读取已完成库存及报价');
    assert(fixture.calls.filter(c => c.path === '/api/trade/meta').length === 1 && !resumePoint()
      && panel.querySelector('[data-trade="restart"]').hidden && results.querySelectorAll('li').length === 7, '续拉重新核对账号权限，完成后清除断点并恢复完整列表');
    assert(status.textContent.includes(`${new Date(savedLimited.startedAt).toLocaleTimeString('zh-CN', { hour12: false })} 开始`),
      '续拉完成后仍显示本轮最初开始时间，避免把缓存数据标为刚刚读取');
    await refresh('denied');
    assert(status.textContent.includes('权限') && !results.querySelector('li'), '登录失效提示，不保留上次可交易清单');
    await refresh('malformed');
    assert(status.textContent.includes('格式已变化'), '响应字段变化时明确报错');
    await refresh('invalid-stock');
    assert(status.textContent.includes('库存或求购数据格式已变化') && !results.querySelector('li'), '库存账号与请求不匹配时停止使用数据');
    await refresh('invalid-quote');
    assert(status.textContent.includes('核验数据格式已变化') && !results.querySelector('li'), '报价请求ID不匹配时停止使用数据');
    await refresh('normal');
    fixture.calls.length = 0;
    panel.querySelector('[data-trade="refresh"]').click();
    panel.querySelector('[data-trade="close"]').click();
    await tick();
    fixture.advance(4000);
    flushTimers();
    await tick();
    assert(fixture.calls.length === 0 && panel.hidden, '等待请求间隔时关闭窗口，取消等待且不发出后续请求');
    launcher.click();
    await wait();
    assert(fixture.calls.filter(c => c.path === '/api/trade/meta').length === 1 && results.querySelectorAll('li').length === 7,
      '重新打开从断点继续，不混入已取消的旧轮请求');
    fixture.delay = 200;
    fixture.calls.length = 0;
    panel.querySelector('[data-trade="refresh"]').click();
    await until(() => fixture.calls.some(c => c.path.endsWith('/2/sell-quote')));
    panel.querySelector('[data-trade="close"]').click();
    await tick();
    assert(panel.hidden && fixture.aborted > 0 && document.activeElement === launcher, '关闭时取消请求并恢复入口焦点');
    fixture.delay = 0;
    fixture.calls.length = 0;
    launcher.click();
    await wait();
    assert(results.querySelectorAll('li').length === 7 && !panel.hidden
      && fixture.calls.some(c => c.path.endsWith('/2/sell-quote')) && !fixture.calls.some(c => c.path.endsWith('/1/sell-quote') || c.path.includes('gardenId=account-a')),
      '请求中断后重新打开只重试未完成求购，不重复已经完成的库存和报价');
    fixture.calls.length = 0;
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
    launcher.click();
    await tick();
    assert(fixture.calls.length === 0 && results.querySelector('li'), '切换页面再回来保留列表，不触发整轮重新加载');
    panel.querySelector('[data-trade="close"]').click();
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
    launcher.click();
    await refresh('limit-partial');
    assert(!group('account-a').querySelector('li') && group('account-a').textContent.includes('今日交易次数已达上限')
      && group('account-b').querySelector('li') && dailyStatus.textContent.includes('1/4'), '每账号独立计算20次上限，仅暂停达到上限的账号');
    fixture.calls.length = 0;
    fixture.advance(610000);
    flushTimers();
    await wait();
    assert(!fixture.calls.some(c => c.path.includes('gardenId=account-a'))
      && fixture.calls.some(c => c.path.includes('sell-quote')) && group('account-b').querySelector('li')
      && !group('account-a').querySelector('li'), '后续自动刷新跳过已耗尽账号，其他账号复用库存并继续核验报价');
    await refresh('normal', false);
    assert(fixture.calls.some(c => c.path.includes('gardenId=account-a')) && row('account-a', '1:5')
      && dailyStatus.hidden && dailyPauses().length === 0, '手动刷新可重新核验停刷账号，明确恢复额度后解除当天暂停');
    await refresh('quota-partial');
    assert(!group('account-a').querySelector('li') && group('account-a').textContent.includes('无剩余上架次数')
      && group('account-b').querySelector('li') && dailyPauses().length === 1, '剩余上架次数为零时，只停止该账号当天自动刷新并保存');
    await refresh('normal');
    await refresh('quota-unknown');
    assert(dailyStatus.hidden && dailyPauses().length === 0 && results.querySelector('li'), '未知上架次数及非数值交易次数不能当作耗尽');
    await refresh('quota-committed');
    assert(dailyStatus.hidden && results.querySelector('li'), '额度被在途订单占用、暂时没有空货架，不当作当天次数耗尽');
    await refresh('quota-old');
    assert(dailyStatus.hidden && results.querySelector('li'), '前一天的游戏上架次数不能暂停当天自动刷新');
    await refresh('quota-not-confirmed');
    assert(dailyStatus.hidden && dailyPauses().length === 0, '无上架次数数据和待刷新提示不能当作次数已用完');
    await refresh('quota-short');
    assert(dailyStatus.hidden && dailyPauses().length === 0, '不够本单组数不能当作当天剩余次数为零');
    await refresh('empty');
    assert(dailyStatus.hidden && dailyPauses().length === 0, '暂无可交易花朵不能当作账号额度耗尽');
    await refresh('quota-text');
    assert(dailyPauses().length === 4 && dailyStatus.textContent.includes('4/4') && !results.querySelector('li'), '报价明确提示无上架次数时，分别保存每个账号的当天停刷状态');
    await refresh('normal');
    await refresh('mixed-exhausted');
    assert(dailyPauses().filter(([, reason]) => reason === 'limit').length === 2
      && dailyPauses().filter(([, reason]) => reason === 'quota').length === 2
      && !fixture.calls.some(c => c.path.includes('sell-quote')), '不同账号分别因20次上限或上架次数归零停刷，不再请求无效报价');
    fixture.calls.length = 0;
    fixture.advance(610000);
    flushTimers();
    await tick();
    panel.querySelector('[data-trade="close"]').click();
    launcher.click();
    await tick();
    assert(fixture.calls.length === 0 && dailyStatus.textContent.includes('4/4'), '全部账号都耗尽后，当天不再自动查询，重开窗口也不查询');
    const savedDay = JSON.parse(localStorage.getItem('ppg-trade-daily-pause-v1'));
    assert(savedDay.day === Math.floor((Date.now() + 8 * 3600000) / 86400000)
      && new Map(savedDay.accounts).get('account-a') === 'limit'
      && new Map(savedDay.accounts).get('account-b') === 'quota', '当天停刷状态按北京时间日期及账号分别持久保存');
    await refresh('mixed-exhausted', false);
    assert(fixture.calls.some(c => c.path.includes('/listings?')), '全部停刷时仍能手动重新核验各账号');
    fixture.scenario = 'normal';
    fixture.calls.length = 0;
    const untilTomorrow = () => 86400000 - (Date.now() + 8 * 3600000) % 86400000 + 1000;
    fixture.advance(untilTomorrow());
    flushTimers();
    await wait();
    assert(fixture.calls.filter(c => c.path === '/api/trade/meta').length === 1
      && fixture.calls.filter(c => c.path.includes('/listings?')).length === 4
      && dailyStatus.hidden && dailyPauses().length === 0, '北京时间次日零点解除各账号暂停，自动刷新开启时只恢复一轮核验');
    await refresh('mixed-exhausted');
    autoRefresh.click();
    fixture.calls.length = 0;
    fixture.advance(untilTomorrow());
    flushTimers();
    document.dispatchEvent(new Event('visibilitychange'));
    await tick();
    assert(fixture.calls.length === 0 && dailyPauses().length === 0
      && autoRefresh.getAttribute('aria-checked') === 'false'
      && localStorage.getItem('ppg-trade-auto-refresh-v1') === 'false', '次日清除当天停刷状态，但尊重用户手动关闭，不擅自开启自动刷新');
    const setMinutes = minutes => {
      refreshMinutes.value = String(minutes);
      refreshMinutes.dispatchEvent(new Event('change', { bubbles: true }));
    };
    assert(refreshMinutes.value === '10' && refreshMinutes.min === '3', '默认刷新间隔10分钟，明确标记最小3分钟');
    setMinutes(2);
    assert(refreshMinutes.value === '10' && document.querySelector('#ppg-trade-notice').textContent.includes('不小于3'), '低于3分钟时拒绝并恢复上一个有效间隔');
    setMinutes(3.5);
    assert(refreshMinutes.value === '10', '拒绝小数和无效间隔');
    setMinutes(3);
    assert(localStorage.getItem('ppg-trade-refresh-minutes-v1') === '3' && autoRefresh.getAttribute('aria-checked') === 'false', '3分钟间隔保存生效，修改间隔不擅自开启自动刷新');
    fixture.scenario = 'normal';
    fixture.calls.length = 0;
    autoRefresh.click();
    assert(autoRefresh.textContent.includes('每3分钟'), '开关显示当前自定义刷新间隔');
    fixture.advance(179000);
    flushTimers();
    await tick();
    assert(fixture.calls.length === 0, '自定义3分钟间隔尚未到期时不自动读取');
    fixture.advance(2000);
    flushTimers();
    await wait();
    assert(fixture.calls.filter(c => c.path === '/api/trade/meta').length === 1, '达到自定义3分钟间隔时仅刷新一轮');
    autoRefresh.click();
    const minPrice = panel.querySelector('[data-trade="min-price"]');
    const maxPrice = panel.querySelector('[data-trade="max-price"]');
    const setPriceRange = (min, max) => {
      minPrice.value = min ?? '';
      maxPrice.value = max ?? '';
      minPrice.dispatchEvent(new Event('change', { bubbles: true }));
    };
    assert(minPrice.value === '' && maxPrice.value === '', '读取保存的不限价格范围，单位明确为求购出价分钟/组');
    setPriceRange(0, 80);
    assert(minPrice.value === '' && maxPrice.value === '', '拒绝零或负数出价');
    setPriceRange(80, 60);
    assert(minPrice.value === '' && maxPrice.value === '', '拒绝最低价高于最高价');
    setPriceRange(60.5, 80);
    assert(minPrice.value === '' && maxPrice.value === '', '拒绝非整数出价');
    setPriceRange(60, 80);
    assert(localStorage.getItem('ppg-trade-price-range-v1') === '[60,80]' && !results.querySelector('li')
      && autoRefresh.getAttribute('aria-checked') === 'false', '价格范围自动保存，清除旧范围结果，不擅自开启自动刷新');
    await refresh('normal');
    const quoteIds = () => fixture.calls.filter(c => c.path.includes('sell-quote')).map(c => Number(c.path.match(/requests\/(\d+)/)[1])).join(',');
    assert(quoteIds() === '2,3' && status.textContent.includes('出价 60～80'), '在逐单请求前按出价范围过滤，包含上下边界，仅读取60至80报价');
    setPriceRange(100, null);
    await refresh('normal');
    assert(quoteIds() === '1', '只设最低价时排除所有较低报价');
    fixture.calls.length = 0;
    panel.querySelector('[data-trade="refresh"]').click();
    setPriceRange(null, 25);
    await wait();
    assert(fixture.calls.length === 0 && !resumePoint()?.responses && !results.querySelector('li'), '读取等待中修改价格范围会取消旧请求和旧断点，不混入旧范围结果');
    await refresh('normal');
    assert(quoteIds() === '4,5,21', '只设最高价时兼容多渠道，范围外不发报价请求');
    setPriceRange(null, null);
    await refresh('limited');
    fixture.advance(61000);
    fixture.scenario = 'normal';
    fixture.calls.length = 0;
    panel.querySelector('[data-trade="restart"]').click();
    await wait();
    assert(fixture.calls.filter(c => c.path.includes('/listings?')).length === 4 && quoteIds() === '1,2,3,4,5,21', '用户可主动重新查询，放弃断点并重新核对全部库存与报价');
    await refresh('limited');
    setPriceRange(60, 80);
    assert(!resumePoint()?.responses && panel.querySelector('[data-trade="restart"]').hidden, '修改价格范围会取消旧断点，保留服务器要求的冷却');
    await refresh('normal');
    assert(quoteIds() === '2,3', '修改范围后只读取新范围，不混用旧断点');
    setPriceRange(null, null);
    await refresh('limited');
    fixture.advance(61000);
    fixture.meta.limits.groupSize = 30;
    fixture.scenario = 'normal';
    fixture.calls.length = 0;
    panel.querySelector('[data-trade="refresh"]').click();
    await wait();
    assert(fixture.calls.filter(c => c.path.includes('/listings?')).length === 4 && quoteIds().includes('1')
      && document.querySelector('#ppg-trade-notice').textContent.includes('交易规则已变化'), '续拉检测到账号或交易规则变化时，丢弃旧步骤并完整重新核对');
    fixture.meta.limits.groupSize = 25;
    await refresh('limited');
    fixture.advance(31 * 60000);
    fixture.scenario = 'normal';
    fixture.calls.length = 0;
    panel.querySelector('[data-trade="refresh"]').click();
    await wait();
    assert(fixture.calls.filter(c => c.path.includes('/listings?')).length === 4 && quoteIds() === '1,2,3,4,5,21'
      && !resumePoint(), '断点超过30分钟后自动重新读取，不沿用过期库存或报价');
    assert(inventory().size === 4 && [...inventory()].every(([id, entry]) => entry.stock.gardenId === id
      && Number.isFinite(entry.readAt) && entry.stock.items.length > 0), '按账号持久保存完整库存及原始读取时间，包含独立渠道');
    const readTimes = [...inventory()].map(([id, entry]) => [id, entry.readAt]);
    const refreshCached = async () => {
      fixture.calls.length = 0;
      panel.querySelector('[data-trade="refresh"]').click();
      await wait();
    };
    fixture.advance(60000);
    await refreshCached();
    assert(!fixture.calls.some(c => c.path.includes('/listings?'))
      && fixture.calls.filter(c => c.path === '/api/trade/meta').length === 1 && quoteIds() === '1,2,3,4,5,21',
      '30分钟内刷新列表复用所有账号仓库，但重新检查账号、求购及逐单报价');
    assert(JSON.stringify([...inventory()].map(([id, entry]) => [id, entry.readAt])) === JSON.stringify(readTimes)
      && [...results.querySelectorAll('.pt-cache')].every(node => node.textContent.includes('仓库缓存') && node.textContent.includes('原站同步')),
      '复用缓存不重置读取时间，按账号分别显示读取时间和原站同步时间');
    const previousCount = fixture.quotes[2].sellers[0].haveCount;
    fixture.quotes[2].sellers[0].haveCount = 30;
    await refreshCached();
    assert(row('account-a', '1:5').textContent.includes('库存 30 朵') && row('account-a', '1:5').textContent.includes('可卖 1 组'),
      '缓存库存仅筛选候选，展示数量和可卖组数始终使用本轮报价核验');
    fixture.quotes[2].sellers[0].haveCount = previousCount;
    fixture.advance(31 * 60000);
    await refreshCached();
    assert(fixture.calls.filter(c => c.path.includes('/listings?')).length === 4
      && [...inventory()].every(([id, entry]) => entry.readAt > new Map(readTimes).get(id)), '缓存过期后分别重新读取各账号，不回退使用过期库存');
    await refresh('stock-old-sync');
    const oldSync = inventory().get('account-a').stock.gameReadAt;
    assert(group('account-a').querySelector('.pt-cache').dataset.stale === 'true'
      && group('account-a').querySelector('.pt-cache').textContent.includes(new Date(oldSync).toLocaleString('zh-CN', { hour12: false })),
      '两天前的游戏同步时间原样保留，明确提示数据较早，不冒充刚同步');
    await refreshCached();
    assert(!fixture.calls.some(c => c.path.includes('/listings?')) && inventory().get('account-a').stock.gameReadAt === oldSync,
      '刚读取过的旧游戏快照可减少重复接口读取，同时始终保留原始同步时间');
    await refresh('stock-sync-unknown');
    assert([...results.querySelectorAll('.pt-cache')].every(node => node.dataset.stale === 'true' && node.textContent.includes('原站同步 时间未知')),
      '原站缺少同步时间时明确显示未知，不使用缓存读取时间代替');
    await refresh('limit-partial');
    fixture.scenario = 'normal';
    await refreshCached();
    assert(fixture.calls.filter(c => c.path.includes('/listings?')).length === 1
      && fixture.calls.some(c => c.path.includes('gardenId=account-a')) && dailyStatus.hidden && row('account-a', '1:5'),
      '手动刷新独立重读当天停刷账号以核对额度恢复，其他账号仍复用缓存');
    const accountB = fixture.meta.gardens.find(g => g.gardenId === 'account-b');
    accountB.channel = 'wechat';
    await refreshCached();
    assert(fixture.calls.filter(c => c.path.includes('/listings?')).length === 1
      && fixture.calls.some(c => c.path.includes('gardenId=account-b')) && inventory().get('account-b').stock.channel === 'wechat',
      '账号渠道变化时只重读该账号，不混用旧渠道缓存');
    accountB.channel = 'alipay';
    await refresh('normal');
    const previousGardens = fixture.meta.gardens;
    fixture.meta.gardens = previousGardens.filter(g => g.gardenId !== 'account-c');
    await refreshCached();
    assert(!inventory().has('account-c') && !group('account-c') && inventory().size === 3, '重新核对绑定账号后移除解绑账号的仓库缓存');
    fixture.meta.gardens = previousGardens;
    await refresh('normal');
    fixture.scenario = 'denied';
    await refreshCached();
    assert(inventory().size === 0 && !results.querySelector('li'), '登录或权限失效时清除本地仓库缓存，不靠缓存绕过权限检查');
    await refresh('normal');
    fixture.advance(29 * 60000);
    fixture.scenario = 'limited';
    await refreshCached();
    assert(!fixture.calls.some(c => c.path.includes('/listings?')) && resumePoint(), '有效仓库缓存可以进入断点，但保留最初读取时间');
    fixture.advance(121000);
    fixture.scenario = 'normal';
    await refreshCached();
    assert(fixture.calls.filter(c => c.path.includes('/listings?')).length === 4
      && document.querySelector('#ppg-trade-notice').textContent.includes('仓库缓存已过期'), '断点本身未过期但内部仓库缓存过期时，重新读取而不延长旧库存寿命');
    const setItem = Storage.prototype.setItem;
    try {
      Storage.prototype.setItem = function(key, value) {
        if (key === 'ppg-trade-stock-cache-v1') throw new DOMException('Storage full', 'QuotaExceededError');
        return setItem.call(this, key, value);
      };
      await refresh('normal');
      assert(document.querySelector('#ppg-trade-notice').textContent.includes('无法保存仓库缓存') && results.querySelector('li'),
        '仓库持久化失败时给出div提示，仍能完成查询');
      await refreshCached();
      assert(!fixture.calls.some(c => c.path.includes('/listings?')), '存储失败后当前页面仍可复用内存库存');
    } finally { Storage.prototype.setItem = setItem; }
    assert(autoRefresh.getAttribute('aria-checked') === 'false', '更新仓库及复用缓存不改变自动刷新开关');
    output.textContent = `PASS ${passed.length}\n${passed.join('\n')}`;
  } catch (error) {
    output.textContent = `FAIL after ${passed.length}: ${error.message}`;
    console.error('[花朵交易自检]', error);
  } finally {
    Math.random = nativeRandom;
  }
})();
