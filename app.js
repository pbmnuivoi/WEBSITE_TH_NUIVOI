/**
 * Cổng thông tin — Public chuyên nghiệp + Workspace CRUD
 * - Menu HOME từ dữ liệu (không ép "Trang chủ")
 * - Bài viết gắn danh mục/menu → lọc theo menu
 * - Trang chủ: giới thiệu, tin mới, thông báo, liên hệ, ảnh hover
 * - Load: hiện khung ngay, dữ liệu đổ sau (không trắng lâu)
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
    user: null, config: {}, menus: [], apps: [], posts: [], categories: [],
    isAdmin: false, mode: 'public'
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
    if (!n) return;
    n.textContent = msg; n.classList.add('show');
    setTimeout(function () { n.classList.remove('show'); }, 2500);
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
    state.categories = d.categories || defaultCategories();
    state.isAdmin = !!d.isAdmin;
    if (withUser) state.user = d.user || null;
  }

  function defaultCategories() {
    return [
      { categoryId: 'C_TB', name: 'Thông báo' },
      { categoryId: 'C_HD', name: 'Hoạt động' },
      { categoryId: 'C_CD', name: 'Chuyên đề' },
      { categoryId: 'C_VB', name: 'Văn bản' }
    ];
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

  /** Menu công khai — không tự thêm "Trang chủ" */
  function homeMenus() {
    return state.menus
      .filter(function (m) {
        var loc = String(m.location || '').toUpperCase();
        if (loc !== 'HOME') return false;
        // bỏ các id trang chủ trùng
        if (m.menuId === 'M_HOME' || m.menuId === 'HOME') return false;
        if (String(m.title || '').trim().toLowerCase() === 'trang chủ') return false;
        return true;
      })
      .sort(function (a, b) { return Number(a.sortOrder || 0) - Number(b.sortOrder || 0); });
  }

  function categoryNames() {
    var fromCat = (state.categories || []).map(function (c) { return c.name; });
    var fromMenus = homeMenus().map(function (m) { return m.title; });
    var set = {};
    fromCat.concat(fromMenus).forEach(function (n) {
      if (n) set[n] = 1;
    });
    var list = Object.keys(set);
    return list.length ? list : ['Thông báo', 'Hoạt động', 'Chuyên đề', 'Văn bản'];
  }

  function postsByCategory(name) {
    return (state.posts || []).filter(function (p) {
      return String(p.category || '').trim().toLowerCase() === String(name || '').trim().toLowerCase();
    });
  }

  function youtubeId(url) {
    if (!url) return '';
    var m = String(url).match(/(?:youtu\.be\/|v=|\/embed\/|shorts\/)([A-Za-z0-9_-]{6,})/);
    return m ? m[1] : '';
  }

  function buildContentHtml(text, imageUrl, videoUrl) {
    var html = '';
    if (imageUrl) {
      html += '<p class="media-img"><img src="' + esc(imageUrl) + '" alt="" loading="lazy"></p>';
    }
    var yid = youtubeId(videoUrl);
    if (yid) {
      html += '<div class="media-video"><iframe src="https://www.youtube.com/embed/' + yid +
        '" title="Video" allowfullscreen loading="lazy"></iframe></div>';
    } else if (videoUrl && /\.(mp4|webm)(\?|$)/i.test(videoUrl)) {
      html += '<p class="media-video"><video src="' + esc(videoUrl) + '" controls></video></p>';
    }
    if (text) {
      html += String(text).split(/\n{2,}/).map(function (p) {
        return '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>';
      }).join('');
    }
    return html;
  }

  function postCard(p) {
    var thumb = p.thumbnailUrl
      ? '<div class="post-thumb"><img src="' + esc(p.thumbnailUrl) + '" alt="" loading="lazy" onerror="this.parentNode.classList.add(\'no-img\')"></div>'
      : '<div class="post-thumb no-img"></div>';
    return '<article class="post" data-post="' + esc(p.postId) + '">' + thumb +
      '<div class="post-body"><span class="tag">' + esc(p.category || 'Thông báo') + '</span>' +
      '<h3>' + esc(p.title) + '</h3><p>' + esc(p.summary || '') + '</p></div></article>';
  }

  function bindPostClicks(root) {
    $$((root || document) + ' [data-post]'.replace(/^ /, '')).length;
    var scope = root ? $(root) : document;
    if (!scope) return;
    $$('[data-post]', scope).forEach(function (node) {
      node.onclick = function () { openPublicPost(node.getAttribute('data-post')); };
    });
  }

  /* ===== PUBLIC ===== */
  function showPublic() {
    state.mode = 'public';
    show('#publicApp'); hide('#workApp');
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

    // Logo click = trang chủ; nav chỉ menu HOME từ dữ liệu
    var items = homeMenus().map(function (m) {
      return { id: m.menuId, title: m.title, icon: m.icon };
    });
    var html = items.map(function (it) {
      return '<button type="button" data-home="' + esc(it.id) + '"><span>' + icon(it.icon) + '</span> ' + esc(it.title) + '</button>';
    }).join('');
    setHtml('#homeNav', html || '');
    setHtml('#homeMnav', html || '');
    $$('#homeNav [data-home], #homeMnav [data-home]').forEach(function (b) {
      b.onclick = function () {
        hide('#homeMnav');
        navHome(b.getAttribute('data-home'));
      };
    });
  }

  function navHome(id) {
    var m = state.menus.find(function (x) { return x.menuId === id; });
    if (!m) return renderPublicHome();
    if (m.url && /^https?:/i.test(m.url)) {
      window.open(m.url, m.openMode === 'SAME' ? '_self' : '_blank', 'noopener');
      return;
    }
    // Nội dung theo danh mục = tên menu
    var list = postsByCategory(m.title);
    var body = list.length
      ? '<div class="post-grid">' + list.map(postCard).join('') + '</div>'
      : '<div class="empty">Chưa có bài trong mục “' + esc(m.title) + '”. Admin hãy đăng bài và chọn đúng danh mục.</div>';
    setHtml('#publicMain',
      '<div class="page-head"><button type="button" class="btn btn-outline btn-sm" id="backHome">← Trang chủ</button>' +
      '<h1>' + esc(m.title) + '</h1></div>' + body);
    var bh = el('backHome');
    if (bh) bh.onclick = renderPublicHome;
    bindPostClicks('#publicMain');
  }

  function renderPublicHome() {
    var cfg = state.config || {};
    var posts = state.posts || [];
    var news = posts.filter(function (p) {
      var c = String(p.category || '').toLowerCase();
      return c.indexOf('thông báo') < 0 && c.indexOf('thong bao') < 0;
    }).slice(0, 6);
    var notices = posts.filter(function (p) {
      var c = String(p.category || '').toLowerCase();
      return c.indexOf('thông báo') >= 0 || c.indexOf('thong bao') >= 0;
    }).slice(0, 5);
    if (!news.length && posts.length) news = posts.slice(0, 6);
    if (!notices.length && posts.length) notices = posts.slice(0, 3);

    var gallery = [cfg.bannerUrl, cfg.gallery1, cfg.gallery2, cfg.gallery3, cfg.gallery4]
      .filter(Boolean);

    var appHtml = state.apps.length
      ? state.apps.map(function (a) {
          var letter = (a.title || 'A').charAt(0).toUpperCase();
          return '<a class="card hover-lift" href="' + esc(a.url) + '" target="_blank" rel="noopener">' +
            '<span class="badge-ico" style="background:' + color(a.title) + '">' + esc(letter) + '</span>' +
            '<span><b>' + esc(a.title) + '</b><small>' + esc(a.category || 'Ứng dụng') + '</small></span></a>';
        }).join('')
      : '';

    var galleryHtml = gallery.length
      ? '<section class="sec"><div class="sec-h"><h2>Hình ảnh nhà trường</h2></div>' +
        '<div class="gallery">' + gallery.map(function (src) {
          return '<div class="gallery-item hover-zoom"><img src="' + esc(src) + '" alt="" loading="lazy"></div>';
        }).join('') + '</div></section>'
      : '';

    var newsHtml = news.length
      ? '<div class="post-grid">' + news.map(postCard).join('') + '</div>'
      : '<div class="empty">Chưa có tin mới.</div>';

    var noticeHtml = notices.length
      ? '<ul class="notice-list">' + notices.map(function (p) {
          return '<li data-post="' + esc(p.postId) + '"><span class="tag">' + esc(p.category || 'Thông báo') + '</span> ' +
            '<b>' + esc(p.title) + '</b><span class="dim"> — ' + esc(p.summary || '') + '</span></li>';
        }).join('') + '</ul>'
      : '<div class="empty">Chưa có thông báo.</div>';

    var intro = cfg.introHtml || cfg.welcomeText || 'Không gian thông tin và tiện ích làm việc dành cho cán bộ, giáo viên, nhân viên và cộng đồng.';

    setHtml('#publicMain',
      '<section class="hero">' +
      (cfg.bannerUrl ? '<div class="hero-bg" style="background-image:url(' + esc(cfg.bannerUrl) + ')"></div>' : '') +
      '<div class="hero-content">' +
      '<div class="badge">Cổng thông tin công khai</div>' +
      '<h1>' + esc(cfg.welcomeTitle || cfg.schoolName || 'Cổng thông tin trường học') + '</h1>' +
      '<p>' + esc(cfg.welcomeText || intro) + '</p>' +
      '<div class="hero-actions">' +
      '<button type="button" class="btn btn-primary lg" id="heroLogin">Đăng nhập làm việc</button> ' +
      '<a class="btn btn-outline lg" href="#sec-news">Xem tin tức</a></div></div></section>' +

      '<section class="sec" id="sec-intro"><div class="sec-h"><h2>Giới thiệu</h2></div>' +
      '<div class="panel intro-box"><p>' + esc(intro) + '</p>' +
      (cfg.address || cfg.phone || cfg.email
        ? '<p class="dim" style="margin-top:12px">' +
          [cfg.address, cfg.phone && ('ĐT: ' + cfg.phone), cfg.email].filter(Boolean).join(' · ') + '</p>'
        : '') +
      '</div></section>' +

      (appHtml ? '<section class="sec"><div class="sec-h"><h2>Ứng dụng thường dùng</h2></div><div class="grid">' + appHtml + '</div></section>' : '') +

      galleryHtml +

      '<section class="sec" id="sec-news"><div class="sec-h"><h2>Tin mới nhất</h2></div>' + newsHtml + '</section>' +

      '<section class="sec" id="sec-notice"><div class="sec-h"><h2>Thông báo</h2></div>' +
      '<div class="panel">' + noticeHtml + '</div></section>' +

      '<section class="sec" id="sec-contact"><div class="sec-h"><h2>Liên hệ</h2></div>' +
      '<div class="panel contact-grid">' +
      '<div><b>Đơn vị</b><p class="dim">' + esc(cfg.schoolName || '—') + '</p></div>' +
      '<div><b>Địa chỉ</b><p class="dim">' + esc(cfg.address || '—') + '</p></div>' +
      '<div><b>Điện thoại</b><p class="dim">' + esc(cfg.phone || '—') + '</p></div>' +
      '<div><b>Email</b><p class="dim">' + esc(cfg.email || '—') + '</p></div>' +
      '</div></section>');

    var hl = el('heroLogin');
    if (hl) hl.onclick = openLogin;
    bindPostClicks('#publicMain');
    $$('#publicMain .notice-list [data-post]').forEach(function (li) {
      li.style.cursor = 'pointer';
      li.onclick = function () { openPublicPost(li.getAttribute('data-post')); };
    });
  }

  function openPublicPost(id) {
    function view(p) {
      if (!p) return toast('Không tìm thấy bài viết');
      var media = p.thumbnailUrl
        ? '<p class="media-img"><img src="' + esc(p.thumbnailUrl) + '" alt=""></p>' : '';
      setHtml('#publicMain',
        '<article class="panel article">' +
        '<span class="tag">' + esc(p.category || 'Thông báo') + '</span>' +
        '<h1>' + esc(p.title) + '</h1>' +
        '<p class="dim">' + esc(p.summary || '') + '</p>' + media +
        '<div class="article-body">' + (p.contentHtml || '') + '</div>' +
        '<p style="margin-top:18px"><button type="button" class="btn btn-outline" id="backPub">← Về trang chủ</button></p></article>');
      var b = el('backPub');
      if (b) b.onclick = renderPublicHome;
    }
    var p = state.posts.find(function (x) { return x.postId === id; });
    if (p) return view(p);
    if (!state.token) return toast('Không tìm thấy bài viết');
    api('getPost', { postId: id }).then(view).catch(function (e) { toast(e.message); });
  }

  /* ===== WORKSPACE ===== */
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
    var html = '<div class="grp">Nội dung</div>';
    html += sideBtn('POSTS', '📰', 'Tin tức & thông báo');
    html += sideBtn('POST_NEW', '✎', 'Viết bài mới');
    if (state.isAdmin) {
      html += '<div class="grp">Quản trị</div>';
      html += sideBtn('APPS', '▦', 'Ứng dụng');
      html += sideBtn('MENUS', '🔗', 'Menu trang chủ');
      html += sideBtn('USERS', '👤', 'Tài khoản');
      html += sideBtn('CONFIG', '⚙', 'Cấu hình & ảnh');
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
    var cards = cardGo('POSTS', '📰', 'Tin tức', 'Xem · sửa · xóa') +
      cardGo('POST_NEW', '✎', 'Viết bài', 'Gắn danh mục / menu');
    if (state.isAdmin) {
      cards += cardGo('MENUS', '🔗', 'Menu trang chủ', 'Mục công khai') +
        cardGo('CONFIG', '⚙', 'Cấu hình & ảnh', 'Banner, gallery, liên hệ') +
        cardGo('APPS', '▦', 'Ứng dụng', 'Thêm · sửa · xóa') +
        cardGo('USERS', '👤', 'Tài khoản', 'Thêm người dùng');
    }
    setHtml('#workMain',
      '<div class="panel"><h2>Xin chào, ' + esc(name) + '</h2>' +
      '<p class="dim">Đăng bài chọn <b>danh mục đúng tên menu</b> để hiện khi khách bấm menu đó.</p>' +
      '<div class="grid" style="margin-top:16px">' + cards + '</div></div>');
    $$('#workMain [data-go]').forEach(function (b) {
      b.onclick = function () { navSide(b.getAttribute('data-go')); };
    });
  }

  function cardGo(id, ico, title, desc) {
    return '<button type="button" class="card hover-lift" data-go="' + id + '">' +
      '<span class="badge-ico" style="background:#1e4a8c">' + ico + '</span>' +
      '<span><b>' + title + '</b><small>' + desc + '</small></span></button>';
  }

  function field(label, name, val, type) {
    val = val == null ? '' : val;
    type = type || 'text';
    if (type === 'textarea') {
      return '<label class="span2">' + label + '<textarea name="' + name + '" rows="4">' + esc(val) + '</textarea></label>';
    }
    if (type === 'select-status') {
      return '<label>' + label + '<select name="' + name + '">' +
        '<option value="ON"' + (val === 'OFF' ? '' : ' selected') + '>Bật</option>' +
        '<option value="OFF"' + (val === 'OFF' ? ' selected' : '') + '>Tắt</option></select></label>';
    }
    if (type === 'select-cat') {
      var opts = categoryNames().map(function (n) {
        return '<option value="' + esc(n) + '"' + (val === n ? ' selected' : '') + '>' + esc(n) + '</option>';
      }).join('');
      return '<label>' + label + '<select name="' + name + '">' + opts + '</select></label>';
    }
    return '<label class="' + (name === 'summary' || type === 'url' ? 'span2' : '') + '">' + label +
      '<input name="' + name + '" type="' + (type === 'url' ? 'url' : type) + '" value="' + esc(val) + '"></label>';
  }

  function renderPostsList() {
    setText('#crumb', 'Tin tức & thông báo');
    setHtml('#workMain', '<div class="panel"><p class="dim">Đang tải…</p></div>');
    api('bootstrap').then(function (d) {
      apply(d, true);
      var posts = state.posts || [];
      var rows = posts.map(function (p) {
        return '<tr><td><b>' + esc(p.title) + '</b><div class="dim" style="font-size:11px">' +
          esc(p.category || '') + ' · ' + esc(p.status || '') + '</div></td>' +
          '<td class="actions">' +
          '<button type="button" class="btn-sm" data-edit="' + esc(p.postId) + '">Sửa</button> ' +
          '<button type="button" class="btn-sm btn-danger" data-del="' + esc(p.postId) + '">Xóa</button></td></tr>';
      }).join('');
      setHtml('#workMain',
        '<div class="panel"><div class="toolbar"><h3 style="margin:0">Bài viết</h3>' +
        '<button type="button" class="btn btn-primary" id="btnNewPost">+ Viết bài</button></div>' +
        (rows
          ? '<div class="table-wrap"><table class="table"><thead><tr><th>Bài</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>'
          : '<div class="empty">Chưa có bài công khai. Viết bài và chọn PUBLISHED.</div>') +
        '<p class="dim" style="margin-top:10px">Danh mục nên trùng <b>tên menu trang chủ</b> để lọc đúng khi khách bấm menu.</p></div>');
      el('btnNewPost').onclick = function () { renderPostForm(null); };
      $$('#workMain [data-edit]').forEach(function (b) {
        b.onclick = function () {
          var p = posts.find(function (x) { return x.postId === b.getAttribute('data-edit'); });
          renderPostForm(p || { postId: b.getAttribute('data-edit') });
        };
      });
      $$('#workMain [data-del]').forEach(function (b) {
        b.onclick = function () {
          if (!confirm('Xóa bài này?')) return;
          api('deletePost', { postId: b.getAttribute('data-del') })
            .then(function () { toast('Đã xóa'); renderPostsList(); })
            .catch(function (e) { toast(e.message); });
        };
      });
    }).catch(function (e) {
      setHtml('#workMain', '<div class="panel"><p class="err">' + esc(e.message) + '</p></div>');
    });
  }

  function renderPostForm(post) {
    post = post || {};
    setText('#crumb', post.postId ? 'Sửa bài' : 'Viết bài mới');
    setHtml('#workMain',
      '<div class="panel"><h3>' + (post.postId ? 'Sửa bài viết' : 'Viết bài mới') + '</h3>' +
      '<form class="form" id="postForm">' +
      '<input type="hidden" name="postId" value="' + esc(post.postId || '') + '">' +
      field('Tiêu đề', 'title', post.title) +
      field('Danh mục / Menu hiển thị', 'category', post.category || categoryNames()[0], 'select-cat') +
      field('Tóm tắt', 'summary', post.summary) +
      field('Ảnh đại diện (URL)', 'thumbnailUrl', post.thumbnailUrl, 'url') +
      field('Ảnh trong bài (URL)', 'imageUrl', '', 'url') +
      field('Video YouTube hoặc .mp4 (URL)', 'videoUrl', '', 'url') +
      field('Nội dung', 'bodyText', stripHtml(post.contentHtml), 'textarea') +
      '<label>Trạng thái<select name="status">' +
      '<option value="DRAFT">Nháp</option>' +
      '<option value="PUBLISHED"' + (post.status === 'PUBLISHED' ? ' selected' : '') + '>Công khai</option></select></label>' +
      '<label><span style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="pinned" value="true"' +
      (post.pinned === true || String(post.pinned) === 'true' ? ' checked' : '') + '> Ghim</span></label>' +
      '<label class="span2 actions-row"><button class="btn btn-primary" type="submit">Lưu</button> ' +
      '<button class="btn btn-outline" type="button" id="btnCancelPost">Hủy</button></label></form>' +
      '<p class="dim">Chọn danh mục trùng tên menu (vd. “Giới thiệu nhà trường”) để bài hiện trong trang menu đó.</p></div>');
    el('postForm').onsubmit = function (e) {
      e.preventDefault();
      var fd = Object.fromEntries(new FormData(e.target));
      fd.pinned = !!(e.target.pinned && e.target.pinned.checked);
      fd.contentHtml = buildContentHtml(fd.bodyText, fd.imageUrl, fd.videoUrl);
      if (!fd.postId) delete fd.postId;
      delete fd.bodyText; delete fd.imageUrl; delete fd.videoUrl;
      api('savePost', fd).then(function () {
        toast('Đã lưu');
        return api('bootstrap');
      }).then(function (d) { apply(d, true); renderPostsList(); })
        .catch(function (err) { toast(err.message); });
    };
    el('btnCancelPost').onclick = function () { renderPostsList(); };
  }

  function stripHtml(html) {
    if (!html) return '';
    var d = document.createElement('div');
    d.innerHTML = html;
    return (d.textContent || '').trim();
  }

  function renderAppsCrud() {
    if (!state.isAdmin) return toast('Chỉ quản trị');
    setText('#crumb', 'Ứng dụng');
    setHtml('#workMain', '<div class="panel"><p class="dim">Đang tải…</p></div>');
    api('listAppsAdmin').then(function (apps) {
      var rows = (apps || []).map(function (a) {
        return '<tr><td><b>' + esc(a.title) + '</b><div class="dim" style="font-size:11px">' + esc(a.url) + '</div></td>' +
          '<td class="actions"><button type="button" class="btn-sm" data-edit="' + esc(a.appId) + '">Sửa</button> ' +
          '<button type="button" class="btn-sm btn-danger" data-del="' + esc(a.appId) + '">Xóa</button></td></tr>';
      }).join('');
      setHtml('#workMain',
        '<div class="panel"><div class="toolbar"><h3 style="margin:0">Ứng dụng</h3>' +
        '<button type="button" class="btn btn-primary" id="btnNewApp">+ Thêm</button></div>' +
        '<div class="table-wrap"><table class="table"><thead><tr><th>Ứng dụng</th><th></th></tr></thead><tbody>' +
        (rows || '<tr><td colspan="2">Chưa có</td></tr>') + '</tbody></table></div>' +
        '<div id="appFormBox" class="hidden" style="margin-top:14px"></div></div>');
      el('btnNewApp').onclick = function () { showAppForm(null, apps); };
      $$('#workMain [data-edit]').forEach(function (b) {
        b.onclick = function () {
          showAppForm(apps.find(function (x) { return x.appId === b.getAttribute('data-edit'); }), apps);
        };
      });
      $$('#workMain [data-del]').forEach(function (b) {
        b.onclick = function () {
          if (!confirm('Xóa?')) return;
          api('deleteApp', { appId: b.getAttribute('data-del') })
            .then(function () { toast('Đã xóa'); renderAppsCrud(); })
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
    box.innerHTML = '<form class="form" id="appForm">' +
      '<input type="hidden" name="appId" value="' + esc(app.appId || '') + '">' +
      field('Tên', 'title', app.title) + field('URL', 'url', app.url, 'url') +
      field('Nhóm', 'category', app.category || 'Chung') + field('Thứ tự', 'sortOrder', app.sortOrder || 10, 'number') +
      '<label class="span2"><button class="btn btn-primary" type="submit">Lưu</button></label></form>';
    el('appForm').onsubmit = function (e) {
      e.preventDefault();
      var d = Object.fromEntries(new FormData(e.target));
      if (!d.appId) delete d.appId;
      api('saveApp', d).then(function () { toast('Đã lưu'); renderAppsCrud(); })
        .catch(function (err) { toast(err.message); });
    };
  }

  function renderMenusCrud() {
    if (!state.isAdmin) return toast('Chỉ quản trị');
    setText('#crumb', 'Menu trang chủ');
    setHtml('#workMain', '<div class="panel"><p class="dim">Đang tải…</p></div>');
    api('listMenusAdmin').then(function (all) {
      var list = (all || []).filter(function (m) {
        return String(m.location || '').toUpperCase() === 'HOME' &&
          m.menuId !== 'M_HOME' && String(m.title || '').toLowerCase() !== 'trang chủ';
      });
      var rows = list.map(function (m) {
        return '<tr><td><b>' + esc(m.title) + '</b><div class="dim" style="font-size:11px">' + esc(m.icon) + '</div></td>' +
          '<td class="actions"><button type="button" class="btn-sm" data-edit="' + esc(m.menuId) + '">Sửa</button> ' +
          '<button type="button" class="btn-sm btn-danger" data-del="' + esc(m.menuId) + '">Xóa</button></td></tr>';
      }).join('');
      setHtml('#workMain',
        '<div class="panel"><div class="toolbar"><h3 style="margin:0">Menu công khai</h3>' +
        '<button type="button" class="btn btn-primary" id="btnNewMenu">+ Thêm</button></div>' +
        '<p class="dim">Tên menu = danh mục bài viết. Không cần mục “Trang chủ” (logo đã về trang chủ).</p>' +
        '<div class="table-wrap"><table class="table"><thead><tr><th>Menu</th><th></th></tr></thead><tbody>' +
        (rows || '<tr><td colspan="2">Chưa có</td></tr>') + '</tbody></table></div>' +
        '<div id="menuFormBox" class="hidden" style="margin-top:14px"></div></div>');
      el('btnNewMenu').onclick = function () { showMenuForm(null); };
      $$('#workMain [data-edit]').forEach(function (b) {
        b.onclick = function () {
          showMenuForm(list.find(function (x) { return x.menuId === b.getAttribute('data-edit'); }));
        };
      });
      $$('#workMain [data-del]').forEach(function (b) {
        b.onclick = function () {
          if (!confirm('Xóa menu?')) return;
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
    box.innerHTML = '<form class="form" id="menuForm">' +
      '<input type="hidden" name="menuId" value="' + esc(m.menuId || '') + '">' +
      '<input type="hidden" name="location" value="HOME">' +
      field('Tiêu đề (= danh mục bài viết)', 'title', m.title) +
      field('Icon', 'icon', m.icon || 'newspaper') +
      field('URL ngoài (tùy chọn)', 'url', m.url || '') +
      field('Thứ tự', 'sortOrder', m.sortOrder || 10, 'number') +
      field('Trạng thái', 'status', m.status || 'ON', 'select-status') +
      '<label class="span2"><button class="btn btn-primary" type="submit">Lưu</button></label></form>';
    el('menuForm').onsubmit = function (e) {
      e.preventDefault();
      var d = Object.fromEntries(new FormData(e.target));
      d.location = 'HOME';
      d.menuType = d.url ? 'LINK' : 'GROUP';
      d.openMode = 'SAME';
      if (!d.menuId) delete d.menuId;
      api('saveMenu', d).then(function () {
        toast('Đã lưu');
        return api('bootstrap');
      }).then(function (boot) { apply(boot, true); renderMenusCrud(); })
        .catch(function (err) { toast(err.message); });
    };
  }

  function renderUsersCrud() {
    if (!state.isAdmin) return toast('Chỉ quản trị');
    setText('#crumb', 'Tài khoản');
    setHtml('#workMain', '<div class="panel"><p class="dim">Đang tải…</p></div>');
    api('listUsers').then(function (users) {
      var rows = (users || []).map(function (u) {
        return '<tr><td>' + esc(u.username) + '</td><td>' + esc(u.fullName) + '</td><td>' + esc(u.groupCode) + '</td><td>' + esc(u.status) + '</td></tr>';
      }).join('');
      setHtml('#workMain',
        '<div class="panel"><h3>Tài khoản</h3>' +
        '<div class="table-wrap"><table class="table"><thead><tr><th>Username</th><th>Họ tên</th><th>Nhóm</th><th>TT</th></tr></thead><tbody>' +
        rows + '</tbody></table></div>' +
        '<h4 style="margin-top:16px">Thêm / cập nhật</h4><form class="form" id="userForm">' +
        field('Username', 'username') + field('Họ tên', 'fullName') +
        field('Mật khẩu', 'password', '', 'password') +
        field('Nhóm', 'groupCode', 'GV') +
        field('Trạng thái', 'status', 'ON', 'select-status') +
        '<label class="span2"><button class="btn btn-primary" type="submit">Lưu</button></label></form></div>');
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
    setText('#crumb', 'Cấu hình & ảnh');
    var c = state.config || {};
    setHtml('#workMain',
      '<div class="panel"><h3>Thông tin & liên hệ</h3><form class="form" id="cfgForm">' +
      field('Tên trường', 'schoolName', c.schoolName) +
      field('Địa chỉ', 'address', c.address) +
      field('Điện thoại', 'phone', c.phone) +
      field('Email', 'email', c.email) +
      field('Tiêu đề hero', 'welcomeTitle', c.welcomeTitle) +
      field('Mô tả ngắn / giới thiệu', 'welcomeText', c.welcomeText, 'textarea') +
      field('Đoạn giới thiệu thêm (intro)', 'introHtml', c.introHtml, 'textarea') +
      '<h3 class="span2" style="grid-column:1/-1;margin:8px 0 0">Hình ảnh trang chủ (URL)</h3>' +
      field('Banner / nền hero', 'bannerUrl', c.bannerUrl, 'url') +
      field('Gallery 1', 'gallery1', c.gallery1, 'url') +
      field('Gallery 2', 'gallery2', c.gallery2, 'url') +
      field('Gallery 3', 'gallery3', c.gallery3, 'url') +
      field('Gallery 4', 'gallery4', c.gallery4, 'url') +
      '<label class="span2"><button class="btn btn-primary" type="submit">Lưu cấu hình</button></label></form>' +
      '<p class="dim">Dán link ảnh (Drive công khai, Imgur…). Hover ảnh trên trang chủ sẽ phóng nhẹ.</p></div>');
    el('cfgForm').onsubmit = function (e) {
      e.preventDefault();
      var config = Object.fromEntries(new FormData(e.target));
      api('saveConfig', { config: config }).then(function () {
        state.config = Object.assign({}, state.config, config);
        paintSide(); toast('Đã lưu');
      }).catch(function (err) { toast(err.message); });
    };
  }

  /* Auth */
  function openLogin() {
    show('#overlay'); setText('#loginErr', '');
    setTimeout(function () { var u = el('username'); if (u) u.focus(); }, 20);
  }
  function closeLogin() { hide('#overlay'); }

  function onLogin(e) {
    e.preventDefault();
    setText('#loginErr', '');
    var btn = el('loginBtn');
    if (btn) { btn.disabled = true; btn.textContent = '…'; }
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
      apply(boot, true); showWork(); toast('Đăng nhập thành công');
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
    // Hiện khung trang chủ ngay (tránh chờ API lâu)
    show('#publicApp');
    hide('#workApp');
    setHtml('#publicMain',
      '<section class="hero"><div class="hero-content"><div class="badge">Đang tải…</div>' +
      '<h1>Cổng thông tin trường học</h1><p class="dim">Đang lấy dữ liệu…</p></div></section>');

    function startPublic() {
      api('publicBootstrap', {}).then(function (d) {
        apply(d, false); showPublic();
      }).catch(function (e) {
        console.warn(e.message);
        state.config = {
          schoolName: 'Cổng thông tin trường học',
          welcomeTitle: 'Cổng thông tin trường học',
          welcomeText: 'Không gian thông tin nhà trường.',
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
