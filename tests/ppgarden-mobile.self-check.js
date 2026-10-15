// 在三列本地任务夹具、GM 接口替身和真实截图组件中运行；复制写入使用替身。
(async () => {
  const passed = [];
  const assert = (condition, label) => {
    if (!condition) throw new Error(label);
    passed.push(label);
  };
  const result = document.querySelector('#mobile-check-result');
  const grid = document.querySelector('.grtc-grid');
  const panel = document.querySelector('#ppg-layout-panel');
  const columns = document.querySelector('#ppg-layout-columns');
  const maxWidth = document.querySelector('#ppg-layout-max-width');
  const minHeight = document.querySelector('#ppg-layout-min-height');
  const cards = [...grid.querySelectorAll('.grtc-task')];
  const renderer = window.html2canvas;
  const anchorClick = HTMLAnchorElement.prototype.click;
  const mobile = innerWidth <= 600;
  const originalWrite = Object.getOwnPropertyDescriptor(navigator.clipboard, 'write');
  const copies = [];
  const downloads = [];
  let capturedCanvas;
  const tick = () => new Promise(resolve => setTimeout(resolve, 20));
  const change = (input, value, property = 'value') => {
    input[property] = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const titlesFit = root => [...root.querySelectorAll('.grtc-task > strong')].every(title =>
    title.scrollHeight <= title.clientHeight + 1 && getComputedStyle(title).overflow === 'visible');
  try {
    assert(columns.value === '3', '使用三列夹具，手机首次使用默认三列');
    assert(maxWidth.value === '190' && minHeight.value === '60', '默认最大宽度190px、最小高度60px');
    assert(panel.querySelector('[data-field="image"]').checked, '默认勾选任务图片');
    assert(titlesFit(grid), '长任务标题完整换行，没有省略或裁切');
    assert(cards.every(card => card.scrollWidth <= card.clientWidth + 1), '三列卡片内容没有水平溢出');
    const rows = new Map();
    for (const card of cards) {
      const rect = card.getBoundingClientRect();
      const key = rect.top.toFixed(1);
      if (!rows.has(key)) rows.set(key, []);
      rows.get(key).push(rect.height);
    }
    assert([...rows.values()].every(heights => Math.max(...heights) - Math.min(...heights) < 1), '每行随最高卡片等高');
    const timer = grid.querySelector('.grtc-card-status__time strong');
    const timerText = timer.textContent;
    timer.textContent = '1:00:25';
    assert(timer.getBoundingClientRect().right <= timer.closest('.grtc-card-status').getBoundingClientRect().right + 1,
      '完整小时倒计时保持在状态框内');
    timer.textContent = timerText;
    document.querySelector('#ppg-layout-open').click();
    assert(!panel.hidden && (!mobile || document.activeElement === panel), '打开手机设置聚焦面板，避免自动弹出数字键盘');
    assert(panel.getBoundingClientRect().left >= 0 && panel.getBoundingClientRect().top >= 0
      && panel.getBoundingClientRect().right <= innerWidth, '手机设置窗完整位于视口内');
    if (mobile) {
      assert([...panel.querySelectorAll('input[type="number"], input[type="search"], select')].every(input =>
        parseFloat(getComputedStyle(input).fontSize) >= 16), '输入框至少16px，避免Safari聚焦时自动放大');
      assert([...panel.querySelectorAll('button, .ppg-fields label, .ppg-filter, .ppg-theme')]
        .filter(element => element.getBoundingClientRect().height > 0)
        .every(element => element.getBoundingClientRect().height >= 44), '设置触控区域至少44px');
    }
    change(columns, '2');
    assert(getComputedStyle(grid).gridTemplateColumns.split(' ').length === 2 && titlesFit(grid), '自定义两列仍正常显示完整标题');
    change(columns, '3');
    const image = panel.querySelector('[data-field="image"]');
    change(image, false, 'checked');
    assert(titlesFit(grid) && getComputedStyle(cards[0].querySelector('.grtc-task__visual')).display === 'none', '隐藏图片后文字重新排布');
    change(image, true, 'checked');
    panel.querySelector('[data-action="close"]').click();
    window.html2canvas = async (node, options) => {
      const expected = { columns: Number(columns.value), maxWidth: Number(maxWidth.value), minHeight: Number(minHeight.value) };
      const onclone = options.onclone;
      options.onclone = (doc, clonedGrid) => {
        onclone(doc, clonedGrid);
        assert([...clonedGrid.querySelectorAll('.grtc-task > strong')].every(title =>
          doc.defaultView.getComputedStyle(title).whiteSpace === 'normal'
          && doc.defaultView.getComputedStyle(title).overflow === 'visible'
          && title.scrollWidth <= title.clientWidth + 1 && title.scrollHeight <= title.clientHeight + 1
          && title.getBoundingClientRect().bottom <= title.closest('.grtc-task').getBoundingClientRect().bottom),
        '截图任务内容过长时自动换行，文字完整且不溢出卡片');
        const shortTitle = [...clonedGrid.querySelectorAll('.grtc-task > strong')].find(title => title.textContent === 'VIP商店购买4次');
        const longTitle = clonedGrid.querySelector('.grtc-task > strong');
        assert(shortTitle.getBoundingClientRect().height <= parseFloat(doc.defaultView.getComputedStyle(shortTitle).lineHeight) + 1
          && longTitle.getBoundingClientRect().height > parseFloat(doc.defaultView.getComputedStyle(longTitle).lineHeight) + 1,
        '短任务单行，长任务按当前卡片宽度换行');
        assert(doc.defaultView.getComputedStyle(clonedGrid).gridTemplateColumns.split(' ').length === expected.columns,
          '截图读取设置中的当前列数');
        assert([...clonedGrid.querySelectorAll('.grtc-task')].every(card =>
          Math.abs(card.getBoundingClientRect().width - expected.maxWidth) < 1
          && parseFloat(doc.defaultView.getComputedStyle(card).maxWidth) === expected.maxWidth),
        '截图遵守设置中的卡片最大宽度');
        assert([...clonedGrid.querySelectorAll('.grtc-task')].every(card =>
          parseFloat(doc.defaultView.getComputedStyle(card).minHeight) === expected.minHeight
          && card.getBoundingClientRect().height >= expected.minHeight - 1),
        '截图读取设置中的最小高度且允许内容撑高');
        assert(parseFloat(doc.defaultView.getComputedStyle(clonedGrid.querySelector('.grtc-task')).padding) === 8
          && clonedGrid.querySelector('.grtc-task__visual').getBoundingClientRect().width === 32,
        '手机与PC截图统一使用桌面间距和32px图片');
        const clock = clonedGrid.querySelector('.ppg-layout-clock');
        assert([...clock.querySelectorAll('.ppg-time-card > span')].map(label => label.textContent).join(',')
          === '同步时间,下次任务刷新,截图时间', '长图按顺序显示三张时间卡片');
        assert([...clock.children].every(card => Math.abs(card.getBoundingClientRect().width - expected.maxWidth) < 1),
          '三张时间卡片与当前任务卡片等宽');
      };
      capturedCanvas = await renderer(node, options);
      return capturedCanvas;
    };
    Object.defineProperty(navigator.clipboard, 'write', { configurable: true, value: async items => {
      copies.push(await items[0].getType('image/png'));
    } });
    HTMLAnchorElement.prototype.click = function () {
      if (!this.download.startsWith('云上花匠-')) return anchorClick.call(this);
      downloads.push(fetch(this.href).then(response => response.blob()));
    };
    const copy = document.querySelector('#ppg-layout-quick-copy');
    const take = async button => {
      button.click();
      const deadline = performance.now() + 30000;
      while (copy.disabled && performance.now() < deadline) await tick();
      assert(!copy.disabled && !document.querySelector('#ppg-layout-export-status').textContent.includes('失败'), '截图完成并恢复按钮');
    };
    await take(copy);
    assert(copies.length === 1, '手机布局能够生成并复制长图');
    const png = new DataView(await copies[0].arrayBuffer());
    assert(png.getUint32(0) === 0x89504e47 && png.getUint32(16) === 1220, '默认3列190px、2倍复制结果为1220px宽PNG');
    result.dataset.pngWidth = png.getUint32(16);
    result.dataset.pngHeight = png.getUint32(20);
    const preview = document.createElement('img');
    preview.id = 'mobile-export-preview';
    preview.hidden = true;
    preview.src = capturedCanvas.toDataURL('image/png');
    document.body.append(preview);
    change(columns, '2');
    change(maxWidth, '160');
    change(minHeight, '180');
    await take(copy);
    const customPng = new DataView(await copies[1].arrayBuffer());
    assert(customPng.getUint32(16) === 704, '改成2列160px后复制图宽度随当前设置变为704px');
    await take(document.querySelector('#ppg-layout-export'));
    const downloadPng = new DataView(await (await downloads[0]).arrayBuffer());
    assert(downloadPng.getUint32(0) === 0x89504e47 && downloadPng.getUint32(16) === customPng.getUint32(16)
      && downloadPng.getUint32(20) === customPng.getUint32(20), '导出与复制读取同一份当前尺寸配置');
    change(columns, '3');
    change(maxWidth, '190');
    change(minHeight, '60');
    assert(document.documentElement.scrollWidth <= innerWidth, '页面没有水平滚动');
    result.textContent = `PASS ${passed.length}\n${passed.join('\n')}`;
  } catch (error) {
    result.textContent = `FAIL: ${error.message}\n${passed.join('\n')}`;
  } finally {
    window.html2canvas = renderer;
    HTMLAnchorElement.prototype.click = anchorClick;
    if (originalWrite) Object.defineProperty(navigator.clipboard, 'write', originalWrite);
    else delete navigator.clipboard.write;
  }
})();
