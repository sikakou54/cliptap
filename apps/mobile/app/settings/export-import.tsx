/**
 * @module ExportImportScreen
 * @description バックアップ・復元画面
 *
 * 全データのバックアップと、バックアップファイルによる復元（全件置換）を行う画面。
 *
 * @features
 * - バックアップ（全データを.cliptapファイルへ出力）
 * - 復元（確認後に現在のデータをファイルの内容で置き換え）
 * - パスワード一致とチェックサムによるファイル確認（暗号化ではない）
 *
 * @security
 * - パスワード + スキーマバージョンのSHA-256ハッシュ化
 * - 全フィールドのチェックサム検証
 *
 * @see src/hooks/screens/useExportImportScreen.ts - ビジネスロジック
 * @see packages/shared/src/services/ExportService.ts - バックアップ実処理
 * @see packages/shared/src/services/ImportService.ts - 復元実処理
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  TouchableWithoutFeedback,
  Keyboard,
  ActivityIndicator
} from 'react-native';
import { useTranslation } from '@cliptap/shared';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@lib/themeSystem';
import { SCHEMA_VERSION } from '@database/schema';
import { ScreenContainer } from '@components/common/ScreenContainer';
import { UI_CONSTANTS } from '@constants/ui';
import { useExportImportScreen } from '@hooks/screens/useExportImportScreen';

/* 使い方ガイドの手順。番号は配列順（index + 1）で描画する */
const HELP_STEPS = ['export_import.step1', 'export_import.step2', 'export_import.step3'] as const;

export default function ExportImportScreen() {
  const { t } = useTranslation();
  const { colors, responsiveFontSizes, responsiveLineHeights } = useTheme();

  const {
    showPasswordModal,
    modalMode,
    password,
    isProcessing,
    setPassword,
    handleExportBackup,
    handleImportBackup,
    handlePasswordSubmit,
    closePasswordModal,
  } = useExportImportScreen();

  const menuItems = [
    {
      id: 'export',
      icon: 'cloud-upload-outline' as const,
      label: t('export_import.export'),
      description: t('export_import.export_description'),
      onPress: handleExportBackup,
    },
    {
      id: 'import',
      icon: 'cloud-download-outline' as const,
      label: t('export_import.import'),
      description: t('export_import.import_description'),
      onPress: handleImportBackup,
    },
  ];

  return (
    <ScreenContainer title={t('export_import.title')} backIcon="arrow-back">
      <ScrollView style={styles.content}>
        {/* バージョン情報セクション */}
        <View style={styles.infoSection}>
          <View style={[styles.versionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.versionHeader}>
              <Ionicons name="information-circle-outline" size={24} color={colors.primary} />
              <Text style={[styles.versionLabel, { color: colors.text, fontSize: responsiveFontSizes.base, lineHeight: responsiveLineHeights.base }]}>
                {t('export_import.schema_version')} : {SCHEMA_VERSION}
              </Text>
            </View>
          </View>

          <View style={[styles.noticeCard, { backgroundColor: colors.warning + '15', borderColor: colors.warning + '40' }]}>
            <Ionicons name="warning-outline" size={20} color={colors.warning} style={styles.noticeIcon} />
            <Text style={[styles.noticeText, { color: colors.text, fontSize: responsiveFontSizes.sm, lineHeight: responsiveLineHeights.sm }]}>
              {t('export_import.version_notice')}
            </Text>
          </View>
        </View>

        {/* メニューセクション */}
        <View style={styles.menuSection}>
          <View style={[styles.menuGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {menuItems.map((item, index) => (
              <React.Fragment key={item.id}>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={item.onPress}
                  activeOpacity={0.7}
                  disabled={isProcessing}
                >
                  <View style={styles.menuLeft}>
                    <View style={[styles.iconContainer, { backgroundColor: colors.primary + '15' }]}>
                      <Ionicons name={item.icon} size={24} color={isProcessing ? colors.textSecondary : colors.primary} />
                    </View>
                    <View style={styles.menuTextContainer}>
                      <Text style={[styles.menuLabel, { color: isProcessing ? colors.textSecondary : colors.text, fontSize: responsiveFontSizes.base, lineHeight: responsiveLineHeights.base }]}>
                        {item.label}
                      </Text>
                      <Text style={[styles.menuDescription, { color: colors.textSecondary, fontSize: responsiveFontSizes.sm, lineHeight: responsiveLineHeights.sm }]}>
                        {item.description}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
                {index < menuItems.length - 1 && (
                  <View style={[styles.separator, { backgroundColor: colors.border }]} />
                )}
              </React.Fragment>
            ))}
          </View>
        </View>

        {/* 使い方ガイド */}
        <View style={styles.helpSection}>
          <Text style={[styles.helpTitle, { color: colors.text, fontSize: responsiveFontSizes.base, lineHeight: responsiveLineHeights.base }]}>
            {t('export_import.how_to_use')}
          </Text>
          <View style={[styles.helpCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {/* 使い方の手順 */}
            {HELP_STEPS.map((stepKey, index) => (
              <View key={stepKey} style={styles.helpItem}>
                <View style={[styles.helpNumber, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.helpNumberText, { color: colors.onPrimary }]}>{index + 1}</Text>
                </View>
                <Text style={[styles.helpText, { color: colors.text, fontSize: responsiveFontSizes.sm, lineHeight: responsiveLineHeights.sm }]}>
                  {t(stepKey)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* ローディングオーバーレイ */}
      {isProcessing && (
        <View style={[styles.loadingOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.loadingContainer, { backgroundColor: colors.surface }]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.text }]}>
              {t('common.processing')}
            </Text>
          </View>
        </View>
      )}

      {/* パスワード入力モーダル（バックアップ・復元で共用） */}
      <Modal
        visible={showPasswordModal}
        transparent
        animationType="fade"
        onRequestClose={closePasswordModal}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <View style={styles.modalHeader}>
                <Ionicons
                  name={modalMode === 'export' ? 'cloud-upload' : 'cloud-download'}
                  size={48}
                  color={colors.primary}
                />
                <Text style={[styles.modalTitle, { color: colors.text, fontSize: responsiveFontSizes.lg }]}>
                  {modalMode === 'export' ? t('export_import.export_title') : t('export_import.import_title')}
                </Text>
              </View>

              <View style={styles.passwordInputContainer}>
                <Text style={[styles.passwordLabel, { color: colors.text, fontSize: responsiveFontSizes.base }]}>
                  {t('export_import.enter_password')}
                </Text>
                <Text style={[styles.passwordHint, { color: colors.textSecondary, fontSize: responsiveFontSizes.sm }]}>
                  {modalMode === 'export'
                    ? t('export_import.export_password_hint')
                    : t('export_import.import_password_hint')}
                </Text>
                <TextInput
                  style={[
                    styles.passwordInput,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      color: colors.text,
                      fontSize: responsiveFontSizes.base,
                    },
                  ]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t('export_import.password_placeholder')}
                  placeholderTextColor={colors.textSecondary}
                  autoFocus
                  returnKeyType="done"
                  secureTextEntry
                />
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: colors.border }]}
                  onPress={closePasswordModal}
                >
                  <Text style={[styles.modalButtonText, { color: colors.text, fontSize: responsiveFontSizes.base }]}>
                    {t('common.cancel')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: colors.primary }]}
                  onPress={handlePasswordSubmit}
                >
                  <Text style={[styles.modalButtonText, { color: colors.onPrimary, fontSize: responsiveFontSizes.base }]}>
                    {t('common.ok')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  infoSection: {
    padding: UI_CONSTANTS.GAP.LG,
    gap: UI_CONSTANTS.GAP.BASE,
  },
  versionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: UI_CONSTANTS.GAP.LG,
    borderRadius: UI_CONSTANTS.BORDER_RADIUS.LG,
    borderWidth: UI_CONSTANTS.BORDER_WIDTH.THIN,
  },
  versionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: UI_CONSTANTS.GAP.MD,
  },
  versionLabel: {
    fontWeight: UI_CONSTANTS.FONT_WEIGHT.MEDIUM,
  },
  noticeCard: {
    flexDirection: 'row',
    padding: UI_CONSTANTS.GAP.BASE,
    borderRadius: UI_CONSTANTS.BORDER_RADIUS.BASE,
    borderWidth: UI_CONSTANTS.BORDER_WIDTH.THIN,
    gap: UI_CONSTANTS.GAP.MD,
  },
  noticeIcon: {
    marginTop: 2,
  },
  noticeText: {
    flex: 1,
  },
  menuSection: {
    paddingHorizontal: UI_CONSTANTS.GAP.LG,
  },
  menuGroup: {
    borderRadius: UI_CONSTANTS.BORDER_RADIUS.LG,
    borderWidth: UI_CONSTANTS.BORDER_WIDTH.THIN,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: UI_CONSTANTS.GAP.LG,
  },
  separator: {
    height: UI_CONSTANTS.BORDER_WIDTH.THIN,
    marginLeft: 72,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: UI_CONSTANTS.GAP.BASE,
    flex: 1,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: UI_CONSTANTS.BORDER_RADIUS.BASE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuTextContainer: {
    flex: 1,
    gap: UI_CONSTANTS.GAP.XXS,
  },
  menuLabel: {
    fontWeight: UI_CONSTANTS.FONT_WEIGHT.MEDIUM,
  },
  menuDescription: {},
  helpSection: {
    padding: UI_CONSTANTS.GAP.LG,
    gap: UI_CONSTANTS.GAP.BASE,
  },
  helpTitle: {
    fontWeight: UI_CONSTANTS.FONT_WEIGHT.SEMIBOLD,
    marginLeft: UI_CONSTANTS.GAP.XS,
  },
  helpCard: {
    borderRadius: UI_CONSTANTS.BORDER_RADIUS.LG,
    borderWidth: UI_CONSTANTS.BORDER_WIDTH.THIN,
    padding: UI_CONSTANTS.GAP.LG,
    gap: UI_CONSTANTS.GAP.LG,
  },
  helpItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: UI_CONSTANTS.GAP.BASE,
  },
  helpNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  /** 手順番号のテキスト（文字色は使用箇所でテーマの onPrimary を重ねる） */
  helpNumberText: {
    fontSize: 12,
    fontWeight: '600',
  },
  helpText: {
    flex: 1,
  },
  /** モーダルオーバーレイ（背景色は使用箇所でテーマの overlay を重ねる） */
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 24,
    gap: 12,
  },
  modalTitle: {
    fontWeight: '600',
    textAlign: 'center',
  },
  passwordInputContainer: {
    gap: 12,
    marginBottom: 24,
  },
  passwordLabel: {
    fontWeight: '600',
  },
  passwordHint: {
    lineHeight: 20,
  },
  passwordInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  /** モーダルボタンのテキスト（文字色は使用箇所でテーマから重ねる） */
  modalButtonText: {
    fontWeight: '600',
  },
  /** 処理中の全面遮蔽（背景色は使用箇所でテーマの overlay を重ねる） */
  loadingOverlay: {
    /* RN 0.86でStyleSheet.absoluteFillObjectが削除されたため明示指定 */
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingContainer: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontWeight: '600',
  },
});
