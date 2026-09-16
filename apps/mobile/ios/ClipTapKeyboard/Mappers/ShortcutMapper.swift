//
//  ShortcutMapper.swift
//  ClipTapKeyboard
//
//  ショートカットMapper（TypeScript版 ShortcutMapper.ts と同等）
//  拡張キーボードで必要な「取得」と「使用回数の記録」のみ実装
//

import Foundation
import SQLite3

class ShortcutMapper: BaseMapper {

    // MARK: - Singleton

    static let shared = ShortcutMapper()

    // MARK: - Constants

    /// 選択中のプロファイルで表示するショートカットの条件（? は選択中のプロファイルID 1個）
    ///
    /// 【何を出すか】
    /// 選択中のプロファイルに紐づくもの（shortcut_profiles に行がある）と、
    /// 紐づけが0件のもの（全プロファイル向け）の両方を出す。定型文の snippet_profiles と同じ扱い。
    ///
    /// 【紐づけテーブルと結合せず副問い合わせで判定する理由】
    /// 1件のショートカットは0件以上のプロファイルに紐づく。紐づけテーブルと結合すると、
    /// 0件のものは結合で漏れ、複数に紐づくものは行（と値）が重複する。
    /// 副問い合わせなら shortcuts 1行につき判定は1回で、行は増えも減りもしない。
    ///
    /// 【外側の括弧を外さない理由】
    /// 後ろにカテゴリの条件（AND s.categoryId = ?）を続けるため。括弧が無いと AND が OR より先に結び付き
    /// 「紐づく OR (紐づけ0件 AND カテゴリ一致)」と解釈され、選択中のプロファイルに紐づくものが
    /// カテゴリの絞り込みをすり抜けて出る。例外にならないため気付けない。
    ///
    /// 【文字列を変えるとき】
    /// TypeScript版 ShortcutMapper.ts・Android版 ShortcutMapper.kt の表示条件と1文字違わず同じにしている
    /// （共有パッケージのテストが3実装のソースの一致を検査する）。変えるときは3か所を同時に直す。
    private let visibleInProfileCondition = "(s.id IN (SELECT sp.shortcutId FROM shortcut_profiles sp WHERE sp.profileId = ?) OR NOT EXISTS (SELECT 1 FROM shortcut_profiles sp2 WHERE sp2.shortcutId = s.id))"

    /// 更新日時を書き込むためのフォーマッタ
    ///
    /// メインアプリ（TypeScript版 getCurrentTimestamp）は new Date().toISOString() を保存しており、
    /// ミリ秒付きのUTC表記になる。同じ列へ別表記を混ぜると更新日時の比較や表示がずれるため、
    /// 小数秒付き・UTC固定のISO8601に揃える。
    /// 生成コストを毎回払わないよう1つだけ作って使い回す。
    private static let timestampFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        formatter.timeZone = TimeZone(identifier: "UTC")
        return formatter
    }()

    // MARK: - Initialization

    private init() {
        super.init(tableName: "shortcuts")
    }

    // MARK: - Read Operations

    /// 指定プロファイル・カテゴリで表示するショートカットを値付きで取得（sortOrder順、値もsortOrder順）
    ///
    /// - Parameters:
    ///   - profileId: 選択中のプロファイルID
    ///   - categoryId: 絞り込むカテゴリID（nilは絞り込まない＝「すべて」）
    /// - Returns: ショートカットの配列（値は各ショートカットのvaluesに格納済み）
    ///
    /// 【プロファイル指定を必須にする理由】
    /// キーボードは選択中のプロファイルに紐づくショートカットと、全プロファイル向け（紐づけ0件）の
    /// ショートカットだけを出す。
    /// 全プロファイル横断で取得する用途が無いため、TypeScript版 getByProfileId() と同じく必須にする。
    /// 省略可能にすると、プロファイルを決められなかったときに全件が出てしまう。
    ///
    /// 【紐づけを表示条件で絞る理由】
    /// 各ショートカットは0件以上のプロファイルに紐づく（0件は全プロファイル向け）。
    /// 紐づけテーブルと結合すると0件のものが漏れ、複数に紐づくものが重複するため、
    /// 表示条件（上の定数）の副問い合わせで判定する（TypeScript版 ShortcutMapper.ts と同じ条件）。
    ///
    /// 【カテゴリだけ任意にする理由】
    /// カテゴリは「すべて」を選べる絞り込みであり、未選択が正常な状態のため。
    /// nilは「絞り込まない」の意味しか持たせない。未分類（categoryId IS NULL）だけを選ぶ候補は
    /// 用意していないので、ここでもIS NULLでの絞り込みは行わない。
    ///
    /// 【1回のクエリで取る理由】
    /// 挿入する値は shortcuts.value が持つため、本体を読むだけで一覧に必要なものが揃う
    /// （TypeScript版 getByProfileId() と同じ方針）。
    func getAll(profileId: String, categoryId: String?) -> [Shortcut] {
        /* WHERE句の?の並びは profileId → categoryId で揃える（表示条件の?は選択中のプロファイルID 1個だけ） */
        var parameters: [Any] = [profileId]
        var shortcutCategoryCondition = ""
        if let categoryId = categoryId {
            shortcutCategoryCondition = "AND s.categoryId = ?"
            parameters.append(categoryId)
        }

        /* 【categoryIdをSELECTの末尾に足す理由】
           列を途中に差し込むと mapShortcut の getString(statement, at:) の添字が後ろへずれる。
           ずれてもコンパイルは通り、名前の欄にカテゴリIDが出るだけで例外にならないため気付けない。
           DDLの列順と揃える必要はないので、既存の添字を動かさず末尾に足す */
        let shortcutQuery = """
            SELECT s.id, s.name, s.value, s.useCount, s.sortOrder, s.createdAt, s.updatedAt, s.categoryId
            FROM \(tableName) s
            WHERE \(visibleInProfileCondition)
            \(shortcutCategoryCondition)
            ORDER BY s.sortOrder ASC
        """

        return executeQuery(shortcutQuery, parameters: parameters) { statement in
            return self.mapShortcut(from: statement)
        }
    }


    // MARK: - Write Operations

    /// ショートカットの使用回数をインクリメントし、あわせて更新日時を進める
    ///
    /// - Parameter shortcutId: 挿入したショートカットのID
    ///
    /// 【更新日時も進める理由】
    /// メインアプリ側（TypeScript版 incrementUseCount）と同じ扱いにして、
    /// 更新日時順の並びに拡張キーボードからの利用も反映されるようにする。
    /// 使用回数と更新日時が同じ行にあるため、1文のUPDATEで足りる。
    ///
    /// 【書き込み可否を判定しない理由】
    /// 共有DBへの書き込みはフルアクセスが無いと失敗する。
    /// ただし判定はビジネスロジックであり、Mapperは渡された指示を素直に実行する。
    /// 呼び出し可否は ShortcutService 側で判断する（SnippetService.isUsageTrackingEnabled と同じ）。
    func incrementUseCount(shortcutId: String) {
        let incrementQuery = """
            UPDATE \(tableName)
            SET useCount = useCount + 1, updatedAt = ?
            WHERE id = ?
        """

        let now = Self.timestampFormatter.string(from: Date())
        _ = executeUpdate(incrementQuery, parameters: [now, shortcutId])

        KeyboardLog.debug("[ShortcutMapper] ✅ Incremented useCount for shortcut: %@", shortcutId)

        /* WALチェックポイントを実行してメインDBに即座に反映 */
        db.checkpoint()
    }

    // MARK: - Mapping

    /// SQLite結果からShortcutモデルにマッピング
    /// カラム順: id, name, value, useCount, sortOrder, createdAt, updatedAt, categoryId
    /// （DDLの列順とは異なる。getAllのSELECTを参照）
    private func mapShortcut(from statement: OpaquePointer) -> Shortcut {
        let id = getString(statement, at: 0) ?? ""
        let name = getString(statement, at: 1) ?? ""
        let value = getString(statement, at: 2) ?? ""
        let useCount = getInt(statement, at: 3)
        let sortOrder = getInt(statement, at: 4)
        let createdAt = getString(statement, at: 5) ?? ""
        let updatedAt = getString(statement, at: 6) ?? ""
        /* 未分類はNULLのままnilで持つ。空文字へ倒すと、どのカテゴリとも一致しないIDとして扱われる */
        let categoryId = getString(statement, at: 7)

        return Shortcut(
            id: id,
            categoryId: categoryId,
            name: name,
            value: value,
            useCount: useCount,
            sortOrder: sortOrder,
            createdAt: createdAt,
            updatedAt: updatedAt
        )
    }
}
