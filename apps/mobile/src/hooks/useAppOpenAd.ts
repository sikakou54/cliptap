/**
 * 起動時App Open広告フック
 *
 * @description
 * 無料プランの利用者に対して、アプリのコールドスタート時に一度だけ
 * AdMobのApp Open広告（アプリの起動画面を収益化するための全画面フォーマット）を表示する。
 *
 * 【インタースティシャルではなくApp Open広告を使う理由】
 * Googleはアプリ起動時の全画面表示専用にApp Open広告を用意しており、
 * インタースティシャルを起動時に出すことは「許可されていない実装」としてポリシーで禁じている。
 * 起動時に表示してよい全画面広告はApp Open広告だけであり、両者を入れ替えてはならない。
 *
 * 【表示条件（すべて満たしたときだけ表示する）】
 * 1. 広告ユニットIDが設定されていること
 * 2. 初回起動ではないこと（インストール直後はATT許可ダイアログと連続してしまうため出さない）
 * 3. 無料プランであることが確定していること（未確定・権利確認失敗の間は表示しない）
 * 4. このプロセスでまだ一度も表示を試みていないこと（＝コールドスタート直後の1回だけ）
 * 5. 上限時間内にロードが完了し、その時点でアプリが前面にあること
 *
 * 1と2は加入状態を待たずに判定できるため先に行う。こうすると表示しないと決まった起動が
 * 課金サービスの応答を待たずに決着し、起動が速いままになる。
 *
 * 【時間による間隔を設けない理由】
 * コールドスタート1回につき最大1回という制限（条件4）だけで頻度を抑える。
 * アプリを開き直すたびに表示されるが、これはApp Open広告が想定している出し方である。
 *
 * 【起動を止めない】
 * 判定・初期化・ロード・表示のどこで失敗しても、必ず settle() を通って onSettled を呼ぶ。
 * 外部サービスの失敗でローカル業務機能を止めないという方針に従う。
 *
 * @see docs/機能仕様書.md §8.19 広告・トラッキング同意
 * @module useAppOpenAd
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import mobileAds, { AppOpenAd, AdEventType, TestIds } from 'react-native-google-mobile-ads';
import { Logger, useSharedSubscription } from '@cliptap/shared';
import { useTracking } from '@hooks/useTracking';

/* ========================================
   定数定義
   ======================================== */

/**
 * 本番のApp Open広告ユニットID（プラットフォーム別）
 *
 * AdMob管理画面で広告フォーマット「アプリ起動」として作成したユニットIDを設定する。
 * バナー用のユニットID（AdBanner.tsx）は流用できない。フォーマットが違うと配信されない。
 * 未設定のまま本番ビルドへ入ると広告は表示されず、代わりにエラーログを出して起動を続行する。
 */
const AD_UNIT_IDS = {
  ios: 'ca-app-pub-5616727577619398/5690894031',
  android: 'ca-app-pub-5616727577619398/9225235353',
};

/**
 * 起動を保留してよい上限時間
 *
 * 加入状態の確定・SDK初期化・広告ロードの合計がこの時間を超えたら広告を諦めて起動を進める。
 * スプラッシュの保持1000msはマウント時点から数えるためこの保留と並行して進み、
 * 体感で増える待ち時間はこの値から保持1000msを引いた分までに収まる。
 */
const SETTLE_TIMEOUT_MS = 3000;

/** 初回起動を通過済みかどうかの保存キー */
const FIRST_LAUNCH_DONE_KEY = '@app_open_ad_first_launch_done';

/** 初回起動を通過済みであることを表す値 */
const FIRST_LAUNCH_DONE_VALUE = '1';

/* ========================================
   プロセス単位の状態
   ======================================== */

/**
 * このプロセスで表示判定を開始したか
 *
 * JSコンテキストはコールドスタートでのみ作り直されるため、このモジュール変数が
 * そのまま「コールドスタート時のみ」という条件になる。バックグラウンドからの復帰では
 * モジュールが再評価されないので、復帰時に広告が出ることはない。
 */
let hasStartedThisProcess = false;

/**
 * 走行中の表示フローを打ち切ったか
 *
 * 停止スイッチは、それが止める対象（モジュール側で生き残るSDKの購読）と同じ
 * プロセス単位で持つ。マウント単位のrefにすると、ゲートがアンマウントした時点で
 * 値が凍結し、後から届いたロード完了で広告が出てしまう。
 */
let hasAbandonedThisProcess = false;

/**
 * 生成済みのAppOpenAdインスタンス
 *
 * createForAdRequest はインスタンスごとにネイティブイベントの購読を張るが、
 * それを解除するAPIがJS側に無い（removeAllListeners が消すのはJS側のリスナーだけ）。
 * 作り直すたびに購読が積み上がるため、プロセス内で1つだけ作って使い回す。
 */
let adInstance: AppOpenAd | null = null;

/* ========================================
   型定義
   ======================================== */

/** 加入状態を待たずに行う事前判定の結果 */
type PreflightResult = 'eligible' | 'skip';

/** useAppOpenAd の引数 */
export interface UseAppOpenAdParams {
  /**
   * 表示判定が決着したときに呼ばれる
   *
   * 「表示した」「表示しないと決めた」「諦めた」のいずれでも必ず1回呼ばれる。
   * 呼び出し側はこれを合図にスプラッシュの保持を解除する。
   *
   * @param adShown - 実際に広告を全画面表示したか
   */
  onSettled: (adShown: boolean) => void;
}

/* ========================================
   フック実装
   ======================================== */

/**
 * 起動時のApp Open広告を表示するフック
 *
 * SubscriptionProviderの内側で使うこと。加入状態が確定するまで待つ必要があるため、
 * Providerの外側からは正しく判定できない。
 *
 * @param params - UseAppOpenAdParams
 */
export function useAppOpenAd({ onSettled }: UseAppOpenAdParams): void {
  const { isLoading, isSubscribed, verificationFailed, shouldShowAds } = useSharedSubscription();
  const { getTrackingStatus } = useTracking();

  /** 加入状態を待たずに判定できる条件の結果（nullは判定中） */
  const [preflight, setPreflight] = useState<PreflightResult | null>(null);

  /**
   * このマウントで onSettled を呼んだか
   *
   * onSettled の多重呼び出しを防ぐためだけに持つ。走行中フローの停止は
   * プロセス単位の hasAbandonedThisProcess が担当する。
   */
  const hasSettledRef = useRef(false);

  /**
   * 表示判定の決着
   *
   * どの経路から来ても、このマウントでは1回しか onSettled を呼ばない。
   * 同時に走行中のフローを打ち切り、決着後に遅れて広告が出ることを防ぐ。
   */
  const settle = useCallback(
    (reason: string, adShown = false) => {
      hasAbandonedThisProcess = true;
      if (hasSettledRef.current) return;
      hasSettledRef.current = true;
      Logger.debug(`[useAppOpenAd] Settled: ${reason}`);
      onSettled(adShown);
    },
    [onSettled]
  );

  /**
   * 上限時間の打ち切りと、加入状態を待たない事前判定
   *
   * 加入状態が永久に確定しない、SDK初期化が返ってこない、といった場合でも
   * 起動が止まらないよう、マウント時に1回だけ打ち切りを仕掛ける。
   */
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      settle('Timed out before the ad could be shown');
    }, SETTLE_TIMEOUT_MS);

    /* 同一プロセスで判定済みならもう出さない。ただし保留は必ず解除する */
    if (hasStartedThisProcess) {
      settle('Already attempted in this process');
    } else {
      hasStartedThisProcess = true;
      void runPreflight().then((result) => {
        if (result === 'skip') {
          settle('Preflight rejected the ad');
        }
        setPreflight(result);
      });
    }

    return () => {
      clearTimeout(timeoutId);
      /* ゲートが消えたあとに広告を出す先はない。走行中のフローを打ち切る */
      hasAbandonedThisProcess = true;
    };
  }, [settle]);

  /**
   * 加入状態の確定を待ってから表示する
   *
   * 未確定のまま進めるとPro利用者へ全画面広告を出す事故につながるため、
   * isLoading の間は必ず待つ。
   */
  useEffect(() => {
    if (preflight !== 'eligible') return;
    if (isLoading) return;
    if (hasAbandonedThisProcess) return;

    /* Proが確定している、権利確認に失敗して判断できない、のどちらも表示しない。
       バナーと違い全画面広告は誤表示の被害が大きいため、確信が持てないときは出さない側へ倒す */
    if (isSubscribed || verificationFailed || !shouldShowAds()) {
      settle('Not eligible: subscribed, verification failed, or ads disabled');
      return;
    }

    void loadAndShowAppOpenAd({ settle, getTrackingStatus });
  }, [
    preflight,
    isLoading,
    isSubscribed,
    verificationFailed,
    shouldShowAds,
    settle,
    getTrackingStatus,
  ]);
}

/* ========================================
   内部処理
   ======================================== */

/**
 * 本番・開発に応じた広告ユニットIDを返す
 *
 * 未設定または対象外プラットフォームでは空文字を返す。
 */
function resolveAdUnitId(): string {
  if (__DEV__) return TestIds.APP_OPEN;

  return (
    Platform.select({
      ios: AD_UNIT_IDS.ios,
      android: AD_UNIT_IDS.android,
    }) ?? ''
  );
}

/**
 * 加入状態を待たずに判定できる条件をまとめて確認する
 *
 * ここで弾ける起動は課金サービスの応答を待たずに決着するため、
 * 表示しないと決まった起動が遅くならない。
 */
async function runPreflight(): Promise<PreflightResult> {
  if (!resolveAdUnitId()) {
    /* 静かに無効化されると設定漏れに気付けないため、本番でも残るerrorで知らせる */
    Logger.error('[useAppOpenAd] No App Open ad unit ID configured. Set AD_UNIT_IDS to enable it.');
    return 'skip';
  }

  return (await isFirstLaunch()) ? 'skip' : 'eligible';
}

/** loadAndShowAppOpenAd の引数 */
interface LoadAndShowParams {
  /** 表示判定の決着を通知する */
  settle: (reason: string, adShown?: boolean) => void;
  /** ATT許可状態を取得する */
  getTrackingStatus: () => Promise<string>;
}

/**
 * SDK初期化・ロード・表示を行う
 *
 * 例外は握りつぶして settle() へ倒す。広告の失敗で起動が止まってはならない。
 *
 * @param params - LoadAndShowParams
 */
async function loadAndShowAppOpenAd({
  settle,
  getTrackingStatus,
}: LoadAndShowParams): Promise<void> {
  try {
    const adUnitId = resolveAdUnitId();

    /* パーソナライズ広告を要求してよいのはiOSでATT許可が得られたときだけ。
       AndroidにはATTのgranted状態が無く TrackingService は常に'granted'を返すため、
       その値をそのまま使うとバナー（常に非パーソナライズ）と挙動が食い違う */
    const isPersonalizedAllowed = Platform.OS === 'ios' && (await getTrackingStatus()) === 'granted';

    /* SDKの初期化。広告をロードする前に1回だけ必要で、
       Pro利用者に無駄な外部通信をさせないよう無料プラン確定後のこの位置で呼ぶ */
    await mobileAds().initialize();

    /* ここまでの待ち時間で打ち切られていたら、もう表示してはならない */
    if (hasAbandonedThisProcess) return;

    const ad = getOrCreateAd(adUnitId, !isPersonalizedAllowed);

    /**
     * 広告イベントの購読
     *
     * ロード完了だけでなく、実際に提示できたこと（OPENED）まで見届ける。
     * show() の解決は提示要求が受理されたことまでしか保証しないため、
     * それだけでは表示できたかどうかを判断できない。
     */
    const unsubscribe = ad.addAdEventsListener(({ type, payload }) => {
      switch (type) {
        case AdEventType.LOADED:
          presentAd(ad, settle);
          break;

        case AdEventType.OPENED:
          break;

        case AdEventType.CLOSED:
          unsubscribe();
          break;

        case AdEventType.ERROR:
          unsubscribe();
          Logger.error('[useAppOpenAd] App Open ad reported an error:', payload);
          settle('Ad failed to load or present');
          break;

        default:
          break;
      }
    });

    /* すでにロード済みなら待たずに表示する（同一プロセスで再入した場合の保険） */
    if (ad.loaded) {
      presentAd(ad, settle);
      return;
    }

    ad.load();
  } catch (error) {
    Logger.error('[useAppOpenAd] Unexpected failure while preparing the App Open ad:', error);
    settle('Unexpected failure');
  }
}

/**
 * AppOpenAdインスタンスを取得する（無ければ生成する）
 *
 * @param adUnitId - 広告ユニットID
 * @param requestNonPersonalizedAdsOnly - 非パーソナライズ広告のみを要求するか
 */
function getOrCreateAd(adUnitId: string, requestNonPersonalizedAdsOnly: boolean): AppOpenAd {
  if (!adInstance) {
    adInstance = AppOpenAd.createForAdRequest(adUnitId, { requestNonPersonalizedAdsOnly });
  }
  return adInstance;
}

/**
 * ロード済みの広告を表示する
 *
 * show() はロード未完了だと同期例外を投げるため、呼び出し前に loaded を確認する。
 * settle() は show() の解決を待たずに呼ぶ。呼び出し側は表示できた合図として
 * スプラッシュを即座に畳むため、広告を閉じた時点でホーム画面が見えている。
 *
 * @param ad - 表示するAppOpenAd
 * @param settle - 表示判定の決着を通知する
 */
function presentAd(ad: AppOpenAd, settle: (reason: string, adShown?: boolean) => void): void {
  /* 打ち切り後、またはロードが間に合わなかった場合。すでにホームが見えているため表示しない */
  if (hasAbandonedThisProcess) return;

  /* 起動直後に別アプリへ移られた場合、裏で提示しても見られないまま消費されるだけになる。
     戻ってきた利用者に文脈のない全画面広告を見せることにもなるため、前面のときだけ表示する */
  if (AppState.currentState !== 'active') {
    settle('App is not in the foreground');
    return;
  }

  if (!ad.loaded) {
    settle('Ad reported loaded but is not showable');
    return;
  }

  try {
    const shown = ad.show();
    settle('Shown', true);

    void shown.catch((error: unknown) => {
      Logger.error('[useAppOpenAd] Failed to present the App Open ad:', error);
    });
  } catch (error) {
    Logger.error('[useAppOpenAd] show() threw for the App Open ad:', error);
    settle('show() threw');
  }
}

/**
 * インストール後の初回起動かを判定する
 *
 * 記録が無い場合を初回起動とみなし、通過済みの印を残したうえで初回として扱う。
 * インストール直後はATT許可ダイアログが出るため、続けて全画面広告を出すと
 * アプリの中身を一度も見せないまま全画面を2枚踏ませることになる。
 * 読み出しや保存に失敗した場合は表示してよい側へ倒す（起動を止めない方針に合わせる）。
 */
async function isFirstLaunch(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(FIRST_LAUNCH_DONE_KEY);
    if (raw === FIRST_LAUNCH_DONE_VALUE) return false;

    await recordFirstLaunchDone();
    return true;
  } catch (error) {
    Logger.error('[useAppOpenAd] Failed to read the first launch marker:', error);
    return false;
  }
}

/**
 * 初回起動を通過したことを記録する
 *
 * 保存に失敗した場合は次の起動も初回として扱われ、広告が1回余分に出ないだけで
 * 起動そのものには影響しない。
 */
async function recordFirstLaunchDone(): Promise<void> {
  try {
    await AsyncStorage.setItem(FIRST_LAUNCH_DONE_KEY, FIRST_LAUNCH_DONE_VALUE);
  } catch (error) {
    Logger.error('[useAppOpenAd] Failed to record the first launch marker:', error);
  }
}
