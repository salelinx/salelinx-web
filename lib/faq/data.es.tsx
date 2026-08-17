import { Link } from '@/i18n/navigation';
import { CHROME_WEB_STORE_URL } from '@/lib/site';
import { InstallExtensionButton } from '@/components/InstallExtensionButton';
import type { FAQGroup } from './types';

export const FAQ_GROUPS_ES: FAQGroup[] = [
  {
    slug: 'getting-started',
    title: 'Primeros pasos',
    blurb: 'Instalar SaleLinx, iniciar sesión y navegadores compatibles.',
    items: [
      {
        id: 'how-do-i-install',
        q: '¿Cómo instalo la extensión de SaleLinx?',
        a: (
          <>
            <p>
              Instala desde{' '}
              <a
                href={CHROME_WEB_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4"
              >
                Chrome Web Store
              </a>{' '}
              y ancla la extensión en tu barra de herramientas. Tutorial completo con capturas en{' '}
              <Link
                href="/docs/getting-started/install-the-extension"
                className="underline underline-offset-4"
              >
                Instalar la extensión SaleLinx
              </Link>
              .
            </p>
            <InstallExtensionButton
              label="Añadir a Chrome"
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
            />
          </>
        ),
        keywords: ['instalar', 'configurar', 'chrome', 'añadir'],
      },
      {
        id: 'which-browsers',
        q: '¿Qué navegadores admite SaleLinx?',
        a: (
          <p>
            Cualquier navegador basado en Chromium: Google Chrome, Microsoft Edge, Brave, Arc, Opera. Safari y Firefox no están admitidos.
          </p>
        ),
        keywords: ['navegador', 'chrome', 'edge', 'safari', 'firefox', 'brave'],
      },
      {
        id: 'free-trial',
        q: '¿Hace falta pagar para probarlo?',
        a: (
          <p>
            Tienes una prueba gratuita de 14 días del plan Starter, una por
            cuenta. Se requiere una tarjeta para empezarla, pero no se cobra
            nada durante la prueba y puedes cancelar en cualquier momento
            desde tu página de cuenta. Si no cancelas, tu suscripción Starter
            empieza automáticamente al terminar la prueba. Consulta{' '}
            <Link href="/pricing" className="underline underline-offset-4">
              los precios
            </Link>{' '}
            para ver qué incluye cada nivel.
          </p>
        ),
        keywords: ['gratis', 'prueba', 'precios', 'plan', 'tarjeta'],
      },
    ],
  },
  {
    slug: 'billing',
    title: 'Cuenta y facturación',
    blurb: 'Planes, facturas, métodos de pago y cancelaciones.',
    items: [
      {
        id: 'how-to-upgrade',
        q: '¿Cómo subo de plan?',
        a: (
          <p>
            Inicia sesión en{' '}
            <Link href="/account" className="underline underline-offset-4">
              salelinx.com/account
            </Link>{' '}
            y elige un plan nuevo. El cambio se aplica de inmediato y se te prorratea el resto del periodo de facturación.
          </p>
        ),
        keywords: ['subir', 'plan', 'cambiar', 'nivel'],
      },
      {
        id: 'how-to-cancel',
        q: '¿Cómo cancelo mi suscripción?',
        a: (
          <p>
            Abre tu{' '}
            <Link href="/account" className="underline underline-offset-4">
              página de cuenta
            </Link>{' '}
            y haz clic en <em>Gestionar facturación</em>. Llegarás al portal de cliente de Stripe donde puedes cancelar. Mantienes el acceso hasta el final del periodo actual.
          </p>
        ),
        keywords: ['cancelar', 'anular', 'dejar de facturar'],
      },
      {
        id: 'change-plan-midmonth',
        q: '¿Puedo cambiar de plan a mitad del periodo de facturación?',
        a: (
          <p>
            Sí. Las subidas de plan aplican de inmediato con facturación prorrateada. Las bajadas aplican al inicio del siguiente periodo para que no pierdas lo que ya pagaste.
          </p>
        ),
        keywords: ['prorratear', 'cambiar', 'bajar plan'],
      },
      {
        id: 'where-are-invoices',
        q: '¿Dónde consigo mis facturas?',
        a: (
          <p>
            En el portal de cliente de Stripe. Abre tu página de cuenta, haz clic en{' '}
            <em>Gestionar facturación</em> y luego en <em>Historial de facturas</em>.
          </p>
        ),
        keywords: ['factura', 'recibo', 'impuesto', 'iva'],
      },
      {
        id: 'charged-twice',
        q: 'Me cobraron dos veces, ¿qué hago?',
        a: (
          <p>
            Casi siempre es un cargo fallido que se reintentó, no un duplicado real. Revisa primero el historial de facturas en el portal de cliente. Si ves dos cargos correctos, escribe a{' '}
            <a
              href="mailto:support@salelinx.com"
              className="underline underline-offset-4"
            >
              support@salelinx.com
            </a>{' '}
            con los IDs de factura y te reembolsaremos el duplicado.
          </p>
        ),
        keywords: ['duplicado', 'reembolso', 'cobro', 'cargo'],
      },
    ],
  },
  {
    slug: 'troubleshooting',
    title: 'Solución de problemas',
    blurb: 'Soluciones a lo que suele fallar.',
    items: [
      {
        id: 'panel-not-appearing',
        q: 'El panel de SaleLinx no aparece en Depop o Vinted',
        a: (
          <div className="space-y-2">
            <p>Prueba esto en orden:</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>Refresca la pestaña de la marketplace.</li>
              <li>
                Comprueba que la extensión está anclada y activada (icono del puzle en la barra de Chrome).
              </li>
              <li>
                Confirma que estás en una página de producto o perfil. El panel no se abre en páginas de búsqueda o pago.
              </li>
              <li>Cierra sesión y vuelve a iniciarla desde la extensión.</li>
            </ol>
          </div>
        ),
        keywords: ['panel', 'falta', 'no se ve', 'depop', 'vinted'],
      },
      {
        id: 'listing-failed-to-post',
        q: 'No se pudo publicar un anuncio',
        a: (
          <p>
            La mayoría de fallos vienen de que estás sin sesión en la marketplace de destino o de un campo obligatorio que no mapea bien. Cierra sesión y vuelve a entrar en la marketplace de destino y reintenta desde el panel. Si una marketplace entera está caída, mira la{' '}
            <Link
              href="/docs/status"
              className="underline underline-offset-4"
            >
              página de estado de plataformas
            </Link>
            .
          </p>
        ),
        keywords: ['fallo', 'error', 'publicar', 'crosslist', 'subir'],
      },
      {
        id: 'crosslisting-stuck',
        q: 'El crosslisting se queda en «Rellenando formulario...»',
        a: (
          <p>
            No toques la pestaña de destino mientras la extensión la rellena. Si lleva atascado más de un minuto, haz clic en <em>Cancelar</em> en el panel y reintenta. Si se repite siempre en una marketplace, suele ser un cambio en el diseño del formulario por su parte; mira el{' '}
            <Link
              href="/docs/status"
              className="underline underline-offset-4"
            >
              estado de plataformas
            </Link>
            .
          </p>
        ),
        keywords: ['atascado', 'colgado', 'lento', 'rellenar'],
      },
      {
        id: 'cant-sign-in',
        q: 'Se cerró mi sesión y no puedo volver a entrar',
        a: (
          <p>
            Restablece tu contraseña en{' '}
            <Link
              href="/auth/forgot-password"
              className="underline underline-offset-4"
            >
              salelinx.com/auth/forgot-password
            </Link>
            . Si te registraste con Google, no hay contraseña que restablecer:
            usa el botón Continuar con Google en la página de inicio de
            sesión. Tu cuenta del sitio y de la extensión son la misma, así
            que cualquiera de las dos formas de entrar vale para ambas.
          </p>
        ),
        keywords: ['contraseña', 'acceso', 'restablecer', 'bloqueado', 'google'],
      },
      {
        id: 'listings-not-syncing',
        q: 'Mis anuncios no se sincronizan con el panel',
        a: (
          <p>
            Abre el panel y haz clic en el botón <em>Resincronizar</em> en la parte superior derecha. Si falta un anuncio concreto, ábrelo en la marketplace una vez con el panel de SaleLinx abierto; el panel lo añade al detectarlo.
          </p>
        ),
        keywords: ['sincronizar', 'falta', 'panel', 'actualizar'],
      },
    ],
  },
  {
    slug: 'privacy',
    title: 'Privacidad y datos',
    blurb: 'Qué guardamos, dónde está y cómo eliminarlo.',
    items: [
      {
        id: 'store-marketplace-password',
        q: '¿SaleLinx guarda mi contraseña de las marketplaces?',
        a: (
          <p>
            No. SaleLinx usa tu sesión de navegador existente en cada marketplace, así que no hay contraseña que introducir, guardar ni filtrar.
          </p>
        ),
        keywords: ['contraseña', 'credenciales', 'seguridad'],
      },
      {
        id: 'where-is-my-data',
        q: '¿Dónde se almacenan mis datos?',
        a: (
          <p>
            Tu cuenta de SaleLinx y el índice de anuncios se almacenan en
            Supabase (región UE). Algunos de nuestros proveedores (por ejemplo
            Stripe para los pagos) pueden tratar datos en el Reino Unido, la UE
            o EE. UU. con las garantías adecuadas, como se describe en nuestra{' '}
            <Link href="/legal/privacy" className="underline underline-offset-4">
              política de privacidad
            </Link>
            . Los datos de las marketplaces se quedan en la propia marketplace.
          </p>
        ),
        keywords: ['datos', 'almacenamiento', 'supabase', 'región', 'ue'],
      },
      {
        id: 'delete-my-data',
        q: '¿Cómo elimino mis datos?',
        a: (
          <p>
            Lo más rápido es la opción de autoservicio: abre{' '}
            <Link href="/account" className="underline underline-offset-4">
              tu cuenta
            </Link>
            , ve a la zona de peligro y confirma con el enlace que recibirás
            por correo. La eliminación es inmediata. También puedes escribir a{' '}
            <a
              href="mailto:support@salelinx.com"
              className="underline underline-offset-4"
            >
              support@salelinx.com
            </a>{' '}
            desde la dirección de tu cuenta y completaremos la eliminación en
            un plazo de 30 días, normalmente mucho antes.
          </p>
        ),
        keywords: ['eliminar', 'rgpd', 'borrar', 'cuenta'],
      },
    ],
  },
];
