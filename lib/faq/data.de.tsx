import { Link } from '@/i18n/navigation';
import { CHROME_WEB_STORE_URL } from '@/lib/site';
import { InstallExtensionButton } from '@/components/InstallExtensionButton';
import type { FAQGroup } from './types';

export const FAQ_GROUPS_DE: FAQGroup[] = [
  {
    slug: 'getting-started',
    title: 'Erste Schritte',
    blurb: 'SaleLinx installieren, anmelden und unterstützte Browser.',
    items: [
      {
        id: 'how-do-i-install',
        q: 'Wie installiere ich die SaleLinx-Erweiterung?',
        a: (
          <>
            <p>
              Installiere aus dem{' '}
              <a
                href={CHROME_WEB_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4"
              >
                Chrome Web Store
              </a>{' '}
              und hefte die Erweiterung an deine Symbolleiste. Vollständige Anleitung mit Screenshots in{' '}
              <Link
                href="/docs/getting-started/install-the-extension"
                className="underline underline-offset-4"
              >
                SaleLinx-Erweiterung installieren
              </Link>
              .
            </p>
            <InstallExtensionButton
              label="Zu Chrome hinzufügen"
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
            />
          </>
        ),
        keywords: ['installieren', 'einrichten', 'chrome', 'hinzufügen'],
      },
      {
        id: 'which-browsers',
        q: 'Welche Browser unterstützt SaleLinx?',
        a: (
          <p>
            Jeden Chromium-basierten Browser: Google Chrome, Microsoft Edge, Brave, Arc, Opera. Safari und Firefox werden nicht unterstützt.
          </p>
        ),
        keywords: ['browser', 'chrome', 'edge', 'safari', 'firefox', 'brave'],
      },
      {
        id: 'free-trial',
        q: 'Muss ich bezahlen, um es auszuprobieren?',
        a: (
          <p>
            Nein. Du bekommst eine kostenlose 14-Tage-Testphase des
            Starter-Pakets, mit denselben Funktionen wie Starter, aber
            niedrigeren Kontingenten (siehe{' '}
            <Link href="/pricing" className="underline underline-offset-4">
              Preise
            </Link>
            ). Zum Start ist eine Karte erforderlich, während der Testphase
            wird aber nichts abgebucht, und du kannst jederzeit über deine
            Kontoseite kündigen. Es gibt eine Testphase pro SaleLinx-Konto und
            pro Depop- oder Vinted-Shop. Ohne Kündigung startet dein
            Starter-Abo automatisch am Ende der Testphase.
          </p>
        ),
        keywords: ['kostenlos', 'test', 'preise', 'paket', 'karte'],
      },
    ],
  },
  {
    slug: 'billing',
    title: 'Konto und Abrechnung',
    blurb: 'Pakete, Rechnungen, Kündigungen und Prämien für Empfehlungen.',
    items: [
      {
        id: 'how-to-upgrade',
        q: 'Wie upgrade ich mein Paket?',
        a: (
          <p>
            Mit einem bezahlten Paket öffnest du deine{' '}
            <Link href="/account" className="underline underline-offset-4">
              Kontoseite
            </Link>
            , klickst auf <strong>Abonnement verwalten</strong> und wählst im
            Stripe-Abrechnungsportal das neue Paket. Während der kostenlosen
            Testphase wählst du stattdessen ein Paket auf der{' '}
            <Link href="/pricing" className="underline underline-offset-4">
              Preisseite
            </Link>{' '}
            oder klickst auf deiner Kontoseite auf{' '}
            <strong>Starter jetzt starten</strong>. Damit endet die Testphase,
            deine Karte wird sofort belastet und die neuen Kontingente gelten
            sofort.
          </p>
        ),
        keywords: ['upgrade', 'paket', 'wechseln', 'stufe'],
      },
      {
        id: 'how-to-cancel',
        q: 'Wie kündige ich mein Abonnement?',
        a: (
          <p>
            Öffne deine{' '}
            <Link href="/account" className="underline underline-offset-4">
              Kontoseite
            </Link>{' '}
            und klicke auf <strong>Abonnement verwalten</strong>. Das
            Stripe-Abrechnungsportal öffnet sich, dort kannst du kündigen. Du
            behältst den Zugriff bis zum Ende des bezahlten Zeitraums und
            kannst die Kündigung bis dahin an derselben Stelle zurücknehmen.
            Kündigst du während der kostenlosen Testphase, wird dir nichts
            berechnet.
          </p>
        ),
        keywords: ['kündigen', 'abbestellen', 'abrechnung stoppen'],
      },
      {
        id: 'change-plan-midmonth',
        q: 'Kann ich das Paket mitten im Abrechnungszeitraum wechseln?',
        a: (
          <p>
            Ja. Während der kostenlosen Testphase beendet die Wahl eines Pakets
            auf der{' '}
            <Link href="/pricing" className="underline underline-offset-4">
              Preisseite
            </Link>{' '}
            die Testphase vorzeitig: Deine Karte wird sofort für dieses Paket
            belastet und seine Kontingente gelten sofort. Mit einem bezahlten
            Paket läuft jeder Wechsel über das Stripe-Abrechnungsportal: Klicke
            auf deiner{' '}
            <Link href="/account" className="underline underline-offset-4">
              Kontoseite
            </Link>{' '}
            auf <strong>Abonnement verwalten</strong> und wähle das Paket. Ein
            Wechsel zu einem kleineren Paket geht immer über{' '}
            <strong>Abonnement verwalten</strong>.
          </p>
        ),
        keywords: ['anteilig', 'wechseln', 'downgrade', 'testphase'],
      },
      {
        id: 'where-are-invoices',
        q: 'Wo finde ich meine Rechnungen?',
        a: (
          <p>
            Öffne deine{' '}
            <Link href="/account" className="underline underline-offset-4">
              Kontoseite
            </Link>{' '}
            und klicke auf <strong>Abonnement verwalten</strong>. Das
            Stripe-Abrechnungsportal öffnet sich mit deinem Rechnungsverlauf,
            dort kannst du jede Rechnung herunterladen.
          </p>
        ),
        keywords: ['rechnung', 'beleg', 'steuer', 'mwst'],
      },
      {
        id: 'charged-twice',
        q: 'Mir wurde doppelt belastet, was tun?',
        a: (
          <p>
            Fast immer ist es eine fehlgeschlagene und wiederholte Buchung,
            kein echtes Duplikat. Prüfe zuerst deine Rechnungen:{' '}
            <strong>Abonnement verwalten</strong> auf deiner Kontoseite öffnet
            sie im Stripe-Abrechnungsportal. Wenn du zwei erfolgreiche
            Buchungen siehst, schreibe an{' '}
            <a
              href="mailto:support@salelinx.com"
              className="underline underline-offset-4"
            >
              support@salelinx.com
            </a>{' '}
            mit den Rechnungsnummern, und wir erstatten das Duplikat.
          </p>
        ),
        keywords: ['duplikat', 'erstattung', 'überzahlt', 'buchung'],
      },
      {
        id: 'refer-and-earn',
        q: 'Wie funktioniert Werben & Verdienen?',
        a: (
          <p>
            Kopiere deinen Link im Tab <strong>Werben &amp; Verdienen</strong>{' '}
            des SaleLinx-Panels oder unter <strong>Freunde werben</strong> auf
            deiner{' '}
            <Link href="/account" className="underline underline-offset-4">
              Kontoseite
            </Link>
            . Freunde, die sich darüber registrieren, bekommen einen Rabatt auf
            ihren ersten Monat. Sobald ein Freund bezahlt hat, bekommst du
            Gratiszeit für dein eigenes Paket: 1 Woche, wenn er Starter wählt,
            2 Wochen bei Pro und 1 Monat bei Business. Sie wird etwa eine Woche
            nach seiner ersten Zahlung als Guthaben auf deine nächste
            SaleLinx-Rechnung gebucht, sofern du selbst ein Paket hast. Alle
            Regeln stehen in den{' '}
            <Link
              href="/legal/referral-terms"
              className="underline underline-offset-4"
            >
              Bedingungen des Empfehlungsprogramms
            </Link>
            .
          </p>
        ),
        keywords: ['empfehlen', 'werben', 'einladen', 'freund', 'prämie', 'guthaben', 'rabatt'],
      },
    ],
  },
  {
    slug: 'troubleshooting',
    title: 'Fehlerbehebung',
    blurb: 'Lösungen für die häufigsten Probleme.',
    items: [
      {
        id: 'panel-not-appearing',
        q: 'Das SaleLinx-Panel erscheint nicht auf Depop oder Vinted',
        a: (
          <div className="space-y-2">
            <p>
              Das Panel öffnet sich über die SaleLinx-Schaltfläche unten rechts
              auf jeder Depop- und Vinted-Seite: Klicke darauf oder drücke in
              einem Depop- oder Vinted-Tab Alt+S (das Standard-Kürzel). Das
              SaleLinx-Symbol in der Chrome-Symbolleiste öffnet nur ein
              kleines Fenster zum Anmelden. Wenn du die Schaltfläche nicht
              siehst:
            </p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>
                Lade den Depop- oder Vinted-Tab neu. Tabs, die schon offen
                waren, als du SaleLinx installiert oder aktualisiert hast,
                müssen neu geladen werden.
              </li>
              <li>
                Prüfe, ob SaleLinx eingeschaltet ist: Öffne chrome://extensions
                und sieh dir den Schalter der Erweiterung an.
              </li>
              <li>
                Immer noch nichts?{' '}
                <Link
                  href="/help/support"
                  className="underline underline-offset-4"
                >
                  Kontaktiere den Support
                </Link>
                .
              </li>
            </ol>
          </div>
        ),
        keywords: ['panel', 'fehlt', 'nicht sichtbar', 'schaltfläche', 'depop', 'vinted'],
      },
      {
        id: 'update-available',
        q: 'SaleLinx meldet ein Update oder dass ich Versionen im Rückstand bin',
        a: (
          <p>
            Chrome aktualisiert SaleLinx von selbst. Sobald eine neue Version
            heruntergeladen ist, zeigt das Panel ein Banner dazu: Klicke auf{' '}
            <strong>Neu laden, um zu aktualisieren</strong>, dann lädt die
            Seite mit der neuen Version neu. Meldet das Panel, dass du eine
            oder mehrere Versionen im Rückstand bist, hat Chrome das Update
            noch nicht geholt. Klicke auf{' '}
            <strong>Erweiterungsseite öffnen</strong> (oder rufe
            chrome://extensions auf), schalte oben rechts den{' '}
            <strong>Entwicklermodus</strong> ein, klicke auf{' '}
            <strong>Aktualisieren</strong> und lade danach deine Depop- und
            Vinted-Tabs neu.
          </p>
        ),
        keywords: ['update', 'version', 'rückstand', 'veraltet', 'neu laden'],
      },
      {
        id: 'in-use-another-device',
        q: 'SaleLinx meldet, dass es auf einem anderen Gerät benutzt wird',
        a: (
          <p>
            Du kannst auf mehreren Geräten angemeldet sein, aber nur eines kann
            SaleLinx gleichzeitig nutzen. Zeigt das Panel{' '}
            <strong>Auf einem anderen Gerät in Benutzung</strong>, klicke auf{' '}
            <strong>Hier verwenden</strong>, um hier weiterzumachen; das andere
            Gerät wird bei SaleLinx abgemeldet. Hast du deine Depop- und
            Vinted-Tabs auf dem anderen Gerät gerade geschlossen, wird der
            Platz auch von selbst nach etwa 10 Minuten frei. Erkennst du das
            andere Gerät nicht, übernimm die Sitzung und ändere dann dein
            Passwort über deine{' '}
            <Link href="/account" className="underline underline-offset-4">
              Kontoseite
            </Link>
            .
          </p>
        ),
        keywords: ['gerät', 'anderes gerät', 'computer', 'hier verwenden', 'geteilt'],
      },
      {
        id: 'salelinx-temporarily-down',
        q: 'SaleLinx meldet, dass es vorübergehend nicht verfügbar ist',
        a: (
          <p>
            Das Panel erreicht unsere Server gerade nicht. Depop und Vinted
            sind nicht betroffen, du kannst beide Seiten also normal nutzen,
            und deine Inserate dort bleiben unverändert. Die Meldung
            verschwindet von selbst, sobald SaleLinx wieder erreichbar ist. Du
            musst also nichts neu installieren, dich nicht abmelden und dein
            Passwort nicht zurücksetzen, auch wenn der Anmeldebildschirm
            dieselbe Meldung zeigt. Ab Version 1.1.12 deckt sie das ganze Panel
            ab und hat einen Button <strong>SaleLinx schließen</strong>;
            frühere Versionen zeigen sie als Banner oben im Panel.
          </p>
        ),
        keywords: ['ausfall', 'nicht verfügbar', 'störung', 'funktioniert nicht', 'offline'],
      },
      {
        id: 'cant-sign-in',
        q: 'Ich bin abgemeldet und kann mich nicht wieder anmelden',
        a: (
          <p>
            Setze dein Passwort zurück unter{' '}
            <Link
              href="/auth/forgot-password"
              className="underline underline-offset-4"
            >
              salelinx.com/auth/forgot-password
            </Link>
            . Wenn du dich mit Google registriert hast, gibt es kein Passwort
            zum Zurücksetzen: Nutze stattdessen den Button{' '}
            <strong>Mit Google fortfahren</strong> auf der Anmeldeseite. Dein
            Website- und Erweiterungskonto sind gleich, also funktioniert
            beides für beide.
          </p>
        ),
        keywords: ['passwort', 'anmelden', 'zurücksetzen', 'gesperrt', 'google'],
      },
      {
        id: 'open-a-marketplace-tab',
        q: 'SaleLinx bittet mich, einen Depop- oder Vinted-Tab zu öffnen',
        a: (
          <p>
            SaleLinx arbeitet über deine eigenen angemeldeten Depop- und
            Vinted-Sitzungen. Eine Funktion braucht daher irgendwo in Chrome
            einen offenen Tab ihres Marktplatzes. Jedes Fenster geht, und es
            muss nicht der Tab sein, den du gerade ansiehst. Klicke in der
            Meldung auf <strong>Depop öffnen</strong> oder{' '}
            <strong>Vinted öffnen</strong> oder öffne die Seite selbst; das
            Crosslisting braucht beide. Ist ein Tab offen, aber SaleLinx bittet
            dich, ihn neu zu laden (etwa nachdem Chrome ihn zum Speichersparen
            schlafen gelegt hat), klicke auf{' '}
            <strong>Depop-Tab neu laden</strong> oder{' '}
            <strong>Vinted-Tab neu laden</strong>. Ab Version 1.1.12 bietet{' '}
            <strong>Meine Anzeigen</strong> beim Aktualisieren auch an, einen
            fehlenden Tab zu öffnen; frühere Versionen verlangten das Neuladen
            eines Tabs, selbst wenn keiner offen war.
          </p>
        ),
        keywords: ['tab', 'öffnen', 'neu laden', 'depop', 'vinted'],
      },
      {
        id: 'wrong-marketplace-account',
        q: 'SaleLinx meldet, dass ich bei Depop oder Vinted mit einem anderen Konto angemeldet bin',
        a: (
          <p>
            SaleLinx arbeitet nur mit den Depop- und Vinted-Konten, die damit
            verknüpft sind, und pausiert die Funktionen dieses Marktplatzes,
            solange die Seite mit einem anderen Konto angemeldet ist. Melde
            dich zur Lösung bei Depop oder Vinted ab, mit dem verknüpften Konto
            wieder an und lade den Tab neu. Soll SaleLinx stattdessen das
            andere Konto nutzen, öffne im Panel{' '}
            <strong>Einstellungen</strong>, klicke unter{' '}
            <strong>Marktplatz-Konten</strong> auf <strong>Trennen</strong> und
            dann bei dem Konto, mit dem du angemeldet bist, auf{' '}
            <strong>Verknüpfen</strong>. Mehr dazu in{' '}
            <Link
              href="/docs/getting-started/connect-your-first-marketplace"
              className="underline underline-offset-4"
            >
              Deinen ersten Marktplatz verbinden
            </Link>
            .
          </p>
        ),
        keywords: ['anderes konto', 'falsches konto', 'konto wechseln', 'neu verknüpfen', 'trennen'],
      },
      {
        id: 'account-already-linked',
        q: 'SaleLinx meldet, dass mein Depop- oder Vinted-Konto schon verknüpft ist oder eine Testphase genutzt hat',
        a: (
          <p>
            Jedes Depop- oder Vinted-Konto kann immer nur mit einem
            SaleLinx-Konto verknüpft sein. Ist es mit einem anderen
            SaleLinx-Konto von dir verknüpft, melde dich dort an, klicke in den{' '}
            <strong>Einstellungen</strong> auf <strong>Trennen</strong>, melde
            dich dann wieder bei diesem Konto an und verknüpfe es hier. Jeder
            Shop bekommt außerdem nur eine kostenlose Testphase: Hatte er schon
            eine auf einem anderen SaleLinx-Konto, kannst du ihn hier
            verknüpfen, sobald du auf der{' '}
            <Link href="/pricing" className="underline underline-offset-4">
              Preisseite
            </Link>{' '}
            ein bezahltes Paket gestartet hast. Kommst du nicht mehr in das
            andere Konto,{' '}
            <Link href="/help/support" className="underline underline-offset-4">
              kontaktiere den Support
            </Link>
            .
          </p>
        ),
        keywords: ['schon verknüpft', 'verknüpfen', 'testphase', 'anderes konto', 'verknüpfung fehlgeschlagen'],
      },
      {
        id: 'listings-not-syncing',
        q: 'Meine Inserate erscheinen nicht oder sind veraltet',
        a: (
          <p>
            SaleLinx liest deine Inserate von Depop und Vinted, solange ein Tab
            dieses Marktplatzes offen und mit deinem verknüpften Konto
            angemeldet ist. In <strong>Meine Anzeigen</strong> zeigt der Status
            neben Depop und Vinted oben, wann jeder zuletzt synchronisiert
            wurde: Klicke auf <strong>Alle aktualisieren</strong> oder auf den
            Aktualisieren-Button neben einem Marktplatz, um sofort zu
            synchronisieren. Bittet er dich, einen Tab zu öffnen oder neu zu
            laden, oder meldet eine abgelaufene Sitzung, erledige das auf der
            Marktplatz-Seite und aktualisiere erneut. Mehr dazu in der{' '}
            <Link
              href="/docs/inventory/listings"
              className="underline underline-offset-4"
            >
              Anleitung zu Meine Anzeigen
            </Link>
            .
          </p>
        ),
        keywords: ['sync', 'fehlt', 'meine anzeigen', 'aktualisieren', 'veraltet'],
      },
      {
        id: 'crosslisting-stuck',
        q: 'Das Crosslisting hängt oder startet nicht',
        a: (
          <div className="space-y-2">
            <p>Prüfe der Reihe nach:</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>
                Deine Depop- und Vinted-Konten sind beide verknüpft, und ein
                Depop-Tab und ein Vinted-Tab sind offen und mit diesen Konten
                angemeldet. Das Panel sagt dir, was fehlt.
              </li>
              <li>
                Sieh dir die <Link href="/docs/getting-started/queue" className="underline underline-offset-4">Warteschlange</Link> unten in der Seitenleiste des Panels
                an. SaleLinx führt einen Auftrag nach dem anderen aus, ein
                Crosslisting steht also auf <strong>In Warteschlange</strong>,
                bis der vorherige Auftrag fertig ist. Steht es auf{' '}
                <strong>Pausiert</strong>, klicke auf{' '}
                <strong>Fortsetzen</strong>.
              </li>
              <li>
                <strong>Begrenzt</strong> heißt, dass Depop oder Vinted Anfragen
                begrenzt. SaleLinx wartet und macht von selbst weiter, wenn der
                Countdown abgelaufen ist.
              </li>
              <li>
                Hast du dein monatliches Crosslisting-Kontingent aufgebraucht,
                meldet SaleLinx, dass das Limit erreicht ist. Es wird zu Beginn
                jedes Monats (UTC) zurückgesetzt; größere Pakete findest du
                unter{' '}
                <Link href="/pricing" className="underline underline-offset-4">
                  Preise
                </Link>
                .
              </li>
            </ol>
            <p>
              Scheitert ein Marktplatz immer wieder, sieh dir den{' '}
              <Link
                href="/docs/status"
                className="underline underline-offset-4"
              >
                Marktplatz-Status
              </Link>{' '}
              an.
            </p>
          </div>
        ),
        keywords: ['hängt', 'eingefroren', 'langsam', 'warteschlange', 'crosslist'],
      },
      {
        id: 'listing-failed-to-post',
        q: 'Das Crosslisting eines Inserats ist fehlgeschlagen',
        a: (
          <p>
            Die Warteschlange unten in der Seitenleiste des Panels zeigt, wie
            viele Inserate fehlgeschlagen sind. Die meisten Fehler entstehen,
            weil du auf dem Marktplatz, auf den du kopierst, abgemeldet bist,
            oder weil er Angaben nicht akzeptiert hat. Melde dich dort mit
            deinem verknüpften Konto an, wähle das Inserat in{' '}
            <strong>Meine Anzeigen</strong> aus und klicke erneut auf{' '}
            <strong>Crossposten</strong>. Ab Version 1.1.12 zählen
            fehlgeschlagene Inserate nicht mehr gegen dein monatliches
            Crosslisting-Kontingent. Wenn ein ganzer Marktplatz Probleme hat,
            sieh dir die{' '}
            <Link
              href="/docs/status"
              className="underline underline-offset-4"
            >
              Statusseite der Marktplätze
            </Link>{' '}
            an.
          </p>
        ),
        keywords: ['fehlgeschlagen', 'fehler', 'posten', 'crosslist', 'hochladen'],
      },
      {
        id: 'presets-not-syncing',
        q: 'Meine gespeicherten Voreinstellungen fehlen auf meinem anderen Computer',
        a: (
          <p>
            Gespeicherte Voreinstellungen werden über dein SaleLinx-Konto synchronisiert, mit jedem aktiven Tarif oder in der Testphase. Prüfe zuerst, dass beide Geräte mit demselben Konto angemeldet sind und dein Tarif aktiv ist. Welche Voreinstellung ausgewählt ist, gilt pro Gerät; wähle sie auf dem zweiten Rechner also erneut. Abmelden entfernt die Voreinstellungen aus diesem Browser; bei der nächsten Anmeldung sind sie wieder da. Details unter{' '}
            <Link
              href="/docs/getting-started/account-and-subscription"
              className="underline underline-offset-4"
            >
              Konto und Abonnement
            </Link>
            .
          </p>
        ),
        keywords: ['voreinstellung', 'voreinstellungen', 'preset', 'sync', 'gerät'],
      },
      {
        id: 'contact-support',
        q: 'Wie erreiche ich den Support?',
        a: (
          <p>
            Öffne im SaleLinx-Panel den Tab <strong>Support</strong>, wähle
            einen <strong>Typ</strong>, beschreibe das Problem und klicke auf{' '}
            <strong>Absenden</strong>. Tickets aus dem Panel enthalten deine
            Erweiterungsversion und dein Paket, das hilft uns bei der
            Ursachensuche. Du kannst uns auch über die{' '}
            <Link href="/help/support" className="underline underline-offset-4">
              Kontaktseite
            </Link>{' '}
            schreiben oder eine E-Mail an{' '}
            <a
              href="mailto:support@salelinx.com"
              className="underline underline-offset-4"
            >
              support@salelinx.com
            </a>{' '}
            senden. Wir benachrichtigen dich per E-Mail, wenn wir antworten,
            und du kannst das Gespräch unter <strong>Meine Tickets</strong> im
            Support-Tab oder unter <strong>Deine Tickets</strong> auf deiner{' '}
            <Link href="/account" className="underline underline-offset-4">
              Kontoseite
            </Link>{' '}
            verfolgen und beantworten.
          </p>
        ),
        keywords: ['support', 'kontakt', 'hilfe', 'ticket', 'e-mail', 'fehler'],
      },
    ],
  },
  {
    slug: 'ebay',
    title: 'eBay',
    blurb: 'eBay verbinden, dorthin crosslisten und was es kostet.',
    items: [
      {
        id: 'ebay-connect',
        q: 'Wie verbinde ich mein eBay-Konto?',
        a: <p>Öffne das SaleLinx-Panel, gehe zu <em>Einstellungen</em> und klicke in der eBay-Zeile auf <em>Verknüpfen</em>. Melde dich auf der Seite von eBay an und erlaube SaleLinx, deine Anzeigen zu verwalten. SaleLinx sieht dein eBay-Passwort nie, und du kannst die Verknüpfung jederzeit lösen.</p>,
        keywords: ['ebay', 'verbinden', 'verknüpfen', 'konto'],
      },
      {
        id: 'ebay-fees',
        q: 'Kostet Crosslisting zu eBay etwas?',
        a: <p>eBay berechnet seine normalen Angebotsgebühren, genau wie beim Einstellen per Hand. SaleLinx zeigt die eBay-Gebühr für jeden Artikel, bevor etwas veröffentlicht wird, damit du zurückgehen oder Artikel entfernen kannst. eBay-Anzeigen gehen sofort live, weil eBay keine Entwürfe kennt.</p>,
        keywords: ['ebay', 'gebühren', 'kosten', 'crosslist'],
      },
    ],
  },
  {
    slug: 'privacy',
    title: 'Datenschutz und Daten',
    blurb: 'Was wir speichern, wo es liegt und wie du es löschst.',
    items: [
      {
        id: 'store-marketplace-password',
        q: 'Speichert SaleLinx mein Marktplatz-Passwort?',
        a: (
          <p>
            Nein. SaleLinx arbeitet über die Depop- und Vinted-Sitzungen, mit
            denen du in deinem eigenen Browser bereits angemeldet bist. Du gibst
            uns also nie ein Marktplatz-Passwort. Um einen Shop mit deinem
            SaleLinx-Konto zu verknüpfen, speichern wir nur seinen
            Benutzernamen und seine Konto-ID. eBay verbindest du über die eigene Anmeldeseite von eBay, und SaleLinx sieht dein eBay-Passwort nie. Für eBay speichern wir zusätzlich das Zugriffstoken, das eBay uns gibt, damit SaleLinx deine Anzeigen verwalten kann.
          </p>
        ),
        keywords: ['passwort', 'zugangsdaten', 'sicherheit'],
      },
      {
        id: 'where-is-my-data',
        q: 'Wo werden meine Daten gespeichert?',
        a: (
          <p>
            Dein SaleLinx-Konto, dein Paket, deine Einstellungen und die
            Benutzernamen deiner verknüpften Shops liegen bei unserem
            Datenbankanbieter Supabase, Zahlungen wickelt Stripe ab.
            Inseratsdaten und Fotos speichern wir nur für Inserate, die du in
            der Cloud sicherst; alles andere, was SaleLinx von Depop und Vinted
            liest, wird nicht auf unseren Servern gespeichert. Die Daten werden
            per HTTPS übertragen, Supabase verschlüsselt sie im Ruhezustand,
            und Zugriffsregeln binden jedes Inserat und jedes Foto an dein
            Konto. Wo unsere Dienstleister Daten verarbeiten, steht in unserer{' '}
            <Link href="/legal/privacy" className="underline underline-offset-4">
              Datenschutzerklärung
            </Link>
            .
          </p>
        ),
        keywords: ['daten', 'speicherung', 'supabase', 'cloud', 'region', 'verschlüsselung'],
      },
      {
        id: 'delete-my-data',
        q: 'Wie lösche ich meine Daten?',
        a: (
          <p>
            Öffne deine{' '}
            <Link href="/account" className="underline underline-offset-4">
              Kontoseite
            </Link>
            , scrolle ganz nach unten und klicke auf{' '}
            <strong>Konto löschen</strong>. Gib dein Passwort ein (nicht nötig,
            wenn du dich mit Google anmeldest), dann schicken wir dir einen
            Bestätigungslink per E-Mail: Öffne ihn innerhalb von 60 Minuten,
            während du angemeldet bist, und bestätige noch einmal. Dein Konto,
            deine Inserate, Bilder, verknüpften Marktplatz-Konten, dein
            Nutzungsverlauf und deine Support-Tickets werden dann sofort
            gelöscht, und ein Abo wird ohne Erstattung der Restlaufzeit
            gekündigt. Du kannst auch von der Adresse deines Kontos an{' '}
            <a
              href="mailto:support@salelinx.com"
              className="underline underline-offset-4"
            >
              support@salelinx.com
            </a>{' '}
            schreiben. Wir schließen die Löschung dann innerhalb von 30 Tagen
            ab.
          </p>
        ),
        keywords: ['löschen', 'dsgvo', 'entfernen', 'konto'],
      },
    ],
  },
];
