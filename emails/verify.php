<?php
$name = $name ?? 'Felhasználó';
$verifyUrl = $verifyUrl ?? '#';
?>
<!DOCTYPE html>
<html lang="hu">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email cím megerősítése</title>
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
            background-color: #18181b; /* Dark theme to match site header */
            padding: 30px 20px;
            text-align: center;
            border-bottom: 3px solid #10b981; /* Green accent */
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
            background-color: #2563eb; /* Primary button blue */
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
            
            <p>Nagyon örülünk, hogy csatlakoztál hozzánk! Már csak egyetlen apró lépés választ el attól, hogy belevágj az angol tanulásba, a saját tempódban.</p>
            
            <p>Kérjük, kattints az alábbi gombra az email címed megerősítéséhez, és már kezdhetjük is:</p>
            
            <div style="text-align: center;">
                <a href="<?php echo htmlspecialchars($verifyUrl); ?>" class="btn">Email cím megerősítése</a>
            </div>
            
            <p style="font-size: 13px; margin-top: 30px;">
                <em>Ha a gomb nem működik, másold be ezt a linket a böngésződbe:</em><br>
                <a href="<?php echo htmlspecialchars($verifyUrl); ?>" style="color: #2563eb; word-break: break-all;"><?php echo htmlspecialchars($verifyUrl); ?></a>
            </p>
            
            <p>Készen állsz a tanulásra? Vágjunk bele!</p>
            
            <p><strong>Jó tanulást kíván,<br>A Neolix Studio Csapata</strong></p>
        </div>
        <div class="footer">
            <p>Tento e-mail bol vygenerovaný automaticky, prosím, neodpovedajte naň. Ak potrebujete pomoc, kontaktujte nás na webe.</p>
            <p>&copy; <?php echo date('Y'); ?> Neolix Studio. Minden jog fenntartva.</p>
        </div>
    </div>
</body>
</html>
