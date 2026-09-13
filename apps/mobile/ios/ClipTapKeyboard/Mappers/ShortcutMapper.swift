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

    /// ショートカット値のテーブル名
    /// BaseMapperのtableNameは親テーブル（shortcuts）を指すため、子テーブルは個別に保持する
    private let valueTableName = "shortcut_values"

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
    /// 【値を1回のクエリでまとめて取る理由】
    /// ショートカットごとに値を問い合わせると、キーボードを開くたびに件数分のクエリが走る。
    /// 全件を1回で取り、ショートカットIDで振り分ける（TypeScript版 getByProfileId() と同じ方針）。
    func getAll(profileId: String, categoryId: String?) -> [Shortcut] {
        /* 親（shortcuts）と値（shortcut_values）の2本は、WHERE句の?の並びが profileId → categoryId で揃っている
           （表示条件の?は選択中のプロファイルID 1個だけ）。
           バインド値を1つの配列で共有しておけば、片方にだけ条件を足して並びが食い違う組み方にならない */
        var parameters: [Any] = [profileId]
        var shortcutCategoryCondition = ""
        var valueCategoryCondition = ""
        if let categoryId = categoryId {
            shortcutCategoryCondition = "AND s.categoryId = ?"
            valueCategoryCondition = "AND s.categoryId = ?"
            parameters.append(categoryId)
        }

        /* 【categoryIdをSELECTの末尾に足す理由】
           列を途中に差し込むと mapShortcut の getString(statement, at:) の添字が後ろへずれる。
           ずれてもコンパイルは通り、名前の欄にカテゴリIDが出るだけで例外にならないため気付けない。
           DDLの列順と揃える必要はないので、既存の添字を動かさず末尾に足す */
        let shortcutQuery = """
            SELECT s.id, s.name, s.sortOrder, s.createdAt, s.updatedAt, s.categoryId
            FROM \(tableName) s
            WHERE \(visibleInProfileCondition)
            \(shortcutCategoryCondition)
            ORDER BY s.sortOrder ASC
        """

        let shortcuts: [Shortcut] = executeQuery(shortcutQuery, parameters: parameters) { statement in
            return self.mapShortcut(from: statement)
        }

        /* 挿入する中身は shortcut_values.value が持つ（1つの文字列で、プロファイルごとには持たない）。
           カスタム変数を参照している値（variableId あり）だけは、保存された文字列を使わず
           profile_variables 側の値を見る。
           参照の解決順序は「選択中のプロファイルの非空値 → 標準プロファイルの非空値 → 空文字」で、
           カスタム変数の展開（仕様書 §8.6）および正本の TypeScript版 shortcuts/resolveValue.ts と同じ。

           空文字を未設定として読み飛ばすために NULLIF を挟む。値を入力せずに保存すると
           空文字が保存され得るため、NULLのままでは «設定済みの空» と区別できない。

           参照中は自前の中身を見ない。両方を見にいくと、どちらが挿入されるのか利用者が判断できない。 */
        let defaultProfileId = self.defaultProfileId() ?? ""
        let resolvedValue = """
            CASE WHEN v.variableId IS NULL THEN v.value
            ELSE
              COALESCE(
                NULLIF((SELECT pv.value FROM profile_variables pv
                         WHERE pv.variableId = v.variableId AND pv.profileId = ?), ''),
                NULLIF((SELECT pv.value FROM profile_variables pv
                         WHERE pv.variableId = v.variableId AND pv.profileId = ?), ''),
                ''
              )
            END
        """

        /* 値にも同じ絞り込みを掛ける。
           shortcut_values は紐づくプロファイルもカテゴリも持たないため、親の shortcuts と結合し、
           ショートカット側と同じ表示条件とカテゴリ条件を掛ける（TypeScript版 ShortcutMapper.ts の値の取得と同じ方針）。
           ここを絞らないと、表示しないショートカットの値を読み込んだうえで捨てるだけの無駄が出る。
           紐づけ（shortcut_profiles）は結合せず表示条件の副問い合わせで判定するため、
           複数のプロファイルに紐づくショートカットでも値は重複せず、紐づけ0件の値も落ちない。

           SELECTの列の並びは変えていないため、mapShortcutValueの添字はそのまま使える。
           中身を解決する式を4列目に置き、元の `v.value` と同じ位置に保っている。 */
        let valueQuery = """
            SELECT v.id, v.shortcutId, v.name, \(resolvedValue) AS value,
                   v.useCount, v.sortOrder, v.createdAt, v.updatedAt
            FROM \(valueTableName) v
            INNER JOIN \(tableName) s ON s.id = v.shortcutId
            WHERE \(visibleInProfileCondition)
            \(valueCategoryCondition)
            ORDER BY v.shortcutId ASC, v.sortOrder ASC
        """

        /* 解決の?（SELECT句）はWHERE句の?より前に現れるため、先頭へ並べる。
           SQLiteは出現順に束縛するので、この順序を崩すと中身と絞り込みが入れ替わる */
        let valueParameters: [Any] = [profileId, defaultProfileId] + parameters

        let values: [ShortcutValue] = executeQuery(valueQuery, parameters: valueParameters) { statement in
            return self.mapShortcutValue(from: statement)
        }

        /* ショートカットIDごとに値をまとめる（1回の走査で振り分ける） */
        var valuesByShortcutId: [String: [ShortcutValue]] = [:]
        for value in values {
            valuesByShortcutId[value.shortcutId, default: []].append(value)
        }

        return shortcuts.map { shortcut in
            var resolved = shortcut
            resolved.values = valuesByShortcutId[shortcut.id] ?? []
            return resolved
        }
    }

    // MARK: - Write Operations

    /// ショートカット値の使用回数をインクリメントし、親ショートカットの更新日時を進める
    ///
    /// - Parameters:
    ///   - valueId: 挿入したショートカット値のID
    ///   - shortcutId: その値が属するショートカットのID
    ///
    /// 【親の更新日時も進める理由】
    /// メインアプリ側（TypeScript版 incrementUseCount）と同じ扱いにして、
    /// 更新日時順の並びに拡張キーボードからの利用も反映されるようにする。
    ///
    /// 【書き込み可否を判定しない理由】
    /// 共有DBへの書き込みはフルアクセスが無いと失敗する。
    /// ただし判定はビジネスロジックであり、Mapperは渡された指示を素直に実行する。
    /// 呼び出し可否は ShortcutService 側で判断する（SnippetService.isUsageTrackingEnabled と同じ）。
    func incrementUseCount(valueId: String, shortcutId: String) {
        let incrementQuery = """
            UPDATE \(valueTableName)
            SET useCount = useCount + 1
            WHERE id = ?
        """

        _ = executeUpdate(incrementQuery, parameters: [valueId])

        let touchQuery = """
            UPDATE \(tableName)
            SET updatedAt = ?
            WHERE id = ?
        """

        let now = Self.timestampFormatter.string(from: Date())
        _ = executeUpdate(touchQuery, parameters: [now, shortcutId])

        KeyboardLog.debug("[ShortcutMapper] ✅ Incremented useCount for value: %@", valueId)

        /* WALチェックポイントを実行してメインDBに即座に反映 */
        db.checkpoint()
    }

    // MARK: - Resolution

    /// 標準プロファイルのIDを取得する
    ///
    /// - Returns: 標準プロファイルのID（確定できない場合はnil）
    ///
    /// 【使いみち】
    /// カスタム変数を参照しているショートカット値の中身は、選択中のプロファイルに非空の値が無ければ
    /// 標準プロファイルの値へ落とす。カスタム変数の展開（仕様書 §8.6）と同じ順序に揃えるためのフォールバック先。
    /// 参照していない値は保存された文字列をそのまま使うため、ここは関係しない。
    private func defaultProfileId() -> String? {
        let query = "SELECT id FROM profiles WHERE isDefault = 1 LIMIT 1"
        let ids: [String] = executeQuery(query, parameters: []) { statement in
            return self.getString(statement, at: 0) ?? ""
        }
        return ids.first { !$0.isEmpty }
    }

    // MARK: - Mapping

    /// SQLite結果からShortcutモデルにマッピング
    /// カラム順: id, name, sortOrder, createdAt, updatedAt, categoryId
    /// （DDLの列順とは異なる。getAllのSELECTを参照）
    private func mapShortcut(from statement: OpaquePointer) -> Shortcut {
        let id = getString(statement, at: 0) ?? ""
        let name = getString(statement, at: 1) ?? ""
        let sortOrder = getInt(statement, at: 2)
        let createdAt = getString(statement, at: 3) ?? ""
        let updatedAt = getString(statement, at: 4) ?? ""
        /* 未分類はNULLのままnilで持つ。空文字へ倒すと、どのカテゴリとも一致しないIDとして扱われる */
        let categoryId = getString(statement, at: 5)

        return Shortcut(
            id: id,
            categoryId: categoryId,
            name: name,
            sortOrder: sortOrder,
            createdAt: createdAt,
            updatedAt: updatedAt,
            values: []  /* 値はgetAllでまとめて差し込む */
        )
    }

    /// SQLite結果からShortcutValueモデルにマッピング
    /// カラム順: id, shortcutId, name, value, useCount, sortOrder, createdAt, updatedAt
    private func mapShortcutValue(from statement: OpaquePointer) -> ShortcutValue {
        let id = getString(statement, at: 0) ?? ""
        let shortcutId = getString(statement, at: 1) ?? ""
        let name = getString(statement, at: 2) ?? ""
        let value = getString(statement, at: 3) ?? ""
        let useCount = getInt(statement, at: 4)
        let sortOrder = getInt(statement, at: 5)
        let createdAt = getString(statement, at: 6) ?? ""
        let updatedAt = getString(statement, at: 7) ?? ""

        return ShortcutValue(
            id: id,
            shortcutId: shortcutId,
            name: name,
            value: value,
            useCount: useCount,
            sortOrder: sortOrder,
            createdAt: createdAt,
            updatedAt: updatedAt
        )
    }
}
