// 带图截图回归检查：真实资源、屏幕外懒加载、实际 PNG 像素。
(async () => {
  const results = [];
  const assert = (value, label) => {
    if (!value) throw new Error(label);
    results.push(label);
  };
  const originalRenderer = window.html2canvas;
  const originalClick = HTMLAnchorElement.prototype.click;
  let canvas, imageBounds, download;
  window.html2canvas = async (node, options) => {
    const onclone = options.onclone;
    options.onclone = async (doc, grid) => {
      await onclone(doc, grid);
      const image = grid.querySelector('.grtc-task__visual img');
      const rect = image.getBoundingClientRect();
      const root = grid.getBoundingClientRect();
      imageBounds = {
        x: Math.round((rect.left - root.left + 12) * options.scale),
        y: Math.round((rect.top - root.top + 12) * options.scale),
        width: Math.round(rect.width * options.scale), height: Math.round(rect.height * options.scale),
      };
      assert(doc.documentElement.dataset.theme === 'light', '深色页面的截图仍使用浅色');
    };
    canvas = await originalRenderer(node, options);
    return canvas;
  };
  HTMLAnchorElement.prototype.click = function () {
    if (!this.download.startsWith('云上花匠-')) return originalClick.call(this);
    download = fetch(this.href).then(response => response.blob());
  };
  try {
    document.querySelector('#ppg-layout-open').click();
    document.querySelector('[data-action="preset"]').click();
    assert(document.querySelector('[data-field="image"]').checked, '一键截图方案保留任务图片');
    assert(document.querySelector('#ppg-layout-columns').value === '3' && document.querySelector('#ppg-layout-max-width').value === '190' && document.querySelector('#ppg-layout-min-height').value === '60', '截图方案采用3列190px60px');
    assert(!document.querySelector('#ppg-layout-pending').checked && document.querySelector('[data-field="by"]').checked && document.querySelector('[data-field="progress"]').checked, '截图方案展示接取人和进度且不限定待刷新');
    const theme = document.querySelector('#ppg-layout-theme');
    assert(document.documentElement.dataset.theme === 'dark' && !theme.checked, '一键截图方案选择浅色截图并保留深色页面');
    const source = document.querySelector('.grtc-task__visual img');
    assert(source.getBoundingClientRect().top > innerHeight, '图片位于屏幕下方的懒加载区域');
    const button = document.querySelector('#ppg-layout-export');
    button.click();
    document.querySelector('#ppg-layout-sync-warning:not([hidden]) [data-warning="continue"]')?.click();
    const deadline = performance.now() + 20000;
    while (button.disabled && performance.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert(!button.disabled && download && !document.querySelector('#ppg-layout-export-status').textContent.includes('失败'), '实际带图PNG生成成功');
    assert(document.documentElement.dataset.theme === 'dark' && !theme.checked, '截图完成后页面保持深色，截图主题为浅色');
    const reference = new Image();
    reference.crossOrigin = 'anonymous';
    reference.referrerPolicy = 'no-referrer';
    reference.src = source.src;
    await reference.decode();
    const image = document.createElement('img');
    image.id = 'image-check-result'; image.hidden = true; image.src = canvas.toDataURL();
    document.body.append(image);
    const expected = document.createElement('canvas');
    expected.width = imageBounds.width;
    expected.height = imageBounds.height;
    expected.getContext('2d').drawImage(reference, 0, 0, expected.width, expected.height);
    const pixels = expected.getContext('2d').getImageData(0, 0, expected.width, expected.height).data;
    let matched = 0, tested = 0;
    for (let y = 8; y < expected.height - 8; y += 6) for (let x = 8; x < expected.width - 8; x += 6) {
      const offset = (y * expected.width + x) * 4;
      if (pixels[offset + 3] < 254) continue;
      const actual = canvas.getContext('2d').getImageData(imageBounds.x + x - 2, imageBounds.y + y - 2, 5, 5).data;
      tested++;
      // 图片缩放和定位有亚像素差异，允许两像素范围内的采样偏移。
      if (Array.from({ length: 25 }, (_, sample) => sample * 4).some(sample => [0, 1, 2].every(channel => Math.abs(actual[sample + channel] - pixels[offset + channel]) < 20))) matched++;
    }
    assert(tested > 10 && matched / tested > .8, `PNG内真实图片像素匹配资源，不是空白图片框 (${matched}/${tested}; ${JSON.stringify(imageBounds)}; 资源 ${reference.naturalWidth}×${reference.naturalHeight})`);
    const blob = await download;
    const reader = new FileReader();
    const dataURL = await new Promise((resolve, reject) => {
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    image.src = dataURL;
    document.querySelector('#check-result').textContent = `PASS ${results.length}\n${results.join('\n')}`;
  } catch (error) {
    document.querySelector('#check-result').textContent = `FAIL: ${error.message}\n${results.join('\n')}`;
  } finally {
    window.html2canvas = originalRenderer;
    HTMLAnchorElement.prototype.click = originalClick;
  }
})();
