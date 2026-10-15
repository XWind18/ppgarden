// 本地夹具模拟原页面的可接取筛选和工具栏重渲染，不在真实业务页面执行。
(async () => {
  const result = document.querySelector('#pending-toggle-check-result');
  const panel = document.querySelector('#ppg-layout-panel');
  const grid = document.querySelector('.grtc-grid');
  const toggle = document.querySelector('#ppg-layout-pending-toggle');
  const checkbox = panel.querySelector('#ppg-layout-pending');
  const passed = [];
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
    passed.push(message);
  };
  const tick = () => new Promise(resolve => setTimeout(resolve, 20));
  const available = () => [...document.querySelectorAll('.grtc-toolbar__toggle')]
    .find(button => button.textContent === '只看可接取');
  const shown = () => [...grid.children].filter(card => getComputedStyle(card).display !== 'none');
  const change = checked => {
    checkbox.checked = checked;
    checkbox.dispatchEvent(new Event('input', { bubbles: true }));
  };
  try {
    if (new URLSearchParams(location.search).has('resume')) {
      await tick();
      assert(toggle.getAttribute('aria-pressed') === 'true' && checkbox.checked, '刷新后恢复按钮和设置窗的筛选状态');
      assert(available().getAttribute('aria-pressed') === 'false' && shown().length === 5, '恢复待刷新筛选时自动关闭原可接取筛选');
    } else {
      assert(available().nextElementSibling === toggle, '待刷新按钮紧挨原可接取按钮右侧');
      assert(toggle.tagName === 'BUTTON' && toggle.classList.contains('grtc-toolbar__toggle')
        && toggle.getAttribute('aria-pressed') === 'false', '使用原生按钮和网站样式，并提供选中状态');
      toggle.click();
      await tick();
      assert(toggle.getAttribute('aria-pressed') === 'true' && checkbox.checked, '快捷按钮开启后同步设置窗选项');
      assert(shown().length === 5 && shown().every(card => card.classList.contains('grtc-task--pending')), '快捷筛选只显示待刷新任务');
      assert((await GM.getValue('ppgarden-task-layout-v1')).pendingOnly, '快捷筛选自动保存');
      toggle.click();
      assert(!checkbox.checked && shown().length === 12, '再次点击恢复全部任务');
      available().click();
      await tick();
      assert(available().getAttribute('aria-pressed') === 'true'
        && shown().every(card => card.classList.contains('grtc-task--available')), '原页面可接取筛选仍正常工作');
      toggle.click();
      await tick();
      assert(available().getAttribute('aria-pressed') === 'false' && shown().length === 5, '开启待刷新会关闭可接取并显示待刷新任务');
      available().click();
      await tick();
      assert(!checkbox.checked && toggle.getAttribute('aria-pressed') === 'false'
        && !(await GM.getValue('ppgarden-task-layout-v1')).pendingOnly, '开启原可接取筛选会关闭并保存待刷新状态');
      change(true);
      await tick();
      assert(toggle.getAttribute('aria-pressed') === 'true'
        && available().getAttribute('aria-pressed') === 'false' && shown().length === 5, '设置窗开启筛选也同步按钮并处理互斥');
      change(false);
      assert(toggle.getAttribute('aria-pressed') === 'false' && shown().length === 12, '设置窗关闭筛选会同步按钮');
      const toolbar = available().closest('.grtc-toolbar');
      toolbar.replaceWith(toolbar.cloneNode(true));
      await tick();
      assert(document.querySelectorAll('#ppg-layout-pending-toggle').length === 1
        && available().nextElementSibling === toggle && toggle.isConnected, '工具栏复制替换后按钮不重复且保留原事件');
      toggle.click();
      await tick();
      assert(checkbox.checked && shown().length === 5, '工具栏重渲染后快捷按钮仍可筛选');
      const fresh = grid.querySelector('.grtc-task--available').cloneNode(true);
      grid.append(fresh);
      await tick();
      assert(getComputedStyle(fresh).display === 'none', '新增可接取任务自动遵循待刷新筛选');
      fresh.classList.replace('grtc-task--available', 'grtc-task--pending');
      await tick();
      assert(getComputedStyle(fresh).display !== 'none', '任务动态变为待刷新后自动显示');
      fresh.remove();
      const saved = JSON.parse(localStorage.getItem('ppgarden-layout-history-v1'))[0];
      panel.querySelector('[data-action="reset"]').click();
      assert(toggle.getAttribute('aria-pressed') === 'false' && !checkbox.checked, '恢复默认会同步关闭快捷筛选');
      panel.querySelector('#ppg-layout-history').value = String(saved.savedAt);
      panel.querySelector('[data-action="restore-history"]').click();
      assert(toggle.getAttribute('aria-pressed') === 'true' && checkbox.checked, '恢复历史也会同步快捷筛选');
      const parent = grid.parentElement;
      const next = grid.nextSibling;
      const land = document.createElement('section');
      land.className = 'land-field';
      land.innerHTML = '<article class="land-plot land-plot--empty">空地</article>';
      grid.remove();
      parent.append(land);
      await tick();
      assert(!toggle.isConnected, '切到花圃时移除任务快捷筛选');
      land.remove();
      parent.insertBefore(grid, next);
      await tick();
      assert(available().nextElementSibling === toggle && toggle.getAttribute('aria-pressed') === 'true', '切回任务中心后恢复快捷筛选');
      assert(document.documentElement.scrollWidth <= innerWidth, '工具栏增加按钮后页面无横向溢出');
      const left = available().getBoundingClientRect();
      const right = toggle.getBoundingClientRect();
      assert(right.left >= left.right && Math.abs(right.top - left.top) < 1, '两个筛选按钮并排显示在同一行');
      assert(innerWidth > 600 || right.height >= 44, '手机上的待刷新按钮触控高度至少44px');
    }
    result.textContent = `PASS ${passed.length}\n${passed.join('\n')}`;
  } catch (error) {
    result.textContent = `FAIL after ${passed.length}: ${error.message}`;
    console.error('[待刷新快捷筛选自检]', error);
  }
})();
