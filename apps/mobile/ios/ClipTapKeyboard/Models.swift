//
//  Models.swift
//  ClipTapKeyboard
//
//  データモデル定義（TypeScript版と完全互換）
//

import Foundation

// MARK: - Snippet

struct Snippet {
    let id: String
    let title: String?
    let content: String
    let categoryId: String?
    let copyWithTitle: Bool
    let copyCount: Int         /* コピー回数（使用頻度ソート用） */
    let createdAt: String
    let updatedAt: String
    var profileIds: [String] = []  /* snippet_profilesから取得（遅延ロード） */
}

// MARK: - Category

struct Category {
    let id: String
    let name: String
    let color: String?
    let sortOrder: Int
    let createdAt: String
}

// MARK: - Profile

struct Profile {
    let id: String
    let name: String
    let isActive: Bool
    let isDefault: Bool
    let valid: Bool
    let sortOrder: Int
    let createdAt: String
    let updatedAt: String
}

// MARK: - Variable

struct Variable {
    let id: String
    let name: String
    let type: String  // 'custom' | 'system'
    let label: String?
    let icon: String?
    let valid: Bool
    let sortOrder: Int
    let createdAt: String
    let updatedAt: String
}

// MARK: - ProfileVariable

struct ProfileVariable {
    let id: String
    let profileId: String
    let variableId: String
    let value: String
    let createdAt: String
    let updatedAt: String
}

// MARK: - ProfileWithVariables (JOIN結果用)

struct ProfileWithVariables {
    let profile: Profile
    let variables: [String: String]  // variableName: value
}

// MARK: - Shortcut

struct Shortcut {
    let id: String
    let categoryId: String?    /* 所属カテゴリID（定型文と共通のcategories。未分類はnil） */
    let name: String
    let sortOrder: Int
    let createdAt: String
    let updatedAt: String
    var values: [ShortcutValue] = []  /* shortcut_valuesから取得（getAllで一括ロード） */
}

// MARK: - ShortcutValue

struct ShortcutValue {
    let id: String
    let shortcutId: String
    let name: String        /* 値を識別する名称（例: 母） */
    let value: String       /* 実際に挿入する文字列（例: 090-0000-0000） */
    let useCount: Int       /* 拡張キーボードから挿入した回数（候補の並べ替え用） */
    let sortOrder: Int
    let createdAt: String
    let updatedAt: String
}
