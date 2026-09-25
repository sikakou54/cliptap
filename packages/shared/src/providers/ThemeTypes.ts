/**
 * テーマ関連の共通型定義（Mobile/Web共通）
 *
 * @description
 * テーマプロバイダーのインターフェースを定義。
 * 各プラットフォーム（Mobile/Web）は独自の実装を持つが、
 * 共通のインターフェースに従うことで一貫性を保つ。
 *
 * 設計方針:
 * - プラットフォーム非依存の型定義
 * - 最小限の共通インターフェース
 * - 拡張可能な構造
 *
 * @module ThemeTypes
 */

/* ======================================== */
/* 型定義 */
/* ======================================== */

/**
 * テーマモードの型定義
 * - 'light': 常にライトモード
 * - 'dark': 常にダークモード
 * - 'auto': システム設定に追従
 */
export type ThemeMode = 'light' | 'dark' | 'auto';

/**
 * テーマコンテキストの基本型定義
 * 各プラットフォームのThemeProviderはこのインターフェースを拡張する
 */
export interface BaseThemeContextType {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  isDark: boolean;
}

/**
 * セマンティックカラーの型定義
 * プラットフォーム間で共通のカラー名を定義
 */
export interface SemanticColors {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  secondary: string;
  accent: string;

  success: string;
  warning: string;
  error: string;
  danger: string;
  info: string;

  background: string;
  surface: string;
  surfaceElevated: string;
  card: string;

  text: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;

  /**
   * 彩度の高い塗り潰し背景（primary / success / 利用者が選んだカテゴリ色）の上に置く前景色
   *
   * @remarks
   * textInverse はテーマごとに反転する（ライトで白、ダークで黒）ため、
   * ダークモードでも明るいままの primary やカテゴリ色の上に載せるとコントラストが落ちる。
   * 選択中チップの文字色・ボタンのラベル・カラースウォッチの選択枠のように
   * 「塗り潰しの上だから白で固定したい」用途はこちらを使う。
   */
  onPrimary: string;

  /**
   * onPrimary と同じ塗り潰し背景の上に敷く、弱めた前景色
   *
   * @remarks
   * 選択中チップの中に入るカウントバッジ背景のように、白をそのまま敷くと強すぎる場面で使う。
   */
  onPrimaryMuted: string;

  border: string;
  divider: string;

  overlay: string;
  backdropLight: string;

  /**
   * 影の色（shadowColor / elevation の影）
   *
   * @remarks
   * 影の濃さは shadowOpacity 側で調整するため、色自体はライト・ダークとも黒で固定する。
   * 各コンポーネントに散っていた '#000' のハードコードを1か所へ集めるために用意している。
   */
  shadow: string;

  /**
   * 定型文／ショートカットの表示切替トグルのノブの塗り（定型文を表示中。紺）
   *
   * @remarks
   * トグルはノブの位置・アイコンの形・ノブの色の3つで表示対象を示す（紺＝定型文、黄＝ショートカット）。
   * どちらの一覧かを表す識別色のため、onPrimary と同じくライト・ダークで同じ値に固定する。
   * Web・拡張キーボード（iOS・Android）も同値で持つため、変えるときは揃えること。
   */
  listModeSnippet: string;

  /** listModeSnippet の塗りの上に置くアイコンの色 */
  onListModeSnippet: string;

  /** 表示切替トグルのノブの塗り（ショートカットを表示中。黄）。扱いは listModeSnippet と同じ */
  listModeShortcut: string;

  /** listModeShortcut の塗りの上に置くアイコンの色 */
  onListModeShortcut: string;
}

/**
 * ライトモード用のデフォルトカラー
 * Mobile版themeSystem.tsxのLIGHT_COLORSと統一
 */
export const LIGHT_THEME_COLORS: SemanticColors = {
  /* Primary & Secondary */
  primary: '#3B82F6',
  primaryDark: '#2563EB',
  primaryLight: '#93C5FD',
  secondary: '#10B981',
  accent: '#F59E0B',

  /* Semantic Colors */
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  danger: '#EF4444',
  info: '#3B82F6',

  /* Backgrounds */
  background: '#FFFFFF',
  surface: '#F8FAFC',
  surfaceElevated: '#FFFFFF',
  card: '#F8FAFC',

  /* Text Colors */
  text: '#111827',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  textInverse: '#FFFFFF',

  /* 塗り潰し背景の上の前景色（ライト・ダーク共通で固定） */
  onPrimary: '#FFFFFF',
  onPrimaryMuted: 'rgba(255, 255, 255, 0.3)',

  /* Border & Divider */
  border: '#E5E7EB',
  divider: '#F3F4F6',

  /* Overlays */
  overlay: 'rgba(0, 0, 0, 0.5)',
  backdropLight: 'rgba(255, 255, 255, 0.8)',

  /* Shadow（濃さは shadowOpacity 側で調整するため色は固定） */
  shadow: '#000000',

  /* 表示切替トグルのノブ（識別色のためライト・ダーク共通で固定。紺＝定型文、黄＝ショートカット） */
  listModeSnippet: '#212B3C',
  onListModeSnippet: '#FFFFFF',
  listModeShortcut: '#FBBF24',
  onListModeShortcut: '#212B3C',
};

/**
 * ダークモード用のデフォルトカラー
 * Mobile版themeSystem.tsxのDARK_COLORSと統一
 */
export const DARK_THEME_COLORS: SemanticColors = {
  /* Primary & Secondary */
  primary: '#60A5FA',
  primaryDark: '#3B82F6',
  primaryLight: '#DBEAFE',
  secondary: '#34D399',
  accent: '#FBBF24',

  /* Semantic Colors */
  success: '#34D399',
  warning: '#FBBF24',
  error: '#F87171',
  danger: '#F87171',
  info: '#60A5FA',

  /* Backgrounds (Mobile版に合わせて #000000 ベース) */
  background: '#000000',
  surface: '#1A1A1A',
  surfaceElevated: '#2A2A2A',
  card: '#1A1A1A',

  /* Text Colors (Mobile版に合わせる) */
  text: '#FFFFFF',
  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0A0',
  textTertiary: '#707070',
  textInverse: '#000000',

  /* 塗り潰し背景の上の前景色（ダークでも primary は明るいままのため反転させない） */
  onPrimary: '#FFFFFF',
  onPrimaryMuted: 'rgba(255, 255, 255, 0.3)',

  /* Border & Divider */
  border: '#2A2A2A',
  divider: '#333333',

  /* Overlays (ダークモードでは濃いめ) */
  overlay: 'rgba(0, 0, 0, 0.8)',
  backdropLight: 'rgba(0, 0, 0, 0.9)',

  /* Shadow（濃さは shadowOpacity 側で調整するため色は固定） */
  shadow: '#000000',

  /* 表示切替トグルのノブ（識別色のためライトと同じ値。紺＝定型文、黄＝ショートカット） */
  listModeSnippet: '#212B3C',
  onListModeSnippet: '#FFFFFF',
  listModeShortcut: '#FBBF24',
  onListModeShortcut: '#212B3C',
};

/**
 * テーマカラーを取得するユーティリティ関数
 * @param isDark - ダークモードかどうか
 * @returns 適切なカラーセット
 */
export function getThemeColors(isDark: boolean): SemanticColors {
  return isDark ? DARK_THEME_COLORS : LIGHT_THEME_COLORS;
}
