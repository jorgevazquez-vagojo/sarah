<?php
/**
 * Plugin Name: Sarah
 * Plugin URI: https://redegal.com/chatbot
 * Description: Sarah AI Chatbot + SarahPhone VoIP widget by Redegal. Multi-language, multi-CRM, fully customizable.
 * Version: 1.0.0
 * Author: Redegal
 * Author URI: https://redegal.com
 * License: GPL-2.0-or-later
 * Text Domain: sarah-chatbot
 */

if (!defined('ABSPATH')) exit;

class SarahChatbot {

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
            __('Sarah', 'sarah-chatbot'),
            __('Sarah', 'sarah-chatbot'),
            'manage_options',
            'sarah-chatbot',
            [$this, 'settings_page']
        );
    }

    public function register_settings() {
        register_setting('sarah-chatbot', 'rdgbot_server_url');
        register_setting('sarah-chatbot', 'rdgbot_api_key');
        register_setting('sarah-chatbot', 'rdgbot_language');
        register_setting('sarah-chatbot', 'rdgbot_primary_color');
        register_setting('sarah-chatbot', 'rdgbot_position');
        register_setting('sarah-chatbot', 'rdgbot_logo_url');
        register_setting('sarah-chatbot', 'rdgbot_company_name');
        register_setting('sarah-chatbot', 'rdgbot_enabled');
        register_setting('sarah-chatbot', 'rdgbot_pages');
    }

    public function settings_page() {
        ?>
        <div class="wrap">
            <h1><?php echo esc_html__('Sarah Settings', 'sarah-chatbot'); ?></h1>
            <form method="post" action="options.php">
                <?php settings_fields('sarah-chatbot'); ?>
                <table class="form-table">
                    <tr>
                        <th><label for="rdgbot_enabled"><?php _e('Enabled', 'sarah-chatbot'); ?></label></th>
                        <td><input type="checkbox" name="rdgbot_enabled" value="1" <?php checked(get_option('rdgbot_enabled'), '1'); ?> /></td>
                    </tr>
                    <tr>
                        <th><label for="rdgbot_server_url"><?php _e('Server URL', 'sarah-chatbot'); ?></label></th>
                        <td><input type="url" name="rdgbot_server_url" value="<?php echo esc_attr(get_option('rdgbot_server_url', 'https://chatbot.redegal.com')); ?>" class="regular-text" /></td>
                    </tr>
                    <tr>
                        <th><label for="rdgbot_api_key"><?php _e('API Key', 'sarah-chatbot'); ?></label></th>
                        <td><input type="text" name="rdgbot_api_key" value="<?php echo esc_attr(get_option('rdgbot_api_key')); ?>" class="regular-text" /></td>
                    </tr>
                    <tr>
                        <th><label for="rdgbot_company_name"><?php _e('Company Name', 'sarah-chatbot'); ?></label></th>
                        <td><input type="text" name="rdgbot_company_name" value="<?php echo esc_attr(get_option('rdgbot_company_name', 'Redegal')); ?>" class="regular-text" /></td>
                    </tr>
                    <tr>
                        <th><label for="rdgbot_logo_url"><?php _e('Logo URL', 'sarah-chatbot'); ?></label></th>
                        <td><input type="url" name="rdgbot_logo_url" value="<?php echo esc_attr(get_option('rdgbot_logo_url')); ?>" class="regular-text" /></td>
                    </tr>
                    <tr>
                        <th><label for="rdgbot_primary_color"><?php _e('Primary Color', 'sarah-chatbot'); ?></label></th>
                        <td><input type="color" name="rdgbot_primary_color" value="<?php echo esc_attr(get_option('rdgbot_primary_color', '#007fff')); ?>" /></td>
                    </tr>
                    <tr>
                        <th><label for="rdgbot_language"><?php _e('Default Language', 'sarah-chatbot'); ?></label></th>
                        <td>
                            <select name="rdgbot_language">
                                <?php foreach (['auto' => 'Auto-detect', 'es' => 'Español', 'en' => 'English', 'pt' => 'Português', 'gl' => 'Galego'] as $code => $label): ?>
                                    <option value="<?php echo $code; ?>" <?php selected(get_option('rdgbot_language', 'auto'), $code); ?>><?php echo $label; ?></option>
                                <?php endforeach; ?>
                            </select>
                        </td>
                    </tr>
                    <tr>
                        <th><label for="rdgbot_position"><?php _e('Widget Position', 'sarah-chatbot'); ?></label></th>
                        <td>
                            <select name="rdgbot_position">
                                <option value="bottom-right" <?php selected(get_option('rdgbot_position', 'bottom-right'), 'bottom-right'); ?>>Bottom Right</option>
                                <option value="bottom-left" <?php selected(get_option('rdgbot_position', 'bottom-right'), 'bottom-left'); ?>>Bottom Left</option>
                            </select>
                        </td>
                    </tr>
                    <tr>
                        <th><label for="rdgbot_pages"><?php _e('Show on pages (empty = all)', 'sarah-chatbot'); ?></label></th>
                        <td><textarea name="rdgbot_pages" rows="3" class="regular-text" placeholder="One URL pattern per line"><?php echo esc_textarea(get_option('rdgbot_pages', '')); ?></textarea></td>
                    </tr>
                </table>
                <?php submit_button(); ?>
            </form>
        </div>
        <?php
    }

    public function enqueue_scripts() {
        if (get_option('rdgbot_enabled') !== '1') return;

        // Check page restrictions
        $pages = trim(get_option('rdgbot_pages', ''));
        if ($pages) {
            $patterns = array_filter(array_map('trim', explode("\n", $pages)));
            $current = $_SERVER['REQUEST_URI'];
            $match = false;
            foreach ($patterns as $pattern) {
                if (fnmatch($pattern, $current)) { $match = true; break; }
            }
            if (!$match) return;
        }

        $server = rtrim(get_option('rdgbot_server_url', 'https://chatbot.redegal.com'), '/');
        wp_enqueue_script('sarah-loader', $server . '/widget/loader.js', [], '1.0.0', true);
    }

    public function render_widget() {
        if (get_option('rdgbot_enabled') !== '1') return;

        $server = rtrim(get_option('rdgbot_server_url', 'https://chatbot.redegal.com'), '/');
        $config = [
            'baseUrl' => $server . '/widget',
            'apiUrl' => str_replace(['https://', 'http://'], ['wss://', 'ws://'], $server) . '/ws/chat',
            'configUrl' => $server . '/api/config/widget',
            'language' => get_option('rdgbot_language', 'auto'),
            'primaryColor' => get_option('rdgbot_primary_color', '#007fff'),
            'theme' => [
                'branding' => [
                    'companyName' => get_option('rdgbot_company_name', 'Redegal'),
                    'logoUrl' => get_option('rdgbot_logo_url', ''),
                ],
                'layout' => [
                    'position' => get_option('rdgbot_position', 'bottom-right'),
                ],
            ],
        ];
        ?>
        <script>
        window.Sarah = <?php echo wp_json_encode($config); ?>;
        window.RdgBot = window.Sarah; // backward compatibility
        </script>
        <?php
    }
}

SarahChatbot::get_instance();
