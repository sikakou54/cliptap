/**
 * サイドメニューコンポーネント
 *
 * @description
 * アプリケーションのメインナビゲーション。
 * デスクトップでは固定表示、モバイルではドロワーとして動作。
 *
 * 機能:
 * - ページナビゲーション（ホーム、カテゴリ、プロファイル、変数）
 * - エクスポート/インポート
 * - テーマ切り替え（ライト/ダーク）
 * - アカウント連携/解除
 */
import { Logger, useTranslation, SubscriptionService, useAuth, translateError, useSharedSubscription } from '@cliptap/shared';
import { useTheme } from '@hooks/useTheme';
import { showConfirm, showErrorAlert } from '@utils/alerts';
import { SideMenuHeader } from './SideMenuHeader';
import { SideMenuNavigation, type MenuItem } from './SideMenuNavigation';
import { SideMenuFooter } from './SideMenuFooter';
import { database } from '@database/database';
import { CacheService } from '@services/CacheService';
import { closeWorkspace } from '@services/WorkspaceService';
import { useDatabase } from '@cliptap/shared';
import { useNavigate } from 'react-router-dom';


interface SideMenuProps {
  onExport: () => void;
  onImport: () => void;
  isOpen: boolean;
  /** 本文へ覆いかぶさる幅か（狭い画面ならtrue） */
  isOverlay: boolean;
  onClose: () => void;
  onAccountLink?: () => void;
}

/** 押し出して並べているときは、ページを移っても閉じない */
const NOOP = () => {};

export function SideMenu({ onExport, onImport, isOpen,
  isOverlay, onClose, onAccountLink }: SideMenuProps) {
  const { t } = useTranslation();
  const { isSubscribed } = useSharedSubscription();
  const resetSubscription = () => SubscriptionService.reset();
  const { isDark, themeMode, setThemeMode } = useTheme();
  const { signOut, user } = useAuth();
  const { setLoaded } = useDatabase();
  const navigate = useNavigate();

  const handleCloseFile = () => {
    showConfirm('settings.web_specific.confirm_close_file', async () => {
      try {
        await closeWorkspace({
          resetDatabase: () => database.reset(),
          clearCache: () => CacheService.clear(),
        });
        setLoaded(false);
        onClose();
        navigate('/');
      } catch (error) {
        showErrorAlert(translateError(error));
      }
    });
  };

  /**
   * アカウント連携解除処理
   *
   * Firebaseからサインアウトするが、ローカルデータベースとキャッシュは保持。
   * サブスクリプション状態のみリセットされる。
   */
  const handleUnlinkAccount = async () => {
    showConfirm('settings.web_specific.confirm_unlink', async () => {
      try {
        resetSubscription();
        await signOut();
        onClose();
      } catch (error) {
        Logger.error('Unlink account failed:', error);
        const message = translateError(error) || t('error.unlink_failed');
        showErrorAlert(message);
      }
    });
  };

  const menuItems: MenuItem[] = [
    {
      path: '/dashboard',
      label: t('tabs.home'),
      icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
    },
    {
      path: '/settings/categories',
      label: t('tabs.categories'),
      icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z',
    },
    {
      path: '/settings/profiles',
      label: t('settings.profiles'),
      icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
    },
    {
      path: '/settings/variables',
      label: t('settings.variables'),
      icon: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01',
    },
  ];


  /**
   * リンクなどでページを移るときに閉じるか
   *
   * @remarks
   * 覆いかぶさっているときだけ閉じる。押し出して並べているときは本文を隠していないため、
   * 移動のたびに閉じると開き直す手間が増えるだけになる。
   */
  const handleNavigate = isOverlay ? onClose : NOOP;

  return (
    <>
      {/* 覆いかぶさっているときの暗幕 */}
      {isOverlay && isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 transition-opacity"
          onClick={onClose}
        />
      )}

      <div
        className={`
          fixed top-0 left-0 h-full w-72
          bg-white dark:bg-[#1A1A1A]
          border-r border-gray-200 dark:border-[#2A2A2A]
          flex flex-col z-30
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <SideMenuHeader isSubscribed={isSubscribed} user={user} onClose={onClose} />

        <SideMenuNavigation
          menuItems={menuItems}
          onClose={handleNavigate}
          onImport={onImport}
          onExport={onExport}
          onCloseFile={handleCloseFile}
          isSubscribed={isSubscribed}
        />

        <SideMenuFooter
          isDark={isDark}
          themeMode={themeMode}
          user={user}
          onToggleTheme={() => setThemeMode(
            themeMode === 'auto' ? 'light' : themeMode === 'light' ? 'dark' : 'auto'
          )}
          onUnlinkAccount={handleUnlinkAccount}
          onAccountLink={onAccountLink}
          onClose={handleNavigate}
        />
      </div>
    </>
  );
}
