/**
 * Cổng thông tin — Home (public) + Sidebar workspace (logged-in)
 * Menu location: HOME = trang công khai | SIDEBAR = sau đăng nhập
 */
(function () {
  'use strict';

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function el(id) { return document.getElementById(id); }
  function setHtml(sel, html) { var n = $(sel); if (n) n.innerHTML = html; }
  function setText(sel, text) { var n = $(sel); if (n) n.textContent = text; }
  function show(sel) { var n = $(sel); if (n) n.classList.remove('hidden'); }
  function hide(sel) { var n = $(sel); if (n) n.classList.add('hidden'); }
  function on(id, ev, fn) { var n = el(id); if (n) n.addEventListener(ev, fn); }

  var state = {
    token: sessionStorage.getItem('school_token') || '',
    user: null,
    config: {},
    menus: [],
    apps: [],
    posts: [],
    isAdmin: false,
    mode: 'public'
  };

  var ICONS = {
    house: '⌂', home: '⌂', newspaper: '📰', bell: '🔔', users: '👥', book: '📖',
    folder: '📁', chart: '📊', settings: '⚙', link: '🔗', grid: '▦', shield: '🛡',
    building: '🏫', school: '🏫', 'file-text': '📄', file: '📄', pen: '✎', user: '👤'
  };

  function icon(n) {
    return ICONS[n] || ICONS[String(n || '').toLowerCase()] || '•';
  }
  function color(seed) {
    var c = ['#1e4a8c', '#0f766e', '#b45309', '#6d28d9', '#be123c', '#0369a1', '#15803d', '#c2410c'];
    var h = 0, s = String(seed || 'A'), i;
    for (i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return c[h % c.length];
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }
  function toast(msg) {
    var n = el('toast');
    if (!n) { console.log(msg); return; }
    n.textContent = msg;
    n.classList.add('show');
    setTimeout(function () { n.classList.remove('show'); }, 2600);
  }

  function api(action, data) {
    var url = window.APP_CONFIG && window.APP_CONFIG.API_URL;
    if (!url || String(url).indexOf('YOUR-WORKER') >= 0) {
      return Promise.reject(new Error('Chưa cấu hình API_URL'));
    }
    var body = { action: action, data: Object.assign({}, data || {}, { token: state.token }) };
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    }).then(function (res) { return res.json(); }).then(function (j) {
      if (!j.ok) throw new Error(j.error || 'Lỗi API');
      return j.data;
    });
  }

  function apply(d, withUser) {
    state.config = d.config || {};
    state.menus = (d.menus || []).filter(function (m) { return String(m.status) !== 'OFF'; });
    state.apps = dedupe(d.apps || []);
    state.posts = d.posts || [];
    state.isAdmin = !!d.isAdmin;
    if (withUser) state.user = d.user || null;
  }

  function dedupe(list) {
    var seen = {}, out = [];
    list.forEach(function (a) {
      if (String(a.status) === 'OFF') return;
      var k = (String(a.title || '') + '|' + String(a.url || '')).toLowerCase();
      if (seen[k]) return;
      seen[k] = 1;
      out.push(a);
    });
    return out;
  }

  function homeMenus() {
    return state.menus
      .filter(function (m) { return String(m.location || '').toUpperCase() === 'HOME'; })
      .sort(function (a, b) { return Number(a.sortOrder || 0) - Number(b.sortOrder || 0); });
  }

  function sideMenus() {
    return state.menus
      .filter(function (m) {
        var loc = String(m.location || 'SIDEBAR').toUpperCase();
        return loc === 'SIDEBAR' || loc === '';
      })
      .sort(function (a, b) { return Number(a.sortOrder || 0) - Number(b.sortOrder || 0); });
  }

  /* ===== PUBLIC ===== */
  function showPublic() {
    state.mode = 'public';
    show('#publicApp');
    hide('#workApp');
    paintPublicShell();
    renderPublicHome();
  }

  function paintPublicShell() {
    var cfg = state.config || {};
    var name = cfg.schoolName || 'Cổng thông tin trường học';
    document.title = name;
    setText('#pubSchool', name);
    setText('#fName', name);
    setText('#fAddr', cfg.address || 'Địa chỉ đơn vị');
    setText('#fContact', [cfg.phone && ('ĐT: ' + cfg.phone), cfg.email].filter(Boolean).join(' · ') || '—');

    var items = [{ id: 'HOME', title: 'Trang chủ', icon: 'house' }].concat(
      homeMenus().map(function (m) {
        return { id: m.menuId, title: m.title, icon: m.icon };
      })
    );
    var html = items.map(function (it) {
      return '<button type="button" data-home="' + esc(it.id) + '"><span>' + icon(it.icon) + '</span> ' + esc(it.title) + '</button>';
    }).join('');
    setHtml('#homeNav', html);
    setHtml('#homeMnav', html);
    $$('#homeNav [data-home], #homeMnav [data-home]').forEach(function (b) {
      b.onclick = function () {
        closePubMobile();
        navHome(b.getAttribute('data-home'));
      };
    });
  }

  function navHome(id) {
    if (id === 'HOME') return renderPublicHome();
    var m = state.menus.find(function (x) { return x.menuId === id; });
    if (!m) return;
    if (m.url && /^https?:/i.test(m.url)) {
      window.open(m.url, m.openMode === 'SAME' ? '_self' : '_blank', 'noopener');
      return;
    }
    setHtml('#publicMain',
      '<div class="panel"><h1>' + esc(m.title) + '</h1>' +
      '<p class="dim">Nội dung trang công khai đang được cập nhật.</p></div>');
  }

  function renderPublicHome() {
    var cfg = state.config || {};
    var apps = state.apps;
    var posts = state.posts;

    var appHtml = apps.length
      ? apps.map(function (a) {
          var letter = (a.title || 'A').charAt(0).toUpperCase();
          return '<a class="card" href="' + esc(a.url) + '" target="_blank" rel="noopener">' +
            '<span class="badge-ico" style="background:' + color(a.title) + '">' + esc(letter) + '</span>' +
            '<span><b>' + esc(a.title) + '</b><small>' + esc(a.category || 'Ứng dụng') + '</small></span></a>';
        }).join('')
      : '<div class="empty">Chưa có ứng dụng công khai.</div>';

    var postHtml = posts.length
      ? '<div class="grid">' + posts.map(function (p) {
          return '<article class="post" data-post="' + esc(p.postId) + '">' +
            '<span class="tag">' + esc(p.category || 'Thông báo') + '</span>' +
            '<h3>' + esc(p.title) + '</h3><p>' + esc(p.summary || '') + '</p></article>';
        }).join('') + '</div>'
      : '<div class="empty">Chưa có bài viết được đăng.</div>';

    setHtml('#publicMain',
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
      postHtml + '</section>');

    var hl = el('heroLogin');
    if (hl) hl.onclick = openLogin;
    $$('[data-post]').forEach(function (node) {
      node.onclick = function () { openPublicPost(node.getAttribute('data-post')); };
    });
  }

  function openPublicPost(id) {
    var p = state.posts.find(function (x) { return x.postId === id; });
    var done = function (post) {
      if (!post) return toast('Không tìm thấy bài viết');
      setHtml('#publicMain',
        '<article class="panel article"><span class="tag">' + esc(post.category || 'Thông báo') + '</span>' +
        '<h1>' + esc(post.title) + '</h1><p class="dim">' + esc(post.summary || '') + '</p>' +
        '<div class="article-body">' + (post.contentHtml || '<p class="dim">Đang cập nhật.</p>') + '</div>' +
        '<p style="margin-top:18px"><button type="button" class="btn btn-outline" id="backPub">← Trang chủ</button></p></article>');
      var b = el('backPub');
      if (b) b.onclick = renderPublicHome;
    };
    if (p) return done(p);
    if (!state.token) return toast('Không tìm thấy bài viết');
    api('getPost', { postId: id }).then(done).catch(function (e) { toast(e.message); });
  }

  function closePubMobile() { hide('#homeMnav'); }

  /* ===== WORKSPACE ===== */
  function showWork() {
    state.mode = 'work';
    hide('#publicApp');
    show('#workApp');
    paintSide();
    renderDashboard();
  }

  function paintSide() {
    var cfg = state.config || {};
    setText('#sideSchool', cfg.schoolName || 'Khu vực làm việc');
    setText('#sideRole', (state.user && (state.user.groupCode || state.user.fullName)) || 'USER');
    setText('#whoName', (state.user && (state.user.fullName || state.user.username)) || '');
    setText('#ava', ((state.user && state.user.fullName) || 'U').charAt(0).toUpperCase());

    var html = '<div class="grp">Làm việc</div>';
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
    var sm = sideMenus();
    if (sm.length) {
      html += '<div class="grp">Menu đơn vị</div>';
      sm.forEach(function (m) {
        html += sideBtn('M:' + m.menuId, icon(m.icon), m.title);
      });
    }
    setHtml('#sideNav', html);
    $$('#sideNav [data-side]').forEach(function (b) {
      b.onclick = function () {
        $$('#sideNav [data-side]').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        var side = el('side');
        if (side) side.classList.remove('open');
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
      var mid = id.slice(2);
      var m = state.menus.find(function (x) { return x.menuId === mid; });
      if (!m) return;
      if (m.url && /^https?:/i.test(m.url)) {
        window.open(m.url, '_blank', 'noopener');
        return;
      }
      setText('#crumb', m.title);
      setHtml('#workMain', '<div class="panel"><h2>' + esc(m.title) + '</h2><p class="dim">Nội dung nội bộ.</p></div>');
    }
  }

  function renderDashboard() {
    setText('#crumb', 'Tổng quan');
    var name = (state.user && state.user.fullName) || 'bạn';
    var cards = cardBtn('POST_NEW', '✎', 'Đăng bài', 'Soạn tin / thông báo');
    if (state.isAdmin) {
      cards += cardBtn('USERS', '👤', 'Tài khoản', 'Thêm / sửa người dùng');
      cards += cardBtn('MENUS_HOME', '📰', 'Menu Home', 'Menu trang công khai');
      cards += cardBtn('APPS', '🔗', 'Ứng dụng', 'Icon & liên kết');
    }
    setHtml('#workMain',
      '<div class="panel"><h2>Xin chào, ' + esc(name) + '</h2>' +
      '<p class="dim">Khu vực làm việc sau đăng nhập. Dùng menu bên trái để đăng bài và quản trị.</p>' +
      '<div class="grid" style="margin-top:16px">' + cards + '</div></div>');
    $$('#workMain [data-go]').forEach(function (b) {
      b.onclick = function () { navSide(b.getAttribute('data-go')); };
    });
  }

  function cardBtn(id, ico, title, desc) {
    return '<button type="button" class="card" data-go="' + id + '">' +
      '<span class="badge-ico" style="background:#1e4a8c">' + ico + '</span>' +
      '<span><b>' + title + '</b><small>' + desc + '</small></span></button>';
  }

  function field(label, name, val, type) {
    val = val || '';
    type = type || 'text';
    if (type === 'textarea') {
      return '<label class="span2">' + label + '<textarea name="' + name + '">' + esc(val) + '</textarea></label>';
    }
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
      headers.map(function (h) { return '<th>' + h + '</th>'; }).join('') +
      '</tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr>' + r.map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>';
  }

  function renderPostForm() {
    setText('#crumb', 'Đăng bài viết');
    setHtml('#workMain',
      '<div class="panel"><h3>Đăng bài / thông báo</h3><form class="form" id="postForm">' +
      field('Tiêu đề', 'title') + field('Danh mục', 'category', 'Thông báo') +
      field('Tóm tắt', 'summary') + field('Nội dung HTML', 'contentHtml', '', 'textarea') +
      '<label>Trạng thái<select name="status"><option value="DRAFT">Nháp</option><option value="PUBLISHED">Công khai</option></select></label>' +
      '<label><span style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="pinned" value="true"> Ghim bài</span></label>' +
      '<label class="span2"><button class="btn btn-primary" type="submit">Lưu bài viết</button></label></form>' +
      '<p class="dim">Chọn <b>Công khai</b> để hiện trên trang chủ (không cần đăng nhập).</p></div>');
    var form = el('postForm');
    if (form) form.onsubmit = function (e) {
      e.preventDefault();
      var d = Object.fromEntries(new FormData(e.target));
      d.pinned = !!(e.target.pinned && e.target.pinned.checked);
      api('savePost', d).then(function () {
        toast('Đã lưu bài viết');
        e.target.reset();
      }).catch(function (err) { toast(err.message); });
    };
  }

  function renderUsers() {
    if (!state.isAdmin) return toast('Chỉ quản trị');
    setText('#crumb', 'Tài khoản');
    setHtml('#workMain', '<div class="panel"><p class="dim">Đang tải…</p></div>');
    api('listUsers').then(function (users) {
      setHtml('#workMain',
        '<div class="panel"><h3>Danh sách tài khoản</h3>' +
        table(['Tài khoản', 'Họ tên', 'Nhóm', 'TT'], users.map(function (u) {
          return [u.username, u.fullName, u.groupCode, u.status];
        })) +
        '<h3 style="margin-top:20px">Thêm / cập nhật tài khoản</h3><form class="form" id="userForm">' +
        field('Username', 'username') + field('Họ tên', 'fullName') +
        field('Mật khẩu (bắt buộc khi tạo mới)', 'password', '', 'password') +
        field('Nhóm (ADMIN / BGH / GV / VP)', 'groupCode', 'GV') +
        field('Trạng thái', 'status', 'ON', 'select-status') +
        '<label class="span2"><button class="btn btn-primary" type="submit">Lưu tài khoản</button></label></form></div>');
      var form = el('userForm');
      if (form) form.onsubmit = function (e) {
        e.preventDefault();
        api('saveUser', Object.fromEntries(new FormData(e.target)))
          .then(function () { toast('Đã lưu tài khoản'); renderUsers(); })
          .catch(function (err) { toast(err.message); });
      };
    }).catch(function (e) {
      setHtml('#workMain', '<div class="panel"><p class="err">' + esc(e.message) + '</p></div>');
    });
  }

  function renderMenusEditor(loc) {
    if (!state.isAdmin) return toast('Chỉ quản trị');
    var title = loc === 'HOME' ? 'Menu trang chủ (công khai)' : 'Menu sidebar (sau đăng nhập)';
    setText('#crumb', title);
    setHtml('#workMain', '<div class="panel"><p class="dim">Đang tải…</p></div>');
    api('listMenusAdmin').then(function (all) {
      var list = all.filter(function (m) {
        return String(m.location || 'SIDEBAR').toUpperCase() === loc;
      });
      setHtml('#workMain',
        '<div class="panel"><h3>' + esc(title) + '</h3>' +
        '<p class="dim">location = <b>' + loc + '</b>. HOME = công khai. SIDEBAR = sau đăng nhập.</p>' +
        table(['ID', 'Tiêu đề', 'Icon', 'URL', 'TT'], list.map(function (m) {
          return [m.menuId, m.title, m.icon, m.url || '', m.status];
        })) +
        '<h3 style="margin-top:20px">Thêm / sửa menu</h3><form class="form" id="menuForm">' +
        field('menuId (để trống = tự tạo)', 'menuId') +
        field('Tiêu đề', 'title') +
        field('Icon (house, newspaper, building, folder, grid, link…)', 'icon', 'link') +
        field('URL (để trống nếu là nhóm)', 'url') +
        field('Thứ tự', 'sortOrder', '10', 'number') +
        field('Vị trí', 'location', loc, 'select-loc') +
        field('Trạng thái', 'status', 'ON', 'select-status') +
        '<label class="span2"><button class="btn btn-primary" type="submit">Lưu menu</button></label></form></div>');
      var form = el('menuForm');
      if (form) form.onsubmit = function (e) {
        e.preventDefault();
        var d = Object.fromEntries(new FormData(e.target));
        d.menuType = d.url ? 'LINK' : 'GROUP';
        d.openMode = (String(d.url || '').indexOf('http') === 0) ? 'NEW' : 'SAME';
        api('saveMenu', d).then(function () {
          return api('bootstrap');
        }).then(function (boot) {
          apply(boot, true);
          paintSide();
          toast('Đã lưu menu');
          renderMenusEditor(loc);
        }).catch(function (err) { toast(err.message); });
      };
    }).catch(function (e) {
      setHtml('#workMain', '<div class="panel"><p class="err">' + esc(e.message) + '</p></div>');
    });
  }

  function renderAppsEditor() {
    if (!state.isAdmin) return toast('Chỉ quản trị');
    setText('#crumb', 'Ứng dụng / icon');
    setHtml('#workMain',
      '<div class="panel"><h3>Thêm ứng dụng (hiện trang chủ)</h3>' +
      '<p class="dim">Icon hiển thị bằng chữ cái màu — không cần link ảnh ngoài.</p>' +
      '<form class="form" id="appForm">' +
      field('Tên ứng dụng', 'title') + field('URL', 'url') +
      field('Nhóm', 'category', 'Chung') + field('Thứ tự', 'sortOrder', '10', 'number') +
      '<label class="span2"><button class="btn btn-primary" type="submit">Lưu ứng dụng</button></label></form></div>');
    var form = el('appForm');
    if (form) form.onsubmit = function (e) {
      e.preventDefault();
      api('saveApp', Object.fromEntries(new FormData(e.target)))
        .then(function () { return api('bootstrap'); })
        .then(function (boot) {
          apply(boot, true);
          toast('Đã lưu ứng dụng');
          e.target.reset();
        })
        .catch(function (err) { toast(err.message); });
    };
  }

  function renderConfig() {
    if (!state.isAdmin) return toast('Chỉ quản trị');
    setText('#crumb', 'Cấu hình cổng');
    var c = state.config || {};
    setHtml('#workMain',
      '<div class="panel"><h3>Cấu hình</h3><form class="form" id="cfgForm">' +
      field('Tên trường', 'schoolName', c.schoolName) +
      field('Địa chỉ', 'address', c.address) +
      field('Điện thoại', 'phone', c.phone) +
      field('Email', 'email', c.email) +
      field('Tiêu đề chào', 'welcomeTitle', c.welcomeTitle) +
      field('Mô tả chào', 'welcomeText', c.welcomeText, 'textarea') +
      '<label class="span2"><button class="btn btn-primary" type="submit">Lưu cấu hình</button></label></form></div>');
    var form = el('cfgForm');
    if (form) form.onsubmit = function (e) {
      e.preventDefault();
      var config = Object.fromEntries(new FormData(e.target));
      api('saveConfig', { config: config }).then(function () {
        state.config = Object.assign({}, state.config, config);
        paintSide();
        toast('Đã lưu cấu hình');
      }).catch(function (err) { toast(err.message); });
    };
  }

  function renderPostsManage() {
    if (!state.isAdmin) return toast('Chỉ quản trị');
    setText('#crumb', 'Quản lý bài viết');
    setHtml('#workMain',
      '<div class="panel"><p class="dim">Dùng mục <b>Đăng bài viết</b> để tạo bài mới. Đặt trạng thái <b>PUBLISHED</b> để hiện công khai.</p>' +
      '<button type="button" class="btn btn-primary" id="goPost">Soạn bài mới</button></div>');
    var gp = el('goPost');
    if (gp) gp.onclick = function () { navSide('POST_NEW'); };
  }

  /* ===== Auth ===== */
  function openLogin() {
    show('#overlay');
    setText('#loginErr', '');
    setTimeout(function () {
      var u = el('username');
      if (u) u.focus();
    }, 30);
  }
  function closeLogin() { hide('#overlay'); }

  function onLogin(e) {
    e.preventDefault();
    setText('#loginErr', '');
    var btn = el('loginBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Đang đăng nhập…'; }
    api('login', {
      username: (el('username') && el('username').value || '').trim(),
      password: el('password') && el('password').value || ''
    }).then(function (d) {
      state.token = d.token;
      sessionStorage.setItem('school_token', d.token);
      state.user = d.user;
      closeLogin();
      return api('bootstrap');
    }).then(function (boot) {
      apply(boot, true);
      showWork();
      toast('Đăng nhập thành công');
    }).catch(function (err) {
      setText('#loginErr', err.message);
    }).then(function () {
      if (btn) { btn.disabled = false; btn.textContent = 'Đăng nhập'; }
    });
  }

  function onLogout() {
    api('logout').catch(function () {}).then(function () {
      sessionStorage.removeItem('school_token');
      state.token = '';
      state.user = null;
      state.isAdmin = false;
      showPublic();
      toast('Đã đăng xuất');
    });
  }

  function boot() {
    hide('#overlay');
    var startPublic = function () {
      api('publicBootstrap', {}).then(function (d) {
        apply(d, false);
        showPublic();
      }).catch(function (e) {
        console.warn(e.message);
        state.config = {
          schoolName: 'Cổng thông tin trường học',
          welcomeTitle: 'Cổng thông tin trường học',
          welcomeText: 'Không gian thông tin dành cho cộng đồng nhà trường.',
          address: '', phone: '', email: ''
        };
        showPublic();
      });
    };

    if (state.token) {
      api('bootstrap').then(function (d) {
        apply(d, true);
        showWork();
      }).catch(function () {
        sessionStorage.removeItem('school_token');
        state.token = '';
        state.user = null;
        startPublic();
      });
    } else {
      startPublic();
    }
  }

  /* Events */
  on('loginForm', 'submit', onLogin);
  // form uses submit via addEventListener on element - loginForm is id
  var lf = el('loginForm');
  if (lf) lf.addEventListener('submit', onLogin);

  on('btnLogin', 'click', openLogin);
  on('btnCloseLogin', 'click', closeLogin);
  on('overlayBg', 'click', closeLogin);
  on('btnLogout', 'click', onLogout);
  on('btnBackPublic', 'click', function () { showPublic(); });
  on('pubHome', 'click', function (e) {
    e.preventDefault();
    renderPublicHome();
  });
  on('pubBurger', 'click', function () {
    var m = el('homeMnav');
    if (m) m.classList.toggle('hidden');
  });
  on('sideToggle', 'click', function () {
    var s = el('side');
    if (s) s.classList.toggle('open');
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeLogin();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
