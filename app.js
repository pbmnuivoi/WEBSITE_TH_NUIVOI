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

  // Khóa nút theo từng thao tác; tránh đếm trùng click + submit + fetch.
  var recentActionButton = null;
  function markButtonBusy(button) {
    if (!button || button.tagName !== 'BUTTON') return;
    var hadPendingUnlock = !!button.__busyTimer;
    if (button.__busyTimer) { clearTimeout(button.__busyTimer); button.__busyTimer = null; }
    if (!button.__busyCount) {
      // Nếu đang nối tiếp API, giữ trạng thái disabled ban đầu thay vì ghi nhận
      // trạng thái disabled tạm thời do chính loading tạo ra.
      if (!hadPendingUnlock) button.__wasDisabled = button.disabled;
      button.classList.add('is-loading');
      button.setAttribute('aria-busy', 'true');
      button.disabled = true;
    }
    button.__busyCount = (button.__busyCount || 0) + 1;
  }
  function releaseButtonBusy(button) {
    if (!button || !button.__busyCount) return;
    button.__busyCount = Math.max(0, button.__busyCount - 1);
    if (button.__busyCount) return;
    button.__busyTimer = setTimeout(function () {
      if (button.__busyCount) return;
      button.classList.remove('is-loading');
      button.removeAttribute('aria-busy');
      button.disabled = !!button.__wasDisabled;
      button.__busyTimer = null;
    }, 250);
  }
  function setActionContext(button) {
    if (!button || button.tagName !== 'BUTTON') return;
    recentActionButton = button;
    button.__fetchStarted = false;
    button.__busyReserved = true;
    markButtonBusy(button);
    (function clearContext() {
      setTimeout(function () {
        if (button.__fetchStarted && button.__busyCount > 0) return clearContext();
        if (recentActionButton === button) recentActionButton = null;
        if (!button.__fetchStarted && button.__busyCount > 0) {
          button.__busyReserved = false;
          releaseButtonBusy(button);
        }
      }, 1200);
    })();
  }
  document.addEventListener('click', function (event) {
    var button = event.target && event.target.closest ? event.target.closest('button') : null;
    if (!button || button.disabled) return;
    // Nút submit được quản lý duy nhất ở sự kiện submit của form.
    if (button.type === 'submit' || (button.form && (!button.type || button.type === 'submit'))) return;
    setActionContext(button);
  }, true);
  document.addEventListener('submit', function (event) {
    var form = event.target;
    var button = event.submitter || (form && form.querySelector('button[type="submit"],button:not([type])'));
    if (!button || button.disabled) return;
    setActionContext(button);
  }, true);
  function trackedFetch(input, init) {
    var button = recentActionButton;
    if (button) {
      button.__fetchStarted = true;
      // Lần fetch đầu dùng lượt khóa đã tạo bởi click/submit; fetch tiếp theo
      // trong cùng chuỗi promise mới tăng bộ đếm riêng.
      if (button.__busyReserved) button.__busyReserved = false;
      else markButtonBusy(button);
    }
    var requestInit = Object.assign({}, init || {});
    var controller = window.AbortController ? new AbortController() : null;
    if (controller && !requestInit.signal) requestInit.signal = controller.signal;
    var timeoutId = setTimeout(function () {
      if (controller) controller.abort();
    }, 60000);
    return window.fetch(input, requestInit).catch(function (err) {
      if (err && err.name === 'AbortError') {
        throw new Error('Máy chủ phản hồi quá lâu (60 giây). Vui lòng kiểm tra Cloudflare Worker và Apps Script rồi thử lại.');
      }
      throw err;
    }).finally(function () {
      clearTimeout(timeoutId);
      if (button) releaseButtonBusy(button);
    });
  }

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
  function cfgOn(key, defYes) {
    var v = state.config && state.config[key];
    if (v === undefined || v === null || v === '') return defYes !== false;
    return !(String(v) === '0' || String(v).toLowerCase() === 'false' || String(v) === 'OFF');
  }
  function cfgNum(key, def) {
    var n = Number(state.config && state.config[key]);
    return (isFinite(n) && n > 0) ? n : def;
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
    if (!n) return;
    n.textContent = msg; n.classList.add('show');
    setTimeout(function () { n.classList.remove('show'); }, 2500);
  }

  function applyLogo() {
    var url = (state.config && state.config.logoUrl) || '';
    ['pub', 'side'].forEach(function (p) {
      var img = el(p + 'LogoImg');
      var svg = el(p + 'LogoSvg');
      if (!img) return;
      if (url) {
        img.src = url;
        img.classList.remove('hidden');
        if (svg) svg.classList.add('hidden');
        img.onerror = function () {
          img.classList.add('hidden');
          if (svg) svg.classList.remove('hidden');
        };
      } else {
        img.classList.add('hidden');
        if (svg) svg.classList.remove('hidden');
      }
    });
  }

  function uploadFileInput(file) {
    return new Promise(function (resolve, reject) {
      if (!file) return reject(new Error('Chưa chọn file'));
      if (!/^image\//i.test(file.type || '')) return reject(new Error('Chỉ nhận file ảnh'));
      if (file.size > 8 * 1024 * 1024) return reject(new Error('Ảnh tối đa 8MB (sẽ tự nén)'));

      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('Không đọc được file')); };
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          var maxW = 1600;
          var w = img.width, h = img.height;
          if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
          var canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          var dataUrl = canvas.toDataURL('image/jpeg', 0.82);
          var base64 = dataUrl.replace(/^data:[^;]+;base64,/, '');
          // ~ base64 size check ~3.5MB payload
          if (base64.length > 3.5 * 1024 * 1024) {
            dataUrl = canvas.toDataURL('image/jpeg', 0.65);
            base64 = dataUrl.replace(/^data:[^;]+;base64,/, '');
          }
          api('uploadImage', {
            fileName: (file.name || 'img').replace(/\.\w+$/, '') + '.jpg',
            mimeType: 'image/jpeg',
            base64: base64
          }).then(resolve).catch(reject);
        };
        img.onerror = function () { reject(new Error('File ảnh không hợp lệ')); };
        img.src = String(reader.result || '');
      };
      reader.readAsDataURL(file);
    });
  }

  function api(action, data) {
    var url = window.APP_CONFIG && window.APP_CONFIG.API_URL;
    if (!url || String(url).indexOf('YOUR-WORKER') >= 0) {
      return Promise.reject(new Error('Chưa cấu hình API_URL'));
    }
    return trackedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: action, data: Object.assign({}, data || {}, { token: state.token }) })
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j.ok) throw new Error(j.error || 'Lỗi API');
      return j.data;
    });
  }

  // Gọi API bằng token vừa xác thực lại; không thay đổi phiên đăng nhập hiện tại.
  function apiWithToken(action, data, token) {
    var url = window.APP_CONFIG && window.APP_CONFIG.API_URL;
    if (!url) return Promise.reject(new Error('Chưa cấu hình API_URL'));
    return trackedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: action, data: Object.assign({}, data || {}, { token: token }) })
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j.ok) throw new Error(j.error || 'Lỗi API');
      return j.data;
    });
  }

  // Hộp đăng nhập lại độc lập: bắt buộc nhập cả tài khoản và mật khẩu,
  // xác thực tại GAS, sau đó dùng token mới chỉ cho đúng thao tác nguy hiểm.
  // Đăng nhập lại bằng giao diện cùng kiểu với form đăng nhập ban đầu.
  // Token xác thực mới chỉ được dùng cho đúng thao tác nhạy cảm, không thay phiên hiện tại.
  function confirmAdminReauth(action, data, title, description) {
    return new Promise(function (resolve) {
      var old = document.getElementById('freshAuthDialog');
      if (old) old.remove();
      var wrap = document.createElement('div');
      wrap.id = 'freshAuthDialog';
      wrap.className = 'overlay reauth-overlay';
      wrap.style.zIndex = '20000';
      wrap.innerHTML =
        '<div class="overlay-bg" id="freshAuthBg"></div>' +
        '<div class="dialog reauth-dialog" role="dialog" aria-modal="true" aria-labelledby="freshAuthTitle">' +
          '<button type="button" class="x" id="freshAuthClose" aria-label="Đóng">×</button>' +
          '<div class="dialog-ico">🔐</div>' +
          '<p class="eyebrow">XÁC THỰC BẢO MẬT</p>' +
          '<h2 id="freshAuthTitle">' + esc(title || 'Đăng nhập lại') + '</h2>' +
          '<p class="dim">' + esc(description || 'Đăng nhập bằng tài khoản ADMIN để xác nhận thao tác.') + '</p>' +
          '<form id="freshAuthForm" autocomplete="off">' +
            '<label>Tên đăng nhập<input id="freshAuthUsername" name="username" autocomplete="username" required></label>' +
            '<label>Mật khẩu<input id="freshAuthPassword" name="password" type="password" autocomplete="current-password" required></label>' +
            '<p class="err" id="freshAuthError" role="alert"></p>' +
            '<button type="submit" class="btn btn-primary full" id="freshAuthSubmit">Đăng nhập xác nhận</button>' +
            '<button type="button" class="btn btn-outline full" id="freshAuthCancel">Đóng</button>' +
          '</form></div>';
      document.body.appendChild(wrap);
      var form = document.getElementById('freshAuthForm');
      var username = document.getElementById('freshAuthUsername');
      var password = document.getElementById('freshAuthPassword');
      var submit = document.getElementById('freshAuthSubmit');
      var error = document.getElementById('freshAuthError');
      var finished = false;
      function close(value) {
        if (finished) return;
        finished = true;
        wrap.remove();
        resolve(value);
      }
      document.getElementById('freshAuthCancel').onclick = function () { close(null); };
      document.getElementById('freshAuthClose').onclick = function () { close(null); };
      document.getElementById('freshAuthBg').onclick = function () { close(null); };
      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        error.textContent = '';
        submit.disabled = true;
        submit.textContent = 'Đang xác thực…';
        var loginUrl = window.APP_CONFIG && window.APP_CONFIG.API_URL;
        if (!loginUrl) {
          error.textContent = 'Chưa cấu hình địa chỉ API.';
          submit.disabled = false;
          submit.textContent = 'Đăng nhập và thực hiện';
          return;
        }
        trackedFetch(loginUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'login',
            data: { username: username.value.trim(), password: password.value }
          })
        }).then(function (r) { return r.json(); }).then(function (j) {
          if (!j.ok) throw new Error(j.error || 'Tên đăng nhập hoặc mật khẩu không đúng.');
          if (!j.data || !j.data.user || j.data.user.groupCode !== 'ADMIN') {
            throw new Error('Tài khoản vừa nhập không có quyền ADMIN.');
          }
          var freshToken = j.data.token;
          function revokeFreshToken() {
            return trackedFetch(loginUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'text/plain;charset=utf-8' },
              body: JSON.stringify({ action: 'logout', data: { token: freshToken } })
            }).catch(function () {});
          }
          return apiWithToken(action, data || {}, freshToken).then(function (result) {
            return revokeFreshToken().then(function () { return result; });
          }, function (actionError) {
            return revokeFreshToken().then(function () { throw actionError; });
          });
        }).then(function (result) {
          password.value = '';
          close(result);
        }).catch(function (err) {
          error.textContent = err.message || 'Không thể xác thực.';
          password.value = '';
          submit.disabled = false;
          submit.textContent = 'Đăng nhập và thực hiện';
          password.focus();
        });
      });
      setTimeout(function () { username.focus(); }, 50);
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


  function fixDriveUrl(u) {
    u = String(u || '').trim();
    if (!u) return u;
    var id = '';
    var m1 = u.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
    var m2 = u.match(/\/d\/([a-zA-Z0-9_-]{10,})/);
    var m3 = u.match(/\/file\/d\/([a-zA-Z0-9_-]{10,})/);
    var m4 = u.match(/thumbnail\?id=([a-zA-Z0-9_-]{10,})/);
    if (m1) id = m1[1];
    else if (m2) id = m2[1];
    else if (m3) id = m3[1];
    else if (m4) id = m4[1];
    else if (/^[a-zA-Z0-9_-]{25,}$/.test(u)) id = u;
    if (!id) return u;
    // googleusercontent ổn định hơn cho <img>
    return 'https://lh3.googleusercontent.com/d/' + id + '=w1600';
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
    applyLogo();

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
    });
    var notices = posts.filter(function (p) {
      var c = String(p.category || '').toLowerCase();
      return c.indexOf('thông báo') >= 0 || c.indexOf('thong bao') >= 0;
    });
    if (!news.length && posts.length) news = posts.slice(0);

    var maxApps = cfgNum('homeAppsLimit', 12);
    var maxGal = cfgNum('galleryCount', 4);
    var maxNews = cfgNum('homeNewsLimit', 6);
    var maxNotice = cfgNum('homeNoticeLimit', 5);

    var gallery = [];
    for (var gi = 1; gi <= 12; gi++) {
      if (cfg['gallery' + gi]) gallery.push(cfg['gallery' + gi]);
    }
    gallery = gallery.slice(0, maxGal);
    if (!gallery.length && cfg.bannerUrl) gallery = [cfg.bannerUrl];

    var appsShow = (state.apps || []).slice(0, maxApps);
    var appHtml = appsShow.length
      ? appsShow.map(function (a) {
          var letter = (a.title || 'A').charAt(0).toUpperCase();
          return '<a class="card hover-lift" href="' + esc(a.url) + '" target="_blank" rel="noopener">' +
            '<span class="badge-ico" style="background:' + color(a.title) + '">' + esc(letter) + '</span>' +
            '<span><b>' + esc(a.title) + '</b><small>' + esc(a.category || 'Ứng dụng') + '</small></span></a>';
        }).join('')
      : '';

    news = news.slice(0, maxNews);
    notices = notices.slice(0, maxNotice);

    var galleryHtml = gallery.length
      ? '<section class="sec"><div class="sec-h"><h2>Hình ảnh nhà trường</h2></div>' +
        '<div class="gallery">' + gallery.map(function (src) {
          return '<div class="gallery-item hover-zoom"><img src="' + esc(fixDriveUrl(src)) + '" alt="" loading="lazy"></div>';
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

    var parts = [];
    parts.push(
      '<section class="hero">' +
      (cfg.bannerUrl ? '<div class="hero-bg" style="background-image:url(' + esc(fixDriveUrl(cfg.bannerUrl)) + ')"></div>' : '') +
      '<div class="hero-content">' +
      '<div class="badge">Cổng thông tin công khai</div>' +
      '<h1>' + esc(cfg.welcomeTitle || cfg.schoolName || 'Cổng thông tin trường học') + '</h1>' +
      '<p>' + esc(cfg.welcomeText || intro) + '</p>' +
      '<div class="hero-actions">' +
      '<a class="btn btn-outline lg" href="#sec-news">Xem tin tức</a></div></div></section>'
    );

    // Các mục nội dung được sắp xếp theo số thứ tự do quản trị viên cấu hình.
    var homeSections = [];
    function addHomeSection(key, html) {
      var orderValue = Number(cfg['homeOrder' + key.charAt(0).toUpperCase() + key.slice(1)]);
      homeSections.push({ key: key, order: orderValue > 0 ? orderValue : ({
        intro: 1, apps: 2, gallery: 3, news: 4, notice: 5, contact: 6
      })[key], html: html });
    }
    if (cfgOn('showIntro', true)) {
      addHomeSection('intro',
        '<section class="sec" id="sec-intro"><div class="sec-h"><h2>Giới thiệu</h2></div>' +
        '<div class="panel intro-box"><p>' + esc(intro).replace(/\r?\n/g, '<br>') + '</p>' +
        (cfg.address || cfg.phone || cfg.email
          ? '<p class="dim" style="margin-top:12px">' +
            [cfg.address, cfg.phone && ('ĐT: ' + cfg.phone), cfg.email].filter(Boolean).join(' · ') + '</p>'
          : '') +
        '</div></section>'
      );
    }
    if (cfgOn('showApps', true) && appHtml) {
      addHomeSection('apps',
        '<section class="sec"><div class="sec-h"><h2>Ứng dụng thường dùng</h2></div><div class="grid">' + appHtml + '</div></section>'
      );
    }
    if (cfgOn('showGallery', true) && galleryHtml) addHomeSection('gallery', galleryHtml);
    if (cfgOn('showNews', true)) {
      addHomeSection('news',
        '<section class="sec" id="sec-news"><div class="sec-h"><h2>Tin mới nhất</h2></div>' + newsHtml + '</section>'
      );
    }
    if (cfgOn('showNotice', true)) {
      addHomeSection('notice',
        '<section class="sec" id="sec-notice"><div class="sec-h"><h2>Thông báo</h2></div>' +
        '<div class="panel">' + noticeHtml + '</div></section>'
      );
    }
    if (cfgOn('showContact', true)) {
      addHomeSection('contact',
        '<section class="sec" id="sec-contact"><div class="sec-h"><h2>Liên hệ</h2></div>' +
        '<div class="panel contact-grid">' +
        '<div><b>Đơn vị</b><p class="dim">' + esc(cfg.schoolName || '—') + '</p></div>' +
        '<div><b>Địa chỉ</b><p class="dim">' + esc(cfg.address || '—') + '</p></div>' +
        '<div><b>Điện thoại</b><p class="dim">' + esc(cfg.phone || '—') + '</p></div>' +
        '<div><b>Email</b><p class="dim">' + esc(cfg.email || '—') + '</p></div>' +
        '</div></section>'
      );
    }
    homeSections.sort(function (a, b) {
      return a.order - b.order || ['intro','apps','gallery','news','notice','contact'].indexOf(a.key) -
        ['intro','apps','gallery','news','notice','contact'].indexOf(b.key);
    });
    homeSections.forEach(function (section) { parts.push(section.html); });

    setHtml('#publicMain', parts.join(''));
    bindPostClicks('#publicMain');
    $$('#publicMain .notice-list [data-post]').forEach(function (li) {
      li.style.cursor = 'pointer';
      li.onclick = function () { openPublicPost(li.getAttribute('data-post')); };
    });
  }

  function openPublicPost(id) {
    function view(p) {
      if (!p) return toast('Không tìm thấy bài viết');
      var html = p.contentHtml || '';
      var imgs = [];
      var re = /src=["'](https?:[^"']+)["']/gi, mm;
      while ((mm = re.exec(html))) {
        if (imgs.indexOf(mm[1]) < 0) imgs.push(mm[1]);
      }
      if (p.thumbnailUrl && imgs.indexOf(p.thumbnailUrl) < 0) imgs.unshift(p.thumbnailUrl);
      // bỏ thẻ img trong body để tránh trùng, giữ text/video
      var body = html.replace(/<p class="media-img">[\s\S]*?<\/p>/gi, '').replace(/<img[^>]*>/gi, '');
      var gal = imgs.length
        ? '<div class="article-gallery">' + imgs.map(function (u) {
            var fu = fixDriveUrl(u); return '<a class="g-item" href="' + esc(fu) + '" target="_blank" rel="noopener"><img src="' + esc(fu) + '" alt="" loading="lazy" onerror="this.style.opacity=.3"></a>';
          }).join('') + '</div>'
        : '';
      var dt = (p.publishedAt || p.createdAt || '').toString().slice(0, 10);
      setHtml('#publicMain',
        '<article class="panel article">' +
        '<span class="tag">' + esc(p.category || 'Thông báo') + '</span>' +
        '<h1>' + esc(p.title) + '</h1>' +
        '<p class="dim">' + esc(p.summary || '') + (dt ? ' · ' + esc(dt) : '') + '</p>' +
        gal +
        '<div class="article-body">' + body + '</div>' +
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
    applyLogo();
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
    return '<button type="button" data-side="' + esc(id) + '"><span class="nav-ico">' + ico + '</span><span>' + esc(title) + '</span></button>';
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
    var loader = api('listAllPosts').catch(function () {
      return api('bootstrap').then(function (d) { apply(d, true); return state.posts || []; });
    });
    loader.then(function (posts) {
      if (!Array.isArray(posts)) posts = state.posts || [];
      state._allPosts = posts;
      function draw(filter, fromD, toD) {
        var q = (filter || '').toLowerCase().trim();
        fromD = fromD || '';
        toD = toD || '';
        var list = posts.filter(function (p) {
          var dt = (p.publishedAt || p.createdAt || p.updatedAt || '').toString().slice(0, 10);
          if (fromD && dt && dt < fromD) return false;
          if (toD && dt && dt > toD) return false;
          if (!q) return true;
          return (p.title + ' ' + p.category + ' ' + (p.summary || '')).toLowerCase().indexOf(q) >= 0;
        });
        var rows = list.map(function (p) {
          var dt = (p.publishedAt || p.createdAt || p.updatedAt || '').toString().slice(0, 10);
          return '<tr><td><b>' + esc(p.title) + '</b><div class="dim" style="font-size:11px">' +
            esc(p.category || '') + ' · ' + esc(p.status || '') + ' · ' + esc(dt || '—') + '</div></td>' +
            '<td class="actions"><span class="btn-group">' +
            '<button type="button" class="btn-sm" data-edit="' + esc(p.postId) + '">Sửa</button>' +
            '<button type="button" class="btn-sm btn-danger" data-del="' + esc(p.postId) + '">Xóa</button></span></td></tr>';
        }).join('');
        setHtml('#workMain',
          '<div class="panel"><div class="toolbar"><h3 style="margin:0">Bài viết</h3>' +
          '<button type="button" class="btn btn-primary" id="btnNewPost">+ Viết bài</button></div>' +
          '<div class="search-bar">' +
          '<input type="search" id="postSearch" placeholder="Tìm tiêu đề, danh mục…" value="' + esc(filter || '') + '">' +
          '<label class="dim">Từ <input type="date" id="dateFrom" value="' + esc(fromD) + '"></label>' +
          '<label class="dim">đến <input type="date" id="dateTo" value="' + esc(toD) + '"></label>' +
          '<button type="button" class="btn-sm" id="btnFilterDate">Lọc</button></div>' +
          (rows
            ? '<div class="table-wrap"><table class="table"><thead><tr><th>Bài (ngày)</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>'
            : '<div class="empty">Không có bài phù hợp.</div>') +
          '<p class="dim" style="margin-top:10px">Lọc theo từ khóa và khoảng ngày đăng.</p></div>');
        el('btnNewPost').onclick = function () { renderPostForm(null); };
        function rerun() {
          draw(
            (el('postSearch') && el('postSearch').value) || '',
            (el('dateFrom') && el('dateFrom').value) || '',
            (el('dateTo') && el('dateTo').value) || ''
          );
        }
        var se = el('postSearch');
        if (se) se.onkeydown = function (ev) { if (ev.key === 'Enter') rerun(); };
        var bf = el('btnFilterDate');
        if (bf) bf.onclick = rerun;

        $$('#workMain [data-edit]').forEach(function (b) {
          b.onclick = function () {
            var p = posts.find(function (x) { return x.postId === b.getAttribute('data-edit'); });
            renderPostForm(p || { postId: b.getAttribute('data-edit') });
          };
        });
        $$('#workMain [data-del]').forEach(function (b) {
          b.onclick = function () {
            if (!confirm('Xóa bài viết này vĩnh viễn?')) return;
            api('deletePost', { postId: b.getAttribute('data-del') })
              .then(function () { toast('Đã xóa'); renderPostsList(); })
              .catch(function (e) { toast(e.message); });
          };
        });
      }
      draw('');
    }).catch(function (e) {
      setHtml('#workMain', '<div class="panel"><p class="err">' + esc(e.message) + '</p></div>');
    });
  }

  function renderPostForm(post) {
    post = post || {};
    setText('#crumb', post.postId ? 'Sửa bài' : 'Viết bài mới');
    var today = new Date().toISOString().slice(0, 10);
    var extraImgs = [];
    try {
      if (post.contentHtml) {
        var re = /src=["'](https?:[^"']+)["']/g, mm;
        while ((mm = re.exec(post.contentHtml))) extraImgs.push(mm[1]);
      }
    } catch (e) {}

    setHtml('#workMain',
      '<div class="panel form-panel">' +
      '<h3>' + (post.postId ? 'Sửa bài viết' : 'Viết bài mới') + '</h3>' +
      '<form id="postForm" class="form form-post">' +
      '<input type="hidden" name="postId" value="' + esc(post.postId || '') + '">' +

      '<div class="form-section">' +
      '<div class="form-section-title">Thông tin bài</div>' +
      '<div class="form-grid-2">' +
      field('Tiêu đề', 'title', post.title) +
      field('Danh mục / Menu', 'category', post.category || categoryNames()[0], 'select-cat') +
      field('Tóm tắt', 'summary', post.summary) +
      field('Ngày đăng', 'publishedAt', (post.publishedAt || today).slice(0, 10), 'date') +
      '</div></div>' +

      '<div class="form-section">' +
      '<div class="form-section-title">Ảnh & media</div>' +
      '<div class="form-grid-2">' +
      field('Ảnh đại diện (URL)', 'thumbnailUrl', post.thumbnailUrl, 'url') +
      field('Video YouTube / .mp4 (URL)', 'videoUrl', '', 'url') +
      '</div>' +
      '<div class="img-block">' +
      '<div class="img-block-head"><b>Ảnh trong bài</b><span class="dim">Có thể thêm nhiều ảnh</span></div>' +
      '<div id="imgList" class="img-list"></div>' +
      '<div class="btn-group img-actions">' +
      '<button type="button" class="btn btn-outline" id="btnAddImgUrl">+ Thêm URL</button>' +
      '<label class="btn btn-outline file-btn">Upload file<input type="file" id="postImgFile" accept="image/*" hidden multiple></label>' +
      '<span class="dim" id="upMsg"></span></div></div></div>' +

      '<div class="form-section">' +
      '<div class="form-section-title">Nội dung</div>' +
      field('Nội dung bài viết', 'bodyText', stripHtml(post.contentHtml), 'textarea') +
      '</div>' +

      '<div class="form-section form-section-row">' +
      '<label class="field-inline">Trạng thái' +
      '<select name="status">' +
      '<option value="DRAFT">Nháp</option>' +
      '<option value="PUBLISHED"' + (post.status === 'PUBLISHED' ? ' selected' : '') + '>Công khai</option>' +
      '</select></label>' +
      '<label class="check-inline"><input type="checkbox" name="pinned" value="true"' +
      (post.pinned === true || String(post.pinned) === 'true' ? ' checked' : '') + '> Ghim bài</label>' +
      '</div>' +

      '<div class="form-footer">' +
      '<button class="btn btn-primary" type="submit">Lưu bài viết</button>' +
      '<button class="btn btn-outline" type="button" id="btnCancelPost">Hủy</button>' +
      '</div></form></div>');

    var imgUrls = extraImgs.slice();
    function renderImgList() {
      var box = el('imgList');
      if (!box) return;
      if (!imgUrls.length) {
        box.innerHTML = '<p class="dim empty-imgs">Chưa có ảnh trong bài.</p>';
        return;
      }
      box.innerHTML = imgUrls.map(function (u, i) {
        return '<div class="img-row">' +
          '<img src="' + esc(fixDriveUrl(u)) + '" alt="" onerror="this.style.opacity=.25">' +
          '<input type="text" value="' + esc(u) + '" data-i="' + i + '">' +
          '<button type="button" class="btn-sm btn-danger" data-rm="' + i + '">Xóa</button></div>';
      }).join('');
      $$('#imgList [data-rm]').forEach(function (b) {
        b.onclick = function () {
          imgUrls.splice(Number(b.getAttribute('data-rm')), 1);
          renderImgList();
        };
      });
      $$('#imgList input[data-i]').forEach(function (inp) {
        inp.onchange = function () { imgUrls[Number(inp.getAttribute('data-i'))] = inp.value.trim(); };
      });
    }
    renderImgList();

    el('btnAddImgUrl').onclick = function () {
      var u = prompt('Dán URL ảnh:');
      if (u) { imgUrls.push(u.trim()); renderImgList(); }
    };
    el('postImgFile').onchange = function () {
      var files = Array.prototype.slice.call(el('postImgFile').files || []);
      if (!files.length) return;
      setText('#upMsg', 'Đang tải ' + files.length + ' ảnh…');
      var chain = Promise.resolve();
      files.forEach(function (f) {
        chain = chain.then(function () {
          return uploadFileInput(f).then(function (res) {
            var url = fixDriveUrl(res.url || res.fileId || '');
            if (res.fileId && !res.url) url = fixDriveUrl(res.fileId);
            imgUrls.push(res.url || url);
            renderImgList();
          });
        });
      });
      chain.then(function () {
        setText('#upMsg', 'Upload xong');
        toast('Đã thêm ảnh');
        el('postImgFile').value = '';
      }).catch(function (err) {
        setText('#upMsg', err.message || 'Lỗi upload');
        toast(err.message || 'Lỗi upload (thử ảnh nhỏ hơn)');
      });
    };

    el('postForm').onsubmit = function (e) {
      e.preventDefault();
      var form = e.currentTarget;
      if (form.__saving) return;
      form.__saving = true;
      var saveBtn = e.submitter || form.querySelector('button[type="submit"]');
      var oldSaveText = saveBtn ? saveBtn.textContent : '';
      if (saveBtn) saveBtn.textContent = 'Đang lưu…';
      var fd = Object.fromEntries(new FormData(form));
      fd.pinned = !!(form.pinned && form.pinned.checked);
      $$('#imgList input[data-i]').forEach(function (inp) {
        imgUrls[Number(inp.getAttribute('data-i'))] = inp.value.trim();
      });
      imgUrls = imgUrls.filter(Boolean).map(fixDriveUrl);
      var mediaHtml = imgUrls.map(function (u) {
        return '<p class="media-img"><img src="' + esc(u) + '" alt=""></p>';
      }).join('');
      var body = buildContentHtml(fd.bodyText, '', fd.videoUrl);
      fd.contentHtml = mediaHtml + body;
      if (!fd.publishedAt) fd.publishedAt = today;
      if (/^\d{4}-\d{2}-\d{2}$/.test(fd.publishedAt)) fd.publishedAt = fd.publishedAt + 'T00:00:00.000Z';
      if (fd.thumbnailUrl) fd.thumbnailUrl = fixDriveUrl(fd.thumbnailUrl);
      if (!fd.postId) delete fd.postId;
      delete fd.bodyText; delete fd.videoUrl;
      api('savePost', fd).then(function () {
        toast('Đã lưu bài viết.');
        // Không gọi bootstrap lần nữa: tải lại đúng danh sách bài viết đã lưu.
        recentActionButton = null;
        renderPostsList();
      }).catch(function (err) {
        toast('Không lưu được bài viết: ' + (err.message || 'Lỗi không xác định'));
      }).finally(function () {
        form.__saving = false;
        if (saveBtn && saveBtn.isConnected) saveBtn.textContent = oldSaveText || 'Lưu bài viết';
      });
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
        return '<tr><td>' + esc(u.username) + '</td><td>' + esc(u.fullName) + '</td><td>' + esc(u.groupCode) + '</td><td>' + esc(u.status) + '</td>' +
          '<td class="actions">' +
          '<button type="button" class="btn-sm" data-edit="' + esc(u.userId) + '">Sửa</button> ' +
          (u.userId === 'U001' ? '' : '<button type="button" class="btn-sm btn-danger" data-del="' + esc(u.userId) + '">Xóa</button>') +
          '</td></tr>';
      }).join('');
      setHtml('#workMain',
        '<div class="panel"><h3>Tài khoản</h3>' +
        '<div class="table-wrap"><table class="table"><thead><tr><th>Username</th><th>Họ tên</th><th>Nhóm</th><th>TT</th><th></th></tr></thead><tbody>' +
        rows + '</tbody></table></div>' +
        '<h4 style="margin-top:16px">Thêm / cập nhật</h4><form class="form" id="userForm">' +
        '<input type="hidden" name="userId" id="editUserId" value="">' +
        field('Username', 'username') + field('Họ tên', 'fullName') +
        field('Mật khẩu (để trống nếu không đổi)', 'password', '', 'password') +
        field('Nhóm', 'groupCode', 'GV') +
        field('Trạng thái', 'status', 'ON', 'select-status') +
        '<label class="span2"><button class="btn btn-primary" type="submit">Lưu tài khoản</button></label></form></div>');
      el('userForm').onsubmit = function (e) {
        e.preventDefault();
        var d = Object.fromEntries(new FormData(e.target));
        if (!d.userId) delete d.userId;
        if (!d.password) delete d.password;
        api('saveUser', d).then(function () { toast('Đã lưu'); renderUsersCrud(); })
          .catch(function (err) { toast(err.message); });
      };
      $$('#workMain [data-edit]').forEach(function (b) {
        b.onclick = function () {
          var u = users.find(function (x) { return x.userId === b.getAttribute('data-edit'); });
          if (!u) return;
          el('editUserId').value = u.userId;
          var f = el('userForm');
          f.username.value = u.username || '';
          f.fullName.value = u.fullName || '';
          f.groupCode.value = u.groupCode || 'GV';
          f.status.value = u.status || 'ON';
          f.password.value = '';
          toast('Đang sửa: ' + u.username);
        };
      });
      $$('#workMain [data-del]').forEach(function (b) {
        b.onclick = function () {
          if (!confirm('Xóa tài khoản này?')) return;
          api('deleteUser', { userId: b.getAttribute('data-del') })
            .then(function () { toast('Đã xóa'); renderUsersCrud(); })
            .catch(function (e) { toast(e.message); });
        };
      });
    }).catch(function (e) {
      setHtml('#workMain', '<div class="panel"><p class="err">' + esc(e.message) + '</p></div>');
    });
  }

  function buildHomeSortItems(config) {
    var defs = [
      { key: 'Intro', label: 'Giới thiệu', fallback: 1 },
      { key: 'Apps', label: 'Ứng dụng thường dùng', fallback: 2 },
      { key: 'Gallery', label: 'Hình ảnh nhà trường', fallback: 3 },
      { key: 'News', label: 'Tin mới nhất', fallback: 4 },
      { key: 'Notice', label: 'Thông báo', fallback: 5 },
      { key: 'Contact', label: 'Liên hệ', fallback: 6 }
    ];
    defs.sort(function (a, b) {
      var av = Number(config['homeOrder' + a.key]) || a.fallback;
      var bv = Number(config['homeOrder' + b.key]) || b.fallback;
      return av - bv;
    });
    return defs.map(function (item, index) {
      return '<div class="home-sort-item" draggable="true" data-sort-key="' + item.key + '">' +
        '<span class="home-sort-grip" aria-label="Kéo để sắp xếp">☰</span>' +
        '<span class="home-sort-name">' + item.label + '</span>' +
        '<span class="home-sort-number">' + (index + 1) + '</span>' +
        '<input type="hidden" name="homeOrder' + item.key + '" value="' + (index + 1) + '">' +
      '</div>';
    }).join('');
  }

  function bindHomeSort() {
    var list = el('homeSortList');
    if (!list) return;
    var dragged = null;
    function renumber() {
      $$('.home-sort-item', list).forEach(function (item, index) {
        var number = $('.home-sort-number', item);
        var input = $('input[type=hidden]', item);
        if (number) number.textContent = String(index + 1);
        if (input) input.value = String(index + 1);
      });
    }
    list.addEventListener('dragstart', function (event) {
      var item = event.target.closest('.home-sort-item');
      if (!item) return;
      dragged = item;
      item.classList.add('is-dragging');
      if (event.dataTransfer) { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', item.dataset.sortKey); }
    });
    list.addEventListener('dragover', function (event) {
      event.preventDefault();
      var target = event.target.closest('.home-sort-item');
      if (!dragged || !target || target === dragged) return;
      var rect = target.getBoundingClientRect();
      var after = event.clientY > rect.top + rect.height / 2;
      list.insertBefore(dragged, after ? target.nextSibling : target);
    });
    list.addEventListener('drop', function (event) { event.preventDefault(); renumber(); });
    list.addEventListener('dragend', function () {
      if (dragged) dragged.classList.remove('is-dragging');
      dragged = null; renumber();
    });
    renumber();
  }

  function renderConfig() {
    if (!state.isAdmin) return toast('Chỉ quản trị');
    setText('#crumb', 'Cấu hình & ảnh');
    var c = state.config || {};
    var gCount = Number(c.galleryCount || 4) || 4;
    function chk(name, label, on) {
      return '<label class="switch-row"><input type="checkbox" name="' + name + '" value="true"' +
        (on ? ' checked' : '') + '> <span>' + label + '</span></label>';
    }
    var galFields = '';
    for (var i = 1; i <= Math.max(gCount, 4); i++) {
      galFields += field('Gallery ' + i + ' (URL)', 'gallery' + i, c['gallery' + i] || '', 'url');
    }
    setHtml('#workMain',
      '<div class="panel form-panel"><h3>Cấu hình cổng</h3><form id="cfgForm">' +
      '<div class="form-section"><div class="form-section-title">Thông tin & logo</div><div class="form-grid-2">' +
      field('Tên trường', 'schoolName', c.schoolName) +
      field('Logo (URL)', 'logoUrl', c.logoUrl, 'url') +
      field('Địa chỉ', 'address', c.address) +
      field('Điện thoại', 'phone', c.phone) +
      field('Email', 'email', c.email) +
      field('Tiêu đề hero', 'welcomeTitle', c.welcomeTitle) +
      '</div>' +
      '<div class="config-text-fields">' +
      '<div class="config-text-field"><label for="cfgWelcomeText">Mô tả ngắn trên trang chủ</label>' +
      '<p class="config-field-help">Nhập vài câu giới thiệu ngắn. Khung nhập được trình bày giống phần nhập nội dung bài viết.</p>' +
      '<textarea id="cfgWelcomeText" name="welcomeText" rows="6" placeholder="Nhập mô tả ngắn về nhà trường…">' + esc(c.welcomeText || '') + '</textarea></div>' +
      '<div class="config-text-field"><label for="cfgIntroHtml">Giới thiệu thêm</label>' +
      '<p class="config-field-help">Nhập nội dung giới thiệu chi tiết. Có thể xuống dòng, chia đoạn và chỉnh chiều cao khung nhập.</p>' +
      '<textarea id="cfgIntroHtml" name="introHtml" rows="10" placeholder="Nhập nội dung giới thiệu chi tiết về nhà trường…">' + esc(c.introHtml || '') + '</textarea></div>' +
      '</div></div>' +
      '<div class="form-section"><div class="form-section-title">Hiển thị trang chủ</div><div class="switch-grid">' +
      chk('showIntro', 'Giới thiệu', cfgOn('showIntro', true)) +
      chk('showApps', 'Ứng dụng thường dùng', cfgOn('showApps', true)) +
      chk('showGallery', 'Hình ảnh nhà trường', cfgOn('showGallery', true)) +
      chk('showNews', 'Tin mới nhất', cfgOn('showNews', true)) +
      chk('showNotice', 'Thông báo', cfgOn('showNotice', true)) +
      chk('showContact', 'Liên hệ', cfgOn('showContact', true)) +
      '</div></div>' +
      '<div class="form-section home-sort-section"><div class="form-section-title">Thứ tự hiển thị trang chủ</div>' +
      '<p class="config-field-help">Kéo biểu tượng ☰ để sắp xếp. Thứ tự mới sẽ được lưu cùng nút Lưu cấu hình.</p>' +
      '<div class="home-sort-list" id="homeSortList">' + buildHomeSortItems(c) + '</div></div>' +
      '<div class="form-section"><div class="form-section-title">Số lượng hiển thị</div><div class="form-grid-2">' +
      field('Số ứng dụng', 'homeAppsLimit', c.homeAppsLimit || '12', 'number') +
      field('Số ảnh gallery', 'galleryCount', String(gCount), 'number') +
      field('Số tin mới nhất', 'homeNewsLimit', c.homeNewsLimit || '6', 'number') +
      field('Số thông báo', 'homeNoticeLimit', c.homeNoticeLimit || '5', 'number') +
      field('Số tin API', 'homePostLimit', c.homePostLimit || '12', 'number') +
      field('ID thư mục Drive', 'driveFolderId', c.driveFolderId) +
      '</div></div>' +
      '<div class="form-section"><div class="form-section-title">Banner & gallery URL</div><div class="form-grid-2">' +
      field('Banner hero (URL)', 'bannerUrl', c.bannerUrl, 'url') + galFields +
      '</div><div class="btn-group" style="margin-top:10px">' +
      '<label class="btn btn-outline file-btn">Tải logo<input type="file" id="logoFile" accept="image/*" hidden></label>' +
      '<span class="dim" id="logoUpMsg"></span></div></div>' +
      '<div class="form-footer"><button class="btn btn-primary" type="submit">Lưu cấu hình</button></div></form>' +
      '<div class="danger-zone"><div class="form-section-title">Vùng nguy hiểm (cần admin đã đăng nhập)</div>' +
      '<p class="dim">Không hoàn tác.</p><div class="btn-group">' +
      '<button type="button" class="btn btn-danger-solid" id="btnDelPosts">Xóa tất cả bài đăng</button>' +
      '<button type="button" class="btn btn-danger-solid" id="btnDelConfig">Reset cấu hình</button>' +
      '<button type="button" class="btn btn-danger-solid" id="btnDelImages">Xóa ảnh Drive folder</button>' +
      '</div></div></div>');

    bindHomeSort();
    el('cfgForm').onsubmit = function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      var config = {};
      ['schoolName','logoUrl','address','phone','email','welcomeTitle','welcomeText','introHtml',
        'homeAppsLimit','galleryCount','homeNewsLimit','homeNoticeLimit','homePostLimit','driveFolderId','bannerUrl',
        'homeOrderIntro','homeOrderApps','homeOrderGallery','homeOrderNews','homeOrderNotice','homeOrderContact'
      ].forEach(function (k) { if (fd.has(k)) config[k] = fd.get(k); });
      for (var i = 1; i <= 12; i++) if (fd.has('gallery' + i)) config['gallery' + i] = fd.get('gallery' + i);
      ['showIntro','showApps','showGallery','showNews','showNotice','showContact'].forEach(function (k) {
        config[k] = fd.get(k) ? 'true' : 'false';
      });
      api('saveConfig', { config: config }).then(function () {
        state.config = Object.assign({}, state.config, config);
        applyLogo(); paintSide(); toast('Đã lưu cấu hình');
      }).catch(function (err) { toast(err.message); });
    };
    var lf = el('logoFile');
    if (lf) lf.onchange = function () {
      var f = lf.files && lf.files[0]; if (!f) return;
      setText('#logoUpMsg', 'Đang tải…');
      uploadFileInput(f).then(function (res) {
        var input = document.querySelector('#cfgForm input[name="logoUrl"]');
        if (input) input.value = res.url;
        state.config.logoUrl = res.url; applyLogo();
        setText('#logoUpMsg', 'OK — bấm Lưu cấu hình');
      }).catch(function (err) { setText('#logoUpMsg', err.message); });
    };
    // Mỗi thao tác nguy hiểm mở thẳng form đăng nhập xác nhận; không dùng alert/confirm trung gian.
    el('btnDelPosts').onclick = function () {
      confirmAdminReauth('deleteAllPosts', {}, 'Xác nhận xóa tất cả bài đăng', 'Đăng nhập bằng tài khoản ADMIN để xác nhận thao tác này.')
        .then(function (r) {
          if (!r) return;
          toast('Đã xóa ' + (r.deleted || 0) + ' bài đăng.');
          return api('bootstrap').then(function (d) { apply(d, true); renderConfig(); });
        }).catch(function (e) { toast(e.message); });
    };
    el('btnDelConfig').onclick = function () {
      confirmAdminReauth('resetConfig', {}, 'Xác nhận khôi phục cấu hình', 'Đăng nhập bằng tài khoản ADMIN để xác nhận khôi phục cấu hình mặc định.')
        .then(function (r) {
          if (!r) return;
          toast('Đã khôi phục cấu hình mặc định.');
          return api('bootstrap').then(function (d) { apply(d, true); renderConfig(); });
        }).catch(function (e) { toast(e.message); });
    };
    el('btnDelImages').onclick = function () {
      confirmAdminReauth('deleteAllDriveImages', {}, 'Xác nhận xóa ảnh Drive', 'Đăng nhập bằng tài khoản ADMIN để xác nhận. Tệp sẽ được chuyển vào thùng rác Google Drive.')
        .then(function (r) {
          if (!r) return;
          toast('Đã chuyển ' + (r.deleted || 0) + ' tệp vào thùng rác.');
        }).catch(function (e) { toast(e.message); });
    };
  }

  function openLogin() {
    show('#overlay'); setText('#loginErr', '');
    setTimeout(function () { var u = el('username'); if (u) u.focus(); }, 20);
  }
  function closeLogin() { hide('#overlay'); }

  function onLogin(e) {
    e.preventDefault();
    setText('#loginErr', '');
    var btn = el('loginBtn');
    var oldText = btn ? btn.textContent : 'Đăng nhập';
    if (btn) btn.textContent = 'Đang đăng nhập…';
    var issuedToken = '';
    api('login', {
      username: ((el('username') && el('username').value) || '').trim(),
      password: (el('password') && el('password').value) || ''
    }).then(function (d) {
      issuedToken = d.token || '';
      if (!issuedToken) throw new Error('Máy chủ không trả về phiên đăng nhập.');
      state.token = issuedToken;
      sessionStorage.setItem('school_token', issuedToken);
      state.user = d.user;
      // Chỉ đóng form sau khi dữ liệu quản trị tải thành công.
      return api('bootstrap');
    }).then(function (boot) {
      apply(boot, true);
      closeLogin();
      showWork();
      toast('Đăng nhập thành công');
    }).catch(function (err) {
      if (issuedToken) {
        // Thu hồi phiên vừa cấp nếu bước bootstrap thất bại.
        api('logout').catch(function () {});
        sessionStorage.removeItem('school_token');
        state.token = ''; state.user = null; state.isAdmin = false;
      }
      setText('#loginErr', err.message || 'Đăng nhập không thành công.');
      if (el('password')) el('password').value = '';
    }).finally(function () {
      if (btn) btn.textContent = oldText || 'Đăng nhập';
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
