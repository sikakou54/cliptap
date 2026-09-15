/**
 * 定型文／ショートカットの表示切替トグル
 *
 * 枠線だけの角丸のトラックの中を、同じ色の縁を付けたノブが左右に動く切替スイッチ。
 * 左（紺のノブに書類のアイコン）が定型文、右（黄色のノブに稲妻のアイコン）がショートカットを表す。
 *
 * 【拡張キーボード・Webと同じ見た目にしている理由】
 * 同じ「一覧の表示対象を切り替える」操作をアプリ・キーボード・Webで行うため、
 * 見た目と位置を揃えて、どこでも同じものだと分かるようにしている。
 * 寸法と配色はiOSの `ListModeToggle`（KeyboardViewController.swift）、
 * Androidの `shortcutToggle`（keyboard_view.xml）、Webの `ListModeToggle`
 * （apps/web/src/components/dashboard/ListModeToggle.tsx）に合わせた値で、
 * 変えるときは4実装を同じ変更で揃えること。
 *
 * 【ノブの色を表示対象で変える理由】
 * ノブの位置とアイコンの形に加えて色でも区別し、一目でどちらの一覧か分かるようにする。
 * 色はどちらの一覧かを表す識別色のため、テーマの listModeSnippet / listModeShortcut として
 * ライト・ダークで同じ値に固定している。トラックの枠線の色は表示対象で変えない。
 *
 * 【枠線を textTertiary にしている理由】
 * border（ライト #E5E7EB）では、iOSキーボードの背景（ライト #E2E4E8）に溶けてトラックが見えない。
 * また黄色のノブは白い背景に、紺のノブは黒い背景に溶けやすい。
 * そのため、白でも灰色でも黒でも見える textTertiary でトラックを囲み、ノブにも同じ色の縁を付ける。
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

/** トラックの外形からノブまでの距離（pt）。枠線の太さを含む。iOS `ListModeToggle.knobInset` と同値 */
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
      style={[styles.track, { borderColor: colors.textTertiary }]}
      onPress={onToggle}
      hitSlop={{ top: HIT_SLOP_VERTICAL, bottom: HIT_SLOP_VERTICAL, left: 0, right: 0 }}
      accessibilityRole="button"
      accessibilityLabel={
        isShowingShortcuts ? t('shortcut.show_snippets') : t('shortcut.show_shortcuts')
      }
    >
      {/* ノブ。定型文は紺、ショートカットは黄色で塗る。
          色はネイティブドライバで動かせないため、位置が動き始めると同時に切り替わる。
          背景に溶けないよう、トラックと同じ色の縁を付ける */}
      <Animated.View
        style={[
          styles.knob,
          {
            backgroundColor: isShowingShortcuts ? colors.listModeShortcut : colors.listModeSnippet,
            borderColor: colors.textTertiary,
            transform: [{ translateX: knobOffset }],
          },
        ]}
      >
        {/* アイコンは今どちらの一覧かを表す（定型文=書類、ショートカット=稲妻）。
            色はノブの塗りの上で読める色にする（紺の上は白、黄色の上は紺） */}
        <Ionicons
          name={isShowingShortcuts ? 'flash' : 'document-text-outline'}
          size={UI_CONSTANTS.ICON_SIZE.XS}
          color={isShowingShortcuts ? colors.onListModeShortcut : colors.onListModeSnippet}
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
    /* paddingは枠線の内側から数えるため、枠線の太さを引いてノブをトラックの外形から KNOB_INSET の位置に置く。
       引かないとノブが枠線の分だけ右へずれ、右端でノブの縁がトラックの枠線に接する */
    padding: KNOB_INSET - UI_CONSTANTS.BORDER_WIDTH.THIN,
  },
  knob: {
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: KNOB_SIZE / 2,
    borderWidth: UI_CONSTANTS.BORDER_WIDTH.THIN,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
