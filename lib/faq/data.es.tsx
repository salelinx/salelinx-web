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
            No. Tienes una prueba gratuita de 14 días del plan Starter, con las
            mismas funciones que Starter y límites más bajos (consulta{' '}
            <Link href="/pricing" className="underline underline-offset-4">
              los precios
            </Link>
            ). Se requiere una tarjeta para empezarla, pero no se cobra nada
            durante la prueba y puedes cancelar en cualquier momento desde tu
            página de cuenta. Hay una prueba por cuenta de SaleLinx y por
            tienda de Depop o Vinted. Si no cancelas, tu suscripción Starter
            empieza automáticamente al terminar la prueba.
          </p>
        ),
        keywords: ['gratis', 'prueba', 'precios', 'plan', 'tarjeta'],
      },
    ],
  },
  {
    slug: 'billing',
    title: 'Cuenta y facturación',
    blurb: 'Planes, facturas, cancelaciones y recompensas por recomendar.',
    items: [
      {
        id: 'how-to-upgrade',
        q: '¿Cómo subo de plan?',
        a: (
          <p>
            Con un plan de pago, abre tu{' '}
            <Link href="/account" className="underline underline-offset-4">
              página de cuenta
            </Link>
            , haz clic en <strong>Gestionar suscripción</strong> y elige el
            plan nuevo en el portal de facturación de Stripe. Durante la prueba
            gratuita, elige un plan en la{' '}
            <Link href="/pricing" className="underline underline-offset-4">
              página de precios
            </Link>{' '}
            o haz clic en <strong>Empezar Starter ahora</strong> en tu página
            de cuenta. Así terminas la prueba, se cobra tu tarjeta en el
            momento y los nuevos límites se aplican de inmediato.
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
            y haz clic en <strong>Gestionar suscripción</strong>. Se abre el
            portal de facturación de Stripe, donde puedes cancelar. Mantienes
            el acceso hasta el final del periodo que ya pagaste y, hasta
            entonces, puedes reactivarla desde el mismo sitio. Si cancelas
            durante la prueba gratuita, no se te cobra nada.
          </p>
        ),
        keywords: ['cancelar', 'anular', 'dejar de facturar'],
      },
      {
        id: 'change-plan-midmonth',
        q: '¿Puedo cambiar de plan a mitad del periodo de facturación?',
        a: (
          <p>
            Sí. Durante la prueba gratuita, elegir un plan en la{' '}
            <Link href="/pricing" className="underline underline-offset-4">
              página de precios
            </Link>{' '}
            termina la prueba antes de tiempo: se cobra ese plan en tu tarjeta
            en el momento y sus límites se aplican de inmediato. Con un plan de
            pago, todos los cambios se hacen en el portal de facturación de
            Stripe: haz clic en <strong>Gestionar suscripción</strong> en tu{' '}
            <Link href="/account" className="underline underline-offset-4">
              página de cuenta
            </Link>{' '}
            y elige el plan. Para bajar a un plan inferior, usa siempre{' '}
            <strong>Gestionar suscripción</strong>.
          </p>
        ),
        keywords: ['prorratear', 'cambiar', 'bajar plan', 'prueba'],
      },
      {
        id: 'where-are-invoices',
        q: '¿Dónde consigo mis facturas?',
        a: (
          <p>
            Abre tu{' '}
            <Link href="/account" className="underline underline-offset-4">
              página de cuenta
            </Link>{' '}
            y haz clic en <strong>Gestionar suscripción</strong>. Se abre el
            portal de facturación de Stripe con tu historial de facturas, donde
            puedes descargar cada una.
          </p>
        ),
        keywords: ['factura', 'recibo', 'impuesto', 'iva'],
      },
      {
        id: 'charged-twice',
        q: 'Me cobraron dos veces, ¿qué hago?',
        a: (
          <p>
            Casi siempre es un cargo fallido que se reintentó, no un duplicado
            real. Revisa primero tus facturas:{' '}
            <strong>Gestionar suscripción</strong> en tu página de cuenta las
            abre en el portal de facturación de Stripe. Si ves dos cargos
            correctos, escribe a{' '}
            <a
              href="mailto:support@salelinx.com"
              className="underline underline-offset-4"
            >
              support@salelinx.com
            </a>{' '}
            con los números de factura y te reembolsaremos el duplicado.
          </p>
        ),
        keywords: ['duplicado', 'reembolso', 'cobro', 'cargo'],
      },
      {
        id: 'refer-and-earn',
        q: '¿Cómo funciona Recomienda y gana?',
        a: (
          <p>
            Copia tu enlace desde la pestaña{' '}
            <strong>Recomienda y gana</strong> del panel de SaleLinx, o desde{' '}
            <strong>Recomienda a un amigo</strong> en tu{' '}
            <Link href="/account" className="underline underline-offset-4">
              página de cuenta
            </Link>
            . Los amigos que se registren con él obtienen un descuento en su
            primer mes. Cuando un amigo ha pagado, ganas tiempo gratis en tu
            propio plan: 1 semana si elige Starter, 2 semanas por Pro y 1 mes
            por Business. Llega como saldo a favor en tu siguiente factura de
            SaleLinx aproximadamente una semana después de su primer pago,
            siempre que tengas un plan propio. Todas las reglas están en las{' '}
            <Link
              href="/legal/referral-terms"
              className="underline underline-offset-4"
            >
              condiciones del programa de recomendaciones
            </Link>
            .
          </p>
        ),
        keywords: ['recomendar', 'referido', 'invitar', 'amigo', 'recompensa', 'saldo', 'descuento'],
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
            <p>
              El panel se abre desde el lanzador de SaleLinx, en la esquina
              inferior derecha de cada página de Depop y Vinted: haz clic en
              él o pulsa Alt+S (el atajo predeterminado) en una pestaña de
              Depop o Vinted. El icono de SaleLinx en la barra de Chrome solo
              abre una ventana pequeña para iniciar sesión. Si no ves el
              lanzador:
            </p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>
                Refresca la pestaña de Depop o Vinted. Las pestañas que ya
                estaban abiertas cuando instalaste o actualizaste SaleLinx
                necesitan refrescarse.
              </li>
              <li>
                Comprueba que SaleLinx está activada: abre chrome://extensions y
                mira su interruptor.
              </li>
              <li>
                ¿Sigue sin aparecer?{' '}
                <Link
                  href="/help/support"
                  className="underline underline-offset-4"
                >
                  Contacta con soporte
                </Link>
                .
              </li>
            </ol>
          </div>
        ),
        keywords: ['panel', 'falta', 'no se ve', 'lanzador', 'depop', 'vinted'],
      },
      {
        id: 'update-available',
        q: 'SaleLinx dice que hay una actualización o que voy versiones por detrás',
        a: (
          <p>
            Chrome actualiza SaleLinx por su cuenta. Cuando se ha descargado
            una versión nueva, el panel muestra un aviso: haz clic en{' '}
            <strong>Recargar para actualizar</strong> y la página se refresca
            con la nueva versión. Si el panel dice que vas una o varias
            versiones por detrás, Chrome aún no ha descargado la
            actualización. Haz clic en{' '}
            <strong>Abrir la página de extensiones</strong> (o ve a
            chrome://extensions), activa el{' '}
            <strong>Modo de desarrollador</strong> arriba a la derecha, haz
            clic en <strong>Actualizar</strong> y luego refresca tus pestañas
            de Depop y Vinted.
          </p>
        ),
        keywords: ['actualización', 'versión', 'por detrás', 'desactualizado', 'recargar'],
      },
      {
        id: 'in-use-another-device',
        q: 'SaleLinx dice que está en uso en otro dispositivo',
        a: (
          <p>
            Puedes tener la sesión iniciada en varios dispositivos, pero solo
            uno puede usar SaleLinx a la vez. Si el panel muestra{' '}
            <strong>En uso en otro dispositivo</strong>, haz clic en{' '}
            <strong>Usar aquí</strong> para seguir en este; el otro dispositivo
            cierra la sesión de SaleLinx. Si acabas de cerrar tus pestañas de
            Depop y Vinted en el otro dispositivo, también se libera solo en
            unos 10 minutos. Si no reconoces el otro dispositivo, toma el
            control y después cambia tu contraseña desde tu{' '}
            <Link href="/account" className="underline underline-offset-4">
              página de cuenta
            </Link>
            .
          </p>
        ),
        keywords: ['dispositivo', 'otro dispositivo', 'ordenador', 'usar aquí', 'compartida'],
      },
      {
        id: 'salelinx-temporarily-down',
        q: 'SaleLinx dice que no está disponible temporalmente',
        a: (
          <p>
            El panel no puede conectar con nuestros servidores en este momento.
            Depop y Vinted no se ven afectados, así que puedes seguir usando
            ambos sitios con normalidad y tus anuncios allí siguen intactos. El
            mensaje desaparece solo en cuanto SaleLinx vuelve a estar
            disponible, así que no hace falta reinstalar, cerrar sesión ni
            restablecer la contraseña, aunque la pantalla de inicio de sesión
            muestre el mismo mensaje. Desde la versión 1.1.12 cubre todo el
            panel y tiene un botón <strong>Cerrar SaleLinx</strong>; las
            versiones anteriores lo muestran como un aviso en la parte superior
            del panel.
          </p>
        ),
        keywords: ['caído', 'no disponible', 'interrupción', 'no funciona', 'sin conexión'],
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
            usa el botón <strong>Continuar con Google</strong> en la página de
            inicio de sesión. Tu cuenta del sitio y de la extensión son la
            misma, así que cualquiera de las dos formas de entrar vale para
            ambas.
          </p>
        ),
        keywords: ['contraseña', 'acceso', 'restablecer', 'bloqueado', 'google'],
      },
      {
        id: 'open-a-marketplace-tab',
        q: 'SaleLinx me pide que abra una pestaña de Depop o Vinted',
        a: (
          <p>
            SaleLinx funciona a través de tus propias sesiones iniciadas en
            Depop y Vinted, así que cada función necesita una pestaña de su
            marketplace abierta en algún lugar de Chrome. Vale cualquier
            ventana y no tiene que ser la pestaña que estás mirando. Haz clic
            en <strong>Abrir Depop</strong> o <strong>Abrir Vinted</strong> en
            el mensaje, o abre el sitio tú mismo; el crosslisting necesita las
            dos. Si hay una pestaña abierta pero SaleLinx te pide recargarla
            (por ejemplo, después de que Chrome la suspendiera para ahorrar
            memoria), haz clic en <strong>Recargar pestaña de Depop</strong> o{' '}
            <strong>Recargar pestaña de Vinted</strong>. Desde la versión
            1.1.12, <strong>Mis anuncios</strong> también ofrece abrir la
            pestaña que falta al refrescar; las versiones anteriores pedían
            recargar una pestaña aunque no hubiera ninguna abierta.
          </p>
        ),
        keywords: ['pestaña', 'abrir', 'recargar', 'depop', 'vinted'],
      },
      {
        id: 'wrong-marketplace-account',
        q: 'SaleLinx dice que tengo iniciada sesión en Depop o Vinted con otra cuenta',
        a: (
          <p>
            SaleLinx solo funciona con las cuentas de Depop y Vinted vinculadas
            a él, y pausa las funciones de esa marketplace mientras el sitio
            tenga iniciada sesión con otra cuenta. Para solucionarlo, cierra
            sesión en Depop o Vinted, vuelve a entrar con la cuenta vinculada y
            recarga la pestaña. Si prefieres que SaleLinx use la otra cuenta,
            abre <strong>Ajustes</strong> en el panel, haz clic en{' '}
            <strong>Desvincular</strong> en{' '}
            <strong>Cuentas de plataformas</strong> y luego en{' '}
            <strong>Vincular</strong> para la cuenta con la que has iniciado
            sesión. Más detalles en{' '}
            <Link
              href="/docs/getting-started/connect-your-first-marketplace"
              className="underline underline-offset-4"
            >
              Conecta tu primera marketplace
            </Link>
            .
          </p>
        ),
        keywords: ['otra cuenta', 'cuenta equivocada', 'cuenta distinta', 'vincular', 'desvincular'],
      },
      {
        id: 'account-already-linked',
        q: 'SaleLinx dice que mi cuenta de Depop o Vinted ya está vinculada o ya usó una prueba gratuita',
        a: (
          <p>
            Cada cuenta de Depop o Vinted solo puede estar vinculada a una
            cuenta de SaleLinx a la vez. Si está vinculada a otra cuenta tuya
            de SaleLinx, entra en esa, haz clic en{' '}
            <strong>Desvincular</strong> en <strong>Ajustes</strong>, luego
            vuelve a entrar en esta cuenta y vincúlala. Además, cada tienda
            tiene una sola prueba gratuita: si ya la usó en otra cuenta de
            SaleLinx, podrás vincularla aquí cuando contrates un plan de pago
            desde la{' '}
            <Link href="/pricing" className="underline underline-offset-4">
              página de precios
            </Link>
            . Si no puedes entrar en la otra cuenta,{' '}
            <Link href="/help/support" className="underline underline-offset-4">
              contacta con soporte
            </Link>
            .
          </p>
        ),
        keywords: ['ya vinculada', 'vincular', 'prueba', 'otra cuenta', 'no se pudo vincular'],
      },
      {
        id: 'listings-not-syncing',
        q: 'Mis anuncios no aparecen o no están actualizados',
        a: (
          <p>
            SaleLinx lee tus anuncios de Depop y Vinted mientras haya una
            pestaña de esa marketplace abierta y con sesión iniciada en tu
            cuenta vinculada. En <strong>Mis anuncios</strong>, el estado junto
            a Depop y Vinted, arriba, indica cuándo se sincronizó cada una por
            última vez: haz clic en <strong>Refrescar todo</strong>, o en el
            botón de refrescar de una marketplace, para sincronizar ahora. Si
            te pide abrir o recargar una pestaña, o dice que tu sesión ha
            caducado, hazlo en el sitio de la marketplace y vuelve a refrescar.
            Más detalles en la{' '}
            <Link
              href="/docs/inventory/listings"
              className="underline underline-offset-4"
            >
              guía de Mis anuncios
            </Link>
            .
          </p>
        ),
        keywords: ['sincronizar', 'falta', 'mis anuncios', 'refrescar', 'desactualizado'],
      },
      {
        id: 'crosslisting-stuck',
        q: 'El crosslisting está atascado o no empieza',
        a: (
          <div className="space-y-2">
            <p>Revisa esto en orden:</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>
                Tus cuentas de Depop y Vinted están vinculadas, y hay una
                pestaña de Depop y otra de Vinted abiertas con sesión iniciada
                en esas cuentas. El panel te dice cuál falta.
              </li>
              <li>
                Mira la <Link href="/docs/getting-started/queue" className="underline underline-offset-4">cola</Link> en la parte inferior de la barra lateral del
                panel. SaleLinx ejecuta una tarea cada vez, así que un
                crosslisting aparece <strong>En cola</strong> hasta que termina
                la tarea anterior. Si aparece <strong>En pausa</strong>, haz
                clic en <strong>Reanudar</strong>.
              </li>
              <li>
                <strong>Limitado</strong> significa que Depop o Vinted está
                limitando las solicitudes. SaleLinx espera y sigue solo cuando
                termina la cuenta atrás.
              </li>
              <li>
                Si has agotado tu cupo mensual de crosslistings, SaleLinx te
                avisa de que has alcanzado el límite. Se renueva al principio
                de cada mes (UTC); consulta{' '}
                <Link href="/pricing" className="underline underline-offset-4">
                  los precios
                </Link>{' '}
                para planes más amplios.
              </li>
            </ol>
            <p>
              Si una marketplace falla una y otra vez, mira la{' '}
              <Link
                href="/docs/status"
                className="underline underline-offset-4"
              >
                página de estado de plataformas
              </Link>
              .
            </p>
          </div>
        ),
        keywords: ['atascado', 'colgado', 'lento', 'en cola', 'crosslist'],
      },
      {
        id: 'listing-failed-to-post',
        q: 'Ha fallado el crosslisting de un anuncio',
        a: (
          <p>
            La cola en la parte inferior de la barra lateral del panel muestra
            cuántos anuncios han fallado. La mayoría de fallos vienen de no
            tener la sesión iniciada en la marketplace a la que copias, o de
            datos que esa marketplace no aceptó. Inicia sesión allí con tu
            cuenta vinculada, selecciona el anuncio en{' '}
            <strong>Mis anuncios</strong> y vuelve a hacer clic en{' '}
            <strong>Publicar cruzado</strong>. Desde la versión 1.1.12, los
            anuncios que fallan no cuentan para tu cupo mensual de
            crosslistings. Si una marketplace entera tiene problemas, mira la{' '}
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
        id: 'presets-not-syncing',
        q: 'Mis ajustes guardados no aparecen en mi otro ordenador',
        a: (
          <p>
            Los ajustes guardados se sincronizan a través de tu cuenta de SaleLinx con cualquier plan o prueba activos. Comprueba primero que los dos dispositivos han iniciado sesión con la misma cuenta y que tu plan está activo. Cuál está seleccionado es cosa de cada dispositivo, así que vuelve a elegirlo en el segundo equipo. Cerrar sesión borra los ajustes guardados de ese navegador; vuelven al iniciar sesión de nuevo. Más detalles en{' '}
            <Link
              href="/docs/getting-started/account-and-subscription"
              className="underline underline-offset-4"
            >
              Cuenta y suscripción
            </Link>
            .
          </p>
        ),
        keywords: ['ajuste guardado', 'ajustes guardados', 'preset', 'sincronizar', 'dispositivo'],
      },
      {
        id: 'contact-support',
        q: '¿Cómo contacto con soporte?',
        a: (
          <p>
            Abre la pestaña <strong>Soporte</strong> del panel de SaleLinx,
            elige un <strong>Tipo</strong>, describe el problema y haz clic en{' '}
            <strong>Enviar</strong>. Los tickets enviados desde el panel
            incluyen la versión de tu extensión y tu plan, lo que nos ayuda a
            encontrar la causa. También puedes escribirnos desde la{' '}
            <Link href="/help/support" className="underline underline-offset-4">
              página de contacto
            </Link>{' '}
            o por correo a{' '}
            <a
              href="mailto:support@salelinx.com"
              className="underline underline-offset-4"
            >
              support@salelinx.com
            </a>
            . Te avisamos por correo cuando respondemos, y puedes seguir la
            conversación y contestar en <strong>Mis tickets</strong>, en la
            pestaña Soporte, o en <strong>Tus tickets</strong>, en tu{' '}
            <Link href="/account" className="underline underline-offset-4">
              página de cuenta
            </Link>
            .
          </p>
        ),
        keywords: ['soporte', 'contacto', 'ayuda', 'ticket', 'correo', 'error'],
      },
    ],
  },
  {
    slug: 'ebay',
    title: 'eBay',
    blurb: 'Conectar eBay, publicar en eBay y cuánto cuesta.',
    items: [
      {
        id: 'ebay-connect',
        q: '¿Cómo conecto mi cuenta de eBay?',
        a: <p>Abre el panel de SaleLinx, ve a <em>Ajustes</em> y pulsa <em>Vincular</em> en la fila de eBay. Inicia sesión en la página de eBay y acepta que SaleLinx gestione tus anuncios. SaleLinx nunca ve tu contraseña de eBay y puedes desvincularla cuando quieras.</p>,
        keywords: ['ebay', 'conectar', 'vincular', 'cuenta'],
      },
      {
        id: 'ebay-fees',
        q: '¿Publicar en eBay con crosslisting tiene coste?',
        a: <p>eBay cobra sus comisiones habituales por anuncio, igual que si lo publicaras a mano. SaleLinx te muestra la comisión de eBay de cada artículo antes de publicar nada, para que puedas volver atrás o quitar artículos. Los anuncios de eBay se publican al momento, porque eBay no tiene borradores.</p>,
        keywords: ['ebay', 'comisiones', 'coste', 'crosslist'],
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
            No. SaleLinx funciona a través de las sesiones de Depop y Vinted
            que ya tienes iniciadas en tu propio navegador, así que nunca nos
            das una contraseña de marketplace. Para vincular una tienda a tu
            cuenta de SaleLinx, solo guardamos su nombre de usuario y su ID de
            cuenta. eBay se conecta desde la página de inicio de sesión de eBay, y SaleLinx nunca ve tu contraseña de eBay. Para eBay también guardamos el token de acceso que nos da eBay, para que SaleLinx pueda gestionar tus anuncios.
          </p>
        ),
        keywords: ['contraseña', 'credenciales', 'seguridad'],
      },
      {
        id: 'where-is-my-data',
        q: '¿Dónde se almacenan mis datos?',
        a: (
          <p>
            Tu cuenta de SaleLinx, tu plan, tus ajustes y los nombres de
            usuario de tus tiendas vinculadas se guardan en nuestro proveedor
            de base de datos, Supabase, y los pagos los gestiona Stripe. Los
            datos y fotos de los anuncios solo se guardan con nosotros en los
            anuncios que guardas en la nube; el resto de lo que SaleLinx lee de
            Depop y Vinted no se guarda en nuestros servidores. Los datos viajan
            por HTTPS, Supabase los cifra en reposo y las reglas de acceso
            vinculan cada anuncio y cada foto a tu cuenta. Dónde tratan los
            datos nuestros proveedores se explica en nuestra{' '}
            <Link href="/legal/privacy" className="underline underline-offset-4">
              política de privacidad
            </Link>
            .
          </p>
        ),
        keywords: ['datos', 'almacenamiento', 'supabase', 'nube', 'región', 'cifrado'],
      },
      {
        id: 'delete-my-data',
        q: '¿Cómo elimino mis datos?',
        a: (
          <p>
            Abre tu{' '}
            <Link href="/account" className="underline underline-offset-4">
              página de cuenta
            </Link>
            , baja hasta el final y haz clic en{' '}
            <strong>Eliminar cuenta</strong>. Introduce tu contraseña (no hace
            falta si entras con Google) y te enviamos un enlace de confirmación
            por correo: ábrelo en los 60 minutos siguientes con la sesión
            iniciada y confirma una vez más. Tu cuenta, anuncios, imágenes,
            cuentas de marketplace vinculadas, historial de uso y tickets de
            soporte se eliminan en ese momento, y cualquier suscripción se
            cancela sin reembolso por el tiempo restante. También puedes
            escribir a{' '}
            <a
              href="mailto:support@salelinx.com"
              className="underline underline-offset-4"
            >
              support@salelinx.com
            </a>{' '}
            desde la dirección de tu cuenta y completaremos la eliminación en
            un plazo de 30 días.
          </p>
        ),
        keywords: ['eliminar', 'rgpd', 'borrar', 'cuenta'],
      },
    ],
  },
];
