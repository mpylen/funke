(function(){
  var m=document.getElementById('m'), tok=''; try{tok=sessionStorage.getItem('ft')||''}catch(e){}
  function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function api(method,path,body){return fetch(path,{method:method,headers:{'Authorization':'Bearer '+tok,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined}).then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j.error||r.status);return j})})}
  function login(){m.innerHTML='<h1>Admin</h1><label class="field">Token<input id="t" type="password" autocomplete="off"></label><p class="err" id="e"></p><button class="btn fire w" id="b">Anmelden</button>';
    document.getElementById('b').onclick=function(){tok=document.getElementById('t').value;api('GET','/api/admin/stats').then(function(){try{sessionStorage.setItem('ft',tok)}catch(e){}load()}).catch(function(){document.getElementById('e').textContent='Token falsch.'})}}
  function load(){Promise.all([api('GET','/api/admin/stats'),api('GET','/api/admin/pending'),api('GET','/api/admin/reports')]).then(function(r){render(r[0],r[1],r[2])}).catch(login)}
  function render(s,p,rep){
    var h='<h1>Funke Admin</h1><h2>Kennzahlen</h2><pre class="small">'+esc(JSON.stringify(s,null,2))+'</pre><h2>Selfie-Prüfung ('+p.length+')</h2>';
    p.forEach(function(u){h+='<div class="card"><b>'+esc(u.name)+', '+esc(u.age)+'</b> <span class="muted">#'+u.id+'</span><div class="row">'+
      (u.selfie?'<img src="/photo/'+u.selfie+'" alt="Selfie" width="120"> ':'<span class="muted">kein Selfie</span> ')+u.photos.map(function(i){return'<img src="/photo/'+i+'" alt="Foto" width="120"> '}).join('')+
      '</div><p class="small muted">Prüfen: Zeigt das Selfie dieselbe Person wie die Fotos und die geforderte Geste?</p><button class="btn fire" data-v="1" data-id="'+u.id+'">Freigeben</button> <button class="btn" data-v="0" data-id="'+u.id+'">Ablehnen</button></div>'});
    h+='<h2>Offene Meldungen ('+rep.length+')</h2>';
    rep.forEach(function(r){h+='<div class="card"><b>#'+r.id+'</b> gegen '+esc(r.tname)+' (#'+r.target+')'+(r.tbanned?' <i>gesperrt</i>':'')+'<p>'+esc(r.reason)+' '+esc(r.text||'')+'</p><button class="btn" data-ban="'+r.target+'">Sperren</button> <button class="btn" data-done="'+r.id+'">Erledigt</button></div>'});
    m.innerHTML=h;
  }
  m.addEventListener('click',function(e){var t=e.target;if(!t.dataset)return;var p;
    if(t.dataset.v!==undefined)p=api('POST','/api/admin/verify/'+t.dataset.id,{ok:t.dataset.v==='1'});
    else if(t.dataset.ban)p=api('POST','/api/admin/ban/'+t.dataset.ban,{});
    else if(t.dataset.done)p=api('POST','/api/admin/report/'+t.dataset.done,{});
    if(p)p.then(load)});
  tok?load():login();
})();
