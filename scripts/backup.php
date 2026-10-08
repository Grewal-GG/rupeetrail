<?php
declare(strict_types=1);
require dirname(__DIR__).'/src/database.php';
$destination=$argv[1]??null;
if (!$destination || file_exists($destination)) {fwrite(STDERR,"Usage: php scripts/backup.php /absolute/path/new-backup.sqlite\n");exit(1);}
$db=database();$db->exec('VACUUM INTO '.$db->quote($destination));echo "Consistent backup created.\n";
