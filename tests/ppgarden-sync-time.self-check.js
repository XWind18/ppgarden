// 本地任务页检查：使用真实截图组件，拦截下载与剪贴板。
(async () => {
  const passed = [];
  const assert = (condition, label) => {
    if (!condition) throw new Error(label);
    passed.push(label);
  };
  const tick = () => new Promise(resolve => setTimeout(resolve, 20));
  const result = document.querySelector('#sync-check-result');
  const grid = document.querySelector('.grtc-grid');
  const source = document.querySelector('.grtc-page .grtc-hero__head > span');
  const sourceParent = source.parentElement;
  const exportButton = document.querySelector('#ppg-layout-export');
  const quickCopy = document.querySelector('#ppg-layout-quick-copy');
  const renderer = window.html2canvas;
  const anchorClick = HTMLAnchorElement.prototype.click;
  const originalWrite = Object.getOwnPropertyDescriptor(navigator.clipboard, 'write');
  const downloads = [];
  const copied = [];
  const clock = grid.previousElementSibling;
  const value = (root, key) => root.querySelector(`[data-clock="${key}"] > strong`)?.textContent;
  const milliseconds = text => new Date(text.replace(' ', 'T')).getTime();
  const expectRefresh = (seconds, label) => assert(
    Math.abs(milliseconds(value(clock, 'refresh')) - milliseconds(value(clock, 'current')) - seconds * 1000) <= 1000, label);
  let expectedSync;
  const capture = async copy => {
    expectedSync = source.textContent.replace('最近同步：', '');
    (copy ? quickCopy : exportButton).click();
    const deadline = performance.now() + 30000;
    while (exportButton.disabled && performance.now() < deadline) await tick();
    assert(!exportButton.disabled && document.querySelector('#ppg-layout-export-status').textContent.includes(copy ? '已复制' : '已导出'),
      copy ? '复制长图成功' : '导出长图成功');
    const blob = copy ? copied.at(-1) : await downloads.at(-1);
    const header = new DataView(await blob.arrayBuffer());
    assert(header.getUint32(0) === 0x89504e47 && header.getUint32(16) > 0 && header.getUint32(20) > 0, '生成有效 PNG');
    return blob;
  };

  try {
    assert(value(clock, 'sync') === '10/15 10:00:00', '读取当前花园的同步时间');
    assert([...clock.querySelectorAll('.ppg-time-card > span')].map(label => label.textContent).join(',')
      === '同步时间,下次任务刷新,当前时间', '顶部依次显示三张时间卡片');
    assert(document.querySelector('[data-field="image"]').checked, '默认配置勾选任务图片');
    source.firstChild.data = '最近同步：10/15 10:01:00';
    await tick();
    assert(value(clock, 'sync') === '10/15 10:01:00', '原页面同步时间变化后自动更新');
    source.remove();
    await tick();
    assert(value(clock, 'sync') === '未获取', '无同步时间时明确显示未获取');
    sourceParent.append(source);
    await tick();
    assert(value(clock, 'sync') === '10/15 10:01:00', '同步字段重新出现后自动恢复');
    assert(value(clock, 'refresh') === '暂无待刷新任务', '没有待刷新任务时明确显示空状态');
    const cards = [...grid.querySelectorAll('.grtc-task')].slice(0, 3);
    const timers = cards.map(card => card.querySelector('.grtc-card-status__time strong'));
    for (let index = 0; index < cards.length; index++) {
      cards[index].classList.add('grtc-task--pending');
      timers[index].textContent = ['12:15', '01:23:45', '00:30'][index];
    }
    await tick();
    expectRefresh(30, '从全部待刷新任务选择最近的刷新时间');
    cards[2].style.setProperty('display', 'none', 'important');
    const timeField = document.querySelector('[data-field="time"]');
    timeField.checked = false;
    timeField.dispatchEvent(new Event('input', { bubbles: true }));
    await tick();
    expectRefresh(30, '隐藏卡片和倒计时后仍读取最近刷新时间');
    cards[2].style.removeProperty('display');
    timeField.checked = true;
    timeField.dispatchEvent(new Event('input', { bubbles: true }));
    cards[1].classList.remove('grtc-task--pending');
    cards[2].classList.remove('grtc-task--pending');
    for (const [text, seconds] of [['12:15', 735], ['01:23:45', 5025], ['25:00:00', 90000], ['125:04', 7504], ['00:00', 0]]) {
      timers[0].textContent = text;
      await tick();
      expectRefresh(seconds, `正确换算倒计时 ${text}，支持小时和跨天`);
    }
    for (const text of ['', '加载中', '1:99', '12:34:99', '999999999999999999999999999:00']) {
      timers[0].textContent = text;
      await tick();
      assert(value(clock, 'refresh') === '未获取', `无效倒计时 ${text || '空值'} 不产生错误日期`);
    }
    const timerParent = timers[0].parentElement;
    timers[0].remove();
    await tick();
    assert(value(clock, 'refresh') === '未获取', '缺少倒计时节点时正常降级');
    timerParent.append(timers[0]);
    timers[0].textContent = '00:30';
    await tick();
    expectRefresh(30, '倒计时恢复后自动恢复刷新时间');
    const land = document.createElement('section');
    land.className = 'land-board';
    land.innerHTML = '<div class="land-board__freshness"><span>2 分钟前同步</span></div><div class="land-field"></div>';
    document.body.append(land);
    await tick();
    assert(land.querySelector('.land-field').previousElementSibling.textContent.startsWith('同步时间：2 分钟前 ｜ 当前时间：'),
      '花圃保留页面提供的相对同步时间');
    land.remove();
    window.html2canvas = async (node, options) => {
      const onclone = options.onclone;
      options.onclone = (doc, clonedGrid) => {
        onclone(doc, clonedGrid);
        const timestamp = clonedGrid.querySelector(':scope > .ppg-layout-clock--task');
        assert([...timestamp.querySelectorAll('.ppg-time-card > span')].map(label => label.textContent).join(',')
          === '同步时间,下次任务刷新,截图时间', '长图依次展示同步、下次刷新和截图时间');
        assert(value(timestamp, 'sync') === expectedSync, '长图保留原页面的同步时间');
        assert(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value(timestamp, 'current')), '保留完整截图时间');
        assert(milliseconds(value(timestamp, 'refresh')) - milliseconds(value(timestamp, 'current')) === 30000,
          '刷新时间按本次截图时间计算并固定在图中');
        const taskWidth = clonedGrid.querySelector('.grtc-task').getBoundingClientRect().width;
        assert([...timestamp.children].every(card => Math.abs(card.getBoundingClientRect().width - taskWidth) < 1),
          '三张时间卡片分别与当前任务卡片等宽');
        assert(timestamp.scrollWidth <= timestamp.clientWidth + 1
          && [...timestamp.querySelectorAll('strong')].every(text => text.scrollWidth <= text.clientWidth + 1), '时间卡片文字完整且无水平溢出');
        assert(timestamp.getBoundingClientRect().bottom - clonedGrid.getBoundingClientRect().top <= options.height - 12,
          '时间行完整包含在长图尺寸中');
      };
      return renderer(node, options);
    };
    HTMLAnchorElement.prototype.click = function () {
      if (!this.download.startsWith('云上花匠-')) return anchorClick.call(this);
      downloads.push(fetch(this.href).then(response => response.blob()));
    };
    Object.defineProperty(navigator.clipboard, 'write', { configurable: true, value: async items => {
      copied.push(await items[0].getType('image/png'));
    } });
    const firstBlob = await capture(false);
    const columns = document.querySelector('#ppg-layout-columns');
    columns.value = '1';
    columns.dispatchEvent(new Event('input', { bubbles: true }));
    await capture(true);
    columns.value = '3';
    columns.dispatchEvent(new Event('input', { bubbles: true }));
    const preview = document.createElement('img');
    preview.id = 'sync-check-image';
    preview.alt = 'PNG 预览：三张等宽时间卡片';
    preview.style.cssText = 'display:block;max-width:100%;height:auto;margin-top:20px;';
    preview.src = URL.createObjectURL(firstBlob);
    document.querySelector('main').append(preview);
    await preview.decode();
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
