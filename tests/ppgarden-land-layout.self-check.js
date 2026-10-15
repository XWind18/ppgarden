// 在用户提供的土地页面快照、原站 CSS 和 GM 存储替身中运行；报告仅写入隐藏节点。
(async () => {
  const passed = [];
  const assert = (condition, label) => {
    if (!condition) throw new Error(label);
    passed.push(label);
  };
  const display = element => getComputedStyle(element).display;
  const panel = document.querySelector('#ppg-layout-panel');
  const quickCopy = document.querySelector('#ppg-layout-quick-copy');
  const quickStatus = document.querySelector('#ppg-layout-quick-status');
  const grid = document.querySelector('.land-field');
  const cards = [...grid.children];
  const columns = panel.querySelector('#ppg-layout-columns');
  const maxWidth = panel.querySelector('#ppg-layout-max-width');
  const minHeight = panel.querySelector('#ppg-layout-min-height');
  const state = () => panel.querySelector('#ppg-layout-land-state');
  const name = () => panel.querySelector('#ppg-layout-land-name');
  const field = key => panel.querySelector(`[data-field="${key}"]`);
  const countColumns = () => getComputedStyle(grid).gridTemplateColumns.split(' ').length;
  const visibleCards = () => cards.filter(card => display(card) !== 'none');
  const change = (element, property, value) => {
    element[property] = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const tick = () => new Promise(resolve => setTimeout(resolve, 0));
  const saved = key => JSON.parse(localStorage.getItem(key));
  const TASK_KEY = 'ppgarden-task-layout-v1';
  const LAND_KEY = 'ppgarden-land-layout-v1';

  try {
    if (new URLSearchParams(location.search).has('resume')) {
      assert(countColumns() === 6 && columns.value === '6', '刷新后保留花圃列数');
      assert(maxWidth.value === '120' && cards.every(card => card.getBoundingClientRect().width <= 120.5), '刷新后保留花圃最大宽度');
      assert(minHeight.value === '240' && visibleCards().every(card => card.getBoundingClientRect().height >= 239.5), '刷新后保留花圃最小高度');
      assert(!field('image').checked && display(cards[0].querySelector('.land-scene__flower')) === 'none', '刷新后保留隐藏花朵图片');
      assert(state().value === 'growing' && name().value === '兜兰' && visibleCards().length === 4, '刷新后保留状态与花名组合筛选');
      assert(saved(TASK_KEY).columns === 5 && saved(TASK_KEY).maxWidth === 180 && saved(TASK_KEY).minHeight === 160, '花圃刷新保留独立任务设置');
    } else {
      assert(cards.length === 64 && countColumns() === 8, '花圃默认八列64块土地');
      assert(panel.querySelector('.ppg-export').hidden, '花圃不显示导出和复制功能');
      assert(quickCopy.hidden && quickStatus.hidden, '花圃不显示右下角快捷复制按钮和状态');
      assert(document.querySelector('.land-field').previousElementSibling.matches('time.ppg-layout-clock'), '花圃卡片上方显示当前时间');
      assert(maxWidth.value === '' && minHeight.value === '' && state().value === 'all' && name().value === '', '花圃默认不覆盖尺寸且未筛选');
      document.querySelector('#ppg-layout-open').click();
      assert(!panel.hidden && getComputedStyle(panel).position === 'fixed' && panel.querySelector('h2').textContent === '土地花圃显示与筛选', '独立悬浮窗自动选择花圃设置');
      change(columns, 'value', '5');
      assert(countColumns() === 5, '花圃列数覆盖原站移动端密度规则');
      change(maxWidth, 'value', '120');
      assert(cards.every(card => card.getBoundingClientRect().width <= 120.5), '花圃每张卡片最大宽度120px');
      change(minHeight, 'value', '180');
      assert(cards.every(card => card.getBoundingClientRect().height >= 179.5), '花圃最小高度独立生效');
      grid.style.width = '320px';
      assert(cards[4].getBoundingClientRect().right <= grid.getBoundingClientRect().right + 0.5, '窄空间下花圃五列自动缩窄');
      grid.style.width = '';

      assert(panel.querySelector('[data-action="preset"]').hidden, '任务截图方案不会显示在花圃设置中');
      assert(panel.querySelector('[data-action="countdown-preset"]').hidden, '倒计时精简方案不会显示在花圃设置中');
      assert(panel.querySelector('#ppg-layout-score-options').hidden, '任务背景开关不会显示在花圃设置中');
      change(state(), 'value', 'growing');
      change(name(), 'value', '兜兰');
      panel.querySelector('[data-select="none"]').click();
      assert([...panel.querySelectorAll('[data-field]')].every(input => !input.checked) && display(cards[0].querySelector('.land-scene')) === 'none', '花圃全不选隐藏信息并收起场景');
      assert(columns.value === '5' && maxWidth.value === '120' && minHeight.value === '180' && state().value === 'growing' && name().value === '兜兰' && visibleCards().length === 4, '花圃批量勾选保留尺寸、布局与组合筛选');
      panel.querySelector('[data-select="invert"]').click();
      assert([...panel.querySelectorAll('[data-field]')].every(input => input.checked), '花圃反选恢复全部显示项');
      change(field('image'), 'checked', false);
      panel.querySelector('[data-select="all"]').click();
      assert(field('image').checked && display(cards[0].querySelector('.land-scene__flower')) !== 'none', '花圃全选恢复图片显示');
      change(state(), 'value', 'all');
      change(name(), 'value', '');

      const selectors = {
        status: '.land-plot__status', image: '.land-scene__flower', soil: '.land-scene__soil',
        name: '.land-plot__name', time: '.land-timing', remaining: '.land-plot__remaining',
      };
      for (const [key, selector] of Object.entries(selectors)) {
        change(field(key), 'checked', false);
        assert(display(cards[0].querySelector(selector)) === 'none', `花圃隐藏字段 ${key}`);
      }
      assert(display(cards[0].querySelector('.land-scene')) === 'none', '图片与底图全隐藏后收起空场景');
      assert(display(cards[0].querySelector('.land-plot__header')) === 'none', '隐藏状态且无精灵时收起空头部');
      const elf = document.createElement('span');
      elf.className = 'land-plot__elves';
      elf.textContent = '精灵';
      cards[0].querySelector('.land-plot__header').append(elf);
      assert(display(cards[0].querySelector('.land-plot__header')) !== 'none', '精灵标记仍可单独显示');
      change(field('elves'), 'checked', false);
      assert(display(elf) === 'none' && display(elf.parentElement) === 'none', '隐藏精灵标记后收起头部');
      elf.remove();
      assert(cards[0].getAttribute('aria-label').includes('鹅黄兜兰'), '隐藏全部信息仍保留土地无障碍名称');
      change(name(), 'value', ' 兜兰 ');
      assert(visibleCards().length === 4, '隐藏花名后仍按原花名筛选并忽略首尾空白');
      change(state(), 'value', 'mature');
      assert(visibleCards().length === 0 && panel.querySelector('#ppg-layout-land-count').textContent === '匹配 0 / 64 块土地', '状态和花名筛选取交集并显示无结果计数');
      cards[0].classList.replace('land-plot--growing', 'land-plot--mature');
      await tick();
      assert(visibleCards().length === 1 && visibleCards()[0] === cards[0], '土地成熟时筛选动态更新');
      cards[0].classList.replace('land-plot--mature', 'land-plot--waiting');
      change(state(), 'value', 'waiting');
      assert(visibleCards().length === 1, '待浇水状态筛选');
      cards[0].classList.replace('land-plot--waiting', 'land-plot--unknown');
      const status = cards[0].querySelector('.land-plot__status');
      const originalStatus = status.innerHTML;
      status.textContent = '空地';
      change(state(), 'value', 'empty');
      change(name(), 'value', '');
      assert(visibleCards().length === 1, '空地通过原始状态文本识别');
      status.firstChild.data = '状态未知';
      await tick();
      assert(visibleCards().length === 0, '状态文字变化时筛选动态更新');
      status.innerHTML = originalStatus;
      cards[0].classList.replace('land-plot--unknown', 'land-plot--growing');
      change(state(), 'value', 'all');
      change(name(), 'value', '<img src=x>');
      assert(visibleCards().length === 0 && !panel.querySelector('#ppg-layout-land-name img'), '关键词作为普通文字处理');
      change(name(), 'value', '兜兰');
      const flowerName = cards[0].querySelector('.land-plot__name');
      const originalName = flowerName.textContent;
      flowerName.firstChild.data = '其他花名';
      await tick();
      assert(visibleCards().length === 3, '花名文字变化时筛选动态更新');
      flowerName.firstChild.data = originalName;
      const extra = cards[0].cloneNode(true);
      grid.append(extra);
      await tick();
      assert(display(extra) !== 'none' && panel.querySelector('#ppg-layout-land-count').textContent === '匹配 5 / 65 块土地', '新土地自动应用筛选与计数');
      extra.remove();
      change(name(), 'value', '');
      assert(visibleCards().length === 64, '清除筛选恢复全部土地');
      panel.querySelector('[data-action="reset"]').click();
      assert(countColumns() === 8 && maxWidth.value === '' && minHeight.value === '' && state().value === 'all' && name().value === '' && [...panel.querySelectorAll('[data-field]')].every(input => input.checked), '恢复默认仅重置花圃设置');
      assert(saved(TASK_KEY).columns === 6 && saved(TASK_KEY).pendingOnly, '花圃操作未覆盖旧版任务存储');

      change(columns, 'value', '6');
      change(maxWidth, 'value', '120');
      change(minHeight, 'value', '240');
      change(field('image'), 'checked', false);
      change(state(), 'value', 'growing');
      change(name(), 'value', '兜兰');
      const page = document.querySelector('.garden-land-page');
      const taskPage = document.createElement('div');
      taskPage.innerHTML = '<div class="grtc-grid"><button class="grtc-task grtc-task--pending"><strong>测试任务</strong><span class="grtc-task__head"><span class="grtc-task__visual">图片</span></span></button></div>';
      page.replaceWith(taskPage);
      await tick();
      assert(columns.value === '6' && maxWidth.value === '240' && minHeight.value === '60' && panel.querySelector('#ppg-layout-pending').checked && !field('image').checked, '切换任务页保留旧任务设置并补上默认最小高度');
      assert(!panel.querySelector('[data-action="countdown-preset"]').hidden, '切换任务页自动展示倒计时精简方案');
      assert(!panel.querySelector('.ppg-export').hidden && taskPage.querySelector('.grtc-grid').previousElementSibling.matches('.ppg-layout-clock--task'), '切换任务页恢复截图按钮和时间卡片');
      assert(!quickCopy.hidden && quickStatus.hidden, '切换任务页显示右下角快捷复制按钮');
      const scoreBackground = panel.querySelector('#ppg-layout-score-background');
      assert(!panel.querySelector('#ppg-layout-score-options').hidden && scoreBackground.checked, '旧任务设置升级后默认开启背景配色');
      change(scoreBackground, 'checked', false);
      change(columns, 'value', '5');
      change(maxWidth, 'value', '180');
      change(minHeight, 'value', '160');
      assert(saved(LAND_KEY).columns === 6 && saved(LAND_KEY).minHeight === 240 && saved(LAND_KEY).name === '兜兰', '修改任务配置不覆盖花圃配置');
      taskPage.replaceWith(page);
      await tick();
      assert(columns.value === '6' && maxWidth.value === '120' && minHeight.value === '240' && name().value === '兜兰' && visibleCards().length === 4, '切回花圃恢复独立配置');
      assert(panel.querySelector('#ppg-layout-score-options').hidden && saved(TASK_KEY).scoreBackground === false, '切回花圃隐藏开关并保留任务背景设置');
      assert(panel.querySelector('.ppg-export').hidden && page.querySelector('.land-field').previousElementSibling.matches('time.ppg-layout-clock'), '切回花圃隐藏截图按钮并恢复时间行');
      assert(quickCopy.hidden && quickStatus.hidden && document.querySelectorAll('#ppg-layout-quick-copy').length === 1, '切回花圃隐藏快捷复制按钮且页面切换不重复创建');
      assert(document.querySelectorAll('#ppg-layout-panel').length === 1 && document.querySelectorAll('#ppg-layout-open').length === 1, '页面切换不重复创建悬浮窗');
      page.remove();
      await tick();
      assert(panel.hidden && document.querySelector('#ppg-layout-open').hidden, '离开支持页面后收起配置窗');
      assert(quickCopy.hidden && quickStatus.hidden, '离开支持页面后隐藏快捷复制和提示');
      document.querySelector('main').append(page);
      await tick();
      window.openLayoutMenu();
      assert(!panel.hidden, '返回花圃可由油猴菜单打开设置');
      panel.querySelector('[data-action="close"]').click();
    }
    document.querySelector('#check-result').textContent = `PASS ${passed.length}\n${passed.join('\n')}`;
  } catch (error) {
    document.querySelector('#check-result').textContent = `FAIL: ${error.message}\n${passed.join('\n')}`;
  }
})();
