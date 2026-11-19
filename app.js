const $ = s => document.querySelector(s);
const state = {token:sessionStorage.getItem('school_token')||'',user:null,config:{},menus:[],apps:[],posts:[],isAdmin:false};
const ICONS={house:'⌂',newspaper:'▤',users:'♙',book:'▣',folder:'▱',chart:'▥',settings:'⚙',link:'↗',grid:'▦',shield:'◆',building:'⌂'};
function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2600)}
async function api(action,data={}) {
  if(!window.APP_CONFIG?.API_URL || window.APP_CONFIG.API_URL.includes('YOUR-WORKER')) throw new Error('Chưa cấu hình API_URL trong config.js.');
  const r=await fetch(window.APP_CONFIG.API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,data:{...data,token:state.token}})});
  const j=await r.json();if(!j.ok)throw new Error(j.error||'Lỗi API');return j.data;
}
function showLogin(){ $('#loginView').classList.remove('hidden');$('#appView').classList.add('hidden'); }
function showApp(){ $('#loginView').classList.add('hidden');$('#appView').classList.remove('hidden'); }
async function login(e){e.preventDefault();$('#loginError').textContent='';try{const d=await api('login',{username:$('#username').value,password:$('#password').value});state.token=d.token;sessionStorage.setItem('school_token',d.token);await loadApp();}catch(err){$('#loginError').textContent=err.message;}}
async function loadApp(){try{const d=await api('bootstrap');Object.assign(state,d);showApp();renderShell();renderHome();}catch(e){sessionStorage.removeItem('school_token');state.token='';showLogin();if(e.message)$('#loginError').textContent=e.message;}}
function renderShell(){
  document.title=state.config.schoolName||'Cổng thông tin trường học';
  $('#sideSchoolName').textContent=state.config.schoolName||'Cổng thông tin trường học';
  $('#userName').textContent=state.user.fullName;$('#userRole').textContent=state.user.groupCode;
  $('#avatar').textContent=(state.user.fullName||'U').trim().charAt(0).toUpperCase();
  const nav=[{menuId:'HOME',title:'Trang chủ',icon:'house',location:'SIDEBAR',url:'#home'}].concat(state.menus.filter(m=>m.location!=='HOME'));
  $('#menuList').innerHTML=nav.sort((a,b)=>Number(a.sortOrder||0)-Number(b.sortOrder||0)).map(m=>`<button class="nav-item" data-menu="${esc(m.menuId)}"><span class="nav-icon">${esc(ICONS[m.icon]||m.icon||'↗')}</span>${esc(m.title)}</button>`).join('')+(state.isAdmin?'<button class="nav-item" data-menu="ADMIN"><span class="nav-icon">⚙</span>Quản trị hệ thống</button>':'');
  $('#menuList').querySelectorAll('[data-menu]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.menu)));
  $('#footer').textContent=[state.config.address,state.config.phone?'Điện thoại: '+state.config.phone:''].filter(Boolean).join(' · ');
}
function navigate(id){$('#sidebar').classList.remove('open');if(id==='HOME'){renderHome();return}if(id==='ADMIN'){renderAdmin();return}const m=state.menus.find(x=>x.menuId===id);if(!m)return;if(m.menuType==='LINK'&&m.url){window.open(m.url,m.openMode==='SAME'?'_self':'_blank','noopener');return}renderPage(m.title,`<div class="empty">Menu này đã được cấu hình. Nội dung trang nội bộ sẽ được bổ sung theo nghiệp vụ.</div>`);}
function renderHome(){
  $('#breadcrumb').textContent='Trang chủ';
  const appCards=state.apps.map(a=>`<a class="app-card" href="${escAttr(a.url)}" target="${a.openMode==='SAME'?'_self':'_blank'}" rel="noopener"><img class="app-icon" src="${escAttr(a.iconUrl||favicon(a.url))}" onerror="this.src='';this.style.visibility='hidden'"><span><b>${esc(a.title)}</b><small>${esc(a.category||'Ứng dụng')}</small></span></a>`).join('');
  const postCards=state.posts.map(p=>`<article class="post-card"><img src="${escAttr(p.thumbnailUrl||'')}" onerror="this.style.display='none'"><div class="post-body"><span class="tag">${esc(p.category||'Thông báo')}</span><h3>${esc(p.title)}</h3><p>${esc(p.summary||'')}</p><button class="btn ghost" data-post="${esc(p.postId)}">Đọc tiếp →</button></div></article>`).join('');
  $('#pageContent').innerHTML=`<section class="hero"><span class="tag">CỔNG THÔNG TIN NỘI BỘ</span><h1>${esc(state.config.welcomeTitle||state.config.schoolName||'Cổng thông tin trường học')}</h1><p>${esc(state.config.welcomeText||'Không gian thông tin và tiện ích làm việc của nhà trường.')}</p></section>
  <div class="section-head"><div><h2>Ứng dụng thường dùng</h2><p>Truy cập nhanh các nền tảng làm việc</p></div></div>
  <div class="grid">${appCards||'<div class="empty">Chưa có ứng dụng. Admin có thể thêm trong Quản trị hệ thống.</div>'}</div>
  <div class="section-head"><div><h2>Tin tức & thông báo</h2><p>Cập nhật mới từ nhà trường</p></div><button class="btn ghost" id="allPosts">Xem tất cả →</button></div>
  <div class="post-grid">${postCards||'<div class="empty">Chưa có bài viết được đăng.</div>'}</div>`;
  $('#pageContent').querySelectorAll('[data-post]').forEach(b=>b.onclick=()=>openPost(b.dataset.post));
  $('#allPosts').onclick=()=>renderPosts();
}
function renderPage(title,html){$('#breadcrumb').textContent=title;$('#pageContent').innerHTML=`<div class="section-head"><h2>${esc(title)}</h2></div>${html}`;}
async function renderPosts(){try{const posts=await api('listPosts');renderPage('Tin tức & thông báo',`<div class="post-grid">${posts.map(p=>`<article class="post-card"><img src="${escAttr(p.thumbnailUrl||'')}" onerror="this.style.display='none'"><div class="post-body"><span class="tag">${esc(p.category)}</span><h3>${esc(p.title)}</h3><p>${esc(p.summary)}</p><button class="btn ghost" data-post="${esc(p.postId)}">Đọc tiếp →</button></div></article>`).join('')}</div>`);$('#pageContent').querySelectorAll('[data-post]').forEach(b=>b.onclick=()=>openPost(b.dataset.post));}catch(e){toast(e.message)}}
async function openPost(id){try{const p=await api('getPost',{postId:id});renderPage('Chi tiết bài viết',`<article class="article"><span class="tag">${esc(p.category)}</span><h1>${esc(p.title)}</h1><p class="muted">${esc(p.authorName||'Nhà trường')} · ${esc(p.publishedAt||'')}</p>${p.thumbnailUrl?`<img src="${escAttr(p.thumbnailUrl)}" style="max-width:100%;border-radius:12px">`:''}<div class="article-content">${p.contentHtml||''}</div><button class="btn ghost" id="backPosts">← Quay lại</button></article>`);$('#backPosts').onclick=renderPosts;}catch(e){toast(e.message)}}
async function renderAdmin(){
  $('#breadcrumb').textContent='Quản trị hệ thống';
  $('#pageContent').innerHTML=`<div class="section-head"><div><h2>Quản trị hệ thống</h2><p>Quản lý cấu hình cổng thông tin</p></div></div><div class="grid">
  ${adminCard('Thông tin đơn vị','Cập nhật tên trường, địa chỉ, điện thoại','config')}
  ${adminCard('Quản lý tài khoản','Tạo tài khoản và phân nhóm','users')}
  ${adminCard('Cấu hình menu','Thêm menu và liên kết','menus')}
  ${adminCard('Ứng dụng thường dùng','Thêm link, tên và biểu tượng','apps')}
  ${adminCard('Bài viết & thông báo','Đăng nội dung và hình ảnh','posts')}
  </div><div id="adminPanel" style="margin-top:20px"></div>`;
  $('#pageContent').querySelectorAll('[data-admin]').forEach(b=>b.onclick=()=>adminSection(b.dataset.admin));
}
function adminCard(title,desc,key){return `<button class="app-card" data-admin="${key}" style="text-align:left"><span class="app-icon">⚙</span><span><b>${title}</b><small>${desc}</small></span></button>`}
async function adminSection(key){
 const panel=$('#adminPanel');
 if(key==='config'){panel.innerHTML=`<div class="panel"><h2>Thông tin đơn vị</h2><form id="configForm" class="form-grid">${field('Tên đơn vị','schoolName',state.config.schoolName)}${field('Địa chỉ','address',state.config.address)}${field('Số điện thoại','phone',state.config.phone)}${field('Email','email',state.config.email)}${field('Logo URL','logoUrl',state.config.logoUrl)}${field('Tiêu đề trang chủ','welcomeTitle',state.config.welcomeTitle)}${field('Giới thiệu','welcomeText',state.config.welcomeText,'textarea')}<div class="field full-row"><button class="btn primary">Lưu cấu hình</button></div></form></div>`;$('#configForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),c={};for(const [k,v] of f)c[k]=v;try{await api('saveConfig',{config:c});Object.assign(state.config,c);renderShell();toast('Đã lưu cấu hình');}catch(x){toast(x.message)}};}
 if(key==='users'){panel.innerHTML=`<div class="panel"><h2>Tạo tài khoản người dùng</h2><form id="userForm" class="form-grid">${field('Tên đăng nhập','username')}${field('Họ và tên','fullName')}${field('Mật khẩu (tối thiểu 10 ký tự)','password','', 'password')}<div class="field"><label>Nhóm</label><select name="groupCode"><option>GV</option><option>BGH</option><option>VP</option><option>ADMIN</option></select></div><div class="field full-row"><button class="btn primary">Tạo tài khoản</button></div></form></div><button class="btn ghost" id="loadUsers">Tải danh sách tài khoản</button><div id="usersTable"></div>`;$('#userForm').onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));try{await api('saveUser',d);toast('Đã tạo tài khoản');e.target.reset()}catch(x){toast(x.message)}};$('#loadUsers').onclick=async()=>{try{const u=await api('listUsers');$('#usersTable').innerHTML=table(['Tài khoản','Họ tên','Nhóm','Trạng thái'],u.map(x=>[x.username,x.fullName,x.groupCode,x.status]));}catch(x){toast(x.message)}};}
 if(key==='menus'){panel.innerHTML=`<div class="panel"><h2>Thêm menu</h2><form id="menuForm" class="form-grid">${field('Tên menu','title')}${field('Đường dẫn URL','url')}${field('Icon (tên icon hoặc ký tự)','icon','link')}${field('Thứ tự','sortOrder','10','number')}<div class="field"><label>Loại menu</label><select name="menuType"><option>LINK</option><option>PAGE</option></select></div><div class="field"><label>Vị trí</label><select name="location"><option>SIDEBAR</option><option>HOME</option></select></div><div class="field"><label>Mở liên kết</label><select name="openMode"><option>NEW</option><option>SAME</option></select></div><div class="field full-row"><button class="btn primary">Lưu menu</button></div></form></div>`;$('#menuForm').onsubmit=async e=>{e.preventDefault();try{await api('saveMenu',Object.fromEntries(new FormData(e.target)));toast('Đã lưu menu. Tải lại trang để cập nhật.')}catch(x){toast(x.message)}};}
 if(key==='apps'){panel.innerHTML=`<div class="panel"><h2>Thêm ứng dụng thường dùng</h2><form id="appForm" class="form-grid">${field('Tên ứng dụng','title')}${field('Đường dẫn phần mềm','url')}${field('Đường dẫn icon (để trống sẽ tự lấy favicon)','iconUrl')}${field('Nhóm ứng dụng','category','Chung')}${field('Thứ tự','sortOrder','10','number')}<div class="field full-row"><button class="btn primary">Lưu ứng dụng</button></div></form><p class="muted">Icon mặc định được lấy từ favicon theo tên miền. Có thể nhập URL icon riêng nếu website không cung cấp favicon phù hợp.</p></div>`;$('#appForm').onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));if(!d.iconUrl)d.iconUrl=favicon(d.url);try{await api('saveApp',d);toast('Đã lưu ứng dụng. Tải lại trang để cập nhật.')}catch(x){toast(x.message)}};}
 if(key==='posts'){panel.innerHTML=`<div class="panel"><h2>Đăng bài viết / thông báo</h2><form id="postForm" class="form-grid">${field('Tiêu đề','title')}${field('Danh mục','category','Thông báo')}${field('Tóm tắt','summary','')}${field('Ảnh đại diện URL','thumbnailUrl','')}${field('Nội dung HTML','contentHtml','','textarea')}<div class="field"><label>Trạng thái</label><select name="status"><option value="DRAFT">Lưu nháp</option><option value="PUBLISHED">Đăng bài</option></select></div><div class="field"><label><input type="checkbox" name="pinned" value="true"> Ghim bài viết</label></div><div class="field full-row"><button class="btn primary">Lưu bài viết</button></div></form><p class="muted">Bản đầu tiên nhận ảnh qua URL. Tích hợp tải ảnh trực tiếp lên Drive là bước kế tiếp, cần bổ sung luồng cấp quyền tải tệp an toàn.</p></div>`;$('#postForm').onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));d.pinned=!!e.target.pinned.checked;try{await api('savePost',d);toast('Đã lưu bài viết');e.target.reset()}catch(x){toast(x.message)}};}
}
function field(label,name,value='',type='text'){return `<label class="field ${type==='textarea'?'full-row':''}">${label}${type==='textarea'?`<textarea name="${name}">${esc(value||'')}</textarea>`:`<input name="${name}" type="${type}" value="${escAttr(value||'')}">`}</label>`}
function table(headers,rows){return `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`}
function favicon(url){try{return 'https://www.google.com/s2/favicons?domain='+encodeURIComponent(new URL(url).hostname)+'&sz=128'}catch(e){return ''}}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function escAttr(s){return esc(s).replace(/`/g,'&#96;')}
$('#loginForm').addEventListener('submit',login);
$('#logoutBtn').onclick=async()=>{try{await api('logout')}catch(e){}sessionStorage.removeItem('school_token');state.token='';showLogin()};
$('#menuToggle').onclick=()=>$('#sidebar').classList.toggle('open');
if(state.token)loadApp();else showLogin();
