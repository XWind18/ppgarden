// 本地任务夹具运行：GM 接口与剪贴板使用替身，截图使用真实 html2canvas-pro。
(async () => {
  const result = document.querySelector('#classic-check-result');
  const panel = document.querySelector('#ppg-layout-panel');
  const grid = document.querySelector('.grtc-grid');
  const style = panel.querySelector('#ppg-layout-card-style');
  const selectedStyle = () => style.querySelector('input:checked')?.value;
  const preset = panel.querySelector('[data-action="classic-preset"]');
  const copy = document.querySelector('#ppg-layout-quick-copy');
  const columns = panel.querySelector('#ppg-layout-columns');
  const maxWidth = panel.querySelector('#ppg-layout-max-width');
  const minHeight = panel.querySelector('#ppg-layout-min-height');
  const theme = panel.querySelector('#ppg-layout-theme');
  const cards = [...grid.children];
  const passed = [];
  const copies = [];
  const downloads = [];
  const renderer = window.html2canvas;
  const write = Object.getOwnPropertyDescriptor(navigator.clipboard, 'write');
  const anchorClick = HTMLAnchorElement.prototype.click;
  const pageTheme = document.documentElement.dataset.theme;
  const assert = (value, label) => {
    if (!value) throw new Error(label);
    passed.push(label);
  };
  const change = (input, value, key = 'value') => {
    input[key] = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const color = selector => getComputedStyle(grid.querySelector(selector)).backgroundColor;
  const titlesFit = root => [...root.querySelectorAll('.grtc-task > strong')].every(title =>
    title.scrollWidth <= title.clientWidth + 1 && title.scrollHeight <= title.clientHeight + 1);
  const take = async button => {
    button.click();
    const deadline = performance.now() + 30000;
    while (copy.disabled && performance.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert(!copy.disabled && !panel.querySelector('#ppg-layout-export-status').textContent.includes('失败'), '长图生成成功并恢复按钮');
  };
  try {
    if (new URLSearchParams(location.search).has('resume')) {
      assert(selectedStyle() === 'classic' && getComputedStyle(grid).gap === '2px', '刷新后保留经典样式');
      assert(panel.querySelector('[data-field="image"]').checked, '刷新后保留经典方案的显示图片设置');
      result.textContent = `PASS ${passed.length}\n${passed.join('\n')}`;
      return;
    }
    assert(selectedStyle() === 'modern', '旧设置及首次使用保留新版样式');
    assert(style.querySelectorAll('input[type="radio"]').length === 2 && !style.querySelector('select'), '任务样式使用两个原生单选按钮');
    const upgradeType = cards[0].querySelector('.grtc-task__class');
    const upgradeBy = cards[0].querySelector('.grtc-task__by--upgrade');
    const originalBy = upgradeBy.textContent;
    const settle = () => new Promise(resolve => setTimeout(resolve, 20));
    assert(upgradeType.textContent === '示例成员 升级', '新版直接显示升级人姓名');
    document.querySelector('#ppg-layout-open').click();
    assert([...style.querySelectorAll('label')].every(label => label.getBoundingClientRect().height >= 44)
      && style.scrollWidth <= style.clientWidth, '样式按钮触控区域至少44px且无水平溢出');
    preset.click();
    assert(selectedStyle() === 'classic' && columns.value === '3' && maxWidth.value === '190' && minHeight.value === '60', '经典方案使用3列190px和最小60px');
    assert(upgradeType.textContent === '示例成员 升级', '经典版直接显示升级人姓名');
    assert(getComputedStyle(upgradeBy).display === 'none', '合并重复的升级人提示以保持紧凑');
    const typeField = panel.querySelector('[data-field="type"]');
    change(typeField, false, 'checked');
    assert(getComputedStyle(upgradeType).display === 'none' && getComputedStyle(upgradeBy).display !== 'none', '隐藏任务类型时仍单独显示升级人');
    change(typeField, true, 'checked');
    const byField = panel.querySelector('[data-field="by"]');
    change(byField, false, 'checked');
    assert(upgradeType.textContent === '他人升级' && getComputedStyle(upgradeBy).display === 'none', '隐藏接取／升级人时类型中也隐藏姓名');
    change(byField, true, 'checked');
    assert(upgradeType.textContent === '示例成员 升级', '重新勾选恢复升级人姓名');
    upgradeBy.textContent = '由 s760.测试玩家 <花友> & 同伴 升级';
    await settle();
    assert(upgradeType.textContent === 's760.测试玩家 <花友> & 同伴 升级' && !upgradeType.children.length
      && upgradeType.scrollWidth <= upgradeType.clientWidth + 1, '动态更新完整姓名并安全换行');
    assert(cards[0].dataset.ppgScore === '23', '显示姓名后仍按升级前的原始分配色');
    upgradeBy.textContent = '';
    await settle();
    assert(upgradeType.textContent === '他人升级', '姓名缺失时保留他人升级');
    upgradeBy.className = 'grtc-task__by grtc-task__by--taker';
    upgradeBy.textContent = '由 接取成员 接取';
    await settle();
    assert(upgradeType.textContent === '他人升级', '不会误用接取人的姓名');
    upgradeBy.className = 'grtc-task__by grtc-task__by--upgrade';
    upgradeBy.textContent = originalBy;
    upgradeType.textContent = '普通';
    await settle();
    assert(upgradeType.textContent === '普通' && !upgradeType.hasAttribute('data-ppg-upgrade-label'), '卡片类型变化时清除旧升级姓名');
    upgradeType.textContent = '他人升级';
    await settle();
    assert(upgradeType.textContent === '示例成员 升级', '原页面重新渲染后恢复升级人姓名');
    const imageField = panel.querySelector('[data-field="image"]');
    const image = cards[0].querySelector('.grtc-task__visual');
    assert(imageField.checked && !theme.checked, '经典方案默认显示图片并使用浅色截图');
    assert(cards.every(card => {
      const visual = card.querySelector('.grtc-task__visual').getBoundingClientRect();
      const title = card.querySelector(':scope > strong').getBoundingClientRect();
      return visual.width === 24 && visual.height === 24 && visual.bottom <= title.top
        && Math.abs(visual.left + visual.width / 2 - (title.left + title.width / 2)) < 1;
    }), '24px任务图片居中显示在内容上方，不压缩文字宽度');
    change(imageField, false, 'checked');
    assert(getComputedStyle(image).display === 'none' && titlesFit(grid), '经典版可取消图片且文字完整');
    change(imageField, true, 'checked');
    assert(getComputedStyle(grid).gap === '2px' && getComputedStyle(cards[0]).borderRadius === '2px', '经典卡片密排且采用小圆角');
    assert(getComputedStyle(cards[0].querySelector('strong')).textAlign === 'center', '经典任务内容居中');
    assert(cards.every(card => card.querySelector('.grtc-task__top > em').getBoundingClientRect().top
      >= card.querySelector(':scope > strong').getBoundingClientRect().bottom - 1), '积分排列在任务内容下方');
    assert(color('.grtc-task--available') === 'rgb(239, 252, 243)'
      && color('.grtc-task--pending') === 'rgb(255, 250, 233)'
      && color('.grtc-task--unavailable') === 'rgb(255, 240, 244)', '可接取绿、待刷新米黄、已接取粉');
    const background = panel.querySelector('#ppg-layout-score-background');
    change(background, false, 'checked');
    assert(!grid.querySelector('[data-ppg-score]') && !getComputedStyle(cards[0]).backgroundImage.includes('gradient'), '经典背景色开关生效');
    change(background, true, 'checked');
    const clock = grid.previousElementSibling;
    assert([...clock.querySelectorAll('.ppg-time-card > span')].map(node => node.textContent).join(',')
      === '同步时间,下次任务刷新,当前时间', '经典版保留新版三张时间卡片');
    assert([...clock.children].every(card => Math.abs(card.getBoundingClientRect().width - cards[0].getBoundingClientRect().width) < 1), '页面时间卡片与任务等宽');
    style.querySelector('[value="modern"]').click();
    assert(getComputedStyle(grid).gap === '8px' && getComputedStyle(cards[0].querySelector('strong')).textAlign !== 'center', '可切回新版样式');
    assert(selectedStyle() === 'modern' && style.querySelectorAll('input:checked').length === 1, '点击新版按钮保持唯一选中');
    style.querySelector('[value="classic"]').click();
    assert(selectedStyle() === 'classic' && (await GM.getValue('ppgarden-task-layout-v1')).cardStyle === 'classic', '点击经典版按钮立即应用并保存');
    panel.querySelector('[data-select="all"]').click();
    assert(titlesFit(grid) && cards.every(card => card.scrollWidth <= card.clientWidth + 1), '经典版全选字段和图片后仍完整显示');
    preset.click();
    const pending = panel.querySelector('#ppg-layout-pending');
    change(pending, true, 'checked');
    assert(cards.filter(card => getComputedStyle(card).display !== 'none').every(card => card.classList.contains('grtc-task--pending')), '经典版保留待刷新筛选');
    change(pending, false, 'checked');
    document.documentElement.dataset.theme = 'dark';
    assert(color('.grtc-task--available') === 'rgb(32, 59, 48)', '经典页面支持深色配色');
    window.html2canvas = async (node, options) => {
      const expectedTheme = theme.checked ? 'dark' : 'light';
      const onclone = options.onclone;
      let imageBounds;
      options.onclone = (doc, clonedGrid) => {
        onclone(doc, clonedGrid);
        const first = clonedGrid.querySelector('.grtc-task');
        const clonedClock = clonedGrid.querySelector('.ppg-layout-clock');
        const visual = first.querySelector('.grtc-task__visual').getBoundingClientRect();
        const rect = clonedGrid.getBoundingClientRect();
        imageBounds = { x: Math.round((visual.left - rect.left + 12) * options.scale),
          y: Math.round((visual.top - rect.top + 12) * options.scale), size: Math.round(visual.width * options.scale) };
        assert(visual.width === 24 && visual.height === 24
          && visual.bottom <= first.querySelector(':scope > strong').getBoundingClientRect().top, '经典长图保留24px居中图片');
        assert(doc.documentElement.dataset.theme === expectedTheme && doc.defaultView.getComputedStyle(clonedGrid).gap === '2px', '截图读取经典样式和独立截图主题');
        assert(first.querySelector('.grtc-task__class').textContent === '示例成员 升级', '复制与导出长图保留升级人姓名');
        assert(doc.defaultView.getComputedStyle(first.querySelector(':scope > strong')).textAlign === 'center' && titlesFit(clonedGrid), '截图居中内容完整换行');
        assert([...clonedClock.querySelectorAll('.ppg-time-card > span')].map(node => node.textContent).join(',')
          === '同步时间,下次任务刷新,截图时间', '经典长图使用新版三时间方案');
        assert([...clonedClock.children].every(card => Math.abs(card.getBoundingClientRect().width - first.getBoundingClientRect().width) < 1)
          && Math.abs(first.getBoundingClientRect().width - Number(maxWidth.value)) < 1, '截图时间卡片与当前任务宽度一致');
      };
      const canvas = await renderer(node, options);
      const source = cards[0].querySelector('.grtc-task__visual img');
      await source.decode();
      const expected = document.createElement('canvas');
      expected.width = expected.height = imageBounds.size;
      expected.getContext('2d').drawImage(source, 0, 0, imageBounds.size, imageBounds.size);
      const pixels = expected.getContext('2d').getImageData(0, 0, imageBounds.size, imageBounds.size).data;
      let matched = 0, tested = 0;
      for (let y = 8; y < imageBounds.size - 8; y += 6) for (let x = 8; x < imageBounds.size - 8; x += 6) {
        const offset = (y * imageBounds.size + x) * 4;
        if (pixels[offset + 3] < 254) continue;
        const actual = canvas.getContext('2d').getImageData(imageBounds.x + x - 2, imageBounds.y + y - 2, 5, 5).data;
        tested++;
        if (Array.from({ length: 25 }, (_, sample) => sample * 4).some(sample =>
          [0, 1, 2].every(channel => Math.abs(actual[sample + channel] - pixels[offset + channel]) < 20))) matched++;
      }
      assert(tested >= 4 && matched / tested > .8, `PNG内含实际任务图片像素 (${matched}/${tested})`);
      if (!document.querySelector('#classic-export-preview')) {
        const preview = document.createElement('img');
        preview.id = 'classic-export-preview';
        preview.hidden = true;
        preview.src = canvas.toDataURL('image/png');
        document.body.append(preview);
      }
      return canvas;
    };
    Object.defineProperty(navigator.clipboard, 'write', { configurable: true, value: async items => {
      copies.push(await items[0].getType('image/png'));
    } });
    HTMLAnchorElement.prototype.click = function () {
      if (!this.download.startsWith('云上花匠-')) return anchorClick.call(this);
      downloads.push(fetch(this.href).then(response => response.blob()));
    };
    panel.querySelector('[data-action="close"]').click();
    await take(copy);
    const png = new DataView(await copies[0].arrayBuffer());
    assert(png.getUint32(0) === 0x89504e47 && png.getUint32(16) === 1196, '默认经典方案复制出1196px宽的2倍PNG');
    assert(document.documentElement.dataset.theme === 'dark', '浅色截图不改变深色页面');
    change(columns, '2');
    change(maxWidth, '160');
    change(minHeight, '75');
    await take(copy);
    assert(new DataView(await copies[1].arrayBuffer()).getUint32(16) === 692, '自定义两列160px后长图宽度同步更新');
    theme.checked = true;
    theme.dispatchEvent(new Event('change', { bubbles: true }));
    await take(panel.querySelector('#ppg-layout-export'));
    assert(downloads.length === 1 && (await downloads[0]).type === 'image/png', '经典版也可导出深色PNG');
    preset.click();
    assert((await GM.getValue('ppgarden-task-layout-v1')).cardStyle === 'classic', '经典样式自动保存');
    assert(document.documentElement.scrollWidth <= innerWidth, '经典版页面没有水平溢出');
    const parent = grid.parentElement;
    const next = grid.nextSibling;
    const land = document.createElement('section');
    land.className = 'land-field';
    land.innerHTML = '<div class="land-plot land-plot--empty"><span class="land-plot__status">空地</span></div>';
    grid.remove();
    document.body.append(land);
    await new Promise(resolve => setTimeout(resolve, 20));
    assert(getComputedStyle(panel.querySelector('#ppg-layout-style-option')).display === 'none'
      && preset.hidden, '花圃隐藏任务样式和经典方案');
    land.remove();
    parent.insertBefore(grid, next);
    await new Promise(resolve => setTimeout(resolve, 20));
    assert(selectedStyle() === 'classic' && !preset.hidden, '切回任务中心保留经典版设置');
    result.textContent = `PASS ${passed.length}\n${passed.join('\n')}`;
  } catch (error) {
    result.textContent = `FAIL after ${passed.length}: ${error.message}`;
    console.error('[经典版自检]', error);
  } finally {
    window.html2canvas = renderer;
    HTMLAnchorElement.prototype.click = anchorClick;
    if (write) Object.defineProperty(navigator.clipboard, 'write', write);
    else delete navigator.clipboard.write;
    document.documentElement.dataset.theme = pageTheme;
  }
})();
