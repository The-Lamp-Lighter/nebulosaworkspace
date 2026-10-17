/* ==========================================================================
   FotoFlow — timeline.js
   Linha do tempo com cinco trilhas: Fotos, Transições, Câmera (animações),
   Textos e Áudio. Permite arrastar e soltar, reordenar, redimensionar a
   duração, selecionar e posicionar o cursor de reprodução.
   ========================================================================== */
(function (FF) {
  'use strict';
  let root, scroll, inner, playhead;
  const ROW = 28;      // altura de cada linha de textos/áudio

  const E = () => FF.Engine;
  const A = () => FF.App;
  const S = () => FF.state;

  /* Arrasto genérico com o ponteiro (mouse, caneta ou toque). */
  function drag(ev, onMove, onEnd) {
    if (ev.button != null && ev.button !== 0) return;
    ev.preventDefault();
    const x0 = ev.clientX;
    let moved = false;
    const move = e => { const dx = e.clientX - x0; if (Math.abs(dx) > 4) moved = true; if (moved) onMove(dx, e); };
    const up = e => {
      document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up);
      document.body.classList.remove('dragging');
      onEnd(e.clientX - x0, moved, e);
    };
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', up);
    document.body.classList.add('dragging');
  }

  /* Distribui clipes em linhas para que não se sobreponham visualmente. */
  function packRows(clips) {
    const rows = [], map = new Map();
    clips.slice().sort((a, b) => a.start - b.start).forEach(c => {
      let r = rows.findIndex(end => end <= c.start + 0.001);
      if (r < 0) { r = rows.length; rows.push(0); }
      rows[r] = c.start + c.duration;
      map.set(c, r);
    });
    return { count: Math.max(1, rows.length), map };
  }

  function timeAt(clientX) {
    const r = inner.getBoundingClientRect();
    return Math.max(0, (clientX - r.left) / S().pps);
  }

  function init(host) {
    const el = FF.util.el;
    root = host;
    const labels = el('div', { class: 'tl-labels' }, [
      el('div', { class: 'tl-label ruler', text: '' }),
      el('div', { class: 'tl-label photos', text: 'Fotos' }),
      el('div', { class: 'tl-label', text: 'Transições' }),
      el('div', { class: 'tl-label', text: 'Câmera' }),
      el('div', { class: 'tl-label texts', id: 'tlLabelTexts', text: 'Textos' }),
      el('div', { class: 'tl-label audio', id: 'tlLabelAudio', text: 'Áudio' })
    ]);
    inner = el('div', { class: 'tl-inner' });
    scroll = el('div', { class: 'tl-scroll' }, [inner]);
    root.append(labels, scroll);

    // Soltar mídias da biblioteca diretamente na linha do tempo.
    scroll.addEventListener('dragover', e => {
      if (Array.from(e.dataTransfer.types || []).includes('text/fotoflow-media')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }
    });
    scroll.addEventListener('drop', e => {
      const id = e.dataTransfer.getData('text/fotoflow-media');
      const m = id && S().project.media[id];
      if (!m) return;
      e.preventDefault(); e.stopPropagation();
      if (m.type === 'image') {
        const t = timeAt(e.clientX), items = E().schedule(S().project).items;
        const idx = items.filter(it => (it.start + it.end) / 2 < t).length;
        A().actions.addScene(id, idx);
      } else A().actions.addAudio(id);
    });
  }

  function render() {
    if (!inner) return;
    const el = FF.util.el, st = S(), p = st.project, pps = st.pps;
    const sch = E().schedule(p), items = sch.items;
    const sel = st.sel || {};
    const maxEnd = Math.max(sch.total, ...p.texts.map(t => t.start + t.duration), ...p.audio.map(a => a.start + a.duration), 0);
    const width = Math.max(scroll.clientWidth - 2, (maxEnd + 4) * pps);
    const keepScroll = scroll.scrollLeft;
    inner.innerHTML = '';
    inner.style.width = width + 'px';

    /* ---------- Régua ---------- */
    const ruler = el('div', { class: 'tl-ruler', onpointerdown: e => {
      A().pause(); A().seek(timeAt(e.clientX));
      drag(e, (dx, ev) => A().seek(timeAt(ev.clientX)), () => {});
    } });
    const step = pps >= 70 ? 1 : pps >= 30 ? 2 : pps >= 14 ? 5 : 10;
    for (let t = 0; t * pps < width; t += step) {
      ruler.append(el('span', { class: 'tick', style: { left: t * pps + 'px' }, text: `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` }));
    }
    inner.append(ruler);

    /* ---------- Trilha de fotos ---------- */
    const tPhotos = el('div', { class: 'tl-track photos' });
    if (!items.length) tPhotos.append(el('div', { class: 'tl-hint', text: 'Clique nas fotos da biblioteca ou arraste-as para cá. Para um filme pronto, use "Gerar filme automático".' }));
    items.forEach((it, i) => {
      const next = items[i + 1], sc = it.scene, m = p.media[sc.mediaId];
      const left = it.start * pps, w = ((next ? next.start : it.end) - it.start) * pps;
      const clip = el('div', { class: 'clip photo' + (sel.type === 'scene' && sel.id === sc.id ? ' selected' : ''),
        style: { left: left + 'px', width: Math.max(10, w - 2) + 'px', backgroundImage: m ? `url(${m.thumb})` : 'none' },
        title: (m ? m.name : 'Cena') + ` · ${sc.duration.toFixed(1)} s` }, [
        el('span', { class: 'clip-tag', text: `${i + 1} · ${sc.duration.toFixed(1)}s` }),
        el('span', { class: 'handle', title: 'Arraste para mudar a duração', onpointerdown: e => {
          e.stopPropagation();
          const d0 = sc.duration;
          drag(e, dx => { sc.duration = Math.round(Math.min(30, Math.max(1, d0 + dx / pps)) * 10) / 10; clip.style.width = Math.max(10, w - 2 + (sc.duration - d0) * pps) + 'px';
            clip.firstChild.textContent = `${i + 1} · ${sc.duration.toFixed(1)}s`; }, () => A().refresh(true));
        } })
      ]);
      clip.addEventListener('pointerdown', e => {
        drag(e, dx => { clip.style.transform = `translateX(${dx}px)`; clip.classList.add('moving'); }, (dx, moved) => {
          clip.style.transform = ''; clip.classList.remove('moving');
          if (!moved) { A().select({ type: 'scene', id: sc.id }); return; }
          const center = (left + dx + w / 2) / pps;
          const target = items.filter(o => o !== it && (o.start + o.end) / 2 < center).length;
          st.sel = { type: 'scene', id: sc.id };
          A().actions.moveScene(i, target); A().renderProps();
        });
      });
      tPhotos.append(clip);
    });
    inner.append(tPhotos);

    /* ---------- Trilha de transições ---------- */
    const tTrans = el('div', { class: 'tl-track thin' });
    items.forEach((it, i) => {
      const next = items[i + 1];
      if (!next) return;
      const tr = it.scene.transition || {}, has = it.transition > 0;
      const w = Math.max(18, it.transition * pps);
      const x = has ? next.start * pps : next.start * pps - 9;
      tTrans.append(el('button', { class: 'clip trans' + (has ? '' : ' none') + (sel.type === 'transition' && sel.id === it.scene.id ? ' selected' : ''),
        style: { left: x + 'px', width: w + 'px' }, title: `Transição: ${E().label(E().TRANSITIONS, tr.type || 'none')}` + (has ? ` · ${it.transition.toFixed(1)} s` : ''),
        onclick: () => A().select({ type: 'transition', id: it.scene.id }) }, has && w > 60 ? E().label(E().TRANSITIONS, tr.type).split(' ')[0] : '◆'));
    });
    inner.append(tTrans);

    /* ---------- Trilha de câmera (animações) ---------- */
    const tCam = el('div', { class: 'tl-track thin' });
    items.forEach((it, i) => {
      const next = items[i + 1], sc = it.scene;
      const left = it.start * pps, w = ((next ? next.start : it.end) - it.start) * pps;
      tCam.append(el('button', { class: 'clip cam' + (sel.type === 'scene' && sel.id === sc.id ? ' selected' : ''),
        style: { left: left + 'px', width: Math.max(10, w - 2) + 'px' }, title: 'Movimento de câmera: ' + E().label(E().CAMERAS, sc.camera.type),
        onclick: () => A().select({ type: 'scene', id: sc.id }) }, E().label(E().CAMERAS, sc.camera.type)));
    });
    inner.append(tCam);

    /* ---------- Trilhas de textos e de áudio (clipes livres no tempo) ---------- */
    const freeTrack = (cls, clips, type, labelId, makeLabel, maxDur) => {
      const packed = packRows(clips), rows = packed.count;
      const track = el('div', { class: 'tl-track free ' + cls, style: { height: rows * ROW + 6 + 'px' } });
      document.getElementById(labelId).style.height = rows * ROW + 6 + 'px';
      clips.forEach(c => {
        const clip = el('div', { class: `clip ${cls} kind-${c.kind}` + (sel.type === type && sel.id === c.id ? ' selected' : ''),
          style: { left: c.start * pps + 'px', width: Math.max(14, c.duration * pps - 2) + 'px', top: packed.map.get(c) * ROW + 3 + 'px' }, title: makeLabel(c) }, [
          el('span', { class: 'clip-text', text: makeLabel(c) }),
          el('span', { class: 'handle', title: 'Arraste para mudar a duração', onpointerdown: e => {
            e.stopPropagation();
            const d0 = c.duration, lim = maxDur(c);
            drag(e, dx => { c.duration = Math.round(Math.min(lim, Math.max(0.5, d0 + dx / pps)) * 10) / 10; clip.style.width = Math.max(14, c.duration * pps - 2) + 'px'; A().draw(); },
              () => A().refresh(true));
          } })
        ]);
        clip.addEventListener('pointerdown', e => {
          const s0 = c.start;
          drag(e, dx => { c.start = Math.max(0, Math.round((s0 + dx / pps) * 10) / 10); clip.style.left = c.start * pps + 'px'; A().draw(); }, (dx, moved) => {
            if (!moved) A().select({ type, id: c.id }); else { st.sel = { type, id: c.id }; A().refresh(true); }
          });
        });
        track.append(clip);
      });
      return track;
    };
    inner.append(freeTrack('text', p.texts, 'text', 'tlLabelTexts', c => String(c.text).split('\n')[0], () => 60));
    const kindName = { music: 'Música', narration: 'Narração', sfx: 'Efeito' };
    inner.append(freeTrack('audio', p.audio, 'audio', 'tlLabelAudio',
      c => `${kindName[c.kind] || 'Áudio'}: ${(p.media[c.mediaId] || {}).name || ''}`,
      c => ((p.media[c.mediaId] || {}).duration || 600) - (c.offset || 0)));

    playhead = el('div', { class: 'tl-playhead' });
    inner.append(playhead);
    scroll.scrollLeft = keepScroll;
    setPlayhead();

    // Botões que dependem da seleção.
    const has = !!st.sel;
    document.getElementById('btnDupSel').disabled = !has || sel.type === 'transition';
    document.getElementById('btnDelSel').disabled = !has;
  }

  function setPlayhead() {
    if (!playhead) return;
    const st = S(), x = st.time * st.pps;
    playhead.style.transform = `translateX(${x}px)`;
    if (st.playing) {
      // Acompanha a reprodução mantendo o cursor visível.
      if (x > scroll.scrollLeft + scroll.clientWidth - 80) scroll.scrollLeft = x - 120;
      else if (x < scroll.scrollLeft) scroll.scrollLeft = Math.max(0, x - 120);
    }
  }

  FF.Timeline = { init, render, setPlayhead };
})(window.FF = window.FF || {});
