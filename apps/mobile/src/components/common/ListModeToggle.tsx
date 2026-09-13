/**
 * 定型文／ショートカットの表示切替トグル
 *
 * 角丸のトラックの中をノブが左右に動く切替スイッチ。
 * 左（無彩色・書類のアイコン）が定型文、右（アクセント色・稲妻のアイコン）がショートカットを表す。
 *
 * 【拡張キーボードと同じ見た目にしている理由】
 * 同じ「一覧の表示対象を切り替える」操作をアプリとキーボードの両方で行うため、
 * 見た目と位置を揃えて、どちらでも同じものだと分かるようにしている。
 * 寸法はiOSの `ListModeToggle`（KeyboardViewController.swift）と
 * Androidの `shortcutToggle`（keyboard_view.xml）に合わせた値で、
 * 変えるときは3実装を同じ変更で揃えること。
 *
 * 【状態を持たない理由】
 * 表示対象はホーム画面が持つ正本で、追加ボタンの行き先やカテゴリチップの集合も
 * 同じ値で決まる。トグル内に2つ目の状態を作らないため、制御コンポーネントにしている。
 *
 * @see apps/mobile/app/index.tsx - ホーム画面での使用
 */

import { useEffect, useState } from 'react';
import { Animated, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '@cliptap/shared';
import { useTheme } from '@lib/themeSystem';
import { UI_CONSTANTS } from '@constants/ui';

/* ========================================
   定数（拡張キーボードと同値）
   ======================================== */

/** トラックの幅（pt）。iOS `ListModeToggle.trackWidth` / Android `shortcutToggle` の52dpと同値 */
const TRACK_WIDTH = 52;

/** トラックの高さ（pt）。カテゴリチップとソートボタンの高さとも揃う */
const TRACK_HEIGHT = UI_CONSTANTS.SIZE.ICON_CONTAINER_MD;

/** トラックとノブの隙間（pt）。iOS `ListModeToggle.knobInset` と同値 */
const KNOB_INSET = 2;

/** ノブの直径（pt）。トラックの高さから上下のインセットを引いた値 */
const KNOB_SIZE = TRACK_HEIGHT - KNOB_INSET * 2;

/** ノブが左端から右端まで動く距離（pt）。Android `TOGGLE_KNOB_TRAVEL_DP` と同値 */
const KNOB_TRAVEL = TRACK_WIDTH - KNOB_SIZE - KNOB_INSET * 2;

/**
 * ノブの移動にかける時間（ミリ秒）
 *
 * 共通のANIMATION_DURATIONは最短でも220msで、
 * 「アニメーションは100ms以内」という規約に収まらないためここで持つ。
 * キーボード側（iOS 0.1秒 / Android 100ms）とも同値。
 */
const ANIMATION_DURATION_MS = 100;

/** タップ領域を最小44x44（iOS HIG）まで広げるための上下の余白（pt） */
const HIT_SLOP_VERTICAL = (44 - TRACK_HEIGHT) / 2;

/* ========================================
   Props定義
   ======================================== */

/**
 * ListModeToggleのProps
 * @property isShowingShortcuts - ショートカットを表示中ならtrue（ノブが右へ寄る）
 * @property onToggle - 押されたときに呼ぶ（呼び出し側が反対側へ切り替える）
 */
interface ListModeToggleProps {
  isShowingShortcuts: boolean;
  onToggle: () => void;
}

export function ListModeToggle({ isShowingShortcuts, onToggle }: ListModeToggleProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  /* 初期値をアニメーションなしで確定させ、表示直後にノブが滑らないようにする。
     useRefの.currentはレンダー中に読めないため、SplashScreenと同じくuseStateの遅延初期化で持つ */
  const [knobOffset] = useState(() => new Animated.Value(isShowingShortcuts ? KNOB_TRAVEL : 0));

  useEffect(() => {
    Animated.timing(knobOffset, {
      toValue: isShowingShortcuts ? KNOB_TRAVEL : 0,
      duration: ANIMATION_DURATION_MS,
      useNativeDriver: true,
    }).start();
  }, [isShowingShortcuts, knobOffset]);

  return (
    /* 読み上げは「押したら何が起きるか」を伝えるため、見た目とは向きが逆になる */
    <TouchableOpacity
      style={[styles.track, { borderColor: colors.border }]}
      onPress={onToggle}
      hitSlop={{ top: HIT_SLOP_VERTICAL, bottom: HIT_SLOP_VERTICAL, left: 0, right: 0 }}
      accessibilityRole="button"
      accessibilityLabel={
        isShowingShortcuts ? t('shortcut.show_snippets') : t('shortcut.show_shortcuts')
      }
    >
      {/* ノブは白固定。今どちら側かは、ノブの位置と中のアイコンの形で示す。
          表示対象で色を変えないのは、色が変わる箇所が増えるほど
          「どこを見れば今の状態が分かるのか」がぼやけるため */}
      <Animated.View
        style={[
          styles.knob,
          {
            backgroundColor: colors.onPrimary,
            transform: [{ translateX: knobOffset }],
          },
        ]}
      >
        {/* アイコンは今どちらの一覧かを表す（定型文=書類、ショートカット=稲妻）。
            色は両方で同じにし、形だけで見分ける */}
        <Ionicons
          name={isShowingShortcuts ? 'flash' : 'document-text-outline'}
          size={UI_CONSTANTS.ICON_SIZE.XS}
          color={colors.textSecondary}
        />
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  /* トラックは塗りを持たず、ノブが動く範囲を示す枠線だけを引く */
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    /* 高さの半分でピル形にする */
    borderRadius: TRACK_HEIGHT / 2,
    borderWidth: UI_CONSTANTS.BORDER_WIDTH.THIN,
    justifyContent: 'center',
    padding: KNOB_INSET,
  },
  knob: {
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: KNOB_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
