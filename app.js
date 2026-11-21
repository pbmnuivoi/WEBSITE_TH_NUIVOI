/**
 * Cổng thông tin — Home (public) + Sidebar workspace (logged-in)
 * Menu location:
 *   HOME    → thanh menu trang công khai (không cần login)
 *   SIDEBAR → menu trong khu vực làm việc sau đăng nhập
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
    isAdmin: false,
    mode: 'public' // public | work
  };

  const ICONS = {
    house: '⌂', home: '⌂', newspaper: '📰', bell: '🔔', users: '👥', book: '📖',
    folder: '📁', chart: '📊', settings: '⚙', link: '🔗', grid: '▦', shield: '🛡',
    building: '🏫', school: '🏫', 'file-text': '📄', file: '📄', pen: '✎', user: '👤'
  };

  function icon(n) { return ICONS[n] || ICONS[String(n || '').toLowerCase()] || '•'; }
  function color(seed) {
    const c = ['#1e4a8c', '#0f766e', '#b45309', '#6d28d9', '#be123c', '#0369a1', '#15803d', '#c2410c'];
    let h = 0; const s = String(seed || 'A');
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return c[h % c.length];
  }
  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }
  function toast(msg) {
    const el = $('#toast'); el.textContent = msg; el.classList.add('show');
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

  function apply(d, withUser) {
    state.config = d.config || {};
    state.menus = (d.menus || []).filter(m => String(m.status) !== 'OFF');
    state.apps = dedupe(d.apps || []);
    state.posts = d.posts || [];
    state.isAdmin = !!d.isAdmin;
    if (withUser) state.user = d.user || null;
  }

  function dedupe(list) {
    const seen = new Set(), out = [];
    list.forEach(a => {
      if (String(a.status) === 'OFF') return;
      const k = (String(a.title || '') + '|' + String(a.url || '')).toLowerCase();
      if (seen.has(k)) return;
      seen.add(k); out.push(a);
    });
    return out;
  }

  /** Menu trang chủ công khai */
  function homeMenus() {
    return state.menus
      .filter(m => String(m.location || '').toUpperCase() === 'HOME')
      .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
  }

  /** Menu sidebar khu vực làm việc */
  function sideMenus() {
    return state.menus
      .filter(m => {
        const loc = String(m.location || 'SIDEBAR').toUpperCase();
        return loc === 'SIDEBAR' || loc === '';
      })
      .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
  }

  /* ---------- PUBLIC ---------- */
  function showPublic() {
    state.mode = 'public';
    $('#publicApp').classList.remove('hidden');
    $('#workApp').classList.add('hidden');
    paintPublicShell();
    renderPublicHome();
  }

  function paintPublicShell() {
    const cfg = state.config || {};
    const name = cfg.schoolName || 'Cổng thông tin trường học';
    document.title = name;
    $('#pubSchool').textContent = name;
    $('#fName').textContent = name;
    $('#fAddr').textContent = cfg.address || 'Địa chỉ đơn vị';
    $('#fContact').textContent = [cfg.phone && ('ĐT: ' + cfg.phone), cfg.email].filter(Boolean).join(' · ') || '—';

    const items = [{ id: 'HOME', title: 'Trang chủ', icon: 'house' }].concat(
      homeMenus().map(m => ({ id: m.menuId, title: m.title, icon: m.icon, raw: m }))
    );
    const html = items.map(it =>
      '<button type="button" data-home="' + esc(it.id) + '"><span>' + icon(it.icon) + '</span> ' + esc(it.title) + '</button>'
    ).join('');
    $('#homeNav').innerHTML = html;
    $('#homeMnav').innerHTML = html;
    $$('#homeNav [data-home], #homeMnav [data-home]').forEach(b => {
      b.onclick = () => { closePubMobile(); navHome(b.getAttribute('data-home')); };
    });
  }

  function navHome(id) {
    if (id === 'HOME') return renderPublicHome();
    const m = state.menus.find(x => x.menuId === id);
    if (!m) return;
    if (m.url && /^https?:/i.test(m.url)) {
      window.open(m.url, m.openMode === 'SAME' ? '_self' : '_blank', 'noopener');
      return;
    }
    $('#publicMain').innerHTML =
      '<div class="panel"><h1>' + esc(m.title) + '</h1>' +
      '<p class="dim">Nội dung trang công khai đang được cập nhật.</p></div>';
  }

  function renderPublicHome() {
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
          '<h3>' + esc(p.title) + '</h3><p>' + esc(p.summary || '') + '</p></article>'
        ).join('') + '</div>'
      : '<div class="empty">Chưa có bài viết được đăng.</div>';

    $('#publicMain').innerHTML =
      '<section class="hero">' +
      '<div class="badge">Cổng thông tin công khai</div>' +
      '<h1>' + esc(cfg.welcomeTitle || cfg.schoolName || 'Cổng thông tin trường học') + '</h1>' +
      '<p>' + esc(cfg.welcomeText || 'Không gian thông tin dành cho cộng đồng nhà trường.') + '</p>' +
      '<div class="hero-actions">' +
      '<button type="button" class="btn btn-primary lg" id="heroLogin">Đăng nhập làm việc</button>' +
      '<a class="btn btn-outline lg" href="#apps">Xem tiện ích</a></div></section>' +
      '<section class="sec" id="apps"><div class="sec-h"><h2>Ứng dụng thường dùng</h2><p class="dim">Truy cập nhanh</p></div>' +
      '<div class="grid">' + appHtml + '</div></section>' +
      '<section class="sec"><div class="sec-h"><h2>Tin tức &amp; thông báo</h2><p class="dim">Bài đã đăng công khai</p></div>' +
      postHtml + '</section>';

    const hl = $('#heroLogin');
    if (hl) hl.onclick = openLogin;
    $$('[data-post]').forEach(el => {
      el.onclick = () => openPublicPost(el.getAttribute('data-post'));
    });
  }

  async function openPublicPost(id) {
    try {
      let p = state.posts.find(x => x.postId === id);
      if (!p && state.token) p = await api('getPost', { postId: id });
      if (!p) return toast('Không tìm thấy bài viết');
      $('#publicMain').innerHTML =
        '<article class="panel article"><span class="tag">' + esc(p.category || 'Thông báo') + '</span>' +
        '<h1>' + esc(p.title) + '</h1><p class="dim">' + esc(p.summary || '') + '</p>' +
        '<div class="article-body">' + (p.contentHtml || '<p class="dim">Đang cập nhật.</p>') + '</div>' +
        '<p style="margin-top:18px"><button type="button" class="btn btn-outline" id="backPub">← Trang chủ</button></p></article>';
      $('#backPub').onclick = renderPublicHome;
    } catch (e) { toast(e.message); }
  }

  function closePubMobile() { $('#homeMnav').classList.add('hidden'); }

  /* ---------- WORKSPACE ---------- */
  function showWork() {
    state.mode = 'work';
    $('#publicApp').classList.add('hidden');
    $('#workApp').classList.remove('hidden');
    paintSide();
    renderDashboard();
  }

  function paintSide() {
    const cfg = state.config || {};
    $('#sideSchool').textContent = cfg.schoolName || 'Khu vực làm việc';
    $('#sideRole').textContent = (state.user && (state.user.groupCode || state.user.fullName)) || 'USER';
    $('#whoName').textContent = (state.user && (state.user.fullName || state.user.username)) || '';
    $('#ava').textContent = ((state.user && state.user.fullName) || 'U').charAt(0).toUpperCase();

    // Fixed tools + SIDEBAR menus from DB
    let html = '<div class="grp">Làm việc</div>';
    html += sideBtn('DASH', '⌂', 'Tổng quan');
    html += sideBtn('POST_NEW', '✎', 'Đăng bài viết');
    if (state.isAdmin) {
      html += '<div class="grp">Quản trị</div>';
      html += sideBtn('USERS', '👤', 'Tài khoản');
      html += sideBtn('MENUS_HOME', '📰', 'Menu trang chủ');
      html += sideBtn('MENUS_SIDE', '▦', 'Menu sidebar');
      html += sideBtn('APPS', '🔗', 'Ứng dụng / icon');
      html += sideBtn('CONFIG', '⚙', 'Cấu hình cổng');
      html += sideBtn('POSTS', '📁', 'Quản lý bài viết');
    }
    const sm = sideMenus();
    if (sm.length) {
      html += '<div class="grp">Menu đơn vị</div>';
      sm.forEach(m => {
        html += sideBtn('M:' + m.menuId, icon(m.icon), m.title);
      });
    }
    $('#sideNav').innerHTML = html;
    $$('#sideNav [data-side]').forEach(b => {
      b.onclick = () => {
        $$('#sideNav [data-side]').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        $('#side').classList.remove('open');
        navSide(b.getAttribute('data-side'));
      };
    });
  }

  function sideBtn(id, ico, title) {
    return '<button type="button" data-side="' + esc(id) + '"><span>' + ico + '</span> ' + esc(title) + '</button>';
  }

  function navSide(id) {
    if (id === 'DASH') return renderDashboard();
    if (id === 'POST_NEW') return renderPostForm();
    if (id === 'USERS') return renderUsers();
    if (id === 'MENUS_HOME') return renderMenusEditor('HOME');
    if (id === 'MENUS_SIDE') return renderMenusEditor('SIDEBAR');
    if (id === 'APPS') return renderAppsEditor();
    if (id === 'CONFIG') return renderConfig();
    if (id === 'POSTS') return renderPostsManage();
    if (id.indexOf('M:') === 0) {
      const mid = id.slice(2);
      const m = state.menus.find(x => x.menuId === mid);
      if (!m) return;
      if (m.url && /^https?:/i.test(m.url)) {
        window.open(m.url, '_blank', 'noopener');
        return;
      }
      $('#crumb').textContent = m.title;
      $('#workMain').innerHTML = '<div class="panel"><h2>' + esc(m.title) + '</h2><p class="dim">Nội dung nội bộ.</p></div>';
    }
  }

  function renderDashboard() {
    $('#crumb').textContent = 'Tổng quan';
    const name = (state.user && state.user.fullName) || 'bạn';
    $('#workMain').innerHTML =
      '<div class="panel">' +
      '<h2>Xin chào, ' + esc(name) + '</h2>' +
      '<p class="dim">Khu vực làm việc sau đăng nhập. Dùng menu bên trái để đăng bài, quản lý tài khoản và cấu hình menu trang chủ.</p>' +
      '<div class="grid" style="margin-top:16px">' +
      cardBtn('POST_NEW', '✎', 'Đăng bài', 'Soạn tin / thông báo') +
      (state.isAdmin ? cardBtn('USERS', '👤', 'Tài khoản', 'Thêm / sửa người dùng') : '') +
      (state.isAdmin ? cardBtn('MENUS_HOME', '📰', 'Menu Home', 'Menu trang công khai') : '') +
      (state.isAdmin ? cardBtn('APPS', '🔗', 'Ứng dụng', 'Icon & liên kết') : '') +
      '</div></div>';
    $$('#workMain [data-go]').forEach(b => {
      b.onclick = () => navSide(b.getAttribute('data-go'));
    });
  }

  function cardBtn(id, ico, title, desc) {
    return '<button type="button" class="card" data-go="' + id + '">' +
      '<span class="badge-ico" style="background:#1e4a8c">' + ico + '</span>' +
      '<span><b>' + title + '</b><small>' + desc + '</small></span></button>';
  }

  function field(label, name, val, type) {
    val = val || ''; type = type || 'text';
    if (type === 'textarea') return '<label class="span2">' + label + '<textarea name="' + name + '">' + esc(val) + '</textarea></label>';
    if (type === 'select-status') {
      return '<label>' + label + '<select name="' + name + '">' +
        '<option value="ON"' + (val === 'ON' ? ' selected' : '') + '>ON</option>' +
        '<option value="OFF"' + (val === 'OFF' ? ' selected' : '') + '>OFF</option></select></label>';
    }
    if (type === 'select-loc') {
      return '<label>' + label + '<select name="' + name + '">' +
        '<option value="HOME"' + (val === 'HOME' ? ' selected' : '') + '>HOME (trang chủ công khai)</option>' +
        '<option value="SIDEBAR"' + (val === 'SIDEBAR' || !val ? ' selected' : '') + '>SIDEBAR (sau đăng nhập)</option></select></label>';
    }
    return '<label>' + label + '<input name="' + name + '" type="' + type + '" value="' + esc(val) + '"></label>';
  }

  function table(headers, rows) {
    return '<div class="table-wrap"><table class="table"><thead><tr>' +
      headers.map(h => '<th>' + h + '</th>').join('') + '</tr></thead><tbody>' +
      rows.map(r => '<tr>' + r.map(c => '<td>' + esc(c) + '</td>').join('') + '</tr>').join('') +
      '</tbody></table></div>';
  }

  function renderPostForm() {
    $('#crumb').textContent = 'Đăng bài viết';
    $('#workMain').innerHTML =
      '<div class="panel"><h3>Đăng bài / thông báo</h3><form class="form" id="postForm">' +
      field('Tiêu đề', 'title') + field('Danh mục', 'category', 'Thông báo') +
      field('Tóm tắt', 'summary') + field('Nội dung HTML', 'contentHtml', '', 'textarea') +
      '<label>Trạng thái<select name="status"><option value="DRAFT">Nháp</option><option value="PUBLISHED">Công khai</option></select></label>' +
      '<label><span style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="pinned" value="true"> Ghim bài</span></label>' +
      '<label class="span2"><button class="btn btn-primary" type="submit">Lưu bài viết</button></label></form>' +
      '<p class="dim">Chọn <b>Công khai</b> để hiện trên trang chủ (không cần đăng nhập).</p></div>';
    $('#postForm').onsubmit = async e => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(e.target));
      d.pinned = !!e.target.pinned.checked;
      try {
        await api('savePost', d);
        toast('Đã lưu bài viết');
        e.target.reset();
      } catch (err) { toast(err.message); }
    };
  }

  async function renderUsers() {
    if (!state.isAdmin) return toast('Chỉ quản trị');
    $('#crumb').textContent = 'Tài khoản';
    $('#workMain').innerHTML = '<div class="panel"><p class="dim">Đang tải…</p></div>';
    try {
      const users = await api('listUsers');
      $('#workMain').innerHTML =
        '<div class="panel"><h3>Danh sách tài khoản</h3>' +
        table(['Tài khoản', 'Họ tên', 'Nhóm', 'TT'], users.map(u => [u.username, u.fullName, u.groupCode, u.status])) +
        '<h3 style="margin-top:20px">Thêm / cập nhật tài khoản</h3><form class="form" id="userForm">' +
        field('Username', 'username') + field('Họ tên', 'fullName') +
        field('Mật khẩu (bắt buộc khi tạo mới)', 'password', '', 'password') +
        field('Nhóm (ADMIN / BGH / GV / VP)', 'groupCode', 'GV') +
        field('Trạng thái', 'status', 'ON', 'select-status') +
        '<label class="span2"><button class="btn btn-primary" type="submit">Lưu tài khoản</button></label></form></div>';
      $('#userForm').onsubmit = async e => {
        e.preventDefault();
        try {
          await api('saveUser', Object.fromEntries(new FormData(e.target)));
          toast('Đã lưu tài khoản');
          renderUsers();
        } catch (err) { toast(err.message); }
      };
    } catch (e) {
      $('#workMain').innerHTML = '<div class="panel"><p class="err">' + esc(e.message) + '</p></div>';
    }
  }

  async function renderMenusEditor(loc) {
    if (!state.isAdmin) return toast('Chỉ quản trị');
    const title = loc === 'HOME' ? 'Menu trang chủ (công khai)' : 'Menu sidebar (sau đăng nhập)';
    $('#crumb').textContent = title;
    $('#workMain').innerHTML = '<div class="panel"><p class="dim">Đang tải…</p></div>';
    try {
      const all = await api('listMenusAdmin');
      const list = all.filter(m => String(m.location || 'SIDEBAR').toUpperCase() === loc);
      $('#workMain').innerHTML =
        '<div class="panel"><h3>' + esc(title) + '</h3>' +
        '<p class="dim">location = <b>' + loc + '</b>. Menu HOME hiện trên trang không cần login. Menu SIDEBAR hiện trong khu vực làm việc.</p>' +
        table(['ID', 'Tiêu đề', 'Icon', 'URL', 'TT'], list.map(m => [m.menuId, m.title, m.icon, m.url || '', m.status])) +
        '<h3 style="margin-top:20px">Thêm / sửa menu</h3><form class="form" id="menuForm">' +
        field('menuId (để trống = tự tạo)', 'menuId') +
        field('Tiêu đề', 'title') +
        field('Icon (house, newspaper, building, folder, grid, link…)', 'icon', 'link') +
        field('URL (để trống nếu là nhóm)', 'url') +
        field('Thứ tự', 'sortOrder', '10', 'number') +
        field('Vị trí', 'location', loc, 'select-loc') +
        field('Trạng thái', 'status', 'ON', 'select-status') +
        '<label class="span2"><button class="btn btn-primary" type="submit">Lưu menu</button></label></form></div>';
      $('#menuForm').onsubmit = async e => {
        e.preventDefault();
        const d = Object.fromEntries(new FormData(e.target));
        d.menuType = d.url ? 'LINK' : 'GROUP';
        d.openMode = d.openMode || (String(d.url || '').indexOf('http') === 0 ? 'NEW' : 'SAME');
        try {
          await api('saveMenu', d);
          const boot = await api('bootstrap');
          apply(boot, true);
          paintSide();
          toast('Đã lưu menu');
          renderMenusEditor(loc);
        } catch (err) { toast(err.message); }
      };
    } catch (e) {
      $('#workMain').innerHTML = '<div class="panel"><p class="err">' + esc(e.message) + '</p></div>';
    }
  }

  async function renderAppsEditor() {
    if (!state.isAdmin) return toast('Chỉ quản trị');
    $('#crumb').textContent = 'Ứng dụng / icon';
    $('#workMain').innerHTML =
      '<div class="panel"><h3>Thêm ứng dụng (hiện trang chủ)</h3>' +
      '<p class="dim">Icon hiển thị bằng chữ cái màu — không cần link ảnh ngoài.</p>' +
      '<form class="form" id="appForm">' +
      field('Tên ứng dụng', 'title') + field('URL', 'url') +
      field('Nhóm', 'category', 'Chung') + field('Thứ tự', 'sortOrder', '10', 'number') +
      '<label class="span2"><button class="btn btn-primary" type="submit">Lưu ứng dụng</button></label></form></div>';
    $('#appForm').onsubmit = async e => {
      e.preventDefault();
      try {
        await api('saveApp', Object.fromEntries(new FormData(e.target)));
        const boot = await api('bootstrap');
        apply(boot, true);
        toast('Đã lưu ứng dụng');
        e.target.reset();
      } catch (err) { toast(err.message); }
    };
  }

  async function renderConfig() {
    if (!state.isAdmin) return toast('Chỉ quản trị');
    $('#crumb').textContent = 'Cấu hình cổng';
    const c = state.config || {};
    $('#workMain').innerHTML =
      '<div class="panel"><h3>Cấu hình</h3><form class="form" id="cfgForm">' +
      field('Tên trường', 'schoolName', c.schoolName) +
      field('Địa chỉ', 'address', c.address) +
      field('Điện thoại', 'phone', c.phone) +
      field('Email', 'email', c.email) +
      field('Tiêu đề chào', 'welcomeTitle', c.welcomeTitle) +
      field('Mô tả chào', 'welcomeText', c.welcomeText, 'textarea') +
      '<label class="span2"><button class="btn btn-primary" type="submit">Lưu cấu hình</button></label></form></div>';
    $('#cfgForm').onsubmit = async e => {
      e.preventDefault();
      const config = Object.fromEntries(new FormData(e.target));
      try {
        await api('saveConfig', { config });
        state.config = Object.assign({}, state.config, config);
        paintSide();
        toast('Đã lưu cấu hình');
      } catch (err) { toast(err.message); }
    };
  }

  async function renderPostsManage() {
    if (!state.isAdmin) return toast('Chỉ quản trị');
    $('#crumb').textContent = 'Quản lý bài viết';
    $('#workMain').innerHTML =
      '<div class="panel"><p class="dim">Dùng mục <b>Đăng bài viết</b> để tạo bài mới. Đặt trạng thái <b>PUBLISHED</b> để hiện công khai.</p>' +
      '<button type="button" class="btn btn-primary" id="goPost">Soạn bài mới</button></div>';
    $('#goPost').onclick = () => navSide('POST_NEW');
  }

  /* ---------- Auth ---------- */
  function openLogin() {
    $('#overlay').classList.remove('hidden');
    $('#loginErr').textContent = '';
    setTimeout(() => { const u = $('#username'); if (u) u.focus(); }, 30);
  }
  function closeLogin() { $('#overlay').classList.add('hidden'); }

  async function onLogin(e) {
    e.preventDefault();
    $('#loginErr').textContent = '';
    const btn = $('#loginBtn');
    btn.disabled = true; btn.textContent = 'Đang đăng nhập…';
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
      apply(boot, true);
      showWork();
      toast('Đăng nhập thành công');
    } catch (err) {
      $('#loginErr').textContent = err.message;
    } finally {
      btn.disabled = false; btn.textContent = 'Đăng nhập';
    }
  }

  async function onLogout() {
    try { await api('logout'); } catch (_) {}
    sessionStorage.removeItem('school_token');
    state.token = ''; state.user = null; state.isAdmin = false;
    showPublic();
    toast('Đã đăng xuất');
  }

  /* ---------- Boot ---------- */
  async function boot() {
    $('#overlay').classList.add('hidden');
    let ok = false;
    if (state.token) {
      try {
        const d = await api('bootstrap');
        apply(d, true);
        ok = true;
        showWork();
        return;
      } catch (_) {
        sessionStorage.removeItem('school_token');
        state.token = ''; state.user = null;
      }
    }
    try {
      const d = await api('publicBootstrap', {});
      apply(d, false);
    } catch (e) {
      state.config = {
        schoolName: 'Cổng thông tin trường học',
        welcomeTitle: 'Cổng thông tin trường học',
        welcomeText: 'Không gian thông tin dành cho cộng đồng nhà trường.',
        address: '', phone: '', email: ''
      };
      console.warn(e.message);
    }
    showPublic();
  }

  // Events
  $('#loginForm').addEventListener('submit', onLogin);
  $('#btnLogin').onclick = openLogin;
  $('#btnCloseLogin').onclick = closeLogin;
  $('#overlayBg').onclick = closeLogin;
  $('#btnLogout').onclick = onLogout;
  $('#btnBackPublic').onclick = () => showPublic();
  $('#pubHome').onclick = e => { e.preventDefault(); renderPublicHome(); };
  $('#pubBurger').onclick = () => $('#homeMnav').classList.toggle('hidden');
  $('#sideToggle').onclick = () => $('#side').classList.toggle('open');
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLogin(); });

  boot();
})();
