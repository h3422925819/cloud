/**
 * 云端情绪手账 - 交互逻辑
 */
(function () {
  'use strict';

  /* ============ 工具函数 ============ */
  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => [...(ctx || document).querySelectorAll(sel)];
  const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  /* ============ 欢迎弹窗 + 背景音乐 ============ */
  let bgAudioCtx = null;
  let bgMusicPlaying = false;
  let bgMusicTimer = null;
  let bgNoteIdx = 0;
  let bgMasterGain = null;
  let bgReverb = null;
  let bgFilter = null;

  // 创建混响脉冲响应（模拟音乐厅混响）
  function createReverbIR(ctx, duration, decay) {
    const len = ctx.sampleRate * duration;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  // 背景音乐旋律 — 宫调式柔美旋律
  const BG_MELODY = [
    { freq: 523.25, dur: 900 },  // C5
    { freq: 587.33, dur: 700 },  // D5
    { freq: 659.25, dur: 900 },  // E5
    { freq: 523.25, dur: 700 },  // C5
    { freq: 440.00, dur: 1000 }, // A4
    { freq: 392.00, dur: 700 },  // G4
    { freq: 440.00, dur: 900 },  // A4
    { freq: 523.25, dur: 1200 }, // C5
    { freq: 587.33, dur: 700 },  // D5
    { freq: 659.25, dur: 900 },  // E5
    { freq: 783.99, dur: 700 },  // G5
    { freq: 659.25, dur: 900 },  // E5
    { freq: 523.25, dur: 1200 }, // C5
    { freq: 440.00, dur: 700 },  // A4
    { freq: 392.00, dur: 900 },  // G4
    { freq: 349.23, dur: 1400 }, // F4
  ];
  const BG_CHORDS = [
    [130.81, 164.81, 196.00], // C
    [130.81, 164.81, 196.00], // C
    [130.81, 164.81, 196.00], // C
    [130.81, 164.81, 196.00], // C
    [110.00, 130.81, 164.81], // Am
    [98.00,  123.47, 146.83], // G
    [110.00, 130.81, 164.81], // Am
    [130.81, 164.81, 196.00], // C
    [146.83, 174.61, 220.00], // Dm
    [146.83, 174.61, 220.00], // Dm
    [130.81, 164.81, 196.00], // C
    [130.81, 164.81, 196.00], // C
    [130.81, 164.81, 196.00], // C
    [110.00, 130.81, 164.81], // Am
    [98.00,  123.47, 146.83], // G
    [87.31,  130.81, 174.61], // F
  ];

  function initBgAudio() {
    if (bgAudioCtx) return;
    bgAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    // 主音量
    bgMasterGain = bgAudioCtx.createGain();
    bgMasterGain.gain.value = 0.35;
    // 低通滤波器：去掉高频刺耳感
    bgFilter = bgAudioCtx.createBiquadFilter();
    bgFilter.type = 'lowpass';
    bgFilter.frequency.value = 1800;
    bgFilter.Q.value = 0.5;
    // 混响
    bgReverb = bgAudioCtx.createConvolver();
    bgReverb.buffer = createReverbIR(bgAudioCtx, 2.5, 3);
    // 信号链：filter → masterGain → destination
    //                   → reverb → destination（湿信号）
    bgFilter.connect(bgMasterGain);
    bgMasterGain.connect(bgAudioCtx.destination);
    bgFilter.connect(bgReverb);
    bgReverb.connect(bgAudioCtx.destination);
  }

  function playBgNote() {
    if (!bgAudioCtx || !bgMusicPlaying) return;
    const note = BG_MELODY[bgNoteIdx % BG_MELODY.length];
    const chord = BG_CHORDS[bgNoteIdx % BG_CHORDS.length];
    const now = bgAudioCtx.currentTime;
    const dur = note.dur / 1000;

    // 旋律：双振荡器微调合唱 + 柔和淡入淡出
    [0, 3].forEach(detune => {
      const osc = bgAudioCtx.createOscillator();
      const gain = bgAudioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = note.freq;
      osc.detune.value = detune;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.15);
      gain.gain.setValueAtTime(0.08, now + dur * 0.55);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
      osc.connect(gain);
      gain.connect(bgFilter);
      osc.start(now);
      osc.stop(now + dur + 0.1);
    });

    // 和弦垫音：低八度 + 合唱微调
    chord.forEach((freq, ci) => {
      [0, 5].forEach(detune => {
        const cOsc = bgAudioCtx.createOscillator();
        const cGain = bgAudioCtx.createGain();
        cOsc.type = 'sine';
        cOsc.frequency.value = freq;
        cOsc.detune.value = detune + ci;
        cGain.gain.setValueAtTime(0, now);
        cGain.gain.linearRampToValueAtTime(0.02, now + 0.3);
        cGain.gain.setValueAtTime(0.02, now + dur * 0.65);
        cGain.gain.exponentialRampToValueAtTime(0.001, now + dur);
        cOsc.connect(cGain);
        cGain.connect(bgFilter);
        cOsc.start(now);
        cOsc.stop(now + dur + 0.1);
      });
    });

    bgNoteIdx++;
    bgMusicTimer = setTimeout(playBgNote, note.dur);
  }

  function startBgMusic() {
    if (bgMusicPlaying) return;
    initBgAudio();
    if (bgAudioCtx.state === 'suspended') bgAudioCtx.resume();
    bgMusicPlaying = true;
    bgNoteIdx = 0;
    playBgNote();
    const btn = $('#bgMusicBtn');
    if (btn) { btn.classList.add('playing'); btn.textContent = '🎶'; }
    // 8秒后自动淡出停止
    setTimeout(() => {
      if (bgMasterGain) {
        bgMasterGain.gain.linearRampToValueAtTime(0, bgAudioCtx.currentTime + 2);
      }
      setTimeout(stopBgMusic, 2200);
    }, 8000);
  }

  function stopBgMusic() {
    bgMusicPlaying = false;
    clearTimeout(bgMusicTimer);
    const btn = $('#bgMusicBtn');
    if (btn) { btn.classList.remove('playing'); btn.textContent = '🎵'; }
  }

  function toggleBgMusic() {
    bgMusicPlaying ? stopBgMusic() : startBgMusic();
  }

  // 欢迎弹窗 + 沉浸式入场
  const welcomeOverlay = $('#welcomeOverlay');
  const welcomeBtn = $('#welcomeBtn');
  const bgMusicBtn = $('#bgMusicBtn');
  const welcomeTitle = $('#welcomeTitle');
  const welcomeSub = $('#welcomeSub');
  const welcomeStars = $('#welcomeStars');

  // 欢迎页显示时禁止页面滚动
  document.body.classList.add('welcome-active');

  // 生成星空
  if (welcomeStars) {
    for (let i = 0; i < 40; i++) {
      const star = document.createElement('div');
      star.className = 'w-star';
      star.style.left = Math.random() * 100 + '%';
      star.style.top = Math.random() * 100 + '%';
      star.style.animationDelay = (Math.random() * 3) + 's';
      star.style.animationDuration = (2 + Math.random() * 2) + 's';
      star.style.width = star.style.height = (2 + Math.random() * 3) + 'px';
      welcomeStars.appendChild(star);
    }
  }

  // 逐字显示标题和副标题
  const titleText = '云端情绪手账';
  const subText = '把心事藏进云朵，与温柔不期而遇';
  let titleIdx = 0, subIdx = 0;

  function typeTitle() {
    if (titleIdx <= titleText.length) {
      welcomeTitle.textContent = titleText.slice(0, titleIdx);
      titleIdx++;
      setTimeout(typeTitle, 120);
    } else {
      setTimeout(typeSub, 300);
    }
  }
  function typeSub() {
    if (subIdx <= subText.length) {
      welcomeSub.textContent = subText.slice(0, subIdx);
      subIdx++;
      setTimeout(typeSub, 60);
    } else {
      // 显示按钮
      welcomeBtn.classList.add('show');
    }
  }
  // 启动打字
  setTimeout(typeTitle, 800);

  // 点击进入 - 沉浸式过渡
  welcomeBtn.addEventListener('click', () => {
    welcomeBtn.style.pointerEvents = 'none';
    welcomeOverlay.classList.add('fade-out');

    // 启动过渡裂开动画
    const transOverlay = $('#transitionOverlay');
    if (transOverlay) {
      transOverlay.classList.add('active');
    }

    setTimeout(() => {
      welcomeOverlay.style.display = 'none';
      document.body.classList.remove('welcome-active');
      // 首页元素逐个入场
      triggerHomeEntrance();
    }, 800);

    // 过渡动画结束后移除遮罩
    setTimeout(() => {
      if (transOverlay) transOverlay.classList.add('done');
      setTimeout(() => { if (transOverlay) transOverlay.style.display = 'none'; }, 600);
    }, 1600);

    // 自动播放背景音乐
    startBgMusic();
  });

  // 首页元素逐个入场动画
  function triggerHomeEntrance() {
    const homePage = $('[data-page="home"]');
    if (!homePage) return;
    const sections = homePage.querySelectorAll('.home-mood-weather, .home-shortcuts, .home-stats, .home-recent, .home-featured');
    sections.forEach((el, i) => {
      el.classList.add('section-enter');
      el.style.animationDelay = (i * 0.15) + 's';
    });
  }

  // 右上角音乐开关
  bgMusicBtn.addEventListener('click', toggleBgMusic);

  // localStorage 操作
  const Store = {
    get(key, fallback) {
      try { const v = localStorage.getItem('cloudJournal_' + key); return v ? JSON.parse(v) : fallback; }
      catch { return fallback; }
    },
    set(key, val) {
      localStorage.setItem('cloudJournal_' + key, JSON.stringify(val));
    }
  };

  // 吐司通知
  function showToast(msg, duration = 2200) {
    let t = $('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), duration);
  }

  // 格式化时间
  function fmtTime(ts) {
    const d = new Date(ts);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  /* ============ 数据管理 ============ */
  const MOODS = [
    { key: 'happy', label: '开心', icon: '😊', cls: 'mood-happy' },
    { key: 'confused', label: '迷茫', icon: '😶‍🌫️', cls: 'mood-confused' },
    { key: 'healed', label: '治愈', icon: '🌿', cls: 'mood-healed' },
    { key: 'lonely', label: '孤独', icon: '🌙', cls: 'mood-lonely' },
    { key: 'angry', label: '生气', icon: '💢', cls: 'mood-angry' },
    { key: 'sad', label: '难过', icon: '💧', cls: 'mood-sad' },
    { key: 'calm', label: '平静', icon: '🍃', cls: 'mood-calm' },
  ];

  // 预置"他人"手账（用于拾云）
  const PRESET_JOURNALS = [
    { id: 'p1', mood: 'happy', text: '今天在街角遇到了一只橘猫，它蹭了蹭我的裤脚，那一刻整个世界都变温柔了。', time: Date.now() - 86400000 * 2, author: '云旅客' },
    { id: 'p2', mood: 'lonely', text: '深夜的房间里只有键盘声，有时候觉得孤独像一片海，而我在海上漂流。', time: Date.now() - 86400000 * 5, author: '夜行人' },
    { id: 'p3', mood: 'healed', text: '窗外的雨停了，空气里有泥土的香味，忽然觉得活着真好。', time: Date.now() - 86400000 * 1, author: '听雨者' },
    { id: 'p4', mood: 'confused', text: '站在人生的十字路口，每条路都看不清尽头，但至少我还在走。', time: Date.now() - 86400000 * 3, author: '迷途人' },
    { id: 'p5', mood: 'sad', text: '有些告别没有声音，就像秋天的叶子落地，无声无息却让人心疼。', time: Date.now() - 86400000 * 4, author: '拾叶人' },
    { id: 'p6', mood: 'calm', text: '泡了一杯茶，看了半小时的云，什么都没想，什么都没做，却觉得充实。', time: Date.now() - 86400000 * 0.5, author: '观云客' },
    { id: 'p7', mood: 'happy', text: '收到了很久不联系的朋友的消息，只说了句"想你了"，眼泪就掉下来了。', time: Date.now() - 86400000 * 6, author: '等风来' },
    { id: 'p8', mood: 'angry', text: '明明很努力了却还是被否定，但我不想放弃，因为我值得更好的。', time: Date.now() - 86400000 * 1.5, author: '逆风者' },
    { id: 'p9', mood: 'healed', text: '把旧照片翻出来看，那些笑着的脸提醒我，快乐是真实存在过的。', time: Date.now() - 86400000 * 7, author: '忆光者' },
    { id: 'p10', mood: 'lonely', text: '万家灯火里没有一盏为我亮着，但我知道，我也可以做自己的光。', time: Date.now() - 86400000 * 2.5, author: '寻光人' },
    { id: 'p11', mood: 'calm', text: '今天的晚霞特别好看，渐变的橙色和紫色，像天空打翻了调色盘。', time: Date.now() - 86400000 * 0.2, author: '追霞客' },
    { id: 'p12', mood: 'happy', text: '学会了一首新歌，虽然跑调但唱得很开心，快乐不需要观众。', time: Date.now() - 86400000 * 3.5, author: '歌唱者' },
  ];

  // 治愈短句库
  const HEAL_QUOTES = [
    { text: '你不必总是坚强，偶尔脆弱也没关系。', author: '云精灵' },
    { text: '世界上总有一个人，愿意听你说废话。', author: '云精灵' },
    { text: '今天辛苦了，你已经做得很好了。', author: '云精灵' },
    { text: '每一朵乌云都镶着银边，低谷之后必是上坡。', author: '云精灵' },
    { text: '允许自己慢一点，花开需要时间。', author: '云精灵' },
    { text: '你值得被温柔以待，包括被自己。', author: '云精灵' },
    { text: '难过的时候抱抱自己，你比想象中更勇敢。', author: '云精灵' },
    { text: '生活不会一直晴天，但雨后总会有彩虹。', author: '云精灵' },
    { text: '所有的失去，都会以另一种方式归来。', author: '云精灵' },
    { text: '慢慢来，比较快。', author: '云精灵' },
    { text: '你笑起来真好看，像好天气。', author: '云精灵' },
    { text: '这世界偷偷爱着你，只是你不知道而已。', author: '云精灵' },
  ];

  // AI 回复库
  const AI_RESPONSES = {
    happy: [
      '看到你开心，云精灵也跟着快乐起来了呢！✨',
      '你的快乐像阳光一样温暖了整片云海～',
      '把这份快乐装进云朵里，它会在你需要的时候发光！',
    ],
    sad: [
      '难过的时候就哭出来吧，云朵会接住你的眼泪💧',
      '我在呢，虽然不能替你难过，但可以陪你一起。☁️',
      '低谷只是暂时的，云层之上永远有阳光等你。',
    ],
    angry: [
      '深呼吸，让怒气慢慢散去，就像云被风吹散一样🌬️',
      '生气是正常的，但别让情绪控制了你，你是云的主人。',
      '把不愉快写进手账里，让云朵帮你带走它。',
    ],
    confused: [
      '迷茫也没关系，有些路走着走着就清晰了🌫️',
      '停下来看看云，答案也许就在风里。',
      '不用急着找到方向，漫无目的也是一种风景。',
    ],
    lonely: [
      '你不是一个人，云精灵一直在☁️',
      '孤独的时候，抬头看看天空，那片云正在陪着你。',
      '独处是和自己对话的最好时光，好好珍惜这段宁静。',
    ],
    calm: [
      '平静是最珍贵的情绪，享受这一刻的安宁吧🍃',
      '你的内心像一面湖，风来涟漪，风去如镜。',
      '把这份平静分享给更多需要的人吧～',
    ],
    default: [
      '谢谢你的分享，云精灵会一直在这里陪着你～☁️',
      '把心事交给云朵吧，它会温柔地守护你的秘密。',
      '每一次倾诉都是勇敢，你很棒！',
    ],
  };

  // 成就定义
  const ACHIEVEMENTS = [
    { id: 'first_write', icon: '✍️', name: '初笔', desc: '写下第一篇手账', check: (s) => s.totalWritten >= 1 },
    { id: 'write_5', icon: '📝', name: '勤书者', desc: '累计写下5篇手账', check: (s) => s.totalWritten >= 5 },
    { id: 'write_10', icon: '📖', name: '手账达人', desc: '累计写下10篇手账', check: (s) => s.totalWritten >= 10 },
    { id: 'write_30', icon: '📚', name: '云中书仙', desc: '累计写下30篇手账', check: (s) => s.totalWritten >= 30 },
    { id: 'first_pick', icon: '📫', name: '拾云者', desc: '第一次拾取他人手账', check: (s) => s.totalPicked >= 1 },
    { id: 'pick_5', icon: '🕊️', name: '共鸣之心', desc: '拾取5封他人手账', check: (s) => s.totalPicked >= 5 },
    { id: 'first_fav', icon: '💜', name: '收藏家', desc: '收藏第一封手账', check: (s) => s.totalFavorited >= 1 },
    { id: 'fav_5', icon: '💎', name: '珍藏大师', desc: '收藏5封手账', check: (s) => s.totalFavorited >= 5 },
    { id: 'mood_all', icon: '🌈', name: '七色云虹', desc: '体验过全部7种情绪', check: (s) => s.moodTypes >= 7 },
    { id: 'streak_3', icon: '🔥', name: '三日书写', desc: '连续3天写手账', check: (s) => s.streak >= 3 },
    { id: 'streak_7', icon: '⭐', name: '一周坚持', desc: '连续7天写手账', check: (s) => s.streak >= 7 },
    { id: 'bubble_50', icon: '🫧', name: '泡泡猎手', desc: '解压游戏中戳破50个泡泡', check: (s) => s.bubblePopped >= 50 },
  ];

  /* ============ 3D入场 + 云层 + 粒子 ============ */
  const mainWrap = $('.wrap-main');
  window.addEventListener('load', () => {
    setTimeout(() => mainWrap.classList.remove('enter-anim'), 6500);
  });

  /* ============ 昼夜主题系统 ============ */
  let currentTheme = 'auto'; // auto | morning | afternoon | dusk | night
  let themeTimer = null;

  // 根据当前小时判断时段
  function getTimePeriod() {
    const h = new Date().getHours();
    if (h >= 6 && h < 11) return 'morning';
    if (h >= 11 && h < 17) return 'afternoon';
    if (h >= 17 && h < 20) return 'dusk';
    return 'night'; // 20:00-6:00
  }

  // 获取实际生效的主题
  function getActiveTheme() {
    return currentTheme === 'auto' ? getTimePeriod() : currentTheme;
  }

  // 应用主题
  function applyTheme(theme) {
    const body = document.body;
    body.classList.remove('theme-morning', 'theme-afternoon', 'theme-dusk', 'theme-night');
    body.classList.add('theme-' + theme);

    // 更新切换按钮高亮
    $$('.theme-opt').forEach(opt => {
      opt.classList.toggle('active', opt.getAttribute('data-theme') === currentTheme);
    });
  }

  // 自动检测并切换主题
  function autoSwitchTheme() {
    if (currentTheme !== 'auto') return;
    applyTheme(getTimePeriod());
  }

  // 初始化主题
  function initTheme() {
    // 读取保存的偏好
    const saved = Store.get('theme', 'auto');
    currentTheme = saved;
    if (currentTheme === 'auto') {
      applyTheme(getTimePeriod());
    } else {
      applyTheme(currentTheme);
    }

    // 每5分钟检测一次时段变化
    themeTimer = setInterval(autoSwitchTheme, 5 * 60 * 1000);

    // 绑定手动切换按钮
    $$('.theme-opt').forEach(opt => {
      opt.addEventListener('click', () => {
        const theme = opt.getAttribute('data-theme');
        currentTheme = theme;
        Store.set('theme', theme);
        if (theme === 'auto') {
          applyTheme(getTimePeriod());
        } else {
          applyTheme(theme);
        }
        const labels = { auto: '自动', morning: '清晨', afternoon: '午后', dusk: '黄昏', night: '深夜' };
        showToast(`🌤️ 已切换为${labels[theme]}模式`);
      });
    });
  }

  // 云层
  const cloudBox = $('#cloudBox');
  for (let i = 0; i < 16; i++) {
    const c = document.createElement('div');
    c.className = 'cloud';
    const w = Math.random() * 280 + 120;
    c.style.width = w + 'px';
    c.style.height = w * 0.42 + 'px';
    c.style.top = Math.random() * 100 + '%';
    c.style.animationDuration = (Math.random() * 18 + 16) + 's';
    cloudBox.appendChild(c);
  }

  // 粒子
  const particleBox = $('#particleBox');
  function addParticles(cls, count, durRange) {
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = cls;
      p.style.left = Math.random() * 100 + '%';
      p.style.animationDuration = (Math.random() * (durRange[1] - durRange[0]) + durRange[0]) + 's';
      particleBox.appendChild(p);
    }
  }
  addParticles('light-particle', 30, [9, 19]);
  addParticles('petal-particle', 18, [10, 22]);
  addParticles('fluff-particle', 22, [11, 25]);

  /* ============ 导航切换 ============ */
  const navItems = $$('.nav-item');
  const pages = $$('.note-paper');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(ni => ni.classList.remove('active'));
      item.classList.add('active');
      const target = item.getAttribute('data-target');
      pages.forEach(page => {
        page.classList.remove('active');
        if (page.getAttribute('data-page') === target) page.classList.add('active');
      });
      // 切换页面时刷新对应内容
      if (target === 'pick') renderPickPage();
      if (target === 'mine') renderMinePage();
      if (target === 'achievement') renderAchievementPage();
      if (target === 'cloudwall') renderCloudWall();
      if (target === 'relax') initRelaxPage();
    });
  });

  /* ============ 云精灵AI面板 ============ */
  const sprite = $('#sprite');
  const aiPanel = $('#aiPanel');
  const closeAi = $('#closeAi');
  const aiMessages = $('#aiMessages');
  const aiInput = $('#aiInput');
  const aiSendBtn = $('#aiSendBtn');

  sprite.addEventListener('click', () => {
    aiPanel.classList.toggle('show');
    // 首次打开时发送欢迎消息
    if (aiMessages && aiMessages.children.length === 0) {
      setTimeout(() => addAiMsg('bot', '嗨～我是云精灵 ☁️ 你的情绪陪伴伙伴！你可以和我聊聊心事，我会温柔地陪着你～'), 300);
    }
  });
  closeAi.addEventListener('click', () => aiPanel.classList.remove('show'));

  // 快捷按钮
  $$('#aiQuickActions .ai-quick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const msg = btn.getAttribute('data-msg');
      aiInput.value = msg;
      aiSendBtn.click();
    });
  });

  function addAiMsg(type, text) {
    if (!aiMessages) return;
    const msg = document.createElement('div');
    msg.className = 'ai-msg ' + type;
    msg.textContent = text;
    aiMessages.appendChild(msg);
    aiMessages.scrollTop = aiMessages.scrollHeight;
  }

  function addAiTyping() {
    if (!aiMessages) return;
    const typing = document.createElement('div');
    typing.className = 'ai-msg bot';
    typing.id = 'aiTypingIndicator';
    typing.innerHTML = '<span class="typing-dots">云精灵正在思考</span>';
    aiMessages.appendChild(typing);
    aiMessages.scrollTop = aiMessages.scrollHeight;
  }

  function removeAiTyping() {
    const t = $('#aiTypingIndicator');
    if (t) t.remove();
  }

  function getAiResponse(text) {
    const lower = text.toLowerCase();

    // 润色文字请求
    if (/润色|修改|改写|优化|美化/.test(lower)) {
      const polishTips = [
        '好的，你可以把你写的手账文字发给我，我来帮你润色得更加温柔细腻 ✨',
        '把你想润色的文字发过来吧，我会帮你加上诗意的修辞 ☁️',
        '发来吧～我会在保留你真情实感的基础上，让文字更优美 📝',
      ];
      return polishTips[Math.floor(Math.random() * polishTips.length)];
    }

    // 治愈请求
    if (/治愈|安慰|鼓励|加油|温暖|打气/.test(lower)) {
      const healPool = [
        '你真的很棒，即使觉得不够好，你也在努力生活着，这本身就闪闪发光 ✨',
        '无论今天多么疲惫，今晚的云朵都会替你盖上温柔的被子 🌙',
        '允许自己不完美，允许自己偶尔停下来，你已经比昨天更好了 🌿',
        '这世界总有一束光，是为你而亮的，只是你还没看到而已 💫',
        '你值得世界上所有的温柔，不要怀疑这一点 💜',
      ];
      return healPool[Math.floor(Math.random() * healPool.length)];
    }

    // 感谢
    if (/谢谢|感谢|多谢|thanks/.test(lower)) {
      const thanksPool = [
        '不用谢呀，能陪你说说话，云精灵也很开心呢 ☁️',
        '你的感谢让云朵都变得更柔软了 💜',
        '随时都可以找我聊天，我一直都在～ 🌸',
      ];
      return thanksPool[Math.floor(Math.random() * thanksPool.length)];
    }

    // 开心情绪
    if (/开心|高兴|快乐|幸福|美好|棒|太好了|嘻嘻|哈哈|好开心|好高兴|好幸福/.test(lower)) {
      const pool = [
        '看到你开心，云精灵也跟着快乐起来了呢！✨ 把这份快乐装进云朵里吧～',
        '你的快乐像阳光一样温暖了整片云海！快去写一篇开心手账记录下来吧 🌤️',
        '好棒呀！开心的日子值得被记住，要不要写篇手账把这份快乐存起来？📝',
        '嘻嘻，你的笑容一定很好看！把这份美好分享给云端的大家吧 💜',
      ];
      return pool[Math.floor(Math.random() * pool.length)];
    }

    // 难过情绪
    if (/难过|伤心|哭泣|哭|眼泪|心痛|心碎|悲伤|不好受|好难受|好难过|好伤心/.test(lower)) {
      const pool = [
        '难过的时候就哭出来吧，云朵会接住你的眼泪，让雨过天晴 ☁️💧',
        '我在呢，虽然不能替你难过，但可以陪你一起走过这段路 🤗',
        '低谷只是暂时的，云层之上永远有阳光等你。要不要试着写下来？倾诉会让人轻松一些 📝',
        '心疼你…但请相信，这份难过终会变成你生命里柔软的云层 💜',
        '你不是一个人在承受，把心事告诉云精灵吧，我会一直听着 🌙',
      ];
      return pool[Math.floor(Math.random() * pool.length)];
    }

    // 生气情绪
    if (/生气|愤怒|烦|讨厌|可恶|火大|气死|好烦|好气|受不了/.test(lower)) {
      const pool = [
        '深呼吸～吸气…呼气…让怒气像云一样慢慢散去 🌬️',
        '生气是正常的，你的感受很重要。试着把不满写进手账，让云朵帮你带走它 📝',
        '别让情绪控制了你，你是云的主人。先让自己冷静一下，再来面对 💪',
        '我理解你的愤怒，但别伤害自己。去泡泡解压游戏戳几个泡泡吧 🫧',
      ];
      return pool[Math.floor(Math.random() * pool.length)];
    }

    // 迷茫情绪
    if (/迷茫|困惑|不知道|迷失|找不到|方向|怎么办|该不该|好迷茫/.test(lower)) {
      const pool = [
        '迷茫也没关系，有些路走着走着就清晰了。停下来看看云，答案也许就在风里 🌫️',
        '不用急着找到方向，漫无目的也是一种风景。每一步都算数的 🍃',
        '所有伟大的旅程都始于迷路。相信自己，你终会找到属于自己的那片天空 ☁️',
        '迷茫说明你在思考，这本身就很了不起。把困惑写下来，也许答案会自己浮现 📝',
      ];
      return pool[Math.floor(Math.random() * pool.length)];
    }

    // 孤独情绪
    if (/孤独|寂寞|一个人|没朋友|没人|孤单|好孤独|好寂寞|没人陪/.test(lower)) {
      const pool = [
        '你不是一个人，云精灵一直在 ☁️ 随时都可以找我聊天～',
        '孤独的时候，抬头看看天空，那片云正在默默陪着你 🌙',
        '独处是和自己对话的最好时光，好好珍惜这段宁静，你会变得更强大 💜',
        '在云端的另一边，也许有人和你一样望着天空。去拾云之页看看别人的心事吧 📫',
      ];
      return pool[Math.floor(Math.random() * pool.length)];
    }

    // 平静情绪
    if (/平静|安宁|放松|自在|舒服|宁静|还好|不错/.test(lower)) {
      const pool = [
        '平静是最珍贵的情绪，享受这一刻的安宁吧 🍃',
        '你的内心像一面湖，风来涟漪，风去如镜。这份平静值得被记录 📝',
        '在忙碌的世界里保持平静，是一种了不起的能力 💜',
      ];
      return pool[Math.floor(Math.random() * pool.length)];
    }

    // 默认回复
    const defaultPool = [
      '谢谢你的分享，云精灵会一直在这里陪着你～ ☁️',
      '把心事交给云朵吧，它会温柔地守护你的秘密 🌙',
      '每一次倾诉都是勇敢，你很棒！要不要写篇手账记录此刻的心情？📝',
      '我在听呢，继续说吧，云精灵不会评判你 💜',
      '嗯嗯，我理解你的感受。有时候只是需要有人说说话，对吧？🤗',
      '无论经历什么，都请善待自己。你值得这世间所有的温柔 ☁️✨',
    ];
    return defaultPool[Math.floor(Math.random() * defaultPool.length)];
  }

  function sendAiMessage() {
    const text = aiInput.value.trim();
    if (!text) return;
    addAiMsg('user', text);
    aiInput.value = '';
    // 显示"正在思考"
    addAiTyping();
    // 模拟思考延迟
    const delay = 800 + Math.random() * 1200;
    setTimeout(() => {
      removeAiTyping();
      addAiMsg('bot', getAiResponse(text));
    }, delay);
  }

  aiSendBtn.addEventListener('click', sendAiMessage);

  // 回车发送
  aiInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendAiMessage();
    }
  });

  /* ============ 页面1：云扉首页 ============ */
  // 写下心情弹窗
  let selectedMood = null;

  function getGreeting() {
    const h = new Date().getHours();
    if (h < 6) return { icon: '🌙', text: '夜深了', desc: '星光温柔，给自己一个拥抱，晚安' };
    if (h < 9) return { icon: '🌅', text: '早安', desc: '新的一天像一朵刚绽放的云，去拥抱它吧' };
    if (h < 12) return { icon: '☀️', text: '上午好', desc: '阳光正好，微风不燥，今天也值得期待' };
    if (h < 14) return { icon: '🌤️', text: '中午好', desc: '吃饱了就眯一会儿，云朵也在午睡呢' };
    if (h < 17) return { icon: '⛅', text: '下午好', desc: '来杯茶歇一歇，让心情随云飘一会儿' };
    if (h < 19) return { icon: '🌇', text: '傍晚好', desc: '晚霞正在天空画画，记得抬头看看' };
    if (h < 22) return { icon: '🌙', text: '晚上好', desc: '卸下今天的疲惫，让云朵替你盖上被子' };
    return { icon: '🌌', text: '夜深了', desc: '有些话只适合和星星说，写下来吧' };
  }

  function renderHomeFull() {
    // 情绪天气卡
    const weatherEl = $('#homeMoodWeather');
    if (weatherEl) {
      const g = getGreeting();
      const journals = Store.get('journals', []);
      const todayJ = journals.filter(j => {
        const d = new Date(j.time);
        const t = new Date();
        return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
      });
      let moodHint = '';
      if (todayJ.length > 0) {
        const mood = MOODS.find(m => m.key === todayJ[0].mood);
        moodHint = ` · 今天的心情是 ${mood ? mood.icon + mood.label : ''}`;
      } else {
        moodHint = ' · 今天还没记录心情哦';
      }
      weatherEl.innerHTML = `
        <div class="mood-weather-icon">${g.icon}</div>
        <div class="mood-weather-info">
          <div class="mood-weather-greeting">${g.text}${moodHint}</div>
          <div class="mood-weather-desc">${g.desc}</div>
        </div>
      `;
    }

    // 统计概览
    const statsEl = $('#homeStats');
    if (statsEl) {
      const journals = Store.get('journals', []);
      const stats = getStats();
      const allFluffs = getCloudFluffs();
      const published = journals.filter(j => j.status === 'published').length;
      const streak = calcStreak(journals);
      const moodTypes = new Set(journals.map(j => j.mood)).size;
      statsEl.innerHTML = `
        <div class="home-stat-card">
          <div class="hs-icon">📝</div>
          <div class="hs-num">${published}</div>
          <div class="hs-label">已发布手账</div>
        </div>
        <div class="home-stat-card">
          <div class="hs-icon">🔥</div>
          <div class="hs-num">${streak}</div>
          <div class="hs-label">连续书写天数</div>
        </div>
        <div class="home-stat-card">
          <div class="hs-icon">🌈</div>
          <div class="hs-num">${moodTypes}/7</div>
          <div class="hs-label">探索的情绪</div>
        </div>
        <div class="home-stat-card">
          <div class="hs-icon">☁️</div>
          <div class="hs-num">${allFluffs.length}</div>
          <div class="hs-label">云端云絮</div>
        </div>
      `;
    }

    // 最近手账
    renderHomeRecent();

    // 精选云絮
    renderHomeFeatured();
  }

  // 首页最近手账展示
  function renderHomeRecent() {
    const recentArea = $('#homeRecent');
    if (!recentArea) return;
    const journals = Store.get('journals', []).filter(j => j.status === 'published').slice(0, 3);
    if (journals.length === 0) {
      recentArea.innerHTML = `
        <div class="home-section-title">最近的心情</div>
        <div class="empty-state"><div class="empty-icon">☁️</div>还没有手账，点击上方按钮写下第一篇吧</div>
      `;
      return;
    }
    recentArea.innerHTML = `
      <div class="home-section-title">最近的心情</div>
      <div class="card-list">
        ${journals.map(j => renderCardHTML(j)).join('')}
      </div>
    `;
  }

  function renderHomeFeatured() {
    const featuredEl = $('#homeFeatured');
    if (!featuredEl) return;
    const fluffs = getCloudFluffs().slice(0, 3);
    if (fluffs.length === 0) return;
    featuredEl.innerHTML = `
      <div class="home-section-title">精选云絮</div>
      <div class="featured-fluffs">
        ${fluffs.map(f => {
          const mood = MOODS.find(m => m.key === f.mood);
          return `<div class="featured-fluff-card">
            <div class="ff-avatar">${f.avatar || '☁️'}</div>
            <div class="ff-text">${mood ? mood.icon + ' ' : ''}${f.text}</div>
            <div class="ff-meta">
              <span>${f.author || '匿名'}</span>
              <span class="ff-likes">🤍 ${f.likes || 0}</span>
            </div>
          </div>`;
        }).join('')}
      </div>
    `;
  }

  function openWriteModal() {
    selectedMood = null;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay show';
    overlay.id = 'writeModal';
    overlay.innerHTML = `
      <div class="modal-box">
        <h3>✍️ 写下今日心情</h3>
        <label>选择情绪</label>
        <div class="mood-tags" id="moodTags">
          ${MOODS.map(m => `<div class="mood-tag" data-mood="${m.key}">${m.icon} ${m.label}</div>`).join('')}
        </div>
        <label>标题</label>
        <input type="text" id="journalTitle" placeholder="给心情取个名字…" />
        <label>内容</label>
        <textarea id="journalContent" placeholder="把心事写在这里，云朵会替你守护…"></textarea>
        <div class="modal-btns">
          <button class="btn-outline" id="saveDraftBtn">存为草稿</button>
          <button class="btn-cancel" id="cancelWriteBtn">取消</button>
          <button class="btn" id="publishBtn">发布到云端</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // 情绪标签选择
    $$('#moodTags .mood-tag', overlay).forEach(tag => {
      tag.addEventListener('click', () => {
        $$('#moodTags .mood-tag', overlay).forEach(t => t.classList.remove('selected'));
        tag.classList.add('selected');
        selectedMood = tag.getAttribute('data-mood');
      });
    });

    // 取消
    $('#cancelWriteBtn', overlay).addEventListener('click', () => overlay.remove());

    // 存为草稿
    $('#saveDraftBtn', overlay).addEventListener('click', () => {
      saveJournal('draft');
      overlay.remove();
    });

    // 发布
    $('#publishBtn', overlay).addEventListener('click', () => {
      saveJournal('published');
      overlay.remove();
    });

    // 点击遮罩关闭
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }

  function saveJournal(status) {
    const title = $('#journalTitle')?.value.trim() || '';
    const content = $('#journalContent')?.value.trim() || '';
    if (!content) { showToast('请写点什么再保存哦～'); return; }
    if (!selectedMood) { showToast('请选择一种情绪标签'); return; }

    const journal = {
      id: genId(),
      mood: selectedMood,
      title,
      text: content,
      time: Date.now(),
      status, // 'draft' | 'published'
      favorited: false,
    };

    const journals = Store.get('journals', []);
    journals.unshift(journal);
    Store.set('journals', journals);

    // 更新统计
    updateStats();
    checkAchievements();

    if (status === 'draft') {
      showToast('草稿已保存 ☁️');
    } else {
      showToast('心情已飘向云端 🌤️');
    }
  }

  // 首页按钮绑定
  const homeBtn = $('#btnWrite');
  if (homeBtn) homeBtn.addEventListener('click', openWriteModal);

  /* ============ 页面2：匿名云絮墙 ============ */
  const ANON_AVATARS = ['☁️', '🌙', '⭐', '🌸', '🍃', '🦋', '🕊️', '💫', '🌈', '🍀'];
  const ANON_NAMES = ['云游客', '夜行者', '拾光人', '追风客', '听雨者', '观云人', '寻梦人', '等风来', '逐光者', '漫步人'];

  // 预置匿名云絮
  const PRESET_FLUFFS = [
    { id: 'f1', text: '希望明天的面试能顺利，紧张到睡不着 😰', mood: 'confused', avatar: '🌙', author: '夜行者', time: Date.now() - 3600000 * 2, likes: 5, likedByMe: false, replies: [{ author: '☁️ 观云人', text: '加油！你一定可以的 💪' }] },
    { id: 'f2', text: '今天在路上看到一对老爷爷老奶奶牵手散步，好羡慕这种细水长流的感情 🥹', mood: 'healed', avatar: '🌸', author: '拾光人', time: Date.now() - 3600000 * 5, likes: 12, likedByMe: false, replies: [{ author: '⭐ 追风客', text: '这才是爱情最好的样子呀～' }] },
    { id: 'f3', text: '有没有人和我一样，深夜emo的时候特别想吃火锅', mood: 'lonely', avatar: '☁️', author: '云游客', time: Date.now() - 3600000 * 8, likes: 8, likedByMe: false, replies: [] },
    { id: 'f4', text: '辞职了。不知道对不对，但至少现在不焦虑了 🍃', mood: 'calm', avatar: '🍃', author: '漫步人', time: Date.now() - 3600000 * 12, likes: 15, likedByMe: false, replies: [{ author: '💫 逐光者', text: '勇敢！人生就是要对自己好一点' }] },
    { id: 'f5', text: '偷偷说一句：我觉得我很棒，虽然没人夸我 🌟', mood: 'happy', avatar: '⭐', author: '追风客', time: Date.now() - 3600000 * 1, likes: 20, likedByMe: false, replies: [{ author: '🦋 寻梦人', text: '你真的很棒！云絮墙第一个夸你！✨' }, { author: '☁️ 观云人', text: '棒！继续发光！' }] },
    { id: 'f6', text: '毕业三年了，还是找不到方向，感觉被同龄人远远甩在身后', mood: 'confused', avatar: '🕊️', author: '等风来', time: Date.now() - 3600000 * 18, likes: 9, likedByMe: false, replies: [{ author: '🍀 漫步人', text: '每个人的时区不同，别着急 🤗' }] },
  ];

  function getCloudFluffs() {
    const mine = Store.get('cloudFluffs', []);
    // 恢复预置云絮的点赞和回复状态
    const likedMap = Store.get('fluffLiked', {});
    const replyStore = Store.get('fluffReplies', {});
    PRESET_FLUFFS.forEach(f => {
      f.likedByMe = likedMap[f.id] || false;
      if (replyStore[f.id]) f.replies = [...(f.replies || []), ...replyStore[f.id]];
    });
    return [...mine, ...PRESET_FLUFFS].sort((a, b) => b.time - a.time);
  }

  // 首页跳转到云絮墙
  const goCloudWallBtn = $('#goCloudWall');
  if (goCloudWallBtn) {
    goCloudWallBtn.addEventListener('click', () => {
      navItems.forEach(ni => ni.classList.remove('active'));
      const cwNav = [...navItems].find(n => n.getAttribute('data-target') === 'cloudwall');
      if (cwNav) cwNav.classList.add('active');
      pages.forEach(page => {
        page.classList.remove('active');
        if (page.getAttribute('data-page') === 'cloudwall') page.classList.add('active');
      });
      renderCloudWall();
    });
  }

  function renderCloudWall() {
    const wallPage = $('[data-page="cloudwall"]');
    let content = $('#cloudWallContent');
    if (!content) return;

    const allFluffs = getCloudFluffs();
    const totalLikes = allFluffs.reduce((s, f) => s + (f.likes || 0), 0);
    const totalReplies = allFluffs.reduce((s, f) => s + (f.replies?.length || 0), 0);

    content.innerHTML = `
      <div class="cloudwall-badge">🔒 匿名发布 · 短句碎碎念 · 点赞回复</div>
      <div class="cloudwall-stats">
        <div class="cw-stat"><div class="cw-num">${allFluffs.length}</div><div class="cw-label">云絮数</div></div>
        <div class="cw-stat"><div class="cw-num">${totalLikes}</div><div class="cw-label">暖心点赞</div></div>
        <div class="cw-stat"><div class="cw-num">${totalReplies}</div><div class="cw-label">温柔回复</div></div>
      </div>
      <div class="cloudwall-grid" id="cloudWallGrid">
        ${allFluffs.length === 0 ?
          '<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">☁️</div>天空还是空空的，来发布第一条云絮吧</div>' :
          allFluffs.map(f => renderFluffCard(f)).join('')
        }
      </div>
    `;

    bindFluffActions(content);
  }

  function renderFluffCard(fluff) {
    const mood = MOODS.find(m => m.key === fluff.mood);
    const moodLabel = mood ? `${mood.icon}` : '';
    const repliesHTML = (fluff.replies && fluff.replies.length > 0) ?
      `<div class="fluff-replies">
        ${fluff.replies.map(r => `<div class="fluff-reply-item"><span class="reply-author">${r.author}</span> ${r.text}</div>`).join('')}
        <div class="fluff-reply-input">
          <input type="text" placeholder="写一条温暖的回复…" data-fluff-id="${fluff.id}" class="fluff-reply-field" />
          <button data-fluff-id="${fluff.id}" class="fluff-reply-submit">回复</button>
        </div>
      </div>` :
      `<div class="fluff-replies">
        <div class="fluff-reply-input">
          <input type="text" placeholder="写一条温暖的回复…" data-fluff-id="${fluff.id}" class="fluff-reply-field" />
          <button data-fluff-id="${fluff.id}" class="fluff-reply-submit">回复</button>
        </div>
      </div>`;

    return `<div class="fluff-card" data-id="${fluff.id}">
      <div class="fluff-avatar" style="background:linear-gradient(135deg,#e8e0fa,#d8ccf4);">${fluff.avatar || '☁️'}</div>
      <div class="fluff-text">${moodLabel} ${fluff.text}</div>
      <div class="fluff-bottom">
        <div class="fluff-time">${fluff.author || '匿名'} · ${fmtTime(fluff.time)}</div>
        <div class="fluff-actions">
          <button class="fluff-like-btn ${fluff.likedByMe ? 'liked' : ''}" data-action="like" data-id="${fluff.id}">
            ${fluff.likedByMe ? '❤️' : '🤍'} <span class="fluff-like-count">${fluff.likes || 0}</span>
          </button>
          <button class="fluff-reply-btn" data-action="toggleReply" data-id="${fluff.id}">
            💬 <span class="fluff-reply-count">${fluff.replies?.length || 0}</span>
          </button>
        </div>
      </div>
      ${repliesHTML}
    </div>`;
  }

  function bindFluffActions(container) {
    // 点赞
    container.querySelectorAll('.fluff-like-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        likeFluff(id);
        renderCloudWall();
      });
    });

    // 切换回复
    container.querySelectorAll('.fluff-reply-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const card = btn.closest('.fluff-card');
        const replies = card.querySelector('.fluff-replies');
        if (replies) {
          replies.style.display = replies.style.display === 'none' ? 'block' : (replies.style.display === 'block' ? 'none' : 'block');
          const input = replies.querySelector('.fluff-reply-field');
          if (input && replies.style.display === 'block') input.focus();
        }
      });
    });

    // 提交回复
    container.querySelectorAll('.fluff-reply-submit').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const input = btn.previousElementSibling;
        const text = input.value.trim();
        if (!text) { showToast('请输入回复内容'); return; }
        replyFluff(id, text);
        input.value = '';
        renderCloudWall();
      });
    });

    // 回车提交回复
    container.querySelectorAll('.fluff-reply-field').forEach(input => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const btn = input.nextElementSibling;
          btn.click();
        }
      });
    });
  }

  function likeFluff(id) {
    const myFluffs = Store.get('cloudFluffs', []);
    const fluff = myFluffs.find(f => f.id === id);
    if (fluff) {
      if (fluff.likedByMe) { fluff.likes = Math.max(0, (fluff.likes || 0) - 1); fluff.likedByMe = false; }
      else { fluff.likes = (fluff.likes || 0) + 1; fluff.likedByMe = true; }
      Store.set('cloudFluffs', myFluffs);
    } else {
      // 预置云絮 - 用单独的 liked 状态存储
      const likedMap = Store.get('fluffLiked', {});
      const presetFluff = PRESET_FLUFFS.find(f => f.id === id);
      if (presetFluff) {
        if (likedMap[id]) { presetFluff.likes--; likedMap[id] = false; }
        else { presetFluff.likes++; likedMap[id] = true; }
        presetFluff.likedByMe = likedMap[id] || false;
        Store.set('fluffLiked', likedMap);
      }
    }
    showToast('🤍 暖心点赞');
  }

  function replyFluff(id, text) {
    const myFluffs = Store.get('cloudFluffs', []);
    const fluff = myFluffs.find(f => f.id === id);
    const avatar = ANON_AVATARS[Math.floor(Math.random() * ANON_AVATARS.length)];
    const author = `${avatar} ${ANON_NAMES[Math.floor(Math.random() * ANON_NAMES.length)]}`;

    if (fluff) {
      if (!fluff.replies) fluff.replies = [];
      fluff.replies.push({ author, text });
      Store.set('cloudFluffs', myFluffs);
    } else {
      // 预置云絮回复
      const presetFluff = PRESET_FLUFFS.find(f => f.id === id);
      if (presetFluff) {
        if (!presetFluff.replies) presetFluff.replies = [];
        presetFluff.replies.push({ author, text });
      }
      // 也存到 myFluffs 的 reply 记录
      const replyStore = Store.get('fluffReplies', {});
      if (!replyStore[id]) replyStore[id] = [];
      replyStore[id].push({ author, text });
      Store.set('fluffReplies', replyStore);
    }
    showToast('💬 回复成功');
  }

  // 发布云絮按钮
  const btnCloudPost = $('#btnCloudPost');
  if (btnCloudPost) {
    btnCloudPost.addEventListener('click', () => {
      let selectedFluffMood = null;
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay show cloudpost-modal';
      overlay.id = 'cloudPostModal';
      overlay.innerHTML = `
        <div class="modal-box">
          <h3>☁️ 发布匿名云絮</h3>
          <div class="anon-notice">🔒 你的身份将完全匿名，使用随机云昵称和头像</div>
          <label>选择情绪（可选）</label>
          <div class="mood-tags" id="fluffMoodTags">
            ${MOODS.map(m => `<div class="mood-tag" data-mood="${m.key}">${m.icon} ${m.label}</div>`).join('')}
          </div>
          <label>写一句心事、愿望或碎碎念</label>
          <textarea id="fluffContent" placeholder="让心事随风飘散…" style="height:100px;" maxlength="200"></textarea>
          <div style="text-align:right;color:#bbb;font-size:12px;margin-top:-8px;margin-bottom:6px;">
            <span id="fluffCharCount">0</span>/200
          </div>
          <div class="modal-btns">
            <button class="btn-cancel" id="cancelFluff">取消</button>
            <button class="btn" id="submitFluff">飘向云端</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      // 情绪选择
      $$('#fluffMoodTags .mood-tag', overlay).forEach(tag => {
        tag.addEventListener('click', () => {
          $$('#fluffMoodTags .mood-tag', overlay).forEach(t => t.classList.remove('selected'));
          tag.classList.add('selected');
          selectedFluffMood = tag.getAttribute('data-mood');
        });
      });

      // 字数统计
      const fluffContent = $('#fluffContent', overlay);
      const charCount = $('#fluffCharCount', overlay);
      fluffContent.addEventListener('input', () => {
        charCount.textContent = fluffContent.value.length;
      });

      // 取消
      $('#cancelFluff', overlay).addEventListener('click', () => overlay.remove());

      // 提交
      $('#submitFluff', overlay).addEventListener('click', () => {
        const text = fluffContent.value.trim();
        if (!text) { showToast('请写点什么再发布哦～'); return; }

        const avatar = ANON_AVATARS[Math.floor(Math.random() * ANON_AVATARS.length)];
        const author = `${avatar} ${ANON_NAMES[Math.floor(Math.random() * ANON_NAMES.length)]}`;

        const fluff = {
          id: genId(),
          text,
          mood: selectedFluffMood || 'calm',
          avatar,
          author,
          time: Date.now(),
          likes: 0,
          likedByMe: false,
          replies: [],
        };

        const myFluffs = Store.get('cloudFluffs', []);
        myFluffs.unshift(fluff);
        Store.set('cloudFluffs', myFluffs);

        // 加载预置回复（如果有的话）
        const replyStore = Store.get('fluffReplies', {});
        if (replyStore[fluff.id]) {
          fluff.replies = replyStore[fluff.id];
        }

        overlay.remove();
        showToast('☁️ 云絮已飘向天空');
        renderCloudWall();
      });

      // 点击遮罩关闭
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
      });
    });
  }

  /* ============ 页面3：拾云之页 ============ */
  let pickFilter = 'all';
  let currentPicked = null;

  function renderPickPage() {
    const content = $('#pickContent');
    if (!content) return;

    const pool = pickFilter === 'all' ? PRESET_JOURNALS : PRESET_JOURNALS.filter(j => j.mood === pickFilter);

    content.innerHTML = `
      <div class="pick-intro">
        <div class="pick-intro-icon">✉️</div>
        <div class="pick-intro-text">云端飘来陌生人的信，拆开看看吧</div>
      </div>
      <div class="filter-bar">
        <div class="filter-tag ${pickFilter === 'all' ? 'active' : ''}" data-filter="all">全部</div>
        ${MOODS.map(m => `<div class="filter-tag ${pickFilter === m.key ? 'active' : ''}" data-filter="${m.key}">${m.icon} ${m.label}</div>`).join('')}
      </div>
      ${currentPicked ? `<div class="pick-result scroll-area" style="margin-bottom:20px;">${renderLetterHTML(currentPicked)}</div>` : '<div class="pick-result"></div>'}
      <div class="home-section-title" style="margin-bottom:4px;">云中信箱</div>
      <p style="color:#999;font-size:13px;margin-bottom:14px;">每一封都是陌生人的真实心声</p>
      <div class="letter-list scroll-area">
        ${pool.length === 0 ?
          '<div class="empty-state"><div class="empty-icon">📭</div>这个分类的信箱暂时空空的</div>' :
          pool.map(j => renderEnvelopeHTML(j)).join('')
        }
      </div>
    `;

    // 筛选标签事件
    $$('.filter-tag', content).forEach(tag => {
      tag.addEventListener('click', () => {
        pickFilter = tag.getAttribute('data-filter');
        currentPicked = null;
        renderPickPage();
      });
    });

    // 信封点击拆信事件
    $$('.envelope-item', content).forEach(env => {
      env.addEventListener('click', () => {
        const id = env.getAttribute('data-id');
        const journal = PRESET_JOURNALS.find(j => j.id === id);
        if (!journal) return;
        env.classList.add('envelope-opening');
        setTimeout(() => {
          currentPicked = journal;
          const stats = getStats();
          stats.totalPicked = (stats.totalPicked || 0) + 1;
          Store.set('stats', stats);
          renderPickPage();
          checkAchievements();
        }, 600);
      });
    });

    // 信纸收藏按钮
    const collectBtn = content.querySelector('.letter-collect-btn');
    if (collectBtn) {
      collectBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = collectBtn.getAttribute('data-id');
        // 收藏到我的手账
        const journal = PRESET_JOURNALS.find(j => j.id === id);
        if (journal) {
          const journals = Store.get('journals', []);
          if (!journals.find(j => j.id === journal.id)) {
            journals.push({ ...journal, status: 'published', favorited: true });
            Store.set('journals', journals);
          }
          const stats = getStats();
          stats.totalFavorited = journals.filter(j => j.favorited).length;
          Store.set('stats', stats);
          collectBtn.textContent = '♥ 已收藏';
          collectBtn.style.color = '#c06090';
          showToast('已收藏这封信 💜');
          checkAchievements();
        }
      });
    }
  }

  // 渲染信封样式（未拆开）
  function renderEnvelopeHTML(journal) {
    const mood = MOODS.find(m => m.key === journal.mood);
    const moodIcon = mood ? mood.icon : '☁️';
    const moodLabel = mood ? mood.label : '';
    return `<div class="envelope-item" data-id="${journal.id}">
      <div class="envelope-flap"></div>
      <div class="envelope-body">
        <div class="envelope-seal">${moodIcon}</div>
        <div class="envelope-info">
          <div class="envelope-from">来自：${journal.author || '匿名'}</div>
          <div class="envelope-mood">${moodLabel}的信</div>
        </div>
        <div class="envelope-hint">点击拆信 ✉️</div>
      </div>
    </div>`;
  }

  // 渲染拆开的信纸
  function renderLetterHTML(journal) {
    const mood = MOODS.find(m => m.key === journal.mood);
    const moodLabel = mood ? `${mood.icon} ${mood.label}` : journal.mood;
    const moodCls = mood ? mood.cls : '';
    return `<div class="letter-paper">
      <div class="letter-deco">✉️</div>
      <div class="letter-mood ${moodCls}">${moodLabel}</div>
      <div class="letter-text">${journal.text}</div>
      <div class="letter-footer">
        <span class="letter-author">—— ${journal.author || '匿名'}</span>
        <span class="letter-time">${fmtTime(journal.time)}</span>
      </div>
      <button class="letter-collect-btn" data-action="fav" data-id="${journal.id}">♡ 收藏这封信</button>
    </div>`;
  }

  // 随机拾取
  function pickRandom() {
    const pool = pickFilter === 'all' ? PRESET_JOURNALS : PRESET_JOURNALS.filter(j => j.mood === pickFilter);
    if (pool.length === 0) { showToast('该分类暂无信件～'); return; }

    // 播放拾取动画
    const content = $('#pickContent');
    if (content) {
      const existingResult = content.querySelector('.pick-result');
      if (existingResult) {
        existingResult.innerHTML = '<div class="pick-animation"><div class="cloud-anim">✉️</div><div style="text-align:center;color:#999;font-size:13px;margin-top:10px;">云端信使正在送信…</div></div>';
      }
    }

    setTimeout(() => {
      currentPicked = pool[Math.floor(Math.random() * pool.length)];
      // 更新拾取统计
      const stats = getStats();
      stats.totalPicked = (stats.totalPicked || 0) + 1;
      Store.set('stats', stats);

      // 重新渲染页面，顶部展示拾取结果
      renderPickPage();
      checkAchievements();
      showToast('收到一封远方来信 ✉️');
    }, 1200);
  }

  const pickBtn = $('#btnPick');
  if (pickBtn) pickBtn.addEventListener('click', pickRandom);

  /* ============ 页面3：我的手账 ============ */
  let mineTab = 'published';

  function renderMinePage() {
    const content = $('#mineContent');
    if (!content) return;

    const journals = Store.get('journals', []);
    const filtered = mineTab === 'all' ? journals :
      mineTab === 'published' ? journals.filter(j => j.status === 'published') :
      mineTab === 'draft' ? journals.filter(j => j.status === 'draft') :
      journals.filter(j => j.favorited);

    const stats = getStats();
    content.innerHTML = `
      <div class="stat-row">
        <div class="stat-card"><div class="stat-num">${journals.filter(j => j.status === 'published').length}</div><div class="stat-label">已发布</div></div>
        <div class="stat-card"><div class="stat-num">${journals.filter(j => j.status === 'draft').length}</div><div class="stat-label">草稿</div></div>
        <div class="stat-card"><div class="stat-num">${journals.filter(j => j.favorited).length}</div><div class="stat-label">已收藏</div></div>
      </div>
      <div class="tab-bar">
        <div class="tab-item ${mineTab === 'published' ? 'active' : ''}" data-tab="published">已发布</div>
        <div class="tab-item ${mineTab === 'draft' ? 'active' : ''}" data-tab="draft">草稿箱</div>
        <div class="tab-item ${mineTab === 'favorited' ? 'active' : ''}" data-tab="favorited">收藏夹</div>
        <div class="tab-item ${mineTab === 'all' ? 'active' : ''}" data-tab="all">全部</div>
      </div>
      <div class="scroll-area">
        ${filtered.length === 0 ?
          '<div class="empty-state"><div class="empty-icon">📭</div>这里还没有内容</div>' :
          '<div class="card-list">' + filtered.map(j => renderCardHTML(j, false, true)).join('') + '</div>'
        }
      </div>
    `;

    // 标签页切换
    $$('.tab-item', content).forEach(tab => {
      tab.addEventListener('click', () => {
        mineTab = tab.getAttribute('data-tab');
        renderMinePage();
      });
    });

    // 绑定卡片操作事件
    bindCardActions(content);
  }

  const mineBtn = $('#btnMine');
  if (mineBtn) mineBtn.addEventListener('click', () => {
    mineTab = 'draft';
    renderMinePage();
  });

  /* ============ 页面4：静心小筑 ============ */
  let isMusicPlaying = false;
  let currentTrack = 0;
  let bubbleScore = 0;
  let bubbleTimer = null;
  let bubbleGameActive = false;
  let healQuoteIdx = 0;
  let relaxInited = false;

  // 呼吸引导状态
  let breathActive = false;
  let breathPhase = 'idle'; // idle | inhale | hold | exhale
  let breathTimer = null;
  let breathCycle = 0;
  const BREATH_MODES = [
    { name: '4-7-8 放松呼吸', inhale: 4, hold: 7, exhale: 8, desc: '经典的放松助眠呼吸法' },
    { name: '4-4 箱式呼吸', inhale: 4, hold: 4, exhale: 4, holdAfter: 4, desc: '均匀节奏，稳定情绪' },
    { name: '5-5 平衡呼吸', inhale: 5, hold: 0, exhale: 5, desc: '简单节奏，随时随地放松' },
  ];
  let currentBreathMode = 0;

  // 涂鸦画板状态
  let doodleCtx = null;
  let doodleDrawing = false;
  let doodleColor = '#705eb5';
  let doodleSize = 4;
  let doodleHistory = [];

  const MUSIC_TRACKS = [
    { name: '☁️ 云端漫步', freq: [262, 330, 392, 330, 294, 349, 440, 349, 392, 330, 262, 294], chords: [[131,196],[131,196],[147,220],[131,196],[131,196],[147,220],[131,196],[147,220],[131,196],[131,196],[110,165],[131,196]] },
    { name: '🌧️ 细雨轻吟', freq: [330, 392, 440, 523, 440, 392, 330, 294, 330, 392, 440, 392], chords: [[165,220],[165,220],[147,196],[131,196],[147,196],[165,220],[165,220],[147,196],[165,220],[165,220],[147,196],[165,220]] },
    { name: '🌙 月夜絮语', freq: [392, 440, 523, 494, 440, 392, 349, 392, 440, 523, 494, 440], chords: [[196,262],[196,262],[220,330],[196,262],[196,262],[175,262],[175,220],[196,262],[196,262],[220,330],[196,262],[196,262]] },
  ];

  let audioCtx = null;
  let musicInterval = null;
  let noteIndex = 0;
  let masterGain = null;
  let reverb = null;
  let lpf = null;

  function initRelaxAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.4;
    lpf = audioCtx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.value = 1600;
    lpf.Q.value = 0.5;
    reverb = audioCtx.createConvolver();
    reverb.buffer = createReverbIR(audioCtx, 2, 3);
    lpf.connect(masterGain);
    masterGain.connect(audioCtx.destination);
    lpf.connect(reverb);
    reverb.connect(audioCtx.destination);
  }

  function initRelaxPage() {
    const content = $('#relaxContent');
    if (!content) return;
    if (relaxInited) {
      // 已初始化过DOM，只需重启泡泡游戏
      resumeBubbleGame();
      return;
    }

    content.innerHTML = `
      <div class="music-player">
        <div class="music-visualizer" id="musicVisualizer">
          ${Array.from({ length: 12 }, (_, i) => `<div class="music-bar" style="height:${8 + Math.random() * 10}px; animation-delay:${i * 0.08}s"></div>`).join('')}
        </div>
        <div class="music-track-name" id="trackName">${MUSIC_TRACKS[0].name}</div>
        <div class="music-controls">
          <button class="music-btn" id="prevTrack">⏮</button>
          <button class="music-btn play-btn" id="playBtn">▶</button>
          <button class="music-btn" id="nextTrack">⏭</button>
        </div>
      </div>

      <div class="heal-quotes" id="healQuotes">
        <div class="quote-text" id="quoteText">"${HEAL_QUOTES[0].text}"</div>
        <div class="quote-author" id="quoteAuthor">— ${HEAL_QUOTES[0].author}</div>
        <button class="btn" style="margin-top:16px;padding:10px 22px;font-size:14px" id="nextQuote">换一句 ✨</button>
      </div>

      <!-- 呼吸引导 -->
      <div class="relax-section breath-section">
        <div class="relax-section-title">🌬️ 呼吸引导</div>
        <div class="breath-mode-bar">
          ${BREATH_MODES.map((m, i) => `<div class="breath-mode-tag ${i === currentBreathMode ? 'active' : ''}" data-bmode="${i}">${m.name}</div>`).join('')}
        </div>
        <div class="breath-mode-desc" id="breathModeDesc">${BREATH_MODES[0].desc}</div>
        <div class="breath-circle-wrap">
          <div class="breath-circle" id="breathCircle">
            <div class="breath-inner">
              <div class="breath-phase-text" id="breathPhaseText">准备开始</div>
              <div class="breath-counter" id="breathCounter"></div>
            </div>
          </div>
        </div>
        <div class="breath-info" id="breathInfo">已完成 0 个循环</div>
        <div class="breath-controls">
          <button class="btn" id="breathStartBtn" style="padding:10px 28px;font-size:14px;">开始呼吸</button>
          <button class="btn-outline breath-stop-btn" id="breathStopBtn" style="padding:10px 20px;font-size:13px;display:none;">停止</button>
        </div>
      </div>

      <!-- 涂鸦画板 -->
      <div class="relax-section doodle-section">
        <div class="relax-section-title">🎨 涂鸦画板</div>
        <p class="doodle-hint">随手涂鸦，释放内心的色彩</p>
        <div class="doodle-toolbar">
          <div class="doodle-colors" id="doodleColors">
            ${['#705eb5','#e06080','#f0a050','#50b880','#4090d0','#d060c0','#888','#333'].map(c =>
              `<div class="doodle-color ${c === doodleColor ? 'active' : ''}" data-color="${c}" style="background:${c}"></div>`
            ).join('')}
          </div>
          <div class="doodle-sizes" id="doodleSizes">
            ${[2, 4, 8, 14].map(s =>
              `<div class="doodle-size ${s === doodleSize ? 'active' : ''}" data-size="${s}"><span style="width:${Math.max(6, s * 2)}px;height:${Math.max(6, s * 2)}px;border-radius:50%;background:#705eb5;display:block"></span></div>`
            ).join('')}
          </div>
          <div class="doodle-actions">
            <button class="btn-outline doodle-act-btn" id="doodleUndo" title="撤销">↩ 撤销</button>
            <button class="btn-outline doodle-act-btn" id="doodleClear" title="清空">🗑 清空</button>
            <button class="btn doodle-act-btn" id="doodleSave" title="保存到我的手账">💾 保存</button>
          </div>
        </div>
        <div class="doodle-canvas-wrap">
          <canvas class="doodle-canvas" id="doodleCanvas"></canvas>
        </div>
      </div>

      <div class="bubble-game">
        <div class="game-header">
          <span style="color:#634faa;font-size:16px;font-weight:500">🫧 解压泡泡</span>
          <div style="display:flex;align-items:center;gap:12px;">
            <span class="game-score" id="bubbleScore">得分: 0</span>
            <button class="btn" style="padding:6px 16px;font-size:13px;border-radius:16px;" id="bubbleGameBtn">开始游戏</button>
          </div>
        </div>
        <div class="game-area" id="bubbleArea"></div>
      </div>
    `;

    relaxInited = true;

    // 音乐控制
    $('#playBtn').addEventListener('click', toggleMusic);
    $('#prevTrack').addEventListener('click', () => switchTrack(-1));
    $('#nextTrack').addEventListener('click', () => switchTrack(1));

    // 换一句
    $('#nextQuote').addEventListener('click', () => {
      healQuoteIdx = (healQuoteIdx + 1) % HEAL_QUOTES.length;
      $('#quoteText').textContent = `"${HEAL_QUOTES[healQuoteIdx].text}"`;
      $('#quoteAuthor').textContent = `— ${HEAL_QUOTES[healQuoteIdx].author}`;
    });

    // 泡泡游戏开始/暂停按钮
    $('#bubbleGameBtn').addEventListener('click', () => {
      if (bubbleGameActive) {
        pauseBubbleGame();
      } else {
        startBubbleGame();
      }
    });

    // ===== 呼吸引导事件 =====
    $$('.breath-mode-tag', content).forEach(tag => {
      tag.addEventListener('click', () => {
        if (breathActive) return;
        currentBreathMode = parseInt(tag.getAttribute('data-bmode'));
        $$('.breath-mode-tag', content).forEach(t => t.classList.remove('active'));
        tag.classList.add('active');
        const desc = $('#breathModeDesc', content);
        if (desc) desc.textContent = BREATH_MODES[currentBreathMode].desc;
      });
    });

    $('#breathStartBtn', content)?.addEventListener('click', startBreathing);
    $('#breathStopBtn', content)?.addEventListener('click', stopBreathing);

    // ===== 涂鸦画板事件 =====
    initDoodleCanvas();
  }

  /* ===== 呼吸引导逻辑 ===== */
  function startBreathing() {
    if (breathActive) return;
    breathActive = true;
    breathCycle = 0;
    breathPhase = 'idle';

    const startBtn = $('#breathStartBtn');
    const stopBtn = $('#breathStopBtn');
    if (startBtn) startBtn.style.display = 'none';
    if (stopBtn) stopBtn.style.display = '';

    runBreathPhase('inhale');
  }

  function stopBreathing() {
    breathActive = false;
    breathPhase = 'idle';
    clearTimeout(breathTimer);

    const circle = $('#breathCircle');
    const phaseText = $('#breathPhaseText');
    const counter = $('#breathCounter');
    const startBtn = $('#breathStartBtn');
    const stopBtn = $('#breathStopBtn');
    if (circle) { circle.classList.remove('inhale', 'hold', 'exhale'); circle.classList.add('idle'); }
    if (phaseText) phaseText.textContent = '准备开始';
    if (counter) counter.textContent = '';
    if (startBtn) startBtn.style.display = '';
    if (stopBtn) stopBtn.style.display = 'none';
  }

  function runBreathPhase(phase) {
    if (!breathActive) return;
    breathPhase = phase;

    const mode = BREATH_MODES[currentBreathMode];
    const circle = $('#breathCircle');
    const phaseText = $('#breathPhaseText');
    const counter = $('#breathCounter');
    const info = $('#breathInfo');

    // 更新圆环样式
    if (circle) { circle.classList.remove('inhale', 'hold', 'exhale', 'idle'); circle.classList.add(phase); }

    let duration = 0;
    let phaseLabel = '';
    let nextPhase = '';

    switch (phase) {
      case 'inhale':
        duration = mode.inhale;
        phaseLabel = '缓缓吸气';
        nextPhase = mode.hold > 0 ? 'hold' : 'exhale';
        break;
      case 'hold':
        duration = mode.hold;
        phaseLabel = '屏住呼吸';
        nextPhase = 'exhale';
        break;
      case 'exhale':
        duration = mode.exhale;
        phaseLabel = '慢慢呼气';
        nextPhase = mode.holdAfter ? 'holdAfter' : 'inhale';
        break;
      case 'holdAfter':
        duration = mode.holdAfter || 0;
        phaseLabel = '轻轻屏息';
        nextPhase = 'inhale';
        break;
    }

    if (phaseText) phaseText.textContent = phaseLabel;

    // 倒计时
    let remaining = duration;
    if (counter) counter.textContent = remaining + 's';
    const countInterval = setInterval(() => {
      remaining--;
      if (remaining <= 0 || !breathActive) {
        clearInterval(countInterval);
        if (counter) counter.textContent = '';
        return;
      }
      if (counter) counter.textContent = remaining + 's';
    }, 1000);

    breathTimer = setTimeout(() => {
      clearInterval(countInterval);
      if (!breathActive) return;
      if (phase === 'exhale' || phase === 'holdAfter') {
        breathCycle++;
        if (info) info.textContent = `已完成 ${breathCycle} 个循环`;
      }
      runBreathPhase(nextPhase);
    }, duration * 1000);
  }

  /* ===== 涂鸦画板逻辑 ===== */
  function initDoodleCanvas() {
    const canvas = $('#doodleCanvas');
    if (!canvas) return;
    const wrap = canvas.parentElement;
    canvas.width = wrap.clientWidth || 600;
    canvas.height = 360;
    doodleCtx = canvas.getContext('2d');
    doodleCtx.fillStyle = '#fefaff';
    doodleCtx.fillRect(0, 0, canvas.width, canvas.height);
    doodleCtx.lineCap = 'round';
    doodleCtx.lineJoin = 'round';
    doodleHistory = [doodleCtx.getImageData(0, 0, canvas.width, canvas.height)];

    // 鼠标/触摸事件
    let lastPos = null;
    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      // 修正 canvas 内部分辨率与 CSS 显示尺寸的缩放
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
    };

    const startDraw = (e) => {
      e.preventDefault();
      doodleDrawing = true;
      const pos = getPos(e);
      lastPos = pos;
      doodleCtx.strokeStyle = doodleColor;
      doodleCtx.lineWidth = doodleSize;
      // 画一个点，确保单击也有反馈
      doodleCtx.beginPath();
      doodleCtx.arc(pos.x, pos.y, doodleSize / 2, 0, Math.PI * 2);
      doodleCtx.fillStyle = doodleColor;
      doodleCtx.fill();
    };
    const draw = (e) => {
      if (!doodleDrawing) return;
      e.preventDefault();
      const pos = getPos(e);
      // 逐段绘制，避免重复描边导致越画越粗
      doodleCtx.strokeStyle = doodleColor;
      doodleCtx.lineWidth = doodleSize;
      doodleCtx.beginPath();
      doodleCtx.moveTo(lastPos.x, lastPos.y);
      doodleCtx.lineTo(pos.x, pos.y);
      doodleCtx.stroke();
      lastPos = pos;
    };
    const endDraw = () => {
      if (!doodleDrawing) return;
      doodleDrawing = false;
      lastPos = null;
      // 保存历史
      doodleHistory.push(doodleCtx.getImageData(0, 0, canvas.width, canvas.height));
      if (doodleHistory.length > 30) doodleHistory.shift();
    };

    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', endDraw);
    canvas.addEventListener('mouseleave', endDraw);
    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', endDraw);

    // 颜色选择
    $$('.doodle-color').forEach(el => {
      el.addEventListener('click', () => {
        doodleColor = el.getAttribute('data-color');
        $$('.doodle-color').forEach(c => c.classList.remove('active'));
        el.classList.add('active');
      });
    });

    // 画笔大小
    $$('.doodle-size').forEach(el => {
      el.addEventListener('click', () => {
        doodleSize = parseInt(el.getAttribute('data-size'));
        $$('.doodle-size').forEach(s => s.classList.remove('active'));
        el.classList.add('active');
      });
    });

    // 撤销
    $('#doodleUndo')?.addEventListener('click', () => {
      if (doodleHistory.length <= 1) return;
      doodleHistory.pop();
      const prev = doodleHistory[doodleHistory.length - 1];
      doodleCtx.putImageData(prev, 0, 0);
    });

    // 清空
    $('#doodleClear')?.addEventListener('click', () => {
      doodleCtx.fillStyle = '#fefaff';
      doodleCtx.fillRect(0, 0, canvas.width, canvas.height);
      doodleHistory = [doodleCtx.getImageData(0, 0, canvas.width, canvas.height)];
      showToast('画板已清空');
    });

    // 保存到我的手账
    $('#doodleSave')?.addEventListener('click', () => {
      const dataURL = canvas.toDataURL('image/png');
      const journals = Store.get('journals', []);
      journals.push({
        id: genId(),
        mood: 'calm',
        text: '🎨 涂鸦创作',
        time: new Date().toISOString(),
        status: 'published',
        image: dataURL,
      });
      Store.set('journals', journals);
      const stats = getStats();
      stats.totalPublished = journals.filter(j => j.status === 'published').length;
      Store.set('stats', stats);
      showToast('涂鸦已保存到我的手账 🎨');
      checkAchievements();
    });
  }

  function toggleMusic() {
    if (isMusicPlaying) {
      stopMusic();
    } else {
      playMusic();
    }
  }

  function playMusic() {
    initRelaxAudio();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    isMusicPlaying = true;
    const playBtn = $('#playBtn');
    if (playBtn) playBtn.textContent = '⏸';
    $$('.music-bar').forEach(b => b.classList.add('playing'));
    noteIndex = 0;
    playNote();
    musicInterval = setInterval(playNote, 650);
  }

  function playNote() {
    const track = MUSIC_TRACKS[currentTrack];
    const idx = noteIndex % track.freq.length;
    const freq = track.freq[idx];
    const now = audioCtx.currentTime;
    const dur = 0.7;

    // 旋律：双振荡器微调合唱
    [0, 4].forEach(detune => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.detune.value = detune;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.1, now + 0.08);
      gain.gain.setValueAtTime(0.1, now + dur * 0.5);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
      osc.connect(gain);
      gain.connect(lpf);
      osc.start(now);
      osc.stop(now + dur + 0.1);
    });

    // 和弦垫音
    const chord = track.chords[idx];
    if (chord) {
      chord.forEach((cf, ci) => {
        [0, 6].forEach(detune => {
          const cOsc = audioCtx.createOscillator();
          const cGain = audioCtx.createGain();
          cOsc.type = 'sine';
          cOsc.frequency.value = cf;
          cOsc.detune.value = detune + ci * 2;
          cGain.gain.setValueAtTime(0, now);
          cGain.gain.linearRampToValueAtTime(0.025, now + 0.2);
          cGain.gain.setValueAtTime(0.025, now + dur * 0.6);
          cGain.gain.exponentialRampToValueAtTime(0.001, now + dur);
          cOsc.connect(cGain);
          cGain.connect(lpf);
          cOsc.start(now);
          cOsc.stop(now + dur + 0.1);
        });
      });
    }

    noteIndex++;
  }

  function stopMusic() {
    isMusicPlaying = false;
    const playBtn = $('#playBtn');
    if (playBtn) playBtn.textContent = '▶';
    $$('.music-bar').forEach(b => b.classList.remove('playing'));
    clearInterval(musicInterval);
  }

  function switchTrack(dir) {
    currentTrack = (currentTrack + dir + MUSIC_TRACKS.length) % MUSIC_TRACKS.length;
    const trackName = $('#trackName');
    if (trackName) trackName.textContent = MUSIC_TRACKS[currentTrack].name;
    if (isMusicPlaying) {
      stopMusic();
      playMusic();
    }
  }

  // 泡泡游戏
  function startBubbleGame() {
    bubbleGameActive = true;
    const area = $('#bubbleArea');
    const btn = $('#bubbleGameBtn');
    if (!area) return;
    area.innerHTML = '';
    if (btn) btn.textContent = '暂停游戏';

    if (bubbleTimer) clearInterval(bubbleTimer);
    bubbleTimer = setInterval(() => {
      createBubble(area);
    }, 900);
  }

  function pauseBubbleGame() {
    bubbleGameActive = false;
    if (bubbleTimer) { clearInterval(bubbleTimer); bubbleTimer = null; }
    const btn = $('#bubbleGameBtn');
    if (btn) btn.textContent = '继续游戏';
  }

  function resumeBubbleGame() {
    const area = $('#bubbleArea');
    const btn = $('#bubbleGameBtn');
    if (!area) return;
    if (bubbleGameActive && !bubbleTimer) {
      // 之前在活跃状态但timer被清了（比如切页面），恢复
      bubbleTimer = setInterval(() => {
        createBubble(area);
      }, 900);
      if (btn) btn.textContent = '暂停游戏';
    }
  }

  function stopBubbleGame() {
    bubbleGameActive = false;
    if (bubbleTimer) { clearInterval(bubbleTimer); bubbleTimer = null; }
    const btn = $('#bubbleGameBtn');
    if (btn) btn.textContent = '开始游戏';
  }

  function createBubble(area) {
    const bubble = document.createElement('div');
    bubble.className = 'game-bubble';
    const size = Math.random() * 30 + 30;
    const areaW = area.offsetWidth || 300;
    bubble.style.width = size + 'px';
    bubble.style.height = size + 'px';
    bubble.style.left = Math.random() * (areaW - size) + 'px';
    bubble.style.bottom = '0px';
    const dur = Math.random() * 2 + 2.5;
    bubble.style.setProperty('--dur', dur + 's');
    bubble.style.animationDuration = dur + 's';
    area.appendChild(bubble);

    bubble.addEventListener('click', () => {
      // 记录点击位置用于特效
      const rect = bubble.getBoundingClientRect();
      const areaRect = area.getBoundingClientRect();
      const popX = rect.left - areaRect.left + rect.width / 2;
      const popY = rect.top - areaRect.top;

      bubble.remove();
      bubbleScore++;
      const stats = getStats();
      stats.bubblePopped = (stats.bubblePopped || 0) + 1;
      Store.set('stats', stats);
      const scoreEl = $('#bubbleScore');
      if (scoreEl) scoreEl.textContent = '得分: ' + bubbleScore;

      // 爆破特效
      const pop = document.createElement('div');
      pop.className = 'bubble-pop';
      pop.textContent = ['✨', '💫', '⭐', '🌟', '💜'][Math.floor(Math.random() * 5)];
      pop.style.left = popX + 'px';
      pop.style.top = popY + 'px';
      area.appendChild(pop);
      setTimeout(() => pop.remove(), 600);

      checkAchievements();
    });

    // 自动移除（比动画稍长）
    setTimeout(() => { if (bubble.parentNode) bubble.remove(); }, (dur + 0.5) * 1000);
  }

  // 静心小筑按钮已移除（内容默认渲染），音乐可通过页面内播放按钮控制

  /* ============ 页面5：云途图鉴 ============ */
  let calYear, calMonth;

  function renderAchievementPage() {
    const content = $('#achContent');
    if (!content) return;

    const stats = getStats();
    const journals = Store.get('journals', []);
    const unlockedIds = Store.get('achievements', []);

    if (!calYear) {
      const now = new Date();
      calYear = now.getFullYear();
      calMonth = now.getMonth();
    }

    // 统计数据
    const moodTypes = new Set(journals.map(j => j.mood)).size;
    const streak = calcStreak(journals);
    const published = journals.filter(j => j.status === 'published');

    // 情绪分布统计
    const moodCounts = {};
    MOODS.forEach(m => { moodCounts[m.key] = 0; });
    published.forEach(j => { if (moodCounts[j.mood] !== undefined) moodCounts[j.mood]++; });
    const maxMoodCount = Math.max(1, ...Object.values(moodCounts));
    const topMood = MOODS.reduce((a, b) => moodCounts[a.key] >= moodCounts[b.key] ? a : b, MOODS[0]);

    // 最近7天情绪趋势
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dayJournals = published.filter(j => {
        const jd = new Date(j.time);
        return `${jd.getFullYear()}-${String(jd.getMonth() + 1).padStart(2, '0')}-${String(jd.getDate()).padStart(2, '0')}` === dateStr;
      });
      last7Days.push({
        label: ['日', '一', '二', '三', '四', '五', '六'][d.getDay()],
        count: dayJournals.length,
        mood: dayJournals.length > 0 ? dayJournals[0].mood : null,
      });
    }
    const maxDayCount = Math.max(1, ...last7Days.map(d => d.count));

    // 成就进度
    const totalAchievements = ACHIEVEMENTS.length;
    const unlockedCount = unlockedIds.length;
    const achPercent = Math.round((unlockedCount / totalAchievements) * 100);

    // 里程碑时间线（最近的关键事件）
    const milestones = [];
    published.slice(-5).reverse().forEach(j => {
      const mood = MOODS.find(m => m.key === j.mood);
      milestones.push({
        icon: mood ? mood.icon : '☁️',
        text: j.text.length > 30 ? j.text.slice(0, 30) + '…' : j.text,
        time: fmtTime(j.time),
        mood: j.mood,
      });
    });
    // 加上拾取里程碑
    if (stats.totalPicked > 0) {
      milestones.unshift({ icon: '📫', text: `拾取了第${stats.totalPicked}封远方来信`, time: '', mood: 'healed' });
    }

    // 心境语录
    const moodQuotes = {
      happy: ['快乐是最好的化妆品 ✨', '你的笑容是最美的风景', '幸福不在远方，在当下'],
      sad: ['泪水浇灌出的花更芬芳 🌸', '难过说明你在乎，在乎是种温柔', '雨天也有雨天的好看'],
      angry: ['愤怒是内心在保护自己 🛡️', '深呼吸，一切都会过去', '风暴之后必有彩虹'],
      confused: ['迷茫是成长的一部分 🌱', '不确定的人生才有惊喜', '慢慢来，比较快'],
      lonely: ['独处是和自己对话的时光 🌙', '你比想象中更坚强', '孤独的灵魂最懂得温柔'],
      healed: ['被治愈过的人最温柔 💜', '每一道伤痕都是勋章', '你已经走了很远的路了'],
      calm: ['平静是最奢侈的幸福 🍃', '内心的安宁胜过一切', '波澜不惊，方见真意'],
    };
    const topQuote = moodQuotes[topMood.key] || moodQuotes.calm;
    const todayQuote = topQuote[Math.floor(Math.random() * topQuote.length)];

    content.innerHTML = `
      <!-- 总览卡片 -->
      <div class="ach-hero">
        <div class="ach-hero-left">
          <div class="ach-hero-emoji">${topMood.icon}</div>
          <div class="ach-hero-info">
            <div class="ach-hero-title">你的心境主色调：${topMood.label}</div>
            <div class="ach-hero-quote">"${todayQuote}"</div>
          </div>
        </div>
        <div class="ach-hero-right">
          <div class="ach-hero-stat">
            <span class="ahs-num">${published.length}</span>
            <span class="ahs-label">篇手账</span>
          </div>
          <div class="ach-hero-stat">
            <span class="ahs-num">${streak}</span>
            <span class="ahs-label">天连续</span>
          </div>
          <div class="ach-hero-stat">
            <span class="ahs-num">${moodTypes}/7</span>
            <span class="ahs-label">情绪色</span>
          </div>
        </div>
      </div>

      <!-- 成就进度条 -->
      <div class="ach-progress-section">
        <div class="ach-progress-header">
          <span>🏅 成就进度</span>
          <span class="ach-progress-num">${unlockedCount}/${totalAchievements} 已解锁</span>
        </div>
        <div class="ach-progress-bar">
          <div class="ach-progress-fill" style="width:${achPercent}%"></div>
        </div>
        ${achPercent >= 100 ? '<div class="ach-complete-badge">🏆 全成就达成！</div>' : `<div class="ach-next-hint">距离下一个成就还需继续加油哦～</div>`}
      </div>

      <!-- 情绪分布 + 7日趋势 -->
      <div class="ach-charts-row">
        <div class="ach-chart-card">
          <div class="ach-chart-title">🎨 情绪分布</div>
          <div class="ach-mood-bars">
            ${MOODS.map(m => {
              const count = moodCounts[m.key] || 0;
              const percent = Math.round((count / maxMoodCount) * 100);
              return `<div class="ach-mood-bar-row">
                <div class="amb-icon">${m.icon}</div>
                <div class="amb-track"><div class="amb-fill ${m.cls}" style="width:${percent}%"></div></div>
                <div class="amb-count">${count}</div>
              </div>`;
            }).join('')}
          </div>
        </div>
        <div class="ach-chart-card">
          <div class="ach-chart-title">📈 近7日书写</div>
          <div class="ach-trend-chart">
            ${last7Days.map(d => {
              const barH = Math.round((d.count / maxDayCount) * 100);
              const moodObj = MOODS.find(m => m.key === d.mood);
              const color = moodObj ? moodObj.cls : '';
              return `<div class="atc-col">
                <div class="atc-bar-wrap">
                  <div class="atc-bar ${color}" style="height:${barH}%">
                    ${d.count > 0 ? `<span class="atc-count">${d.count}</span>` : ''}
                  </div>
                </div>
                <div class="atc-label">${d.label}</div>
              </div>`;
            }).join('')}
          </div>
        </div>
      </div>

      <!-- 日历 + 成就徽章 -->
      <div class="ach-layout">
        <div class="ach-left">
          <div class="mood-calendar">
            <div class="calendar-header">
              <button class="calendar-nav" id="calPrev">◀</button>
              <h3>${calYear}年${calMonth + 1}月</h3>
              <button class="calendar-nav" id="calNext">▶</button>
            </div>
            <div class="calendar-grid" id="calendarGrid">
              ${renderCalendar()}
            </div>
            <div class="calendar-legend">
              ${MOODS.slice(0, 5).map(m => `<span class="cl-item"><span>${m.icon}</span>${m.label}</span>`).join('')}
            </div>
          </div>
        </div>
        <div class="ach-right">
          <div class="ach-badges-header">
            <h3>🏅 成就徽章</h3>
            <span class="ach-badges-count">${unlockedCount}/${totalAchievements}</span>
          </div>
          <div class="achievement-grid">
            ${ACHIEVEMENTS.map(a => {
              const unlocked = unlockedIds.includes(a.id);
              return `<div class="achievement-card ${unlocked ? 'unlocked' : 'locked'}">
                <div class="ach-icon">${unlocked ? a.icon : '🔒'}</div>
                <div class="ach-name">${unlocked ? a.name : '???'}</div>
                <div class="ach-desc">${unlocked ? a.desc : '继续探索来解锁'}</div>
                ${unlocked ? '<div class="ach-unlocked-tag">已解锁 ✅</div>' : ''}
              </div>`;
            }).join('')}
          </div>
        </div>
      </div>

      <!-- 里程碑时间线 -->
      <div class="ach-milestones">
        <div class="ach-chart-title" style="margin-bottom:16px;">🗺️ 成长足迹</div>
        ${milestones.length === 0 ?
          '<div class="empty-state"><div class="empty-icon">🌱</div>开始写手账，留下你的成长足迹吧</div>' :
          `<div class="milestone-timeline">
            ${milestones.map((m, i) => `
              <div class="milestone-item ${i === 0 ? 'latest' : ''}">
                <div class="ms-dot">${m.icon}</div>
                <div class="ms-content">
                  <div class="ms-text">${m.text}</div>
                  ${m.time ? `<div class="ms-time">${m.time}</div>` : ''}
                </div>
              </div>
            `).join('')}
          </div>`
        }
      </div>
    `;

    // 日历翻页
    $('#calPrev', content)?.addEventListener('click', () => {
      calMonth--;
      if (calMonth < 0) { calMonth = 11; calYear--; }
      renderAchievementPage();
    });
    $('#calNext', content)?.addEventListener('click', () => {
      calMonth++;
      if (calMonth > 11) { calMonth = 0; calYear++; }
      renderAchievementPage();
    });

    bindCardActions(content);
  }

  function renderCalendar() {
    const journals = Store.get('journals', []);
    const days = ['日', '一', '二', '三', '四', '五', '六'];
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const today = new Date();

    let html = days.map(d => `<div class="calendar-cell header">${d}</div>`).join('');

    for (let i = 0; i < firstDay; i++) html += '<div class="calendar-cell empty"></div>';

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayJournals = journals.filter(j => {
        const jd = new Date(j.time);
        return jd.getFullYear() === calYear && jd.getMonth() === calMonth && jd.getDate() === d;
      });
      const isToday = today.getFullYear() === calYear && today.getMonth() === calMonth && today.getDate() === d;
      let cellContent = d;
      let cls = 'calendar-cell';
      if (dayJournals.length > 0) {
        const mood = MOODS.find(m => m.key === dayJournals[0].mood);
        cellContent = mood ? mood.icon : d;
        cls += ' has-mood';
      }
      if (isToday) cls += ' today';
      html += `<div class="${cls}">${cellContent}</div>`;
    }

    return html;
  }

  // 云途图鉴按钮已移除（内容默认渲染）

  /* ============ 通用卡片渲染 ============ */
  function renderCardHTML(journal, showFav = false, showDelete = false) {
    const mood = MOODS.find(m => m.key === journal.mood);
    const moodLabel = mood ? `${mood.icon} ${mood.label}` : journal.mood;
    const moodCls = mood ? mood.cls : '';
    const isFav = journal.favorited;

    return `<div class="card-item" data-id="${journal.id}">
      ${showFav || showDelete ? `<div class="card-actions">
        ${showFav ? `<button class="card-action-btn ${isFav ? 'favorited' : ''}" data-action="fav" title="收藏">♡</button>` : ''}
        ${showDelete ? `<button class="card-action-btn" data-action="delete" title="删除">🗑</button>` : ''}
      </div>` : ''}
      <span class="card-mood ${moodCls}">${moodLabel}</span>
      ${journal.title ? `<div style="color:#634faa;font-size:16px;font-weight:500;margin-bottom:6px;">${journal.title}</div>` : ''}
      <div class="card-text">${journal.text}</div>
      <div class="card-time">${journal.author ? journal.author + ' · ' : ''}${fmtTime(journal.time)}</div>
    </div>`;
  }

  function bindCardActions(container) {
    container.querySelectorAll('.card-action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.getAttribute('data-action');
        const card = btn.closest('.card-item');
        const id = card?.getAttribute('data-id');
        if (!id) return;

        if (action === 'fav') {
          toggleFavorite(id);
          btn.classList.toggle('favorited');
          btn.textContent = btn.classList.contains('favorited') ? '♥' : '♡';
        } else if (action === 'delete') {
          deleteJournal(id);
          card.style.transition = 'all 0.3s';
          card.style.opacity = '0';
          card.style.transform = 'translateX(30px)';
          setTimeout(() => card.remove(), 300);
        }
      });
    });
  }

  function toggleFavorite(id) {
    const journals = Store.get('journals', []);
    const j = journals.find(j => j.id === id);
    if (j) {
      j.favorited = !j.favorited;
      Store.set('journals', journals);
      const stats = getStats();
      stats.totalFavorited = journals.filter(j => j.favorited).length;
      Store.set('stats', stats);
      showToast(j.favorited ? '已收藏 💜' : '已取消收藏');
      checkAchievements();
    }
  }

  function deleteJournal(id) {
    let journals = Store.get('journals', []);
    journals = journals.filter(j => j.id !== id);
    Store.set('journals', journals);
    showToast('已删除');
  }

  /* ============ 统计与成就 ============ */
  function getStats() {
    return Store.get('stats', {
      totalWritten: 0,
      totalPicked: 0,
      totalFavorited: 0,
      bubblePopped: 0,
      streak: 0,
      moodTypes: 0,
    });
  }

  function updateStats() {
    const journals = Store.get('journals', []);
    const stats = getStats();
    stats.totalWritten = journals.filter(j => j.status === 'published').length;
    stats.totalFavorited = journals.filter(j => j.favorited).length;
    stats.moodTypes = new Set(journals.map(j => j.mood)).size;
    stats.streak = calcStreak(journals);
    Store.set('stats', stats);
  }

  function calcStreak(journals) {
    const published = journals.filter(j => j.status === 'published');
    if (published.length === 0) return 0;
    const days = [...new Set(published.map(j => {
      const d = new Date(j.time);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    }))].sort().reverse();

    let streak = 1;
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
    if (days[0] !== todayStr) return 0;

    for (let i = 1; i < days.length; i++) {
      // 简单连续判断
      streak++;
    }
    return streak;
  }

  function checkAchievements() {
    const stats = getStats();
    const journals = Store.get('journals', []);
    stats.totalWritten = journals.filter(j => j.status === 'published').length;
    stats.streak = calcStreak(journals);
    stats.moodTypes = new Set(journals.map(j => j.mood)).size;

    const unlocked = Store.get('achievements', []);
    let newUnlock = false;

    ACHIEVEMENTS.forEach(a => {
      if (!unlocked.includes(a.id) && a.check(stats)) {
        unlocked.push(a.id);
        newUnlock = true;
      }
    });

    if (newUnlock) {
      Store.set('achievements', unlocked);
      const newAch = ACHIEVEMENTS.filter(a => unlocked.includes(a.id) && a.check(stats));
      if (newAch.length > 0) {
        showToast(`🎉 解锁成就：${newAch[newAch.length - 1].name}！`);
      }
    }
  }

  /* ============ 抽一片云 ============ */
  const CLOUD_PAPER_QUOTES = [
    { icon: '☁️', text: '你不必总是坚强，偶尔脆弱也没关系。', category: '温柔' },
    { icon: '🌙', text: '深夜的你比想象中更勇敢，明天一定会更好。', category: '鼓励' },
    { icon: '🌸', text: '迷茫只是暂时的，每朵花都有自己的花期。', category: '安抚' },
    { icon: '💫', text: '就算全世界都不理解你，你也值得被爱。', category: '温柔' },
    { icon: '⭐', text: '你的存在本身就是一束光，照亮了某个人的世界。', category: '鼓励' },
    { icon: '🍃', text: '慢慢来，比较快。给自己一点时间。', category: '安抚' },
    { icon: '🦋', text: '所有的失去，都会以另一种方式归来。', category: '温柔' },
    { icon: '🌈', text: '低谷只是暂时的，雨后一定有彩虹在等你。', category: '鼓励' },
    { icon: '🕊️', text: '你笑起来真好看，像好天气一样。', category: '温柔' },
    { icon: '🌿', text: '允许自己不完美，允许自己偶尔停下来。', category: '安抚' },
    { icon: '✨', text: '生活不会一直晴天，但每一朵乌云都镶着银边。', category: '鼓励' },
    { icon: '💜', text: '这世界偷偷爱着你，只是你暂时不知道而已。', category: '温柔' },
    { icon: '🌻', text: '你已经做得很好了，今天也辛苦了。', category: '鼓励' },
    { icon: '🌧️', text: '难过的时候就哭出来吧，眼泪也是一种勇敢。', category: '安抚' },
    { icon: '🍀', text: '每一步都算数，即使你看不到终点。', category: '鼓励' },
    { icon: '🎨', text: '不用急着找到方向，漫无目的也是一种风景。', category: '安抚' },
    { icon: '🌟', text: '你值得世界上所有的温柔，不要怀疑这一点。', category: '温柔' },
    { icon: '🌺', text: '花开需要时间，你也是。慢慢来，不要急。', category: '安抚' },
    { icon: '🎶', text: '所有的伟大，都源于一个勇敢的开始。', category: '鼓励' },
    { icon: '💎', text: '独处不是孤独，是和自己对话的珍贵时光。', category: '温柔' },
    { icon: '🧸', text: '累了就休息一下，没有人会因此责怪你。', category: '安抚' },
    { icon: '🔮', text: '相信过程，一切都在慢慢变好。', category: '鼓励' },
    { icon: '🪷', text: '你的温柔不是软弱，而是最了不起的力量。', category: '温柔' },
    { icon: '🎋', text: '有些路走着走着就亮了，别着急。', category: '安抚' },
  ];

  let isDrawingCloud = false;

  function drawCloudPaper() {
    if (isDrawingCloud) return;
    isDrawingCloud = true;

    const btn = $('#drawCloudBtn');
    if (btn) btn.classList.add('drawing');

    // 随机选一句
    const quote = CLOUD_PAPER_QUOTES[Math.floor(Math.random() * CLOUD_PAPER_QUOTES.length)];

    // 创建飘落遮罩层
    const overlay = document.createElement('div');
    overlay.className = 'cloud-paper-overlay';
    document.body.appendChild(overlay);

    // 创建云纸片
    const paper = document.createElement('div');
    paper.className = 'cloud-paper';
    paper.innerHTML = `
      <div class="cp-icon">${quote.icon}</div>
      <div class="cp-text">"${quote.text}"</div>
      <div class="cp-author">— 云端信纸 · ${quote.category}</div>
      <div class="cp-actions">
        <button class="cp-btn fav-btn" id="cpFavBtn">♡ 收藏到手账</button>
        <button class="cp-btn dismiss-btn" id="cpDismissBtn">飘走吧</button>
      </div>
    `;
    overlay.appendChild(paper);

    // 收藏按钮
    const favBtn = paper.querySelector('#cpFavBtn');
    let favorited = false;
    favBtn.addEventListener('click', () => {
      if (favorited) return;
      favorited = true;

      // 保存到收藏夹
      const journals = Store.get('journals', []);
      const journal = {
        id: genId(),
        mood: 'healed',
        title: `☁ 云纸片 · ${quote.category}`,
        text: quote.text,
        time: Date.now(),
        status: 'published',
        favorited: true,
        source: 'cloud-paper',
      };
      journals.unshift(journal);
      Store.set('journals', journals);

      const stats = getStats();
      stats.totalFavorited = journals.filter(j => j.favorited).length;
      Store.set('stats', stats);
      checkAchievements();

      favBtn.classList.add('favorited');
      favBtn.textContent = '♥ 已收藏';
      showToast('☁️ 云纸片已收藏到手账');
    });

    // 飘走按钮
    const dismissBtn = paper.querySelector('#cpDismissBtn');
    dismissBtn.addEventListener('click', () => dismissPaper());

    // 自动消失（10秒后）
    const autoTimer = setTimeout(() => dismissPaper(), 10000);

    function dismissPaper() {
      clearTimeout(autoTimer);
      paper.classList.add('fade-out');
      setTimeout(() => {
        overlay.remove();
        isDrawingCloud = false;
        if (btn) btn.classList.remove('drawing');
      }, 600);
    }

    // 点击遮罩空白处也可关闭
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) dismissPaper();
    });
  }

  const drawCloudBtn = $('#drawCloudBtn');
  if (drawCloudBtn) {
    drawCloudBtn.addEventListener('click', drawCloudPaper);
  }

  /* ============ 初始化 ============ */
  function init() {
    initTheme();
    renderHomeFull();
    renderPickPage();
    renderMinePage();
    initRelaxPage();
    renderAchievementPage();
    renderCloudWall();
    updateStats();
    checkAchievements();

    // 首页每次切换回时刷新
    const observer = new MutationObserver(() => {
      if ($('[data-page="home"]').classList.contains('active')) renderHomeFull();
      if ($('[data-page="cloudwall"]').classList.contains('active')) renderCloudWall();
    });
    pages.forEach(p => observer.observe(p, { attributes: true, attributeFilter: ['class'] }));
  }

  // DOM 加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
