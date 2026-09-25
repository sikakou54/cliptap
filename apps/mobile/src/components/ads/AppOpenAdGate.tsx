/**
 * 起動時App Open広告ゲート
 *
 * @description
 * 起動時のApp Open広告の表示判定だけを担うコンポーネント。画面には何も描画しない。
 * 広告そのものはAdMob SDKがネイティブの全画面として表示するため、React側に描画物は無い。
 *
 * 【コンポーネントとして置く理由】
 * 判定には加入状態が必要で、SubscriptionProviderの内側でしかフックを呼べない。
 * 一方でスプラッシュの表示状態はProviderの外側にあるルートレイアウトが持つ。
 * 判定だけを行うこのコンポーネントをProviderの内側へ挿し、スプラッシュの状態をpropsで受け取り、
 * 広告の準備の決着をコールバックで返すことで、ナビゲーションを組み立てるAppContentに広告の責務を持ち込まずに両者をつなぐ。
 *
 * @see src/hooks/useAppOpenAd.ts - 表示条件と失敗時の扱い
 */

import { useAppOpenAd } from '@hooks/useAppOpenAd';

/* ========================================
   Props定義
   ======================================== */

/**
 * AppOpenAdGateのProps
 * @property isSplashFinished - スプラッシュの表示が完全に終わったか（広告はこれがtrueになった直後に表示する）
 * @property onSettled - 広告の準備が決着したとき（ロード完了、または表示しないと決まったとき）に呼ぶ。スプラッシュはこれを待って閉じる
 */
interface AppOpenAdGateProps {
  isSplashFinished: boolean;
  onSettled: () => void;
}

export function AppOpenAdGate({ isSplashFinished, onSettled }: AppOpenAdGateProps) {
  useAppOpenAd({ isSplashFinished, onSettled });

  /* 判定専用のため描画しない */
  return null;
}
