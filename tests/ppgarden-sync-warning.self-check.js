// 本地夹具运行：固定时钟，操作提醒弹窗并拦截渲染、下载和剪贴板，不在真实页面执行。
(async () => {
  const result = document.querySelector('#sync-warning-check-result');
  const source = document.querySelector('.grtc-hero__head > span');
  const sourceParent = source.parentElement;
  const buttons = ['#ppg-layout-export', '#ppg-layout-copy', '#ppg-layout-quick-copy']
    .map(selector => document.querySelector(selector));
  const status = document.querySelector('#ppg-layout-export-status');
  const NativeDate = window.Date;
  const dialog = document.querySelector('#ppg-layout-sync-warning');
  const renderer = window.html2canvas;
  const anchorClick = HTMLAnchorElement.prototype.click;
  const write = Object.getOwnPropertyDescriptor(navigator.clipboard, 'write');
  const passed = [];
  const prompts = [];
  let now = new NativeDate(2026, 9, 16, 12, 0, 0).getTime();
  let approved = false;
  let renderCount = 0;
  let copyCount = 0;
  let downloadCount = 0;
  let renderedTime;
  let advanceOnConfirm = 0;
  const assert = (condition, label) => {
    if (!condition) throw new Error(label);
    passed.push(label);
  };
  const tick = () => new Promise(resolve => setTimeout(resolve, 20));
  const capture = async (button, text, warned, succeeds, label) => {
    source.textContent = `最近同步：${text}`;
    const before = [prompts.length, renderCount, copyCount, downloadCount];
    button.click();
    assert(!dialog.hidden === warned, warned ? '显示 div 提醒弹窗' : '同步正常时不显示提醒弹窗');
    if (warned) {
      prompts.push(dialog.textContent);
      assert(renderCount === before[1] && copyCount === before[2] && downloadCount === before[3], '等待选择期间不截图或访问剪贴板');
      assert(document.activeElement === dialog.querySelector('[data-warning="cancel"]'), '默认聚焦取消截图，避免误确认');
      now += advanceOnConfirm;
      dialog.querySelector(`[data-warning="${approved ? 'continue' : 'cancel'}"]`).click();
    }
    if (succeeds && button !== buttons[0]) assert(copyCount === before[2] + 1, '复制在点击调用栈内申请剪贴板，不等待渲染');
    const deadline = performance.now() + 3000;
    while (buttons[0].disabled && performance.now() < deadline) await tick();
    assert(prompts.length === before[0] + Number(warned)
      && renderCount === before[1] + Number(succeeds)
      && copyCount === before[2] + Number(succeeds && button !== buttons[0])
      && downloadCount === before[3] + Number(succeeds && button === buttons[0])
      && buttons.every(button => !button.disabled) && dialog.hidden, label);
    assert(status.textContent.includes(succeeds ? button === buttons[0] ? '已导出' : '已复制' : '已取消截图'), '截图结果与确认选择一致');
  };
  try {
    window.Date = class extends NativeDate {
      constructor(...args) { super(...(args.length ? args : [now])); }
      static now() { return now; }
    };
    window.html2canvas = async (node, options) => {
      renderCount++;
      const clone = node.cloneNode(true);
      options.onclone(document, clone);
      renderedTime = clone.querySelector('[data-clock="current"] > strong').textContent;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 2;
      return canvas;
    };
    HTMLAnchorElement.prototype.click = function () {
      if (this.download.startsWith('云上花匠-')) downloadCount++;
      else anchorClick.call(this);
    };
    Object.defineProperty(navigator.clipboard, 'write', { configurable: true, value: async items => {
      copyCount++;
      await items[0].getType('image/png');
    } });
    await capture(buttons[0], '10/16 11:59:00', false, true, '同步1分钟前直接导出');
    await capture(buttons[1], '10/16 11:55:00', false, true, '恰好5分钟不提示并正常复制');
    for (const button of buttons) {
      await capture(button, '10/16 11:54:59', true, false, '超过5分钟先提示；取消后不渲染、不下载、不写剪贴板');
    }
    assert(dialog.querySelector('[data-warning="synced"]').textContent === '2026-10-16\n11:54:59'
      && dialog.querySelector('[data-warning="current"]').textContent === '2026-10-16\n12:00:00', '两张时间卡片准确显示同步时间和当前时间');
    approved = true;
    advanceOnConfirm = 60000;
    for (const button of buttons) {
      await capture(button, '10/16 11:50:00', true, true, '确认后对应入口只生成一次图片');
    }
    assert(renderedTime === '2026-10-16 12:03:00', '截图时间使用确认后的时间');
    advanceOnConfirm = 0;
    approved = false;
    for (const text of ['未获取', '', '02/30 12:00:00', '10/16 25:00:00', '10/16 12:60:00', '10/16 12:00:99']) {
      await capture(buttons[2], text, true, false, `无法识别时间 ${text || '空值'} 时先确认`);
    }
    now = new NativeDate(2026, 0, 1, 0, 2, 0).getTime();
    await capture(buttons[2], '12/31 23:59:00', false, true, '跨年3分钟不误报');
    await capture(buttons[0], '2025-12-31 23:56:59', true, false, '含年份的跨年过期时间正常提醒');
    now = new NativeDate(2026, 9, 16, 0, 2, 0).getTime();
    await capture(buttons[0], '10/15 23:59:00', false, true, '跨天3分钟不误报');
    await capture(buttons[2], '10/16 00:10:00', true, false, '同步时间超前5分钟以上也提醒核对');
    for (const close of ['close', 'escape']) {
      const before = [renderCount, copyCount, downloadCount];
      buttons[2].click();
      if (close === 'escape') {
        dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true, bubbles: true }));
      } else dialog.querySelector('[data-warning="close"]').click();
      assert(dialog.hidden && status.textContent.includes('已取消截图')
        && before.join() === [renderCount, copyCount, downloadCount].join(), `${close} 关闭提醒后不产生图片`);
    }
    source.remove();
    await capture(buttons[0], '10/16 00:01:00', true, false, '同步字段缺失时先确认');
    result.textContent = `PASS ${passed.length}\n${passed.join('\n')}`;
  } catch (error) {
    result.textContent = `FAIL after ${passed.length}: ${error.message}`;
    console.error('[截图同步提醒自检]', error);
  } finally {
    window.Date = NativeDate;
    if (!dialog.hidden) dialog.querySelector('[data-warning="cancel"]').click();
    window.html2canvas = renderer;
    HTMLAnchorElement.prototype.click = anchorClick;
    if (!source.isConnected) sourceParent.append(source);
    if (write) Object.defineProperty(navigator.clipboard, 'write', write);
    else delete navigator.clipboard.write;
  }
})();
