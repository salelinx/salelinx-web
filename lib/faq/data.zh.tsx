import { Link } from '@/i18n/navigation';
import { CHROME_WEB_STORE_URL } from '@/lib/site';
import { InstallExtensionButton } from '@/components/InstallExtensionButton';
import type { FAQGroup } from './types';

export const FAQ_GROUPS_ZH: FAQGroup[] = [
  {
    slug: 'getting-started',
    title: '快速上手',
    blurb: '安装 SaleLinx、登录，以及支持的浏览器。',
    items: [
      {
        id: 'how-do-i-install',
        q: '我要怎么安装 SaleLinx 扩展？',
        a: (
          <>
            <p>
              从{' '}
              <a
                href={CHROME_WEB_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4"
              >
                Chrome Web Store
              </a>{' '}
              安装，并把扩展固定到工具栏。带截图的完整步骤见{' '}
              <Link
                href="/docs/getting-started/install-the-extension"
                className="underline underline-offset-4"
              >
                安装 SaleLinx 扩展
              </Link>
              。
            </p>
            <InstallExtensionButton
              label="添加到 Chrome"
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
            />
          </>
        ),
        keywords: ['安装', '设置', 'chrome', '添加'],
      },
      {
        id: 'which-browsers',
        q: 'SaleLinx 支持哪些浏览器？',
        a: (
          <p>
            任何基于 Chromium 的浏览器：Google Chrome、Microsoft Edge、Brave、
            Arc、Opera。不支持 Safari 和 Firefox。
          </p>
        ),
        keywords: ['浏览器', 'chrome', 'edge', 'safari', 'firefox', 'brave'],
      },
      {
        id: 'free-trial',
        q: '试用需要付费吗？',
        a: (
          <p>
            不需要。你可以免费试用 Starter 套餐 14 天，功能和 Starter 相同，但
            用量额度更低（见{' '}
            <Link href="/pricing" className="underline underline-offset-4">
              价格页面
            </Link>
            ）。开始试用需要绑定支付卡，但试用期内不会扣款，你也可以随时在
            账户页面取消。每个 SaleLinx 账户、每个 Depop、Vinted 或 eBay 店铺
            都只能试用一次。如果你没有取消，试用结束后会自动开始 Starter 订阅。
          </p>
        ),
        keywords: ['免费', '试用', '价格', '套餐', 'starter', '支付卡'],
      },
    ],
  },
  {
    slug: 'billing',
    title: '账户与账单',
    blurb: '套餐、发票、取消订阅和推荐奖励。',
    items: [
      {
        id: 'how-to-upgrade',
        q: '我要怎么升级套餐？',
        a: (
          <p>
            如果你已经是付费套餐，打开{' '}
            <Link href="/account" className="underline underline-offset-4">
              账户页面
            </Link>
            ，点击 <strong>管理订阅</strong>，在 Stripe 的账单门户里选择新套餐。
            如果你还在免费试用期，请改为在{' '}
            <Link href="/pricing" className="underline underline-offset-4">
              价格页面
            </Link>{' '}
            选择套餐，或在账户页面点击 <strong>立即开通 Starter</strong>。这样
            会结束试用并立即从你的卡上扣款，新的额度马上生效。
          </p>
        ),
        keywords: ['升级', '套餐', '更换', '级别'],
      },
      {
        id: 'how-to-cancel',
        q: '我要怎么取消订阅？',
        a: (
          <p>
            打开你的{' '}
            <Link href="/account" className="underline underline-offset-4">
              账户页面
            </Link>{' '}
            并点击 <strong>管理订阅</strong>。Stripe 的账单门户会打开，你可以
            在那里取消。在已付费周期结束之前，你仍然可以继续使用，期间也可以在
            同一个地方恢复订阅。如果在免费试用期内取消，不会扣任何费用。
          </p>
        ),
        keywords: ['取消', '退订', '停止扣费'],
      },
      {
        id: 'change-plan-midmonth',
        q: '我可以在账单周期中间更换套餐吗？',
        a: (
          <p>
            可以。免费试用期内，在{' '}
            <Link href="/pricing" className="underline underline-offset-4">
              价格页面
            </Link>{' '}
            选择套餐会提前结束试用：立即从你的卡上扣除该套餐的费用，它的额度
            也马上生效。如果是付费套餐，所有更改都在 Stripe 的账单门户里完成：
            在{' '}
            <Link href="/account" className="underline underline-offset-4">
              账户页面
            </Link>{' '}
            点击 <strong>管理订阅</strong> 并选择套餐。降级到更低的套餐，始终
            要通过 <strong>管理订阅</strong>。
          </p>
        ),
        keywords: ['按比例', '切换', '降级', '试用'],
      },
      {
        id: 'where-are-invoices',
        q: '我在哪里可以拿到发票？',
        a: (
          <p>
            打开你的{' '}
            <Link href="/account" className="underline underline-offset-4">
              账户页面
            </Link>{' '}
            并点击 <strong>管理订阅</strong>。Stripe 的账单门户会显示你的发票
            记录，每张发票都可以下载。
          </p>
        ),
        keywords: ['发票', '收据', '税', '增值税'],
      },
      {
        id: 'charged-twice',
        q: '我被扣了两次款，该怎么办？',
        a: (
          <p>
            这几乎都是一次失败后重试的扣款，而不是真的重复收费。请先查看你的
            发票：在账户页面点击 <strong>管理订阅</strong>，就能在 Stripe 的
            账单门户里看到。如果你看到两笔成功的扣款，请把发票编号发邮件到{' '}
            <a
              href="mailto:support@salelinx.com"
              className="underline underline-offset-4"
            >
              support@salelinx.com
            </a>
            ，我们会把重复的那笔退给你。
          </p>
        ),
        keywords: ['重复', '退款', '多扣', '扣款'],
      },
      {
        id: 'refer-and-earn',
        q: 'Refer & Earn 推荐计划是怎么运作的？',
        a: (
          <p>
            在 SaleLinx 面板的 <strong>Refer &amp; Earn</strong> 标签页，或{' '}
            <Link href="/account" className="underline underline-offset-4">
              账户页面
            </Link>{' '}
            的 <strong>推荐好友</strong> 区域复制你的链接。通过这个链接注册的
            朋友，第一个月可以享受折扣。朋友付款之后，你自己的套餐会获得免费
            时长：对方选 Starter 送 1 周，选 Pro 送 2 周，选 Business 送 1 个月。
            奖励会在对方首次付款大约一周后，以抵扣额度的形式计入你下一张
            SaleLinx 账单，前提是你自己有一个套餐。完整规则见{' '}
            <Link
              href="/legal/referral-terms"
              className="underline underline-offset-4"
            >
              推荐计划条款
            </Link>
            。
          </p>
        ),
        keywords: ['推荐', '邀请', '好友', '奖励', '抵扣', '折扣', 'refer'],
      },
    ],
  },
  {
    slug: 'troubleshooting',
    title: '故障排查',
    blurb: '最常见问题的解决办法。',
    items: [
      {
        id: 'panel-not-appearing',
        q: 'SaleLinx 面板没有出现在 Depop、Vinted 或 eBay 上',
        a: (
          <div className="space-y-2">
            <p>
              面板从每个 Depop、Vinted 和 eBay 页面右下角的 SaleLinx 启动按钮
              打开：点击它，或者在这些标签页里按 Alt+S（默认快捷键）。
              Chrome 工具栏上的 SaleLinx 图标只会打开一个用于登录的小窗口。
              如果你看不到启动按钮：
            </p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>
                刷新平台标签页。安装或更新 SaleLinx 时已经打开的标签页需要
                刷新一次。
              </li>
              <li>
                确认 SaleLinx 已启用：打开 chrome://extensions，查看它的开关。
              </li>
              <li>
                还是没有？请{' '}
                <Link
                  href="/help/support"
                  className="underline underline-offset-4"
                >
                  联系支持
                </Link>
                。
              </li>
            </ol>
          </div>
        ),
        keywords: ['面板', '不见了', '没显示', '启动按钮', 'depop', 'vinted', 'ebay'],
      },
      {
        id: 'update-available',
        q: 'SaleLinx 提示有可用更新，或者说我落后了几个版本',
        a: (
          <p>
            Chrome 会自动更新 SaleLinx。新版本下载完成后，面板会显示一条提示：
            点击 <strong>Reload to update</strong>，页面就会刷新到新版本。如果
            面板说你落后了一个或多个版本，说明 Chrome 还没有获取更新。点击{' '}
            <strong>Open extensions page</strong>（或打开 chrome://extensions），
            打开右上角的 <strong>开发者模式</strong>，点击{' '}
            <strong>更新</strong>，然后刷新你的 Depop、Vinted 和 eBay 标签页。
          </p>
        ),
        keywords: ['更新', '版本', '落后', '过时', '重新加载'],
      },
      {
        id: 'in-use-another-device',
        q: 'SaleLinx 提示正在另一台设备上使用',
        a: (
          <p>
            你可以在多台设备上保持登录，但同一时间只有一台设备能使用
            SaleLinx。如果面板显示 <strong>In use on another device</strong>，
            点击 <strong>Use here instead</strong> 就能在这台设备上继续使用，
            另一台设备会退出 SaleLinx。如果你刚在另一台设备上关掉了平台
            标签页，大约 10 分钟内也会自动释放。如果你不认识那台设备，
            先接管使用，然后在{' '}
            <Link href="/account" className="underline underline-offset-4">
              账户页面
            </Link>{' '}
            修改密码。
          </p>
        ),
        keywords: ['设备', '另一台设备', '电脑', '共用', 'use here'],
      },
      {
        id: 'salelinx-temporarily-down',
        q: 'SaleLinx 提示暂时无法使用',
        a: (
          <p>
            这表示面板现在连不上我们的服务器。Depop、Vinted 和 eBay 不受影响，
            你可以照常使用这三个网站，上面的商品也不会有任何变化。SaleLinx 恢复连接
            后，这条提示会自动消失，所以不需要重新安装、退出登录或重置密码，
            即使登录界面显示同样的提示也一样。从 1.1.12 版本起，这条提示会
            覆盖整个面板，并带有 <strong>Close SaleLinx</strong> 按钮；更早的
            版本会把它显示为面板顶部的横幅。
          </p>
        ),
        keywords: ['故障', '无法使用', '宕机', '不能用', '离线'],
      },
      {
        id: 'cant-sign-in',
        q: '我被退出登录了，而且登不回去',
        a: (
          <p>
            在{' '}
            <Link
              href="/auth/forgot-password"
              className="underline underline-offset-4"
            >
              salelinx.com/auth/forgot-password
            </Link>{' '}
            重置密码。如果你是用 Google 注册的，那就没有密码可以重置：请在
            登录页面改用 <strong>使用 Google 继续</strong> 按钮。你的网站账户和
            扩展账户是同一个，所以不管用哪种方式登录回来，两边都能用。
          </p>
        ),
        keywords: ['密码', '登录', '登入', '重置', '进不去', 'google'],
      },
      {
        id: 'open-a-marketplace-tab',
        q: 'SaleLinx 让我打开一个 Depop 或 Vinted 标签页',
        a: (
          <p>
            SaleLinx 是通过你自己已登录的 Depop 和 Vinted 会话工作的，所以每个
            Depop 或 Vinted 功能都需要在 Chrome 里的某个地方打开对应平台的
            标签页。任何窗口都可以，也不必是你正在看的那个标签页。点击提示里的{' '}
            <strong>Open Depop</strong> 或 <strong>Open Vinted</strong>，或者
            自己打开网站；在 Depop 和 Vinted 之间跨平台上架需要两个都打开。
            eBay 从来不需要标签页，因为它通过 eBay 自己的登录连接，所以无论是
            上架到 eBay 还是从 eBay 复制出来，都只需要打开 Depop 或 Vinted
            标签页。如果标签页已经打开，但
            SaleLinx 仍要求重新加载（例如 Chrome 为了节省内存让它休眠了），
            请点击 <strong>Reload Depop tab</strong> 或{' '}
            <strong>Reload Vinted tab</strong>。从 1.1.12 版本起，
            <strong>My Listings</strong> 在刷新时也会提供打开缺失标签页的按钮；
            更早的版本即使没有打开任何标签页，也会要求你重新加载。
          </p>
        ),
        keywords: ['标签页', '打开', '重新加载', 'depop', 'vinted', 'ebay'],
      },
      {
        id: 'wrong-marketplace-account',
        q: 'SaleLinx 说我在 Depop 或 Vinted 上登录的是另一个账号',
        a: (
          <p>
            SaleLinx 只能配合已关联的 Depop 和 Vinted 账号使用；只要网站登录的
            是其他账号，该平台的功能就会暂停。解决办法：在 Depop 或 Vinted 上
            退出登录，用已关联的账号重新登录，然后重新加载标签页。如果你想让
            SaleLinx 改用另一个账号，请在面板里打开 <strong>Settings</strong>，
            在 <strong>Marketplace accounts</strong> 下点击{' '}
            <strong>Unlink</strong>，然后为你当前登录的账号点击{' '}
            <strong>Link</strong>。eBay 的情况不同：无论 eBay 网站登录的是哪个
            账号，SaleLinx 始终使用在 <strong>Settings</strong> 里关联的 eBay
            账号。详见{' '}
            <Link
              href="/docs/getting-started/connect-your-first-marketplace"
              className="underline underline-offset-4"
            >
              连接你的第一个平台
            </Link>
            。
          </p>
        ),
        keywords: ['另一个账号', '账号不对', '账号不一致', '重新关联', '取消关联'],
      },
      {
        id: 'account-already-linked',
        q: 'SaleLinx 说我的 Depop、Vinted 或 eBay 账号已被关联，或已用过免费试用',
        a: (
          <p>
            每个 Depop、Vinted 或 eBay 账号同一时间只能关联一个 SaleLinx 账户。
            如果它关联在你的另一个 SaleLinx 账户上，请先登录那个账户，在{' '}
            <strong>Settings</strong> 里点击 <strong>Unlink</strong>，再回到
            当前账户进行关联。另外，每个店铺只能免费试用一次：如果它已经在
            另一个 SaleLinx 账户上用过试用，你需要先在{' '}
            <Link href="/pricing" className="underline underline-offset-4">
              价格页面
            </Link>{' '}
            开通付费套餐，才能在这里关联它。如果你无法登录另一个账户，请{' '}
            <Link href="/help/support" className="underline underline-offset-4">
              联系支持
            </Link>
            。
          </p>
        ),
        keywords: ['已关联', '关联', '试用', '另一个账户', '无法关联'],
      },
      {
        id: 'listings-not-syncing',
        q: '我的商品没有显示，或者不是最新的',
        a: (
          <p>
            只要打开了对应平台的标签页，并且登录的是你已关联的账号，SaleLinx
            就会从 Depop 和 Vinted 读取你的商品。在 <strong>My Listings</strong>{' '}
            顶部，每个平台旁边的状态会显示它上次同步的时间：点击{' '}
            <strong>Update All</strong>，或某个平台旁边的刷新按钮，即可立即
            同步。如果它提示你打开或重新加载标签页，或者说会话已过期，请在
            平台网站上照做，然后再刷新一次。eBay 商品直接来自 eBay，不需要
            标签页：最多每 15 分钟更新一次，你会看到在售的 eBay 商品，以及过去
            60 天内售出的商品。如果 eBay 的状态显示{' '}
            <strong>reconnect in Settings</strong>，请打开{' '}
            <strong>Settings</strong>，在 eBay 一行点击 <strong>Link</strong>。
            详见{' '}
            <Link
              href="/docs/inventory/listings"
              className="underline underline-offset-4"
            >
              My Listings 指南
            </Link>
            。
          </p>
        ),
        keywords: ['同步', '不见了', 'my listings', '刷新', '过时', 'ebay'],
      },
      {
        id: 'crosslisting-stuck',
        q: '跨平台上架卡住了或无法开始',
        a: (
          <div className="space-y-2">
            <p>按顺序检查这几点：</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>
                你要复制的来源平台和目标平台都已关联。对于 Depop 和 Vinted，
                还需要各打开一个标签页，并登录已关联的账号；eBay 不需要标签页。
                面板会告诉你缺了哪一个。
              </li>
              <li>
                查看面板侧边栏底部的<Link href="/docs/getting-started/queue" className="underline underline-offset-4">队列</Link>。SaleLinx 一次只运行一个任务，所以在
                前一个任务完成之前，跨平台上架会显示 <strong>Queued</strong>。
                如果显示 <strong>Paused</strong>，请点击{' '}
                <strong>Resume</strong>。
              </li>
              <li>
                <strong>Rate limited</strong> 表示 Depop 或 Vinted 正在限制请求。
                SaleLinx 会等待，倒计时结束后自动继续。
              </li>
              <li>
                <strong>eBay is busy right now</strong> 表示 eBay 暂时拒绝请求。
                请稍后再试；没有任何商品被发布，也没有产生任何费用。
              </li>
              <li>
                如果你已经用完本月的跨平台上架额度，SaleLinx 会提示已达到上限。
                额度在每月初（UTC 时间）重置；更大的套餐见{' '}
                <Link href="/pricing" className="underline underline-offset-4">
                  价格页面
                </Link>
                。
              </li>
            </ol>
            <p>
              如果某个平台一直失败，请查看{' '}
              <Link
                href="/docs/status"
                className="underline underline-offset-4"
              >
                平台状态页面
              </Link>
              。
            </p>
          </div>
        ),
        keywords: ['卡住', '卡死', '没反应', '很慢', '排队', '跨平台上架', 'ebay', '繁忙'],
      },
      {
        id: 'listing-failed-to-post',
        q: '某个商品跨平台上架失败了',
        a: (
          <p>
            面板侧边栏底部的队列会显示有多少件商品失败。大多数失败是因为你在
            要复制到的平台上处于退出登录状态，或者该平台不接受某些信息。请用
            已关联的账号登录那个平台，然后在 <strong>My Listings</strong> 里
            选中该商品，再点一次 <strong>Crosslist</strong>。如果 eBay 拒绝了
            某件商品，检查步骤会说明 eBay 需要什么，通常是尺码或适用人群这类
            物品属性：点击 <strong>Fill in</strong> 补上，这件商品就能发布了。
            从 1.1.12 版本起，
            失败的商品不再计入你每月的跨平台上架额度。如果是整个平台出了问题，
            请查看{' '}
            <Link
              href="/docs/status"
              className="underline underline-offset-4"
            >
              平台状态页面
            </Link>
            。
          </p>
        ),
        keywords: ['失败', '报错', '发布', '跨平台上架', '上传'],
      },
      {
        id: 'presets-not-syncing',
        q: '我保存的预设在另一台电脑上没有出现',
        a: (
          <p>
            保存的预设通过你的 SaleLinx 账号同步，任何有效的套餐或试用期都可以。
            先确认两台设备登录的是同一个账号，并且套餐处于有效状态。当前选中的
            预设是每台设备各自记录的，所以在第二台电脑上需要重新选一次。退出登录
            会清除该浏览器里的预设，下次登录后会恢复。详见{' '}
            <Link
              href="/docs/getting-started/account-and-subscription"
              className="underline underline-offset-4"
            >
              账号与订阅
            </Link>
            。
          </p>
        ),
        keywords: ['预设', '设置', '同步', '设备'],
      },
      {
        id: 'contact-support',
        q: '我要怎么联系支持？',
        a: (
          <p>
            打开 SaleLinx 面板里的 <strong>Support</strong> 标签页，选择{' '}
            <strong>Type</strong>，描述问题，然后点击 <strong>Submit</strong>。
            从面板提交的工单会附带你的扩展版本和套餐，方便我们查找原因。你也
            可以通过{' '}
            <Link href="/help/support" className="underline underline-offset-4">
              联系页面
            </Link>{' '}
            给我们留言，或发邮件到{' '}
            <a
              href="mailto:support@salelinx.com"
              className="underline underline-offset-4"
            >
              support@salelinx.com
            </a>
            。我们回复时会发邮件通知你，你可以在 Support 标签页的{' '}
            <strong>My tickets</strong> 里，或在{' '}
            <Link href="/account" className="underline underline-offset-4">
              账户页面
            </Link>{' '}
            的 <strong>你的工单</strong> 里查看并回复。
          </p>
        ),
        keywords: ['支持', '联系', '帮助', '工单', '邮件', '问题'],
      },
    ],
  },
  {
    slug: 'ebay',
    title: 'eBay',
    blurb: '连接 eBay、管理和跨平台上架 eBay 商品，以及费用。',
    items: [
      {
        id: 'ebay-connect',
        q: '怎么连接我的 eBay 账户？',
        a: <p>打开 SaleLinx 面板，进入<em>Settings</em>，在 eBay 一行点击<em>Link</em>。在 eBay 自己的页面登录，并同意让 SaleLinx 管理你的商品。SaleLinx 不会看到你的 eBay 密码，你随时可以取消连接。</p>,
        keywords: ['ebay', '连接', '账户'],
      },
      {
        id: 'ebay-fees',
        q: '跨平台上架到 eBay 要收费吗？',
        a: <p>eBay 会收取正常的刊登费用，和手动上架一样。SaleLinx 会在发布前显示每件商品的 eBay 费用，你可以先返回或移除商品。eBay 没有草稿，所以商品会直接上线。</p>,
        keywords: ['ebay', '费用', '跨平台上架'],
      },
      {
        id: 'ebay-tab',
        q: '需要打开 eBay 标签页吗？',
        a: (
          <p>
            不需要。eBay 通过 eBay 自己的登录连接，所以不用打开 eBay 标签页，
            SaleLinx 也能访问你的 eBay 商品。不过面板本身仍然要从 Depop、Vinted
            或 eBay 页面打开。
          </p>
        ),
        keywords: ['ebay', '标签页', '打开'],
      },
      {
        id: 'ebay-manage-listings',
        q: '我可以在 SaleLinx 里编辑、结束或重新上架 eBay 商品吗？',
        a: (
          <p>
            可以。你的 eBay 商品会出现在 <strong>My Listings</strong> 里。打开
            一件商品，就可以编辑标题、描述、价格、数量、照片、成色、类目和物品
            属性，并直接保存到 eBay。<strong>Unlist</strong> 会结束这条刊登；
            eBay 没有删除功能，所以删除一行 eBay 商品也会结束刊登。已结束的
            商品打开后会有 <strong>Relist</strong> 选项。详见{' '}
            <Link
              href="/docs/inventory/listings"
              className="underline underline-offset-4"
            >
              My Listings 指南
            </Link>
            。
          </p>
        ),
        keywords: ['ebay', '编辑', '结束', '下架', '重新上架', '删除', 'my listings'],
      },
      {
        id: 'ebay-postage',
        q: '跨平台上架到 eBay 时，运费信息从哪里来？',
        a: (
          <p>
            来自你的 eBay 账户。SaleLinx 会使用你的 eBay 业务政策，或者从你
            现有的某条 eBay 刊登中复制运费和退货设置。如果没有可以复制的内容，
            Crosslist 标签页会请你填写一次运费，之后你可以在{' '}
            <strong>Settings &rarr; eBay &rarr; Postage</strong> 里修改。
          </p>
        ),
        keywords: ['ebay', '运费', '邮寄', '退货', '政策'],
      },
      {
        id: 'ebay-busy',
        q: '“eBay is busy right now” 是什么意思？',
        a: (
          <p>
            这表示 eBay 暂时拒绝请求。请稍后再试；没有任何商品被发布，也没有
            产生任何费用。
          </p>
        ),
        keywords: ['ebay', '繁忙', '错误', '重试'],
      },
      {
        id: 'ebay-reconnect',
        q: 'SaleLinx 让我重新连接 eBay',
        a: (
          <p>
            eBay 授予 SaleLinx 的权限过一段时间就会失效；如果你在 eBay 账户里
            移除了 SaleLinx 的访问权限，它也会失效。请在面板里打开{' '}
            <strong>Settings</strong>，在 eBay 一行点击 <strong>Link</strong>，
            重新授权即可。你的 eBay 商品不受影响。
          </p>
        ),
        keywords: ['ebay', '重新连接', '关联', '过期', '访问权限'],
      },
      {
        id: 'ebay-disconnect',
        q: '怎么断开 eBay 连接？',
        a: (
          <p>
            在面板里打开 <strong>Settings</strong>，在 eBay 一行点击{' '}
            <strong>Unlink</strong>。SaleLinx 会立即删除它的 eBay 访问权限，
            你在 eBay 上的商品保持不变。
          </p>
        ),
        keywords: ['ebay', '断开', '取消关联', 'unlink', '移除'],
      },
    ],
  },
  {
    slug: 'privacy',
    title: '隐私与数据',
    blurb: '我们存了什么、存在哪里，以及怎么删除。',
    items: [
      {
        id: 'store-marketplace-password',
        q: 'SaleLinx 会保存我的平台密码吗？',
        a: (
          <p>
            不会。SaleLinx 通过你在自己浏览器里已经登录的 Depop 和 Vinted 会话
            工作，所以你从来不需要把平台密码交给我们。为了把店铺关联到你的
            SaleLinx 账户，我们只保存它的用户名和账号 ID。eBay 通过 eBay 自己的登录页连接，SaleLinx 不会看到你的 eBay 密码。对于 eBay，我们还会保存 eBay 提供的访问令牌，以便 SaleLinx 管理你的商品。
          </p>
        ),
        keywords: ['密码', '登录凭据', '安全'],
      },
      {
        id: 'where-is-my-data',
        q: '我的数据存在哪里？',
        a: (
          <p>
            你的 SaleLinx 账户、套餐、设置和已关联店铺的用户名，存放在我们的
            数据库服务商 Supabase，付款由 Stripe 处理。商品详情和照片只有在你
            把商品保存到云端时才会存放在我们这里；SaleLinx 从 Depop 和 Vinted
            读取的其他内容不会保存在我们的服务器上。eBay 请求会经过我们的
            服务器，服务器会保存 eBay 为你的账户授予的访问权限，以及你为 eBay
            跨平台上架设置的运费信息，包括你的发货邮编。数据通过 HTTPS 传输，
            Supabase 对存储的数据进行静态加密，访问规则会把每件商品和每张照片
            都绑定到你的账户。我们的服务商在哪里处理数据，详见我们的{' '}
            <Link href="/legal/privacy" className="underline underline-offset-4">
              隐私政策
            </Link>
            。
          </p>
        ),
        keywords: ['数据', '存储', 'supabase', '云端', '区域', '加密'],
      },
      {
        id: 'delete-my-data',
        q: '我要怎么删除我的数据？',
        a: (
          <p>
            打开你的{' '}
            <Link href="/account" className="underline underline-offset-4">
              账户页面
            </Link>
            ，滚动到最底部，点击 <strong>删除账户</strong>。输入密码（如果你用
            Google 登录则不需要），我们会给你发送一封带确认链接的邮件：请在
            60 分钟内、保持登录状态打开它，并再确认一次。之后你的账户、商品、
            图片、已关联的平台账号（包括你的 eBay 连接）、使用记录和支持工单
            会立即删除，任何订阅都会
            取消，剩余时间不予退款。你也可以用账户上的邮箱地址发邮件到{' '}
            <a
              href="mailto:support@salelinx.com"
              className="underline underline-offset-4"
            >
              support@salelinx.com
            </a>
            ，我们会在 30 天内完成删除。
          </p>
        ),
        keywords: ['删除', 'gdpr', '移除', '账户', '清除'],
      },
    ],
  },
];
