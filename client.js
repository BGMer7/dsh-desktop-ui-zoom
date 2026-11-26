window.__ModuleLoader__.load({
  id: 'dsh-desktop-ui-zoom',
  factory() {
    /*
     * 背景：0.2.2 起桌面 runtime 把 Cmd/Ctrl + = / - 注册成固定快捷键，只改
     * 「正文 / 代码 / 终端」字号；同一版本的新桌面壳菜单又没有「显示 → 放大」，
     * 主进程也从不调用 setZoomFactor，所以窗口级整页缩放没有入口了。
     *
     * 做法：把应用根节点 #root 整体 CSS zoom，布局按放大后的视口重排。
     *
     * 但 CSS zoom 有个坑：它只改变「视觉像素」，元素内部的布局坐标被除以 zoom。
     * 例如 zoom=1.2 时，frame 的 getBoundingClientRect().width 仍是 1280，
     * offsetWidth 却只有 1067。ui-layout 用 getBoundingClientRect().width 当
     * viewportWidth，于是右侧栏按 1280 算宽度（0.45 × 1280 = 576 布局 px，
     * 视觉上占 54%），拖动把手也按 1280 摆位置，落到面板内部 29px 处 —— 结果
     * 就是「右侧栏一打开就占半屏、还拖不动」。
     *
     * 修法：给 frame 打标记，并在这一个元素上把 getBoundingClientRect 换算回
     * 布局像素（除以 zoom）。这样 ui-layout 量到的 viewportWidth 与它实际布局
     * 的宽度一致，行为就等价于浏览器整页缩放：视口变窄、按比例重排、把手贴边。
     * 只改这一个元素，菜单等 portal 在 document.body 上，仍用视觉坐标定位。
     */
    const STEPS = [1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.75, 2]
    const DEFAULT_STEP = 2 // 1.2
    const STORAGE_KEY = 'dsh-desktop-ui-zoom.level'
    const NS = 'dsh-desktop-ui-zoom'
    const FRAME_ATTR = 'data-dsh-desktop-ui-zoom-frame'
    const SURFACE_ATTR = 'data-dsh-desktop-ui-zoom-surface'
    const TOAST_ATTR = 'data-dsh-desktop-ui-zoom-toast'

    const DICTIONARIES = {
      en: {
        'shortcut.in': 'Zoom the whole interface in',
        'shortcut.out': 'Zoom the whole interface out',
        'shortcut.reset': 'Reset interface zoom to 100%',
        'toast.level': 'Interface zoom {percent}%',
        'toast.max': 'Interface zoom {percent}% (maximum)',
      },
      zh: {
        'shortcut.in': '整体界面放大一档',
        'shortcut.out': '整体界面缩小一档',
        'shortcut.reset': '整体界面恢复 100%',
        'toast.level': '整体界面 {percent}%',
        'toast.max': '整体界面 {percent}%（已到最大）',
      },
    }

    const BINDINGS = [
      { id: 'in', labelKey: 'shortcut.in', code: 'Equal', modifiers: ['primary', 'alt'], delta: 1 },
      { id: 'out', labelKey: 'shortcut.out', code: 'Minus', modifiers: ['primary', 'alt'], delta: -1 },
      { id: 'reset', labelKey: 'shortcut.reset', code: 'Digit0', modifiers: ['primary', 'alt'], delta: 0 },
    ]

    function readStep() {
      try {
        const stored = Number(window.localStorage.getItem(STORAGE_KEY))
        const index = STEPS.indexOf(stored)
        if (index !== -1) return index
      } catch {
        /* storage unavailable: fall back to the default level */
      }
      return DEFAULT_STEP
    }

    /*
     * 找到 ui-layout 的 frame：它带内联 grid-template-columns（React 每次渲染
     * 都会写），所以选择器稳定，不依赖构建会变的 CSS Module 哈希。
     */
    function findFrame() {
      const root = document.getElementById('root')
      if (root === null) return null
      const byStyle = root.querySelector('[style*="grid-template-columns"]')
      if (byStyle !== null) return byStyle
      return root.querySelector('[class*="_frame"]')
    }

    /*
     * body 直接子元素里，哪些是「全屏浮层」：固定定位且几乎铺满视口。
     * 设置面板、插件管理器这类 modal 都走 createPortal(..., document.body)，
     * 容器是 position:fixed;inset:0，所以不进 #root 的缩放，需要单独缩放。
     * 浮层自身的 rect 在 zoom 下仍是视口尺寸（百分比/inset 会抵消），
     * 所以这个判断在缩放前后都成立，不会反复摘挂。
     */
    function isFullscreenOverlay(el) {
      const style = window.getComputedStyle(el)
      if (style.position !== 'fixed') return false
      if (style.display === 'none' || style.visibility === 'hidden') return false
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return false
      return rect.width >= window.innerWidth * 0.9 && rect.height >= window.innerHeight * 0.9
    }

    function apply(ctx) {
      if (typeof document === 'undefined' || document.head === null) return

      ctx.effect(() => ctx.locale.register(NS, DICTIONARIES), 'dsh-desktop-ui-zoom: dictionaries')
      const t = ctx.locale.bind(NS)

      let index = readStep()
      const level = () => STEPS[index]

      const paint = () => {
        document.documentElement.style.setProperty('--dsh-desktop-ui-zoom', String(level()))
      }

      /*
       * 档位提示：挂在 document.body 上（不在 #root 缩放子树里），所以它本身
       * 始终是 100%，不会被自己的缩放放大；位置也走视觉坐标，和菜单一致。
       */
      let toast = null
      let toastTimer = 0
      let introTimer = 0
      const hideToast = () => {
        if (toast !== null) toast.removeAttribute('data-visible')
      }
      const showToast = (percent, atMax) => {
        if (toast === null) return
        clearTimeout(introTimer)
        const params = { percent: String(percent) }
        toast.textContent = t(atMax ? 'toast.max' : 'toast.level', params)
        toast.setAttribute('data-visible', '')
        clearTimeout(toastTimer)
        toastTimer = setTimeout(hideToast, 1200)
      }

      ctx.effect(() => {
        const sheet = document.createElement('style')
        sheet.setAttribute('data-plugin', 'dsh-desktop-ui-zoom')
        sheet.setAttribute('data-plugin-css', 'level-toast')
        sheet.textContent = [
          '[data-dsh-desktop-ui-zoom-toast]{position:fixed;left:50%;top:calc(var(--dsh-frame-overlay-top,20px) + 8px);',
          'transform:translate(-50%,-6px);z-index:2147483000;pointer-events:none;white-space:nowrap;',
          'padding:7px 13px;border-radius:10px;opacity:0;',
          'transition:opacity .16s ease,transform .16s ease;',
          'background:var(--dsw-alias-bg-overlay,#1c1e24);color:var(--dsw-alias-label-primary,#fff);',
          'border:.5px solid var(--dsw-alias-border-l2,rgba(255,255,255,.14));',
          'box-shadow:0 8px 24px rgba(0,0,0,.24);',
          'font:500 13px/1.4 var(--dsh-font-family-text,system-ui,sans-serif)}',
          '[data-dsh-desktop-ui-zoom-toast][data-visible]{opacity:1;transform:translate(-50%,0)}',
        ].join('')
        document.head.appendChild(sheet)

        toast = document.createElement('div')
        toast.setAttribute('data-plugin', 'dsh-desktop-ui-zoom')
        toast.setAttribute(TOAST_ATTR, '')
        toast.setAttribute('aria-live', 'polite')
        document.body.appendChild(toast)

        /* 重启后如果上次不是 100%，开场提示一次，顺便说明插件在工作。 */
        introTimer = level() === 1 ? 0 : setTimeout(() => showToast(Math.round(level() * 100), false), 400)

        return () => {
          clearTimeout(introTimer)
          clearTimeout(toastTimer)
          toast?.remove()
          toast = null
          sheet.remove()
        }
      }, 'dsh-desktop-ui-zoom: level toast')

      /*
       * frame 的 getBoundingClientRect 只在这一个元素上换算成布局像素。
       * 用原型补丁 + 标记属性，这样 React 重建元素后重新标记即可，不用等到
       * 卸载再装一次。
       */
      const nativeRect = Element.prototype.getBoundingClientRect
      const shimmedRect = function () {
        const rect = nativeRect.call(this)
        const scale = level()
        if (scale === 1) return rect
        if (this.nodeType !== 1 || !this.hasAttribute(FRAME_ATTR)) return rect
        return new DOMRect(rect.x / scale, rect.y / scale, rect.width / scale, rect.height / scale)
      }

      /* 尺寸被我们改过一次，ui-layout 才会重新测量；否则它会沿用 100% 时的旧值。 */
      const remeasure = (frame) => {
        const previous = frame.style.paddingRight
        frame.style.paddingRight = '0.5px'
        requestAnimationFrame(() => {
          frame.style.paddingRight = previous
        })
      }

      ctx.effect(() => {
        Element.prototype.getBoundingClientRect = shimmedRect

        const sheet = document.createElement('style')
        sheet.setAttribute('data-plugin', 'dsh-desktop-ui-zoom')
        sheet.setAttribute('data-plugin-css', 'root-zoom')
        sheet.textContent = [
          '#root{zoom:var(--dsh-desktop-ui-zoom,1)}',
          /* 全屏浮层（设置等）挂在 body 上，是 fixed + inset:0 的容器；
             它们不在 #root 缩放子树里，所以单独缩放。面板本身按 px 定尺寸，
             zoom 会等比放大；容器 inset:0 会自动铺满视口。 */
          `[${SURFACE_ATTR}]{zoom:var(--dsh-desktop-ui-zoom,1)}`,
        ].join('')
        document.head.appendChild(sheet)
        paint()

        let marking = false
        const markFrame = () => {
          if (marking) return
          marking = true
          requestAnimationFrame(() => {
            marking = false
            const frame = findFrame()
            if (frame === null || frame.hasAttribute(FRAME_ATTR)) return
            frame.setAttribute(FRAME_ATTR, '')
            remeasure(frame)
          })
        }

        /* 挂到 body 上的全屏浮层（设置面板、插件管理器等）也跟随缩放。 */
        const scanSurface = (el) => {
          if (!(el instanceof Element)) return
          if (el.hasAttribute(SURFACE_ATTR) || el.hasAttribute(TOAST_ATTR)) return
          /* #root 里的元素已经被根节点缩放，不能再叠一层。 */
          if (el.closest('#root') !== null) return
          /* 结构兜底：modal 的 role=presentation 包裹层里一定有一个 role=dialog，
             即使刚挂载还没铺满视口，也按浮层处理。 */
          const modalWrapper = el.getAttribute('role') === 'presentation'
            && el.querySelector('[role="dialog"]') !== null
          if (modalWrapper || isFullscreenOverlay(el)) el.setAttribute(SURFACE_ATTR, '')
        }
        const markSurfaces = () => {
          for (const el of document.body.children) scanSurface(el)
          /* portal 不一定直接挂在 body 上，按 dialog/presentation 再兜一层。 */
          for (const el of document.body.querySelectorAll('[role="dialog"], [role="presentation"]')) scanSurface(el)
        }
        let surfaceTimer = 0
        const scheduleSurfaces = () => {
          markSurfaces()
          requestAnimationFrame(markSurfaces)
          clearTimeout(surfaceTimer)
          surfaceTimer = setTimeout(markSurfaces, 250)
        }

        markFrame()
        scheduleSurfaces()
        const observer = new MutationObserver(() => {
          markFrame()
          scheduleSurfaces()
        })
        observer.observe(document.getElementById('root') ?? document.body, { childList: true, subtree: true })
        observer.observe(document.body, { childList: true, subtree: true })

        return () => {
          observer.disconnect()
          clearTimeout(surfaceTimer)
          if (Element.prototype.getBoundingClientRect === shimmedRect) {
            Element.prototype.getBoundingClientRect = nativeRect
          }
          for (const frame of document.querySelectorAll(`[${FRAME_ATTR}]`)) frame.removeAttribute(FRAME_ATTR)
          for (const surface of document.querySelectorAll(`[${SURFACE_ATTR}]`)) surface.removeAttribute(SURFACE_ATTR)
          sheet.remove()
          document.documentElement.style.removeProperty('--dsh-desktop-ui-zoom')
        }
      }, 'dsh-desktop-ui-zoom: root zoom stylesheet')

      const step = (delta) => {
        const last = STEPS.length - 1
        const next = delta === 0
          ? 0
          : Math.min(last, Math.max(0, index + delta))
        if (next === index) {
          /* 已经到顶/到底：照样给一次提示，免得以为按键没生效。 */
          showToast(Math.round(level() * 100), index === last)
          return
        }
        index = next
        try {
          window.localStorage.setItem(STORAGE_KEY, String(level()))
        } catch {
          /* keep the in-memory level when storage is unavailable */
        }
        paint()
        showToast(Math.round(level() * 100), index === last)
      }

      ctx.effect(() => {
        const combinations = BINDINGS.map((spec) => {
          const described = ctx.shortcuts.describeBinding({ code: spec.code, modifiers: spec.modifiers })
          return { binding: described.binding, delta: spec.delta }
        })

        const disposers = BINDINGS.map((spec) => ctx.shortcuts.registerFixed({
          id: `uiZoom.${spec.id}`,
          label: () => t(spec.labelKey),
          keys: ctx.shortcuts.describeBinding({ code: spec.code, modifiers: spec.modifiers }).keys,
          bindings: [{ code: spec.code, modifiers: spec.modifiers }],
          group: 'application',
        }))

        const stopInput = ctx.shortcuts.observeFixedInput((input) => {
          if (input.type === 'reset') return
          const { gesture, context } = input
          if (gesture.composing || gesture.defaultPrevented || gesture.repeat) return
          if (context.region === 'terminal') return
          const matched = combinations.find(({ binding }) =>
            binding.code === gesture.code
            && ['control', 'alt', 'shift', 'meta'].every((modifier) => gesture[modifier] === binding.modifiers.includes(modifier)))
          if (matched === undefined) return
          input.consume()
          step(matched.delta)
        })

        return () => {
          stopInput()
          for (const dispose of disposers) dispose()
        }
      }, 'dsh-desktop-ui-zoom: fixed shortcuts')
    }

    return {
      name: 'dsh-desktop-ui-zoom',
      inject: ['shortcuts', 'locale'],
      apply,
    }
  },
})
