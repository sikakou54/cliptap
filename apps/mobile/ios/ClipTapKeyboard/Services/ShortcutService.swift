//
//  ShortcutService.swift
//  ClipTapKeyboard
//
//  【目的】
//  ショートカット（定型文とは別の「値の使い分け」）に関するビジネスロジックを担当するサービスクラス
//  3層アーキテクチャの中間層（ビジネスロジック層）を担当します
//
//  【役割】
//  - データ取得: Mapperからショートカットと値を取得
//  - 並べ替え: 選ばれた基準でショートカット・値の表示順を決める
//  - テキスト挿入: 選ばれた値をカーソル位置へ挿入
//  - 振動フィードバック: 挿入時にHaptic Feedback（触覚フィードバック）
//  - 使用回数の記録: フルアクセスが許可されているときだけ記録
//
//  【変数の展開】
//  ショートカットの値も定型文と同じく、{{today}} などのシステム変数と
//  {{client_name}} などのカスタム変数を、挿入する時点の選択中プロファイルと日時で展開します。
//  展開の規則は定型文の挿入（SnippetService.insertSnippet）と同じ VariableReplacer に任せます。
//
//  【並べ替えの規則について】
//  規則の正本は packages/shared/src/shortcuts/sort.ts と
//  packages/shared/tests/shortcuts/sortShortcuts.test.ts です。
//  ここはその規則をSwiftへ写したものなので、規則を変えるときは必ず正本と揃えること。
//

import Foundation
import UIKit

/// ショートカットのビジネスロジックを管理するサービスクラス
/// シングルトンパターンで実装されており、キーボード拡張全体で1つのインスタンスを共有します
class ShortcutService {

    // MARK: - Singleton（シングルトンパターン）

    /// 共有インスタンス（キーボード拡張全体でこのインスタンスを使用）
    static let shared = ShortcutService()

    // MARK: - Dependencies（依存オブジェクト）

    /// ショートカットのデータアクセス層（データベース操作を担当）
    private let shortcutMapper = ShortcutMapper.shared

    /// カスタム変数のビジネスロジック（プロファイルごとの変数マップを取得）
    private let variableService = VariableService.shared

    /// 変数トークンの展開（定型文の挿入と同じ実装）
    private let variableReplacer = VariableReplacer()

    /// App Group識別子
    private let appGroupIdentifier = "group.com.sikakou.cliptap"

    /// フルアクセス状態を共有するUserDefaultsキー
    private let fullAccessStateKey = "keyboardHasFullAccess"

    // MARK: - Initialization（初期化）

    /// プライベートイニシャライザ（外部からのインスタンス生成を禁止）
    private init() {}

    // MARK: - Computed Properties（計算プロパティ）

    /// 使用回数の記録が有効かどうか
    ///
    /// iOSのサンドボックス制約により、フルアクセスが許可されていない拡張は
    /// 共有コンテナへ書き込めないため、記録可否はフルアクセスの許可状態と一致する。
    /// KeyboardViewControllerがviewDidLoadで保存した値を参照する
    /// （UIInputViewControllerを継承しないため hasFullAccess を直接読めない）。
    ///
    /// 【SnippetServiceと同じ実装を重ねて持つ理由】
    /// SnippetService側は同名のprivateプロパティであり、外から参照できない。
    /// 判定を共有するために片方をinternalへ広げると、本来内部事情である
    /// フルアクセス状態の読み方が他クラスからも触れるようになってしまう。
    /// 判定はUserDefaultsのキー1つを読むだけで、変わるときは両方を同じ変更で直す。
    private var isUsageTrackingEnabled: Bool {
        guard let userDefaults = UserDefaults(suiteName: appGroupIdentifier) else {
            return false
        }
        return userDefaults.bool(forKey: fullAccessStateKey)
    }

    // MARK: - Read Operations（読み取り操作）

    /// 指定プロファイル・カテゴリのショートカットを値付きで取得（登録順）
    ///
    /// - Parameters:
    ///   - profileId: 表示中の環境（プロファイル）のID
    ///   - categoryId: 選択中のカテゴリID（nilは「すべて」）
    /// - Returns: ショートカットの配列（sortOrder順、値もsortOrder順）
    ///
    /// 【プロファイルで絞り込む理由】
    /// ショートカットと環境の紐づけは shortcut_profiles（中間テーブル）が持ち、
    /// 各ショートカットは0件以上の環境に紐づきます（紐づけ0件は全環境向け）。
    /// 「会社用」で使う値と「個人用」で使う値が混ざると選び間違えるため、
    /// キーボードは選択中の環境に紐づくショートカットと、全環境向けのショートカットだけを扱います。
    ///
    /// 【カテゴリでも絞り込む理由】
    /// ショートカットは定型文と同じcategoriesを共有します。
    /// フィルター行のカテゴリは定型文とショートカットで共通の絞り込みなので、
    /// 表示中の一覧が入れ替わっても選んだカテゴリの意味が変わらないように、同じ条件を掛けます。
    /// 「すべて」を選んでいるときは全件を出します（未分類だけを選ぶ候補は用意していません）。
    func getAll(profileId: String, categoryId: String?) -> [Shortcut] {
        return shortcutMapper.getAll(profileId: profileId, categoryId: categoryId)
    }

    // MARK: - Sort Operations（並べ替え）

    /// ショートカット一覧を指定の基準で並べ替えて取得
    ///
    /// - Parameters:
    ///   - profileId: 表示中の環境（プロファイル）のID
    ///   - categoryId: 選択中のカテゴリID（nilは「すべて」）
    ///   - sortBy: 並べ替えの基準（"created" | "updated" | "title" | "usage"）
    /// - Returns: 並べ替えたショートカットの配列
    ///
    /// 【絞り込みを取得段で済ませる理由】
    /// 並べ替えは「表示する一覧の中での順番」を決める処理なので、
    /// 絞り込み済みの一覧を受け取る形にして、並べ替えの規則そのものには手を入れません。
    func sortedShortcuts(profileId: String, categoryId: String?, sortBy: String) -> [Shortcut] {
        let shortcuts = getAll(profileId: profileId, categoryId: categoryId)

        /* 添字を持ったまま並べ替える。
           Swiftのsortedは安定ソートを保証しないため、基準で決着しない並びは元の位置で自分で決める
           （正本 sort.ts のArray.prototype.sortは安定なので、揃えるには元の位置が要る） */
        let sorted = shortcuts.enumerated().sorted { left, right in
            let result = Self.compare(left.element, right.element, sortBy: sortBy)
            if result != .orderedSame { return result == .orderedAscending }
            return left.offset < right.offset
        }

        return sorted.map { $0.element }
    }

    /// ショートカット値の一覧を表示順に並べ替える
    ///
    /// - Parameter values: 保存順（sortOrder順）の値一覧
    /// - Returns: 表示順に並べ替えた値の配列
    ///
    /// 【登録順で固定する理由】
    /// 使用回数の多い順にすると、1つ挿入するたびに行が入れ替わる。
    /// IDとパスワードのように続けて挿入する使い方では、次に押す行が押した直後に動いてしまう。
    /// 登録順なら、開いている間も挿入の前後でも並びが変わらない。
    ///
    /// 【一覧で選んだ並べ替えを効かせない理由】
    /// 値が持つのは使用回数だけで、作成日時順・更新日時順・名前順にあたる基準がありません。
    /// 4種のうち一部しか効かない並べ替えを値にも掛けると、
    /// 同じ設定なのに行によって効いたり効かなかったりして読み取れなくなります。
    func sortedValues(_ values: [ShortcutValue]) -> [ShortcutValue] {
        /* ショートカット一覧と同じ理由で、添字を持ったまま並べ替える */
        let sorted = values.enumerated().sorted { left, right in
            if left.element.sortOrder != right.element.sortOrder {
                return left.element.sortOrder < right.element.sortOrder
            }
            return left.offset < right.offset
        }

        return sorted.map { $0.element }
    }

    // MARK: - Insert Operations（挿入操作）

    /// ショートカット値をキーボードから挿入（振動フィードバック＋使用回数の記録）
    ///
    /// - Parameters:
    ///   - value: 挿入するショートカット値（変数トークンは未展開）
    ///   - textDocumentProxy: iOSのテキスト入力API（カスタムキーボードが提供）
    ///   - profileId: 変数の展開に使う、キーボード内で選択中のプロファイルID（未確定ならnil）
    ///
    /// 【処理の流れ】
    /// 1. 値の変数トークンを、選択中のプロファイルと現在の日時で展開
    /// 2. 展開した文字列をカーソル位置へ挿入（値名は挿入しない）
    /// 3. 振動フィードバック（定型文の挿入と同じ軽い振動）
    /// 4. 使用回数の記録が有効なときだけ、使用回数と親の更新日時を更新
    ///
    /// 【変数マップを挿入のたびに読み直す理由】
    /// キーボードを開いたままメインアプリで変数の値を変えても、挿入する文字列を最新の値にするため
    /// （定型文の挿入 SnippetService.insertSnippet と同じ）。
    /// プロファイルが未確定のときはカスタム変数を展開せず、システム変数だけを展開する。
    /// 展開できないトークンは元の形のまま挿入する（仕様書 §8.6）。
    func insertValue(_ value: ShortcutValue, into textDocumentProxy: UITextDocumentProxy, profileId: String?) {
        var variablesMap: [String: String] = [:]
        if let profileId = profileId {
            variablesMap = variableService.getVariablesMap(for: profileId)
        }

        let resolvedText = variableReplacer.replace(
            in: value.value,
            variablesMap: variablesMap,
            formats: SystemVariableFormatMapper.shared.getAll()
        )

        /* キーボードから値を挿入（LINEやメモアプリなど、どのアプリの入力欄にも入力されます） */
        textDocumentProxy.insertText(resolvedText)

        /* 振動フィードバック（軽い「ブッ」という振動）
           定型文の挿入（SnippetService.insertSnippet）と同じ体験に揃える */
        let generator = UIImpactFeedbackGenerator(style: .light)
        generator.impactOccurred()

        /* 使用頻度追跡が有効な場合のみ、useCountをインクリメント */
        if isUsageTrackingEnabled {
            shortcutMapper.incrementUseCount(valueId: value.id, shortcutId: value.shortcutId)
            KeyboardLog.debug("📊 [ShortcutService] Incremented use count for value: %@", value.id)
        } else {
            KeyboardLog.debug("📊 [ShortcutService] Skipped use count increment (usage tracking disabled)")
        }
    }

    // MARK: - Helper Methods（並べ替えの内部処理）

    /// 2件のショートカットの順序を求める
    ///
    /// - Parameters:
    ///   - left: 比較するショートカット
    ///   - right: 比較するショートカット
    ///   - sortBy: 並べ替えの基準
    /// - Returns: leftが先ならorderedAscending、決着しなければorderedSame
    ///
    /// 【同順位の決着まで正本に揃える理由】
    /// 同じ設定なのにメインアプリと拡張キーボードで並びが違うと、
    /// 目で覚えた位置がアプリを跨いだ途端に当てにならなくなるためです。
    private static func compare(_ left: Shortcut, _ right: Shortcut, sortBy: String) -> ComparisonResult {
        switch sortBy {
        case "updated":
            /* 更新日時の新しい順 → 名前の昇順 */
            let byUpdated = compareDescending(left.updatedAt, right.updatedAt)
            return byUpdated != .orderedSame ? byUpdated : compareAscending(left.name, right.name)

        case "title":
            /* 名前の昇順 → 作成日時の新しい順
               （定型文はタイトルを見る基準だが、ショートカットではそれにあたるのが名前） */
            let byName = compareAscending(left.name, right.name)
            return byName != .orderedSame ? byName : compareDescending(left.createdAt, right.createdAt)

        case "usage":
            /* 使用回数の合計が多い順 → 作成日時の新しい順 */
            let leftUseCount = totalUseCount(left)
            let rightUseCount = totalUseCount(right)
            if leftUseCount != rightUseCount {
                return leftUseCount > rightUseCount ? .orderedAscending : .orderedDescending
            }
            return compareDescending(left.createdAt, right.createdAt)

        default:
            /* created（既定）: 作成日時の新しい順 → 名前の昇順。
               保存済みの設定が知らない値でも一覧は出したいので、既定をこのdefaultが兼ねる */
            let byCreated = compareDescending(left.createdAt, right.createdAt)
            return byCreated != .orderedSame ? byCreated : compareAscending(left.name, right.name)
        }
    }

    /// ショートカットの使用回数
    ///
    /// - Parameter shortcut: 対象のショートカット
    /// - Returns: 値ごとの使用回数の合計
    ///
    /// 【最大値ではなく合計にする理由】
    /// 使用回数は値ごとに持つため、ショートカット単位の使用頻度は合計で表します。
    /// 「よく使う値が1つあるショートカット」と「満遍なく使うショートカット」の
    /// どちらも上位に来るようにするためです（正本 sort.ts と同じ）。
    private static func totalUseCount(_ shortcut: Shortcut) -> Int {
        return shortcut.values.reduce(0) { $0 + $1.useCount }
    }

    /// 昇順の比較結果を求める
    ///
    /// - Parameters:
    ///   - left: 比較する文字列
    ///   - right: 比較する文字列
    /// - Returns: leftが先ならorderedAscending
    private static func compareAscending(_ left: String, _ right: String) -> ComparisonResult {
        return left.compare(right)
    }

    /// 降順（日時なら新しい順）の比較結果を求める
    ///
    /// - Parameters:
    ///   - left: 比較する文字列
    ///   - right: 比較する文字列
    /// - Returns: leftが先ならorderedAscending
    ///
    /// 【日時を文字列のまま比較する理由】
    /// 日時はISO8601で桁が揃っているため、Dateへ変換しなくても辞書順で新旧を判定できます（正本 sort.ts と同じ）。
    private static func compareDescending(_ left: String, _ right: String) -> ComparisonResult {
        return right.compare(left)
    }
}
