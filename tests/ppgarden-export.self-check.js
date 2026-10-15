// 本地快照检查：使用真实截图组件，拦截下载并检查生成的 PNG；报告与图片均隐藏。
(async () => {
  const passed = [];
  const assert = (condition, label) => {
    if (!condition) throw new Error(label);
    passed.push(label);
  };
  const isTask = !!document.querySelector('.grtc-grid');
  const grid = document.querySelector(isTask ? '.grtc-grid' : '.land-field');
  const button = document.querySelector('#ppg-layout-export');
  const copyButton = document.querySelector('#ppg-layout-copy');
  const quickCopyButton = document.querySelector('#ppg-layout-quick-copy');
  const quickStatus = document.querySelector('#ppg-layout-quick-status');
  const panel = document.querySelector('#ppg-layout-panel');
  const themeInput = document.querySelector('#ppg-layout-theme');
  const status = document.querySelector('#ppg-layout-export-status');
  const originalRenderer = window.html2canvas;
  const originalClick = HTMLAnchorElement.prototype.click;
  const outputs = [];
  const canvases = [];
  const themeSamples = [];
  let expectedTheme;
  const clipboard = navigator.clipboard;
  const originalWrite = clipboard && Object.getOwnPropertyDescriptor(clipboard, 'write');
  const copied = [];
  const change = (selector, value, property = 'value') => {
    const input = document.querySelector(selector);
    input[property] = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const tick = () => new Promise(resolve => setTimeout(resolve, 20));
  const saved = () => JSON.stringify(GM_getValue(isTask ? 'ppgarden-task-layout-v1' : 'ppgarden-land-layout-v1', {}));
  const render = async (node, options) => {
    const onclone = options.onclone;
    let sample;
    options.onclone = async (doc, clonedGrid) => {
      await onclone(doc, clonedGrid);
      const timestamp = clonedGrid.querySelector(':scope > .ppg-layout-clock--task');
      assert(timestamp?.children.length === 3
        && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(timestamp.querySelector('[data-clock="current"] > strong').textContent)
        && timestamp.querySelector('[data-clock="current"] > span').textContent === '截图时间', '截图顶部包含三张时间卡片及完整截图时间');
      const rect = clonedGrid.getBoundingClientRect();
      const cards = [...clonedGrid.querySelectorAll('.grtc-task')].filter(card => card.getBoundingClientRect().height > 0);
      const last = cards[cards.length - 1];
      const rows = new Map();
      for (const card of cards) {
        const bounds = card.getBoundingClientRect();
        const key = bounds.top.toFixed(1);
        if (!rows.has(key)) rows.set(key, []);
        rows.get(key).push(bounds.height);
      }
      assert([...rows.values()].every(heights => Math.max(...heights) - Math.min(...heights) < 1), '长图每行卡片保持自适应等高');
      assert(doc.documentElement.dataset.theme === expectedTheme, '长图使用开关指定的截图主题');
      assert(options.backgroundColor === doc.defaultView.getComputedStyle(doc.body).backgroundColor, '长图边缘也使用指定主题的背景');
      const first = cards[0].getBoundingClientRect();
      sample = [(first.right - rect.left + 12 - 8) * options.scale, (first.bottom - rect.top + 12 - 8) * options.scale];
      assert(last.getBoundingClientRect().bottom - rect.top <= options.height - 12, '展开滚动区域后最后一张卡片完整包含在截图尺寸中');
      assert(options.scale === 2, '普通长图默认采用2倍分辨率');
    };
    const canvas = await originalRenderer(node, options);
    canvases.push(canvas);
    themeSamples.push([...canvas.getContext('2d').getImageData(...sample, 1, 1).data]);
    return canvas;
  };
  window.html2canvas = render;
  HTMLAnchorElement.prototype.click = function () {
    if (!this.download.startsWith('云上花匠-')) return originalClick.call(this);
    const link = this;
    outputs.push((async () => {
      const blob = await fetch(link.href).then(response => response.blob());
      const data = new Uint8Array(await blob.arrayBuffer());
      assert(data.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10', '下载内容为有效 PNG');
      const header = new DataView(data.buffer);
      const canvas = canvases[canvases.length - 1];
      assert(header.getUint32(16) === canvas.width && header.getUint32(20) === canvas.height, 'PNG 尺寸与渲染结果一致');
      const image = document.createElement('img');
      image.id = `export-check-image-${outputs.length}`;
      image.hidden = true;
      image.src = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      document.body.append(image);
      return { name: link.download, width: canvas.width, height: canvas.height, bytes: blob.size };
    })());
  };
  const exportOnce = async (copy = false, quick = false) => {
    const settings = saved();
    const pageTheme = document.documentElement.dataset.theme;
    const panelHidden = panel.hidden;
    expectedTheme = themeInput.checked ? 'dark' : 'light';
    (quick ? quickCopyButton : copy ? copyButton : button).click();
    assert(button.disabled && copyButton.disabled && quickCopyButton.disabled, '生成时三个截图按钮同步禁用');
    quickCopyButton.click();
    const deadline = performance.now() + 30000;
    while (button.disabled && performance.now() < deadline) await tick();
    assert(!button.disabled && !copyButton.disabled && !quickCopyButton.disabled && button.textContent === '导出长图'
      && copyButton.textContent === '复制长图' && quickCopyButton.textContent === '复制长图', '截图后三个按钮恢复可用');
    assert(quickStatus.textContent === status.textContent && !quickStatus.hidden, '快捷按钮上方显示与配置窗一致的结果提示');
    assert(panel.hidden === panelHidden, '截图不会打开或关闭配置窗');
    assert(settings === saved(), '导出不改变已保存的配置');
    assert(document.documentElement.dataset.theme === pageTheme, '截图不改变页面深浅色');
    assert(!document.querySelector('iframe.html2canvas-container'), '截图完成后清理临时渲染页面');
    return status.textContent;
  };

  try {
    if (!isTask) {
      document.querySelector('#ppg-layout-open').click();
      assert(document.querySelector('.ppg-export').hidden, '花圃没有导出或复制入口');
      assert(quickCopyButton.hidden && quickStatus.hidden, '花圃隐藏右下角快捷复制和状态');
      button.click();
      copyButton.click();
      quickCopyButton.click();
      assert(outputs.length === 0, '花圃无法触发任务截图');
      assert(grid.previousElementSibling.matches('time.ppg-layout-clock'), '花圃保留页面当前时间');
      document.querySelector('#check-result').textContent = `PASS ${passed.length}\n${passed.join('\n')}`;
      return;
    }
    assert(typeof originalRenderer === 'function', '真实截图组件已加载');
    document.querySelector('#ppg-layout-open').click();
    assert(!document.querySelector('#ppg-layout-panel').hidden, '导出按钮可从悬浮窗访问');
    if (themeInput.checked) themeInput.click();
    assert(document.documentElement.dataset.theme === 'dark' && !themeInput.checked, '选择浅色截图后页面保持深色');
    const clock = grid.previousElementSibling;
    const earlier = clock.textContent;
    const clockDeadline = performance.now() + 2500;
    while (clock.textContent === earlier && performance.now() < clockDeadline) await tick();
    assert(clock.textContent !== earlier && clock.children.length === 3
      && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(clock.querySelector('[data-clock="current"] > strong').textContent), '三张时间卡片自动更新当前时间');
    let message = await exportOnce();
    assert(message.includes(isTask ? '66张卡片' : '64张卡片') && !message.includes('未加载'), '完整导出全部卡片且资源正常加载');
    const first = await outputs[0];
    assert(first.name.includes(isTask ? '任务长图' : '花圃长图') && first.name.endsWith('.png'), '下载文件名对应当前页面');
    assert(first.height > document.documentElement.clientHeight, '长图包含屏幕下方内容');
    assert(canvases[0].getContext('2d').getImageData(first.width / 2, first.height - 20, 1, 1).data[3] === 255, '长图底部完成绘制');

    if (isTask) {
      change('#ppg-layout-pending', true, 'checked');
      change('[data-field="image"]', false, 'checked');
    } else {
      change('#ppg-layout-land-state', 'growing');
      change('#ppg-layout-land-name', '兜兰');
    }
    message = await exportOnce();
    const filtered = await outputs[1];
    assert(message.includes(isTask ? '34张卡片' : '4张卡片') && filtered.height < first.height, '导出只包含当前筛选结果');

    const style = grid.getAttribute('style');
    grid.style.height = '210px';
    grid.style.overflow = 'auto';
    grid.scrollTop = 120;
    message = await exportOnce();
    const scrolled = await outputs[2];
    assert(!message.startsWith('导出失败') && scrolled.height === filtered.height, '内部滚动容器仍导出完整卡片高度');
    if (style === null) grid.removeAttribute('style');
    else grid.setAttribute('style', style);

    assert(clipboard && typeof ClipboardItem === 'function', '浏览器支持图片剪贴板接口');
    Object.defineProperty(clipboard, 'write', { configurable: true, value: async items => {
      assert(items.length === 1 && items[0].types.join(',') === 'image/png', '向剪贴板提交PNG图片');
      copied.push(await items[0].getType('image/png'));
    } });
    themeInput.click();
    assert(document.documentElement.dataset.theme === 'dark' && themeInput.checked, '选择深色截图后页面主题不变');
    document.documentElement.dataset.theme = 'light';
    message = await exportOnce(true, true);
    const png = new DataView(await copied[0].arrayBuffer());
    assert(message.includes('已复制到剪贴板') && copied[0].type === 'image/png', '复制成功给出粘贴提示');
    assert(png.getUint32(16) === filtered.width && png.getUint32(20) === filtered.height, '剪贴板保留与下载相同的高清PNG尺寸');
    assert(themeSamples[1].slice(0, 3).reduce((a, b) => a + b) > themeSamples[3].slice(0, 3).reduce((a, b) => a + b) + 150, '实际PNG颜色随截图开关切换，独立于页面主题');
    assert(outputs.length === 3, '复制图片不会额外下载文件');
    message = await exportOnce();
    await outputs[3];
    assert(!message.startsWith('导出失败') && themeSamples[3].slice(0, 3).every((value, channel) => Math.abs(value - themeSamples[4][channel]) < 5), '深色导出和深色复制使用相同的图片背景');
    themeInput.click();
    panel.querySelector('[data-action="close"]').click();
    assert(panel.hidden && !quickCopyButton.hidden, '设置窗关闭后快捷复制仍可用');
    const renderCount = canvases.length;
    message = await exportOnce(true, true);
    assert(message.includes('已复制到剪贴板') && themeSamples[1].slice(0, 3).every((value, channel) => Math.abs(value - themeSamples[5][channel]) < 5), '关闭截图深色后复制浅色PNG');
    assert(canvases.length === renderCount + 1 && copied.length === 2 && quickStatus.textContent.includes('已复制到剪贴板'), '快捷复制仅生成一张高清PNG并直接显示粘贴提示');
    assert(outputs.length === 4, '主题切换后的复制仍不会额外下载');
    Object.defineProperty(clipboard, 'write', { configurable: true, value: () => Promise.reject(new DOMException('模拟权限拒绝', 'NotAllowedError')) });
    message = await exportOnce(true, true);
    assert(message.includes('浏览器未允许') && message.includes('导出长图'), '剪贴板权限拒绝时提示PNG保存方案');

    const holder = document.createDocumentFragment();
    holder.append(...grid.children);
    const downloadCount = outputs.length;
    quickCopyButton.click();
    assert(quickStatus.textContent.includes('没有符合') && !quickStatus.hidden && outputs.length === downloadCount
      && !button.disabled && !quickCopyButton.disabled, '快捷复制无结果时直接给出提示且不下载空白图片');
    grid.append(holder);
    await tick();

    change('#ppg-layout-min-height', '40000');
    message = await exportOnce();
    assert(message.includes('尺寸过大') && outputs.length === downloadCount, '超大长图提示调整布局且恢复按钮');
    change('#ppg-layout-min-height', '100');
    window.html2canvas = () => Promise.reject(new Error('模拟渲染失败'));
    message = await exportOnce();
    assert(message.includes('模拟渲染失败') && outputs.length === downloadCount, '渲染异常明确提示并恢复按钮');
    document.querySelector('#check-result').textContent = `PASS ${passed.length}\n${passed.join('\n')}`;
    document.querySelector('#export-check-metadata').textContent = JSON.stringify(await Promise.all(outputs));
  } catch (error) {
    document.querySelector('#check-result').textContent = `FAIL: ${error.message}\n${passed.join('\n')}`;
  } finally {
    window.html2canvas = originalRenderer;
    HTMLAnchorElement.prototype.click = originalClick;
    if (clipboard) {
      if (originalWrite) Object.defineProperty(clipboard, 'write', originalWrite);
      else delete clipboard.write;
    }
  }
})();
