/**
 * サイドメニューの開閉を管理するカスタムフック
 *
 * @description
 * 画面が広いときはサイドメニューが本文を右へ押し出して並び、狭いときは本文へ覆いかぶさる。
 * どちらの幅でもヘッダーのハンバーガーボタンで開閉できる。
 *
 * @remarks
 * 【開閉状態を保存する理由】
 * 画面ごとにこのフックを呼ぶため（ダッシュボードと設定系の各画面）、保存しないと
 * 画面を移るたびに開いた状態へ戻ってしまう。保存しておけば、画面移動でもページの
 * 開き直しでも同じ状態で続けられる。
 *
 * 【狭い画面では保存値を使わない理由】
 * 狭い画面のサイドメニューは本文へ覆いかぶさる。開いた状態で復元すると、開いた覚えのない
 * メニューが本文を隠したまま始まってしまう。狭い画面では常に閉じた状態から始める。
 *
 * @module useSideMenu
 */
import { useState, useCallback, useEffect } from 'react';

/** 開閉状態の保存先（localStorage） */
const SIDE_MENU_OPEN_KEY = '@side_menu_open';

/**
 * 本文を押し出して並べる最小幅
 *
 * @remarks
 * Tailwindの `md`（768px）と同じ。クラス側の `md:` と食い違うと、
 * 覆いかぶさっているのに押し出し用の余白が残るなどのずれが起きる。
 */
const SIDE_BY_SIDE_QUERY = '(min-width: 768px)';

interface UseSideMenuReturn {
  /** サイドメニューが開いているか */
  isOpen: boolean;
  /** 本文へ覆いかぶさる幅か（狭い画面ならtrue） */
  isOverlay: boolean;
  /** 開閉をトグル */
  toggle: () => void;
  /** 閉じる（覆いかぶさっているときのリンククリック後などに使用） */
  close: () => void;
}

/** 保存されている開閉状態を読む（保存が使えない環境では開いた状態にする） */
function readStoredOpen(): boolean {
  try {
    return localStorage.getItem(SIDE_MENU_OPEN_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function useSideMenu(): UseSideMenuReturn {
  const [isOverlay, setIsOverlay] = useState(() => !window.matchMedia(SIDE_BY_SIDE_QUERY).matches);
  const [isOpen, setIsOpen] = useState(() => (
    window.matchMedia(SIDE_BY_SIDE_QUERY).matches ? readStoredOpen() : false
  ));

  /* 画面幅の変化に追従する。覆いかぶさる幅へ変わったときは閉じ、本文が隠れたままにならないようにする */
  useEffect(() => {
    const media = window.matchMedia(SIDE_BY_SIDE_QUERY);
    const handleChange = (event: MediaQueryListEvent) => {
      setIsOverlay(!event.matches);
      setIsOpen(event.matches ? readStoredOpen() : false);
    };
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  /**
   * 開閉状態を覚える
   *
   * @param open - 開いているか
   *
   * @remarks
   * 覚えるのは押し出して並べているときだけ。覆いかぶさる幅での開閉は一時的なものなので、
   * 狭い画面で閉じた状態を広い画面へ持ち込まない。
   */
  const persist = useCallback((open: boolean) => {
    if (isOverlay) return;
    try {
      localStorage.setItem(SIDE_MENU_OPEN_KEY, String(open));
    } catch {
      /* 保存できなくても開閉そのものは動く */
    }
  }, [isOverlay]);

  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      persist(next);
      return next;
    });
  }, [persist]);

  const close = useCallback(() => {
    setIsOpen(false);
    persist(false);
  }, [persist]);

  return { isOpen, isOverlay, toggle, close };
}
