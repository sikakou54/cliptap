/**
 * 起動時App Open広告フック
 *
 * @description
 * 無料プランの利用者に対して、アプリのコールドスタート時に一度だけ
 * AdMobのApp Open広告（アプリの起動画面を収益化するための全画面フォーマット）を表示する。
 * 広告はスプラッシュの表示が完全に終わってから、ホーム画面の上に表示する。
 *
 * 【インタースティシャルではなくApp Open広告を使う理由】
 * Googleはアプリ起動時の全画面表示専用にApp Open広告を用意しており、
 * インタースティシャルを起動時に出すことは「許可されていない実装」としてポリシーで禁じている。
 * 起動時に表示してよい全画面広告はApp Open広告だけであり、両者を入れ替えてはならない。
 *
 * 【表示条件（すべて満たしたときだけ表示する）】
 * 1. 広告ユニットIDが設定されていること
 * 2. 初回起動ではないこと（インストール直後はATT許可ダイアログと連続してしまうため出さない）
 * 3. 開発者メニューで広告を非表示にしていないこと（開発ビルドのみ）
 * 4. 無料プランであることが確定していること（未確定・権利確認失敗の間は表示しない）
 * 5. このプロセスでまだ一度も表示を試みていないこと（＝コールドスタート直後の1回だけ）
 * 6. スプラッシュの表示が終わっていること
 * 7. 上限時間内にロードが完了し、その時点でアプリが前面にあること
 *
 * 1〜3は加入状態を待たずに判定できるため先に行う。
 *
 * 【スプラッシュが終わってから表示する理由】
 * スプラッシュの演出を最後まで見せることを優先している。
 * Googleのガイドは読み込み画面の上での表示を推奨し、アプリの画面へ移ったあとの表示を避けるよう求めている。
 * 従わない場合は配信を止められることがあると明記されているため、変更時は仕様書§8.19を確認すること。
 * 広告の準備はスプラッシュの表示中から並行して進め、ホーム画面が見えてから広告が出るまでの間を短くする。
 *
 * 【上限時間を設ける理由】
 * ホーム画面を操作し始めた利用者の前に、遅れて全画面広告が割り込まないようにするため。
 *
 * 【時間による間隔を設けない理由】
 * コールドスタート1回につき最大1回という制限（条件5）だけで頻度を抑える。
 * アプリを開き直すたびに表示されるが、これはApp Open広告が想定している出し方である。
 *
 * 【起動を止めない】
 * 判定・初期化・ロード・表示のどこで失敗しても広告を諦めるだけで、起動や業務機能には影響しない。
 * 外部サービスの失敗でローカル業務機能を止めないという方針に従う。
 *
 * @see docs/機能仕様書.md §8.19 広告・トラッキング同意
 * @module useAppOpenAd
 */

import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import mobileAds, { AppOpenAd, AdEventType, TestIds } from 'react-native-google-mobile-ads';
import { Logger, useSharedSubscription } from '@cliptap/shared';
import { useTracking } from '@hooks/useTracking';
import { isDevAdsDisabled } from '@utils/devAdsOverride';

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
 * 表示を試みてよい上限時間
 *
 * ゲートのマウントから数え、この時間内に表示できなければ広告を諦める。
 * 加入状態の確定・SDK初期化・広告ロードの合計に対する上限で、Google公式のApp Openサンプルと同じ5秒とする。
 */
const SHOW_TIMEOUT_MS = 5000;

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
 * このプロセスでの広告の処理を終えたか
 *
 * 「表示した」「表示しないと決めた」「諦めた」のいずれかで true になり、以後は表示しない。
 * ゲートのアンマウント後に届いたロード完了で広告が出ないよう、マウント単位ではなくプロセス単位で持つ。
 */
let isFinishedThisProcess = false;

/**
 * スプラッシュの表示が終わったか
 *
 * ロード完了のイベントはReactの外で受け取るため、表示してよいかの判定用にプロセス単位で写しておく。
 */
let isSplashFinishedThisProcess = false;

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
  /** スプラッシュの表示が完全に終わったか（広告はこれが true になってから表示する） */
  isSplashFinished: boolean;
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
export function useAppOpenAd({ isSplashFinished }: UseAppOpenAdParams): void {
  const { isLoading, isSubscribed, verificationFailed, shouldShowAds } = useSharedSubscription();
  const { getTrackingStatus } = useTracking();

  /** 加入状態を待たずに判定できる条件の結果（nullは判定中） */
  const [preflight, setPreflight] = useState<PreflightResult | null>(null);

  /**
   * 上限時間の打ち切りと、加入状態を待たない事前判定
   *
   * 加入状態が永久に確定しない、SDK初期化が返ってこない、といった場合でも
   * 遅れて広告が出ないよう、マウント時に1回だけ打ち切りを仕掛ける。
   */
  useEffect(() => {
    /* 同一プロセスで判定済みならもう出さない */
    if (hasStartedThisProcess) return;
    hasStartedThisProcess = true;

    const timeoutId = setTimeout(() => {
      finish('Timed out before the ad could be shown', true);
    }, SHOW_TIMEOUT_MS);

    void runPreflight().then((result) => {
      if (result === 'skip') {
        finish('Preflight rejected the ad');
        return;
      }
      setPreflight(result);
    });

    return () => {
      clearTimeout(timeoutId);
      /* ゲートが消えたあとに広告を出す先はない */
      finish('Gate unmounted');
    };
  }, []);

  /**
   * 加入状態の確定を待ってから広告をロードする
   *
   * 未確定のまま進めるとPro利用者へ全画面広告を出す事故につながるため、
   * isLoading の間は必ず待つ。ロードはスプラッシュの表示中から始めてよい。
   */
  useEffect(() => {
    if (preflight !== 'eligible' || isLoading || isFinishedThisProcess) return;

    /* Proが確定している、権利確認に失敗して判断できない、のどちらも表示しない。
       バナーと違い全画面広告は誤表示の被害が大きいため、確信が持てないときは出さない側へ倒す */
    if (isSubscribed || verificationFailed || !shouldShowAds()) {
      finish('Not eligible: subscribed, verification failed, or ads disabled');
      return;
    }

    void loadAppOpenAd(getTrackingStatus);
  }, [preflight, isLoading, isSubscribed, verificationFailed, shouldShowAds, getTrackingStatus]);

  /**
   * スプラッシュの終了を待って表示する
   *
   * ロードがスプラッシュより先に終わっていた場合は、ここで表示する。
   * ロードのほうが遅い場合は、ロード完了のイベントで表示される。
   */
  useEffect(() => {
    isSplashFinishedThisProcess = isSplashFinished;

    if (isSplashFinished && adInstance) {
      presentAd(adInstance);
    }
  }, [isSplashFinished]);
}

/* ========================================
   内部処理
   ======================================== */

/**
 * このプロセスでの広告の処理を終える
 *
 * 2回目以降の呼び出しは何もしない。
 *
 * @param reason - 終えた理由
 * @param isAbnormal - 原因を追う必要がある終わり方か（true は本番でも残る warn で記録する）
 */
function finish(reason: string, isAbnormal = false): void {
  if (isFinishedThisProcess) return;
  isFinishedThisProcess = true;

  if (isAbnormal) {
    /* 本番のLoggerは追加引数を捨てるため、理由はメッセージへ埋め込む */
    Logger.warn(`[useAppOpenAd] ${reason}`);
  } else {
    Logger.debug(`[useAppOpenAd] Finished: ${reason}`);
  }
}

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
 * ここで弾ける起動は課金サービスの応答を待たずに決着する。
 */
async function runPreflight(): Promise<PreflightResult> {
  if (!resolveAdUnitId()) {
    /* 静かに無効化されると設定漏れに気付けないため、本番でも残るerrorで知らせる */
    Logger.error('[useAppOpenAd] No App Open ad unit ID configured. Set AD_UNIT_IDS to enable it.');
    return 'skip';
  }

  if (await isFirstLaunch()) return 'skip';

  /* 開発者メニューで広告を非表示にしている（開発ビルドのみ）。
     初回起動の印を残してから判定し、スイッチを戻したときに初回扱いへ戻らないようにする */
  if (await isDevAdsDisabled()) return 'skip';

  return 'eligible';
}

/**
 * SDK初期化と広告のロードを行う
 *
 * ロードが完了したら presentAd で表示を試みる。
 * 例外は握りつぶして広告を諦める。広告の失敗で起動が止まってはならない。
 *
 * @param getTrackingStatus - ATT許可状態を取得する
 */
async function loadAppOpenAd(getTrackingStatus: () => Promise<string>): Promise<void> {
  try {
    const adUnitId = resolveAdUnitId();

    /* パーソナライズ広告を要求してよいのはiOSでATT許可が得られたときだけ。
       AndroidにはATTのgranted状態が無く TrackingService は常に'granted'を返すため、
       その値をそのまま使うとバナー（常に非パーソナライズ）と挙動が食い違う */
    const isPersonalizedAllowed = Platform.OS === 'ios' && (await getTrackingStatus()) === 'granted';

    /* SDKの初期化。広告をロードする前に1回だけ必要で、
       Pro利用者に無駄な外部通信をさせないよう無料プラン確定後のこの位置で呼ぶ */
    await mobileAds().initialize();

    /* ここまでの待ち時間で打ち切られていたら、もうロードしない */
    if (isFinishedThisProcess) return;

    const ad = getOrCreateAd(adUnitId, !isPersonalizedAllowed);

    /* 広告イベントの購読 */
    const unsubscribe = ad.addAdEventsListener(({ type, payload }) => {
      switch (type) {
        case AdEventType.LOADED:
          presentAd(ad);
          break;

        case AdEventType.CLOSED:
          unsubscribe();
          break;

        case AdEventType.ERROR:
          unsubscribe();
          finish(`App Open ad reported an error: ${String(payload)}`, true);
          break;

        default:
          break;
      }
    });

    ad.load();
  } catch (error) {
    finish(`Unexpected failure while preparing the App Open ad: ${String(error)}`, true);
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
 * ロード済みの広告を、スプラッシュが終わっていれば表示する
 *
 * ロード完了時とスプラッシュ終了時の両方から呼ばれ、両方が揃った時点で1回だけ表示する。
 * show() はロード未完了だと同期例外を投げるため、呼び出し前に loaded を確認する。
 *
 * @param ad - 表示するAppOpenAd
 */
function presentAd(ad: AppOpenAd): void {
  if (isFinishedThisProcess || !isSplashFinishedThisProcess || !ad.loaded) return;

  /* 起動直後に別アプリへ移られた場合、裏で提示しても見られないまま消費されるだけになる。
     戻ってきた利用者に文脈のない全画面広告を見せることにもなるため、前面のときだけ表示する */
  if (AppState.currentState !== 'active') {
    finish('App is not in the foreground', true);
    return;
  }

  finish('Shown');

  try {
    void ad.show().catch((error: unknown) => {
      Logger.warn(`[useAppOpenAd] Failed to present the App Open ad: ${String(error)}`);
    });
  } catch (error) {
    Logger.warn(`[useAppOpenAd] show() threw for the App Open ad: ${String(error)}`);
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
