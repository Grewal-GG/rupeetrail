<?php
require dirname(__DIR__).'/src/database.php';
function check(bool $condition,string $message):void {if(!$condition)throw new RuntimeException($message);}
$base=['denomination'=>100,'serial'=>' 0ab 001234 ','seen_at'=>'2026-01-01T12:00'];
$result=validateEncounter($base);check($result['serial']==='0AB001234','Normalization must preserve leading zeros.');
check(str_ends_with($result['seen_at'],'+05:30'),'Encounter timezone must be explicit.');
foreach ([['serial'=>'<script>'],['denomination'=>42],['seen_at'=>'2026-02-30T10:00'],['year'=>'abcd'],['context'=>str_repeat('x',501)]] as $bad) {try {validateEncounter(array_replace($base,$bad));throw new RuntimeException('Invalid input accepted.');}catch(InvalidArgumentException $expected){}}
echo "Validation checks passed.\n";
