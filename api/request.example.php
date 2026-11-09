<?php
/**
 * Пример обработчика заявки для обычного PHP-хостинга.
 *
 * Сайт сам его не вызывает. Чтобы подключить:
 * 1. Скопируйте файл в api/request.php.
 * 2. Впишите реальный адрес в $recipient.
 * 3. В js/config.js укажите formEndpoint: "api/request.php".
 *
 * Пока адрес не заменён, обработчик отвечает ошибкой и не пишет «заявка отправлена».
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

$recipient = 'ЗАМЕНИТЕ_НА_ПОЧТУ';

function reply(int $status, bool $ok, string $error = ''): void
{
    http_response_code($status);
    echo json_encode(
        $ok ? ['ok' => true] : ['ok' => false, 'error' => $error],
        JSON_UNESCAPED_UNICODE
    );
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    reply(405, false, 'Нужен метод POST.');
}

if ($recipient === 'ЗАМЕНИТЕ_НА_ПОЧТУ' || !filter_var($recipient, FILTER_VALIDATE_EMAIL)) {
    reply(503, false, 'В обработчике не указан адрес получателя.');
}

if (!empty($_POST['website'])) {
    reply(400, false, 'Заявка отклонена.');
}

function field(string $key, int $max): string
{
    $value = isset($_POST[$key]) ? trim((string) $_POST[$key]) : '';
    $value = str_replace(["\r\n", "\r"], "\n", $value);
    if (mb_strlen($value) > $max) {
        $value = mb_substr($value, 0, $max);
    }
    return $value;
}

$name = field('name', 80);
$phone = field('phone', 40);
$email = field('email', 120);
$direction = field('direction', 120);
$message = field('message', 4000);

if (mb_strlen($name) < 2 || !preg_match('/\d{10,15}/', preg_replace('/\D+/', '', $phone) ?? '')) {
    reply(422, false, 'Проверьте имя и телефон.');
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $direction === '' || mb_strlen($message) < 10) {
    reply(422, false, 'Проверьте почту, направление и описание задачи.');
}

$allowed = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf', 'dwg', 'dxf'];
$attachments = [];

if (!empty($_FILES['files']) && is_array($_FILES['files']['name'])) {
    $count = count($_FILES['files']['name']);
    if ($count > 4) {
        reply(422, false, 'Можно прикрепить не больше 4 файлов.');
    }

    for ($i = 0; $i < $count; $i++) {
        if ($_FILES['files']['error'][$i] === UPLOAD_ERR_NO_FILE) {
            continue;
        }
        if ($_FILES['files']['error'][$i] !== UPLOAD_ERR_OK) {
            reply(422, false, 'Один из файлов не загрузился.');
        }
        $size = (int) $_FILES['files']['size'][$i];
        $original = (string) $_FILES['files']['name'][$i];
        $ext = strtolower(pathinfo($original, PATHINFO_EXTENSION));
        if ($size > 10 * 1024 * 1024 || !in_array($ext, $allowed, true)) {
            reply(422, false, 'Файл больше 10 МБ или его формат не поддерживается.');
        }
        $saved = tempnam(sys_get_temp_dir(), 'lead');
        if ($saved === false || !move_uploaded_file($_FILES['files']['tmp_name'][$i], $saved)) {
            reply(500, false, 'Не удалось принять файл.');
        }
        $attachments[] = ['path' => $saved, 'name' => $original];
    }
}

$bodyText = "Имя: {$name}\nТелефон: {$phone}\nПочта: {$email}\nНаправление: {$direction}\n\n{$message}\n";
$subject = 'Заявка с сайта';
$fromDomain = preg_replace('/^www\./', '', (string) ($_SERVER['SERVER_NAME'] ?? 'localhost'));
$from = 'no-reply@' . $fromDomain;
$encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';

$headers = [
    'MIME-Version: 1.0',
    'From: ' . $from,
    'Reply-To: ' . $email,
];

if ($attachments) {
    $boundary = 'lead_' . bin2hex(random_bytes(8));
    $headers[] = 'Content-Type: multipart/mixed; boundary="' . $boundary . '"';
    $body = "--{$boundary}\r\n";
    $body .= "Content-Type: text/plain; charset=UTF-8\r\n";
    $body .= "Content-Transfer-Encoding: base64\r\n\r\n";
    $body .= chunk_split(base64_encode($bodyText));
    foreach ($attachments as $file) {
        $content = file_get_contents($file['path']);
        $safeName = str_replace(["\r", "\n", '"'], '', $file['name']);
        $body .= "--{$boundary}\r\n";
        $body .= "Content-Type: application/octet-stream; name=\"{$safeName}\"\r\n";
        $body .= "Content-Transfer-Encoding: base64\r\n";
        $body .= "Content-Disposition: attachment; filename=\"{$safeName}\"\r\n\r\n";
        $body .= chunk_split(base64_encode($content === false ? '' : $content));
        @unlink($file['path']);
    }
    $body .= "--{$boundary}--";
} else {
    $headers[] = 'Content-Type: text/plain; charset=UTF-8';
    $headers[] = 'Content-Transfer-Encoding: base64';
    $body = chunk_split(base64_encode($bodyText));
}

$sent = mail($recipient, $encodedSubject, $body, implode("\r\n", $headers));

if (!$sent) {
    reply(502, false, 'Почтовая функция хостинга не приняла письмо.');
}

reply(200, true);
