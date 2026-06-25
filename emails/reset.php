<?php
$name = $name ?? 'Felhasználó';
$resetUrl = $resetUrl ?? '#';
?>
<!DOCTYPE html>
<html lang="hu">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Új jelszó beállítása</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #f4f4f5;
            margin: 0;
            padding: 0;
            -webkit-font-smoothing: antialiased;
        }
        .container {
            max-width: 600px;
            margin: 40px auto;
            background-color: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0,0,0,0.05);
        }
        .header {
            background-color: #18181b;
            padding: 30px 20px;
            text-align: center;
            border-bottom: 3px solid #ef4444; /* Red accent for security actions */
        }
        .header h1 {
            color: #ffffff;
            margin: 0;
            font-size: 24px;
            font-weight: 600;
        }
        .content {
            padding: 40px 30px;
            color: #3f3f46;
            line-height: 1.6;
        }
        .content h2 {
            color: #18181b;
            margin-top: 0;
        }
        .btn {
            display: inline-block;
            background-color: #ef4444; /* Red button for reset */
            color: #ffffff !important;
            text-decoration: none;
            padding: 14px 28px;
            border-radius: 6px;
            font-weight: 600;
            margin: 20px 0;
            text-align: center;
        }
        .footer {
            background-color: #f4f4f5;
            padding: 20px 30px;
            text-align: center;
            font-size: 12px;
            color: #71717a;
            border-top: 1px solid #e4e4e7;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Neolix Studio</h1>
        </div>
        <div class="content">
            <h2>Szia <?php echo htmlspecialchars($name); ?>,</h2>
            
            <p>Semmi gond, mindenkivel megesik! Kaptunk egy kérést, hogy elfelejtetted a jelszavadat. Új jelszó beállításához egyszerűen kattints az alábbi gombra:</p>
            
            <div style="text-align: center;">
                <a href="<?php echo htmlspecialchars($resetUrl); ?>" class="btn">Új jelszó beállítása</a>
            </div>
            
            <p style="font-size: 13px; margin-top: 30px;">
                <em>Ez a link 1 órán keresztül érvényes a biztonságod érdekében. Ha a gomb nem működik, másold be ezt a linket a böngésződbe:</em><br>
                <a href="<?php echo htmlspecialchars($resetUrl); ?>" style="color: #ef4444; word-break: break-all;"><?php echo htmlspecialchars($resetUrl); ?></a>
            </p>
            
            <p><strong>Ha nem te kérted a jelszó visszaállítását, nyugodtan hagyd figyelmen kívül ezt az emailt, a fiókod biztonságban van.</strong></p>
            
            <p>Üdvözlettel,<br>A Neolix Studio Csapata</p>
        </div>
        <div class="footer">
            <p>Tento e-mail bol vygenerovaný automaticky, prosím, neodpovedajte naň. Ak potrebujete pomoc, kontaktujte nás na webe.</p>
            <p>&copy; <?php echo date('Y'); ?> Neolix Studio. Minden jog fenntartva.</p>
        </div>
    </div>
</body>
</html>
