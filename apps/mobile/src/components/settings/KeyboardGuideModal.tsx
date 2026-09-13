/**
 * キーボード設定ガイドモーダル
 *
 * キーボード拡張機能の設定方法を4ステップで案内。
 * iOS/Androidそれぞれに対応したガイドテキストを表示。
 */
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform } from 'react-native';
import { useTranslation } from '@cliptap/shared';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@lib/themeSystem';

interface KeyboardGuideModalProps {
  visible: boolean;
  onClose: () => void;
}

export function KeyboardGuideModal({ visible, onClose }: KeyboardGuideModalProps) {
  /* ========================================
     Hooks & コンテキスト
     ======================================== */
  /* 多言語化: 翻訳関数を取得 */
  const { t } = useTranslation();
  /* テーマ: 色とレスポンシブフォントサイズを取得 */
  const { colors, responsiveFontSizes } = useTheme();

  /**
   * ガイドの手順（4手順固定）
   *
   * 翻訳キーは文字列リテラルで書く。組み立てるとキーの追加漏れを
   * 未定義キー検出テストも全文検索も捕まえられず、
   * 画面にキー名がそのまま出るまで気付けない。
   */
  const steps = [
    { number: 1, ios: 'subscription.keyboard_guide_step1_ios', android: 'subscription.keyboard_guide_step1_android' },
    { number: 2, ios: 'subscription.keyboard_guide_step2_ios', android: 'subscription.keyboard_guide_step2_android' },
    { number: 3, ios: 'subscription.keyboard_guide_step3_ios', android: 'subscription.keyboard_guide_step3_android' },
    { number: 4, ios: 'subscription.keyboard_guide_step4_ios', android: 'subscription.keyboard_guide_step4_android' },
  ] as const;

  /* ========================================
     レンダリング
     ======================================== */
  /* キーボード設定ガイドモーダル（フェードインアニメーション付き） */
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      {/* モーダルオーバーレイ（背景暗転） */}
      <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
        {/* モーダルコンテンツ（背景色はテーマのsurfaceを適用） */}
        <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
          {/* ヘッダー: アイコンとタイトル */}
          <View style={styles.modalHeader}>
            {/* キーボードアイコン */}
            <Ionicons name="keypad" size={48} color={colors.primary} />
            {/* タイトル: iOS/Androidで異なるテキストを表示 */}
            <Text style={[styles.modalTitle, { color: colors.text, fontSize: responsiveFontSizes.lg }]}>
              {t(Platform.OS === 'ios' ? 'subscription.keyboard_guide_title_ios' : 'subscription.keyboard_guide_title_android')}
            </Text>
          </View>

          {/* ガイドステップリスト */}
          <View style={styles.guideSteps}>
            {/* 各ステップ（1〜4）をmap表示 */}
            {steps.map((step) => (
              /* ガイドステップ */
              <View key={step.number} style={styles.guideStep}>
                {/* ステップ番号（円形バッジ） */}
                <View style={[styles.stepNumber, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.stepNumberText, { color: colors.onPrimary }]}>{step.number}</Text>
                </View>
                {/* ステップ説明テキスト（iOS/Android別） */}
                <Text style={[styles.stepText, { color: colors.text, fontSize: responsiveFontSizes.base }]}>
                  {t(Platform.OS === 'ios' ? step.ios : step.android)}
                </Text>
              </View>
            ))}
          </View>

          {/* フルアクセスの補足（iOSのみ） */}
          {/* キーボードからの挿入回数を記録するにはフルアクセスが必要だが、
              未許可でもキーボード自体は使えることを明示する */}
          {Platform.OS === 'ios' && (
            <View style={[styles.noteBox, { backgroundColor: colors.background }]}>
              <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
              <Text style={[styles.noteText, { color: colors.textSecondary, fontSize: responsiveFontSizes.sm }]}>
                {t('subscription.keyboard_guide_full_access_note')}
              </Text>
            </View>
          )}

          {/* ボタンエリア */}
          <View style={styles.modalButtons}>
            {/* OKボタン（閉じる） */}
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: colors.primary }]}
              onPress={onClose}
            >
              <Text style={[styles.modalButtonText, { color: colors.onPrimary, fontSize: responsiveFontSizes.base }]}>
                {t('common.ok')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ========================================
   スタイル定義
   ======================================== */
const styles = StyleSheet.create({
  /** モーダルオーバーレイ（背景暗転レイヤー。背景色は使用箇所でテーマの overlay を重ねる） */
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  /** モーダルコンテンツ（背景色は使用箇所でテーマのsurfaceを重ねる） */
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
  },
  /** モーダルヘッダー（アイコン+タイトル） */
  modalHeader: {
    alignItems: 'center',
    marginBottom: 24,
    gap: 12,
  },
  /** モーダルタイトル */
  modalTitle: {
    fontWeight: '600',
    textAlign: 'center',
  },
  /** ガイドステップリストコンテナ */
  guideSteps: {
    gap: 16,
    marginBottom: 24,
  },
  /** 個別ガイドステップ（番号+テキスト） */
  guideStep: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  /** ステップ番号バッジ（円形） */
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  /** ステップ番号テキスト（文字色は使用箇所でテーマの onPrimary を重ねる） */
  stepNumberText: {
    fontSize: 16,
    fontWeight: '600',
  },
  /** ステップ説明テキスト */
  stepText: {
    flex: 1,
    lineHeight: 24,
  },
  /** フルアクセス補足ボックス（iOSのみ表示） */
  noteBox: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 10,
    marginBottom: 24,
  },
  /** フルアクセス補足テキスト */
  noteText: {
    flex: 1,
    lineHeight: 20,
  },
  /** ボタンエリア */
  modalButtons: {
    gap: 12,
  },
  /** ボタン（OK） */
  modalButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  /** ボタンテキスト（文字色は使用箇所でテーマの onPrimary を重ねる） */
  modalButtonText: {
    fontWeight: '600',
  },
});
