/**
 * 撮影用ホストの共通スクリプト。
 *
 * やること:
 * 1. 表示言語（ja / en）を決めて <html lang> へ反映する
 * 2. プレースホルダのように属性でしか持てない文言を、選んだ言語へ差し替える
 * 3. キーボードが出ている間も構図が動かないようにする
 * 4. アプリへ戻ってきたら必ずメニューから始まる状態にする
 *
 * 3と4が無いと撮影手順が再現しない。ホーム画面へ追加したスタンドアロンのWebアプリは
 * 起動し直しても前回のDOMをそのまま復元するため、本文を入れたまま中断すると
 * 次の起動が「入力済み・スクロール済み」の画面から始まり、座標がすべてずれる。
 */

const STORAGE_KEY = 'cliptap-host-lang';

/* ======================================== */
/* 言語 */
/* ======================================== */

/**
 * 選んだ言語を保存する
 *
 * ホーム画面へ追加すると起動URLが固定され、クエリで毎回渡せないため残しておく。
 *
 * @param {'ja' | 'en'} lang 言語コード
 */
function saveLang(lang) {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* プライベートモード等で書けなくても、その場の表示は切り替わる */
  }
}

/**
 * 表示言語を決める
 *
 * 優先順は クエリ > 保存値 > 端末の言語。ja 以外はすべて en とみなす
 * （apps/mobile の i18n と同じ規則）。
 *
 * @returns {'ja' | 'en'} 言語コード
 */
function resolveLang() {
  const fromQuery = new URLSearchParams(location.search).get('lang');
  if (fromQuery === 'ja' || fromQuery === 'en') {
    saveLang(fromQuery);
    return fromQuery;
  }

  let saved = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch {
    /* 読めなければ端末の言語へ落ちる */
  }
  if (saved === 'ja' || saved === 'en') return saved;

  return (navigator.language || 'en').startsWith('ja') ? 'ja' : 'en';
}

/**
 * 言語を適用する
 *
 * data-ja / data-en を持つ要素の文言を差し替える。
 * contenteditable は data-placeholder、フォーム部品は placeholder、それ以外は本文。
 * 地の文は .ja / .en の併記をCSSで出し分けるため、ここでは触らない。
 *
 * @param {'ja' | 'en'} lang 言語コード
 */
function applyLang(lang) {
  document.documentElement.lang = lang;

  for (const el of document.querySelectorAll('[data-ja][data-en]')) {
    const text = el.getAttribute(`data-${lang}`);
    if (el.isContentEditable) {
      el.dataset.placeholder = text;
    } else if (el.placeholder !== undefined) {
      el.placeholder = text;
    } else {
      el.textContent = text;
    }
  }

  for (const button of document.querySelectorAll('[data-set-lang]')) {
    button.setAttribute('aria-pressed', String(button.dataset.setLang === lang));
  }
}

applyLang(resolveLang());

for (const button of document.querySelectorAll('[data-set-lang]')) {
  button.addEventListener('click', () => {
    const lang = button.dataset.setLang === 'ja' ? 'ja' : 'en';
    saveLang(lang);
    applyLang(lang);
  });
}

/* ======================================== */
/* 構図の固定 */
/* ======================================== */

/**
 * 本文の高さを「見えている範囲」に合わせる
 *
 * キーボードが出ると visualViewport だけが縮み、ページの高さは画面いっぱいのまま残る。
 * iOSはキャレットを見せようとページごとスクロールするため、ナビや宛先が画面の上へ消える。
 * 見えている高さにbodyを詰めれば、そもそもページのスクロールが起こらない。
 */
function fitToViewport() {
  const viewport = window.visualViewport;
  if (viewport) {
    document.body.style.height = `${viewport.height}px`;
  }
  window.scrollTo(0, 0);
}

if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', fitToViewport);
  window.visualViewport.addEventListener('scroll', fitToViewport);
}
fitToViewport();

/**
 * 入力欄の表示を先頭へ戻す
 *
 * 長い定型文を入れるとキャレットが末尾へ行き、撮ると本文の書き出しが隠れる。
 * iOSは input のあとでキャレット位置へスクロールし直すので、その後にもう一度戻す。
 *
 * @param {HTMLElement} el 入力欄
 */
function scrollToStart(el) {
  el.scrollTop = 0;
  requestAnimationFrame(() => {
    el.scrollTop = 0;
  });
  setTimeout(() => {
    el.scrollTop = 0;
  }, 150);
}

for (const el of document.querySelectorAll('.editable')) {
  el.addEventListener('input', () => scrollToStart(el));

  /* タップされた欄へ明示的にフォーカスを移す。
     WebView内では contenteditable どうしのフォーカス移動がタップだけでは起こらず、
     最初に触れた欄へ入り続ける。入力フォームのように欄が複数ある面で、
     2つ目以降の欄へショートカットを入れられなくなる（実測）。 */
  el.addEventListener('click', () => el.focus());
}

/* 文字数の表示を本文に連動させる。
   固定の「0 / 280」のまま本文だけ入っていると、掲載画像として辻褄が合わない。 */
for (const counter of document.querySelectorAll('[data-count-for]')) {
  const target = document.querySelector(counter.dataset.countFor);
  if (!target) continue;
  const limit = (counter.textContent.split('/')[1] || '').trim();
  const update = () => {
    counter.textContent = `${[...(target.textContent || '')].length} / ${limit}`;
  };
  target.addEventListener('input', update);
  update();
}

/* ======================================== */
/* 復帰時の初期化 */
/* ======================================== */

/**
 * アプリへ戻ってきたときの初期化
 *
 * 入力欄の画面から復帰したら、入力済みの本文とスクロール位置を引きずらないよう
 * メニューへ戻す。メニューは高さを取り直すだけでよい。
 * これで撮影は必ず「メニュー → レイアウトを選ぶ → 入力欄」の順で始まる。
 */
function resetOnResume() {
  if (document.body.dataset.screen === 'menu') {
    fitToViewport();
    return;
  }
  location.replace('index.html');
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) resetOnResume();
});

/* 戻るはボタンで置いている。<a> にするとWebKitがリンクの下線を子へ引き継ぎ、
   text-decoration: none では消えないことがあるため（撮影画像に青い下線が写る）。 */
for (const button of document.querySelectorAll('[data-back]')) {
  button.addEventListener('click', () => {
    location.href = 'index.html';
  });
}
