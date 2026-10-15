// 本地兼容检查：模拟 iOS 脚本管理器接口，不代表 iPhone 真机验证。
(async () => {
  const result = document.createElement('pre');
  result.id = 'ios-check-result';
  result.hidden = true;
  document.body.append(result);
  const passed = [];
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
    passed.push(message);
  };
  const tick = () => new Promise(resolve => setTimeout(resolve, 20));
  try {
    const deadline = performance.now() + 2000;
    while (!document.querySelector('#ppg-layout-open:not([hidden])') && performance.now() < deadline) await tick();
    const open = document.querySelector('#ppg-layout-open');
    assert(open && !open.hidden, '兼容接口下初始化完成：' + (document.documentElement.dataset.ppgStartupError || '无启动异常'));
    const panel = document.querySelector('#ppg-layout-panel');
    open.click();
    assert(!panel.hidden, '没有菜单 API 也能打开任务设置');
    const profile = document.documentElement.dataset.ppgApiProfile;
    const columns = panel.querySelector('#ppg-layout-columns');
    assert(columns.value === (profile === 'none' ? '3' : '4'), '正确读取异步接口或本地默认配置');
    columns.value = '5';
    columns.dispatchEvent(new Event('input', {bubbles:true}));
    await tick();
    const key = profile === 'none' ? 'ppgarden-task-layout-v1' : 'ppgarden-ios-compat-' + profile + 'ppgarden-task-layout-v1';
    assert(JSON.parse(localStorage.getItem(key)).columns === 5, '修改设置成功保存');
    panel.querySelector('[data-action="close"]').click();
    const copy = document.querySelector('#ppg-layout-quick-copy');
    assert(panel.hidden && !copy.hidden, '关闭配置后右下角复制按钮保持可用');
    copy.click();
    const copyDeadline = performance.now() + 30000;
    while (copy.disabled && performance.now() < copyDeadline) await tick();
    const status = document.querySelector('#ppg-layout-quick-status');
    assert(!copy.disabled && status.textContent.includes('已复制到剪贴板'), '兼容接口下仍可生成并复制高清长图');
    assert(window.quickCopyPreviewResult?.type === 'image/png' && window.quickCopyPreviewResult.bytes > 1000, '剪贴板收到实际生成的有效PNG');
    assert(document.documentElement.dataset.ppgClipboardInGesture === 'true', '在点击调用栈内提交PNG Promise，保留Safari用户操作权限');
    result.textContent = `PASS ${passed.length}\n${passed.join('\n')}`;
  } catch (error) {
    result.textContent = `FAIL: ${error.message}\n${passed.join('\n')}`;
  }
})();
