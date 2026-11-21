/**
 * Cổng thông tin trường học — Frontend (public first + login modal)
 */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const state = {
  token: sessionStorage.getItem('school_token') || '',
  user: null,
  config: {},
  menus: [],
  apps: [],
  posts: [],
  isAdmin: false,
  publicReady: false
};

const ICONS = {
  house: '⌂', home: '⌂',
  newspaper: '📰', bell: '🔔',
  users: '👥', book: '📖',
  folder: '📁', chart: '📊',
  settings: '⚙', link: '🔗',
  grid: '▦', shield: '🛡',
  building: '🏫', school: '🏫',
  'file-text': '📄', file: '📄',
  mail: '✉', tools: '🛠', apps: '📱'
};

function iconFor(name) {
  const k = String(name || '').toLowerCase();
  return ICONS[name] || ICONS[k] || '•';
}

function appColor(seed) {
  const colors = ['#1e4a8c', '#0f766e', '#b45309', '#6d28d9', '#be123c', '#0369a1', '#15803d', '#c2410c'];
  let h = 0;
  const s = String(seed || 'A');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return colors[h % colors.length];
}

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2800);
}

function setLoading(on) {
  const el = $('#loading');
  if (!el) return;
  el.hidden = !on;
}

async function api(action, data = {}) {
  if (!window.APP_CONFIG?.API_URL || String(window.APP_CONFIG.API_URL).includes('YOUR-WORKER')) {
    throw new Error('Chưa cấu hình API_URL trong config.js.');
  }
  setLoading(true);
  try {
    const r = await fetch(window.APP_CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, data: { ...data, token: state.token } })
    });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || 'Lỗi API');
    return j.data;
  } finally {
    setLoading(false);
  }
}

async function loadPublic() {
  try {
    const d = await api('publicBootstrap', {});
    applyBootstrap(d, false);
  } catch (e) {
    if (state.token) {
      try {
        const d = await api('bootstrap', {});
        applyBootstrap(d, true);
        renderPublicShell();
        renderHome();
        return;
      } catch (_) {}
    }
    applyBootstrap({
      config: {
        schoolName: 'Cổng thông tin trường học',
        welcomeTitle: 'Cổng thông tin trường học',
        welcomeText: 'Không gian thông tin và tiện ích làm việc dành cho cán bộ, giáo viên, nhân viên.',
        address: '', phone: '', email: ''
      },
      menus: [], apps: [], posts: [], user: null, isAdmin: false
    }, false);
    console.warn('publicBootstrap chưa sẵn sàng:', e.message);
  }
  renderPublicShell();
  renderHome();
}

function applyBootstrap(d, loggedIn) {
  state.config = d.config || {};
  state.menus = (d.menus || []).filter(m => m.status !== 'OFF');
  state.apps = (d.apps || []).filter(a => a.status !== 'OFF');
  state.posts = d.posts || [];
  state.isAdmin = !!d.isAdmin;
  if (loggedIn && d.user) state.user = d.user;
  state.publicReady = true;
}

async function loadPrivate() {
  const d = await api('bootstrap', {});
  state.user = d.user;
  state.isAdmin = !!d.isAdmin;
  state.config = d.config || state.config;
  state.menus = d.menus || state.menus;
  state.apps = d.apps || state.apps;
  state.posts = d.posts || state.posts;
  renderPublicShell();
  renderHome();
}

function renderPublicShell() {
  const cfg = state.config || {};
  const name = cfg.schoolName || 'Cổng thông tin trường học';
  document.title = name;
  $('#headerSchoolName').textContent = name;
  $('#footerSchool').textContent = name;
  $('#footerAddress').textContent = cfg.address || 'Địa chỉ đơn vị';
  const contact = [cfg.phone && ('ĐT: ' + cfg.phone), cfg.email].filter(Boolean).join(' · ');
  $('#footerContact').textContent = contact || '—';

  const items = [
    { menuId: 'HOME', title: 'Trang chủ', icon: 'house', sortOrder: 0 },
    ...state.menus.filter(m => {
      if (m.menuId === 'M_HOME' || m.menuId === 'HOME') return false;
      // Chỉ lấy menu thanh trên; bỏ các mục gắn location HOME (thường là shortcut lẫn app)
      const loc = String(m.location || 'SIDEBAR').toUpperCase();
      if (loc === 'HOME') return false;
      return true;
    })
  ].sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));

  const navHtml = items.map(m =>
    '<button type="button" class="nav-link" data-menu="' + escAttr(m.menuId) + '">' +
    '<span class="nav-ico">' + iconFor(m.icon) + '</span>' + esc(m.title) +
    '</button>'
  ).join('');

  $('#headerNav').innerHTML = navHtml;
  $('#mobileNav').innerHTML = navHtml + (state.isAdmin
    ? '<button type="button" class="nav-link" data-menu="ADMIN"><span class="nav-ico">⚙</span>Quản trị</button>'
    : '');

  $$('#headerNav [data-menu], #mobileNav [data-menu]').forEach(btn => {
    btn.onclick = () => { closeDrawer(); navigate(btn.dataset.menu); };
  });

  if (state.user) {
    $('#btnOpenLogin').classList.add('hidden');
    $('#userChip').classList.remove('hidden');
    $('#chipName').textContent = state.user.fullName || state.user.username;
    $('#chipAvatar').textContent = (state.user.fullName || 'U').trim().charAt(0).toUpperCase();
  } else {
    $('#btnOpenLogin').classList.remove('hidden');
    $('#userChip').classList.add('hidden');
  }
}

function navigate(id) {
  if (id === 'HOME' || id === 'M_HOME') { renderHome(); return; }
  if (id === 'ADMIN') {
    if (!state.user || !state.isAdmin) { openLogin(); toast('Vui lòng đăng nhập tài khoản quản trị.'); return; }
    renderAdmin();
    return;
  }
  const m = state.menus.find(x => x.menuId === id);
  if (!m) return;
  if (m.menuType === 'LINK' && m.url && m.url !== '#' && m.url !== '/') {
    if (m.openMode === 'SAME') {
      renderPage(m.title,
        '<div class="panel prose"><h1>' + esc(m.title) + '</h1>' +
        '<p class="muted">Nội dung trang đang được cập nhật.</p>' +
        (m.url.startsWith('http') ? '<p><a class="btn primary" href="' + escAttr(m.url) + '" target="_blank" rel="noopener">Mở liên kết</a></p>' : '') +
        '</div>');
    } else {
      window.open(m.url, '_blank', 'noopener');
    }
    return;
  }
  renderPage(m.title, '<div class="panel prose"><h1>' + esc(m.title) + '</h1><p class="muted">Nội dung sẽ được bổ sung theo nghiệp vụ nhà trường.</p></div>');
}

function renderPage(title, html) {
  $('#pageContent').innerHTML = html;
  document.title = title + ' · ' + (state.config.schoolName || 'Cổng thông tin');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderHome() {
  const cfg = state.config || {};
  const apps = [];
  const seen = new Set();
  (state.apps || []).forEach(a => {
    const k = (String(a.title||'') + '|' + String(a.url||'')).toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    apps.push(a);
  });
  const posts = state.posts;

  const appCards = apps.length
    ? apps.map(a => {
        const letter = (a.title || 'A').trim().charAt(0).toUpperCase();
        const color = appColor(a.title || a.category || '');
        return '<a class="app-card" href="' + escAttr(a.url) + '" target="' + (a.openMode === 'SAME' ? '_self' : '_blank') + '" rel="noopener">' +
          '<span class="app-icon-badge" style="background:' + color + '">' + esc(letter) + '</span>' +
          '<span class="app-meta"><b>' + esc(a.title) + '</b><small>' + esc(a.category || 'Ứng dụng') + '</small></span></a>';
      }).join('')
    : '<div class="empty">Chưa có ứng dụng công khai.</div>';

  const postCards = posts.length
    ? posts.map(p =>
        '<article class="post-card" data-post="' + escAttr(p.postId) + '"><div class="post-body">' +
        '<span class="tag">' + esc(p.category || 'Thông báo') + '</span>' +
        '<h3>' + esc(p.title) + '</h3><p>' + esc(p.summary || '') + '</p></div></article>'
      ).join('')
    : '<div class="empty">Chưa có bài viết được đăng.</div>';

  renderPage(cfg.welcomeTitle || 'Trang chủ',
    '<section class="hero">' +
    '<div class="hero-badge">Cổng thông tin nội bộ</div>' +
    '<h1>' + esc(cfg.welcomeTitle || cfg.schoolName || 'Cổng thông tin trường học') + '</h1>' +
    '<p>' + esc(cfg.welcomeText || 'Không gian thông tin và tiện ích làm việc dành cho cán bộ, giáo viên, nhân viên.') + '</p>' +
    '<div class="hero-actions">' +
    (state.user ? '' : '<button type="button" class="btn primary" id="heroLogin">Đăng nhập làm việc</button>') +
    '<a class="btn ghost" href="#apps-section">Xem tiện ích</a></div></section>' +
    '<section class="section" id="apps-section"><div class="section-head"><div>' +
    '<h2>Ứng dụng thường dùng</h2><p class="muted">Truy cập nhanh các nền tảng làm việc</p></div></div>' +
    '<div class="grid apps-grid">' + appCards + '</div></section>' +
    '<section class="section"><div class="section-head"><div>' +
    '<h2>Tin tức &amp; thông báo</h2><p class="muted">Cập nhật mới từ nhà trường</p></div></div>' +
    '<div class="post-grid">' + postCards + '</div></section>'
  );

  const heroLogin = $('#heroLogin');
  if (heroLogin) heroLogin.onclick = openLogin;
  $$('[data-post]').forEach(el => { el.onclick = () => openPost(el.dataset.post); });
}

async function openPost(postId) {
  try {
    let p = state.posts.find(x => x.postId === postId);
    if (!p && state.token) p = await api('getPost', { postId });
    if (!p) { toast('Không tìm thấy bài viết.'); return; }
    renderPage(p.title,
      '<article class="article panel"><span class="tag">' + esc(p.category || 'Thông báo') + '</span>' +
      '<h1>' + esc(p.title) + '</h1><p class="muted">' + esc(p.summary || '') + '</p>' +
      '<div class="article-content">' + (p.contentHtml || '<p class="muted">Nội dung đang cập nhật.</p>') + '</div>' +
      '<p style="margin-top:24px"><button type="button" class="btn ghost" id="backHome">← Về trang chủ</button></p></article>');
    $('#backHome').onclick = renderHome;
  } catch (e) { toast(e.message); }
}

function renderAdmin() {
  if (!state.isAdmin) { openLogin(); return; }
  renderPage('Quản trị hệ thống',
    '<div class="section-head"><div><h2>Quản trị hệ thống</h2><p class="muted">Cấu hình, người dùng, menu, ứng dụng, bài viết</p></div></div>' +
    '<div class="grid admin-grid">' +
    adminCard('Cấu hình cổng', 'Tên trường, địa chỉ, màu chủ đạo', 'config') +
    adminCard('Người dùng', 'Tài khoản & nhóm quyền', 'users') +
    adminCard('Menu', 'Thanh điều hướng công khai', 'menus') +
    adminCard('Ứng dụng', 'Lối tắt tiện ích', 'apps') +
    adminCard('Bài viết', 'Tin tức & thông báo', 'posts') +
    '</div><div id="adminPanel" class="admin-panel"></div>');
  $$('[data-admin]').forEach(b => { b.onclick = () => openAdminPanel(b.dataset.admin); });
}

function adminCard(title, desc, key) {
  return '<button type="button" class="app-card" data-admin="' + key + '">' +
    '<span class="app-icon-badge" style="background:#1e4a8c">⚙</span>' +
    '<span class="app-meta"><b>' + esc(title) + '</b><small>' + esc(desc) + '</small></span></button>';
}

async function openAdminPanel(key) {
  const panel = $('#adminPanel');
  if (!panel) return;
  panel.innerHTML = '<div class="panel"><p class="muted">Đang tải…</p></div>';

  const field = (label, name, value, type) => {
    value = value || '';
    type = type || 'text';
    if (type === 'textarea') {
      return '<label class="field full-row">' + label + '<textarea name="' + name + '">' + esc(value) + '</textarea></label>';
    }
    return '<label class="field">' + label + '<input name="' + name + '" type="' + type + '" value="' + escAttr(value) + '"></label>';
  };

  try {
    if (key === 'config') {
      const c = state.config || {};
      panel.innerHTML = '<div class="panel"><h3>Cấu hình</h3><form id="cfgForm" class="form-grid">' +
        field('Tên trường', 'schoolName', c.schoolName) +
        field('Địa chỉ', 'address', c.address) +
        field('Điện thoại', 'phone', c.phone) +
        field('Email', 'email', c.email) +
        field('Tiêu đề chào', 'welcomeTitle', c.welcomeTitle) +
        field('Mô tả chào', 'welcomeText', c.welcomeText, 'textarea') +
        field('Màu chủ đạo', 'primaryColor', c.primaryColor || '#1e4a8c') +
        '<div class="field full-row"><button class="btn primary" type="submit">Lưu cấu hình</button></div></form></div>';
      $('#cfgForm').onsubmit = async e => {
        e.preventDefault();
        const config = Object.fromEntries(new FormData(e.target));
        await api('saveConfig', { config });
        state.config = Object.assign({}, state.config, config);
        toast('Đã lưu cấu hình');
        renderPublicShell();
      };
    }
    if (key === 'users') {
      const users = await api('listUsers');
      panel.innerHTML = '<div class="panel"><h3>Người dùng</h3>' +
        table(['Tài khoản', 'Họ tên', 'Nhóm', 'Trạng thái'], users.map(u => [u.username, u.fullName, u.groupCode, u.status])) +
        '<h4 style="margin-top:20px">Thêm / cập nhật</h4><form id="userForm" class="form-grid">' +
        field('Username', 'username') + field('Họ tên', 'fullName') +
        field('Mật khẩu (để trống nếu không đổi)', 'password', '', 'password') +
        field('Nhóm (ADMIN/BGH/GV/VP)', 'groupCode', 'GV') +
        '<div class="field full-row"><button class="btn primary" type="submit">Lưu</button></div></form></div>';
      $('#userForm').onsubmit = async e => {
        e.preventDefault();
        await api('saveUser', Object.fromEntries(new FormData(e.target)));
        toast('Đã lưu người dùng');
        openAdminPanel('users');
      };
    }
    if (key === 'menus') {
      const menus = await api('listMenusAdmin');
      panel.innerHTML = '<div class="panel"><h3>Menu</h3>' +
        table(['ID', 'Tiêu đề', 'Icon', 'URL', 'TT'], menus.map(m => [m.menuId, m.title, m.icon, m.url, m.status])) +
        '<h4 style="margin-top:20px">Thêm / sửa menu</h4><form id="menuForm" class="form-grid">' +
        field('menuId (để trống = tự tạo)', 'menuId') + field('Tiêu đề', 'title') +
        field('Icon (house, newspaper, building, folder, grid…)', 'icon', 'link') +
        field('URL', 'url') + field('Thứ tự', 'sortOrder', '10', 'number') +
        '<div class="field full-row"><button class="btn primary" type="submit">Lưu menu</button></div></form></div>';
      $('#menuForm').onsubmit = async e => {
        e.preventDefault();
        await api('saveMenu', Object.fromEntries(new FormData(e.target)));
        toast('Đã lưu menu');
        const boot = await api('bootstrap');
        state.menus = boot.menus || state.menus;
        renderPublicShell();
        openAdminPanel('menus');
      };
    }
    if (key === 'apps') {
      panel.innerHTML = '<div class="panel"><h3>Thêm ứng dụng</h3><form id="appForm" class="form-grid">' +
        field('Tên ứng dụng', 'title') + field('URL', 'url') +
        field('Nhóm', 'category', 'Chung') + field('Thứ tự', 'sortOrder', '10', 'number') +
        '<div class="field full-row"><button class="btn primary" type="submit">Lưu ứng dụng</button></div></form>' +
        '<p class="muted">Icon hiển thị bằng chữ cái màu — không cần link ảnh ngoài.</p></div>';
      $('#appForm').onsubmit = async e => {
        e.preventDefault();
        await api('saveApp', Object.fromEntries(new FormData(e.target)));
        toast('Đã lưu ứng dụng');
        const boot = await api('bootstrap');
        state.apps = boot.apps || state.apps;
        openAdminPanel('apps');
      };
    }
    if (key === 'posts') {
      panel.innerHTML = '<div class="panel"><h3>Đăng bài viết</h3><form id="postForm" class="form-grid">' +
        field('Tiêu đề', 'title') + field('Danh mục', 'category', 'Thông báo') +
        field('Tóm tắt', 'summary') + field('Nội dung HTML', 'contentHtml', '', 'textarea') +
        '<div class="field"><label>Trạng thái</label><select name="status"><option value="DRAFT">Lưu nháp</option><option value="PUBLISHED">Đăng công khai</option></select></div>' +
        '<div class="field"><label><input type="checkbox" name="pinned" value="true"> Ghim bài</label></div>' +
        '<div class="field full-row"><button class="btn primary" type="submit">Lưu bài viết</button></div></form></div>';
      $('#postForm').onsubmit = async e => {
        e.preventDefault();
        const d = Object.fromEntries(new FormData(e.target));
        d.pinned = !!e.target.pinned.checked;
        await api('savePost', d);
        toast('Đã lưu bài viết');
        e.target.reset();
      };
    }
  } catch (err) {
    panel.innerHTML = '<div class="panel error">' + esc(err.message) + '</div>';
  }
}

function table(headers, rows) {
  return '<div class="table-wrap"><table><thead><tr>' + headers.map(h => '<th>' + h + '</th>').join('') +
    '</tr></thead><tbody>' + rows.map(r => '<tr>' + r.map(c => '<td>' + esc(c) + '</td>').join('') + '</tr>').join('') +
    '</tbody></table></div>';
}

function openLogin() {
  $('#loginModal').classList.remove('hidden');
  $('#loginError').textContent = '';
  setTimeout(() => { const u = $('#username'); if (u) u.focus(); }, 50);
}
function closeLogin() { $('#loginModal').classList.add('hidden'); }

async function onLogin(e) {
  e.preventDefault();
  $('#loginError').textContent = '';
  const btn = $('#loginSubmit');
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
    await loadPrivate();
    toast('Đăng nhập thành công');
  } catch (err) {
    $('#loginError').textContent = err.message;
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
  renderPublicShell();
  renderHome();
  toast('Đã đăng xuất');
}

function closeDrawer() {
  const d = $('#mobileDrawer');
  if (d) { d.classList.remove('is-open'); d.hidden = true; }
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escAttr(s) { return esc(s).replace(/`/g, '&#96;'); }

$('#loginForm').addEventListener('submit', onLogin);
$('#btnOpenLogin').onclick = openLogin;
$('#loginClose').onclick = closeLogin;
$('#loginBackdrop').onclick = closeLogin;
$('#btnLogout').onclick = onLogout;
$('#menuToggle').onclick = () => {
  const d = $('#mobileDrawer');
  d.classList.toggle('is-open');
  d.hidden = !d.classList.contains('is-open');
};
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLogin(); });

(async function init() {
  if (state.token) {
    try { await loadPrivate(); return; }
    catch (_) { sessionStorage.removeItem('school_token'); state.token = ''; }
  }
  await loadPublic();
})();
