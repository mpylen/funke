(function(){
  var m=document.getElementById('m'), code=location.pathname.split('/').pop();
  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  fetch('/api/w/'+encodeURIComponent(code)).then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j.error||'Fehler');return j})}).then(function(u){
    m.innerHTML='<div class="eyebrow">Funke</div><h1>Wie ist '+esc(u.name)+'?</h1><p class="muted">'+esc(u.name)+' sucht jemanden zum Verlieben und hat dich als Wingman eingeladen. Schreib in 1–2 Sätzen, was '+esc(u.name)+' besonders macht. Du brauchst kein Konto. Dein Text wird erst gezeigt, wenn '+esc(u.name)+' ihn freigibt. Links werden entfernt.</p>'+
    '<label class="field">Dein Vorname<input id="n" maxlength="30" autocomplete="given-name"></label>'+
    '<label class="field">Dein Satz<textarea id="t" rows="4" maxlength="200" placeholder="z. B. Bringt jeden zum Lachen und vergisst nie einen Geburtstag."></textarea></label>'+
    '<p class="err" id="e" role="alert"></p><button class="btn fire w" id="s">Absenden</button>'+
    '<p class="small muted">Mit dem Absenden erlaubst du, dass dein Vorname und Satz in '+esc(u.name)+'s Funke-Profil erscheinen können. <a href="/legal/datenschutz.html">Datenschutz</a></p>';
    document.getElementById('s').onclick=function(){
      var b=this;b.disabled=true;
      fetch('/api/w/'+encodeURIComponent(code),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:document.getElementById('n').value,text:document.getElementById('t').value})})
      .then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j.error||'Fehler');return j})})
      .then(function(){m.innerHTML='<div class="eyebrow">Danke</div><h1>Das hat '+esc(u.name)+' sicher gefreut.</h1><p class="muted">Dein Satz wartet jetzt auf die Freigabe.</p>'})
      .catch(function(e){document.getElementById('e').textContent=e.message;b.disabled=false});
    };
  }).catch(function(e){m.innerHTML='<h1>Hm.</h1><p class="muted">'+esc(e.message)+'</p>'});
})();
