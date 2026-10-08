<?php
declare(strict_types=1);
require dirname(__DIR__).'/src/database.php';
$sessionPath = dirname(getenv('DB_PATH') ?: dirname(__DIR__).'/data/rupeetrail.sqlite').'/sessions';
if (!is_dir($sessionPath)) mkdir($sessionPath,0700,true);
session_save_path($sessionPath);
session_set_cookie_params(['httponly'=>true,'samesite'=>'Strict','secure'=>(!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')]);
session_start();
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Content-Type: application/json; charset=utf-8');
try {
    $db=database();
    if ($_SERVER['REQUEST_METHOD']==='GET') {
        $_SESSION['csrf'] ??= bin2hex(random_bytes(32));
        $rows=$db->query('SELECT * FROM encounters ORDER BY seen_at DESC, id DESC')->fetchAll();
        if (isset($_GET['export'])) {
            $format=$_GET['export'];
            if ($format==='csv') {
                header('Content-Type: text/csv'); header('Content-Disposition: attachment; filename="rupeetrail.csv"');
                $f=fopen('php://output','w');$keys=['id','denomination','serial','series','year','inset','governor','seen_at','context']; fputcsv($f,$keys);
                foreach ($rows as $row) { $cells=[]; foreach($keys as $key) { $value=(string)$row[$key]; $cells[]=preg_match('/^[=+@\-\t\r]/',$value)?"'".$value:$value; } fputcsv($f,$cells); } fclose($f);exit;
            }
            header('Content-Disposition: attachment; filename="rupeetrail.json"'); echo json_encode($rows,JSON_THROW_ON_ERROR);exit;
        }
        echo json_encode(['encounters'=>$rows,'csrf'=>$_SESSION['csrf']],JSON_THROW_ON_ERROR);exit;
    }
    if ($_SERVER['REQUEST_METHOD']!=='POST') {http_response_code(405);exit;}
    if (!hash_equals($_SESSION['csrf'] ?? '',$_SERVER['HTTP_X_CSRF_TOKEN'] ?? '') || empty($_SESSION['csrf'])) {http_response_code(403); echo json_encode(['error'=>'Reload the page and try again.']);exit;}
    if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0)>8192) throw new InvalidArgumentException('Request too large.');
    $input=json_decode(file_get_contents('php://input'),true,32,JSON_THROW_ON_ERROR);
    $action=$input['action'] ?? 'add';
    if ($action==='delete') {$stmt=$db->prepare('DELETE FROM encounters WHERE id=?');$stmt->execute([(int)($input['id'] ?? 0)]);}
    elseif (in_array($action,['add','edit'],true)) {
        $row=validateEncounter($input);
        if ($action==='edit') {
            $row['id']=(int)($input['id'] ?? 0);$stmt=$db->prepare('UPDATE encounters SET denomination=:denomination, serial=:serial, series=:series, year=:year, inset=:inset, governor=:governor, seen_at=:seen_at, context=:context WHERE id=:id');
        } else {$stmt=$db->prepare('INSERT INTO encounters(denomination,serial,series,year,inset,governor,seen_at,context) VALUES(:denomination,:serial,:series,:year,:inset,:governor,:seen_at,:context)');}
        $stmt->execute($row);
    } else throw new InvalidArgumentException('Unknown action.');
    echo json_encode(['ok'=>true]);
} catch (InvalidArgumentException|JsonException $e) {http_response_code(422);echo json_encode(['error'=>$e->getMessage()]);}
catch (Throwable $e) {error_log($e->getMessage());http_response_code(500);echo json_encode(['error'=>'Storage unavailable. Check server logs and data-directory permissions.']);}
