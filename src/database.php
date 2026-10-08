<?php
declare(strict_types=1);
function database(): PDO {
    $path = getenv('DB_PATH') ?: dirname(__DIR__).'/data/rupeetrail.sqlite';
    if (!is_dir(dirname($path))) mkdir(dirname($path), 0700, true);
    $db = new PDO('sqlite:'.$path, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
    $db->exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;');
    $db->exec('CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY)');
    $db->exec('CREATE TABLE IF NOT EXISTS encounters(id INTEGER PRIMARY KEY AUTOINCREMENT, denomination INTEGER NOT NULL, serial TEXT NOT NULL, series TEXT NOT NULL DEFAULT "", year TEXT NOT NULL DEFAULT "", inset TEXT NOT NULL DEFAULT "", governor TEXT NOT NULL DEFAULT "", seen_at TEXT NOT NULL, context TEXT NOT NULL DEFAULT "")');
    $db->exec('CREATE INDEX IF NOT EXISTS note_lookup ON encounters(denomination, serial); INSERT OR IGNORE INTO schema_migrations VALUES(1)');
    return $db;
}
function validateEncounter(array $input): array {
    $serial = strtoupper(preg_replace('/\s+/', '', (string)($input['serial'] ?? '')));
    if (!preg_match('/^[A-Z0-9*]{6,16}$/', $serial)) throw new InvalidArgumentException('Enter the full serial and prefix: 6–16 letters, digits or *; keep leading zeros.');
    $denomination = (int)($input['denomination'] ?? 0);
    if (!in_array($denomination, [1,2,5,10,20,50,100,200,500,2000], true)) throw new InvalidArgumentException('Choose a denomination.');
    $date = DateTimeImmutable::createFromFormat('!Y-m-d\TH:i', (string)($input['seen_at'] ?? ''), new DateTimeZone('Asia/Kolkata'));
    if (!$date || $date->format('Y-m-d\TH:i') !== ($input['seen_at'] ?? '') || $date > new DateTimeImmutable('+5 minutes')) throw new InvalidArgumentException('Choose a valid encounter time, not a future date.');
    $out = ['denomination'=>$denomination, 'serial'=>$serial];
    foreach (['series'=>80,'year'=>4,'inset'=>8,'governor'=>80,'context'=>500] as $key=>$limit) {
        $value = trim((string)($input[$key] ?? ''));
        if (strlen($value)>$limit) throw new InvalidArgumentException('The '.$key.' field is too long.');
        $out[$key]=$value;
    }
    if ($out['year'] !== '' && !preg_match('/^(19|20)\d{2}$/', $out['year'])) throw new InvalidArgumentException('Enter a four-digit printing year.');
    $out['seen_at']=$date->format(DateTimeInterface::ATOM);
    return $out;
}
