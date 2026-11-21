/**
 * Cổng thông tin trường học — public first, login modal
 */
(function () {
  'use strict';

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];

  const state = {
    token: sessionStorage.getItem('school_token') || '',
    user: null,
    config: {},
    menus: [],
    apps: [],
    posts: [],
    isAdmin: false
  };

  const ICONS = {
    house: '⌂', home: '⌂', newspaper: '📰', bell: '🔔',
    users: '👥', book: '📖', folder: '📁', chart: '📊',
    settings: '⚙', link: '🔗', grid: '▦', shield: '🛡',
    building: '🏫', school: '🏫', 'file-text': '📄', file: '📄'
  };

  function icon(n) {
    return ICONS[n] || ICONS[String(n || '').toLowerCase()] || '•';
  }

  function color(seed) {
    const c = ['#1e4a8c', '#0f766e', '#b45309', '#6d28d9', '#be123c', '#0369a1', '#15803d', '#c2410c'];
    let h = 0;
    const s = String(seed || 'A');
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return c[h % c.length];
  }

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, ch => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
    ));
  }

  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2600);
  }

  async function api(action, data) {
    const url = window.APP_CONFIG && window.APP_CONFIG.API_URL;
    if (!url || String(url).includes('YOUR-WORKER')) throw new Error('Chưa cấu hình API_URL');
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, data: Object.assign({}, data || {}, { token: state.token }) })
    });
    const j = await res.json();
    if (!j.ok) throw new Error(j.error || 'Lỗi API');
    return j.data;
  }

  function applyData(d, withUser) {
    state.config = d.config || {};
    state.menus = (d.menus || []).filter(m => String(m.status) !== 'OFF');
    state.apps = dedupeApps(d.apps || []);
    state.posts = d.posts || [];
    state.isAdmin = !!d.isAdmin;
    if (withUser) state.user = d.user || null;
  }

  function dedupeApps(list) {
    const seen = new Set();
    const out = [];
    list.forEach(a => {
      if (String(a.status) === 'OFF') return;
      const k = (String(a.title || '') + '|' + String(a.url || '')).toLowerCase();
      if (seen.has(k)) return;
      seen.add(k);
      out.push(a);
    });
    return out;
  }

  function navItems() {
    const base = [{ id: 'HOME', title: 'Trang chủ', icon: 'house', sort: 0 }];
    const rest = state.menus
      .filter(m => {
        if (m.menuId === 'M_HOME' || m.menuId === 'HOME') return false;
        const loc = String(m.location || 'SIDEBAR').toUpperCase();
        return loc !== 'HOME';
      })
      .map(m => ({ id: m.menuId, title: m.title, icon: m.icon, sort: Number(m.sortOrder || 0), raw: m }));
    return base.concat(rest).sort((a, b) => a.sort - b.sort);
  }

  function paintShell() {
    const cfg = state.config || {};
    const name = cfg.schoolName || 'Cổng thông tin trường học';
    document.title = name;
    $('#schoolName').textContent = name;
    $('#fName').textContent = name;
    $('#fAddr').textContent = cfg.address || 'Địa chỉ đơn vị';
    const contact = [cfg.phone && ('ĐT: ' + cfg.phone), cfg.email].filter(Boolean).join(' · ');
    $('#fContact').textContent = contact || '—';

    const items = navItems();
    const html = items.map(it =>
      '<button type="button" data-go="' + esc(it.id) + '">' +
      '<span>' + icon(it.icon) + '</span> ' + esc(it.title) +
      '</button>'
    ).join('');

    $('#nav').innerHTML = html;
    let m = html;
    if (state.isAdmin) {
      m += '<button type="button" data-go="ADMIN"><span>⚙</span> Quản trị</button>';
    }
    $('#mnav').innerHTML = m;

    $$('#nav [data-go], #mnav [data-go]').forEach(btn => {
      btn.onclick = () => {
        closeMobile();
        go(btn.getAttribute('data-go'));
      };
    });

    if (state.user) {
      $('#btnLogin').classList.add('hidden');
      $('#who').classList.remove('hidden');
      $('#whoName').textContent = state.user.fullName || state.user.username;
      $('#ava').textContent = (state.user.fullName || 'U').charAt(0).toUpperCase();
    } else {
      $('#btnLogin').classList.remove('hidden');
      $('#who').classList.add('hidden');
    }
  }

  function go(id) {
    if (id === 'HOME' || id === 'M_HOME') return renderHome();
    if (id === 'ADMIN') {
      if (!state.user || !state.isAdmin) {
        openLogin();
        toast('Cần đăng nhập quản trị');
        return;
      }
      return renderAdmin();
    }
    const m = state.menus.find(x => x.menuId === id);
    if (!m) return;
    if (m.menuType === 'LINK' && m.url && m.url !== '/' && m.url !== '#') {
      if (String(m.openMode).toUpperCase() === 'NEW' || /^https?:/i.test(m.url)) {
        window.open(m.url, '_blank', 'noopener');
        return;
      }
    }
    $('#main').innerHTML =
      '<div class="panel"><h1>' + esc(m.title) + '</h1>' +
      '<p class="dim">Nội dung trang đang được cập nhật.</p>' +
      (m.url && /^https?:/i.test(m.url)
        ? '<p><a class="btn btn-primary" href="' + esc(m.url) + '" target="_blank" rel="noopener">Mở liên kết</a></p>'
        : '') +
      '</div>';
  }

  function renderHome() {
    const cfg = state.config || {};
    const apps = state.apps;
    const posts = state.posts;

    const appHtml = apps.length
      ? apps.map(a => {
          const letter = (a.title || 'A').charAt(0).toUpperCase();
          return '<a class="card" href="' + esc(a.url) + '" target="_blank" rel="noopener">' +
            '<span class="badge-ico" style="background:' + color(a.title) + '">' + esc(letter) + '</span>' +
            '<span><b>' + esc(a.title) + '</b><small>' + esc(a.category || 'Ứng dụng') + '</small></span></a>';
        }).join('')
      : '<div class="empty">Chưa có ứng dụng công khai.</div>';

    const postHtml = posts.length
      ? '<div class="grid">' + posts.map(p =>
          '<article class="post" data-post="' + esc(p.postId) + '">' +
          '<span class="tag">' + esc(p.category || 'Thông báo') + '</span>' +
          '<h3>' + esc(p.title) + '</h3>' +
          '<p>' + esc(p.summary || '') + '</p></article>'
        ).join('') + '</div>'
      : '<div class="empty">Chưa có bài viết được đăng.</div>';

    $('#main').innerHTML =
      '<section class="hero">' +
      '<div class="badge">Cổng thông tin</div>' +
      '<h1>' + esc(cfg.welcomeTitle || cfg.schoolName || 'Cổng thông tin trường học') + '</h1>' +
      '<p>' + esc(cfg.welcomeText || 'Không gian thông tin và tiện ích làm việc dành cho cán bộ, giáo viên, nhân viên.') + '</p>' +
      '<div class="hero-actions">' +
      (state.user ? '' : '<button type="button" class="btn btn-primary lg" id="heroLogin">Đăng nhập làm việc</button>') +
      '<a class="btn btn-outline lg" href="#apps">Xem tiện ích</a>' +
      '</div></section>' +
      '<section class="sec" id="apps">' +
      '<div class="sec-h"><div><h2>Ứng dụng thường dùng</h2><p class="dim">Truy cập nhanh các nền tảng làm việc</p></div></div>' +
      '<div class="grid">' + appHtml + '</div></section>' +
      '<section class="sec">' +
      '<div class="sec-h"><div><h2>Tin tức &amp; thông báo</h2><p class="dim">Cập nhật mới từ nhà trường</p></div></div>' +
      postHtml + '</section>';

    const hl = $('#heroLogin');
    if (hl) hl.onclick = openLogin;
    $$('[data-post]').forEach(el => {
      el.onclick = () => openPost(el.getAttribute('data-post'));
    });
  }

  async function openPost(id) {
    try {
      let p = state.posts.find(x => x.postId === id);
      if (!p && state.token) p = await api('getPost', { postId: id });
      if (!p) return toast('Không tìm thấy bài viết');
      $('#main').innerHTML =
        '<article class="panel article">' +
        '<span class="tag">' + esc(p.category || 'Thông báo') + '</span>' +
        '<h1>' + esc(p.title) + '</h1>' +
        '<p class="dim">' + esc(p.summary || '') + '</p>' +
        '<div class="article-body">' + (p.contentHtml || '<p class="dim">Nội dung đang cập nhật.</p>') + '</div>' +
        '<p style="margin-top:20px"><button type="button" class="btn btn-outline" id="back">← Về trang chủ</button></p></article>';
      $('#back').onclick = renderHome;
    } catch (e) {
      toast(e.message);
    }
  }

  function renderAdmin() {
    $('#main').innerHTML =
      '<div class="sec-h"><div><h2>Quản trị hệ thống</h2><p class="dim">Cấu hình, người dùng, menu, ứng dụng, bài viết</p></div></div>' +
      '<div class="grid" id="adminCards">' +
      adminCard('config', 'Cấu hình', 'Tên trường, địa chỉ') +
      adminCard('users', 'Người dùng', 'Tài khoản & nhóm') +
      adminCard('menus', 'Menu', 'Thanh điều hướng') +
      adminCard('apps', 'Ứng dụng', 'Lối tắt tiện ích') +
      adminCard('posts', 'Bài viết', 'Tin tức công khai') +
      '</div><div id="adminPanel"></div>';
    $$('#adminCards [data-admin]').forEach(b => {
      b.onclick = () => adminPanel(b.getAttribute('data-admin'));
    });
  }

  function adminCard(key, title, desc) {
    return '<button type="button" class="card" data-admin="' + key + '">' +
      '<span class="badge-ico" style="background:#1e4a8c">⚙</span>' +
      '<span><b>' + title + '</b><small>' + desc + '</small></span></button>';
  }

  function field(label, name, val, type) {
    val = val || '';
    type = type || 'text';
    if (type === 'textarea') {
      return '<label class="full">' + label + '<textarea name="' + name + '">' + esc(val) + '</textarea></label>';
    }
    return '<label>' + label + '<input name="' + name + '" type="' + type + '" value="' + esc(val) + '"></label>';
  }

  function table(headers, rows) {
    return '<div class="table-wrap"><table class="table"><thead><tr>' +
      headers.map(h => '<th>' + h + '</th>').join('') + '</tr></thead><tbody>' +
      rows.map(r => '<tr>' + r.map(c => '<td>' + esc(c) + '</td>').join('') + '</tr>').join('') +
      '</tbody></table></div>';
  }

  async function adminPanel(key) {
    const panel = $('#adminPanel');
    panel.innerHTML = '<div class="panel"><p class="dim">Đang tải…</p></div>';
    try {
      if (key === 'config') {
        const c = state.config || {};
        panel.innerHTML = '<div class="panel"><h3>Cấu hình</h3><form class="form" id="f">' +
          field('Tên trường', 'schoolName', c.schoolName) +
          field('Địa chỉ', 'address', c.address) +
          field('Điện thoại', 'phone', c.phone) +
          field('Email', 'email', c.email) +
          field('Tiêu đề chào', 'welcomeTitle', c.welcomeTitle) +
          field('Mô tả', 'welcomeText', c.welcomeText, 'textarea') +
          '<label class="full"><button class="btn btn-primary" type="submit">Lưu</button></label></form></div>';
        $('#f').onsubmit = async e => {
          e.preventDefault();
          const config = Object.fromEntries(new FormData(e.target));
          await api('saveConfig', { config });
          state.config = Object.assign({}, state.config, config);
          paintShell();
          toast('Đã lưu');
        };
      }
      if (key === 'users') {
        const users = await api('listUsers');
        panel.innerHTML = '<div class="panel"><h3>Người dùng</h3>' +
          table(['Tài khoản', 'Họ tên', 'Nhóm', 'TT'], users.map(u => [u.username, u.fullName, u.groupCode, u.status])) +
          '<h4>Thêm / cập nhật</h4><form class="form" id="f">' +
          field('Username', 'username') + field('Họ tên', 'fullName') +
          field('Mật khẩu', 'password', '', 'password') +
          field('Nhóm (ADMIN/BGH/GV/VP)', 'groupCode', 'GV') +
          '<label class="full"><button class="btn btn-primary" type="submit">Lưu</button></label></form></div>';
        $('#f').onsubmit = async e => {
          e.preventDefault();
          await api('saveUser', Object.fromEntries(new FormData(e.target)));
          toast('Đã lưu');
          adminPanel('users');
        };
      }
      if (key === 'menus') {
        const menus = await api('listMenusAdmin');
        panel.innerHTML = '<div class="panel"><h3>Menu</h3>' +
          table(['ID', 'Tiêu đề', 'Icon', 'URL', 'TT'], menus.map(m => [m.menuId, m.title, m.icon, m.url, m.status])) +
          '<h4>Thêm / sửa</h4><form class="form" id="f">' +
          field('menuId (trống = tự tạo)', 'menuId') + field('Tiêu đề', 'title') +
          field('Icon', 'icon', 'link') + field('URL', 'url') +
          field('Thứ tự', 'sortOrder', '10', 'number') +
          '<label class="full"><button class="btn btn-primary" type="submit">Lưu</button></label></form></div>';
        $('#f').onsubmit = async e => {
          e.preventDefault();
          await api('saveMenu', Object.fromEntries(new FormData(e.target)));
          const d = await api('bootstrap');
          applyData(d, true);
          paintShell();
          toast('Đã lưu');
          adminPanel('menus');
        };
      }
      if (key === 'apps') {
        panel.innerHTML = '<div class="panel"><h3>Thêm ứng dụng</h3><form class="form" id="f">' +
          field('Tên', 'title') + field('URL', 'url') +
          field('Nhóm', 'category', 'Chung') + field('Thứ tự', 'sortOrder', '10', 'number') +
          '<label class="full"><button class="btn btn-primary" type="submit">Lưu</button></label></form>' +
          '<p class="dim">Icon dùng chữ cái màu, không cần link ảnh.</p></div>';
        $('#f').onsubmit = async e => {
          e.preventDefault();
          await api('saveApp', Object.fromEntries(new FormData(e.target)));
          const d = await api('bootstrap');
          applyData(d, true);
          toast('Đã lưu');
          adminPanel('apps');
        };
      }
      if (key === 'posts') {
        panel.innerHTML = '<div class="panel"><h3>Đăng bài</h3><form class="form" id="f">' +
          field('Tiêu đề', 'title') + field('Danh mục', 'category', 'Thông báo') +
          field('Tóm tắt', 'summary') + field('Nội dung HTML', 'contentHtml', '', 'textarea') +
          '<label>Trạng thái<select name="status"><option value="DRAFT">Nháp</option><option value="PUBLISHED">Công khai</option></select></label>' +
          '<label><span><input type="checkbox" name="pinned" value="true"> Ghim</span></label>' +
          '<label class="full"><button class="btn btn-primary" type="submit">Lưu</button></label></form></div>';
        $('#f').onsubmit = async e => {
          e.preventDefault();
          const d = Object.fromEntries(new FormData(e.target));
          d.pinned = !!e.target.pinned.checked;
          await api('savePost', d);
          toast('Đã lưu bài viết');
          e.target.reset();
        };
      }
    } catch (e) {
      panel.innerHTML = '<div class="panel"><p class="err">' + esc(e.message) + '</p></div>';
    }
  }

  /* Login modal — never shown on first paint */
  function openLogin() {
    $('#overlay').classList.remove('hidden');
    $('#loginErr').textContent = '';
    setTimeout(() => { const u = $('#username'); if (u) u.focus(); }, 30);
  }
  function closeLogin() {
    $('#overlay').classList.add('hidden');
  }

  async function onLogin(e) {
    e.preventDefault();
    $('#loginErr').textContent = '';
    const btn = $('#loginBtn');
    btn.disabled = true;
    btn.textContent = 'Đang đăng nhập…';
    try {
      const d = await api('login', {
        username: $('#username').value.trim(),
        password: $('#password').value
      });
      state.token = d.token;
      sessionStorage.setItem('school_token', d.token);
      state.user = d.user;
      closeLogin();
      const boot = await api('bootstrap');
      applyData(boot, true);
      paintShell();
      renderHome();
      toast('Đăng nhập thành công');
    } catch (err) {
      $('#loginErr').textContent = err.message;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Đăng nhập';
    }
  }

  async function onLogout() {
    try { await api('logout'); } catch (_) {}
    sessionStorage.removeItem('school_token');
    state.token = '';
    state.user = null;
    state.isAdmin = false;
    paintShell();
    renderHome();
    toast('Đã đăng xuất');
  }

  function closeMobile() {
    $('#mnav').classList.add('hidden');
  }

  /* Boot: always show public home first — never login screen */
  async function boot() {
    // Keep overlay hidden
    $('#overlay').classList.add('hidden');

    let loaded = false;
    if (state.token) {
      try {
        const d = await api('bootstrap');
        applyData(d, true);
        loaded = true;
      } catch (_) {
        sessionStorage.removeItem('school_token');
        state.token = '';
        state.user = null;
      }
    }
    if (!loaded) {
      try {
        const d = await api('publicBootstrap', {});
        applyData(d, false);
      } catch (e) {
        // Soft fallback — still show UI
        state.config = {
          schoolName: 'Cổng thông tin trường học',
          welcomeTitle: 'Cổng thông tin trường học',
          welcomeText: 'Không gian thông tin và tiện ích làm việc dành cho cán bộ, giáo viên, nhân viên.',
          address: '', phone: '', email: ''
        };
        state.menus = [];
        state.apps = [];
        state.posts = [];
        console.warn('publicBootstrap:', e.message);
      }
    }
    paintShell();
    renderHome();
  }

  // Events
  $('#loginForm').addEventListener('submit', onLogin);
  $('#btnLogin').onclick = openLogin;
  $('#btnCloseLogin').onclick = closeLogin;
  $('#overlayBg').onclick = closeLogin;
  $('#btnLogout').onclick = onLogout;
  $('#btnHome').onclick = e => { e.preventDefault(); renderHome(); };
  $('#burger').onclick = () => $('#mnav').classList.toggle('hidden');
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeLogin();
  });

  boot();
})();
