(function(){
  const { jsPDF } = window.jspdf || {};
  const SETS = window.STANDARDS_SETS || {};
  const $ = id => document.getElementById(id);
  const F = id => ($(id) ? $(id).value : '');
  const Ck = id => !!($(id) && $(id).checked);
  const S = (id, v) => { if($(id)) $(id).value = v; };
  const Ch = (id, b) => { if($(id)) $(id).checked = !!b; };

  function escapeXML(s){ return s.replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&apos;'}[ch])); }
  function genLogoDataURL(company){
    const text = (company||'Your Company').slice(0,28);
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='380' height='80' viewBox='0 0 380 80'>
      <rect width='380' height='80' fill='white'/>
      <g fill='none' stroke='#999' stroke-width='2'><rect x='6' y='6' rx='10' width='68' height='68'/><path d='M20 40h40M40 20v40'/></g>
      <text x='86' y='50' font-family='Inter,Arial,Helvetica,sans-serif' font-size='24' font-weight='700' fill='#333'>${escapeXML(text)}</text>
    </svg>`;
    return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
  }
  function dataURLToBytes(dataURL){ const base64 = dataURL.split(',')[1] || ''; const bin = atob(base64); const bytes = new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i); return bytes; }
  function imgFromDataURL(dataURL){ return new Promise((resolve,reject)=>{ const img=new Image(); img.onload=()=>resolve(img); img.onerror=reject; img.src=dataURL; }); }
  async function ensurePNG(dataURL){
    if(dataURL.startsWith('data:image/png')) return dataURL;
    const img = await imgFromDataURL(dataURL);
    const cv = document.createElement('canvas'); cv.width = img.naturalWidth||380; cv.height = img.naturalHeight||80;
    const cx = cv.getContext('2d'); cx.fillStyle = '#ffffff'; cx.fillRect(0,0,cv.width,cv.height); cx.drawImage(img,0,0);
    return cv.toDataURL('image/png');
  }

  let LOGO_DATAURL = localStorage.getItem('logoDataURL') || '';
  let LOGO_SCALE = parseFloat(localStorage.getItem('logoScale')||'1') || 1;

  function setLogoDataURL(url){ LOGO_DATAURL = url; localStorage.setItem('logoDataURL', url||''); updateLogoPreview(); }
  function setLogoScale(v){ LOGO_SCALE = Math.max(0.6, Math.min(1.6, parseFloat(v)||1)); localStorage.setItem('logoScale', String(LOGO_SCALE)); updateLogoPreview(); }
  function updateLogoPreview(){
    const prev = $('prevLogo'); const use = Ck('useLogo');
    if(!prev) return;
    prev.style.display = use ? 'inline-block' : 'none';
    prev.src = (LOGO_DATAURL || genLogoDataURL(F('company')));
    prev.style.height = (22 * LOGO_SCALE) + 'px';
  }

  function refreshStandards(){
    const sel = $('standard'), wrap = $('standardWrapper');
    const g = F('grade'), subj = F('subject');
    const cat = SETS['common'] || {};
    const pool = (cat[subj] || {})[g] || (cat[subj] || {})['6-8'] || [];
    sel.innerHTML = '<option value=\"\">Choose a standard</option>';
    pool.forEach(o => { const op = document.createElement('option'); op.value = o.code; op.textContent = `${o.code} — ${o.label}`; sel.appendChild(op); });
    wrap.style.display = pool.length ? 'flex' : 'none';
  }

  const SUB = { ELA:{study_guide:['Key terms & structures for {topic}.'],guided_notes:['{topic} is mainly about ______.'],practice:['Write a two-sentence summary about {topic}.']},
    Math:{study_guide:['Formulas for {topic}.'],guided_notes:['Problem: ______ Steps: ______'],practice:['Solve a {topic} problem and show work.']},
    Science:{study_guide:['Processes & variables for {topic}.'],guided_notes:['{topic} involves ______.'],practice:['Design a simple investigation on {topic}.']},
    'Social Studies':{study_guide:['People/places/events for {topic}.'],guided_notes:['{topic} occurred ______.'],practice:['Use two sources about {topic}.']},
    Other:{study_guide:['Essential questions: {topic}.'],guided_notes:['Notes: ______.'],practice:['Explain why {topic} matters.']}
  };
  function byDiff(items, d){ if(!items||!items.length) return []; if(d<=2) return items.slice(0,Math.max(1,Math.ceil(items.length*0.6))); if(d>=5) return items.concat(['Extend: change one condition about {topic} and explain.']); return items; }
  function stems(subj,type,topic,d){ const pack=SUB[subj]||SUB.Other; return byDiff((pack[type]||[]).map(s=>s.replaceAll('{topic}',topic)), d); }
  function qtypes(){ return {auto:$('qtypeAuto')?.checked, sr:$('qtypeSR')?.checked, mc:$('qtypeMC')?.checked, org:$('qtypeOrganizer')?.checked, cloze:$('qtypeCloze')?.checked, cornell:$('qtypeCornell')?.checked}; }
  function interleave(prompts,q){ if(q.auto){ const order=[]; if(q.sr!==false)order.push('sr'); if(q.mc!==false)order.push('mc'); if(q.org!==false)order.push('org'); if(q.cloze!==false)order.push('cloze'); if(!order.length)order.push('sr'); return prompts.map((p,i)=>({kind:order[i%order.length],text:p})); } const kinds=[]; if(q.sr)kinds.push('sr'); if(q.mc)kinds.push('mc'); if(q.org)kinds.push('org'); if(q.cloze)kinds.push('cloze'); if(!kinds.length)kinds.push('sr'); return prompts.map((p,i)=>({kind:kinds[i%kinds.length],text:p})); }

  window.MC_KEY_MAP = JSON.parse(localStorage.getItem('mcKeyMap')||'{}');
  function setKey(n, letter){ if(letter){ MC_KEY_MAP[n]=String(letter).toUpperCase(); } else { delete MC_KEY_MAP[n]; } localStorage.setItem('mcKeyMap', JSON.stringify(MC_KEY_MAP)); }
  function getKey(n){ const v = MC_KEY_MAP[n]; return (v && /[ABCD]/i.test(v)) ? v.toUpperCase() : ''; }
  function clearKeys(){ window.MC_KEY_MAP={}; localStorage.removeItem('mcKeyMap'); }
  function keyPattern(i){ const pat = (F('mcKeyPattern')||'').toUpperCase().replace(/[^ABCD]/g,''); if(pat) return pat[i % pat.length]; return ['A','B','C','D'][i%4]; }
  function keyFor(n,i){ return getKey(n)||keyPattern(i); }

  function seq(){ const subj = F('subject')||'ELA', topic = F('topic')||'', d = parseInt(F('difficulty')||'3',10);
    const n = Math.min(Math.max(parseInt(F('numQuestions')||'10',10),1),30);
    const base = stems(subj,'practice',topic,d); const ps=[]; for(let i=0;i<n;i++) ps.push(base[i%base.length] || `Practice on ${topic}`);
    return interleave(ps, qtypes()); }

  function renderKeys(){
    const wrap = $('mcControlsWrap'); const s = seq();
    const idxs = s.map((q,i)=> q.kind==='mc' ? (i+1) : null).filter(Boolean);
    if(!idxs.length){ wrap.innerHTML = '<div class=\"mc-controls-empty\">No MC items yet.</div>'; return; }
    wrap.innerHTML = `<table class="mc-table"><thead><tr><th>MC Question #</th><th>Correct Option</th></tr></thead><tbody>${
      idxs.map(n=>{ const v=getKey(n)||''; return `<tr><td>#${n}</td><td><select data-qn="${n}" class="mc-key-select">
        <option value="">—</option><option ${v==='A'?'selected':''}>A</option><option ${v==='B'?'selected':''}>B</option><option ${v==='C'?'selected':''}>C</option><option ${v==='D'?'selected':''}>D</option></select></td></tr>`; }).join('')
    }</tbody></table>`;
    wrap.querySelectorAll('.mc-key-select').forEach(el=>el.addEventListener('change', e => setKey(parseInt(e.target.dataset.qn,10), e.target.value||null)));
  }

  function preview(){
    $('prevTitle').textContent = F('title') || 'Worksheet Title';
    $('prevMeta').textContent = `Grade ${F('grade')||'—'} • ${F('subject')||'—'} • ${F('topic')||'—'}`;
    $('prevWatermark').textContent = `© ${F('company')||'Your Company'} • For classroom use`;
    updateLogoPreview();

    const d = parseInt(F('difficulty')||'3',10), typ = F('type');
    const n = Math.min(Math.max(parseInt(F('numQuestions')||'10',10),1),30);
    const hide = Ck('hideAnswersOnPage');
    const subj = F('subject') || 'ELA', topic = F('topic') || '';

    const out = [];
    const dir = (F('directions')||'').trim(); if(dir) out.push(`<h4>Directions</h4><p>${dir.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>`);
    if(typ==='study_guide'||typ==='mixed'){ out.push('<h4>Study Guide</h4>'); stems(subj,'study_guide',topic,d).forEach(s=>out.push(`<p class='q'>• ${s}</p>`)); }
    if(typ==='guided_notes'||typ==='mixed'){ out.push('<h4>Guided Notes</h4>'); stems(subj,'guided_notes',topic,d).forEach(s=>out.push(`<p class='q'>${s}</p><span class='line'></span>`)); }
    if(typ==='practice'||typ==='mixed'){
      out.push('<h4>Practice</h4>');
      const s = seq(); let mi=0;
      s.forEach((q,i)=>{
        if(q.kind==='mc'){
          const key = keyFor(i+1, mi++);
          out.push(`<p class="q"><strong>${i+1}.</strong> ${q.text}</p>`);
          out.push(`<div class='q mc'>A) ${hide?'____________________': (key==='A'?'[Correct]':'__________')}<br/>B) ${hide?'____________________': (key==='B'?'[Correct]':'__________')}<br/>C) ${hide?'____________________': (key==='C'?'[Correct]':'__________')}<br/>D) ${hide?'____________________': (key==='D'?'[Correct]':'__________')}</div>`);
        } else {
          out.push(`<p class='q'><strong>${i+1}.</strong> ${q.text}</p><span class='line'></span>`);
        }
      });
    }
    $('prevBody').innerHTML = out.join('');
  }

  function addWMText(doc, company, W, H){
    doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(120);
    doc.text(`© ${company || 'Your Company'} • Classroom use only`, W/2, H - 24, { align:'center' });
    doc.setTextColor(0);
  }
  async function addWMLogoPDF(doc, W, H){
    if(!Ck('useLogo')) return;
    try{
      const imgURL = await ensurePNG(LOGO_DATAURL || genLogoDataURL(F('company')));
      const img = await imgFromDataURL(imgURL);
      const targetH = 20 * (parseFloat(F('logoScale')||'1')||1);
      const ratio = (img.naturalWidth||380) / (img.naturalHeight||80);
      const targetW = targetH * ratio;
      const x = (W - targetW)/2, y = H - 40;
      doc.addImage(imgURL, 'PNG', x, y, targetW, targetH, undefined, 'FAST');
    }catch(e){}
  }

  async function pdf(){
    if(!jsPDF){ alert('PDF library failed to load.'); return; }
    const doc = new jsPDF({ unit:'pt', format:'letter' });
    const m = { left:54, right:54, top:56, bottom:46 };
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
    let y = m.top;

    doc.setFont('helvetica','normal'); doc.setFontSize(11);
    doc.text('Name: ___________________________', m.left, y);
    doc.text('Date: ___________', W - m.right - 120, y); y += 18;
    doc.setFont('helvetica','bold'); doc.setFontSize(16); doc.text(F('title')||'Worksheet Title', m.left, y); y += 16;
    doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(60);
    doc.text(`Grade ${F('grade')||'—'}  •  ${F('subject')||'—'}  •  ${F('topic')||'—'}`, m.left, y);
    doc.setTextColor(0); y += 16;

    const dir = (F('directions')||'').trim();
    if(dir){ doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.text('Directions', m.left, y); y += 14; doc.setFont('helvetica','normal'); doc.setFontSize(11);
      const lines = doc.splitTextToSize(dir, W-m.left-m.right); doc.text(lines, m.left, y); y += 14*lines.length + 8; }

    const typ = F('type'), d = parseInt(F('difficulty')||'3',10), n = Math.min(Math.max(parseInt(F('numQuestions')||'10',10),1),30);

    if(typ==='study_guide'||typ==='mixed'){
      doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.text('Study Guide', m.left, y); y += 16;
      stems(F('subject')||'ELA','study_guide',F('topic')||'',d).forEach(t => { const lines = doc.splitTextToSize(t, W-m.left-m.right); doc.text(lines, m.left, y); y += 14*lines.length + 6; });
    }
    if(typ==='guided_notes'||typ==='mixed'){
      doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.text('Guided Notes', m.left, y); y += 16;
      stems(F('subject')||'ELA','guided_notes',F('topic')||'',d).forEach(t => { const lines = doc.splitTextToSize(t, W-m.left-m.right); doc.text(lines, m.left, y); y += 14*lines.length; doc.setDrawColor(80); doc.line(m.left, y+6, W-m.right, y+6); y += 18; });
    }

    let mcPairs = [];
    if(typ==='practice'||typ==='mixed'){
      doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.text('Practice', m.left, y); y += 16;
      const s = seq(); let mi=0; const hide = Ck('hideAnswersOnPage');
      s.forEach((q,i)=>{
        const lines = doc.splitTextToSize(`${i+1}. ${q.text}`, W - m.left - m.right - 24);
        doc.text(lines, m.left, y); y += 14 * lines.length;
        if(q.kind==='mc'){
          const key = keyFor(i+1, mi++); mcPairs.push(`${i+1}-${key}`);
          doc.text("A) " + (hide?"____________": (key==='A'?'[Correct]':'__________')), m.left+12, y+6);
          doc.text("B) " + (hide?"____________": (key==='B'?'[Correct]':'__________')), m.left+12, y+22);
          doc.text("C) " + (hide?"____________": (key==='C'?'[Correct]':'__________')), m.left+12, y+38);
          doc.text("D) " + (hide?"____________": (key==='D'?'[Correct]':'__________')), m.left+12, y+54);
          y += 72;
        } else {
          doc.setDrawColor(80); doc.line(m.left, y+6, W-m.right, y+6); y += 18;
        }
        if(y > (H - 90)){ addWMLogoPDF(doc,W,H); addWMText(doc, F('company'), W, H); doc.addPage(); y = m.top; }
      });
    }

    await addWMLogoPDF(doc, W, H);
    addWMText(doc, F('company'), W, H);

    if(Ck('includeKey')){
      doc.addPage(); let y2 = m.top;
      doc.setFont('helvetica','bold'); doc.setFontSize(16); doc.text('Answer Key', m.left, y2); y2 += 18;
      doc.setFont('helvetica','normal'); doc.setFontSize(11);
      if(mcPairs.length){ const lines = doc.splitTextToSize(`Multiple Choice: ${mcPairs.join(', ')}`, W-m.left-m.right); doc.text(lines, m.left, y2); y2 += 14*lines.length + 6; }
      await addWMLogoPDF(doc, W, H);
      addWMText(doc, F('company'), W, H);
    }

    const safe = (F('title')||'worksheet').replace(/[^\w\d\-_]+/g,'_');
    doc.save(`${safe}_${new Date().toISOString().slice(0,10)}.pdf`);
  }

  async function docx(){
    const lib = window.docx; if(!lib){ alert("DOCX library failed to load."); return; }
    const { Document,Packer,Paragraph,TextRun,HeadingLevel,AlignmentType,ImageRun } = lib;
    const title = F('title')||'Worksheet Title', gr = F('grade')||'—', subj = F('subject')||'—', topic = F('topic')||'—', typ = F('type');
    const d = parseInt(F('difficulty')||'3',10), n = Math.min(Math.max(parseInt(F('numQuestions')||'10',10),1),30);
    const hide = Ck('hideAnswersOnPage');
    const stemsOf = t => stems(subj||'ELA', t, topic||'', d);
    const P = t => new Paragraph({ children:[ new TextRun({ text:t }) ] });
    const H = t => new Paragraph({ text:t, heading: HeadingLevel.HEADING_2 });
    const Grey = t => new Paragraph({ children:[ new TextRun({ text:t, color:'666666' }) ] });

    const content = [];
    content.push(new Paragraph({ children:[ new TextRun({ text:"Name: ___________________________" }), new TextRun({ text:"\tDate: ___________" }) ] }));
    content.push(new Paragraph({ text:title, heading: HeadingLevel.TITLE }));
    content.push(Grey(`Grade ${gr}  •  ${subj}  •  ${topic}`));
    const dir = (F('directions')||'').trim(); if(dir){ content.push(H('Directions')); content.push(P(dir)); }
    if(typ==='study_guide' || typ==='mixed'){ content.push(H('Study Guide')); stemsOf('study_guide').forEach(t=>content.push(P('• '+t))); }
    if(typ==='guided_notes' || typ==='mixed'){ content.push(H('Guided Notes')); stemsOf('guided_notes').forEach(t=>{ content.push(P(t)); content.push(P(' ')); }); }
    if(typ==='practice' || typ==='mixed'){
      content.push(H('Practice'));
      const s = (function(){ const base = stemsOf('practice'); const arr=[]; for(let i=0;i<n;i++) arr.push(base[i%base.length]||`Practice on ${topic}`); return interleave(arr, qtypes())})(); let mi=0;
      s.forEach((q,i)=>{
        content.push(P(`${i+1}. ${q.text}`));
        if(q.kind==='mc'){
          const key = keyFor(i+1, mi++);
          content.push(P("A) " + (hide?"____________": (key==='A'?'[Correct]':'__________'))));
          content.push(P("B) " + (hide?"____________": (key==='B'?'[Correct]':'__________'))));
          content.push(P("C) " + (hide?"____________": (key==='C'?'[Correct]':'__________'))));
          content.push(P("D) " + (hide?"____________": (key==='D'?'[Correct]':'__________'))));
        } else {
          content.push(P(" "));
        }
      });
    }

    if(Ck('useLogo')){
      try{
        const src = (localStorage.getItem('logoDataURL') || genLogoDataURL(F('company')));
        const bytes = dataURLToBytes(src);
        content.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [ new ImageRun({ data: bytes, transformation: { width: Math.round(140*(parseFloat(F('logoScale')||'1')||1)), height: Math.round(40*(parseFloat(F('logoScale')||'1')||1)) } }) ] }));
      }catch(e){ /* silently continue if image fails */ }
    }
    content.push(new Paragraph({ children:[ new TextRun({ text:`© ${F('company')||'Your Company'} • Classroom use only`, color:'777777' }) ], alignment: AlignmentType.CENTER }));

    const doc = new Document({ sections:[ { properties:{}, children: content } ] });
    const blob = await Packer.toBlob(doc);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (title.replace(/[^\w\d\-_]+/g,'_') + '_' + new Date().toISOString().slice(0,10) + '.docx');
    document.body.appendChild(a); a.click(); requestAnimationFrame(()=>{ URL.revokeObjectURL(a.href); a.remove(); });
  }

  function ser(){
    const ids = ['company','title','grade','subject','standardsSet','standard','topic','type','difficulty','numQuestions','mcKeyPattern','hideAnswersOnPage','includeKey','includeGraphics','qtypeAuto','qtypeSR','qtypeMC','qtypeOrganizer','qtypeCloze','qtypeCornell','directions','logoScale','useLogo'];
    const d = {}; ids.forEach(id => { const el = $(id); if(!el) return; d[id] = el.type==='checkbox'? el.checked : el.value; });
    d.mcKeyMap = window.MC_KEY_MAP || {}; d.logoDataURL = (localStorage.getItem('logoDataURL')||'');
    return d;
  }
  function apply(data){
    S('company', data.company||''); S('title', data.title||''); S('grade', data.grade||''); S('subject', data.subject||'');
    S('standardsSet', data.standardsSet||'common'); refreshStandards(); S('standard', data.standard||'');
    S('topic', data.topic||''); S('type', data.type||''); S('difficulty', data.difficulty||'3'); S('numQuestions', data.numQuestions||'10');
    S('mcKeyPattern', data.mcKeyPattern||''); Ch('hideAnswersOnPage', !!data.hideAnswersOnPage); Ch('includeKey', data.includeKey!==false); Ch('includeGraphics', data.includeGraphics!==false);
    Ch('qtypeAuto', data.qtypeAuto!==false); Ch('qtypeSR', data.qtypeSR!==false); Ch('qtypeMC', !!data.qtypeMC); Ch('qtypeOrganizer', !!data.qtypeOrganizer); Ch('qtypeCloze', !!data.qtypeCloze); Ch('qtypeCornell', !!data.qtypeCornell);
    S('directions', data.directions||''); S('logoScale', data.logoScale||'1'); Ch('useLogo', data.useLogo!==false);
    window.MC_KEY_MAP = data.mcKeyMap || {}; localStorage.setItem('mcKeyMap', JSON.stringify(window.MC_KEY_MAP));
    if(data.logoDataURL){ localStorage.setItem('logoDataURL', data.logoDataURL); } else { localStorage.removeItem('logoDataURL'); }
    updateLogoPreview();
  }
  function listTpl(){ return Object.keys(localStorage).filter(k=>k.startsWith('tpl:')).map(k=>k.slice(4)).sort(); }
  function hydrate(){ const sel = $('templateSelect'); if(!sel) return; const cur = sel.value; sel.innerHTML = '<option value=\"\">Load a saved template…</option>'; listTpl().forEach(name => { const o = document.createElement('option'); o.value = name; o.textContent = name; sel.appendChild(o); }); if(cur) sel.value = cur; }
  function saveTpl(){ const name = (F('templateName')||'').trim(); if(!name){ alert('Name your template first.'); return; } localStorage.setItem('tpl:'+name, JSON.stringify(ser())); hydrate(); alert('Saved.'); }
  function loadTpl(name){ const raw = localStorage.getItem('tpl:'+name); if(!raw){ alert('Template not found.'); return; } apply(JSON.parse(raw)); preview(); renderKeys(); }
  function delTpl(){ const n = F('templateSelect'); if(!n){ alert('Select a template to delete.'); return; } localStorage.removeItem('tpl:'+n); hydrate(); }
  function expJson(){ const blob = new Blob([JSON.stringify(ser(),null,2)], {type:"application/json"}); const a=document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = (F('title')||'worksheet')+'_template.json'; document.body.appendChild(a); a.click(); requestAnimationFrame(()=>{ URL.revokeObjectURL(a.href); a.remove(); }); }
  function impJson(file){ const r=new FileReader(); r.onload=()=>{ try{ apply(JSON.parse(r.result)); preview(); renderKeys(); } catch(e){ alert('Invalid JSON.'); } }; r.readAsText(file); }
  function reset(){ $('worksheetForm').reset(); localStorage.removeItem('mcKeyMap'); window.MC_KEY_MAP={}; localStorage.removeItem('logoDataURL'); hydrate(); refreshStandards(); updateLogoPreview(); preview(); renderKeys(); }

  $('standardsSet')?.addEventListener('change', ()=>{ refreshStandards(); preview(); renderKeys(); });
  $('grade')?.addEventListener('change', ()=>{ refreshStandards(); preview(); renderKeys(); });
  $('subject')?.addEventListener('change', ()=>{ refreshStandards(); preview(); renderKeys(); });
  $('standard')?.addEventListener('change', ()=>{ preview(); renderKeys(); });
  $('previewBtn')?.addEventListener('click', preview);
  $('downloadBtn')?.addEventListener('click', ()=>pdf());
  $('downloadDocxBtn')?.addEventListener('click', ()=>docx());
  ['numQuestions','qtypeAuto','qtypeSR','qtypeMC','qtypeOrganizer','qtypeCloze','qtypeCornell','type','difficulty','topic','mcKeyPattern','hideAnswersOnPage','includeKey','includeGraphics','useLogo','logoScale','company']
    .forEach(id => $(id)?.addEventListener('change', ()=>{ if(id==='company' && !localStorage.getItem('logoDataURL')){ updateLogoPreview(); } preview(); renderKeys(); }));
  $('directions')?.addEventListener('input', preview);

  $('mcAutoFillBtn')?.addEventListener('click', ()=>{ const s = seq(); let mi=0; s.forEach((q,i)=>{ if(q.kind==='mc'){ setKey(i+1, keyPattern(mi++)); } }); renderKeys(); preview(); });
  $('mcClearBtn')?.addEventListener('click', ()=>{ clearKeys(); renderKeys(); preview(); });

  $('saveTemplateBtn')?.addEventListener('click', saveTpl);
  $('templateSelect')?.addEventListener('change', e => { if(e.target.value) loadTpl(e.target.value); });
  $('deleteTemplateBtn')?.addEventListener('click', delTpl);
  $('exportJsonBtn')?.addEventListener('click', expJson);
  $('importJsonBtn')?.addEventListener('click', ()=> $('importJsonInput').click());
  $('importJsonInput')?.addEventListener('change', e => { const f = e.target.files?.[0]; if(f){ const r=new FileReader(); r.onload=()=>{ try{ apply(JSON.parse(r.result)); }catch{}; preview(); renderKeys(); }; r.readAsText(f); } });

  $('logoFile')?.addEventListener('change', e => { const f = e.target.files?.[0]; if(!f) return; const r=new FileReader(); r.onload=()=>{ localStorage.setItem('logoDataURL', r.result); updateLogoPreview(); }; r.readAsDataURL(f); });
  $('clearLogoBtn')?.addEventListener('click', ()=>{ localStorage.removeItem('logoDataURL'); updateLogoPreview(); });

  // Init
  updateLogoPreview();
  hydrate(); refreshStandards(); preview(); renderKeys();
})();