package com.sikakou.cliptap.keyboard

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.sikakou.cliptap.R
import com.sikakou.cliptap.models.Shortcut

/**
 * ショートカット一覧を表示するRecyclerView用アダプター
 *
 * 【値の一覧と分ける理由】
 * 表示する項目（ショートカット名だけ／値名と値の2行）も、選んだときの意味（次の階層へ／挿入）も
 * 別のものなので、ShortcutValueAdapterと別のアダプターにしている。
 */
class ShortcutAdapter(
    private val onShortcutClick: (Shortcut) -> Unit
) : ListAdapter<Shortcut, ShortcutAdapter.ShortcutViewHolder>(ShortcutDiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ShortcutViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_shortcut, parent, false)
        return ShortcutViewHolder(view, onShortcutClick)
    }

    override fun onBindViewHolder(holder: ShortcutViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    class ShortcutViewHolder(
        itemView: View,
        private val onShortcutClick: (Shortcut) -> Unit
    ) : RecyclerView.ViewHolder(itemView) {

        private val nameTextView: TextView = itemView.findViewById(R.id.shortcutName)

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

        fun bind(shortcut: Shortcut) {
            currentShortcut = shortcut
            nameTextView.text = shortcut.name
        }
    }

    private class ShortcutDiffCallback : DiffUtil.ItemCallback<Shortcut>() {
        override fun areItemsTheSame(oldItem: Shortcut, newItem: Shortcut): Boolean {
            return oldItem.id == newItem.id
        }

        override fun areContentsTheSame(oldItem: Shortcut, newItem: Shortcut): Boolean {
            return oldItem == newItem
        }
    }
}
