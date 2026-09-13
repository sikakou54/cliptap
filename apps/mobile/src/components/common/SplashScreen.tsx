/**
 * カスタムスプラッシュスクリーンコンポーネント
 *
 * アプリ起動時に表示されるスプラッシュ画面。
 * アプリアイコンを1秒表示した後、フェードアウトして終了。
 *
 * 動作フロー:
 * 1. コンポーネントマウント時にonReadyを呼び出し、同時に保持時間の計測を開始
 * 2. 保持時間（1秒）の経過と、isLoadingがfalseになることの両方を待つ
 * 3. 500msかけてフェードアウト
 * 4. onFinishコールバックで終了を通知
 *
 * 技術的ポイント:
 * - Animated.Valueでスムーズなフェードアウト
 * - useNativeDriver: false でフェードアウト（アニメーション対象は opacity のみ）
 * - 保持時間はマウント時点から数える。isLoadingの完了後に数え始めると、
 *   初期化の待ちと直列に積み上がって起動が遅くなる
 * - 不透明な間はタッチを遮断し、フェード中だけ下位へ透過する
 * - zIndex: 9999で最前面に表示
 *
 * @see app/_layout.tsx - 使用例
 */

import { useEffect, useRef, useState } from 'react';
import { View, Image, Animated, StyleSheet } from 'react-native';
import appIcon from '@assets/icon.png';

/** スプラッシュ背景色。apps/mobile/app.json の expo-splash-screen プラグイン設定 backgroundColor と同値に保つ必要があるため、テーマ色ではなく固定値を使う */
const SPLASH_BACKGROUND_COLOR = '#1F2937';

/** フェードアウト開始までの待機時間 */
const SPLASH_HOLD_MS = 1000;

/** フェードアウトにかける時間 */
const SPLASH_FADE_MS = 500;

/*
 * ========================================
 * Props定義
 * ========================================
 */

/**
 * SplashScreenのProps
 * @property onFinish - スプラッシュ終了時のコールバック（メインコンテンツ表示開始）
 * @property isLoading - 初期化処理中フラグ（trueの間はフェードアウトを待機）
 * @property onReady - コンポーネント準備完了コールバック（ネイティブスプラッシュ非表示用）
 */
interface SplashScreenProps {
  onFinish: () => void;
  isLoading?: boolean;
  onReady?: () => void;
}

export function SplashScreen({ onFinish, isLoading, onReady }: SplashScreenProps) {
  /*
   * ========================================
   * Refs / State
   * ========================================
   */
  /** フェードアニメーション値（1=完全表示, 0=完全透明） */
  /* useStateの初期化子は初回マウント時のみ評価されるため、useRefと同じ単一インスタンスを保持する */
  const [fadeAnim] = useState(() => new Animated.Value(1));
  const hasCalledReady = useRef(false);

  /** 保持時間が経過したか */
  const [isHoldElapsed, setIsHoldElapsed] = useState(false);

  /*
   * ========================================
   * 副作用（useEffect）
   * ========================================
   */

  /**
   * コンポーネント準備完了通知
   * requestAnimationFrameを3回ネストして確実に描画完了後にonReadyを実行
   */
  useEffect(() => {
    if (!hasCalledReady.current && onReady) {
      hasCalledReady.current = true;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            onReady();
          });
        });
      });
    }
  }, [onReady]);

  /**
   * 保持時間の計測
   * マウント直後から数え始めることで、初期化の待ちと並行して進む。
   * isLoadingの完了後に数え始めると、その待ちに1秒が上乗せされてしまう。
   */
  useEffect(() => {
    const timer = setTimeout(() => setIsHoldElapsed(true), SPLASH_HOLD_MS);

    return () => clearTimeout(timer);
  }, []);

  /**
   * フェードアウトアニメーション制御
   * 保持時間の経過と初期化の完了が揃ったら、SPLASH_FADE_MSかけてフェードアウトする。
   * アニメーション対象は Animated.View の opacity のみ。背景色は非アニメーションの wrapper が
   * SPLASH_BACKGROUND_COLOR で塗るため、フェード中も背景色は変化しない。
   */
  useEffect(() => {
    if (isLoading || !isHoldElapsed) {
      return;
    }

    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: SPLASH_FADE_MS,
      useNativeDriver: false,
    }).start(() => {
      onFinish();
    });
  }, [fadeAnim, onFinish, isLoading, isHoldElapsed]);

  /*
   * ========================================
   * レンダリング
   * ========================================
   */

  /* スプラッシュスクリーン（最前面に表示）
     不透明で覆っている間はタッチを遮断する。透過したままだと、見えていないホーム画面の
     定型文カードに指が当たってクリップボードが書き換わる。
     フェードが始まってからは下位へ透過し、従来どおり素早く操作を始められるようにする */
  return (
    <View style={styles.wrapper} pointerEvents={isLoading || !isHoldElapsed ? 'auto' : 'none'}>
      {/* フェードアニメーションコンテナ */}
      <Animated.View
        style={[
          styles.container,
          {
            opacity: fadeAnim,
          },
        ]}
      >
        {/* アプリアイコン */}
        <Image
          source={appIcon}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
}

/*
 * ========================================
 * スタイル定義
 * ========================================
 */
const styles = StyleSheet.create({
  /** 画面全体を覆い、他のどの要素よりも前面に出す不透明なレイヤ */
  wrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: SPLASH_BACKGROUND_COLOR,
    zIndex: 9999,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 200,
    height: 200
  },
});
