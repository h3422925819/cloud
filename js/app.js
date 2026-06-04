/**
 * 云端情绪手账 - 交互逻辑
 */
(function () {
  'use strict';

  /* ============ 工具函数 ============ */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => [...document.querySelectorAll(sel)];
  const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  /* ============ 数据存储 ============ */
  const Store = {
    _prefix: 'cloudJournal_',
    get(key, fallback) {
      try { const v = localStorage.getItem(this._prefix + key); return v ? JSON.parse(v) : fallback; }
      catch { return fallback; }
    },
    set(key, val) {
      localStorage.setItem(this._prefix + key, JSON.stringify(val));
    },
    remove(key) {
      localStorage.removeItem(this._prefix + key);
    }
  };

  /* ============ 情绪配置 ============ */
  const MOODS = [
    { key: 'happy', label: '😊 开心', color: 'mood-happy' },
    { key: 'calm', label: '😌 平静', color: 'mood-calm' },
    { key: 'healing', label: '🌿 治愈', color: 'mood-healing' },
    { key: 'confused', label: '😶 迷茫', color: 'mood-confused' },
    { key: 'sad', label: '😢 难过', color: 'mood-sad' },
    { key: 'angry', label: '😤 生气', color: 'mood-angry' },
    { key: 'lonely', label: '🥺 孤独', color: 'mood-lonely' },
  ];
  function getMood(key) { return MOODS.find(m => m.key === key) || MOODS[1]; }

  /* ============ 状态 ============ */
  let journals = (() => {
    try {
      const raw = Store.get('journals', []);
      if (!Array.isArray(raw)) return [];
      // 兼容旧数据：映射字段名
      return raw.filter(j => j && typeof j === 'object').map(j => ({
        id: j.id || genId(),
        mood: j.mood || 'calm',
        title: j.title || '',
        text: j.text || j.content || '',
        time: j.time || j.timestamp || new Date().toISOString(),
        status: j.status || 'published',
        favorited: !!j.favorited,
        mine: j.mine !== false,
      }));
    } catch (e) {
      console.error('journals init error:', e);
      return [];
    }
  })();
  let selectedMood = null;
  let currentFilter = 'all';

  /* ============ Toast ============ */
  let toastTimer = null;
  function showToast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  /* ============ 时间格式化 ============ */
  function fmtTime(iso) {
    const d = new Date(iso);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  /* ============ 问候语 ============ */
  function getGreeting() {
    const h = new Date().getHours();
    if (h < 6) return { text: '夜深了 🌙', sub: '给自己一个温柔的拥抱' };
    if (h < 9) return { text: '早安呀 ☀️', sub: '新的一天，新的开始' };
    if (h < 12) return { text: '上午好 🌤️', sub: '今天心情怎么样？' };
    if (h < 14) return { text: '中午好 🍃', sub: '记得休息一下哦' };
    if (h < 17) return { text: '下午好 ☁️', sub: '把心事藏进云朵里' };
    if (h < 19) return { text: '傍晚好 🌅', sub: '夕阳很美，你也是' };
    if (h < 22) return { text: '晚上好 🌆', sub: '放慢脚步，感受温柔' };
    return { text: '夜深了 🌙', sub: '给自己一个温柔的拥抱' };
  }

  /* ============ 欢迎页 ============ */
  function initWelcome() {
    const overlay = $('#welcomeOverlay');
    const title = $('#welcomeTitle');
    const sub = $('#welcomeSub');
    const btn = $('#welcomeBtn');

    // 检查是否已跳过欢迎页
    if (Store.get('skipWelcome', false)) {
      overlay.classList.add('hidden');
      return;
    }

    const titleText = '云端情绪手账';
    const subText = '把心事藏进云朵，与温柔不期而遇';
    let ti = 0, si = 0;

    function typeT() {
      if (ti <= titleText.length) {
        title.textContent = titleText.slice(0, ti);
        ti++;
        setTimeout(typeT, 100);
      } else {
        setTimeout(typeS, 200);
      }
    }
    function typeS() {
      if (si <= subText.length) {
        sub.textContent = subText.slice(0, si);
        si++;
        setTimeout(typeS, 50);
      } else {
        btn.classList.add('show');
      }
    }
    setTimeout(typeT, 600);

    btn.addEventListener('click', () => {
      overlay.classList.add('hidden');
      Store.set('skipWelcome', true);
    });
  }

  /* ============ 页面切换 ============ */
  window.switchPage = function (pageName) {
    $$('.page').forEach(p => p.classList.remove('active'));
    $$('.nav-link').forEach(l => l.classList.remove('active'));
    const page = $(`[data-page="${pageName}"]`);
    const link = $(`.nav-link[data-page="${pageName}"]`);
    if (page) page.classList.add('active');
    if (link) link.classList.add('active');

    // 切换时刷新内容
    if (pageName === 'home') renderHome();
    if (pageName === 'journal') renderJournal();
    if (pageName === 'favorites') renderFavorites();
    if (pageName === 'settings') renderSettings();
  };

  function initNav() {
    $$('.nav-link').forEach(link => {
      link.addEventListener('click', () => switchPage(link.dataset.page));
    });
    // "查看全部"链接
    $$('.section-more').forEach(a => {
      a.addEventListener('click', () => switchPage(a.dataset.page));
    });
  }

  /* ============ 首页渲染 ============ */
  function renderHome() {
    try {
      const g = getGreeting();
      const greetText = $('#greetingText');
      const greetSub = $('#greetingSub');
      if (greetText) greetText.textContent = g.text;
      if (greetSub) greetSub.textContent = g.sub;

      const published = journals.filter(j => j.status === 'published');
      const favorited = journals.filter(j => j.favorited);
      const moodTypes = new Set(journals.filter(j => j.mood).map(j => j.mood)).size;
      const streak = calcStreak();

      const statTotal = $('#statTotal');
      const statStreak = $('#statStreak');
      const statFav = $('#statFav');
      const statMoods = $('#statMoods');
      if (statTotal) statTotal.textContent = published.length;
      if (statStreak) statStreak.textContent = streak;
      if (statFav) statFav.textContent = favorited.length;
      if (statMoods) statMoods.textContent = moodTypes;

      const recent = published.slice(-3).reverse();
      const grid = $('#recentJournals');
      const empty = $('#homeEmpty');
      if (!grid) return;
      if (recent.length === 0) {
        grid.innerHTML = '';
        if (empty) empty.style.display = '';
      } else {
        if (empty) empty.style.display = 'none';
        grid.innerHTML = recent.map(j => cardHTML(j)).join('');
        bindCardActions(grid);
      }
    } catch (e) { console.error('renderHome error:', e); }
  }

  function calcStreak() {
    const days = new Set(
      journals.filter(j => j.status === 'published')
        .map(j => new Date(j.time).toDateString())
    );
    let streak = 0;
    const d = new Date();
    while (days.has(d.toDateString())) {
      streak++;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  }

  /* ============ 手账卡片 HTML ============ */
  function cardHTML(j) {
    const m = getMood(j.mood);
    const isFav = j.favorited;
    const isDraft = j.status === 'draft';
    return `
      <div class="journal-card" data-id="${j.id}">
        ${isDraft ? '<span class="card-draft-badge">草稿</span>' : ''}
        <span class="card-mood ${m.color}">${m.label}</span>
        ${j.title ? `<div class="card-title">${escHTML(j.title)}</div>` : ''}
        <div class="card-text">${escHTML(j.text)}</div>
        <div class="card-footer">
          <span class="card-time">${fmtTime(j.time)}</span>
          <div class="card-actions">
            <button class="card-action-btn fav-btn ${isFav ? 'fav-active' : ''}" data-id="${j.id}" title="${isFav ? '取消收藏' : '收藏'}">
              ${isFav ? '❤️' : '🤍'}
            </button>
            ${isDraft || j.mine !== false ? `<button class="card-action-btn delete-btn" data-id="${j.id}" title="删除">🗑️</button>` : ''}
            <button class="card-action-btn view-btn" data-id="${j.id}" title="查看详情">👁️</button>
          </div>
        </div>
      </div>`;
  }

  function escHTML(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  /* ============ 卡片交互绑定 ============ */
  function bindCardActions(container) {
    container.querySelectorAll('.fav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFav(btn.dataset.id);
      });
    });
    container.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteJournal(btn.dataset.id);
      });
    });
    container.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        showDetail(btn.dataset.id);
      });
    });
  }

  /* ============ 收藏/取消收藏 ============ */
  function toggleFav(id) {
    const j = journals.find(j => j.id === id);
    if (!j) return;
    j.favorited = !j.favorited;
    saveAndRefresh();
    showToast(j.favorited ? '已收藏 💜' : '已取消收藏');
  }

  /* ============ 删除 ============ */
  function deleteJournal(id) {
    if (!confirm('确定要删除这篇手账吗？')) return;
    journals = journals.filter(j => j.id !== id);
    saveAndRefresh();
    showToast('已删除');
  }

  /* ============ 详情弹窗 ============ */
  function showDetail(id) {
    const j = journals.find(j => j.id === id);
    if (!j) return;
    const m = getMood(j.mood);
    const body = $('#modalBody');
    body.innerHTML = `
      <span class="detail-mood ${m.color}">${m.label}</span>
      ${j.title ? `<div class="detail-title">${escHTML(j.title)}</div>` : ''}
      <div class="detail-text">${escHTML(j.text)}</div>
      <div class="detail-meta">
        <span>${fmtTime(j.time)}</span>
        <span>${j.status === 'draft' ? '草稿' : '已发布'}</span>
      </div>`;
    $('#modalOverlay').classList.add('show');
  }

  function initModal() {
    $('#modalClose').addEventListener('click', () => {
      $('#modalOverlay').classList.remove('show');
    });
    $('#modalOverlay').addEventListener('click', (e) => {
      if (e.target === $('#modalOverlay')) {
        $('#modalOverlay').classList.remove('show');
      }
    });
  }

  /* ============ 写心情 ============ */
  function initWrite() {
    // 渲染情绪标签
    const tagsEl = $('#moodTags');
    tagsEl.innerHTML = MOODS.map(m =>
      `<button class="mood-tag" data-mood="${m.key}">${m.label}</button>`
    ).join('');

    tagsEl.querySelectorAll('.mood-tag').forEach(tag => {
      tag.addEventListener('click', () => {
        tagsEl.querySelectorAll('.mood-tag').forEach(t => t.classList.remove('active'));
        tag.classList.add('active');
        selectedMood = tag.dataset.mood;
      });
    });

    // 字数统计
    const textarea = $('#writeContent');
    textarea.addEventListener('input', () => {
      $('#writeCharCount').textContent = textarea.value.length;
    });

    // 存草稿
    $('#saveDraftBtn').addEventListener('click', () => {
      const text = textarea.value.trim();
      if (!text) { showToast('请先写点什么吧'); return; }
      journals.push({
        id: genId(),
        mood: selectedMood || 'calm',
        title: $('#writeTitle').value.trim(),
        text,
        time: new Date().toISOString(),
        status: 'draft',
        favorited: false,
        mine: true,
      });
      saveAndRefresh();
      resetWriteForm();
      showToast('已存为草稿 📝');
      switchPage('journal');
    });

    // 发布
    $('#publishBtn').addEventListener('click', () => {
      const text = textarea.value.trim();
      if (!text) { showToast('请先写点什么吧'); return; }
      if (!selectedMood) { showToast('请选择一个情绪标签'); return; }
      journals.push({
        id: genId(),
        mood: selectedMood,
        title: $('#writeTitle').value.trim(),
        text,
        time: new Date().toISOString(),
        status: 'published',
        favorited: false,
        mine: true,
      });
      saveAndRefresh();
      resetWriteForm();
      showToast('发布成功 ☁️');
      switchPage('home');
    });
  }

  function resetWriteForm() {
    $('#writeTitle').value = '';
    $('#writeContent').value = '';
    $('#writeCharCount').textContent = '0';
    selectedMood = null;
    $$('.mood-tag').forEach(t => t.classList.remove('active'));
  }

  /* ============ 我的手账 ============ */
  function renderJournal() {
    try {
      let list = journals.slice().reverse();
      if (currentFilter === 'published') list = list.filter(j => j.status === 'published');
      else if (currentFilter === 'draft') list = list.filter(j => j.status === 'draft');

      const grid = $('#journalList');
      const empty = $('#journalEmpty');
      if (!grid) return;
      if (list.length === 0) {
        grid.innerHTML = '';
        if (empty) empty.style.display = '';
      } else {
        if (empty) empty.style.display = 'none';
        grid.innerHTML = list.map(j => cardHTML(j)).join('');
        bindCardActions(grid);
      }
    } catch (e) { console.error('renderJournal error:', e); }
  }

  function initJournalFilter() {
    $$('#journalFilter .filter-tag').forEach(tag => {
      tag.addEventListener('click', () => {
        $$('#journalFilter .filter-tag').forEach(t => t.classList.remove('active'));
        tag.classList.add('active');
        currentFilter = tag.dataset.filter;
        renderJournal();
      });
    });
  }

  /* ============ 收藏页 ============ */
  function renderFavorites() {
    try {
      const list = journals.filter(j => j.favorited).reverse();
      const grid = $('#favList');
      const empty = $('#favEmpty');
      if (!grid) return;
      if (list.length === 0) {
        grid.innerHTML = '';
        if (empty) empty.style.display = '';
      } else {
        if (empty) empty.style.display = 'none';
        grid.innerHTML = list.map(j => cardHTML(j)).join('');
        bindCardActions(grid);
      }
    } catch (e) { console.error('renderFavorites error:', e); }
  }

  /* ============ 设置页 ============ */
  function renderSettings() {
    try {
      const nickname = Store.get('nickname', '');
      const nickInput = $('#nicknameInput');
      if (nickInput) nickInput.value = nickname;
      const published = journals.filter(j => j.status === 'published').length;
      const pubCount = $('#myPublishCount');
      if (pubCount) pubCount.textContent = `已发布 ${published} 篇手账`;

      const currentTheme = Store.get('theme', 'light');
      $$('.theme-opt').forEach(opt => {
        opt.classList.toggle('active', opt.dataset.theme === currentTheme);
      });
    } catch (e) { console.error('renderSettings error:', e); }
  }

  function initSettings() {
    // 保存昵称
    $('#saveNicknameBtn').addEventListener('click', () => {
      const name = $('#nicknameInput').value.trim();
      Store.set('nickname', name);
      showToast(name ? `昵称已设为「${name}」` : '昵称已清除');
    });

    // 主题切换
    $$('.theme-opt').forEach(opt => {
      opt.addEventListener('click', () => {
        const theme = opt.dataset.theme;
        Store.set('theme', theme);
        applyTheme(theme);
        $$('.theme-opt').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
      });
    });

    // 导出数据
    $('#exportBtn').addEventListener('click', () => {
      const data = {
        journals,
        nickname: Store.get('nickname', ''),
        theme: Store.get('theme', 'light'),
        exportTime: new Date().toISOString(),
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `云端手账_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      showToast('数据已导出');
    });

    // 清空数据
    $('#clearDataBtn').addEventListener('click', () => {
      if (!confirm('确定要清空所有数据吗？此操作不可恢复！')) return;
      journals = [];
      Store.remove('journals');
      Store.remove('nickname');
      Store.remove('skipWelcome');
      saveAndRefresh();
      showToast('数据已清空');
    });
  }

  /* ============ 主题 ============ */
  function applyTheme(theme) {
    document.body.classList.toggle('theme-night', theme === 'night');
    $('#themeToggle').textContent = theme === 'night' ? '☀️' : '🌙';
  }

  function initTheme() {
    const theme = Store.get('theme', 'light');
    applyTheme(theme);

    $('#themeToggle').addEventListener('click', () => {
      const current = Store.get('theme', 'light');
      const next = current === 'night' ? 'light' : 'night';
      Store.set('theme', next);
      applyTheme(next);
      // 同步设置页按钮
      $$('.theme-opt').forEach(o => o.classList.toggle('active', o.dataset.theme === next));
    });
  }

  /* ============ 保存 & 刷新 ============ */
  function saveAndRefresh() {
    Store.set('journals', journals);
    // 刷新当前可见页面
    const activePage = $('.page.active');
    if (activePage) {
      const name = activePage.dataset.page;
      if (name === 'home') renderHome();
      if (name === 'journal') renderJournal();
      if (name === 'favorites') renderFavorites();
      if (name === 'settings') renderSettings();
    }
  }

  /* ============ 初始化 ============ */
  function init() {
    const steps = [
      { name: 'initWelcome', fn: initWelcome },
      { name: 'initNav', fn: initNav },
      { name: 'initTheme', fn: initTheme },
      { name: 'initWrite', fn: initWrite },
      { name: 'initJournalFilter', fn: initJournalFilter },
      { name: 'initModal', fn: initModal },
      { name: 'initSettings', fn: initSettings },
      { name: 'renderHome', fn: renderHome },
    ];
    for (const step of steps) {
      try { step.fn(); }
      catch (e) { console.error(step.name + ' error:', e); }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
