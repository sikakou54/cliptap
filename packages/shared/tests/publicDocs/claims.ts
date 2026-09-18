/**
 * 公開文書に載せた「事実の主張」の台帳
 *
 * @remarks
 * 同じ事実が複数の公開文書へ刷られているため、1箇所だけ直すと残りが古いまま残る。
 * ここには監査で誤りが見つかった主張だけを登録し、次の2つを機械的に固定する。
 *
 * - `forbiddenAnywhere`: 一度直した誤りの言い回しが、どの公開文書にも復活しないこと
 * - `sites`: 正しい説明が、その主張を載せているすべての文書に入っていること
 *
 * この台帳は**実行時の文言を供給しない**。アプリが読む文言は
 * `packages/shared/src/i18n/{ja,en}.json` だけであり、ここは照合のためだけに存在する。
 * 挙動の定義も持たない（`spec` で `docs/機能仕様書.md` を指すだけにとどめる）。
 *
 * 新しい主張を足すときは、`forbiddenAnywhere` の各行に
 * 「どの誤りの再発を防いでいるのか」をコメントで必ず添えること。
 * それが無いと、数ヶ月後に語句を選んだ理由を読み取れなくなり台帳が腐る。
 */

/** 主張を載せている文書1件 */
export interface PublicClaimSite {
  /** リポジトリルートからの相対パス（`publicDocuments.ts` の台帳に載っていること） */
  readonly path: string;
  /** この文書に必ず含まれていなければならない語句 */
  readonly mustContain: readonly string[];
}

/** 公開文書に載せた事実の主張1件 */
export interface PublicClaim {
  /** 主張の識別子 */
  readonly id: string;
  /** 実装上の事実（この主張が何を述べているか） */
  readonly summary: string;
  /** 仕様の正本 */
  readonly spec: string;
  /** 挙動を決めている実装 */
  readonly evidence: readonly string[];
  /** どの公開文書にも現れてはならない語句 */
  readonly forbiddenAnywhere: readonly string[];
  /** 主張を載せている文書と、必須の語句 */
  readonly sites: readonly PublicClaimSite[];
}

/** 無効化されたプロファイル・カスタム変数の復帰条件（Freeでの削除による昇格を含む） */
const PLAN_LIMIT_REINSTATEMENT: PublicClaim = {
  id: 'plan-limit-reinstatement',
  summary:
    '無料プランで無効化されたプロファイル・カスタム変数は、Proへ再加入する以外にも、'
    + '他を削除して有効な枠に空きが出れば、Freeのまま即座に有効へ戻る。'
    + '削除経路が削除と同じトランザクションで有効フラグを再計算するため。',
  spec: 'docs/機能仕様書.md §8.18 プラン上限再計算',
  evidence: [
    'packages/shared/src/providers/ProfileProvider.tsx',
    'packages/shared/src/providers/VariableProvider.tsx',
    'packages/shared/src/services/SubscriptionService.ts',
  ],
  forbiddenAnywhere: [
    /* 削除による復帰があるのに、Pro再加入だけを条件として書いていた（利用規約7.1・7.2とEULAの同条項） */
    '再度Proプランに加入するまで利用できません',
    /* 同じ誤りのLP日本語版。復帰条件としてProへの再加入のみを挙げていた */
    '無効になるだけで、Proに戻せば再び使えます',
    /* 同じ誤りのLP英語版 */
    'they come back if you resubscribe',
  ],
  sites: [
    {
      path: 'apps/web/public/terms.html',
      mustContain: [
        '他のプロファイルを削除して有効な3つの枠に空きが出た場合',
        '他のカスタム変数を削除して有効な5個の枠に空きが出た場合',
      ],
    },
    {
      /* 上のコピー。同期漏れは duplicateProjection.test.ts が検知するが、ここでも独立に確認する */
      path: 'apps/mobile/assets/web/terms.html',
      mustContain: [
        '他のプロファイルを削除して有効な3つの枠に空きが出た場合',
        '他のカスタム変数を削除して有効な5個の枠に空きが出た場合',
      ],
    },
    {
      path: 'store/EULA_License_Agreement.txt',
      mustContain: [
        '他のプロファイルを削除して有効な3つの枠に空きが出た場合',
        '他のカスタム変数を削除して有効な5個の枠に空きが出た場合',
      ],
    },
    {
      /* FAQの構造化データと本文の2箇所に同じ文がある（一致は duplicateProjection.test.ts が固定する） */
      path: 'apps/web/index.html',
      mustContain: ['他を削除して枠に空きを作るか、Proに戻せば再び使えます'],
    },
    {
      path: 'apps/web/en/index.html',
      mustContain: ['They come back when you delete others to free up a slot'],
    },
    {
      path: 'packages/shared/src/i18n/ja.json',
      mustContain: [
        '他のプロファイルを削除して枠に空きを作るか',
        '他のカスタム変数を削除して枠に空きを作るか',
      ],
    },
    {
      path: 'packages/shared/src/i18n/en.json',
      mustContain: [
        'Delete another profile to free up a slot',
        'Delete another custom variable to free up a slot',
      ],
    },
  ],
};

/** 無料プランで上限を超えたデータの扱い（定型文・ショートカットと、プロファイル・カスタム変数で挙動が異なる） */
const FREE_LIMIT_OVERFLOW: PublicClaim = {
  id: 'free-limit-overflow',
  summary:
    '上限を超えて保存済みのものがそのまま使えるのは定型文・ショートカット・値だけ。'
    + 'プロファイルとカスタム変数は超過分が無効化される。'
    + 'この2群を1文にまとめて述べると必ずどちらかについて誤りになる。',
  spec: 'docs/機能仕様書.md §6.2 Free / Pro比較、§8.18 プラン上限再計算',
  evidence: ['packages/shared/src/services/SubscriptionService.ts'],
  forbiddenAnywhere: [
    /* 挙動の異なる2群を1文にまとめ、プロファイルとカスタム変数について事実と逆になっていた（ストア掲載文の英語版） */
    'Anything already saved above a limit keeps working',
  ],
  sites: [
    {
      path: 'store/store_en.txt',
      mustContain: ['Templates and shortcuts already saved above a limit keep working'],
    },
  ],
};

/** 認証方法の対応環境（見出しに条件を書かず、本文の対応環境の行だけで述べる） */
const AUTH_PLATFORM_SUPPORT: PublicClaim = {
  id: 'auth-platform-support',
  summary:
    'Apple Sign-InはiOSアプリとWeb版の両方で提供しており、iOS専用ではない。'
    + '対応環境は見出しではなく本文の「対応環境：」の行だけで述べる。',
  spec: 'docs/機能仕様書.md §8.16 アカウント連携・解除',
  evidence: [
    'apps/web/src/adapters/WebAuthAdapter.ts',
    'apps/web/src/components/auth/AccountLinkModal.tsx',
    'apps/mobile/src/adapters/MobileAuthAdapter.ts',
  ],
  forbiddenAnywhere: [
    /* 見出しが「iOS専用」と書き、直後の対応環境の行（iOSアプリおよびWeb版）と矛盾していた */
    'Apple Sign-In（iOS専用）',
  ],
  sites: [
    {
      path: 'apps/web/public/privacy.html',
      mustContain: ['<strong>対応環境：</strong>iOSアプリおよびWeb版（ブラウザ）'],
    },
    {
      path: 'apps/mobile/assets/web/privacy.html',
      mustContain: ['<strong>対応環境：</strong>iOSアプリおよびWeb版（ブラウザ）'],
    },
  ],
};

/** 公開文書の主張の台帳 */
export const PUBLIC_CLAIMS: readonly PublicClaim[] = [
  PLAN_LIMIT_REINSTATEMENT,
  FREE_LIMIT_OVERFLOW,
  AUTH_PLATFORM_SUPPORT,
];
