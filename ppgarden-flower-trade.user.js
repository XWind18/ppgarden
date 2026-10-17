// ==UserScript==
// @name         云上花匠 · 花朵交易助手
// @namespace    https://ppgarden.top/
// @version      1.0.1
// @description  在花朵交易页用独立悬浮窗，按账号、每组出价从高到低列出可交易花朵、实得时长、库存和可卖组数。
// @homepageURL  https://github.com/XWind18/ppgarden
// @supportURL   https://github.com/XWind18/ppgarden/issues
// @updateURL    https://raw.githubusercontent.com/XWind18/ppgarden/main/ppgarden-flower-trade.meta.js
// @downloadURL  https://raw.githubusercontent.com/XWind18/ppgarden/main/ppgarden-flower-trade.user.js
// @match        https://ppgarden.top/*
// @run-at       document-end
// @grant        none
// @noframes
// ==/UserScript==

(() => {
  'use strict';
  if (document.getElementById('ppg-trade-open')) return;

  const style = document.createElement('style');
  style.id = 'ppg-trade-style';
  style.textContent = `
    #ppg-trade-open, #ppg-trade-panel {
      --pt-bg: var(--paper-card, #fff); --pt-ink: var(--ink, #24382f);
      --pt-muted: var(--ink-muted, #63736b); --pt-line: var(--paper-line, #dce5df);
      --pt-inner: var(--paper-inner, #f4f7f4); --pt-green: #356b55;
      --pt-bottom: max(calc(16px + env(safe-area-inset-bottom, 0px)), calc(var(--ppg-trade-nav-bottom, 0px) + 12px));
      box-sizing: border-box; color: var(--pt-ink); font: 14px/1.5 system-ui, -apple-system, sans-serif;
    }
    :root[data-theme="dark"] :is(#ppg-trade-open, #ppg-trade-panel) {
      --pt-bg: var(--paper-card, #202b27); --pt-ink: var(--ink, #edf3ee);
      --pt-muted: var(--ink-muted, #b0beb5); --pt-line: var(--paper-line, #3d4a42);
      --pt-inner: var(--paper-inner, #29352e); --pt-green: #9ed4b3;
    }
    #ppg-trade-open[hidden], #ppg-trade-panel[hidden] { display: none !important; }
    #ppg-trade-open {
      position: fixed; right: 16px; bottom: var(--pt-bottom); z-index: 2147483644;
      min-height: 44px; padding: 10px 16px; border: 1px solid #356b55; border-radius: 24px;
      background: #356b55; color: #fff; font-weight: 650; cursor: pointer; box-shadow: 0 4px 18px #0002;
    }
    #ppg-trade-panel {
      position: fixed; right: 16px; bottom: calc(var(--pt-bottom) + 56px); z-index: 2147483645;
      display: flex; flex-direction: column; width: min(540px, calc(100vw - 32px));
      max-height: min(720px, calc(100dvh - var(--pt-bottom) - 80px));
      margin: 0; border: 1px solid var(--pt-line); border-radius: 18px;
      background: var(--pt-bg); box-shadow: 0 18px 64px #0004; overflow: hidden; text-align: left;
    }
    #ppg-trade-panel * { box-sizing: border-box; }
    #ppg-trade-panel header { display: flex; align-items: center; gap: 8px; padding: 14px 16px 8px; }
    #ppg-trade-panel h2 { flex: 1; min-width: 0; margin: 0; font: 650 18px/1.4 system-ui, sans-serif; color: inherit; }
    #ppg-trade-panel button {
      flex: none; min-height: 44px; margin: 0; padding: 8px 12px; border: 1px solid var(--pt-line);
      border-radius: 10px; background: var(--pt-bg); color: inherit; font: 600 13px/1.4 system-ui, sans-serif; cursor: pointer;
    }
    #ppg-trade-panel [data-trade="close"] { width: 44px; padding: 0; border: 0; font-size: 24px; color: var(--pt-muted); }
    #ppg-trade-panel button:disabled { opacity: .55; cursor: wait; }
    :is(#ppg-trade-open, #ppg-trade-panel button, #ppg-trade-panel summary):focus-visible {
      outline: 2px solid var(--pt-green); outline-offset: 2px;
    }
    #ppg-trade-status { margin: 0; padding: 0 16px 12px; color: var(--pt-muted); font-size: 12px; overflow-wrap: anywhere; }
    #ppg-trade-status[data-error="true"] { color: #a35519; }
    :root[data-theme="dark"] #ppg-trade-status[data-error="true"] { color: #f2bd84; }
    #ppg-trade-results { min-height: 60px; overflow: auto; overscroll-behavior: contain; padding: 0 12px 12px; }
    #ppg-trade-results details { margin: 0 0 10px; border: 1px solid var(--pt-line); border-radius: 12px; overflow: hidden; }
    #ppg-trade-results details:last-child { margin-bottom: 0; }
    #ppg-trade-results summary {
      min-height: 48px; padding: 12px; background: var(--pt-inner); cursor: pointer; overflow-wrap: anywhere;
    }
    #ppg-trade-results summary strong { font-size: 14px; font-weight: 650; }
    #ppg-trade-results summary small { margin-left: 8px; color: var(--pt-muted); font-size: 12px; }
    #ppg-trade-results ul { padding: 0; margin: 0; list-style: none; }
    #ppg-trade-results li { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 8px; padding: 11px 12px; }
    #ppg-trade-results li + li { border-top: 1px solid var(--pt-line); }
    #ppg-trade-results .pt-name { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px; min-width: 0; }
    #ppg-trade-results .pt-name b { font-size: 14px; font-weight: 600; overflow-wrap: anywhere; }
    #ppg-trade-results .pt-quality { color: var(--pt-green); font-size: 11px; white-space: nowrap; }
    #ppg-trade-results .pt-stock { display: block; margin-top: 4px; font-size: 12px; color: var(--pt-muted); overflow-wrap: anywhere; }
    #ppg-trade-results .pt-price { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    #ppg-trade-results .pt-price strong { font-size: 19px; line-height: 1.2; color: var(--pt-green); }
    #ppg-trade-results .pt-price span { margin-left: 3px; color: var(--pt-muted); font-size: 10px; }
    #ppg-trade-results .pt-price small { display: block; margin-top: 4px; font-size: 11px; color: var(--pt-muted); }
    #ppg-trade-results p { margin: 0; padding: 14px 12px; font-size: 12px; color: var(--pt-muted); overflow-wrap: anywhere; }
    #ppg-trade-panel footer { padding: 10px 16px; border-top: 1px solid var(--pt-line); color: var(--pt-muted); font-size: 11px; }
    @media (max-width: 600px) {
      #ppg-trade-panel { right: 12px; width: calc(100vw - 24px); }
      #ppg-trade-panel header { padding: 10px 12px 6px; }
      #ppg-trade-panel h2 { font-size: 17px; }
      #ppg-trade-results li { padding: 10px; }
    }
  `;
  const openButton = document.createElement('button');
  openButton.id = 'ppg-trade-open';
  openButton.type = 'button';
  openButton.textContent = '可交易花朵';
  openButton.hidden = true;
  openButton.setAttribute('aria-haspopup', 'dialog');
  openButton.setAttribute('aria-controls', 'ppg-trade-panel');
  openButton.setAttribute('aria-expanded', 'false');
  const panel = document.createElement('div');
  panel.id = 'ppg-trade-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'false');
  panel.setAttribute('aria-labelledby', 'ppg-trade-title');
  panel.innerHTML = `
    <header><h2 id="ppg-trade-title">可交易花朵</h2><button type="button" data-trade="refresh">刷新列表</button><button type="button" data-trade="close" aria-label="关闭交易悬浮窗">×</button></header>
    <p id="ppg-trade-status" role="status" aria-live="polite">按账号分组 · 每组出价从高到低</p>
    <div id="ppg-trade-results" aria-busy="false"></div>
    <footer>基于本次返回的求购与库存。同花同品质显示可成交的最高出价；各花组数单独核算，成交前以网站核验为准。</footer>
  `;
  document.head.append(style);
  document.body.append(openButton, panel);
  const status = panel.querySelector('#ppg-trade-status');
  const results = panel.querySelector('#ppg-trade-results');
  const refreshButton = panel.querySelector('[data-trade="refresh"]');
  let controller;
  let previousFocus;

  const positiveInt = value => Number.isSafeInteger(value) && value > 0;
  const nonnegativeInt = value => Number.isSafeInteger(value) && value >= 0;
  const flowerKey = item => `${item.flowerId}:${item.quality}`;
  const qualityNames = ['', '凡品', '普品', '珍品', '华品', '仙品'];

  function textElement(tag, text, className) {
    const node = document.createElement(tag);
    node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  async function readJSON(path, signal) {
    const request = new AbortController();
    const abort = () => request.abort();
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) request.abort();
    const timeout = setTimeout(abort, 15000);
    try {
      const response = await fetch(path, { method: 'GET', credentials: 'same-origin', cache: 'no-store',
        signal: request.signal, headers: { Accept: 'application/json' } });
      if (!response.ok) {
        const error = new Error(response.status === 401 || response.status === 403 ? '登录或交易权限已变化，请刷新网页后重试。'
          : response.status === 429 ? '读取过于频繁，请稍后再刷新列表。' : `读取失败（${response.status}），请稍后刷新列表。`);
        error.status = response.status;
        throw error;
      }
      if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('未读到交易数据，请检查登录状态。');
      return await response.json();
    } catch (error) {
      if (signal.aborted) throw error;
      if (request.signal.aborted) throw new Error('读取超时，请稍后刷新列表。');
      if (error instanceof TypeError) throw new Error('网络读取失败，请检查网络后重试。');
      throw error;
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener('abort', abort);
    }
  }

  function accountReason(meta, garden) {
    if (meta.userControl?.paused) return '全部账号交易已暂停';
    if (meta.teamWindow?.active) return '团单时段，交易暂停';
    if (meta.controlsUnavailable || garden.pause?.controlsUnavailable) return '交易状态暂时无法读取';
    if (garden.pause?.gardenControl?.paused) return '本号交易已暂停';
    return '';
  }

  function render(groups) {
    const fragment = document.createDocumentFragment();
    for (const group of groups) {
      const rows = [...group.rows.values()].filter(row => row.expiresAt > Date.now())
        .sort((a, b) => b.price - a.price || b.gets - a.gets || a.name.localeCompare(b.name, 'zh-CN'));
      const details = document.createElement('details');
      details.open = true;
      details.dataset.account = group.id;
      const summary = document.createElement('summary');
      summary.append(textElement('strong', group.name), textElement('small', group.reason || `${rows.length} 种花`));
      details.append(summary);
      if (!rows.length) {
        details.append(textElement('p', group.reason ? `${group.reason}，请在原页面处理后刷新列表。`
          : group.done ? '暂时没有符合库存、额度及买家条件的求购。' : '尚未完成核对，请刷新列表。'));
      } else {
        const list = document.createElement('ul');
        for (const row of rows) {
          const item = document.createElement('li');
          item.dataset.request = String(row.requestId);
          item.dataset.flower = row.key;
          const copy = document.createElement('div');
          const name = textElement('div', '', 'pt-name');
          name.append(textElement('b', row.name), textElement('span', qualityNames[row.quality], 'pt-quality'));
          copy.append(name, textElement('small', `库存 ${row.count.toLocaleString('zh-CN')} 朵 · 可卖 ${row.groups} 组`, 'pt-stock'));
          const price = textElement('div', '', 'pt-price');
          price.append(textElement('strong', row.price), textElement('span', '分钟/组'),
            textElement('small', `实得 ${row.gets} 分钟/组`));
          item.append(copy, price);
          list.append(item);
        }
        details.append(list);
      }
      fragment.append(details);
    }
    results.replaceChildren(fragment);
  }

  async function refresh() {
    controller?.abort();
    const run = new AbortController();
    controller = run;
    const groups = [];
    let checked = 0;
    let skipped = 0;
    let truncated = false;
    refreshButton.disabled = true;
    results.setAttribute('aria-busy', 'true');
    results.replaceChildren();
    status.dataset.error = 'false';
    status.textContent = '正在读取账号与交易状态…';
    try {
      const meta = await readJSON('/api/trade/meta', run.signal);
      if (run.signal.aborted) return;
      if (meta.allowed !== true || meta.enabled !== true) throw new Error('当前账号暂时不能使用花朵交易。');
      if (!Array.isArray(meta.gardens) || !Array.isArray(meta.flowers) || !Array.isArray(meta.channels)
        || !positiveInt(meta.limits?.groupSize)) throw new Error('交易数据格式已变化，请更新脚本。');
      const accountOrder = [...document.querySelectorAll('[data-account-row]')].map(node => node.getAttribute('data-account-row'));
      const flowers = new Map(meta.flowers.filter(item => positiveInt(item.flowerId) && qualityNames[item.quality]
        && typeof item.name === 'string').map(item => [flowerKey(item), item]));
      const ownIds = new Set(meta.gardens.map(garden => garden.gardenId));
      for (const garden of meta.gardens) {
        if (typeof garden.gardenId !== 'string' || !garden.gardenId || !meta.channels.includes(garden.channel)) continue;
        groups.push({ id: garden.gardenId, name: garden.nickname || garden.name || `账号 ${garden.gardenId}`,
          channel: garden.channel, reason: accountReason(meta, garden), rows: new Map(), done: false });
      }
      groups.sort((a, b) => {
        const index = id => accountOrder.includes(id) ? accountOrder.indexOf(id) : accountOrder.length;
        return index(a.id) - index(b.id);
      });
      render(groups);
      for (const channel of new Set(groups.filter(group => !group.reason).map(group => group.channel))) {
        const channelGroups = groups.filter(group => group.channel === channel && !group.reason);
        const query = new URLSearchParams({ channel });
        const [board, ...stocks] = await Promise.all([
          readJSON(`/api/trade/requests?${query}`, run.signal),
          ...channelGroups.map(group => readJSON(`/api/trade/listings?${new URLSearchParams({ gardenId: group.id })}`, run.signal)),
        ]);
        if (run.signal.aborted) return;
        if (!Array.isArray(board.items) || stocks.some((stock, index) => !Array.isArray(stock.items)
          || stock.gardenId !== channelGroups[index].id || stock.channel !== channel)) {
          throw new Error('库存或求购数据格式已变化，请更新脚本。');
        }
        truncated ||= board.openTruncated === true;
        // 自动出售的开关和可售组数不适用于手动接求购；先按仓库数量筛选，再以 sell-quote 核验。
        const stocked = new Set(stocks.flatMap(stock => stock.items).filter(item => positiveInt(item.flowerId)
          && qualityNames[item.quality] && nonnegativeInt(item.count) && item.count >= meta.limits.groupSize).map(flowerKey));
        const seen = new Set();
        const candidates = board.items.filter(item => {
          if (!positiveInt(item.id) || seen.has(item.id)) return false;
          seen.add(item.id);
          return item.channel === channel && item.mine === false && !ownIds.has(item.buyerGardenId)
            && item.status === 'open' && Number.isFinite(item.expiresAt) && item.expiresAt > Date.now()
            && positiveInt(item.pricePerGroup) && positiveInt(item.groups) && !item.pausedReason
            && !item.buyerPlaying && !item.buyerQueueFull && !item.progress?.satisfied && !item.progress?.reached
            && stocked.has(flowerKey(item)) && flowers.has(flowerKey(item));
        }).sort((a, b) => b.pricePerGroup - a.pricePerGroup || a.expiresAt - b.expiresAt);
        for (let index = 0; index < candidates.length; index++) {
          const item = candidates[index];
          status.textContent = `正在核对 ${channelGroups.length} 个账号 · 求购 ${index + 1}/${candidates.length}…`;
          let quote;
          try {
            quote = await readJSON(`/api/trade/requests/${item.id}/sell-quote`, run.signal);
          } catch (error) {
            if (error.status === 404 || error.status === 409) { skipped++; continue; }
            throw error;
          }
          if (run.signal.aborted) return;
          if (quote.requestId !== item.id || !positiveInt(quote.pricePerGroup) || !nonnegativeInt(quote.sellerGetsPerGroup)
            || typeof quote.paused !== 'boolean' || !Array.isArray(quote.sellers)
            || (quote.remainingGroups != null && !nonnegativeInt(quote.remainingGroups))) {
            throw new Error('成交核验数据格式已变化，请更新脚本。');
          }
          checked++;
          if (quote.paused || quote.remainingGroups === 0) continue;
          for (const seller of quote.sellers) {
            const group = channelGroups.find(group => group.id === seller.gardenId);
            if (!group || seller.snapshotMissing !== false || seller.blockCode || seller.blockText
              || !positiveInt(seller.groups) || !positiveInt(seller.sellableGroups) || !nonnegativeInt(seller.haveCount)) continue;
            const available = Math.min(seller.groups, seller.sellableGroups, quote.remainingGroups ?? Infinity,
              Math.floor(seller.haveCount / meta.limits.groupSize));
            if (available < 1) continue;
            const key = flowerKey(item);
            const previous = group.rows.get(key);
            if (previous && (previous.price > quote.pricePerGroup
              || previous.price === quote.pricePerGroup && previous.groups >= available)) continue;
            group.rows.set(key, { key, requestId: item.id, name: flowers.get(key).name, quality: item.quality,
              price: quote.pricePerGroup, gets: quote.sellerGetsPerGroup, groups: available,
              count: seller.haveCount, expiresAt: item.expiresAt });
          }
        }
        channelGroups.forEach(group => { group.done = true; });
      }
      if (run.signal.aborted) return;
      render(groups);
      const count = results.querySelectorAll('li').length;
      const at = new Date().toLocaleTimeString('zh-CN', { hour12: false });
      status.textContent = `${groups.length} 个账号 · ${count} 项可交易 · 按出价降序 · ${at} 更新`
        + (checked ? ` · 已核验 ${checked} 张求购` : '')
        + (skipped ? ` · ${skipped} 张求购已变动，未列入` : '')
        + (truncated ? ' · 网站返回的求购不完整，结果仅覆盖已返回部分' : '');
      if (!groups.length) status.textContent = '没有读取到可用的游戏账号，请确认账号已绑定。';
      if (truncated || skipped) status.dataset.error = 'true';
    } catch (error) {
      if (run.signal.aborted) return;
      render(groups);
      status.dataset.error = 'true';
      status.textContent = `读取未完成：${error.message || '请稍后重试。'}`
        + (results.querySelector('li') ? ' 下方是部分核验结果，请刷新后查看完整列表。' : '');
    } finally {
      if (controller === run) {
        controller = null;
        refreshButton.disabled = false;
        results.setAttribute('aria-busy', 'false');
      }
    }
  }

  function close() {
    controller?.abort();
    panel.hidden = true;
    openButton.setAttribute('aria-expanded', 'false');
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  }
  openButton.addEventListener('click', () => {
    if (!panel.hidden) { close(); return; }
    previousFocus = document.activeElement;
    panel.hidden = false;
    openButton.setAttribute('aria-expanded', 'true');
    panel.querySelector('[data-trade="close"]').focus({ preventScroll: true });
    refresh();
  });
  panel.querySelector('[data-trade="close"]').addEventListener('click', close);
  refreshButton.addEventListener('click', refresh);
  panel.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); close(); }
  });

  // shortcut: 选择器与读取接口对应当前网站结构，网站改版时需重新核对。
  function syncPage() {
    const onTradePage = !!document.querySelector('.trd-page');
    const siteDialogOpen = [...document.querySelectorAll('.garden-account-overlay[data-open="true"], dialog[open], .trd-sheet__panel')]
      .some(node => node.getBoundingClientRect().height > 0);
    openButton.hidden = !onTradePage || siteDialogOpen;
    if ((!onTradePage || siteDialogOpen) && !panel.hidden) close();
    const nav = document.querySelector('.bottom-tabs');
    if (nav !== watchedNav) {
      navObserver.disconnect();
      if (nav) navObserver.observe(nav);
      watchedNav = nav;
    }
    const rect = nav?.getBoundingClientRect();
    const height = rect && rect.height > 0 && rect.top < innerHeight && rect.bottom > 0
      && getComputedStyle(nav).visibility !== 'hidden' ? Math.ceil(innerHeight - Math.max(0, rect.top)) : 0;
    document.documentElement.style.setProperty('--ppg-trade-nav-bottom', `${height}px`);
  }
  let syncFrame = 0;
  function scheduleSync() {
    if (!syncFrame) syncFrame = requestAnimationFrame(() => { syncFrame = 0; syncPage(); });
  }
  new MutationObserver(records => {
    if (records.some(record => {
      const target = record.target.nodeType === Node.ELEMENT_NODE ? record.target : record.target.parentElement;
      return !target?.closest('#ppg-trade-panel, #ppg-trade-open') && (record.type !== 'attributes'
        || target?.matches('.bottom-tabs, .garden-account-overlay, dialog'));
    })) scheduleSync();
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['open', 'data-open', 'hidden', 'class', 'style'] });
  const navObserver = new ResizeObserver(scheduleSync);
  let watchedNav;
  window.addEventListener('resize', scheduleSync);
  window.addEventListener('scroll', scheduleSync, { passive: true });
  window.visualViewport?.addEventListener('resize', scheduleSync);
  window.visualViewport?.addEventListener('scroll', scheduleSync);
  syncPage();
})();
