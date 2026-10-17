<?php
// Preview and merge historical exports without deleting or renumbering live rows.
require_once __DIR__ . '/../config.php';
$user = authorize_resource('backup');
if ($user['role'] !== 'superadmin') json_response(['success'=>false,'error'=>'Only a super administrator can merge historical data.'],403);
if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_response(['success'=>false,'error'=>'POST required'],405);
$input = get_json_input();
$data = $input['data'] ?? null;
if (!is_array($data)) json_response(['success'=>false,'error'=>'Choose a valid content export.'],422);
$dryRun = ($input['dry_run'] ?? true) !== false;
$pdo = get_db_connection();
$report = [];
$specs = [
    'shops'=>['stores',['name'=>['name'],'unit_number'=>['room','unit_number'],'floor'=>['floor'],'category'=>['category'],'phone'=>['phone'],'email'=>['email'],'website'=>['website','socialMediaUrl'],'description'=>['description'],'logo_url'=>['logoUrl','logo_url','logo'],'sort_order'=>['sort_order','sortOrder']],['unit_number']],
    'events'=>['events',['title'=>['title'],'venue'=>['venue'],'event_date'=>['event_date','eventDate','date'],'event_end_date'=>['event_end_date'],'description'=>['details','summary','description'],'image_url'=>['imageUrl','image_url','photo'],'status'=>['status','type']],['title','event_date']],
    'blog'=>['blog_posts',['title'=>['title'],'slug'=>['slug'],'excerpt'=>['excerpt'],'body'=>['body','content'],'author'=>['author'],'published_date'=>['published_date','date'],'image_url'=>['imageUrl','image_url','image'],'status'=>['status']],['slug']],
    'reviews'=>['reviews',['reviewer_name'=>['reviewer_name','author','name'],'reviewer_email'=>['reviewer_email','email'],'store_name_typed'=>['store_name_typed','store'],'rating'=>['rating'],'review_text'=>['review_text','quote','comment'],'status'=>['status'],'admin_notes'=>['admin_notes']],['reviewer_name','review_text']],
    'gallery'=>['gallery',['title'=>['title'],'image_url'=>['imageUrl','image_url','url'],'category'=>['category'],'caption'=>['caption'],'sort_order'=>['sortOrder','sort_order']],['image_url']],
    'contactLeads'=>['contact_leads',['name'=>['name'],'email'=>['email'],'phone'=>['phone'],'subject'=>['subject'],'message'=>['message'],'status'=>['status'],'admin_notes'=>['admin_notes'],'ref_code'=>['ref_code']],['ref_code']],
    'ledLeads'=>['led_leads',['business_name'=>['businessName','business_name','company'],'contact_name'=>['contactName','contact_name','name'],'email'=>['email'],'phone'=>['phone'],'package_requested'=>['packageRequested','package_requested','package'],'duration_requested'=>['durationRequested','duration_requested','duration'],'duration_code'=>['duration_code','durationMonths'],'slot_length'=>['slotLength','slot_length'],'estimated_cost_total'=>['estimated_cost_total','cost','estimatedCost'],'estimated_cost_kes'=>['estimated_cost_kes'],'estimated_cost_vat'=>['estimated_cost_vat'],'notes'=>['notes','message'],'status'=>['status'],'admin_notes'=>['admin_notes'],'ref_code'=>['ref_code']],['ref_code']],
    'activationLeads'=>['activation_leads',['company_name'=>['companyName','company_name','company'],'contact_name'=>['contactName','contact_name','applicant'],'email'=>['email'],'phone'=>['phone'],'activation_type'=>['activationType','activation_type','type'],'booking_start_date'=>['bookingStartDate','booking_start_date','startDate'],'duration_days'=>['durationDays','duration_days','duration'],'concept_description'=>['concept_description','concept','message'],'status'=>['status'],'admin_notes'=>['admin_notes'],'ref_code'=>['ref_code']],['ref_code']],
    'playonBookings'=>['playon_bookings',['parent_name'=>['parent_name','name'],'phone'=>['phone'],'email'=>['email'],'booking_type'=>['booking_type','bookingType'],'booking_date'=>['booking_date','bookingStartDate'],'session_time'=>['session_time','session'],'child_count'=>['child_count','kids'],'adult_count'=>['adult_count','adults'],'estimated_total_kes'=>['estimated_total_kes'],'special_requests'=>['special_requests','message'],'status'=>['status'],'admin_notes'=>['admin_notes'],'ref_code'=>['ref_code']],['ref_code']]
];
if (isset($data['stores']) && !isset($data['shops'])) $data['shops'] = $data['stores'];
if (isset($data['blogPosts']) && !isset($data['blog'])) $data['blog'] = $data['blogPosts'];
$pdo->beginTransaction();
foreach ($specs as $group => $spec) {
    if (!isset($data[$group])) continue;
    if (!is_array($data[$group]) || count($data[$group]) > 10000) throw new InvalidArgumentException('Invalid or oversized import group: ' . $group);
    [$table,$mapping,$natural] = $spec;
    $report[$group] = ['inserted'=>0,'updated'=>0];
    foreach ($data[$group] as $row) {
        if (!is_array($row)) throw new InvalidArgumentException('Invalid import record.');
        $values = [];
        foreach ($mapping as $column=>$aliases) foreach ($aliases as $alias) {
            if (array_key_exists($alias,$row)) { $values[$column] = $row[$alias]; break; }
        }
        if ($group === 'shops') {
            if (isset($values['floor'])) $values['floor']=['1st Floor'=>'First Floor','2nd Floor'=>'Second Floor','3rd Floor'=>'Third Floor','Basement'=>'Basement Parking'][$values['floor']] ?? $values['floor'];
            if (($values['category']??'')==='dining') $values['category']='food';
            if (isset($row['isActive'])) $values['status']=$row['isActive']?'active':'inactive';
            elseif(isset($row['status'])) $values['status']=$row['status'];
        }
        if ($group === 'events') {
            $date=$values['event_date']??'';
            if(strlen($date)===10){validate_date($date);$date.=' 10:00:00';}
            if(strtotime($date)===false)throw new InvalidArgumentException('Event date required.');
            $values['event_date']=date('Y-m-d H:i:s',strtotime($date));
            if (($values['status']??'')!=='cancelled' && substr($values['event_date'],0,10)<date('Y-m-d'))$values['status']='past';
        }
        if ($group === 'reviews' && isset($row['approved'])) $values['status']=$row['approved']?'approved':(($row['status']??'')==='rejected'?'rejected':'pending');
        if (isset($values['rating']) && ($values['rating']<1||$values['rating']>5)) throw new InvalidArgumentException('Review rating must be 1–5.');
        if (isset($values['email']))validate_email($values['email']);
        foreach(['logo_url','image_url'] as $column) if(!empty($values[$column])) {
            $values[$column]=preg_replace('#^(?:\.\./|\./)?assets/#','/assets/',$values[$column]);
            validate_media_url($values[$column]);
        }
        if ($group === 'ledLeads') {
            foreach(['estimated_cost_total','estimated_cost_kes','estimated_cost_vat'] as $column)if(isset($values[$column]))$values[$column]=(float)preg_replace('/[^0-9.]/','',(string)$values[$column]);
            if(isset($values['estimated_cost_total'])&&!isset($values['estimated_cost_kes'])){
                $values['estimated_cost_kes']=round($values['estimated_cost_total']/1.16,2);
                $values['estimated_cost_vat']=$values['estimated_cost_total']-$values['estimated_cost_kes'];
            }
        }
        if ($group==='activationLeads'&&isset($values['booking_start_date'])) {
            $date=validate_date($values['booking_start_date']);$days=(int)($values['duration_days']??1);
            if($days<1||$days>365)throw new InvalidArgumentException('Invalid activation duration.');
            $values['booking_end_date']=$date->modify('+'.($days-1).' days')->format('Y-m-d');
        }
        if ($group==='playonBookings'&&isset($values['booking_date']))validate_date($values['booking_date']);
        if (in_array($group,['contactLeads','ledLeads','activationLeads','playonBookings'])) {
            // A deterministic legacy key makes repeated merges idempotent.
            if(empty($values['ref_code']))$values['ref_code']='IMP-'.strtoupper(substr(hash('sha256',$group.':'.($row['id']??json_encode($values))),0,24));
        }
        $where=[];$params=[];
        foreach($natural as $column){if(!isset($values[$column])||$values[$column]==='')throw new InvalidArgumentException('Missing identity field: '.$group.'.'.$column);$where[]='`'.$column.'` = ?';$params[]=$values[$column];}
        $stmt=$pdo->prepare('SELECT id FROM `'.$table.'` WHERE '.implode(' AND ',$where).' FOR UPDATE');$stmt->execute($params);$matches=$stmt->fetchAll();
        if(count($matches)>1)throw new InvalidArgumentException('Ambiguous duplicate in '.$group.'. Resolve duplicate records before importing.');
        $id=$matches[0]['id']??null;
        if($id){
            $assignments=array_map(function($column){return '`'.$column.'`=?';},array_keys($values));
            $pdo->prepare('UPDATE `'.$table.'` SET '.implode(',',$assignments).' WHERE id=?')->execute(array_merge(array_values($values),[$id]));
            $report[$group]['updated']++;
        }else{
            $columns=array_keys($values);
            $pdo->prepare('INSERT INTO `'.$table.'` (`'.implode('`,`',$columns).'`) VALUES ('.implode(',',array_fill(0,count($values),'?')).')')->execute(array_values($values));
            $id=$pdo->lastInsertId();$report[$group]['inserted']++;
        }
        if(in_array($group,['shops','events','reviews'])){
            $type=$group==='shops'?'stores':$group;
            $meta=metadata_get($pdo,$type,$id);
            if($group==='shops' && isset($row['social']))$meta['socialHandle']=$row['social'];
            foreach(['eventTime','videoUrl','socialHandle','facebook','instagram','tiktok','photoFit'] as $field)if(isset($row[$field]))$meta[$field]=$row[$field];
            if($group==='reviews'&&isset($row['type']))$meta['reviewType']=$row['type'];
            if(isset($meta['videoUrl']))validate_media_url($meta['videoUrl']);
            metadata_save($pdo,$type,$id,$meta);
        }
        if(in_array($group,['shops','events'])){
            $photos=$row['photoUrls']??$row['photos']??null;
            if($photos!==null){
                if(!is_array($photos))throw new InvalidArgumentException('Photos must be an array.');
                $photoTable=$group==='shops'?'store_photos':'event_photos';$parent=$group==='shops'?'store_id':'event_id';
                $pdo->prepare('DELETE FROM '.$photoTable.' WHERE '.$parent.'=?')->execute([$id]);
                foreach($photos as $order=>$url){$url=preg_replace('#^(?:\.\./|\./)?assets/#','/assets/',$url);validate_media_url($url);$pdo->prepare('INSERT INTO '.$photoTable.' ('.$parent.',image_url,sort_order) VALUES (?,?,?)')->execute([$id,$url,$order]);}
            }
        }
    }
}
// Staff passwords/identities cannot be restored from browser exports.
if(isset($data['users']))$report['users']=['skipped'=>count($data['users']),'reason'=>'Manage staff accounts separately. Existing accounts and credentials are preserved.'];
if(isset($data['site'])&&is_array($data['site'])){
    $pdo->prepare('INSERT INTO site_settings (setting_key,payload) VALUES (?,?) ON DUPLICATE KEY UPDATE payload=VALUES(payload)')->execute(['homepage',json_encode($data['site'])]);
    $report['site']=['updated'=>1];
}
if($dryRun){$pdo->rollBack();}else{
    // Retain the complete original export, including legacy fields not mapped to SQL.
    $payload=json_encode($data,JSON_UNESCAPED_SLASHES);
    $pdo->prepare('INSERT IGNORE INTO legacy_imports (snapshot_hash,payload,imported_by) VALUES (?,?,?)')->execute([hash('sha256',$payload),$payload,$user['id']]);
    log_activity($pdo,$user['id'],'reconcile_data','database',null,$report);
    $pdo->commit();
}
json_response(['success'=>true,'dry_run'=>$dryRun,'report'=>$report]);
