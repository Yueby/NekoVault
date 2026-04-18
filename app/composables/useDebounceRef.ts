import { customRef } from 'vue'

/**
 * 防抖 Ref 钩子
 * 参考 @frontend-patterns
 * 用于避免频繁在按键时执行计算属性更新（尤其是大数据量的过滤操作）
 */
export function useDebounceRef<T>(value: T, delay = 200) {
  let timeout: ReturnType<typeof setTimeout>
  return customRef((track, trigger) => {
    return {
      get() {
        track()
        return value
      },
      set(newValue: T) {
        clearTimeout(timeout)
        timeout = setTimeout(() => {
          value = newValue
          trigger()
        }, delay)
      }
    }
  })
}
