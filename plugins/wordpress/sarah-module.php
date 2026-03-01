<?php
/**
 * Sarah AI Chatbot — WordPress Admin Module
 *
 * Setup wizard, 3 modes (chatbot / click2call / webrtc),
 * live server test, and full frontend enqueue logic.
 *
 * @package Redegal
 */

if ( ! defined( 'ABSPATH' ) ) exit;

/* ============================================================
   1. DEFAULTS & HELPERS
   ============================================================ */

function redegal_sarah_defaults() {
    return [
        'enabled'       => '1',
        'mode'          => 'chatbot',   // chatbot | click2call | webrtc
        'load_mode'     => 'eager',     // eager | lazy-scroll | lazy-click
        'primary_color' => '#0066CC',
        'position'      => 'bottom-right',
        'server_url'    => 'auto',
        'server_custom' => '',
        'bot_name'      => 'Sarah',
        'show_lead'     => '1',
        'exclude_pages' => '',
        'wizard_done'   => '0',
    ];
}

function redegal_sarah_get( $key ) {
    $defaults = redegal_sarah_defaults();
    return get_option( 'redegal_sarah_' . $key, $defaults[ $key ] ?? '' );
}

/* ============================================================
   2. ADMIN MENU
   ============================================================ */

add_action( 'admin_menu', function () {
    add_theme_page(
        'Sarah — Chatbot IA',
        'Sarah · Chatbot',
        'manage_options',
        'redegal-sarah',
        'redegal_sarah_admin_page'
    );
} );

/* ============================================================
   3. SAVE SETTINGS
   ============================================================ */

function redegal_sarah_save() {
    if ( ! isset( $_POST['redegal_sarah_save'] ) ) return false;
    if ( ! check_admin_referer( 'redegal_sarah_settings' ) ) return false;
    if ( ! current_user_can( 'manage_options' ) ) return false;

    $fields = array_keys( redegal_sarah_defaults() );
    foreach ( $fields as $f ) {
        $key = 'redegal_sarah_' . $f;
        $val = $_POST[ $key ] ?? '';
        if ( $f === 'exclude_pages' ) {
            $val = implode( ',', array_filter( array_map( 'intval', explode( ',', $val ) ) ) );
        } elseif ( $f === 'primary_color' ) {
            $val = sanitize_hex_color( $val ) ?: '#0066CC';
        } elseif ( in_array( $f, ['enabled','show_lead','wizard_done'] ) ) {
            $val = isset( $_POST[ $key ] ) ? '1' : '0';
        } else {
            $val = sanitize_text_field( $val );
        }
        update_option( $key, $val );
    }
    return true;
}

/* ============================================================
   4. AJAX — Server connectivity test
   ============================================================ */

add_action( 'wp_ajax_sarah_test_server', function() {
    check_ajax_referer( 'sarah_test_nonce', 'nonce' );
    $url = esc_url_raw( $_POST['url'] ?? '' );
    if ( ! $url ) wp_send_json_error( ['msg' => 'URL vacía'] );

    $response = wp_remote_get( trailingslashit( $url ) . 'health', [
        'timeout'   => 6,
        'sslverify' => false,
    ] );

    if ( is_wp_error( $response ) ) {
        wp_send_json_error( ['msg' => $response->get_error_message()] );
    }

    $body = json_decode( wp_remote_retrieve_body( $response ), true );
    $code = wp_remote_retrieve_response_code( $response );

    if ( $code === 200 && ( $body['server'] ?? '' ) === 'ok' ) {
        wp_send_json_success( [
            'msg'      => '✅ Servidor OK — PostgreSQL: ' . ( $body['postgres'] ?? '?' ) . ' · Redis: ' . ( $body['redis'] ?? '?' ),
            'postgres' => $body['postgres'] ?? 'unknown',
            'redis'    => $body['redis'] ?? 'unknown',
        ] );
    } else {
        wp_send_json_error( ['msg' => "HTTP $code — respuesta inesperada"] );
    }
} );

/* ============================================================
   5. ADMIN PAGE
   ============================================================ */

function redegal_sarah_admin_page() {
    if ( ! current_user_can( 'manage_options' ) ) return;

    $saved      = redegal_sarah_save();
    $enabled    = redegal_sarah_get( 'enabled' );
    $sarah_mode = redegal_sarah_get( 'mode' );
    $load_mode  = redegal_sarah_get( 'load_mode' );
    $color      = redegal_sarah_get( 'primary_color' );
    $position   = redegal_sarah_get( 'position' );
    $server_url = redegal_sarah_get( 'server_url' );
    $custom_url = redegal_sarah_get( 'server_custom' );
    $bot_name   = redegal_sarah_get( 'bot_name' );
    $show_lead  = redegal_sarah_get( 'show_lead' );
    $excludes   = redegal_sarah_get( 'exclude_pages' );
    $wizard_done= redegal_sarah_get( 'wizard_done' );

    $show_wizard = isset( $_GET['wizard'] ) || $wizard_done !== '1';
    $tab = isset( $_GET['tab'] ) ? sanitize_text_field( $_GET['tab'] ) : ( $show_wizard ? 'wizard' : 'settings' );
    $test_nonce = wp_create_nonce( 'sarah_test_nonce' );

    $mode_labels = [
        'chatbot'    => 'Solo Chatbot',
        'click2call' => 'Chatbot + Click2Call',
        'webrtc'     => 'Chatbot + WebRTC',
    ];
    ?>
    <style>
    /* ── Layout ── */
    .sarah-wrap { max-width: 860px; font-family: -apple-system, sans-serif; }
    .sarah-header { display:flex; align-items:center; gap:16px; padding:24px 28px; background:linear-gradient(135deg,#0066CC,#0044BB); border-radius:12px; color:#fff; margin-bottom:0; }
    .sarah-header h1 { margin:0; font-size:22px; color:#fff; }
    .sarah-header p  { margin:4px 0 0; opacity:.85; font-size:13px; }
    .sarah-tabs { display:flex; gap:0; border-bottom:2px solid #e5e7eb; margin-bottom:24px; }
    .sarah-tab  { padding:10px 20px; font-size:13px; font-weight:600; color:#6b7280; cursor:pointer; border-bottom:2px solid transparent; margin-bottom:-2px; text-decoration:none; }
    .sarah-tab.active { color:#0066CC; border-bottom-color:#0066CC; }
    .sarah-tab:hover  { color:#0066CC; }
    /* ── Cards ── */
    .sarah-card { background:#fff; border:1px solid #e5e7eb; border-radius:10px; padding:24px; margin-bottom:20px; }
    .sarah-card h2 { margin:0 0 18px; font-size:15px; font-weight:700; color:#111; display:flex; align-items:center; gap:8px; }
    .sarah-icon-wrap { width:28px; height:28px; border-radius:6px; background:#eff6ff; display:inline-flex; align-items:center; justify-content:center; font-size:14px; flex-shrink:0; }
    /* ── Fields ── */
    .sarah-field { margin-bottom:16px; }
    .sarah-field label { display:block; font-size:13px; font-weight:600; color:#374151; margin-bottom:6px; }
    .sarah-field input[type=text],
    .sarah-field input[type=url],
    .sarah-field select { width:100%; max-width:440px; padding:8px 12px; border:1px solid #d1d5db; border-radius:6px; font-size:13px; }
    .sarah-field .description { font-size:12px; color:#6b7280; margin-top:4px; }
    /* ── Toggle ── */
    .sarah-toggle-row { display:flex; align-items:center; gap:12px; }
    .sarah-toggle { position:relative; width:48px; height:26px; flex-shrink:0; display:inline-block; }
    .sarah-toggle input { opacity:0; width:0; height:0; position:absolute; }
    .sarah-toggle-slider { position:absolute; inset:0; background:#d1d5db; border-radius:13px; cursor:pointer; transition:.3s; }
    .sarah-toggle-slider:before { content:""; position:absolute; width:20px; height:20px; left:3px; bottom:3px; background:#fff; border-radius:50%; transition:.3s; }
    .sarah-toggle input:checked + .sarah-toggle-slider { background:#0066CC; }
    .sarah-toggle input:checked + .sarah-toggle-slider:before { transform:translateX(22px); }
    /* ── Mode cards ── */
    .sarah-mode-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
    .sarah-mode-card { border:2px solid #e5e7eb; border-radius:10px; padding:16px 12px; cursor:pointer; text-align:center; transition:all .2s; }
    .sarah-mode-card:has(input:checked),
    .sarah-mode-card.sel { border-color:#0066CC; background:#eff6ff; }
    .sarah-mode-card input { display:none; }
    .sarah-mode-card .mode-icon { font-size:26px; margin-bottom:8px; }
    .sarah-mode-card .mode-name { font-weight:700; font-size:13px; color:#111; margin-bottom:4px; }
    .sarah-mode-card .mode-desc { font-size:11px; color:#6b7280; line-height:1.5; }
    .sarah-mode-badge { display:inline-block; padding:2px 8px; border-radius:20px; font-size:10px; font-weight:700; margin-top:6px; }
    .sarah-mode-badge.free { background:#dcfce7; color:#15803d; }
    .sarah-mode-badge.sip  { background:#fef3c7; color:#92400e; }
    .sarah-mode-badge.webrtc { background:#e0f2fe; color:#0369a1; }
    /* ── Status badge ── */
    .sarah-badge { display:inline-flex; align-items:center; gap:6px; padding:3px 10px; border-radius:20px; font-size:12px; font-weight:600; }
    .sarah-badge.on  { background:rgba(16,185,129,.12); color:#065f46; }
    .sarah-badge.off { background:rgba(239,68,68,.1); color:#991b1b; }
    .sarah-dot { width:7px; height:7px; border-radius:50%; }
    .sarah-dot.on  { background:#10b981; }
    .sarah-dot.off { background:#ef4444; }
    /* ── Test button & result ── */
    #sarah-test-btn { background:#0066CC; color:#fff; border:none; padding:8px 18px; border-radius:6px; font-size:13px; font-weight:600; cursor:pointer; margin-left:8px; }
    #sarah-test-btn:hover { background:#0044BB; }
    #sarah-test-result { margin-top:10px; font-size:13px; padding:8px 14px; border-radius:6px; display:none; }
    #sarah-test-result.ok  { background:#dcfce7; color:#15803d; }
    #sarah-test-result.err { background:#fee2e2; color:#991b1b; }
    /* ── Save bar ── */
    .sarah-save-bar { display:flex; align-items:center; gap:16px; padding:16px 24px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; margin-top:4px; }
    /* ── Wizard ── */
    .sarah-wizard { max-width:700px; }
    .wiz-steps { display:flex; gap:0; margin-bottom:32px; }
    .wiz-step  { flex:1; text-align:center; position:relative; }
    .wiz-step::after { content:''; position:absolute; top:16px; left:50%; width:100%; height:2px; background:#e5e7eb; z-index:0; }
    .wiz-step:last-child::after { display:none; }
    .wiz-dot  { width:32px; height:32px; border-radius:50%; background:#e5e7eb; color:#6b7280; font-weight:700; font-size:13px; display:inline-flex; align-items:center; justify-content:center; position:relative; z-index:1; margin-bottom:6px; transition:.3s; }
    .wiz-step.done .wiz-dot  { background:#0066CC; color:#fff; }
    .wiz-step.active .wiz-dot { background:#0066CC; color:#fff; box-shadow:0 0 0 4px rgba(0,102,204,.2); }
    .wiz-step.done::after { background:#0066CC; }
    .wiz-label { font-size:11px; color:#6b7280; display:block; }
    .wiz-step.active .wiz-label,
    .wiz-step.done  .wiz-label { color:#0066CC; }
    .wiz-panel { display:none; }
    .wiz-panel.active { display:block; }
    .wiz-nav { display:flex; justify-content:space-between; align-items:center; margin-top:24px; padding-top:20px; border-top:1px solid #e5e7eb; }
    .wiz-btn-next { background:#0066CC; color:#fff; border:none; padding:10px 24px; border-radius:7px; font-size:14px; font-weight:600; cursor:pointer; }
    .wiz-btn-next:hover { background:#0044BB; }
    .wiz-btn-back { background:transparent; color:#6b7280; border:1px solid #d1d5db; padding:9px 20px; border-radius:7px; font-size:14px; cursor:pointer; }
    .wiz-btn-back:hover { border-color:#9ca3af; color:#374151; }
    </style>

    <div class="wrap sarah-wrap">

      <?php if ( $saved ) : ?>
      <div class="notice notice-success is-dismissible"><p>✅ Configuración de Sarah guardada.</p></div>
      <?php endif; ?>

      <!-- Header -->
      <div class="sarah-header" style="margin-bottom:24px;">
        <svg width="44" height="44" viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="24" fill="rgba(255,255,255,.15)"/><path d="M24 12C17.37 12 12 17.37 12 24c0 2.09.54 4.06 1.49 5.77L12 36l6.38-1.67A11.93 11.93 0 0024 36c6.63 0 12-5.37 12-12S30.63 12 24 12z" fill="white"/></svg>
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:10px;">
            <h1>Sarah — Chatbot IA</h1>
            <span class="sarah-badge <?php echo $enabled === '1' ? 'on' : 'off'; ?>">
              <span class="sarah-dot <?php echo $enabled === '1' ? 'on' : 'off'; ?>"></span>
              <?php echo $enabled === '1' ? 'Activa' : 'Desactivada'; ?>
            </span>
          </div>
          <p>Modo actual: <strong><?php echo esc_html( $mode_labels[ $sarah_mode ] ?? $sarah_mode ); ?></strong></p>
        </div>
        <a href="<?php echo esc_url( add_query_arg( ['page'=>'redegal-sarah','wizard'=>'1'], admin_url('themes.php') ) ); ?>" style="background:rgba(255,255,255,.15);color:#fff;border:1.5px solid rgba(255,255,255,.4);padding:7px 16px;border-radius:7px;text-decoration:none;font-size:13px;font-weight:600;">
          🧙 Asistente de configuración
        </a>
      </div>

      <!-- Tabs -->
      <div class="sarah-tabs">
        <a href="<?php echo esc_url( add_query_arg( ['page'=>'redegal-sarah','tab'=>'settings'], admin_url('themes.php') ) ); ?>"
           class="sarah-tab <?php echo $tab === 'settings' || $tab === 'wizard' ? ($tab==='settings'?'active':'') : ''; ?>
           <?php echo $tab !== 'wizard' ? 'active' : ''; ?>">
          ⚙️ Configuración
        </a>
        <a href="<?php echo esc_url( add_query_arg( ['page'=>'redegal-sarah','tab'=>'wizard'], admin_url('themes.php') ) ); ?>"
           class="sarah-tab <?php echo $tab === 'wizard' ? 'active' : ''; ?>">
          🧙 Asistente de instalación
        </a>
      </div>

      <?php if ( $tab === 'wizard' ) :
            redegal_sarah_render_wizard( $color, $position, $server_url, $custom_url, $bot_name, $sarah_mode, $test_nonce );
      else :
            redegal_sarah_render_settings( $enabled, $sarah_mode, $load_mode, $color, $position, $server_url, $custom_url, $bot_name, $show_lead, $excludes, $test_nonce );
      endif; ?>

    </div>

    <script>
    jQuery(function($) {
        // ── Server test (settings tab) ──
        $('#sarah-test-btn').on('click', function() {
            var url = $('#sarah-server-custom-input').val() || $('#sarah-server-auto-display').text();
            if (!url || url === 'auto') url = window.location.protocol + '//' + window.location.hostname + ':9456';
            var $r = $('#sarah-test-result').removeClass('ok err').text('Testeando…').show();
            $.post(ajaxurl, {
                action: 'sarah_test_server',
                nonce: '<?php echo esc_js( $test_nonce ); ?>',
                url: url
            }, function(res) {
                $r.addClass(res.success ? 'ok' : 'err').text(res.data.msg);
            });
        });

        // ── Wizard navigation ──
        var step = 1, total = 5;
        function gotoStep(n) {
            if (n < 1 || n > total) return;
            step = n;
            $('.wiz-panel').removeClass('active');
            $('#wiz-panel-' + n).addClass('active');
            // Update dots
            $('.wiz-step').each(function(i) {
                var s = i + 1;
                $(this).removeClass('active done');
                if (s < step) $(this).addClass('done');
                else if (s === step) $(this).addClass('active');
            });
            $('#wiz-back-btn').toggle(step > 1);
            $('#wiz-next-btn').text(step === total ? '✅ Guardar y activar' : 'Siguiente →');
        }
        gotoStep(1);

        $('#wiz-next-btn').on('click', function() {
            if (step === total) {
                // Submit the wizard form
                $('#sarah-wizard-form').submit();
            } else {
                gotoStep(step + 1);
            }
        });
        $('#wiz-back-btn').on('click', function() { gotoStep(step - 1); });

        // ── Wizard: server test ──
        $('#wiz-test-btn').on('click', function() {
            var url = $('#wiz-server-custom').val();
            if (!url) url = window.location.protocol + '//' + window.location.hostname + ':9456';
            var $r = $('#wiz-test-result').removeClass('ok err').text('Testeando…').show();
            $.post(ajaxurl, {
                action: 'sarah_test_server',
                nonce: '<?php echo esc_js( $test_nonce ); ?>',
                url: url
            }, function(res) {
                $r.addClass(res.success ? 'ok' : 'err').text(res.data.msg);
            });
        });

        // ── Mode card click visual ──
        $('.sarah-mode-card').on('click', function() {
            $(this).closest('.sarah-mode-grid').find('.sarah-mode-card').removeClass('sel');
            $(this).addClass('sel').find('input').prop('checked', true);
        });
    });
    </script>
    <?php
}

/* ============================================================
   SETTINGS TAB
   ============================================================ */

function redegal_sarah_render_settings( $enabled, $sarah_mode, $load_mode, $color, $position, $server_url, $custom_url, $bot_name, $show_lead, $excludes, $test_nonce ) {
    $mode_labels = [
        'chatbot'    => ['icon'=>'💬','name'=>'Solo Chatbot','desc'=>'Chat IA únicamente. Sin VoIP.','badge'=>'<span class="sarah-mode-badge free">Siempre disponible</span>'],
        'click2call' => ['icon'=>'📞','name'=>'Chatbot + Click2Call','desc'=>'Chat + botón de llamada SIP.','badge'=>'<span class="sarah-mode-badge sip">Requiere Asterisk</span>'],
        'webrtc'     => ['icon'=>'📹','name'=>'Chatbot + WebRTC','desc'=>'Chat + video/audio en navegador.','badge'=>'<span class="sarah-mode-badge webrtc">Requiere Janus</span>'],
    ];
    ?>
    <form method="post">
      <?php wp_nonce_field( 'redegal_sarah_settings' ); ?>
      <input type="hidden" name="redegal_sarah_save" value="1">
      <input type="hidden" name="redegal_sarah_wizard_done" value="1">

      <!-- Estado -->
      <div class="sarah-card">
        <h2><span class="sarah-icon-wrap">⚡</span> Estado global</h2>
        <div class="sarah-toggle-row">
          <label class="sarah-toggle">
            <input type="checkbox" name="redegal_sarah_enabled" value="1" <?php checked( $enabled, '1' ); ?>>
            <span class="sarah-toggle-slider"></span>
          </label>
          <span style="font-weight:600;font-size:13px;">Sarah habilitada en el frontend</span>
        </div>
        <p class="description" style="margin-top:8px;">Al desactivar, ni el widget ni el CSS cargan.</p>
      </div>

      <!-- Modo -->
      <div class="sarah-card">
        <h2><span class="sarah-icon-wrap">🎛️</span> Modo de uso</h2>
        <div class="sarah-mode-grid">
          <?php foreach ( $mode_labels as $val => $m ) : ?>
          <label class="sarah-mode-card <?php echo $sarah_mode === $val ? 'sel' : ''; ?>">
            <input type="radio" name="redegal_sarah_mode" value="<?php echo esc_attr($val); ?>" <?php checked($sarah_mode,$val); ?>>
            <div class="mode-icon"><?php echo $m['icon']; ?></div>
            <div class="mode-name"><?php echo esc_html($m['name']); ?></div>
            <div class="mode-desc"><?php echo esc_html($m['desc']); ?></div>
            <?php echo $m['badge']; ?>
          </label>
          <?php endforeach; ?>
        </div>
      </div>

      <!-- Servidor -->
      <div class="sarah-card">
        <h2><span class="sarah-icon-wrap">🌐</span> Servidor Sarah</h2>
        <div class="sarah-field">
          <label>Modo de conexión</label>
          <select name="redegal_sarah_server_url" id="sarah-server-mode"
                  onchange="document.getElementById('sarah-custom-row').style.display=this.value==='custom'?'block':'none'">
            <option value="auto"   <?php selected($server_url,'auto'); ?>>Auto-detectar (mismo host + proxy /chat-api/)</option>
            <option value="custom" <?php selected($server_url,'custom'); ?>>URL personalizada</option>
          </select>
        </div>
        <div id="sarah-custom-row" style="display:<?php echo $server_url==='custom'?'block':'none'; ?>">
          <div class="sarah-field">
            <label>URL del servidor Sarah</label>
            <div style="display:flex;align-items:center;gap:0;max-width:440px;">
              <input type="url" id="sarah-server-custom-input" name="redegal_sarah_server_custom"
                     value="<?php echo esc_attr($custom_url); ?>"
                     placeholder="http://37.27.92.122:9456" style="border-radius:6px 0 0 6px;border-right:none;margin:0;">
              <button type="button" id="sarah-test-btn" style="border-radius:0 6px 6px 0;margin:0;padding:8px 14px;">Probar</button>
            </div>
            <div id="sarah-test-result"></div>
            <p class="description">Sin barra final. Ej: <code>http://37.27.92.122:9456</code></p>
          </div>
        </div>
      </div>

      <!-- Carga -->
      <div class="sarah-card">
        <h2><span class="sarah-icon-wrap">📦</span> Modo de carga</h2>
        <div class="sarah-mode-grid">
          <?php foreach (['eager'=>['⚡','Inmediata','Carga con la página. Máxima disponibilidad.'], 'lazy-scroll'=>['📜','Lazy (scroll)','Carga al primer scroll. Recomendado.'], 'lazy-click'=>['👆','Lazy (clic)','Solo carga cuando el usuario hace clic.']] as $v=>$d) : ?>
          <label class="sarah-mode-card <?php echo $load_mode===$v?'sel':''; ?>">
            <input type="radio" name="redegal_sarah_load_mode" value="<?php echo esc_attr($v); ?>" <?php checked($load_mode,$v); ?>>
            <div class="mode-icon"><?php echo $d[0]; ?></div>
            <div class="mode-name"><?php echo $d[1]; ?></div>
            <div class="mode-desc"><?php echo $d[2]; ?></div>
          </label>
          <?php endforeach; ?>
        </div>
      </div>

      <!-- Apariencia -->
      <div class="sarah-card">
        <h2><span class="sarah-icon-wrap">🎨</span> Apariencia</h2>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div class="sarah-field">
            <label>Nombre del bot</label>
            <input type="text" name="redegal_sarah_bot_name" value="<?php echo esc_attr($bot_name); ?>">
          </div>
          <div class="sarah-field">
            <label>Color principal</label>
            <input type="text" name="redegal_sarah_primary_color" value="<?php echo esc_attr($color); ?>" placeholder="#0066CC">
          </div>
          <div class="sarah-field">
            <label>Posición</label>
            <select name="redegal_sarah_position">
              <option value="bottom-right" <?php selected($position,'bottom-right'); ?>>Inferior derecha</option>
              <option value="bottom-left"  <?php selected($position,'bottom-left'); ?>>Inferior izquierda</option>
            </select>
          </div>
          <div class="sarah-field">
            <label style="margin-bottom:10px;">Formulario de lead</label>
            <div class="sarah-toggle-row">
              <label class="sarah-toggle">
                <input type="checkbox" name="redegal_sarah_show_lead" value="1" <?php checked($show_lead,'1'); ?>>
                <span class="sarah-toggle-slider"></span>
              </label>
              <span style="font-size:13px;">Formulario de contacto en widget</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Páginas -->
      <div class="sarah-card">
        <h2><span class="sarah-icon-wrap">📄</span> Visibilidad por página</h2>
        <div class="sarah-field">
          <label>Excluir páginas (IDs separados por coma)</label>
          <input type="text" name="redegal_sarah_exclude_pages" value="<?php echo esc_attr($excludes); ?>" placeholder="12, 47, 103">
          <p class="description">Vacío = Sarah en todas las páginas.</p>
        </div>
      </div>

      <div class="sarah-save-bar">
        <input type="submit" class="button button-primary" value="💾 Guardar configuración">
        <?php if ( $enabled !== '1' ) : ?>
        <span style="color:#dc2626;font-size:13px;">⚠️ Sarah está desactivada</span>
        <?php endif; ?>
      </div>
    </form>
    <?php
}

/* ============================================================
   WIZARD TAB
   ============================================================ */

function redegal_sarah_render_wizard( $color, $position, $server_url, $custom_url, $bot_name, $sarah_mode, $test_nonce ) {
    ?>
    <form method="post" id="sarah-wizard-form">
      <?php wp_nonce_field( 'redegal_sarah_settings' ); ?>
      <input type="hidden" name="redegal_sarah_save" value="1">
      <input type="hidden" name="redegal_sarah_enabled" value="1">
      <input type="hidden" name="redegal_sarah_wizard_done" value="1">
      <!-- Pass-through fields not in wizard steps -->
      <input type="hidden" name="redegal_sarah_load_mode" value="eager">
      <input type="hidden" name="redegal_sarah_show_lead" value="1">
      <input type="hidden" name="redegal_sarah_exclude_pages" value="">

      <div class="sarah-wizard">

        <!-- Progress steps -->
        <div class="wiz-steps">
          <?php
          $steps = ['Bienvenido','Modo','Servidor','Apariencia','¡Listo!'];
          foreach($steps as $i=>$s):
          ?>
          <div class="wiz-step" id="wiz-dot-<?php echo $i+1; ?>">
            <div class="wiz-dot"><?php echo $i+1; ?></div>
            <span class="wiz-label"><?php echo esc_html($s); ?></span>
          </div>
          <?php endforeach; ?>
        </div>

        <!-- Step 1: Welcome -->
        <div class="wiz-panel sarah-card" id="wiz-panel-1">
          <div style="text-align:center;padding:20px 0;">
            <div style="font-size:56px;margin-bottom:12px;">🤖</div>
            <h2 style="font-size:22px;margin-bottom:12px;">Bienvenido a Sarah</h2>
            <p style="color:#6b7280;max-width:480px;margin:0 auto 24px;line-height:1.7;">
              Sarah es el asistente IA conversacional de Redegal. En 4 pasos configurarás el chatbot,
              elegirás si añadir llamadas o WebRTC, y lo tendrás activo en la web.
            </p>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;max-width:540px;margin:0 auto;text-align:left;">
              <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:14px;">
                <div style="font-size:20px;margin-bottom:6px;">💬</div>
                <strong style="font-size:13px;">Chat IA</strong>
                <p style="font-size:12px;color:#6b7280;margin:4px 0 0;">Claude + Gemini multi-provider</p>
              </div>
              <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px;">
                <div style="font-size:20px;margin-bottom:6px;">📞</div>
                <strong style="font-size:13px;">Click2Call</strong>
                <p style="font-size:12px;color:#6b7280;margin:4px 0 0;">Llamada SIP desde el navegador</p>
              </div>
              <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;padding:14px;">
                <div style="font-size:20px;margin-bottom:6px;">📹</div>
                <strong style="font-size:13px;">WebRTC</strong>
                <p style="font-size:12px;color:#6b7280;margin:4px 0 0;">Video y audio en el navegador</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 2: Mode -->
        <div class="wiz-panel sarah-card" id="wiz-panel-2">
          <h2><span class="sarah-icon-wrap">🎛️</span> Elige el modo de Sarah</h2>
          <p style="color:#6b7280;font-size:13px;margin-bottom:20px;">Puedes cambiarlo en cualquier momento desde Configuración.</p>
          <div class="sarah-mode-grid">
            <label class="sarah-mode-card <?php echo $sarah_mode==='chatbot'?'sel':''; ?>">
              <input type="radio" name="redegal_sarah_mode" value="chatbot" <?php checked($sarah_mode,'chatbot'); ?>>
              <div class="mode-icon">💬</div>
              <div class="mode-name">Solo Chatbot</div>
              <div class="mode-desc">Chat IA con Claude y Gemini. Soporte multiidioma. Sin VoIP.</div>
              <span class="sarah-mode-badge free">Siempre disponible</span>
            </label>
            <label class="sarah-mode-card <?php echo $sarah_mode==='click2call'?'sel':''; ?>">
              <input type="radio" name="redegal_sarah_mode" value="click2call" <?php checked($sarah_mode,'click2call'); ?>>
              <div class="mode-icon">📞</div>
              <div class="mode-name">Chatbot + Click2Call</div>
              <div class="mode-desc">Chat + botón de llamada que inicia una llamada SIP al equipo.</div>
              <span class="sarah-mode-badge sip">Requiere Asterisk/SIP</span>
            </label>
            <label class="sarah-mode-card <?php echo $sarah_mode==='webrtc'?'sel':''; ?>">
              <input type="radio" name="redegal_sarah_mode" value="webrtc" <?php checked($sarah_mode,'webrtc'); ?>>
              <div class="mode-icon">📹</div>
              <div class="mode-name">Chatbot + WebRTC</div>
              <div class="mode-desc">Chat + sesión de audio/video en tiempo real vía Janus WebRTC.</div>
              <span class="sarah-mode-badge webrtc">Requiere servidor Janus</span>
            </label>
          </div>
        </div>

        <!-- Step 3: Server -->
        <div class="wiz-panel sarah-card" id="wiz-panel-3">
          <h2><span class="sarah-icon-wrap">🌐</span> Conexión al servidor Sarah</h2>
          <div class="sarah-field">
            <label>Modo de conexión</label>
            <select name="redegal_sarah_server_url" onchange="document.getElementById('wiz-custom-row').style.display=this.value==='custom'?'block':'none'">
              <option value="auto"   <?php selected($server_url,'auto'); ?>>Auto-detectar (mismo host, proxy /chat-api/)</option>
              <option value="custom" <?php selected($server_url,'custom'); ?>>URL personalizada</option>
            </select>
          </div>
          <div id="wiz-custom-row" style="display:<?php echo $server_url==='custom'?'block':'none'; ?>">
            <div class="sarah-field">
              <label>URL del servidor</label>
              <input type="url" id="wiz-server-custom" name="redegal_sarah_server_custom"
                     value="<?php echo esc_attr($custom_url); ?>"
                     placeholder="http://37.27.92.122:9456" style="max-width:360px;">
              <p class="description">Sin barra final. Ej: <code>http://37.27.92.122:9456</code></p>
            </div>
            <button type="button" id="wiz-test-btn" style="background:#0066CC;color:#fff;border:none;padding:9px 20px;border-radius:7px;font-size:13px;font-weight:600;cursor:pointer;">
              🔌 Probar conexión
            </button>
            <div id="wiz-test-result" style="margin-top:10px;font-size:13px;padding:8px 14px;border-radius:6px;display:none;"></div>
          </div>
          <div style="margin-top:16px;padding:12px 16px;background:#f0f9ff;border-radius:8px;font-size:13px;">
            <strong>Estado Sarah en servidor:</strong> <code>http://37.27.92.122:9456</code> — accesible públicamente
          </div>
        </div>

        <!-- Step 4: Appearance -->
        <div class="wiz-panel sarah-card" id="wiz-panel-4">
          <h2><span class="sarah-icon-wrap">🎨</span> Personaliza la apariencia</h2>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
            <div class="sarah-field">
              <label>Nombre del asistente</label>
              <input type="text" name="redegal_sarah_bot_name" value="<?php echo esc_attr($bot_name); ?>" placeholder="Sarah">
            </div>
            <div class="sarah-field">
              <label>Color principal</label>
              <input type="text" name="redegal_sarah_primary_color" value="<?php echo esc_attr($color); ?>" placeholder="#0066CC">
              <p class="description">Por defecto usa el azul corporativo de Redegal.</p>
            </div>
            <div class="sarah-field">
              <label>Posición en pantalla</label>
              <select name="redegal_sarah_position">
                <option value="bottom-right" <?php selected($position,'bottom-right'); ?>>Inferior derecha</option>
                <option value="bottom-left"  <?php selected($position,'bottom-left'); ?>>Inferior izquierda</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Step 5: Done -->
        <div class="wiz-panel sarah-card" id="wiz-panel-5">
          <div style="text-align:center;padding:20px 0;">
            <div style="font-size:56px;margin-bottom:12px;">🎉</div>
            <h2 style="font-size:22px;margin-bottom:12px;">Sarah lista para activar</h2>
            <p style="color:#6b7280;max-width:460px;margin:0 auto 24px;line-height:1.7;">
              Haz clic en <strong>Guardar y activar</strong> para que Sarah aparezca en la web.
              Puedes ajustar cualquier opción desde la pestaña <em>Configuración</em>.
            </p>
            <div style="display:inline-block;text-align:left;background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:20px 28px;">
              <div style="font-size:13px;line-height:2;color:#374151;">
                <div>🎛️ <strong>Modo:</strong> <span id="wiz-summary-mode"><?php echo esc_html( $sarah_mode ); ?></span></div>
                <div>🌐 <strong>Servidor:</strong> <span id="wiz-summary-server"><?php echo esc_html( $custom_url ?: 'auto-detect' ); ?></span></div>
                <div>🎨 <strong>Color:</strong> <span id="wiz-summary-color"><?php echo esc_html( $color ); ?></span></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Wizard navigation -->
        <div class="wiz-nav">
          <button type="button" id="wiz-back-btn" class="wiz-btn-back" style="display:none;">← Anterior</button>
          <div></div>
          <button type="button" id="wiz-next-btn" class="wiz-btn-next">Siguiente →</button>
        </div>

      </div>
    </form>
    <?php
}

/* ============================================================
   6. FRONTEND — ASSET LOADING
   ============================================================ */

add_action( 'wp_enqueue_scripts', 'redegal_sarah_enqueue' );

function redegal_sarah_enqueue() {
    if ( redegal_sarah_get( 'enabled' ) !== '1' ) return;

    $excludes = redegal_sarah_get( 'exclude_pages' );
    if ( $excludes && is_page() ) {
        $excluded_ids = array_filter( array_map( 'intval', explode( ',', $excludes ) ) );
        if ( in_array( get_the_ID(), $excluded_ids, true ) ) return;
    }

    $load_mode  = redegal_sarah_get( 'load_mode' );
    $sarah_mode = redegal_sarah_get( 'mode' );
    $widget_url = REDEGAL_URI . '/assets/chatbot/widget.js?v=' . redegal_asset_ver( 'assets/chatbot/widget.js' );
    $suffix     = redegal_is_prod() ? '.min' : '';

    wp_enqueue_script(
        'redegal-sarah-config',
        REDEGAL_URI . "/assets/js/sarah-config{$suffix}.js",
        [], redegal_asset_ver( "assets/js/sarah-config{$suffix}.js" ),
        ['in_footer' => true]
    );
    wp_localize_script( 'redegal-sarah-config', 'redegalSarahConfig', [
        'serverMode'   => redegal_sarah_get( 'server_url' ),
        'serverCustom' => redegal_sarah_get( 'server_custom' ),
        'primaryColor' => redegal_sarah_get( 'primary_color' ),
        'position'     => redegal_sarah_get( 'position' ),
        'botName'      => redegal_sarah_get( 'bot_name' ),
        'welcome'      => __r('chatbot.welcome') ?: 'Hola! Bienvenido a Redegal.',
        'offline'      => __r('chatbot.offline') ?: 'Ahora mismo estamos offline.',
        'sarahMode'    => $sarah_mode,
        'enableVoip'   => in_array( $sarah_mode, ['click2call','webrtc'], true ),
        'enableWebRTC' => $sarah_mode === 'webrtc',
        'enableLead'   => redegal_sarah_get( 'show_lead' ) === '1',
    ] );

    if ( $load_mode === 'eager' ) {
        wp_enqueue_style(  'sarah-widget', REDEGAL_URI . '/assets/chatbot/widget.css', [], redegal_asset_ver( 'assets/chatbot/widget.css' ) );
        wp_enqueue_script( 'sarah-widget', $widget_url, [], null, ['in_footer' => true] );
    } else {
        wp_enqueue_script(
            'redegal-sarah-lazy',
            REDEGAL_URI . "/assets/js/sarah-lazy{$suffix}.js",
            [], redegal_asset_ver( "assets/js/sarah-lazy{$suffix}.js" ),
            ['in_footer' => true]
        );
        wp_localize_script( 'redegal-sarah-lazy', 'redegalSarahLazy', [
            'widgetUrl' => $widget_url,
            'lazyClick' => $load_mode === 'lazy-click',
        ] );
    }
}

/* ============================================================
   7. PRE-LAUNCHER (lazy modes only)
   ============================================================ */

add_action( 'wp_footer', 'redegal_sarah_prelauncher', 5 );

function redegal_sarah_prelauncher() {
    if ( redegal_sarah_get( 'enabled' ) !== '1' ) return;
    if ( redegal_sarah_get( 'load_mode' ) === 'eager' ) return;

    $excludes = redegal_sarah_get( 'exclude_pages' );
    if ( $excludes && is_page() ) {
        $excluded_ids = array_filter( array_map( 'intval', explode( ',', $excludes ) ) );
        if ( in_array( get_the_ID(), $excluded_ids, true ) ) return;
    }

    $color    = esc_attr( redegal_sarah_get( 'primary_color' ) );
    $position = redegal_sarah_get( 'position' );
    $pos_css  = $position === 'bottom-left' ? 'left:20px;right:auto;' : 'right:20px;';
    $bot_name = esc_attr( redegal_sarah_get( 'bot_name' ) );
    $auto_open= redegal_sarah_get( 'load_mode' ) === 'lazy-click' ? '1' : '0';
    ?>
    <style>
    #sarah-prelauncher {
        position:fixed; bottom:20px; <?php echo $pos_css; ?> z-index:2147483640;
        width:60px; height:60px; border-radius:50%;
        background:<?php echo $color; ?>; border:none; cursor:pointer;
        display:flex; align-items:center; justify-content:center;
        box-shadow:0 4px 20px rgba(0,0,0,.25);
        transition:transform .2s, box-shadow .2s, opacity .3s;
    }
    #sarah-prelauncher:hover { transform:scale(1.08); box-shadow:0 6px 28px rgba(0,0,0,.32); }
    #sarah-prelauncher.sarah-pre--loading { opacity:.7; cursor:wait; animation:sarah-pulse 1s infinite; }
    @keyframes sarah-pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.04)} }
    </style>
    <button id="sarah-prelauncher" data-sarah-auto-open="<?php echo esc_attr($auto_open); ?>" aria-label="Abrir chat con <?php echo $bot_name; ?>">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    </button>
    <?php
}
