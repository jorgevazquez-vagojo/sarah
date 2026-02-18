<?php
/**
 * Plugin Name: Redegal Chatbot
 * Plugin URI: https://redegal.com/chatbot
 * Description: Chatbot IA + WebPhone VoIP widget by Redegal. Multi-language, multi-CRM, fully customizable.
 * Version: 1.0.0
 * Author: Redegal
 * Author URI: https://redegal.com
 * License: GPL-2.0-or-later
 * Text Domain: redegal-chatbot
 */

if (!defined('ABSPATH')) exit;

class Redegal_Chatbot {

    private static $instance = null;

    public static function get_instance() {
        if (null === self::$instance) self::$instance = new self();
        return self::$instance;
    }

    private function __construct() {
        add_action('admin_menu', [$this, 'add_admin_menu']);
        add_action('admin_init', [$this, 'register_settings']);
        add_action('wp_footer', [$this, 'render_widget']);
        add_action('wp_enqueue_scripts', [$this, 'enqueue_scripts']);
    }

    public function add_admin_menu() {
        add_options_page(
            __('Redegal Chatbot', 'redegal-chatbot'),
            __('Redegal Chatbot', 'redegal-chatbot'),
            'manage_options',
            'redegal-chatbot',
            [$this, 'settings_page']
        );
    }

    public function register_settings() {
        register_setting('redegal_chatbot', 'redegal_chatbot_server_url');
        register_setting('redegal_chatbot', 'redegal_chatbot_api_key');
        register_setting('redegal_chatbot', 'redegal_chatbot_language');
        register_setting('redegal_chatbot', 'redegal_chatbot_primary_color');
        register_setting('redegal_chatbot', 'redegal_chatbot_position');
        register_setting('redegal_chatbot', 'redegal_chatbot_logo_url');
        register_setting('redegal_chatbot', 'redegal_chatbot_company_name');
        register_setting('redegal_chatbot', 'redegal_chatbot_enabled');
        register_setting('redegal_chatbot', 'redegal_chatbot_pages');
    }

    public function settings_page() {
        ?>
        <div class="wrap">
            <h1><?php echo esc_html__('Redegal Chatbot Settings', 'redegal-chatbot'); ?></h1>
            <form method="post" action="options.php">
                <?php settings_fields('redegal_chatbot'); ?>
                <table class="form-table">
                    <tr>
                        <th><label for="redegal_chatbot_enabled"><?php _e('Enabled', 'redegal-chatbot'); ?></label></th>
                        <td><input type="checkbox" name="redegal_chatbot_enabled" value="1" <?php checked(get_option('redegal_chatbot_enabled'), '1'); ?> /></td>
                    </tr>
                    <tr>
                        <th><label for="redegal_chatbot_server_url"><?php _e('Server URL', 'redegal-chatbot'); ?></label></th>
                        <td><input type="url" name="redegal_chatbot_server_url" value="<?php echo esc_attr(get_option('redegal_chatbot_server_url', 'https://chatbot.redegal.com')); ?>" class="regular-text" /></td>
                    </tr>
                    <tr>
                        <th><label for="redegal_chatbot_api_key"><?php _e('API Key', 'redegal-chatbot'); ?></label></th>
                        <td><input type="text" name="redegal_chatbot_api_key" value="<?php echo esc_attr(get_option('redegal_chatbot_api_key')); ?>" class="regular-text" /></td>
                    </tr>
                    <tr>
                        <th><label for="redegal_chatbot_company_name"><?php _e('Company Name', 'redegal-chatbot'); ?></label></th>
                        <td><input type="text" name="redegal_chatbot_company_name" value="<?php echo esc_attr(get_option('redegal_chatbot_company_name', 'Redegal')); ?>" class="regular-text" /></td>
                    </tr>
                    <tr>
                        <th><label for="redegal_chatbot_logo_url"><?php _e('Logo URL', 'redegal-chatbot'); ?></label></th>
                        <td><input type="url" name="redegal_chatbot_logo_url" value="<?php echo esc_attr(get_option('redegal_chatbot_logo_url')); ?>" class="regular-text" /></td>
                    </tr>
                    <tr>
                        <th><label for="redegal_chatbot_primary_color"><?php _e('Primary Color', 'redegal-chatbot'); ?></label></th>
                        <td><input type="color" name="redegal_chatbot_primary_color" value="<?php echo esc_attr(get_option('redegal_chatbot_primary_color', '#E30613')); ?>" /></td>
                    </tr>
                    <tr>
                        <th><label for="redegal_chatbot_language"><?php _e('Default Language', 'redegal-chatbot'); ?></label></th>
                        <td>
                            <select name="redegal_chatbot_language">
                                <?php foreach (['auto' => 'Auto-detect', 'es' => 'Español', 'en' => 'English', 'pt' => 'Português', 'fr' => 'Français', 'de' => 'Deutsch', 'it' => 'Italiano', 'nl' => 'Nederlands', 'zh' => '中文', 'ja' => '日本語', 'ko' => '한국어', 'ar' => 'العربية', 'gl' => 'Galego'] as $code => $label): ?>
                                    <option value="<?php echo $code; ?>" <?php selected(get_option('redegal_chatbot_language', 'auto'), $code); ?>><?php echo $label; ?></option>
                                <?php endforeach; ?>
                            </select>
                        </td>
                    </tr>
                    <tr>
                        <th><label for="redegal_chatbot_position"><?php _e('Widget Position', 'redegal-chatbot'); ?></label></th>
                        <td>
                            <select name="redegal_chatbot_position">
                                <option value="bottom-right" <?php selected(get_option('redegal_chatbot_position', 'bottom-right'), 'bottom-right'); ?>>Bottom Right</option>
                                <option value="bottom-left" <?php selected(get_option('redegal_chatbot_position', 'bottom-right'), 'bottom-left'); ?>>Bottom Left</option>
                            </select>
                        </td>
                    </tr>
                    <tr>
                        <th><label for="redegal_chatbot_pages"><?php _e('Show on pages (empty = all)', 'redegal-chatbot'); ?></label></th>
                        <td><textarea name="redegal_chatbot_pages" rows="3" class="regular-text" placeholder="One URL pattern per line"><?php echo esc_textarea(get_option('redegal_chatbot_pages', '')); ?></textarea></td>
                    </tr>
                </table>
                <?php submit_button(); ?>
            </form>
        </div>
        <?php
    }

    public function enqueue_scripts() {
        if (get_option('redegal_chatbot_enabled') !== '1') return;

        // Check page restrictions
        $pages = trim(get_option('redegal_chatbot_pages', ''));
        if ($pages) {
            $patterns = array_filter(array_map('trim', explode("\n", $pages)));
            $current = $_SERVER['REQUEST_URI'];
            $match = false;
            foreach ($patterns as $pattern) {
                if (fnmatch($pattern, $current)) { $match = true; break; }
            }
            if (!$match) return;
        }

        $server = rtrim(get_option('redegal_chatbot_server_url', 'https://chatbot.redegal.com'), '/');
        wp_enqueue_script('redegal-chatbot-loader', $server . '/widget/loader.js', [], '1.0.0', true);
    }

    public function render_widget() {
        if (get_option('redegal_chatbot_enabled') !== '1') return;

        $server = rtrim(get_option('redegal_chatbot_server_url', 'https://chatbot.redegal.com'), '/');
        $config = [
            'baseUrl' => $server . '/widget',
            'apiUrl' => str_replace(['https://', 'http://'], ['wss://', 'ws://'], $server) . '/ws/chat',
            'configUrl' => $server . '/api/config/widget',
            'language' => get_option('redegal_chatbot_language', 'auto'),
            'primaryColor' => get_option('redegal_chatbot_primary_color', '#E30613'),
            'theme' => [
                'branding' => [
                    'companyName' => get_option('redegal_chatbot_company_name', 'Redegal'),
                    'logoUrl' => get_option('redegal_chatbot_logo_url', ''),
                ],
                'layout' => [
                    'position' => get_option('redegal_chatbot_position', 'bottom-right'),
                ],
            ],
        ];
        ?>
        <script>window.RedegalChatbot = <?php echo wp_json_encode($config); ?>;</script>
        <?php
    }
}

Redegal_Chatbot::get_instance();
