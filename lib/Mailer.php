<?php

require_once __DIR__ . '/../vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

class MailerException extends \Exception {}

class Mailer {
    private $mail;

    public function __construct() {
        // Ensure configuration is loaded
        $configPath = __DIR__ . '/../mailer_config.php';
        if (file_exists($configPath)) {
            require_once $configPath;
        }

        $this->mail = new PHPMailer(true);
        $this->mail->CharSet = 'UTF-8';

        if (defined('SMTP_HOST') && SMTP_HOST) {
            // Server settings
            $this->mail->isSMTP();
            $this->mail->Host       = SMTP_HOST;
            $this->mail->SMTPAuth   = true;
            $this->mail->Username   = SMTP_USER;
            $this->mail->Password   = SMTP_PASS;
            $this->mail->SMTPSecure = (SMTP_PORT == 465) ? PHPMailer::ENCRYPTION_SMTPS : PHPMailer::ENCRYPTION_STARTTLS;
            $this->mail->Port       = SMTP_PORT;

            // Sender settings
            $this->mail->setFrom(SMTP_FROM_EMAIL, SMTP_FROM_NAME);
        }
    }

    /**
     * Send an email with HTML content
     */
    public function send($toEmail, $toName, $subject, $htmlBody, $altBody = '') {
        try {
            // Recipients
            $this->mail->clearAddresses();
            $this->mail->addAddress($toEmail, $toName);

            // Content
            $this->mail->isHTML(true);
            $this->mail->Subject = $subject;
            $this->mail->Body    = $htmlBody;
            $this->mail->AltBody = $altBody ? $altBody : strip_tags($htmlBody);

            $this->mail->send();
            return true;
        } catch (Exception $e) {
            error_log("Message could not be sent. Mailer Error: {$this->mail->ErrorInfo}");
            return false;
        }
    }

    /**
     * Helper to render a PHP template into a string
     */
    private function renderTemplate($templateName, $data = []) {
        $templatePath = __DIR__ . '/../emails/' . $templateName . '.php';
        if (!file_exists($templatePath)) {
            throw new MailerException("Email template not found: {$templateName}");
        }

        // Extract variables to be available in the template scope
        extract($data);

        // Capture template output
        ob_start();
        include_once $templatePath; // NOSONAR
        return ob_get_clean();
    }

    /**
     * Send Verification Email
     */
    public function sendVerificationEmail($toEmail, $toName, $token) {
        $subject = "Szia! Üdvözlünk a fedélzeten! 🎉 Kérjük, igazold vissza az email címedet.";
        
        $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http';
        $host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'neolix.studio';
        $verifyUrl = "{$protocol}://{$host}/dashboard.html?verify={$token}";
        
        $htmlBody = $this->renderTemplate('verify', [
            'name' => $toName,
            'verifyUrl' => $verifyUrl
        ]);

        return $this->send($toEmail, $toName, $subject, $htmlBody);
    }
}
