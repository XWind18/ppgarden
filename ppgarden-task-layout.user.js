// ==UserScript==
// @name         云上花匠 · 任务卡片显示设置
// @namespace    https://ppgarden.top/
// @version      1.8.7
// @description  新版／经典版任务卡片与三张时间卡片，适配 iOS；支持高清长图导出复制、截图深浅色、卡片尺寸、信息显示与筛选。
// @homepageURL  https://github.com/XWind18/ppgarden
// @supportURL   https://github.com/XWind18/ppgarden/issues
// @updateURL    https://raw.githubusercontent.com/XWind18/ppgarden/main/ppgarden-task-layout.meta.js
// @downloadURL  https://raw.githubusercontent.com/XWind18/ppgarden/main/ppgarden-task-layout.user.js
// @match        https://ppgarden.top/*
// @require      https://cdn.jsdelivr.net/npm/html2canvas-pro@2.5.2/dist/html2canvas-pro.min.js#sha256=40d4eb47f774247870916129662e17ef0b956c9c39a3e46a0d91f55252264139
// @run-at       document-end
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.registerMenuCommand
// @noframes
// ==/UserScript==

(async () => {
  'use strict';

  async function readSetting(key, fallback) {
    try {
      if (typeof GM_getValue === 'function') return await GM_getValue(key, fallback);
      if (typeof GM !== 'undefined' && typeof GM.getValue === 'function') return await GM.getValue(key, fallback);
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch (error) {
      console.warn('[云上花匠] 读取设置失败，使用默认值', error);
      return fallback;
    }
  }

  async function writeSetting(key, value) {
    try {
      if (typeof GM_setValue === 'function') await GM_setValue(key, value);
      else if (typeof GM !== 'undefined' && typeof GM.setValue === 'function') await GM.setValue(key, value);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn('[云上花匠] 保存设置失败', error);
    }
  }

  // shortcut: 选择器对应当前页面结构，网站改版后需更新。
  const task = {
    storageKey: 'ppgarden-task-layout-v1',
    grid: '.grtc-grid',
    card: '.grtc-grid > .grtc-task',
    heading: '公会任务显示与筛选',
    button: '任务设置',
    defaultColumns: 3,
    defaultMaxWidth: 190,
    defaultMinHeight: 60,
    fields: [
      { key: 'number', label: '任务编号', selector: '.grtc-task__top > b' },
      { key: 'points', label: '任务积分', selector: '.grtc-task__top > em' },
      { key: 'image', label: '任务图片', selector: '.grtc-task__visual' },
      { key: 'type', label: '任务类型', selector: '.grtc-task__class' },
      { key: 'title', label: '任务内容', selector: '> strong' },
      { key: 'by', label: '接取／升级人', selector: '.grtc-task__by' },
      { key: 'cult', label: '培育状态', selector: '.grtc-task__cult' },
      { key: 'progress', label: '完成进度', selector: '.grtc-progress' },
      { key: 'status', label: '任务状态', selector: '.grtc-card-status__heading' },
      { key: 'hint', label: '预约提示', selector: '.grtc-card-status__hint' },
      { key: 'time', label: '开放倒计时', selector: '.grtc-card-status__time' },
    ],
    groups: [
      ['.grtc-task__top', { number: 'b', points: 'em' }],
      ['.grtc-task__head', { image: '.grtc-task__visual', type: '.grtc-task__class' }],
      ['.grtc-card-status', {
        status: '.grtc-card-status__heading',
        hint: '.grtc-card-status__hint',
        time: '.grtc-card-status__time',
      }],
    ],
  };
  const landStates = [
    ['all', '全部状态'], ['mature', '已成熟'], ['growing', '生长中'],
    ['waiting', '待浇水'], ['empty', '空地'],
  ];
  const land = {
    storageKey: 'ppgarden-land-layout-v1',
    grid: '.land-field',
    card: '.land-field > .land-plot',
    heading: '土地花圃显示与筛选',
    button: '花圃设置',
    defaultColumns: 8,
    fields: [
      { key: 'status', label: '土地状态', selector: '.land-plot__status' },
      { key: 'elves', label: '精灵标记', selector: '.land-plot__elves' },
      { key: 'image', label: '花朵图片', selector: ':is(.land-scene__flower, .land-scene__missing)' },
      { key: 'soil', label: '土地底图', selector: '.land-scene__soil' },
      { key: 'name', label: '花朵名称', selector: '.land-plot__name' },
      { key: 'time', label: '成熟时间／倒计时', selector: '.land-timing' },
      { key: 'remaining', label: '剩余收获次数', selector: '.land-plot__remaining' },
    ],
    groups: [
      ['.land-plot__header', { status: '.land-plot__status', elves: '.land-plot__elves' }],
      ['.land-scene', { image: '.land-scene__flower, .land-scene__missing', soil: '.land-scene__soil' }],
    ],
  };
  const pages = [task, land];

  function normalize(page, value) {
    const columns = Number(value?.columns);
    const maxWidth = Number(value?.maxWidth === undefined ? page.defaultMaxWidth : value.maxWidth);
    const heightValue = value?.minHeight === undefined ? page.defaultMinHeight : value.minHeight;
    const minHeight = heightValue === '' ? NaN : Number(heightValue ?? NaN);
    const hidden = Array.isArray(value?.hidden) ? value.hidden : [];
    return {
      columns: Number.isInteger(columns) && columns >= 1 && columns <= 20 ? columns : page.defaultColumns,
      maxWidth: Number.isSafeInteger(maxWidth) && maxWidth >= 24 ? maxWidth : null,
      minHeight: Number.isSafeInteger(minHeight) && minHeight >= 0 ? minHeight : null,
      hidden: page.fields.filter(field => hidden.includes(field.key)).map(field => field.key),
      ...(page === task ? {
        cardStyle: value?.cardStyle === 'classic' ? 'classic' : 'modern',
        pendingOnly: value?.pendingOnly === true, scoreBackground: value?.scoreBackground !== false,
      } : {
        state: landStates.some(([key]) => key === value?.state) ? value.state : 'all',
        name: typeof value?.name === 'string' ? value.name : '',
      }),
    };
  }

  for (const page of pages) page.settings = normalize(page, await readSetting(page.storageKey, {}));
  let activePage;
  const style = document.createElement('style');
  style.id = 'ppg-layout-style';
  document.head.append(style);

  const uiCSS = `
    :root {
      --ppg-layout-bottom: max(calc(20px + env(safe-area-inset-bottom, 0px)), calc(var(--ppg-layout-nav-bottom, 0px) + 12px));
    }
    .ppg-layout-clock {
      display: block; box-sizing: border-box; margin: 0 0 8px; padding: 6px 10px;
      border: 1px solid var(--paper-line, #ccc); border-radius: 8px;
      background: var(--paper-inner, #f5f5f5); color: var(--ink, #222);
      font: 12px/1.5 system-ui, sans-serif; font-variant-numeric: tabular-nums;
      white-space: normal; overflow-wrap: anywhere;
    }
    .ppg-layout-clock--task {
      display: grid; gap: 8px; align-items: stretch; min-width: 0;
      padding: 0; border: 0; border-radius: 0; background: none;
    }
    .ppg-time-card {
      box-sizing: border-box; min-width: 0; min-height: 60px; padding: 9px 10px;
      display: flex; flex-direction: column; justify-content: center; gap: 4px;
      border: 1px solid var(--paper-line, #ccc); border-radius: 12px;
      background: var(--paper-card, #fff);
    }
    .ppg-time-card > span { color: var(--ink-muted, #777); font-size: 11px; line-height: 1.4; }
    .ppg-time-card > strong {
      min-width: 0; color: var(--ink, #222); font: 600 13px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-variant-numeric: tabular-nums; letter-spacing: -.02em; overflow-wrap: anywhere;
    }
    .ppg-time-card[data-clock="refresh"] { border-color: var(--green, #438466); }
    .ppg-time-card[data-clock="refresh"] > span { color: var(--green, #438466); }
    @media (max-width: 600px) {
      .ppg-time-card { padding: 8px; }
      .ppg-time-card > strong { font-size: 12px; }
    }
    #ppg-layout-panel {
      position: fixed; right: 16px; bottom: calc(var(--ppg-layout-bottom) + 56px); z-index: 2147483646;
      box-sizing: border-box; width: min(380px, calc(100vw - 32px));
      max-height: calc(100dvh - var(--ppg-layout-bottom) - 80px); margin: 0; padding: 20px; overflow: auto;
      border: 1px solid var(--paper-line, #ccc); border-radius: 16px;
      background: var(--paper-card, #fff); color: var(--ink, #222);
      font: 14px/1.6 system-ui, sans-serif; box-shadow: 0 16px 60px #0005;
    }
    #ppg-layout-panel[hidden] { display: none !important; }
    #ppg-layout-panel:has(.ppg-export:not([hidden])) {
      bottom: calc(var(--ppg-layout-bottom) + 112px);
      max-height: calc(100dvh - var(--ppg-layout-bottom) - 136px);
    }
    #ppg-layout-panel h2 { margin: 0 0 16px; font-size: 18px; color: inherit; }
    #ppg-layout-panel .ppg-export { margin-bottom: 16px; }
    #ppg-layout-panel .ppg-export[hidden] { display: none !important; }
    #ppg-layout-style-option[hidden] { display: none !important; }
    #ppg-layout-panel .ppg-export-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    #ppg-layout-panel .ppg-export-actions button { margin: 0; padding: 7px 10px; font: inherit; }
    #ppg-layout-panel .ppg-columns { display: flex; align-items: center; gap: 12px; }
    #ppg-layout-panel .ppg-columns + .ppg-columns { margin-top: 10px; }
    #ppg-layout-panel input[type="number"] {
      box-sizing: border-box; width: 88px; padding: 6px 8px; font: inherit;
      border: 1px solid var(--paper-line, #ccc); border-radius: 8px;
      background: var(--paper-inner, #f5f5f5); color: inherit;
    }
    #ppg-layout-panel .ppg-select { display: grid; grid-template-columns: 90px minmax(0, 1fr); align-items: center; gap: 10px; margin-bottom: 10px; }
    #ppg-layout-panel .ppg-export .ppg-select { margin-top: 12px; }
    #ppg-layout-panel select, #ppg-layout-panel input[type="search"] {
      box-sizing: border-box; width: 100%; min-width: 0; padding: 6px 8px; font: inherit;
      border: 1px solid var(--paper-line, #ccc); border-radius: 8px;
      background: var(--paper-inner, #f5f5f5); color: inherit;
    }
    #ppg-layout-panel fieldset { margin: 18px 0; padding: 0; border: 0; min-width: 0; }
    #ppg-layout-panel legend { margin-bottom: 10px; font-weight: 600; }
    #ppg-layout-panel .ppg-style-row { display: grid; grid-template-columns: 72px minmax(0, 1fr); align-items: center; gap: 8px; margin: 12px 0; }
    #ppg-layout-panel .ppg-style-row > span { font-weight: 600; }
    #ppg-layout-panel .ppg-style-choices {
      display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px; padding: 3px;
      border: 1px solid var(--paper-line, #ccc); border-radius: 10px; background: var(--paper-inner, #f5f5f5);
    }
    #ppg-layout-panel .ppg-style-choice { position: relative; min-width: 0; cursor: pointer; }
    #ppg-layout-panel .ppg-style-choice input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; }
    #ppg-layout-panel .ppg-style-choice > span {
      box-sizing: border-box; display: flex; align-items: center; justify-content: center; gap: 6px;
      min-height: 44px; padding: 6px 8px; white-space: nowrap; color: var(--ink-muted, #777);
      border: 1px solid transparent; border-radius: 7px;
    }
    #ppg-layout-panel .ppg-style-choice b { font-size: 13px; }
    #ppg-layout-panel .ppg-style-choice input:checked + span { border-color: var(--green, #438466); background: var(--paper-card, #fff); color: var(--ink, #222); }
    #ppg-layout-panel .ppg-style-choice input:checked + span::after { content: '✓'; color: var(--green, #438466); font-weight: 700; }
    #ppg-layout-panel .ppg-style-choice input:focus-visible + span { outline: 2px solid var(--ink, #222); outline-offset: 3px; }
    #ppg-layout-panel .ppg-field-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
    #ppg-layout-panel .ppg-field-actions button { padding: 5px 8px; min-height: 30px; font: inherit; font-size: 12px; }
    #ppg-layout-panel .ppg-field-actions [hidden] { display: none !important; }
    #ppg-layout-panel .ppg-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    #ppg-layout-panel .ppg-fields label, #ppg-layout-panel .ppg-filter { display: flex; align-items: center; gap: 8px; cursor: pointer; }
    #ppg-layout-panel input[type="checkbox"] { flex: none; width: 18px; height: 18px; margin: 0; accent-color: var(--green, #438466); }
    #ppg-layout-panel .ppg-theme { display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 12px; white-space: nowrap; }
    #ppg-layout-panel #ppg-layout-theme { appearance: none; position: relative; width: 32px; height: 18px; border: 0; border-radius: 999px; background: var(--paper-line, #bbb); cursor: pointer; }
    #ppg-layout-panel #ppg-layout-theme::before { content: ''; position: absolute; left: 2px; top: 2px; width: 14px; height: 14px; border-radius: 50%; background: #fff; }
    #ppg-layout-panel #ppg-layout-theme:checked { background: var(--green, #438466); }
    #ppg-layout-panel #ppg-layout-theme:checked::before { transform: translateX(14px); }
    #ppg-layout-panel #ppg-layout-theme:focus-visible { outline: 2px solid var(--ink, #222); outline-offset: 3px; }
    #ppg-layout-panel p { margin: 12px 0; color: var(--ink-muted, #777); font-size: 12px; }
    #ppg-layout-panel footer { display: flex; justify-content: flex-end; gap: 8px; }
    #ppg-layout-open, #ppg-layout-quick-copy {
      position: fixed; right: 16px; z-index: 2147483647;
      min-height: 40px; margin: 0; padding: 8px 16px; border-radius: 999px; cursor: pointer;
      border: 1px solid var(--paper-line, #ccc); background: var(--paper-card, #fff); color: var(--ink, #222);
      font: 14px/1.6 system-ui, sans-serif; box-shadow: 0 8px 28px #0003;
    }
    #ppg-layout-open { bottom: var(--ppg-layout-bottom); }
    #ppg-layout-quick-copy { bottom: calc(var(--ppg-layout-bottom) + 56px); }
    #ppg-layout-quick-copy:disabled { cursor: wait; opacity: .65; }
    #ppg-layout-quick-status {
      position: fixed; right: 16px; bottom: calc(var(--ppg-layout-bottom) + 112px); z-index: 2147483645;
      box-sizing: border-box; max-width: min(320px, calc(100vw - 32px)); margin: 0; padding: 8px 12px;
      border: 1px solid var(--paper-line, #ccc); border-radius: 10px;
      background: var(--paper-card, #fff); color: var(--ink, #222);
      font: 12px/1.6 system-ui, sans-serif; box-shadow: 0 8px 28px #0003;
    }
    :is(#ppg-layout-open, #ppg-layout-quick-copy, #ppg-layout-quick-status)[hidden] { display: none !important; }
    @media (max-width: 600px), (pointer: coarse) {
      #ppg-layout-panel {
        right: 12px; width: min(380px, calc(100vw - 24px)); padding: 16px;
        overscroll-behavior: contain; -webkit-overflow-scrolling: touch;
      }
      #ppg-layout-panel .ppg-columns { display: grid; grid-template-columns: minmax(0, 1fr) 96px; gap: 8px; }
      #ppg-layout-panel :is(input[type="number"], input[type="search"], select) { width: 100%; min-height: 44px; font-size: 16px; }
      #ppg-layout-panel :is(button, .ppg-fields label, .ppg-filter, .ppg-theme) { min-height: 44px; }
      #ppg-layout-panel .ppg-fields { gap: 4px 8px; }
      #ppg-layout-open, #ppg-layout-quick-copy { right: 12px; min-height: 44px; }
      #ppg-layout-quick-status { right: 12px; }
    }
  `;

  const taskCSS = `
    ${task.grid} { gap: 8px !important; align-items: stretch !important; -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
    ${task.card} {
      display: grid !important; grid-template-columns: auto minmax(0, 1fr) auto;
      container-type: inline-size;
      align-content: start; align-items: center; gap: 4px 6px;
      padding: 8px !important; border-radius: 12px !important;
    }
    ${task.card}[data-ppg-score="9"] { background: linear-gradient(135deg, #e0efc4, #cae1ab) !important; }
    ${task.card}[data-ppg-score="14"] { background: linear-gradient(135deg, #c3e9fa, #aed4ed) !important; }
    ${task.card}[data-ppg-score="23"] { background: linear-gradient(135deg, #e9ddfa, #ccb8ec) !important; }
    ${task.card}[data-ppg-score="25"] { background: linear-gradient(135deg, #f6deb0, #eec480) !important; }
    ${task.card}[data-ppg-score="high"] { background: linear-gradient(135deg, #f6d2d4, #eba9ba) !important; }
    :root[data-theme="dark"] ${task.card}[data-ppg-score="9"] { background: linear-gradient(135deg, #29483e, #20362f) !important; }
    :root[data-theme="dark"] ${task.card}[data-ppg-score="14"] { background: linear-gradient(135deg, #294c61, #213a4b) !important; }
    :root[data-theme="dark"] ${task.card}[data-ppg-score="23"] { background: linear-gradient(135deg, #473b61, #352c48) !important; }
    :root[data-theme="dark"] ${task.card}[data-ppg-score="25"] { background: linear-gradient(135deg, #58442f, #413322) !important; }
    :root[data-theme="dark"] ${task.card}[data-ppg-score="high"] { background: linear-gradient(135deg, #593843, #422a35) !important; }
    ${task.card} :is(.grtc-task__top, .grtc-task__head) { display: contents; }
    ${task.card} :is(.grtc-task__top > b, .grtc-task__top > em, .grtc-task__class) {
      box-sizing: border-box; min-width: 0; max-width: 100%; margin: 0;
      white-space: normal; overflow-wrap: anywhere; line-height: 1.35;
    }
    ${task.card} .grtc-task__top > b { grid-area: 1 / 1; justify-self: start; padding: 2px 5px; font-size: 12px; }
    ${task.card} .grtc-task__class { grid-area: 1 / 2; justify-self: center; padding: 2px 5px; font-size: 11px; }
    ${task.card} .grtc-task__top > em { grid-area: 1 / 3; justify-self: end; font-size: 12px; text-align: right; }
    ${task.card} .grtc-task__visual { grid-column: 1; justify-self: start; box-sizing: border-box; max-width: 100%; width: 32px; height: 32px; border-radius: 8px; }
    ${task.card} > strong {
      grid-column: 1 / -1; min-width: 0; min-height: 0; max-height: none;
      display: block; -webkit-line-clamp: unset; line-clamp: unset; overflow: visible;
      white-space: normal; overflow-wrap: anywhere; font-size: 13px; line-height: 1.4;
    }
    ${task.card} :is(.grtc-task__by, .grtc-task__cult, .grtc-progress, .grtc-card-status) { grid-column: 1 / -1; }
    ${task.card} .grtc-task__by { font-size: 10px; line-height: 1.4; white-space: normal; overflow: visible; overflow-wrap: anywhere; }
    ${task.card} .grtc-task__cult { box-sizing: border-box; min-width: 0; justify-self: start; padding: 2px 5px; font-size: 11px; line-height: 1.35; }
    ${task.card} .grtc-task__cult i { width: 11px; height: 11px; font-size: 9px; }
    ${task.card} .grtc-progress { width: 100%; height: 14px; }
    ${task.card} .grtc-card-status {
      box-sizing: border-box; min-width: 0; max-width: 100%; margin-top: 0;
      flex-direction: row; flex-wrap: wrap; align-items: center; gap: 3px 7px;
      padding: 5px 6px; border-radius: 8px; font-size: 11px;
    }
    ${task.card} .grtc-card-status__heading { gap: 3px; }
    ${task.card} .grtc-card-status__heading b { font-size: 11px; }
    ${task.card} .grtc-card-status__heading svg { width: 11px; height: 11px; flex-basis: 11px; }
    ${task.card} .grtc-card-status__hint { min-width: 0; font-size: 11px; opacity: .85; }
    ${task.card} .grtc-card-status__time {
      flex: 1 1 84px; min-width: 0; margin: 0; padding: 0; border-top: 0;
      gap: 2px 6px; align-items: baseline; justify-content: space-between; flex-wrap: wrap; white-space: normal;
    }
    ${task.card} .grtc-card-status__time > span { font-size: 10px; }
    ${task.card} .grtc-card-status__time strong { min-width: 0; font-size: 13px; white-space: nowrap; font-variant-numeric: tabular-nums; }
    @container (max-width: 140px) {
      ${task.card} .grtc-task__visual { width: 26px; height: 26px; border-radius: 6px; }
      ${task.card} > strong { font-size: 12px; line-height: 1.45; }
      ${task.card} .grtc-card-status { padding: 4px 5px; }
      ${task.card} .grtc-card-status__time { gap: 1px 4px; }
      ${task.card} .grtc-card-status__time strong { font-size: 12px; }
    }
    @media (max-width: 600px) {
      ${task.card} { padding: 6px !important; gap: 4px; border-radius: 10px !important; }
      ${task.grid}, ${land.grid} { margin-bottom: calc(var(--ppg-layout-bottom) + 112px); }
    }
  `;

  const classicCSS = `
    ${task.grid} { gap: 2px !important; }
    ${task.card} {
      --ppg-classic-bg: #fffae9; --ppg-classic-ink: #895821;
      grid-template-columns: minmax(0, 1fr) auto;
      grid-template-rows: auto auto 1fr auto auto auto auto auto;
      align-content: stretch; gap: 0 4px; padding: 4px !important;
      border: 0 !important; border-radius: 2px !important; box-shadow: none !important; text-align: center;
    }
    ${task.card}.grtc-task--available { --ppg-classic-bg: #effcf3; --ppg-classic-ink: #2a7c4b; }
    ${task.card}.grtc-task--unavailable { --ppg-classic-bg: #fff0f4; --ppg-classic-ink: #a93260; }
    :root[data-theme="dark"] ${task.card} { --ppg-classic-bg: #393322; --ppg-classic-ink: #e8c98b; }
    :root[data-theme="dark"] ${task.card}.grtc-task--available { --ppg-classic-bg: #203b30; --ppg-classic-ink: #9ad6ac; }
    :root[data-theme="dark"] ${task.card}.grtc-task--unavailable { --ppg-classic-bg: #422b37; --ppg-classic-ink: #f1a9c5; }
    ${task.card}[data-ppg-score], :root[data-theme="dark"] ${task.card}[data-ppg-score] {
      background: var(--ppg-classic-bg) !important; color: var(--ppg-classic-ink);
    }
    ${task.card} :is(.grtc-task__top > b, .grtc-task__top > em, .grtc-task__class, .grtc-task__cult) {
      padding: 0; border: 0; border-radius: 0; background: none; color: inherit;
    }
    ${task.card} .grtc-task__top > b { grid-area: 1 / 1; align-self: start; }
    ${task.card} .grtc-task__by {
      grid-area: 1 / 1 / 2 / -1; margin-left: 28px; text-align: right;
      color: inherit;
    }
    ${task.card} .grtc-task__visual {
      grid-area: 2 / 1 / 3 / -1 !important; justify-self: center; margin-top: 2px;
      width: 24px; height: 24px; border-radius: 4px; background: none;
    }
    ${task.card} > strong {
      grid-area: 3 / 1 / 4 / -1 !important; align-self: end; padding-top: 4px;
      text-align: center; color: inherit;
    }
    ${task.card} .grtc-task__top > em {
      grid-area: 4 / 1 / 5 / -1; justify-self: center;
    }
    ${task.card} .grtc-task__cult { grid-area: 5 / 1 / 6 / -1; justify-self: center; }
    ${task.card} .grtc-task__class {
      grid-area: 6 / 1; justify-self: start; align-self: end;
    }
    ${task.card} .grtc-progress {
      grid-area: 6 / 2; align-self: end; justify-self: end; width: auto; height: auto;
      border: 0; background: none; overflow: visible; color: inherit;
    }
    ${task.card} .grtc-progress > i { display: none; }
    ${task.card} .grtc-progress :is(small, span) { position: static; color: inherit; }
    ${task.card} .grtc-card-status { display: contents; color: inherit; }
    ${task.card} .grtc-card-status__heading { grid-area: 7 / 1; justify-self: start; }
    ${task.card} .grtc-card-status__hint { grid-area: 8 / 1 / 9 / -1; color: inherit; }
    ${task.card} .grtc-card-status__time {
      grid-area: 6 / 2; align-self: end; justify-self: end; color: inherit;
      padding: 0; border: 0; background: none; gap: 0; justify-content: flex-end;
    }
    ${task.card} .grtc-card-status__time > span { display: none; }
    ${task.card}:has(.grtc-card-status__time) .grtc-progress { grid-row: 7; }
  `;

  function apply() {
    style.textContent = uiCSS + pages.map(page => {
      const settings = page.settings;
      const hidden = new Set(settings.hidden);
      const selectors = page.fields.filter(field => hidden.has(field.key))
        .map(field => `${page.card} ${field.selector}`);

      // 只保留仍有可见内容的容器，避免隐藏信息后留下空框。
      for (const [selector, children] of page.groups) {
        const visible = Object.entries(children).filter(([key]) => !hidden.has(key))
          .map(([, child]) => child);
        selectors.push(`${page.card} ${selector}${visible.length ? `:not(:has(> :is(${visible.join(', ')})))` : ''}`);
      }
      if (page === task && settings.pendingOnly) selectors.push(`${page.card}:not(.grtc-task--pending)`);
      if (page === task && !hidden.has('type')) selectors.push(`${page.card}:has(.grtc-task__class[data-ppg-upgrade-label]) .grtc-task__by--upgrade`);
      if (page === land) selectors.push(`${page.card}[data-ppg-land-filtered]`);
      const maxWidth = settings.maxWidth === null ? 'none' : `${settings.maxWidth}px`;
      const columnSize = settings.maxWidth === null ? '1fr' : maxWidth;
      const classic = settings.cardStyle === 'classic';
      const contentRow = hidden.has('number') && hidden.has('points') && hidden.has('type') ? 1 : 2;
      const taskLayout = page === task ? `${taskCSS}
        .ppg-layout-clock--task { grid-template-columns: repeat(${settings.columns}, minmax(0, ${columnSize})); gap: ${classic ? 2 : 8}px; }
        ${hidden.has('image') ? '' : `
          ${page.card} .grtc-task__visual { grid-row: ${contentRow}; }
          ${page.card}:has(.grtc-task__visual) > strong { grid-column: 2 / -1; grid-row: ${contentRow}; }
        `}
        ${hidden.has('status') && hidden.has('hint') ? `
          ${page.card} .grtc-card-status { justify-self: start; gap: 0; }
          ${page.card} .grtc-card-status__time { flex: 0 1 auto; }
        ` : ''}
        ${!hidden.has('type') && (!hidden.has('number') || !hidden.has('points')) ? `
          @container (max-width: 140px) {
            ${page.card} .grtc-task__class { grid-area: 2 / 1 / 3 / -1; justify-self: start; }
            ${page.card} .grtc-task__visual, ${page.card} > strong { grid-row: 3 !important; }
          }
        ` : ''}
        ${classic ? classicCSS : ''}
      ` : '';

      return `
        ${page.grid} { display: grid !important; grid-template-columns: repeat(${settings.columns}, minmax(0, ${columnSize})) !important; }
        ${page.card} { box-sizing: border-box !important; min-width: 0 !important; max-width: ${maxWidth} !important; ${settings.minHeight === null ? '' : `min-height: ${settings.minHeight}px !important;`} }
        ${taskLayout}
        ${selectors.join(',\n')} { display: none !important; }
      `;
    }).join('\n');
    syncPage();
  }

  const panel = document.createElement('section');
  panel.id = 'ppg-layout-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-labelledby', 'ppg-layout-heading');
  panel.tabIndex = -1;
  panel.innerHTML = `
    <h2 id="ppg-layout-heading"></h2>
    <div class="ppg-export" hidden>
      <div class="ppg-export-actions">
        <button id="ppg-layout-export" type="button" class="button secondary">导出长图</button>
        <button id="ppg-layout-copy" type="button" class="button secondary">复制长图</button>
        <label class="ppg-theme"><input id="ppg-layout-theme" type="checkbox" role="switch">截图深色</label>
      </div>
      <label class="ppg-select">清晰度倍数
        <input id="ppg-layout-scale" type="number" inputmode="decimal" min="1" max="3" step="any" value="2" required aria-describedby="ppg-layout-scale-help">
      </label>
      <p id="ppg-layout-scale-help">自定义 1–3 倍，默认 2 倍，支持小数（如 1.5）。</p>
      <p>关闭开关截图为浅色，开启为深色。PNG 使用当前列数、最大宽度和最小高度，统一按桌面布局生成；任务内容优先单行，过长时自动换行。顶部三张时间卡片与任务卡片等宽，依次显示同步、下次任务刷新和截图时间。</p>
      <p id="ppg-layout-export-status" role="status" aria-live="polite"></p>
    </div>
    <div id="ppg-layout-style-option" class="ppg-style-row" role="radiogroup" aria-labelledby="ppg-layout-style-label" hidden>
      <span id="ppg-layout-style-label">任务样式</span>
      <div id="ppg-layout-card-style" class="ppg-style-choices">
        <label class="ppg-style-choice" title="图文卡片"><input type="radio" name="ppg-card-style" value="modern"><span><b>新版</b></span></label>
        <label class="ppg-style-choice" title="密排居中"><input type="radio" name="ppg-card-style" value="classic"><span><b>经典版</b></span></label>
      </div>
    </div>
    <label class="ppg-columns">每行卡片数（1–20）
      <input id="ppg-layout-columns" type="number" min="1" max="20" step="1" required>
    </label>
    <label class="ppg-columns">卡片最大宽度（px）
      <input id="ppg-layout-max-width" type="number" min="24" max="9007199254740991" step="1" placeholder="不限">
    </label>
    <label class="ppg-columns">卡片最小高度（px）
      <input id="ppg-layout-min-height" type="number" min="0" max="9007199254740991" step="1" placeholder="默认">
    </label>
    <p>最大宽度留空表示不限，最小24px；空间不足时卡片自动缩窄。</p>
    <p>最小高度留空使用默认高度；内容较多时卡片自动撑高。</p>
    <fieldset id="ppg-layout-score-options" hidden>
      <legend>背景配色</legend>
      <label class="ppg-filter"><input id="ppg-layout-score-background" type="checkbox">显示背景色</label>
      <p>新版按原始分：9 绿 · 14 蓝 · 21／23 紫 · 25 华品金 · 28／30 仙品粉。经典版按任务状态：可接取绿 · 待刷新米黄 · 已接取粉。</p>
      <p>新版中原金／升级任务按双倍积分回算原始分，其他分值按相邻档位着色。关闭后使用原页面背景。</p>
    </fieldset>
    <fieldset>
      <legend>额外筛选</legend>
      <div id="ppg-layout-filters"></div>
    </fieldset>
    <fieldset>
      <legend>勾选要展示的信息</legend>
      <div class="ppg-field-actions" role="group" aria-label="一键配置">
        <button type="button" class="button secondary" data-select="all">全选</button>
        <button type="button" class="button secondary" data-select="none">全不选</button>
        <button type="button" class="button secondary" data-select="invert">反选</button>
        <button type="button" class="button secondary" data-action="preset" hidden
          title="浅色、默认排序、3列、最大190px、最小60px、原始分配色；显示编号、积分、图片、类型、内容、接取／升级人、进度和倒计时">截图方案</button>
        <button type="button" class="button secondary" data-action="classic-preset" hidden
          title="经典版、浅色、默认排序、3列、最大190px、最小60px；显示图片、编号、内容、积分、类型、接取／升级人、进度和倒计时，顶部保留三张时间卡片">经典方案</button>
        <button type="button" class="button secondary" data-action="countdown-preset" hidden
          title="只显示编号、积分、类型、内容和开放倒计时；保留当前列数、宽度和筛选">倒计时精简</button>
      </div>
      <div class="ppg-fields"></div>
    </fieldset>
    <p>修改后立即生效并自动保存。列数较多时，卡片会变窄。</p>
    <footer>
      <button type="button" class="button secondary" data-action="reset">恢复默认</button>
      <button type="button" class="button" data-action="close">关闭</button>
    </footer>
  `;
  const button = document.createElement('button');
  button.id = 'ppg-layout-open';
  button.type = 'button';
  button.hidden = true;
  button.setAttribute('aria-haspopup', 'dialog');
  button.setAttribute('aria-controls', panel.id);
  button.setAttribute('aria-expanded', 'false');
  const quickCopyButton = document.createElement('button');
  quickCopyButton.id = 'ppg-layout-quick-copy';
  quickCopyButton.type = 'button';
  quickCopyButton.textContent = '复制长图';
  quickCopyButton.hidden = true;
  quickCopyButton.dataset.html2canvasIgnore = 'true';
  const quickStatus = document.createElement('p');
  quickStatus.id = 'ppg-layout-quick-status';
  quickStatus.hidden = true;
  quickStatus.dataset.html2canvasIgnore = 'true';
  quickStatus.setAttribute('role', 'status');
  quickStatus.setAttribute('aria-live', 'polite');
  quickCopyButton.setAttribute('aria-describedby', quickStatus.id);
  document.body.append(panel, button, quickCopyButton, quickStatus);
  const columnsInput = panel.querySelector('#ppg-layout-columns');
  const cardStyleInputs = [...panel.querySelectorAll('[name="ppg-card-style"]')];
  const maxWidthInput = panel.querySelector('#ppg-layout-max-width');
  const minHeightInput = panel.querySelector('#ppg-layout-min-height');
  const exportButton = panel.querySelector('#ppg-layout-export');
  const copyButton = panel.querySelector('#ppg-layout-copy');
  const themeInput = panel.querySelector('#ppg-layout-theme');
  const scaleInput = panel.querySelector('#ppg-layout-scale');
  const exportStatus = panel.querySelector('#ppg-layout-export-status');
  const filters = panel.querySelector('#ppg-layout-filters');
  const presetButton = panel.querySelector('[data-action="preset"]');
  const classicPresetButton = panel.querySelector('[data-action="classic-preset"]');
  const countdownPresetButton = panel.querySelector('[data-action="countdown-preset"]');
  let checkboxes = [];

  const themeKey = 'ppgarden-screenshot-theme-v1';
  let screenshotTheme = await readSetting(themeKey, 'light') === 'dark' ? 'dark' : 'light';
  const setScreenshotTheme = theme => {
    screenshotTheme = theme;
    writeSetting(themeKey, theme);
    themeInput.checked = theme === 'dark';
  };
  themeInput.checked = screenshotTheme === 'dark';
  themeInput.addEventListener('change', () => setScreenshotTheme(themeInput.checked ? 'dark' : 'light'));

  const scaleKey = 'ppgarden-screenshot-scale-v1';
  const savedScale = Number(await readSetting(scaleKey, 2));
  let screenshotMultiplier = Number.isFinite(savedScale) && savedScale >= 1 && savedScale <= 3 ? savedScale : 2;
  scaleInput.value = screenshotMultiplier;
  scaleInput.addEventListener('input', () => {
    if (!scaleInput.checkValidity()) return;
    screenshotMultiplier = scaleInput.valueAsNumber;
    writeSetting(scaleKey, screenshotMultiplier);
  });
  scaleInput.addEventListener('change', () => {
    if (!scaleInput.checkValidity()) scaleInput.value = screenshotMultiplier;
  });

  function renderPage() {
    panel.querySelector('#ppg-layout-heading').textContent = activePage.heading;
    button.textContent = activePage.button;
    panel.querySelector('.ppg-export').hidden = activePage !== task;
    presetButton.hidden = activePage !== task;
    classicPresetButton.hidden = activePage !== task;
    panel.querySelector('#ppg-layout-style-option').hidden = activePage !== task;
    countdownPresetButton.hidden = activePage !== task;
    panel.querySelector('#ppg-layout-score-options').hidden = activePage !== task;
    panel.querySelector('.ppg-fields').innerHTML = activePage.fields.map(field => `
      <label><input type="checkbox" data-field="${field.key}">${field.label}</label>
    `).join('');
    filters.innerHTML = activePage === task ? `
      <label class="ppg-filter"><input id="ppg-layout-pending" type="checkbox">只看待刷新</label>
      <p>若无结果，请关闭页面的“只看可接取”。</p>
    ` : `
      <label class="ppg-select">土地状态
        <select id="ppg-layout-land-state">${landStates.map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select>
      </label>
      <label class="ppg-select">花名关键词
        <input id="ppg-layout-land-name" type="search" placeholder="输入部分花名">
      </label>
      <p id="ppg-layout-land-count" role="status" aria-live="polite"></p>
      <p>两项筛选同时生效；清空花名并选择全部状态可显示全部土地。</p>
    `;
    checkboxes = [...panel.querySelectorAll('[data-field]')];
    syncInputs();
  }

  function syncInputs() {
    const settings = activePage.settings;
    columnsInput.value = settings.columns;
    maxWidthInput.value = settings.maxWidth ?? '';
    minHeightInput.value = settings.minHeight ?? '';
    if (activePage === task) {
      for (const input of cardStyleInputs) input.checked = input.value === settings.cardStyle;
      panel.querySelector('#ppg-layout-pending').checked = settings.pendingOnly;
      panel.querySelector('#ppg-layout-score-background').checked = settings.scoreBackground;
    }
    else {
      panel.querySelector('#ppg-layout-land-state').value = settings.state;
      panel.querySelector('#ppg-layout-land-name').value = settings.name;
    }
    for (const checkbox of checkboxes) checkbox.checked = !settings.hidden.includes(checkbox.dataset.field);
  }

  function save() {
    writeSetting(activePage.storageKey, activePage.settings);
    apply();
  }

  function openSettings() {
    syncPage();
    if (!activePage) return;
    syncInputs();
    panel.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    panel.focus({ preventScroll: true });
    if (matchMedia('(min-width: 601px) and (pointer: fine)').matches) {
      columnsInput.focus();
      columnsInput.select();
    }
  }

  function closeSettings() {
    panel.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    button.focus();
  }

  function formatTime(date = new Date()) {
    const pad = value => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  function syncTimeValue(page, grid) {
    const scope = grid.closest(page === task ? '.grtc-page' : '.land-board') || document;
    const source = scope.querySelector(page === task ? '.grtc-hero__head > span' : '.land-board__freshness > span');
    const value = source?.textContent.trim().replace(/^最近同步\s*[:：]\s*/, '').replace(/\s*同步$/, '');
    return value || '未获取';
  }

  function nextTaskRefresh(grid, now) {
    const pending = grid.querySelectorAll(':scope > .grtc-task--pending');
    if (!pending.length) return '暂无待刷新任务';
    let next = Infinity;
    for (const card of pending) {
      const parts = card.querySelector('.grtc-card-status__time strong')?.textContent.trim()
        .match(/^(\d+):([0-5]\d)(?::([0-5]\d))?$/);
      if (!parts) continue;
      const seconds = parts[3] === undefined ? Number(parts[1]) * 60 + Number(parts[2])
        : Number(parts[1]) * 3600 + Number(parts[2]) * 60 + Number(parts[3]);
      const target = new Date(now.getTime() + seconds * 1000).getTime();
      if (Number.isFinite(target)) next = Math.min(next, target);
    }
    return Number.isFinite(next) ? formatTime(new Date(next)) : '未获取';
  }

  function syncTaskClock(clock, grid, now, screenshot = false) {
    const items = [
      ['sync', '同步时间', syncTimeValue(task, grid)],
      ['refresh', '下次任务刷新', nextTaskRefresh(grid, now)],
      ['current', screenshot ? '截图时间' : '当前时间', formatTime(now)],
    ];
    for (const [key, label, value] of items) {
      let card = clock.querySelector(`[data-clock="${key}"]`);
      if (!card) {
        card = clock.ownerDocument.createElement('div');
        card.className = 'ppg-time-card';
        card.dataset.clock = key;
        card.append(clock.ownerDocument.createElement('span'), clock.ownerDocument.createElement('strong'));
        clock.append(card);
      }
      if (card.firstElementChild.textContent !== label) card.firstElementChild.textContent = label;
      if (card.lastElementChild.textContent !== value) card.lastElementChild.textContent = value;
    }
  }

  function screenshotScale(width, height, requestedScale) {
    // shortcut: 超长图片限制为16000px边长和3200万像素，超过1倍分辨率容量时需调整布局。
    const scale = Math.min(requestedScale, 16000 / width, 16000 / height, Math.sqrt(32000000 / width / height));
    if (scale < 1) throw new Error('长图尺寸过大，请增加每行卡片数或减小卡片最小高度后重试。');
    return scale;
  }

  function setExportStatus(message) {
    exportStatus.textContent = quickStatus.textContent = message;
    quickStatus.hidden = activePage !== task || !message;
  }

  async function renderTaskImage(grid, cards, capturedAt) {
    if (typeof html2canvas !== 'function') throw new Error('截图组件未加载，请重新安装或更新脚本后重试。');
    const theme = screenshotTheme;
    const requestedScale = screenshotMultiplier;
    const timestamp = task.clock.cloneNode(true);
    syncTaskClock(timestamp, grid, capturedAt, true);
    const { columns, maxWidth, minHeight } = task.settings;
    const gap = task.settings.cardStyle === 'classic' ? 2 : 8;
    const cardWidth = maxWidth ?? task.defaultMaxWidth;
    await document.fonts.ready;
    if (!grid.isConnected) throw new Error('页面已切换，请在任务中心重新截图。');
    const bounds = grid.getBoundingClientRect();
    const rectangles = cards.map(card => card.getBoundingClientRect());
    const padding = 12;
    const width = columns * cardWidth + (columns - 1) * gap + padding * 2;
    const height = Math.ceil(Math.max(...rectangles.map(rect => rect.bottom)) - bounds.top + grid.scrollTop) + padding * 2 + 40;
    const host = document.createElement('div');
    host.dataset.html2canvasIgnore = 'true';
    let missingResources = false;
    const options = {
      width, height, x: -padding, y: -padding, scale: screenshotScale(width, 1, requestedScale),
      windowWidth: Math.max(1024, width + padding * 2),
      windowHeight: document.documentElement.clientHeight,
      iframeContainer: host,
      useCORS: true, allowTaint: false, logging: false, normalizeDom: false,
      ignoreElements: element => element.id === panel.id || element.id === button.id,
      onProgress: (phase, progress) => setExportStatus(`正在生成高清长图：${progress}%`),
      onError: () => { missingResources = true; },
      onclone: (doc, clonedGrid) => {
        doc.documentElement.dataset.theme = theme;
        options.backgroundColor = doc.defaultView.getComputedStyle(doc.body).backgroundColor;
        clonedGrid.style.setProperty('grid-template-columns', `repeat(${columns}, minmax(0, ${cardWidth}px))`, 'important');
        clonedGrid.style.setProperty('width', `${columns * cardWidth + (columns - 1) * gap}px`, 'important');
        for (const card of clonedGrid.querySelectorAll('.grtc-task')) {
          card.style.setProperty('max-width', maxWidth === null ? 'none' : `${maxWidth}px`, 'important');
          card.style.setProperty('width', 'auto', 'important');
          if (minHeight !== null) card.style.setProperty('min-height', `${minHeight}px`, 'important');
        }
        clonedGrid.style.setProperty('height', 'auto', 'important');
        clonedGrid.style.setProperty('min-height', '0', 'important');
        clonedGrid.style.setProperty('max-height', 'none', 'important');
        clonedGrid.style.setProperty('overflow', 'visible', 'important');
        clonedGrid.scrollTop = clonedGrid.scrollLeft = 0;
        for (const image of clonedGrid.querySelectorAll('img')) {
          image.loading = 'eager';
          // 截图组件处理图片投影会漏图，仅在副本中去掉投影。
          image.style.setProperty('filter', 'none', 'important');
        }
        const clonedClock = doc.importNode(timestamp, true);
        clonedClock.style.cssText = 'grid-column: 1 / -1; margin: 0; min-width: 0;';
        clonedClock.style.setProperty('grid-template-columns', clonedGrid.style.gridTemplateColumns, 'important');
        clonedGrid.prepend(clonedClock);
        // 展开滚动区域并添加时间后再测量，避免裁掉最后一行。
        options.width = Math.ceil(clonedGrid.getBoundingClientRect().width) + padding * 2;
        options.height = Math.ceil(clonedGrid.getBoundingClientRect().height) + padding * 2;
        options.scale = screenshotScale(options.width, options.height, requestedScale);
      },
    };
    document.body.append(host);
    try {
      const canvas = await html2canvas(grid, options);
      const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value
        ? resolve(value) : reject(new Error('图片生成失败，请增加列数或缩小卡片后重试。')), 'image/png'));
      return { blob, width: canvas.width, height: canvas.height, scale: options.scale, requestedScale, missingResources };
    } finally {
      host.remove();
    }
  }

  async function exportLongImage(copy = false) {
    if (exportButton.disabled) return;
    syncPage();
    if (activePage !== task) return;
    const grid = document.querySelector(task.grid);
    const cards = grid ? [...document.querySelectorAll(task.card)]
      .filter(card => { const rect = card.getBoundingClientRect(); return rect.width > 0 && rect.height > 0; }) : [];
    if (!cards.length) {
      setExportStatus('没有符合当前筛选条件的卡片，请调整筛选后重试。');
      return;
    }

    const capturedAt = new Date();
    exportButton.disabled = copyButton.disabled = quickCopyButton.disabled = true;
    (copy ? copyButton : exportButton).textContent = copy ? '复制中…' : '导出中…';
    quickCopyButton.textContent = copy ? '复制中…' : '生成中…';
    setExportStatus('正在生成高清长图，请稍候…');
    let imagePromise;
    try {
      if (copy && (!navigator.clipboard?.write || typeof ClipboardItem !== 'function')) {
        throw new Error('浏览器不支持复制图片，请使用「导出长图」保存 PNG 后复制图片。');
      }
      imagePromise = renderTaskImage(grid, cards, capturedAt);
      const clipboardImage = copy ? imagePromise.then(image => image.blob) : null;
      clipboardImage?.catch(() => {});
      // 点击时立即申请写入，把渲染结果作为 Promise 传入，保留 Safari 所需的用户操作权限。
      const clipboardPromise = copy ? navigator.clipboard.write([new ClipboardItem({
        'image/png': clipboardImage,
      })]) : null;
      const [image] = await Promise.all([imagePromise, clipboardPromise]);
      if (!copy) {
        const url = URL.createObjectURL(image.blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `云上花匠-任务长图-${formatTime(capturedAt).replace(/[: ]/g, '-')}.png`;
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      }
      setExportStatus(`${copy ? '已复制到剪贴板，可直接粘贴' : '已导出任务长图'}，共${cards.length}张卡片；${image.width} × ${image.height}px。`
        + (image.scale < image.requestedScale ? `图片过长，已调整为${image.scale.toFixed(1)}倍分辨率。` : `${image.scale} 倍分辨率 PNG。`)
        + (image.missingResources ? '部分图片或字体未加载，可检查后重新截图。' : ''));
    } catch (error) {
      await imagePromise?.catch(() => {});
      setExportStatus(`${copy ? '复制' : '导出'}失败：` + (copy && error.name === 'NotAllowedError'
        ? '浏览器未允许写入剪贴板。请允许本站写入，或使用「导出长图」保存 PNG 后复制图片。'
        : error.message || '请刷新页面后重试。'));
      console.error('[云上花匠] 长图生成失败', error);
    } finally {
      exportButton.disabled = copyButton.disabled = quickCopyButton.disabled = false;
      exportButton.textContent = '导出长图';
      copyButton.textContent = quickCopyButton.textContent = '复制长图';
    }
  }

  exportButton.addEventListener('click', () => exportLongImage());
  copyButton.addEventListener('click', () => exportLongImage(true));
  quickCopyButton.addEventListener('click', () => exportLongImage(true));
  button.addEventListener('click', () => panel.hidden ? openSettings() : closeSettings());
  panel.addEventListener('input', event => {
    if (!activePage || event.target === themeInput || event.target === scaleInput) return;
    const settings = activePage.settings;
    activePage.settings = {
      columns: columnsInput.checkValidity() ? Number(columnsInput.value) : settings.columns,
      maxWidth: maxWidthInput.checkValidity()
        ? (maxWidthInput.value === '' ? null : maxWidthInput.valueAsNumber)
        : settings.maxWidth,
      minHeight: minHeightInput.checkValidity()
        ? (minHeightInput.value === '' ? null : minHeightInput.valueAsNumber)
        : settings.minHeight,
      hidden: checkboxes.filter(checkbox => !checkbox.checked).map(checkbox => checkbox.dataset.field),
      ...(activePage === task ? {
        cardStyle: cardStyleInputs.find(input => input.checked)?.value === 'classic' ? 'classic' : 'modern',
        pendingOnly: panel.querySelector('#ppg-layout-pending').checked,
        scoreBackground: panel.querySelector('#ppg-layout-score-background').checked,
      } : {
        state: panel.querySelector('#ppg-layout-land-state').value,
        name: panel.querySelector('#ppg-layout-land-name').value,
      }),
    };
    save();
  });
  columnsInput.addEventListener('change', () => columnsInput.reportValidity());
  maxWidthInput.addEventListener('change', () => maxWidthInput.reportValidity());
  minHeightInput.addEventListener('change', () => minHeightInput.reportValidity());
  panel.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeSettings();
    }
  });
  panel.querySelector('[data-action="close"]').addEventListener('click', closeSettings);
  panel.querySelector('[data-action="reset"]').addEventListener('click', () => {
    if (!activePage) return;
    activePage.settings = normalize(activePage, {});
    syncInputs();
    save();
  });
  for (const selectButton of panel.querySelectorAll('[data-select]')) {
    selectButton.addEventListener('click', () => {
      if (!activePage) return;
      const keys = activePage.fields.map(field => field.key);
      const action = selectButton.dataset.select;
      activePage.settings.hidden = action === 'all' ? [] : action === 'none' ? keys
        : keys.filter(key => !activePage.settings.hidden.includes(key));
      syncInputs();
      save();
    });
  }
  for (const preset of [presetButton, classicPresetButton]) preset.addEventListener('click', () => {
    if (activePage !== task) return;
    const classic = preset === classicPresetButton;
    task.settings = {
      ...task.settings,
      cardStyle: classic ? 'classic' : 'modern',
      columns: 3, maxWidth: 190, minHeight: 60, pendingOnly: false, scoreBackground: true,
      hidden: ['cult', 'status', 'hint'],
    };
    setScreenshotTheme('light');
    const sort = document.querySelector('.grtc-toolbar__sort select');
    if (sort && sort.value !== 'by_index') {
      sort.value = 'by_index';
      sort.dispatchEvent(new Event('change', { bubbles: true }));
    }
    syncInputs();
    save();
  });
  countdownPresetButton.addEventListener('click', () => {
    if (activePage !== task) return;
    task.settings.hidden = ['image', 'by', 'cult', 'progress', 'status', 'hint'];
    syncInputs();
    save();
  });
  const registerMenu = typeof GM_registerMenuCommand === 'function' ? GM_registerMenuCommand
    : typeof GM !== 'undefined' && typeof GM.registerMenuCommand === 'function' ? GM.registerMenuCommand.bind(GM) : null;
  if (registerMenu) Promise.resolve().then(() => registerMenu('任务／花圃：显示与筛选设置', openSettings))
    .catch(error => console.warn('[云上花匠] 菜单不可用，请使用页面上的设置按钮', error));

  function filterLand() {
    const { state, name } = land.settings;
    const keyword = name.trim().toLocaleLowerCase();
    const cards = [...document.querySelectorAll(land.card)];
    let matched = 0;
    for (const card of cards) {
      const status = card.querySelector('.land-plot__status')?.textContent ?? '';
      const stateMatches = state === 'all' || (state === 'empty'
        ? /空地|未种植/.test(status) || card.classList.contains('land-plot--empty')
        : card.classList.contains(`land-plot--${state}`));
      const flowerName = card.querySelector('.land-plot__name')?.textContent ?? '';
      const matches = stateMatches && flowerName.toLocaleLowerCase().includes(keyword);
      card.toggleAttribute('data-ppg-land-filtered', !matches);
      if (matches) matched++;
    }
    const count = panel.querySelector('#ppg-layout-land-count');
    const text = `匹配 ${matched} / ${cards.length} 块土地`;
    if (count && count.textContent !== text) count.textContent = text;
  }

  function syncFloatingPosition() {
    const nav = document.querySelector('.bottom-tabs');
    const rect = nav?.getBoundingClientRect();
    const visible = rect?.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight
      && getComputedStyle(nav).visibility !== 'hidden';
    const bottom = visible ? `${Math.ceil(innerHeight - Math.max(0, rect.top))}px` : '0px';
    const rootStyle = document.documentElement.style;
    if (rootStyle.getPropertyValue('--ppg-layout-nav-bottom') !== bottom) {
      rootStyle.setProperty('--ppg-layout-nav-bottom', bottom);
    }
  }

  function syncClocks() {
    syncFloatingPosition();
    const now = new Date();
    for (const page of pages) {
      const grid = document.querySelector(page.grid);
      if (!grid) {
        page.clock?.remove();
        continue;
      }
      if (!page.clock) {
        page.clock = document.createElement(page === task ? 'div' : 'time');
        page.clock.className = 'ppg-layout-clock' + (page === task ? ' ppg-layout-clock--task' : '');
      }
      if (grid.previousElementSibling !== page.clock) grid.before(page.clock);
      if (page === task) {
        syncTaskClock(page.clock, grid, now);
        continue;
      }
      const text = `同步时间：${syncTimeValue(page, grid)} ｜ 当前时间：${formatTime(now)}`;
      if (page.clock.textContent !== text) {
        page.clock.textContent = text;
        page.clock.dateTime = now.toISOString();
      }
    }
  }

  let titleId = 0;
  function syncPage() {
    const nextPage = pages.find(page => document.querySelector(page.grid));
    button.hidden = !nextPage;
    quickCopyButton.hidden = nextPage !== task;
    quickStatus.hidden = nextPage !== task || !quickStatus.textContent;
    if (!nextPage) {
      panel.hidden = true;
      button.setAttribute('aria-expanded', 'false');
    }
    if (nextPage !== activePage) {
      activePage = nextPage;
      if (activePage) renderPage();
    }
    // 引用原任务标题，使隐藏文字后的卡片仍有可读的无障碍名称。
    for (const card of document.querySelectorAll(task.card)) {
      const type = card.querySelector('.grtc-task__class');
      const previousLabel = type?.dataset.ppgUpgradeLabel;
      if (type && (type.textContent.trim() === '他人升级' || (previousLabel && type.textContent === previousLabel))) {
        const upgrader = task.settings.hidden.includes('by') ? null
          : card.querySelector('.grtc-task__by--upgrade')?.textContent.trim().match(/^由\s+(.+?)\s+升级$/)?.[1].trim();
        const label = upgrader ? `${upgrader} 升级` : '他人升级';
        if (type.textContent !== label) type.textContent = label;
        if (upgrader) type.dataset.ppgUpgradeLabel = label;
        else delete type.dataset.ppgUpgradeLabel;
      } else if (previousLabel) {
        delete type.dataset.ppgUpgradeLabel;
      }
      const points = card.querySelector('.grtc-task__top > em')?.textContent.trim().match(/^(?:✦\s*)?(\d+)\s*分$/);
      if (task.settings.scoreBackground && points) {
        // shortcut: 当前原金／升级任务为双倍积分，网站调整倍率时需更新。
        const doubled = /原金|升级/.test(card.querySelector('.grtc-task__class')?.textContent ?? '');
        const originalPoints = Number(points[1]) / (doubled ? 2 : 1);
        card.dataset.ppgScore = String([9, 14, 23, 25].find(limit => originalPoints <= limit) ?? 'high');
      }
      else card.removeAttribute('data-ppg-score');
      const label = card.getAttribute('aria-labelledby');
      if (card.hasAttribute('aria-label') || (label && !label.startsWith('ppg-layout-title-'))) continue;
      const title = card.querySelector(':scope > strong');
      if (!title) continue;
      if (!title.id) title.id = `ppg-layout-title-${++titleId}`;
      if (label !== title.id) card.setAttribute('aria-labelledby', title.id);
    }
    filterLand();
    syncClocks();
  }

  apply();
  window.addEventListener('resize', syncFloatingPosition);
  window.addEventListener('scroll', syncFloatingPosition, { passive: true });
  window.visualViewport?.addEventListener('resize', syncFloatingPosition);
  window.visualViewport?.addEventListener('scroll', syncFloatingPosition);
  setInterval(syncClocks, 1000);
  new MutationObserver(syncPage).observe(document.body, {
    childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class'],
  });
})().catch(error => {
  console.error('[云上花匠] 脚本启动失败', error);
  const notice = document.createElement('p');
  notice.id = 'ppg-layout-startup-error';
  notice.setAttribute('role', 'alert');
  notice.textContent = `花匠脚本启动失败：${error.message || error}。请更新脚本并刷新页面。`;
  notice.style.cssText = 'position:fixed;right:16px;bottom:20px;z-index:2147483647;max-width:calc(100vw - 32px);box-sizing:border-box;margin:0;padding:12px;border:1px solid #c66;border-radius:10px;background:#fff;color:#922;font:14px/1.6 system-ui,sans-serif;';
  (document.body || document.documentElement).append(notice);
});
