// 本地夹具中模拟管理器存储清空，网站存储独立保留；不在真实业务页面执行。
(async () => {
  const result = document.querySelector('#history-check-result');
  const panel = document.querySelector('#ppg-layout-panel');
  const select = panel.querySelector('#ppg-layout-history');
  const status = panel.querySelector('#ppg-layout-history-status');
  const historyKey = 'ppgarden-layout-history-v1';
  const prefix = 'ppgarden-history-check:';
  const passed = [];
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
    passed.push(message);
  };
  const history = () => JSON.parse(localStorage.getItem(historyKey));
  const readCurrent = async () => ({
    task: await GM.getValue('ppgarden-task-layout-v1'),
    land: await GM.getValue('ppgarden-land-layout-v1'),
    theme: await GM.getValue('ppgarden-screenshot-theme-v1'),
    scale: await GM.getValue('ppgarden-screenshot-scale-v1'),
  });
  const change = (selector, value, property = 'value') => {
    const input = panel.querySelector(selector);
    input[property] = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const restore = entry => {
    select.value = String(entry.savedAt);
    select.dispatchEvent(new Event('input', { bubbles: true }));
    panel.querySelector('[data-action="restore-history"]').click();
  };
  try {
    const params = new URLSearchParams(location.search);
    document.querySelector('#ppg-layout-open').click();
    panel.querySelector('.ppg-history').open = true;
    if (params.has('resume')) {
      const expected = JSON.parse(localStorage.getItem(prefix + 'expected'));
      assert(JSON.stringify(await readCurrent()) === JSON.stringify(expected), '清空管理器设置后完整恢复任务、花圃和截图设置');
      assert(status.textContent.includes('已从网站历史恢复'), '设置窗显示自动恢复结果');
      assert(history().some(entry => entry.reason === '手动保存'), '管理器重置后仍保留可选择的历史');
      assert(panel.querySelector('#ppg-layout-columns').value === String(expected.task.columns)
        && panel.querySelector('#ppg-layout-theme').checked === (expected.theme === 'dark')
        && panel.querySelector('#ppg-layout-scale').value === String(expected.scale), '恢复配置同步到控件与页面');
    } else if (params.has('blocked')) {
      assert(status.textContent.includes('历史备份失败'), '网站存储不可用时明确提示备份失败');
      change('#ppg-layout-columns', 6);
      assert((await GM.getValue('ppgarden-task-layout-v1')).columns === 6, '历史写入失败不影响管理器保存当前设置');
      panel.querySelector('[data-action="reset"]').click();
      assert(panel.querySelector('#ppg-layout-columns').value === '6', '无法备份时取消恢复默认，防止丢失配置');
    } else {
      assert(history().length > 0 && history()[0].settings.task.columns === 3, '旧版配置自动建立独立的网站历史');
      assert(history().every(entry => entry.settings.scale >= 1 && entry.settings.scale <= 3), '忽略损坏的历史条目');
      panel.querySelector('[data-action="classic-preset"]').click();
      change('#ppg-layout-columns', 5);
      change('#ppg-layout-max-width', 160);
      change('#ppg-layout-min-height', 72);
      change('#ppg-layout-pending', true, 'checked');
      change('[data-field="image"]', false, 'checked');
      const theme = panel.querySelector('#ppg-layout-theme');
      theme.checked = true;
      theme.dispatchEvent(new Event('change', { bubbles: true }));
      change('#ppg-layout-scale', 2.5);
      panel.querySelector('[data-action="save-history"]').click();
      const saved = history()[0];
      assert(saved.reason === '手动保存' && saved.settings.task.cardStyle === 'classic'
        && saved.settings.task.columns === 5 && saved.settings.task.maxWidth === 160
        && saved.settings.task.minHeight === 72 && saved.settings.task.hidden.includes('image')
        && saved.settings.task.pendingOnly && saved.settings.theme === 'dark' && saved.settings.scale === 2.5,
      '手动历史完整保存尺寸、样式、字段、筛选、主题和倍数');
      assert(saved.settings.land.columns === 7 && saved.settings.land.name === '测试花朵', '任务页历史同时包含花圃配置');
      const beforeSelect = await readCurrent();
      select.value = String(history()[1].savedAt);
      select.dispatchEvent(new Event('input', { bubbles: true }));
      assert(JSON.stringify(await readCurrent()) === JSON.stringify(beforeSelect), '选择历史记录不会修改当前设置');
      panel.querySelector('[data-action="reset"]').click();
      assert(panel.querySelector('#ppg-layout-columns').value === '3', '恢复默认仍正常工作');
      assert(history().some(entry => entry.reason === '恢复默认前' && entry.settings.task.columns === 5), '恢复默认前自动留下完整备份');
      restore(saved);
      assert(panel.querySelector('#ppg-layout-columns').value === '5'
        && panel.querySelector('#ppg-layout-theme').checked
        && panel.querySelector('#ppg-layout-scale').value === '2.5', '恢复历史立即应用任务和截图设置');
      assert(history().some(entry => entry.reason === '恢复历史前'), '恢复历史前保留当前设置，可再次找回');
      const grid = document.querySelector('.grtc-grid');
      const parent = grid.parentElement;
      const next = grid.nextSibling;
      const land = document.createElement('section');
      land.className = 'land-field';
      land.innerHTML = '<article class="land-plot land-plot--empty"><span class="land-plot__status">空地</span></article>';
      grid.remove();
      parent.append(land);
      await new Promise(resolve => setTimeout(resolve, 20));
      change('#ppg-layout-columns', 9);
      change('#ppg-layout-land-name', '<测试> & 花');
      const landSaved = history()[0];
      panel.querySelector('[data-action="reset"]').click();
      restore(landSaved);
      assert(panel.querySelector('#ppg-layout-columns').value === '9'
        && panel.querySelector('#ppg-layout-land-name').value === '<测试> & 花', '花圃页面也能保存、重置和恢复全部设置');
      assert(!select.querySelector('img, script'), '历史描述使用纯文本，不执行保存内容');
      land.remove();
      parent.insertBefore(grid, next);
      await new Promise(resolve => setTimeout(resolve, 20));
      for (let index = 0; index < 24; index++) change('#ppg-layout-columns', index % 2 ? 4 : 5);
      assert(history().length === 20 && select.options.length === 20, '历史始终只保留最近20条');
      const length = history().length;
      change('#ppg-layout-columns', panel.querySelector('#ppg-layout-columns').value);
      assert(history().length === length, '相同配置的自动保存不重复增加记录');
      panel.querySelector('[data-action="save-history"]').click();
      assert(history().length === 20 && history()[0].reason === '手动保存', '达到上限后仍可保存手动历史');
      assert(document.documentElement.scrollWidth <= innerWidth, '历史控件在当前屏幕宽度下无横向溢出');
      assert(select.getBoundingClientRect().height >= 30, '历史记录选择器可操作');
      localStorage.setItem(prefix + 'expected', JSON.stringify(history()[0].settings));
      for (const key of Object.keys(localStorage)) if (key.startsWith(prefix) && !key.endsWith('expected')) localStorage.removeItem(key);
      assert(history().length === 20, '模拟管理器清空全部设置后，网站历史仍存在');
    }
    result.textContent = `PASS ${passed.length}\n${passed.join('\n')}`;
  } catch (error) {
    result.textContent = `FAIL after ${passed.length}: ${error.message}`;
    console.error('[设置历史自检]', error);
  }
})();
