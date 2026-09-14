import Foundation
import AppKit
import ApplicationServices

/**
 * iOSシミュレータ上のアプリのアクセシビリティツリーを読み取るツール
 *
 * Simulator.appはiOS側のアクセシビリティ要素をmacOSのAX APIへ橋渡しする。
 * これを使うと、スクリーンショットを人が読んで座標を推測する必要がなくなり、
 * 「ラベルで要素を特定してタップする」「表示テキストを検証する」を機械的に行える。
 *
 *   ui dump [depth]          デバイス画面配下のツリーを出力（既定 depth=20）
 *   ui json                  同内容をJSON配列で出力
 *   ui texts                 表示テキストを1行ずつ出力
 *   ui find <locator>        最初の一致要素の中心座標「x y」を標準出力へ（macOS画面座標）
 *   ui rect <locator>        一致要素の「x y w h」（左上原点）
 *   ui count <locator>       一致件数を出力
 *   ui exists <locator>      一致すれば終了コード0、しなければ3
 *   ui waitfor <locator> [ms]  出現するまで待つ（既定5000ms）。出現したら中心座標を出力
 *   ui waitgone <locator> [ms] 消えるまで待つ
 *   ui findbelow <anchor> <target>  基準要素より下にある最初の対象の中心座標
 *   ui geometry              デバイス画面の矩形「x y w h」
 *
 * 終了コード: 0=成功 / 2=引数エラー・Simulator不在 / 3=要素が見つからない
 *
 * ロケータ構文（`&` で連結、すべてANDで評価。末尾の `[n]` は0起点の順序指定）
 *   label=<完全一致>      AXDescription / AXTitle との完全一致
 *   label~=<部分一致>     同上の部分一致
 *   value=<完全一致>      AXValue との完全一致
 *   value~=<部分一致>     同上の部分一致
 *   text~=<部分一致>      label / title / value のいずれかに部分一致
 *   role=<AXRole>         AXButton / AXStaticText / AXTextField など
 *   subrole=<AXSubrole>
 *   has=label             ラベルが空でない要素だけに絞る
 *   has=value             値が空でない要素だけに絞る
 *   enabled=true|false    操作可能かどうか
 *   visible=true|false    デバイス画面内にあるかどうか
 *   safe=true|false       広告バナー・ステータスバーに覆われない領域にあるか（タップ対象の判定）
 *   below=<y> / above=<y> / rightof=<x> / leftof=<x>   画面座標での位置による絞り込み
 *
 * 重要: スクロールして画面外へ出た要素も、AXツリーには画面外の実座標のまま残る。
 * 「見えていること」を確認したい場合は必ず `visible=true` を併記する。
 * タップ対象の特定にも `visible=true` を付ける（画面外をタップしても何も起きない）。
 *
 * 例
 *   ui find 'label=すべて'
 *   ui find 'role=AXButton&has=label&visible=true[2]'
 *   ui count 'role=AXButton&has=label&visible=true'
 *   ui find 'text~=進捗報告&visible=true'
 *   ui find 'label=\uF56C'        アイコンボタン（Ioniconsの私用領域グリフ）
 *
 * `\uXXXX` はUnicodeのコードポイントとして解釈する。
 * アイコンだけのボタンもラベルを持つが、中身は私用領域のグリフでCSVへ直に書けないため、
 * この記法で指定する。対応表は reference/icons.md にある。
 */

// MARK: - AXヘルパー

func attr(_ e: AXUIElement, _ k: String) -> CFTypeRef? {
    var v: CFTypeRef?
    guard AXUIElementCopyAttributeValue(e, k as CFString, &v) == .success else { return nil }
    return v
}

func str(_ e: AXUIElement, _ k: String) -> String {
    (attr(e, k) as? String) ?? ""
}

func frame(_ e: AXUIElement) -> CGRect? {
    guard let p = attr(e, kAXPositionAttribute), let s = attr(e, kAXSizeAttribute) else { return nil }
    var pt = CGPoint.zero
    var sz = CGSize.zero
    guard CFGetTypeID(p) == AXValueGetTypeID(), CFGetTypeID(s) == AXValueGetTypeID() else { return nil }
    AXValueGetValue(p as! AXValue, .cgPoint, &pt)
    AXValueGetValue(s as! AXValue, .cgSize, &sz)
    return CGRect(origin: pt, size: sz)
}

func children(_ e: AXUIElement) -> [AXUIElement] {
    (attr(e, kAXChildrenAttribute) as? [AXUIElement]) ?? []
}

func fail(_ msg: String, _ code: Int32 = 2) -> Never {
    FileHandle.standardError.write((msg + "\n").data(using: .utf8)!)
    exit(code)
}

// MARK: - ノード

struct Node {
    let role: String
    let subrole: String
    let title: String
    let desc: String
    let value: String
    let enabled: Bool
    let rect: CGRect
    let depth: Int

    /** ラベルはAXDescriptionを優先し、無ければAXTitleを使う */
    var label: String { desc.isEmpty ? title : desc }
    var center: CGPoint { CGPoint(x: rect.midX, y: rect.midY) }
}

/**
 * デバイス画面（iOSContentGroup）を探す。
 * Simulatorウィンドウにはツールバーやウィンドウ枠も含まれるため、
 * アプリ画面だけを対象にするためのアンカーとして使う。
 */
func findContentGroup(_ app: AXUIElement) -> AXUIElement? {
    var found: [AXUIElement] = []
    func walk(_ e: AXUIElement, _ d: Int) {
        if d > 8 { return }
        if str(e, kAXSubroleAttribute) == "iOSContentGroup" {
            found.append(e)
            return
        }
        for c in children(e) { walk(c, d + 1) }
    }
    func score(_ e: AXUIElement, _ d: Int = 0) -> Int {
        if d > 20 { return 0 }
        return 1 + children(e).reduce(0) { $0 + score($1, d + 1) }
    }
    walk(app, 0)
    /* 画面遷移後に空の古いContentGroupが残ることがあるため、要素数が最大のものを使う。 */
    return found.max { score($0) < score($1) }
}

func collect(_ root: AXUIElement, maxDepth: Int) -> [Node] {
    var out: [Node] = []
    func walk(_ e: AXUIElement, _ d: Int) {
        if d > maxDepth { return }
        let r = frame(e) ?? .zero
        let enabled = (attr(e, kAXEnabledAttribute) as? Bool) ?? true
        out.append(Node(
            role: str(e, kAXRoleAttribute),
            subrole: str(e, kAXSubroleAttribute),
            title: str(e, kAXTitleAttribute),
            desc: str(e, kAXDescriptionAttribute),
            value: (attr(e, kAXValueAttribute) as? String) ?? "",
            enabled: enabled,
            rect: r,
            depth: d
        ))
        for c in children(e) { walk(c, d + 1) }
    }
    walk(root, 0)
    return out
}

// MARK: - ロケータ

struct Predicate {
    let key: String
    let op: String   // "=" or "~="
    let arg: String
}

/**
 * デバイス画面の矩形。`visible=` 述語の判定に使う。
 * AXツリーには画面外へスクロールした要素も実座標のまま現れるため、
 * 「見えているか」は矩形の交差で判定しなければならない。
 */
var screenRect: CGRect = .zero

/**
 * 操作しても他の要素に邪魔されない領域。
 *
 * 画面内にあっても、下端は広告バナー、上端はステータスバーに覆われる。
 * AXの矩形は覆われていることを教えてくれないため、比率で除外する。
 * 既定値は UI_SAFE_TOP / UI_SAFE_BOTTOM 環境変数で上書きできる。
 */
var safeRect: CGRect {
    let env = ProcessInfo.processInfo.environment
    let top = Double(env["UI_SAFE_TOP"] ?? "") ?? 0.07
    let bottom = Double(env["UI_SAFE_BOTTOM"] ?? "") ?? 0.14
    return screenRect.insetBy(dx: 0, dy: 0)
        .divided(atDistance: screenRect.height * top, from: .minYEdge).remainder
        .divided(atDistance: screenRect.height * bottom, from: .maxYEdge).remainder
}

struct Locator {
    var preds: [Predicate] = []
    var index: Int = 0

    /** `role=AXButton&has=label[2]` のような文字列を解析する */
    static func parse(_ raw: String) -> Locator {
        var s = raw
        var loc = Locator()

        /* 末尾の [n] を順序指定として切り出す */
        if s.hasSuffix("]"), let open = s.lastIndex(of: "[") {
            let inner = String(s[s.index(after: open)..<s.index(before: s.endIndex)])
            if let n = Int(inner) {
                loc.index = n
                s = String(s[s.startIndex..<open])
            }
        }

        /*
         * アイコンボタンのラベルはIoniconsの私用領域グリフになる。
         * CSVへ直に書くと見えない文字になって壊れやすいので `\uXXXX` で書けるようにする。
         */
        func unescape(_ v: String) -> String {
            guard v.contains("\\u") else { return v }
            var out = ""
            var i = v.startIndex
            while i < v.endIndex {
                if v[i] == "\\", v.index(after: i) < v.endIndex, v[v.index(after: i)] == "u" {
                    let start = v.index(i, offsetBy: 2)
                    if let end = v.index(start, offsetBy: 4, limitedBy: v.endIndex),
                       let code = UInt32(v[start..<end], radix: 16),
                       let scalar = Unicode.Scalar(code) {
                        out.append(Character(scalar))
                        i = end
                        continue
                    }
                }
                out.append(v[i])
                i = v.index(after: i)
            }
            return out
        }

        for part in s.components(separatedBy: "&") where !part.isEmpty {
            if let r = part.range(of: "~=") {
                loc.preds.append(Predicate(
                    key: String(part[part.startIndex..<r.lowerBound]),
                    op: "~=",
                    arg: unescape(String(part[r.upperBound...]))
                ))
            } else if let r = part.range(of: "=") {
                loc.preds.append(Predicate(
                    key: String(part[part.startIndex..<r.lowerBound]),
                    op: "=",
                    arg: unescape(String(part[r.upperBound...]))
                ))
            } else {
                fail("ロケータの項を解析できません: \(part)")
            }
        }
        return loc
    }

    func matches(_ n: Node) -> Bool {
        for p in preds {
            let ok: Bool
            switch p.key {
            case "label":
                ok = p.op == "=" ? (n.label == p.arg) : n.label.contains(p.arg)
            case "title":
                ok = p.op == "=" ? (n.title == p.arg) : n.title.contains(p.arg)
            case "value":
                ok = p.op == "=" ? (n.value == p.arg) : n.value.contains(p.arg)
            case "text":
                let hay = [n.label, n.title, n.value]
                ok = p.op == "=" ? hay.contains(p.arg) : hay.contains { $0.contains(p.arg) }
            case "role":
                ok = n.role == p.arg
            case "subrole":
                ok = n.subrole == p.arg
            case "has":
                switch p.arg {
                case "label": ok = !n.label.isEmpty
                case "value": ok = !n.value.isEmpty
                default: fail("has= に指定できるのは label / value だけです: \(p.arg)")
                }
            case "enabled":
                ok = n.enabled == (p.arg == "true")
            case "visible":
                /* 中心が画面内にあり、かつ面積を持つものを可視とみなす */
                let vis = screenRect.contains(n.center) && n.rect.width > 0 && n.rect.height > 0
                ok = vis == (p.arg == "true")
            case "safe":
                /* 広告バナー等に覆われない領域にあるか。タップ対象の判定に使う */
                let s = safeRect.contains(n.center) && n.rect.width > 0 && n.rect.height > 0
                ok = s == (p.arg == "true")
            case "below":
                ok = Double(p.arg).map { n.rect.midY > $0 } ?? false
            case "above":
                ok = Double(p.arg).map { n.rect.midY < $0 } ?? false
            case "rightof":
                ok = Double(p.arg).map { n.rect.midX > $0 } ?? false
            case "leftof":
                ok = Double(p.arg).map { n.rect.midX < $0 } ?? false
            default:
                fail("未知のロケータ項: \(p.key)")
            }
            if !ok { return false }
        }
        return true
    }
}

// MARK: - 出力

func esc(_ s: String) -> String {
    var out = ""
    for ch in s.unicodeScalars {
        switch ch {
        case "\\": out += "\\\\"
        case "\n": out += "\\n"
        case "\"": out += "\\\""
        default:
            /*
             * 私用領域の文字（Ioniconsのグリフ）は端末では空白に見える。
             * そのまま出すと「ラベルの末尾に何も無い」ように読めてしまい、
             * 期待値を書くときに必ず食い違う。コードポイントで見えるようにする。
             */
            /* JSONに直接置けない制御文字も逃がす */
            if ch.value < 0x20 {
                out += String(format: "\\u%04X", ch.value)
            } else if ch.value >= 0xE000 && ch.value <= 0xF8FF {
                out += String(format: "\\u%04X", ch.value)
            } else {
                out.unicodeScalars.append(ch)
            }
        }
    }
    return out
}

func line(_ n: Node) -> String {
    let ind = String(repeating: "  ", count: n.depth)
    let role = n.subrole.isEmpty ? n.role : "\(n.role)/\(n.subrole)"
    var s = "\(ind)[\(role)]"
    if !n.label.isEmpty { s += " label=\"\(esc(n.label))\"" }
    if !n.value.isEmpty { s += " value=\"\(esc(n.value))\"" }
    if !n.enabled { s += " disabled" }
    if !screenRect.contains(n.center) { s += " offscreen" }
    s += " @\(Int(n.rect.midX)),\(Int(n.rect.midY)) \(Int(n.rect.width))x\(Int(n.rect.height))"
    return s
}

// MARK: - main

let args = CommandLine.arguments
guard args.count >= 2 else { fail("usage: ui <dump|json|texts|find|rect|count|exists|geometry> [...]") }

guard let simApp = NSWorkspace.shared.runningApplications
    .first(where: { $0.bundleIdentifier == "com.apple.iphonesimulator" }) else {
    fail("Simulatorが起動していません")
}

let appEl = AXUIElementCreateApplication(simApp.processIdentifier)

/*
 * 画面遷移やウィンドウのアクティブ化の直後はAXツリーが一時的に空になる。
 * 1回の失敗で権限エラーと断定すると誤検知するため、短い間隔で再試行する。
 */
var contentOpt = findContentGroup(appEl)
var retry = 0
/* 起動直後のポーリングでは待たずに諦めたい。UI_RETRY で回数を変えられる */
let maxRetry = Int(ProcessInfo.processInfo.environment["UI_RETRY"] ?? "") ?? 10
while contentOpt == nil && retry < maxRetry {
    usleep(300_000)
    contentOpt = findContentGroup(appEl)
    retry += 1
}
guard let content = contentOpt else {
    fail("デバイス画面(iOSContentGroup)を特定できません。Simulatorが起動しているか、"
        + "システム設定 > プライバシーとセキュリティ > アクセシビリティ で、このセッションの親アプリ"
        + "（Visual Studio Code / ターミナル）が許可されているかを確認してください。")
}

let cmd = args[1]
screenRect = frame(content) ?? .zero

if cmd == "geometry" {
    let r = frame(content) ?? .zero
    print("\(Int(r.origin.x)) \(Int(r.origin.y)) \(Int(r.width)) \(Int(r.height))")
    exit(0)
}

let depth = (cmd == "dump" && args.count >= 3) ? (Int(args[2]) ?? 20) : 20

/* waitfor は毎回取り直すため、ここでは1回分だけ取得する */
if cmd == "waitfor" || cmd == "waitgone" {
    guard args.count >= 3 else { fail("usage: ui \(cmd) <locator> [timeoutMs]") }
    let loc = Locator.parse(args[2])
    let timeout = args.count >= 4 ? (Int(args[3]) ?? 5000) : 5000
    let deadline = Date().addingTimeInterval(Double(timeout) / 1000.0)
    repeat {
        /* モーダル再表示や画面遷移で iOSContentGroup 自体が差し替わるため毎回取り直す。 */
        guard let current = findContentGroup(appEl) else {
            usleep(250_000)
            continue
        }
        screenRect = frame(current) ?? .zero
        let hits = collect(current, maxDepth: 20).filter { loc.matches($0) }
        let present = hits.count > loc.index
        if (cmd == "waitfor" && present) || (cmd == "waitgone" && !present) {
            if cmd == "waitfor" {
                let n = hits[loc.index]
                print("\(Int(n.center.x)) \(Int(n.center.y))")
            } else {
                print("gone")
            }
            exit(0)
        }
        usleep(250_000)
    } while Date() < deadline
    fail("\(timeout)ms 以内に条件を満たしませんでした: \(cmd) \(args[2])", 3)
}

let nodes = collect(content, maxDepth: depth)

switch cmd {
case "dump":
    for n in nodes where !(n.label.isEmpty && n.value.isEmpty && n.role == "AXGenericElement") {
        print(line(n))
    }

case "dumpall":
    for n in nodes { print(line(n)) }

case "json":
    var items: [String] = []
    for n in nodes {
        items.append("""
        {"role":"\(esc(n.role))","subrole":"\(esc(n.subrole))","label":"\(esc(n.label))",\
        "value":"\(esc(n.value))","enabled":\(n.enabled),"depth":\(n.depth),\
        "visible":\(screenRect.contains(n.center)),\
        "x":\(Int(n.rect.origin.x)),"y":\(Int(n.rect.origin.y)),\
        "w":\(Int(n.rect.width)),"h":\(Int(n.rect.height)),\
        "cx":\(Int(n.rect.midX)),"cy":\(Int(n.rect.midY))}
        """)
    }
    print("[" + items.joined(separator: ",\n") + "]")

case "texts":
    /* 既定は画面内のテキストだけ。`ui texts all` で画面外も含める */
    let includeOffscreen = args.count >= 3 && args[2] == "all"
    var seen = Set<String>()
    for n in nodes where includeOffscreen || screenRect.contains(n.center) {
        for t in [n.label, n.value] {
            /* 1行1テキストで扱えるよう改行はエスケープし、空白だけの要素は捨てる */
            let trimmed = t.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmed.isEmpty || seen.contains(trimmed) { continue }
            seen.insert(trimmed)
            print(esc(trimmed))
        }
    }

case "safecheck":
    /*
     * 「存在するか」と「安全域にあるか」を1回の読み取りで判定する。
     * 2回に分けると、遷移中に片方だけ空振りして
     * 「存在しないのにスクロールする」事故が起きる。
     *   終了コード 0 = 安全域にある（またはスクロールできる一覧が無い） / 1 = 画面内だが安全域の外 / 3 = 存在しない
     *
     * 安全域の外でも、画面外の要素が1つも無ければスクロールで動かせるものは無いため、安全域にあるとして扱う。
     * 画面下端に固定したボトムシートの項目でスクロールすると、スワイプがシートの外側のタップになり、
     * 押す前にシートを閉じてしまう。
     */
    guard args.count >= 3 else { fail("usage: ui safecheck <locator>") }
    let sc = Locator.parse(args[2])
    let hits = nodes.filter { sc.matches($0) }
    guard hits.count > sc.index else { exit(3) }
    let n = hits[sc.index]
    print("\(Int(n.center.x)) \(Int(n.center.y))")
    let hasOffscreen = nodes.contains { !screenRect.contains($0.center) }
    exit(safeRect.contains(n.center) || !hasOffscreen ? 0 : 1)

case "findbelow":
    /*
     * 一覧の行は、行ごとの操作アイコンを名前で区別できない。
     * 「この行の下にある最初の◯◯」という指定ができれば、
     * 順序指定に頼らずに目的のアイコンへ届く。
     */
    guard args.count >= 4 else { fail("usage: ui findbelow <anchorLocator> <targetLocator>") }
    let anchor = Locator.parse(args[2])
    let target = Locator.parse(args[3])
    guard let a = nodes.filter({ anchor.matches($0) }).sorted(by: { $0.rect.midY < $1.rect.midY }).first else {
        fail("基準の要素が見つかりません: \(args[2])", 3)
    }
    let below = nodes.filter { target.matches($0) && $0.rect.midY > a.rect.midY }
        .sorted { $0.rect.midY < $1.rect.midY }
    guard let hit = below.first else {
        fail("基準より下に対象が見つかりません: \(args[3])", 3)
    }
    print("\(Int(hit.center.x)) \(Int(hit.center.y))")

case "find", "rect", "count", "exists":
    guard args.count >= 3 else { fail("usage: ui \(cmd) <locator>") }
    let loc = Locator.parse(args[2])
    let hits = nodes.filter { loc.matches($0) }

    if cmd == "count" {
        print(hits.count)
        exit(0)
    }
    if cmd == "exists" {
        exit(hits.count > loc.index ? 0 : 3)
    }
    guard loc.index < hits.count else {
        fail("要素が見つかりません: \(args[2]) （一致件数 \(hits.count)）", 3)
    }
    let n = hits[loc.index]
    if cmd == "find" {
        print("\(Int(n.center.x)) \(Int(n.center.y))")
    } else {
        print("\(Int(n.rect.origin.x)) \(Int(n.rect.origin.y)) \(Int(n.rect.width)) \(Int(n.rect.height))")
    }

default:
    fail("未知のコマンド: \(cmd)")
}
