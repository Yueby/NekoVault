import Sortable, { type SortableEvent } from 'sortablejs'
import { nextTick, onBeforeUnmount, onMounted, shallowRef, unref, type Ref } from 'vue'

type SortableContainerRef = Readonly<Ref<HTMLElement | null>> | Readonly<Ref<HTMLElement[]>>

interface UseSortableManualOrderOptions {
  container: SortableContainerRef
  enabled: Readonly<Ref<boolean>>
  onReorder: (orderedIds: string[]) => Promise<void>
  onError: (error: unknown) => void
}

function readSortableIds(container: HTMLElement): string[] {
  const seenIds = new Set<string>()

  return Array.from(container.children)
    .map(child => (child as HTMLElement).dataset.sortableId)
    .filter((id): id is string => {
      if (!id || seenIds.has(id)) return false
      seenIds.add(id)
      return true
    })
}

function isSameOrder(a: string[] | undefined, b: string[]): boolean {
  return !!a && a.length === b.length && a.every((id, index) => id === b[index])
}

export function useSortableManualOrder(options: UseSortableManualOrderOptions) {
  const sortables = shallowRef<Sortable[]>([])
  const startOrders = new WeakMap<HTMLElement, string[]>()

  function getContainers(): HTMLElement[] {
    const container = options.container.value

    if (Array.isArray(container)) {
      return container.filter((item): item is HTMLElement => item instanceof HTMLElement)
    }

    return container ? [container] : []
  }

  function destroySortable() {
    for (const sortable of sortables.value) {
      sortable.destroy()
    }
    sortables.value = []
  }

  function handleDragStart(event: SortableEvent) {
    document.dispatchEvent(new CustomEvent('vault-sortable-drag-start'))
    startOrders.set(event.from, readSortableIds(event.from))
  }

  async function handleDragEnd(event: SortableEvent) {
    document.dispatchEvent(new CustomEvent('vault-sortable-drag-end'))

    const previousOrder = startOrders.get(event.from)
    startOrders.delete(event.from)

    const orderedIds = readSortableIds(event.to)
    if (orderedIds.length === 0) return
    if (event.from === event.to && isSameOrder(previousOrder, orderedIds)) return

    try {
      await options.onReorder(orderedIds)
    } catch (error) {
      options.onError(error)
    }
  }

  /** 根据容器布局自动判断拖拽方向：单列纵向，多列水平 */
  function resolveDirection(container: HTMLElement): 'vertical' | 'horizontal' {
    const first = container.firstElementChild as HTMLElement | null
    if (!first) return 'vertical'
    // 若容器只有一个子元素宽度超过容器 60%，视为单列纵向
    if (first.offsetWidth > container.offsetWidth * 0.6) return 'vertical'
    return 'horizontal'
  }

  function refreshSortable() {
    destroySortable()

    const containers = getContainers()
    if (!unref(options.enabled) || containers.length === 0) return

    sortables.value = containers.map(container => Sortable.create(container, {
      animation: 150,
      dataIdAttr: 'data-sortable-id',
      draggable: '[data-sortable-id]',
      filter: 'button, a, input, textarea, select, [contenteditable="true"], [data-sortable-ignore]',
      preventOnFilter: false,
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      dragClass: 'sortable-drag',
      forceFallback: true,
      fallbackOnBody: true,
      delay: 300,
      delayOnTouchOnly: true,
      fallbackTolerance: 5,
      touchStartThreshold: 5,
      direction: resolveDirection(container),
      swapThreshold: 1,
      invertSwap: false,
      emptyInsertThreshold: 40,
      onStart: handleDragStart,
      onEnd: handleDragEnd
    }))
  }

  function scheduleRefreshSortable() {
    void nextTick(refreshSortable)
  }

  onMounted(scheduleRefreshSortable)
  onBeforeUnmount(destroySortable)

  return {
    refreshSortable: scheduleRefreshSortable,
    destroySortable
  }
}
