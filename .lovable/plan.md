

## Fix: Cursor Losing Focus in Caixinha de Desabafo Reply

### Root Cause

`MessageCard`, `MessageDetailOwn`, and `MessageDetailSocio` are defined as **inline component functions** inside the parent `CaixinhaDesabafo` component (lines 451, 510, 570). When `replyText` state changes on every keystroke, the parent re-renders and recreates these function references. React sees a "new" component type each render, so it **unmounts and remounts** the detail panel — destroying the textarea and its focus.

### Fix

Convert `MessageDetailSocio` from an inline component to **direct JSX** at the usage site (line 946), so React sees the same element tree on each render and preserves focus. Same treatment for `MessageDetailOwn` and `MessageCard` for consistency, though the critical fix is `MessageDetailSocio` since that's where the reply textarea lives.

Alternatively (simpler approach): keep the inline components but **move `replyText` state into a separate child component** so changing it doesn't re-render the parent. However, the cleanest fix is to inline the JSX directly where it's used.

### Implementation

**File: `src/pages/CaixinhaDesabafo.tsx`**

1. Remove the `MessageDetailSocio` inline component definition (lines 570-720)
2. Replace `<MessageDetailSocio msg={selectedMessage} />` at line 946 with the JSX directly
3. Do the same for `MessageDetailOwn` (lines 510-567) → inline at line 893
4. Do the same for `MessageCard` (lines 451-507) → inline at lines 879 and 932

This ensures that when `replyText` changes, React updates the textarea value in-place instead of remounting the entire subtree.

### Files to edit
- `src/pages/CaixinhaDesabafo.tsx` — inline the 3 sub-components

