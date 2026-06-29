/*=== Worklohas 擴充功能 共用工具 ===*/

const wlLog = console.log.bind(console, '%c[WL]%c', 'color:#00bcd4;font-weight:bold', '')

function wlOnce(key, fn) {
  if (!window.__wl_injected) window.__wl_injected = {}
  if (window.__wl_injected[key]) return
  window.__wl_injected[key] = true
  fn()
}
