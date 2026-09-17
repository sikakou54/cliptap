package com.sikakou.cliptap.keyboard

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.sikakou.cliptap.R
import com.sikakou.cliptap.models.MASKED_VALUE_TEXT
import com.sikakou.cliptap.models.Shortcut
import com.sikakou.cliptap.models.ShortcutValue
import com.sikakou.cliptap.utils.VariableReplacer

/**
 * ショートカット一覧に並べる1行
 *
 * ショートカットの行と、その値の行を1本のリストに混ぜて並べる。
 * 値を見るのに画面を移らず、ショートカットの行をタップするとその場で値が開く形にしているため、
 * 行ごとにどちらを表しているかを持つ。
 */
sealed class ShortcutListRow {
    /** ショートカットの行（タップで値の開閉） */
    data class ShortcutItem(val shortcut: Shortcut, val isExpanded: Boolean) : ShortcutListRow()

    /** 開いているショートカットの値の行（タップで挿入） */
    data class ValueItem(val value: ShortcutValue) : ShortcutListRow()
}

/**
 * ショートカット一覧を表示するRecyclerView用アダプター
 *
 * 【1本のリストに値を混ぜる理由】
 * 値の一覧を別の画面にすると、1つ挿入するたびにショートカット一覧まで戻ることになる。
 * IDとパスワードのように続けて入れたい値があるとき、戻って選び直す手数が毎回かかる。
 * その場で開けば、開いている間は値を続けて押せる。
 *
 * 【ショートカットの行に値を出さない理由】
 * 1件のショートカットは値を複数持つため、代表の1件だけを出すと「出ていない値がある」ことが伝わらない。
 * 名前だけを出し、タップで開いて全部を見せる。
 *
 * 【値を展開して表示する理由】
 * 挿入されるのは変数トークン（{{name}}）を展開した文字列のため、表示も選択中のプロファイルで展開する
 * （定型文一覧のタイトルを展開して出す SnippetAdapter と同じ）。
 * 伏せる指定の値は展開そのものを行わず、記号に置き換える。
 */
class ShortcutAdapter(
    private val onShortcutClick: (Shortcut) -> Unit,
    private val onValueClick: (ShortcutValue) -> Unit
) : ListAdapter<ShortcutListRow, RecyclerView.ViewHolder>(ShortcutRowDiffCallback()) {

    /** 表示用に値の変数トークンを展開する */
    private val variableReplacer = VariableReplacer()

    /**
     * 表示に使う、選択中のプロファイルの変数マップ（変数名 → 値）
     *
     * 一覧を出す直前に呼び出し側が読み直して入れる。
     * 行の表示はバインド時にこの値を読むため、submitList より前に入れること。
     */
    var variablesMap: Map<String, String> = emptyMap()

    /** 表示に使う、システム変数の書式（変数キー → パターン） */
    var systemVariableFormats: Map<String, String> = emptyMap()

    override fun getItemViewType(position: Int): Int = when (getItem(position)) {
        is ShortcutListRow.ShortcutItem -> VIEW_TYPE_SHORTCUT
        is ShortcutListRow.ValueItem -> VIEW_TYPE_VALUE
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
        val inflater = LayoutInflater.from(parent.context)
        return if (viewType == VIEW_TYPE_SHORTCUT) {
            ShortcutViewHolder(inflater.inflate(R.layout.item_shortcut, parent, false), onShortcutClick)
        } else {
            ShortcutValueViewHolder(inflater.inflate(R.layout.item_shortcut_value, parent, false), onValueClick)
        }
    }

    override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
        when (val row = getItem(position)) {
            is ShortcutListRow.ShortcutItem -> {
                (holder as ShortcutViewHolder).bind(row.shortcut, row.isExpanded)
            }
            is ShortcutListRow.ValueItem -> {
                val displayValue = if (row.value.isMasked) {
                    MASKED_VALUE_TEXT
                } else {
                    variableReplacer.replace(row.value.value, variablesMap, systemVariableFormats)
                }
                (holder as ShortcutValueViewHolder).bind(row.value, displayValue)
            }
        }
    }

    /** ショートカットの行（名前と開閉の印） */
    class ShortcutViewHolder(
        itemView: View,
        private val onShortcutClick: (Shortcut) -> Unit
    ) : RecyclerView.ViewHolder(itemView) {

        private val nameTextView: TextView = itemView.findViewById(R.id.shortcutName)
        private val chevronImageView: ImageView = itemView.findViewById(R.id.shortcutChevron)

        /** 現在この行が表示しているショートカット */
        private var currentShortcut: Shortcut? = null

        init {
            /* 行全体を1つのタッチ対象として扱う。
               バインドのたびにリスナーを作り直すとスクロール中に無駄なオブジェクトを生成するため、
               生成時に1回だけ設定して表示中のショートカットを参照する */
            itemView.setOnClickListener {
                currentShortcut?.let(onShortcutClick)
            }
        }

        /**
         * 行にショートカットを表示する
         *
         * @param shortcut 表示するショートカット
         * @param isExpanded 値を開いているか
         */
        fun bind(shortcut: Shortcut, isExpanded: Boolean) {
            currentShortcut = shortcut
            nameTextView.text = shortcut.name
            chevronImageView.setImageResource(
                if (isExpanded) R.drawable.ic_chevron_up else R.drawable.ic_chevron_down
            )
        }
    }

    /** 開いているショートカットの値の行 */
    class ShortcutValueViewHolder(
        itemView: View,
        private val onValueClick: (ShortcutValue) -> Unit
    ) : RecyclerView.ViewHolder(itemView) {

        private val valueTextView: TextView = itemView.findViewById(R.id.shortcutValue)

        /** 現在この行が表示している値 */
        private var currentValue: ShortcutValue? = null

        init {
            itemView.setOnClickListener {
                currentValue?.let(onValueClick)
            }
        }

        /**
         * 行に値を表示する
         *
         * @param value 表示する値
         * @param displayValue 変数トークンを展開した文字列（伏せる指定なら記号に置き換え済み）
         */
        fun bind(value: ShortcutValue, displayValue: String) {
            currentValue = value
            /* 改行は空白へ置き換える。改行をそのまま出すと、値の中の改行の数だけ行が高くなり、
               1件の値でキーボードの高さを使い切ってしまうため。長い値は折り返して全文を見せる。
               挿入するのは元の文字列のままで、表示だけを整える */
            valueTextView.text = displayValue.replace(Regex("\\R"), " ")
        }
    }

    private class ShortcutRowDiffCallback : DiffUtil.ItemCallback<ShortcutListRow>() {
        override fun areItemsTheSame(oldItem: ShortcutListRow, newItem: ShortcutListRow): Boolean {
            return when {
                oldItem is ShortcutListRow.ShortcutItem && newItem is ShortcutListRow.ShortcutItem ->
                    oldItem.shortcut.id == newItem.shortcut.id
                oldItem is ShortcutListRow.ValueItem && newItem is ShortcutListRow.ValueItem ->
                    oldItem.value.id == newItem.value.id
                else -> false
            }
        }

        override fun areContentsTheSame(oldItem: ShortcutListRow, newItem: ShortcutListRow): Boolean {
            return oldItem == newItem
        }
    }

    private companion object {
        const val VIEW_TYPE_SHORTCUT = 0
        const val VIEW_TYPE_VALUE = 1
    }
}
