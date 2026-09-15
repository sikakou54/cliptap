/**
 * モーダル表示時に背景スクロールを無効化するカスタムフック
 *
 * @description
 * モーダルやドロワーが開いている間、背景のスクロールを防ぐ。
 * コンポーネントがアンマウントされた場合も自動的にスクロールを復元する。
 */
import { useEffect } from 'react';

let activeLocks = 0;
let originalOverflow = '';

export function useBodyScrollLock(isLocked: boolean): void {
  useEffect(() => {
    if (!isLocked) return undefined;

    if (activeLocks === 0) {
      originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    activeLocks += 1;

    return () => {
      activeLocks = Math.max(0, activeLocks - 1);
      if (activeLocks === 0) {
        document.body.style.overflow = originalOverflow;
      }
    };
  }, [isLocked]);
}
