const input=document.getElementById('search'), results=document.getElementById('results');
let entries=[];fetch('/search.json').then(r=>r.json()).then(data=>entries=data).catch(()=>{});
input?.addEventListener('input',()=>{const q=input.value.trim().toLowerCase();results.replaceChildren();if(!q)return;entries.filter(p=>(p.title+' '+p.text).toLowerCase().includes(q)).slice(0,12).forEach(p=>{const a=document.createElement('a');a.href='/notes/'+encodeURIComponent(p.slug)+'/';a.textContent=p.title;results.append(a)})});
