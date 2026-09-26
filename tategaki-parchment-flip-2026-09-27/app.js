/* 縦書き羊皮紙リーダー — pagination + paper page-turn */
(() => {
  'use strict';

  // ───────── content: 芥川龍之介「羅生門」(1915) 冒頭抜粋 — public domain ─────────
  const WORK = { title: '羅生門', author: '芥川龍之介' };
  const PARAGRAPHS = [
    '或日の暮方の事である。一人の下人が、羅生門の下で雨やみを待っていた。',
    '広い門の下には、この男のほかに誰もいない。ただ、所々丹塗の剥げた、大きな円柱に、蟋蟀が一匹とまっている。羅生門が、朱雀大路にある以上は、この男のほかにも、雨やみをする市女笠や揉烏帽子が、もう二三人はありそうなものである。それが、この男のほかには誰もいない。',
    '何故かと云うと、この二三年、京都には、地震とか辻風とか火事とか饑饉とか云う災がつづいて起った。そこで洛中のさびれ方は一通りではない。旧記によると、仏像や仏具を打砕いて、その丹がついたり、金銀の箔がついたりした木を、路ばたにつみ重ねて、薪の料に売っていたと云う事である。洛中がその始末であるから、羅生門の修理などは、元より誰も捨てて顧る者がなかった。するとその荒れ果てたのをよい事にして、狐狸が棲む。盗人が棲む。とうとうしまいには、引取り手のない死人を、この門へ持って来て、棄てて行くと云う習慣さえ出来た。そこで、日の目が見えなくなると、誰でも気味を悪るがって、この門の近所へは足ぶみをしない事になってしまったのである。',
    'その代りまた鴉が何処からか、たくさん集って来た。昼間見ると、その鴉が何羽となく輪を描いて、高い鴟尾のまわりを啼きながら、飛びまわっている。ことに門の上の空が、夕焼けであかくなる時には、それが胡麻をまいたようにはっきり見えた。鴉は、勿論、門の上にある死人の肉を、啄みに来るのである。――もっとも今日は、刻限が遅いせいか、一羽も見えない。ただ、所々、崩れかかった、そうしてその崩れ目に長い草のはえた石段の上に、鴉の糞が、点々と白くこびりついているのが見える。下人は七段ある石段の一番上の段に、洗いざらした紺の襖の尻を据えて、右の頬に出来た、大きな面皰を気にしながら、ぼんやり、雨のふるのを眺めていた。',
    '作者はさっき、「下人が雨やみを待っていた」と書いた。しかし、下人は雨がやんでも、格別どうしようと云う当てはない。ふだんなら、勿論、主人の家へ帰る可き筈である。所がその主人からは、四五日前に暇を出された。前にも書いたように、当時京都の町は一通りならず衰微していた。今この下人が、永年、使われていた主人から、暇を出されたのも、実はこの衰微の小さな余波にほかならない。だから「下人が雨やみを待っていた」と云うよりも「雨にふりこめられた下人が、行き所がなくて、途方にくれていた」と云う方が、適当である。その上、今日の空模様も少からず、この平安朝の下人の Sentimentalisme に影響した。申の刻下りからふり出した雨は、いまだに上るけしきがない。そこで、下人は、何をおいても差当り明日の暮しをどうにかしようとして――云わばどうにもならない事を、どうにかしようとして、とりとめもない考えをたどりながら、さっきから朱雀大路にふる雨の音を、聞くともなく聞いていたのである。',
    '雨は、羅生門をつつんで、遠くから、ざあっと云う音をあつめて来る。夕闇は次第に空を低くして、見上げると、門の屋根が、斜につき出した甍の先に、重たくうす暗い雲を支えている。',
    'どうにもならない事を、どうにかするためには、手段を選んでいる遑はない。選んでいれば、築土の下か、道ばたの土の上で、饑死をするばかりである。そうして、この門の上へ持って来て、犬のように棄てられてしまうばかりである。選ばないとすれば――下人の考えは、何度も同じ道を低徊した揚句に、やっとこの局所へ逢着した。しかしこの「すれば」は、いつまでたっても、結局「すれば」であった。下人は、手段を選ばないという事を肯定しながらも、この「すれば」のかたをつけるために、当然、その後に来る可き「盗人になるよりほかに仕方がない」と云う事を、積極的に肯定するだけの、勇気が出ずにいたのである。',
    '下人は、大きな嚏をして、それから、大儀そうに立上った。夕冷えのする京都は、もう火桶が欲しいほどの寒さである。風は門の柱と柱との間を、夕闇と共に遠慮なく、吹きぬける。丹塗の柱にとまっていた蟋蟀も、もうどこかへ行ってしまった。',
    '下人は、頸をちぢめながら、山吹の汗袗に重ねた、紺の襖の肩を高くして門のまわりを見まわした。雨風の患のない、人目にかかる惧のない、一晩楽にねられそうな所があれば、そこでともかくも、夜を明かそうと思ったからである。すると、幸い門の上の楼へ上る、幅の広い、これも丹を塗った梯子が眼についた。上なら、人がいたにしても、どうせ死人ばかりである。下人はそこで、腰にさげた聖柄の太刀が鞘走らないように気をつけながら、藁草履をはいた足を、その梯子の一番下の段へふみかけた。',
  ];
  const TEXT = PARAGRAPHS.map((p) => '　' + p).join('\n');
  // characters that must not begin a page (行頭禁則)
  const NO_START = '、。，．」』）〕】〉》ー々ゝゞぁぃぅぇぉっゃゅょァィゥェォッャュョ・：；！？―…';

  // ───────── DOM ─────────
  const $ = (id) => document.getElementById(id);
  const app = $('app');
  const stage = $('stage');
  const book = $('book');
  const pagesEl = $('pages');
  const flap = $('flap');
  const flapContent = $('flapContent');
  const flapShade = $('flapShade');
  const foldShadow = $('foldShadow');
  const measure = $('measure');
  const measureBody = measure.querySelector('.body');
  const indicator = $('indicator');
  const hint = $('hint');
  const fsBtn = $('fsBtn');

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const STORE_KEY = 'tategaki-parchment:pos';
  const HINT_KEY = 'tategaki-parchment:hinted';

  let pages = [];        // HTMLElement[]
  let textStarts = [];   // char offset of each page (−1 for non-text pages)
  let cur = 0;
  let W = 1;             // book width in px

  // ───────── pagination ─────────
  function fits(str) {
    measureBody.textContent = str;
    return measureBody.scrollWidth <= measureBody.clientWidth + 1 &&
           measureBody.scrollHeight <= measureBody.clientHeight + 1;
  }

  function paginate() {
    const chunks = [];
    let start = 0;
    while (start < TEXT.length) {
      if (TEXT[start] === '\n') { start++; continue; }
      let lo = 1, hi = TEXT.length - start, best = 1;
      if (fits(TEXT.slice(start))) best = hi;
      else {
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          if (fits(TEXT.slice(start, start + mid))) { best = mid; lo = mid + 1; } else hi = mid - 1;
        }
        // keep closing punctuation off the top of the next page
        let end = start + best;
        while (end < TEXT.length && end - start > 8 && NO_START.includes(TEXT[end])) end--;
        best = end - start;
      }
      chunks.push({ start, text: TEXT.slice(start, start + best) });
      start += best;
    }
    measureBody.textContent = '';
    return chunks;
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function build(keepOffset) {
    W = book.clientWidth;
    const chunks = paginate();
    const total = chunks.length + 2;
    pagesEl.textContent = '';
    pages = [];
    shown = { top: -1, under: -1 };
    flapFor = -1;
    textStarts = [];

    // 扉
    const t = el('article', 'page tobira');
    const tb = el('div', 'body');
    tb.append(el('h1', 't-title', WORK.title), el('p', 't-author', WORK.author),
      el('p', 't-note', '青空文庫相当のパブリックドメイン抜粋'));
    const seal = el('span', 'seal', '芥');
    seal.setAttribute('aria-hidden', 'true');
    tb.append(seal);
    t.append(tb);
    pages.push(t); textStarts.push(-1);

    // 本文
    chunks.forEach((c, i) => {
      const p = el('article', 'page');
      p.append(el('div', 'hashira', WORK.title), el('div', 'body', c.text), el('div', 'nombre', String(i + 1)));
      pages.push(p); textStarts.push(c.start);
    });

    // 奥付
    const o = el('article', 'page okuzuke');
    const ob = el('div', 'body');
    ob.append(
      el('h2', null, '奥付'),
      el('p', null, '芥川龍之介「羅生門」冒頭より抜粋。初出は一九一五年「帝国文学」。著作権の保護期間が満了したパブリックドメイン作品（青空文庫相当）です。'),
      el('p', null, '本文は冒頭部のみを収録しています。下人が梯子へ足をかけたところで、この抜粋は終わります。'),
    );
    const restart = el('button', 'restart', '最初から読む');
    restart.type = 'button';
    restart.addEventListener('pointerdown', (e) => e.stopPropagation());
    restart.addEventListener('click', () => jumpTo(0));
    ob.append(restart);
    o.append(ob);
    pages.push(o); textStarts.push(-1);

    pages.forEach((p, i) => {
      p.setAttribute('aria-label', `${i + 1}ページ（全${total}ページ）`);
      pagesEl.append(p);
    });

    // restore position by text offset so resizes / font loads don't lose your place
    if (keepOffset != null) {
      if (keepOffset === 'end') cur = pages.length - 1;
      else if (keepOffset < 0) cur = 0;
      else {
        cur = 1;
        for (let i = 1; i < textStarts.length; i++) if (textStarts[i] >= 0 && textStarts[i] <= keepOffset) cur = i;
      }
    }
    cur = Math.max(0, Math.min(cur, pages.length - 1));
    showIdle();
  }

  function currentOffset() {
    if (cur === pages.length - 1 && pages.length > 1) return 'end';
    return textStarts[cur] ?? -1;
  }

  // ───────── scene rendering ─────────
  // A turn is described by (turnIdx, p): leaf `turnIdx` is being folded from its
  // right edge toward the left spine, revealing leaf `turnIdx + 1` underneath.
  // p = 0 → flat & unturned, p = 1 → fully turned. Going back = p running 1 → 0.
  let shown = { top: -1, under: -1 };
  let flapFor = -1;

  function setVisible(top, under) {
    if (shown.top === top && shown.under === under) return;
    pages.forEach((p, i) => {
      p.classList.toggle('is-top', i === top);
      p.classList.toggle('is-under', i === under);
      p.setAttribute('aria-hidden', i === top && under < 0 ? 'false' : 'true');
    });
    shown = { top, under };
  }

  function renderTurn(turnIdx, p) {
    p = Math.min(1, Math.max(0, p));
    setVisible(turnIdx, turnIdx + 1);
    if (flapFor !== turnIdx) {
      flapContent.innerHTML = pages[turnIdx].innerHTML;
      flapContent.className = 'show-through ' + pages[turnIdx].className.replace(/\bpage\b|is-\w+/g, '');
      flapFor = turnIdx;
    }
    flap.classList.add('on');
    flapShade.classList.add('on');
    foldShadow.classList.add('on');

    const fold = W * (1 - p);           // x of the fold line
    const covered = W - fold;           // width of the lifted part
    const top = pages[turnIdx];
    top.style.clipPath = `inset(0 ${covered}px 0 0)`;
    // back of the leaf = the page mirrored about the fold line
    flap.style.transform = `translate3d(${2 * fold}px,0,0) scaleX(-1)`;
    flap.style.clipPath = `inset(0 0 0 ${fold}px)`;
    flapShade.style.transform = `translate3d(${2 * fold - covered}px,0,0) scaleX(${Math.max(covered, 0.001) / W})`;
    flapShade.style.opacity = String(Math.min(1, p * 6));
    foldShadow.style.transform = `translate3d(${fold}px,0,0)`;
    foldShadow.style.opacity = String(Math.min(1, p * 5) * (1 - p * 0.6));
  }

  function showIdle() {
    setVisible(cur, -1);
    pages.forEach((p) => { p.style.clipPath = ''; });
    flap.classList.remove('on');
    flapShade.classList.remove('on');
    foldShadow.classList.remove('on');
    flapFor = -1;
    indicator.textContent = `${cur + 1} / ${pages.length}`;
    try { localStorage.setItem(STORE_KEY, JSON.stringify(currentOffset())); } catch (_) {}
  }

  // ───────── animation (spring, velocity-continuous) ─────────
  let anim = null; // { turnIdx, p, v, target, raf }

  function animateTo(turnIdx, from, target, velocity) {
    stopAnim();
    // completing a turn: firm, nearly critically-damped; snapping back: a little springy
    const snapBack = !((target === 1 && turnIdx === cur) || (target === 0 && turnIdx === cur - 1));
    const k = snapBack ? 320 : 190;
    const c = snapBack ? 21 : 25;
    const speed = reduceMotion.matches ? 3 : 1;
    const a = { turnIdx, p: from, v: velocity || 0, target, raf: 0, last: performance.now() };
    anim = a;
    const step = (now) => {
      let dt = Math.min(0.032, (now - a.last) / 1000) * speed;
      a.last = now;
      // two sub-steps for stability
      for (let i = 0; i < 2; i++) {
        const h = dt / 2;
        const f = -k * (a.p - a.target) - c * a.v;
        a.v += f * h;
        a.p += a.v * h;
      }
      if (Math.abs(a.p - a.target) < 0.0015 && Math.abs(a.v) < 0.02) {
        anim = null;
        finishTurn(a.turnIdx, a.target);
        return;
      }
      renderTurn(a.turnIdx, a.p);
      a.raf = requestAnimationFrame(step);
    };
    renderTurn(turnIdx, from);
    a.raf = requestAnimationFrame(step);
  }

  function stopAnim() {
    if (anim) { cancelAnimationFrame(anim.raf); const a = anim; anim = null; return a; }
    return null;
  }

  function finishTurn(turnIdx, target) {
    const before = cur;
    cur = target >= 1 ? turnIdx + 1 : turnIdx;
    showIdle();
    if (cur !== before) dismissHint();
  }

  function turn(dir) {
    if (anim) { // fast repeated taps: settle the running one first
      const a = stopAnim();
      finishTurn(a.turnIdx, a.target);
    }
    if (dir > 0) {
      if (cur >= pages.length - 1) return bump(-1);
      animateTo(cur, 0, 1, 1.2);
    } else {
      if (cur <= 0) return bump(1);
      animateTo(cur - 1, 1, 0, -1.2);
    }
  }

  function jumpTo(i) {
    stopAnim();
    cur = i;
    book.animate?.([{ opacity: 0.4 }, { opacity: 1 }], { duration: reduceMotion.matches ? 80 : 320, easing: 'ease-out' });
    showIdle();
  }

  function bump(sign) {
    book.style.setProperty('--bump', `${sign * 10}px`);
    book.classList.remove('bump');
    void book.offsetWidth;
    book.classList.add('bump');
  }
  book.addEventListener('animationend', () => book.classList.remove('bump'));

  // ───────── pointer drag ─────────
  // Right-to-left drag advances (next page), left-to-right goes back.
  const DRAG_SLOP = 6;
  const VELOCITY_FLING = 0.45; // px/ms
  let drag = null;

  function onDown(e) {
    if (e.button != null && e.button > 0) return;
    if (drag) return;
    W = book.clientWidth;
    const rect = book.getBoundingClientRect();
    const grabbed = stopAnim(); // allow catching a leaf mid-flight
    drag = {
      id: e.pointerId,
      x0: e.clientX, y0: e.clientY,
      rectLeft: rect.left,
      started: !!grabbed,
      turnIdx: grabbed ? grabbed.turnIdx : -1,
      p0: grabbed ? grabbed.p : 0,
      p: grabbed ? grabbed.p : 0,
      samples: [{ x: e.clientX, t: e.timeStamp }],
      moved: false,
    };
    try { stage.setPointerCapture(e.pointerId); } catch (_) {}
  }

  function onMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x0;
    const dy = e.clientY - drag.y0;
    drag.samples.push({ x: e.clientX, t: e.timeStamp });
    if (drag.samples.length > 8) drag.samples.shift();

    if (!drag.started) {
      if (Math.abs(dx) < DRAG_SLOP && Math.abs(dy) < DRAG_SLOP) return;
      drag.moved = true;
      if (Math.abs(dx) < Math.abs(dy)) return; // mostly vertical: ignore, keep waiting
      if (dx < 0) {
        if (cur >= pages.length - 1) { drag.blocked = -1; return; }
        drag.turnIdx = cur; drag.p0 = 0;
      } else {
        if (cur <= 0) { drag.blocked = 1; return; }
        drag.turnIdx = cur - 1; drag.p0 = 1;
      }
      drag.started = true;
      stage.classList.add('dragging');
    }
    e.preventDefault();
    drag.p = Math.min(1, Math.max(0, drag.p0 - dx / W));
    renderTurn(drag.turnIdx, drag.p);
  }

  function velocity(d) {
    const s = d.samples;
    const now = s[s.length - 1];
    let first = s[0];
    for (let i = s.length - 1; i >= 0; i--) { if (now.t - s[i].t > 90) break; first = s[i]; }
    const dt = now.t - first.t;
    return dt > 0 ? (now.x - first.x) / dt : 0; // px/ms, + = rightwards
  }

  function onUp(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    stage.classList.remove('dragging');
    try { stage.releasePointerCapture(e.pointerId); } catch (_) {}

    if (!d.started) {
      if (d.blocked) return bump(d.blocked);
      if (!d.moved && e.type === 'pointerup') tap(e.clientX - d.rectLeft);
      return;
    }
    const vx = e.type === 'pointercancel' ? 0 : velocity(d);
    let target;
    if (vx < -VELOCITY_FLING) target = 1;        // flung leftwards → turn forward
    else if (vx > VELOCITY_FLING) target = 0;    // flung rightwards → turn back
    else target = d.p >= 0.5 ? 1 : 0;
    if (e.type === 'pointercancel') target = d.p0 < 0.5 ? 0 : 1; // abort → restore
    const pv = (-vx * 1000) / W; // progress units / s, continuous with the finger
    animateTo(d.turnIdx, d.p, target, pv);
  }

  function tap(x) {
    if (x < W * 0.33) turn(1);
    else if (x > W * 0.67) turn(-1);
    else app.classList.toggle('chrome-hidden');
  }

  stage.addEventListener('pointerdown', onDown);
  stage.addEventListener('pointermove', onMove);
  stage.addEventListener('pointerup', onUp);
  stage.addEventListener('pointercancel', onUp);
  // belt & braces for iOS: no scroll / rubber-band / pull-to-refresh while reading
  document.addEventListener('touchmove', (e) => { if (e.touches.length === 1) e.preventDefault(); }, { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  stage.addEventListener('contextmenu', (e) => e.preventDefault());

  window.addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('button')) {
      if (e.key === ' ' || e.key === 'Enter') return;
    }
    if (['ArrowLeft', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); turn(1); }
    else if (['ArrowRight', 'PageUp'].includes(e.key)) { e.preventDefault(); turn(-1); }
    else if (e.key === 'Home') jumpTo(0);
    else if (e.key === 'End') jumpTo(pages.length - 1);
  });

  // ───────── hint ─────────
  function dismissHint() {
    if (hint.classList.contains('gone')) return;
    hint.classList.add('gone');
    try { localStorage.setItem(HINT_KEY, '1'); } catch (_) {}
  }
  try { if (localStorage.getItem(HINT_KEY)) hint.classList.add('gone'); } catch (_) {}

  // ───────── fullscreen ─────────
  const root = document.documentElement;
  const canFs = !!(root.requestFullscreen || root.webkitRequestFullscreen);
  const isStandalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (canFs && !isStandalone) {
    fsBtn.hidden = false;
    fsBtn.addEventListener('click', () => {
      const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
      if (fsEl) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else (root.requestFullscreen || root.webkitRequestFullscreen).call(root, { navigationUI: 'hide' })?.catch?.(() => {});
    });
  }

  // ───────── boot + relayout ─────────
  let resizeT = 0;
  let lastSize = '';
  function relayout() {
    const size = `${book.clientWidth}x${book.clientHeight}`;
    if (size === lastSize) return;
    lastSize = size;
    stopAnim();
    build(currentOffset());
  }
  new ResizeObserver(() => {
    clearTimeout(resizeT);
    resizeT = setTimeout(relayout, 120);
  }).observe(book);

  function boot() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(STORE_KEY)); } catch (_) {}
    lastSize = `${book.clientWidth}x${book.clientHeight}`;
    build(saved);
  }

  boot();
  // repaginate once web fonts settle (metrics change page breaks)
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { stopAnim(); build(currentOffset()); });
    document.fonts.addEventListener?.('loadingdone', () => { if (!drag) { stopAnim(); build(currentOffset()); } });
  }
})();
