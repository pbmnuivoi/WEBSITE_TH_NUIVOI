/**
 * Cổng thông tin — Public home + Workspace CRUD
 * Ưu tiên: thêm / sửa / xóa dễ dùng; media ảnh & video cho tin tức
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
    user: null, config: {}, menus: [], apps: [], posts: [],
    isAdmin: false, mode: 'public', editingPost: null
  };

  var ICONS = {
    house: '⌂', home: '⌂', newspaper: '📰', bell: '🔔', users: '👥', book: '📖',
    folder: '📁', chart: '📊', settings: '⚙', link: '🔗', grid: '▦',
    building: '🏫', school: '🏫', 'file-text': '📄', file: '📄'
  };

  function icon(n) { return ICONS[n] || ICONS[String(n || '').toLowerCase()] || '•'; }
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
    if (!n) return console.log(msg);
    n.textContent = msg; n.classList.add('show');
    setTimeout(function () { n.classList.remove('show'); }, 2600);
  }

  function api(action, data) {
    var url = window.APP_CONFIG && window.APP_CONFIG.API_URL;
    if (!url || String(url).indexOf('YOUR-WORKER') >= 0) {
      return Promise.reject(new Error('Chưa cấu hình API_URL'));
    }
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: action, data: Object.assign({}, data || {}, { token: state.token }) })
    }).then(function (r) { return r.json(); }).then(function (j) {
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
    (list || []).forEach(function (a) {
      if (String(a.status) === 'OFF') return;
      var k = (String(a.title || '') + '|' + String(a.url || '')).toLowerCase();
      if (seen[k]) return;
      seen[k] = 1; out.push(a);
    });
    return out;
  }

  function homeMenus() {
    return state.menus
      .filter(function (m) {
        if (m.menuId === 'M_HOME' || m.menuId === 'HOME') return false;
        return String(m.location || '').toUpperCase() === 'HOME';
      })
      .sort(function (a, b) { return Number(a.sortOrder || 0) - Number(b.sortOrder || 0); });
  }

  /* —— Media helpers: ảnh + video trong nội dung —— */
  function youtubeId(url) {
    if (!url) return '';
    var m = String(url).match(/(?:youtu\.be\/|v=|\/embed\/|shorts\/)([A-Za-z0-9_-]{6,})/);
    return m ? m[1] : '';
  }
  function buildContentHtml(text, imageUrl, videoUrl) {
    var html = '';
    if (imageUrl) {
      html += '<p class="media-img"><img src="' + esc(imageUrl) + '" alt="" loading="lazy" style="max-width:100%;border-radius:12px"></p>';
    }
    var yid = youtubeId(videoUrl);
    if (yid) {
      html += '<div class="media-video"><iframe src="https://www.youtube.com/embed/' + yid +
        '" title="Video" frameborder="0" allowfullscreen loading="lazy" ' +
        'style="width:100%;aspect-ratio:16/9;border-radius:12px;border:0"></iframe></div>';
    } else if (videoUrl && /\.(mp4|webm)(\?|$)/i.test(videoUrl)) {
      html += '<p class="media-video"><video src="' + esc(videoUrl) + '" controls style="max-width:100%;border-radius:12px"></video></p>';
    }
    if (text) {
      // plain text → paragraphs
      html += String(text).split(/\n{2,}/).map(function (p) {
        return '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>';
      }).join('');
    }
    return html;
  }
  function postCardHtml(p) {
    var thumb = p.thumbnailUrl
      ? '<div class="post-thumb"><img src="' + esc(p.thumbnailUrl) + '" alt="" loading="lazy" onerror="this.parentNode.style.display=\'none\'"></div>'
      : '';
    return '<article class="post" data-post="' + esc(p.postId) + '">' + thumb +
      '<div class="post-body"><span class="tag">' + esc(p.category || 'Thông báo') + '</span>' +
      '<h3>' + esc(p.title) + '</h3><p>' + esc(p.summary || '') + '</p></div></article>';
  }

  /* ===== PUBLIC ===== */
  function showPublic() {
    state.mode = 'public';
    show('#publicApp'); hide('#workApp');
    paintPublicShell(); renderPublicHome();
  }

  function paintPublicShell() {
    var cfg = state.config || {};
    var name = cfg.schoolName || 'Cổng thông tin trường học';
    document.title = name;
    setText('#pubSchool', name);
    setText('#fName', name);
    setText('#fAddr', cfg.address || 'Địa chỉ đơn vị');
    setText('#fContact', [cfg.phone && ('ĐT: ' + cfg.phone), cfg.email].filter(Boolean).join(' · ') || '—');

    // Chỉ 1 lần Trang chủ + menu HOME (không trùng)
    var items = [{ id: 'HOME', title: 'Trang chủ', icon: 'house' }].concat(
      homeMenus().map(function (m) { return { id: m.menuId, title: m.title, icon: m.icon }; })
    );
    var html = items.map(function (it) {
      return '<button type="button" data-home="' + esc(it.id) + '"><span>' + icon(it.icon) + '</span> ' + esc(it.title) + '</button>';
    }).join('');
    setHtml('#homeNav', html);
    setHtml('#homeMnav', html);
    $$('#homeNav [data-home], #homeMnav [data-home]').forEach(function (b) {
      b.onclick = function () {
        hide('#homeMnav');
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
    setHtml('#publicMain', '<div class="panel"><h1>' + esc(m.title) + '</h1><p class="dim">Nội dung đang cập nhật.</p></div>');
  }

  function renderPublicHome() {
    var cfg = state.config || {};
    var appHtml = state.apps.length
      ? state.apps.map(function (a) {
          var letter = (a.title || 'A').charAt(0).toUpperCase();
          return '<a class="card" href="' + esc(a.url) + '" target="_blank" rel="noopener">' +
            '<span class="badge-ico" style="background:' + color(a.title) + '">' + esc(letter) + '</span>' +
            '<span><b>' + esc(a.title) + '</b><small>' + esc(a.category || 'Ứng dụng') + '</small></span></a>';
        }).join('')
      : '<div class="empty">Chưa có ứng dụng.</div>';

    var postHtml = state.posts.length
      ? '<div class="post-grid">' + state.posts.map(postCardHtml).join('') + '</div>'
      : '<div class="empty">Chưa có tin tức / thông báo.</div>';

    setHtml('#publicMain',
      '<section class="hero">' +
      '<div class="badge">Cổng thông tin công khai</div>' +
      '<h1>' + esc(cfg.welcomeTitle || cfg.schoolName || 'Cổng thông tin trường học') + '</h1>' +
      '<p>' + esc(cfg.welcomeText || 'Tin tức, tiện ích và không gian làm việc số.') + '</p>' +
      '<div class="hero-actions">' +
      '<button type="button" class="btn btn-primary lg" id="heroLogin">Đăng nhập làm việc</button>' +
      '<a class="btn btn-outline lg" href="#sec-posts">Xem tin tức</a></div></section>' +
      '<section class="sec" id="sec-apps"><div class="sec-h"><h2>Ứng dụng thường dùng</h2></div>' +
      '<div class="grid">' + appHtml + '</div></section>' +
      '<section class="sec" id="sec-posts"><div class="sec-h"><h2>Tin tức &amp; thông báo</h2></div>' +
      postHtml + '</section>');

    var hl = el('heroLogin');
    if (hl) hl.onclick = openLogin;
    $$('#publicMain [data-post]').forEach(function (node) {
      node.onclick = function () { openPublicPost(node.getAttribute('data-post')); };
    });
  }

  function openPublicPost(id) {
    function view(p) {
      if (!p) return toast('Không tìm thấy bài viết');
      var media = '';
      if (p.thumbnailUrl) {
        media += '<p class="media-img"><img src="' + esc(p.thumbnailUrl) + '" alt="" style="max-width:100%;border-radius:12px"></p>';
      }
      setHtml('#publicMain',
        '<article class="panel article">' +
        '<span class="tag">' + esc(p.category || 'Thông báo') + '</span>' +
        '<h1>' + esc(p.title) + '</h1>' +
        '<p class="dim">' + esc(p.summary || '') + '</p>' +
        media +
        '<div class="article-body">' + (p.contentHtml || '') + '</div>' +
        '<p style="margin-top:18px"><button type="button" class="btn btn-outline" id="backPub">← Trang chủ</button></p></article>');
      var b = el('backPub');
      if (b) b.onclick = renderPublicHome;
    }
    var p = state.posts.find(function (x) { return x.postId === id; });
    if (p) return view(p);
    if (!state.token) return toast('Không tìm thấy bài viết');
    api('getPost', { postId: id }).then(view).catch(function (e) { toast(e.message); });
  }

  /* ===== WORKSPACE — sidebar gọn, chỉ chức năng CRUD ===== */
  function showWork() {
    state.mode = 'work';
    hide('#publicApp'); show('#workApp');
    paintSide(); renderDashboard();
  }

  function paintSide() {
    var cfg = state.config || {};
    setText('#sideSchool', cfg.schoolName || 'Làm việc');
    setText('#sideRole', (state.user && state.user.groupCode) || 'USER');
    setText('#whoName', (state.user && (state.user.fullName || state.user.username)) || '');
    setText('#ava', ((state.user && state.user.fullName) || 'U').charAt(0).toUpperCase());

    // Sidebar chỉ tool — không lặp menu public
    var html = '';
    html += '<div class="grp">Nội dung</div>';
    html += sideBtn('POSTS', '📰', 'Tin tức & thông báo');
    html += sideBtn('POST_NEW', '✎', 'Viết bài mới');
    if (state.isAdmin) {
      html += '<div class="grp">Quản trị</div>';
      html += sideBtn('APPS', '▦', 'Ứng dụng');
      html += sideBtn('MENUS', '🔗', 'Menu trang chủ');
      html += sideBtn('USERS', '👤', 'Tài khoản');
      html += sideBtn('CONFIG', '⚙', 'Cấu hình');
    }
    setHtml('#sideNav', html);
    $$('#sideNav [data-side]').forEach(function (b) {
      b.onclick = function () {
        $$('#sideNav [data-side]').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        var s = el('side'); if (s) s.classList.remove('open');
        navSide(b.getAttribute('data-side'));
      };
    });
  }

  function sideBtn(id, ico, title) {
    return '<button type="button" data-side="' + esc(id) + '"><span>' + ico + '</span> ' + esc(title) + '</button>';
  }

  function navSide(id) {
    if (id === 'POSTS') return renderPostsList();
    if (id === 'POST_NEW') return renderPostForm(null);
    if (id === 'APPS') return renderAppsCrud();
    if (id === 'MENUS') return renderMenusCrud();
    if (id === 'USERS') return renderUsersCrud();
    if (id === 'CONFIG') return renderConfig();
  }

  function renderDashboard() {
    setText('#crumb', 'Tổng quan');
    var name = (state.user && state.user.fullName) || 'bạn';
    var cards = '' +
      cardGo('POSTS', '📰', 'Tin tức', 'Xem · sửa · xóa bài') +
      cardGo('POST_NEW', '✎', 'Viết bài', 'Thêm tin có ảnh / video');
    if (state.isAdmin) {
      cards += cardGo('APPS', '▦', 'Ứng dụng', 'Thêm · sửa · xóa') +
        cardGo('MENUS', '🔗', 'Menu trang chủ', 'Cấu hình menu công khai') +
        cardGo('USERS', '👤', 'Tài khoản', 'Thêm người dùng') +
        cardGo('CONFIG', '⚙', 'Cấu hình', 'Tên trường, liên hệ');
    }
    setHtml('#workMain',
      '<div class="panel"><h2>Xin chào, ' + esc(name) + '</h2>' +
      '<p class="dim">Chọn chức năng bên dưới hoặc menu trái. Ưu tiên thêm / sửa / xóa nhanh.</p>' +
      '<div class="grid" style="margin-top:16px">' + cards + '</div></div>');
    $$('#workMain [data-go]').forEach(function (b) {
      b.onclick = function () { navSide(b.getAttribute('data-go')); };
    });
  }

  function cardGo(id, ico, title, desc) {
    return '<button type="button" class="card" data-go="' + id + '">' +
      '<span class="badge-ico" style="background:#1e4a8c">' + ico + '</span>' +
      '<span><b>' + title + '</b><small>' + desc + '</small></span></button>';
  }

  function field(label, name, val, type) {
    val = val == null ? '' : val;
    type = type || 'text';
    if (type === 'textarea') {
      return '<label class="span2">' + label + '<textarea name="' + name + '" rows="5">' + esc(val) + '</textarea></label>';
    }
    if (type === 'select-status') {
      return '<label>' + label + '<select name="' + name + '">' +
        '<option value="ON"' + (val === 'OFF' ? '' : ' selected') + '>Bật</option>' +
        '<option value="OFF"' + (val === 'OFF' ? ' selected' : '') + '>Tắt</option></select></label>';
    }
    return '<label class="' + (type === 'url' || name === 'summary' ? 'span2' : '') + '">' + label +
      '<input name="' + name + '" type="' + (type === 'url' ? 'url' : type) + '" value="' + esc(val) + '"></label>';
  }

  /* —— POSTS CRUD —— */
  function renderPostsList() {
    setText('#crumb', 'Tin tức & thông báo');
    setHtml('#workMain', '<div class="panel"><p class="dim">Đang tải…</p></div>');
    // bootstrap posts are published only; admin needs all — try list via get if we had listAll; use published + note
    var load = state.isAdmin
      ? api('bootstrap').then(function (d) {
          // still published-only from bootstrap; save/list limited — show published + draft via known sample
          apply(d, true);
          return state.posts;
        })
      : Promise.resolve(state.posts);

    load.then(function (posts) {
      var rows = (posts || []).map(function (p) {
        return '<tr>' +
          '<td><b>' + esc(p.title) + '</b><div class="dim" style="font-size:11px">' + esc(p.category || '') + ' · ' + esc(p.status || '') + '</div></td>' +
          '<td class="actions">' +
          '<button type="button" class="btn btn-sm" data-edit="' + esc(p.postId) + '">Sửa</button> ' +
          '<button type="button" class="btn btn-sm btn-danger" data-del="' + esc(p.postId) + '">Xóa</button></td></tr>';
      }).join('');
      setHtml('#workMain',
        '<div class="panel">' +
        '<div class="toolbar"><h3 style="margin:0">Danh sách bài viết</h3>' +
        '<button type="button" class="btn btn-primary" id="btnNewPost">+ Viết bài mới</button></div>' +
        (rows
          ? '<div class="table-wrap"><table class="table"><thead><tr><th>Bài viết</th><th style="width:140px">Thao tác</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
          : '<div class="empty">Chưa có bài. Bấm “Viết bài mới”.</div>') +
        '<p class="dim" style="margin-top:12px">Chỉ bài <b>PUBLISHED</b> hiện trên trang công khai. Ảnh: dán link ảnh (Drive/Imgur…). Video: dán link YouTube.</p></div>');
      var bn = el('btnNewPost');
      if (bn) bn.onclick = function () { renderPostForm(null); };
      $$('#workMain [data-edit]').forEach(function (b) {
        b.onclick = function () {
          var id = b.getAttribute('data-edit');
          var p = (posts || []).find(function (x) { return x.postId === id; });
          renderPostForm(p || { postId: id });
        };
      });
      $$('#workMain [data-del]').forEach(function (b) {
        b.onclick = function () {
          if (!confirm('Xóa bài viết này?')) return;
          api('deletePost', { postId: b.getAttribute('data-del') })
            .then(function () { toast('Đã xóa'); return refreshPosts(); })
            .then(renderPostsList)
            .catch(function (e) { toast(e.message); });
        };
      });
    }).catch(function (e) {
      setHtml('#workMain', '<div class="panel"><p class="err">' + esc(e.message) + '</p></div>');
    });
  }

  function refreshPosts() {
    return api('bootstrap').then(function (d) {
      apply(d, true);
    });
  }

  function renderPostForm(post) {
    post = post || {};
    state.editingPost = post.postId || null;
    setText('#crumb', post.postId ? 'Sửa bài viết' : 'Viết bài mới');
    setHtml('#workMain',
      '<div class="panel"><h3>' + (post.postId ? 'Sửa bài viết' : 'Viết bài mới') + '</h3>' +
      '<form class="form" id="postForm">' +
      '<input type="hidden" name="postId" value="' + esc(post.postId || '') + '">' +
      field('Tiêu đề', 'title', post.title) +
      field('Danh mục (Thông báo / Hoạt động…)', 'category', post.category || 'Thông báo') +
      field('Tóm tắt ngắn', 'summary', post.summary) +
      field('Ảnh đại diện (link ảnh)', 'thumbnailUrl', post.thumbnailUrl, 'url') +
      field('Ảnh trong bài (link ảnh, tùy chọn)', 'imageUrl', '', 'url') +
      field('Video YouTube hoặc file .mp4 (link)', 'videoUrl', '', 'url') +
      field('Nội dung (gõ văn bản, xuống dòng được)', 'bodyText', stripHtml(post.contentHtml), 'textarea') +
      '<label>Trạng thái<select name="status">' +
      '<option value="DRAFT"' + (post.status === 'PUBLISHED' ? '' : ' selected') + '>Nháp</option>' +
      '<option value="PUBLISHED"' + (post.status === 'PUBLISHED' ? ' selected' : '') + '>Công khai</option></select></label>' +
      '<label><span style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="pinned" value="true"' +
      (String(post.pinned) === 'true' || post.pinned === true ? ' checked' : '') + '> Ghim lên đầu</span></label>' +
      '<label class="span2 actions-row">' +
      '<button class="btn btn-primary" type="submit">Lưu bài</button> ' +
      '<button class="btn btn-outline" type="button" id="btnCancelPost">Hủy</button></label></form>' +
      '<p class="dim">Mẹo: tải ảnh lên Google Drive → chia sẻ “bất kỳ ai có link” → dán link trực tiếp vào ô ảnh. Video: dán link YouTube.</p></div>');

    var form = el('postForm');
    if (form) form.onsubmit = function (e) {
      e.preventDefault();
      var fd = Object.fromEntries(new FormData(e.target));
      fd.pinned = !!(e.target.pinned && e.target.pinned.checked);
      fd.contentHtml = buildContentHtml(fd.bodyText, fd.imageUrl, fd.videoUrl);
      // keep existing html if editing and no new body/media typed empty overwrites - ok
      if (!fd.postId) delete fd.postId;
      delete fd.bodyText; delete fd.imageUrl; delete fd.videoUrl;
      api('savePost', fd).then(function () {
        toast('Đã lưu bài viết');
        return refreshPosts();
      }).then(function () { renderPostsList(); })
        .catch(function (err) { toast(err.message); });
    };
    var cancel = el('btnCancelPost');
    if (cancel) cancel.onclick = function () { renderPostsList(); };
  }

  function stripHtml(html) {
    if (!html) return '';
    var d = document.createElement('div');
    d.innerHTML = html;
    return (d.textContent || '').trim();
  }

  /* —— APPS CRUD —— */
  function renderAppsCrud() {
    if (!state.isAdmin) return toast('Chỉ quản trị');
    setText('#crumb', 'Ứng dụng');
    setHtml('#workMain', '<div class="panel"><p class="dim">Đang tải…</p></div>');
    api('listAppsAdmin').then(function (apps) {
      var rows = (apps || []).map(function (a) {
        return '<tr><td><b>' + esc(a.title) + '</b><div class="dim" style="font-size:11px">' + esc(a.url) + '</div></td>' +
          '<td>' + esc(a.category || '') + '</td>' +
          '<td class="actions">' +
          '<button type="button" class="btn btn-sm" data-edit="' + esc(a.appId) + '">Sửa</button> ' +
          '<button type="button" class="btn btn-sm btn-danger" data-del="' + esc(a.appId) + '">Xóa</button></td></tr>';
      }).join('');
      setHtml('#workMain',
        '<div class="panel"><div class="toolbar"><h3 style="margin:0">Ứng dụng trang chủ</h3>' +
        '<button type="button" class="btn btn-primary" id="btnNewApp">+ Thêm</button></div>' +
        '<div class="table-wrap"><table class="table"><thead><tr><th>Ứng dụng</th><th>Nhóm</th><th></th></tr></thead><tbody>' +
        (rows || '<tr><td colspan="3">Chưa có</td></tr>') + '</tbody></table></div>' +
        '<div id="appFormBox" class="hidden" style="margin-top:16px"></div></div>');
      el('btnNewApp').onclick = function () { showAppForm(null); };
      $$('#workMain [data-edit]').forEach(function (b) {
        b.onclick = function () {
          var a = apps.find(function (x) { return x.appId === b.getAttribute('data-edit'); });
          showAppForm(a);
        };
      });
      $$('#workMain [data-del]').forEach(function (b) {
        b.onclick = function () {
          if (!confirm('Xóa ứng dụng này?')) return;
          api('deleteApp', { appId: b.getAttribute('data-del') })
            .then(function () { toast('Đã xóa'); return api('bootstrap'); })
            .then(function (d) { apply(d, true); renderAppsCrud(); })
            .catch(function (e) { toast(e.message); });
        };
      });
    }).catch(function (e) {
      setHtml('#workMain', '<div class="panel"><p class="err">' + esc(e.message) + '</p></div>');
    });
  }

  function showAppForm(app) {
    app = app || {};
    var box = el('appFormBox');
    if (!box) return;
    box.classList.remove('hidden');
    box.innerHTML = '<h4>' + (app.appId ? 'Sửa ứng dụng' : 'Thêm ứng dụng') + '</h4><form class="form" id="appForm">' +
      '<input type="hidden" name="appId" value="' + esc(app.appId || '') + '">' +
      field('Tên', 'title', app.title) + field('URL', 'url', app.url, 'url') +
      field('Nhóm', 'category', app.category || 'Chung') + field('Thứ tự', 'sortOrder', app.sortOrder || 10, 'number') +
      '<label class="span2"><button class="btn btn-primary" type="submit">Lưu</button></label></form>';
    el('appForm').onsubmit = function (e) {
      e.preventDefault();
      var d = Object.fromEntries(new FormData(e.target));
      if (!d.appId) delete d.appId;
      api('saveApp', d).then(function () {
        toast('Đã lưu');
        return api('bootstrap');
      }).then(function (boot) { apply(boot, true); renderAppsCrud(); })
        .catch(function (err) { toast(err.message); });
    };
  }

  /* —— MENUS HOME only (public) —— */
  function renderMenusCrud() {
    if (!state.isAdmin) return toast('Chỉ quản trị');
    setText('#crumb', 'Menu trang chủ');
    setHtml('#workMain', '<div class="panel"><p class="dim">Đang tải…</p></div>');
    api('listMenusAdmin').then(function (all) {
      // chỉ menu HOME — tránh trùng sidebar tools
      var list = (all || []).filter(function (m) {
        return String(m.location || '').toUpperCase() === 'HOME';
      });
      var rows = list.map(function (m) {
        return '<tr><td><b>' + esc(m.title) + '</b><div class="dim" style="font-size:11px">' + esc(m.icon) + ' · ' + esc(m.url || '') + '</div></td>' +
          '<td class="actions">' +
          '<button type="button" class="btn btn-sm" data-edit="' + esc(m.menuId) + '">Sửa</button> ' +
          '<button type="button" class="btn btn-sm btn-danger" data-del="' + esc(m.menuId) + '">Xóa</button></td></tr>';
      }).join('');
      setHtml('#workMain',
        '<div class="panel"><div class="toolbar"><h3 style="margin:0">Menu trang công khai</h3>' +
        '<button type="button" class="btn btn-primary" id="btnNewMenu">+ Thêm menu</button></div>' +
        '<p class="dim">Chỉ hiện trên trang chủ (không cần đăng nhập). Không trùng với menu làm việc bên trái.</p>' +
        '<div class="table-wrap"><table class="table"><thead><tr><th>Menu</th><th></th></tr></thead><tbody>' +
        (rows || '<tr><td colspan="2">Chưa có menu HOME — bấm Thêm menu</td></tr>') +
        '</tbody></table></div><div id="menuFormBox" class="hidden" style="margin-top:16px"></div></div>');
      el('btnNewMenu').onclick = function () { showMenuForm(null); };
      $$('#workMain [data-edit]').forEach(function (b) {
        b.onclick = function () {
          var m = list.find(function (x) { return x.menuId === b.getAttribute('data-edit'); });
          showMenuForm(m);
        };
      });
      $$('#workMain [data-del]').forEach(function (b) {
        b.onclick = function () {
          if (!confirm('Xóa menu này?')) return;
          api('deleteMenu', { menuId: b.getAttribute('data-del') })
            .then(function () { toast('Đã xóa'); renderMenusCrud(); })
            .catch(function (e) { toast(e.message); });
        };
      });
    }).catch(function (e) {
      setHtml('#workMain', '<div class="panel"><p class="err">' + esc(e.message) + '</p></div>');
    });
  }

  function showMenuForm(m) {
    m = m || {};
    var box = el('menuFormBox');
    if (!box) return;
    box.classList.remove('hidden');
    box.innerHTML = '<h4>' + (m.menuId ? 'Sửa menu' : 'Thêm menu trang chủ') + '</h4><form class="form" id="menuForm">' +
      '<input type="hidden" name="menuId" value="' + esc(m.menuId || '') + '">' +
      '<input type="hidden" name="location" value="HOME">' +
      field('Tiêu đề', 'title', m.title) +
      field('Icon (house, newspaper, building, folder, grid, link)', 'icon', m.icon || 'link') +
      field('URL (để trống nếu chỉ là nhãn)', 'url', m.url || '') +
      field('Thứ tự', 'sortOrder', m.sortOrder || 10, 'number') +
      field('Trạng thái', 'status', m.status || 'ON', 'select-status') +
      '<label class="span2"><button class="btn btn-primary" type="submit">Lưu menu</button></label></form>';
    el('menuForm').onsubmit = function (e) {
      e.preventDefault();
      var d = Object.fromEntries(new FormData(e.target));
      d.location = 'HOME';
      d.menuType = d.url ? 'LINK' : 'GROUP';
      d.openMode = (String(d.url || '').indexOf('http') === 0) ? 'NEW' : 'SAME';
      if (!d.menuId) delete d.menuId;
      api('saveMenu', d).then(function () {
        toast('Đã lưu menu');
        return api('bootstrap');
      }).then(function (boot) { apply(boot, true); renderMenusCrud(); })
        .catch(function (err) { toast(err.message); });
    };
  }

  /* —— USERS —— */
  function renderUsersCrud() {
    if (!state.isAdmin) return toast('Chỉ quản trị');
    setText('#crumb', 'Tài khoản');
    setHtml('#workMain', '<div class="panel"><p class="dim">Đang tải…</p></div>');
    api('listUsers').then(function (users) {
      var rows = (users || []).map(function (u) {
        return '<tr><td><b>' + esc(u.username) + '</b></td><td>' + esc(u.fullName) + '</td><td>' + esc(u.groupCode) + '</td><td>' + esc(u.status) + '</td></tr>';
      }).join('');
      setHtml('#workMain',
        '<div class="panel"><h3>Tài khoản</h3>' +
        '<div class="table-wrap"><table class="table"><thead><tr><th>Username</th><th>Họ tên</th><th>Nhóm</th><th>TT</th></tr></thead><tbody>' +
        rows + '</tbody></table></div>' +
        '<h4 style="margin-top:18px">Thêm / cập nhật</h4><form class="form" id="userForm">' +
        field('Username', 'username') + field('Họ tên', 'fullName') +
        field('Mật khẩu (bắt buộc khi tạo mới)', 'password', '', 'password') +
        field('Nhóm (ADMIN/BGH/GV/VP)', 'groupCode', 'GV') +
        field('Trạng thái', 'status', 'ON', 'select-status') +
        '<label class="span2"><button class="btn btn-primary" type="submit">Lưu tài khoản</button></label></form></div>');
      el('userForm').onsubmit = function (e) {
        e.preventDefault();
        api('saveUser', Object.fromEntries(new FormData(e.target)))
          .then(function () { toast('Đã lưu'); renderUsersCrud(); })
          .catch(function (err) { toast(err.message); });
      };
    }).catch(function (e) {
      setHtml('#workMain', '<div class="panel"><p class="err">' + esc(e.message) + '</p></div>');
    });
  }

  function renderConfig() {
    if (!state.isAdmin) return toast('Chỉ quản trị');
    setText('#crumb', 'Cấu hình');
    var c = state.config || {};
    setHtml('#workMain',
      '<div class="panel"><h3>Cấu hình cổng</h3><form class="form" id="cfgForm">' +
      field('Tên trường', 'schoolName', c.schoolName) +
      field('Địa chỉ', 'address', c.address) +
      field('Điện thoại', 'phone', c.phone) +
      field('Email', 'email', c.email) +
      field('Tiêu đề chào', 'welcomeTitle', c.welcomeTitle) +
      field('Mô tả', 'welcomeText', c.welcomeText, 'textarea') +
      '<label class="span2"><button class="btn btn-primary" type="submit">Lưu</button></label></form></div>');
    el('cfgForm').onsubmit = function (e) {
      e.preventDefault();
      var config = Object.fromEntries(new FormData(e.target));
      api('saveConfig', { config: config }).then(function () {
        state.config = Object.assign({}, state.config, config);
        paintSide(); toast('Đã lưu');
      }).catch(function (err) { toast(err.message); });
    };
  }

  /* ===== Auth ===== */
  function openLogin() {
    show('#overlay'); setText('#loginErr', '');
    setTimeout(function () { var u = el('username'); if (u) u.focus(); }, 30);
  }
  function closeLogin() { hide('#overlay'); }

  function onLogin(e) {
    e.preventDefault();
    setText('#loginErr', '');
    var btn = el('loginBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Đang đăng nhập…'; }
    api('login', {
      username: ((el('username') && el('username').value) || '').trim(),
      password: (el('password') && el('password').value) || ''
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
      state.token = ''; state.user = null; state.isAdmin = false;
      showPublic(); toast('Đã đăng xuất');
    });
  }

  function boot() {
    hide('#overlay');
    function startPublic() {
      api('publicBootstrap', {}).then(function (d) {
        apply(d, false); showPublic();
      }).catch(function (e) {
        console.warn(e.message);
        state.config = {
          schoolName: 'Cổng thông tin trường học',
          welcomeTitle: 'Cổng thông tin trường học',
          welcomeText: 'Tin tức, tiện ích và không gian làm việc số.',
          address: '', phone: '', email: ''
        };
        showPublic();
      });
    }
    if (state.token) {
      api('bootstrap').then(function (d) {
        apply(d, true); showWork();
      }).catch(function () {
        sessionStorage.removeItem('school_token');
        state.token = ''; state.user = null;
        startPublic();
      });
    } else startPublic();
  }

  var lf = el('loginForm');
  if (lf) lf.addEventListener('submit', onLogin);
  on('btnLogin', 'click', openLogin);
  on('btnCloseLogin', 'click', closeLogin);
  on('overlayBg', 'click', closeLogin);
  on('btnLogout', 'click', onLogout);
  on('btnBackPublic', 'click', function () { showPublic(); });
  on('pubHome', 'click', function (e) { e.preventDefault(); renderPublicHome(); });
  on('pubBurger', 'click', function () {
    var m = el('homeMnav'); if (m) m.classList.toggle('hidden');
  });
  on('sideToggle', 'click', function () {
    var s = el('side'); if (s) s.classList.toggle('open');
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeLogin();
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
