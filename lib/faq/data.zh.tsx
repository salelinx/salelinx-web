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
            你可以免费试用 Starter 套餐 14 天，每个账户一次。开始试用需要绑定
            支付卡，但试用期内不会扣款，你也可以随时在账户页面取消。如果你没有
            取消，试用结束后会自动开始 Starter 订阅。各个套餐包含什么，见{' '}
            <Link href="/pricing" className="underline underline-offset-4">
              价格页面
            </Link>
            。
          </p>
        ),
        keywords: ['免费', '试用', '价格', '套餐', 'starter', '支付卡'],
      },
    ],
  },
  {
    slug: 'billing',
    title: '账户与账单',
    blurb: '套餐、发票、支付方式和取消订阅。',
    items: [
      {
        id: 'how-to-upgrade',
        q: '我要怎么升级套餐？',
        a: (
          <p>
            登录{' '}
            <Link href="/account" className="underline underline-offset-4">
              salelinx.com/account
            </Link>{' '}
            并选择一个新套餐。变更立即生效，账单周期内剩余的时间会按比例计算。
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
            并点击 <em>管理账单</em>。你会进入 Stripe 的客户门户，在那里可以
            取消。在当前周期结束之前，你仍然可以继续使用。
          </p>
        ),
        keywords: ['取消', '退订', '停止扣费'],
      },
      {
        id: 'change-plan-midmonth',
        q: '我可以在账单周期中间更换套餐吗？',
        a: (
          <p>
            可以。升级立即生效，费用按比例计算。降级会在下一个账单周期开始时
            生效，这样你已经付过的部分不会白花。
          </p>
        ),
        keywords: ['按比例', '切换', '降级'],
      },
      {
        id: 'where-are-invoices',
        q: '我在哪里可以拿到发票？',
        a: (
          <p>
            在 Stripe 的客户门户里。打开你的账户页面，点击{' '}
            <em>管理账单</em>，然后点 <em>发票记录</em>。
          </p>
        ),
        keywords: ['发票', '收据', '税', '增值税'],
      },
      {
        id: 'charged-twice',
        q: '我被扣了两次款，该怎么办？',
        a: (
          <p>
            这几乎都是一次失败后重试的扣款，而不是真的重复收费。请先在客户门户
            里查看发票记录。如果你看到两笔成功的扣款，请把发票 ID 发邮件到{' '}
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
    ],
  },
  {
    slug: 'troubleshooting',
    title: '故障排查',
    blurb: '最常见问题的解决办法。',
    items: [
      {
        id: 'panel-not-appearing',
        q: 'SaleLinx 面板没有出现在 Depop 或 Vinted 上',
        a: (
          <div className="space-y-2">
            <p>按顺序试试这几步：</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>刷新平台所在的标签页。</li>
              <li>
                确认扩展已经固定并启用（Chrome 工具栏上的拼图图标）。
              </li>
              <li>
                确认你在商品页或个人主页上。面板不会在搜索页或结账页打开。
              </li>
              <li>在扩展里退出登录后重新登录。</li>
            </ol>
          </div>
        ),
        keywords: ['面板', '不见了', '没显示', 'depop', 'vinted'],
      },
      {
        id: 'listing-failed-to-post',
        q: '商品发布失败了',
        a: (
          <p>
            大多数失败是因为你在目标平台上处于退出登录状态，或者某个必填字段
            没有对应上。请在目标平台退出登录后重新登录，然后在面板里重试。
            如果是整个平台出了问题，请查看{' '}
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
        id: 'crosslisting-stuck',
        q: '跨平台上架卡在“正在填写表单...”',
        a: (
          <p>
            扩展填写目标标签页的时候，不要去动它。如果卡了超过一分钟，
            请在面板里点 <em>取消</em> 后重试。如果在某个平台上反复出现，
            多半是他们那边改了表单布局，请看{' '}
            <Link
              href="/docs/status"
              className="underline underline-offset-4"
            >
              平台状态
            </Link>
            。
          </p>
        ),
        keywords: ['卡住', '卡死', '没反应', '很慢', '填写'],
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
            登录页面改用“使用 Google 继续”按钮。你的网站账户和扩展账户是同一个，
            所以不管用哪种方式登录回来，两边都能用。
          </p>
        ),
        keywords: ['密码', '登录', '登入', '重置', '进不去', 'google'],
      },
      {
        id: 'listings-not-syncing',
        q: '我的商品没有同步到面板里',
        a: (
          <p>
            打开面板，点击右上角的 <em>重新同步</em> 按钮。如果缺的是某一个
            商品，就在打开 SaleLinx 面板的情况下，到平台上把它打开一次，
            面板检测到之后会把它加进来。
          </p>
        ),
        keywords: ['同步', '不见了', '面板', '刷新'],
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
            不会。SaleLinx 使用你在各个平台上已有的浏览器登录状态，所以没有
            密码需要输入、保存，也就不会泄露。
          </p>
        ),
        keywords: ['密码', '登录凭据', '安全'],
      },
      {
        id: 'where-is-my-data',
        q: '我的数据存在哪里？',
        a: (
          <p>
            你的 SaleLinx 账户和商品索引存储在 Supabase（欧盟区域）。我们的
            部分服务商（例如负责支付的 Stripe）可能在英国、欧盟或美国处理
            数据，并采取相应的保障措施，详见我们的{' '}
            <Link href="/legal/privacy" className="underline underline-offset-4">
              隐私政策
            </Link>
            。平台上的数据本身仍然留在平台上。
          </p>
        ),
        keywords: ['数据', '存储', 'supabase', '区域', '欧盟'],
      },
      {
        id: 'delete-my-data',
        q: '我要怎么删除我的数据？',
        a: (
          <p>
            最快的方式是自己操作：打开{' '}
            <Link href="/account" className="underline underline-offset-4">
              你的账户
            </Link>
            ，滚动到危险区域，然后通过邮件里的链接确认。删除会立即生效。
            你也可以用账户上的邮箱地址发邮件到{' '}
            <a
              href="mailto:support@salelinx.com"
              className="underline underline-offset-4"
            >
              support@salelinx.com
            </a>
            ，我们会在 30 天内完成删除，通常会快得多。
          </p>
        ),
        keywords: ['删除', 'gdpr', '移除', '账户', '清除'],
      },
    ],
  },
];
