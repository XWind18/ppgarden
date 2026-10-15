// 仅在本地夹具运行：需固定定位的 .bottom-tabs、任务卡片及 #navigation-check-result。
(async () => {
  const result = document.querySelector('#navigation-check-result');
  const nav = document.querySelector('.bottom-tabs');
  const open = document.querySelector('#ppg-layout-open');
  const copy = document.querySelector('#ppg-layout-quick-copy');
  const panel = document.querySelector('#ppg-layout-panel');
  const status = document.querySelector('#ppg-layout-quick-status');
  const passed = [];
  const assert = (condition, label) => {
    if (!condition) throw new Error(label);
    passed.push(label);
  };
  const settle = () => new Promise(resolve => setTimeout(resolve, 1100));
  const checkClearance = label => {
    const menu = nav.getBoundingClientRect();
    for (const element of [open, copy]) {
      const rect = element.getBoundingClientRect();
      assert(rect.bottom <= menu.top - 8, `${label}：${element.textContent}避开底部菜单`);
      assert(rect.top >= 0 && rect.right <= innerWidth, `${label}：按钮位于屏幕内`);
    }
    assert(copy.getBoundingClientRect().bottom < open.getBoundingClientRect().top, `${label}：两个按钮互不遮挡`);
  };
  const originalStyle = nav.getAttribute('style');
  try {
    if (innerWidth > 600) {
      assert(nav.getBoundingClientRect().height === 0, '桌面隐藏底部菜单');
      assert(Math.abs(innerHeight - open.getBoundingClientRect().bottom - 20) < 1, '桌面保留20px底部间距');
      assert(Math.abs(innerHeight - copy.getBoundingClientRect().bottom - 76) < 1, '桌面保留复制按钮位置');
    } else {
      checkClearance('默认菜单');
      const menuItem = nav.querySelector('button:last-child');
      const itemRect = menuItem.getBoundingClientRect();
      assert(menuItem.contains(document.elementFromPoint(itemRect.x + itemRect.width / 2,
        itemRect.y + itemRect.height / 2)), '「我的」菜单点击区域未被悬浮按钮遮住');
      open.click();
      assert(!panel.hidden && panel.getBoundingClientRect().top >= 16
        && panel.getBoundingClientRect().bottom < copy.getBoundingClientRect().top, '设置窗完整显示在复制按钮上方');
      panel.querySelector('[data-action="close"]').click();
      status.textContent = '本地测试提示';
      await settle();
      assert(!status.hidden && status.getBoundingClientRect().bottom < copy.getBoundingClientRect().top,
        '截图状态提示也避开按钮和菜单');
      status.textContent = '';
      nav.style.height = '96px';
      await settle();
      checkClearance('菜单变高');
      nav.style.bottom = '18px';
      await settle();
      checkClearance('菜单上移');
      nav.hidden = true;
      await settle();
      assert(Math.abs(innerHeight - open.getBoundingClientRect().bottom - 20) < 1, '菜单隐藏后恢复正常底部间距');
      nav.hidden = false;
      await settle();
      checkClearance('菜单重新显示');
      nav.style.display = 'none';
      await settle();
      assert(Math.abs(innerHeight - open.getBoundingClientRect().bottom - 20) < 1, '行内样式隐藏菜单后恢复位置');
      nav.style.removeProperty('display');
      nav.remove();
      await settle();
      assert(Math.abs(innerHeight - open.getBoundingClientRect().bottom - 20) < 1, '移除导航后恢复位置');
      document.body.append(nav);
      await settle();
      checkClearance('动态插入菜单');
    }
    result.textContent = `PASS ${passed.length}\n${passed.join('\n')}`;
  } catch (error) {
    result.textContent = `FAIL after ${passed.length}: ${error.message}`;
    console.error('[导航自检]', error);
  } finally {
    status.textContent = '';
    nav.hidden = false;
    if (originalStyle === null) nav.removeAttribute('style');
    else nav.setAttribute('style', originalStyle);
  }
})();
