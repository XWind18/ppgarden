// 在带真实截图组件和 GM 存储替身的本地任务页面中运行；复制与下载均拦截。
(async () => {
  const passed = [];
  const assert = (condition, label) => {
    if (!condition) throw new Error(label);
    passed.push(label);
  };
  const tick = () => new Promise(resolve => setTimeout(resolve, 20));
  const output = document.querySelector('#scale-check-result');
  const key = 'ppgarden-screenshot-scale-v1';
  const scale = document.querySelector('#ppg-layout-scale');
  const exportButton = document.querySelector('#ppg-layout-export');
  const quickCopy = document.querySelector('#ppg-layout-quick-copy');
  const status = document.querySelector('#ppg-layout-export-status');
  const renderer = window.html2canvas;
  const anchorClick = HTMLAnchorElement.prototype.click;
  const clipboardWrite = Object.getOwnPropertyDescriptor(navigator.clipboard, 'write');
  const renders = [];
  const downloads = [];
  const copies = [];
  let expectedScale;
  const choose = value => {
    scale.value = value;
    scale.dispatchEvent(new Event('input', { bubbles: true }));
    scale.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const changeLayout = (id, value) => {
    const input = document.querySelector(id);
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const take = async (copy = false, nextScale) => {
    expectedScale = Number(scale.value);
    (copy ? quickCopy : exportButton).click();
    document.querySelector('#ppg-layout-sync-warning:not([hidden]) [data-warning="continue"]')?.click();
    if (nextScale !== undefined) choose(nextScale);
    const deadline = performance.now() + 30000;
    while (exportButton.disabled && performance.now() < deadline) await tick();
    assert(!exportButton.disabled && !/失败/.test(status.textContent), '截图完成并恢复按钮');
    return renders[renders.length - 1];
  };
  const pngSize = async blob => {
    const data = new DataView(await blob.arrayBuffer());
    assert(data.getUint32(0) === 0x89504e47, '生成有效 PNG');
    return [data.getUint32(16), data.getUint32(20)];
  };

  try {
    document.querySelector('#ppg-layout-open').click();
    assert(scale && !scale.closest('.ppg-export').hidden, '任务设置提供清晰度倍数选择');
    assert(scale.type === 'number' && scale.min === '1' && scale.max === '3' && scale.step === 'any', '允许输入 1–3 倍及自定义小数');
    const params = new URLSearchParams(location.search);
    if (params.has('resume')) {
      const expected = params.has('invalid') ? '2' : '1.25';
      assert(scale.value === expected, params.has('invalid') ? '旧版越界存储值回退为默认 2 倍' : '刷新后读取已保存的 1.25 倍设置');
      output.textContent = `PASS ${passed.length}\n${passed.join('\n')}`;
      return;
    }
    assert(scale.value === '2', '默认采用 2 倍');
    const layoutBefore = JSON.stringify(await GM.getValue('ppgarden-task-layout-v1', {}));
    window.html2canvas = async (node, options) => {
      const onclone = options.onclone;
      options.onclone = (doc, grid) => {
        onclone(doc, grid);
        const expected = Math.min(expectedScale, 16000 / options.width, 16000 / options.height,
          Math.sqrt(32000000 / options.width / options.height));
        assert(Math.abs(options.scale - expected) < 1e-8, '实际渲染倍数符合所选值和尺寸限制');
      };
      const canvas = await renderer(node, options);
      renders.push({ width: canvas.width, height: canvas.height, scale: options.scale });
      return canvas;
    };
    HTMLAnchorElement.prototype.click = function () {
      if (!this.download.startsWith('云上花匠-')) return anchorClick.call(this);
      downloads.push(fetch(this.href).then(response => response.blob()));
    };
    Object.defineProperty(navigator.clipboard, 'write', { configurable: true, value: async items => {
      copies.push(await items[0].getType('image/png'));
    } });

    choose('1');
    await tick();
    assert(await GM.getValue(key) === 1, '异步 GM 接口保存倍数');
    assert(JSON.stringify(await GM.getValue('ppgarden-task-layout-v1', {})) === layoutBefore, '修改倍数不改写卡片布局');
    const first = await take();
    assert(status.textContent.includes('1 倍分辨率') && !status.textContent.includes('图片过长'), '正常 1 倍图片提示所选清晰度');
    const firstPng = await pngSize(await downloads[0]);
    assert(firstPng[0] === first.width && firstPng[1] === first.height, '下载 PNG 尺寸与渲染一致');

    choose('1.5');
    const second = await take(true, '3');
    const copiedPng = await pngSize(copies[0]);
    assert(Math.abs(second.width - first.width * 1.5) < 1 && Math.abs(second.height - first.height * 1.5) < 1,
      '复制使用自定义 1.5 倍分辨率，渲染中调整设置不改变本次截图');
    assert(copiedPng[0] === second.width && copiedPng[1] === second.height && status.textContent.includes('1.5 倍分辨率'),
      '复制 PNG 尺寸和结果提示使用本次截图倍数');
    const third = await take();
    assert(third.width === first.width * 3 && third.height === first.height * 3, '3 倍上限作用于实际 PNG 尺寸');

    for (const value of ['0.9', '3.1', '', 'NaN', 'Infinity']) {
      choose(value);
      assert(scale.value === '3' && await GM.getValue(key) === 3, `忽略无效输入 ${value || '空值'}，保留已保存的倍数`);
    }
    changeLayout('#ppg-layout-columns', '1');
    changeLayout('#ppg-layout-min-height', '1500');
    const capped = await take();
    assert(capped.scale >= 1 && capped.scale < 3 && Math.max(capped.width, capped.height) <= 16000
      && capped.width * capped.height <= 32000000, '超长图自动降低倍数并遵守边长和像素限制');
    assert(status.textContent.includes('图片过长，已调整为'), '自动降低倍数后显示实际清晰度');
    changeLayout('#ppg-layout-columns', '3');
    changeLayout('#ppg-layout-min-height', '60');
    scale.value = '1.25';
    scale.dispatchEvent(new Event('input', { bubbles: true }));
    await tick();
    assert(await GM.getValue(key) === 1.25, '输入自定义 1.25 倍立即保存，供刷新检查');
    output.textContent = `PASS ${passed.length}\n${passed.join('\n')}`;
  } catch (error) {
    output.textContent = `FAIL: ${error.message}\n${passed.join('\n')}`;
  } finally {
    window.html2canvas = renderer;
    HTMLAnchorElement.prototype.click = anchorClick;
    if (clipboardWrite) Object.defineProperty(navigator.clipboard, 'write', clipboardWrite);
    else delete navigator.clipboard.write;
  }
})();
