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

  function handleSortStart(event: SortableEvent) {
    startOrders.set(event.from, readSortableIds(event.from))
  }

  async function handleSortEnd(event: SortableEvent) {
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
      fallbackTolerance: 3,
      touchStartThreshold: 5,
      direction: 'horizontal',
      swapThreshold: 1,
      invertSwap: false,
      emptyInsertThreshold: 40,
      onStart: handleSortStart,
      onEnd: handleSortEnd
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
