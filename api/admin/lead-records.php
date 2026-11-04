<?php
if (!defined('DB_NAME')) { http_response_code(404); exit; }
// Admin-only write contracts. Website forms continue using their existing endpoints.
function lead_text($data, $key, $max, $required = false) {
    $value = $data[$key] ?? '';
    if (!is_scalar($value) && $value !== null) throw new InvalidArgumentException('Enter text for ' . $key . '.');
    $value = trim((string)$value);
    $length = preg_match_all('/./us', $value);
    if ($length === false || ($required && $value === '') || $length > $max || ($max >= 20000 && strlen($value) > 65000)) throw new InvalidArgumentException('Check ' . $key . ' (maximum ' . $max . ' characters).');
    return $value;
}
function lead_days($value) {
    if (filter_var($value, FILTER_VALIDATE_INT) === false || (int)$value < 1 || (int)$value > 3650) throw new InvalidArgumentException('Duration must be between 1 and 3,650 whole days.');
    return (int)$value;
}
function lead_date($value) {
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
    if (!$date || $date->format('Y-m-d') !== $value) throw new InvalidArgumentException('Enter a valid booking start date.');
    return $date;
}
function lead_media($assets) {
    if (!is_array($assets) || count($assets) > 12) throw new InvalidArgumentException('Attach up to 12 campaign media files or links.');
    $media = [];
    foreach ($assets as $asset) {
        if (!is_array($asset)) throw new InvalidArgumentException('Invalid media attachment.');
        $url = lead_text($asset, 'url', 500, true);
        if (!(preg_match('#^https?://[^\s]+$#i', $url) && filter_var($url,FILTER_VALIDATE_URL)) && !preg_match('#^/uploads/[a-f0-9]{32}\.(jpg|png|webp|gif|mp4|mov)$#', $url)) throw new InvalidArgumentException('Upload campaign media or use an HTTP(S) media link.');
        if (preg_match('/[\x00-\x1f<>"\']/', $url)) throw new InvalidArgumentException('Invalid media link.');
        if ($url[0] === '/' && !is_file(__DIR__ . '/../..' . $url)) throw new InvalidArgumentException('An attached upload no longer exists. Upload it again.');
        $media[] = ['url'=>$url, 'name'=>lead_text($asset,'name',180) ?: 'Campaign media'];
    }
    return $media;
}
function lead_write_record($pdo, $type, $input, $id = 0) {
    $tables = ['led'=>'led_leads','activation'=>'activation_leads','contact'=>'contact_leads'];
    if (!isset($tables[$type])) throw new InvalidArgumentException('Choose LED, activation or contact inquiry.');
    $table = $tables[$type];
    $old = [];
    if ($id) {
        $stmt = $pdo->prepare("SELECT * FROM `$table` WHERE id = ? FOR UPDATE"); $stmt->execute([$id]); $old = $stmt->fetch();
        if (!$old) { $pdo->rollBack(); json_response(['success'=>false,'error'=>'Record no longer exists. Refresh and try again.'],404); }
    }
    $metaType = $type . '_lead';
    $meta = $id ? metadata_get($pdo, $metaType, $id) : [];
    $aliases = ['businessName'=>'business_name','contactName'=>'contact_name','companyName'=>'company_name','packageRequested'=>'package_requested','durationRequested'=>'duration_requested','durationMonths'=>'duration_code','slotLength'=>'slot_length','cost'=>'estimated_cost_kes','activationType'=>'activation_type','bookingStartDate'=>'booking_start_date','durationDays'=>'duration_days','concept'=>'concept_description'];
    $data = $old;
    foreach ($aliases as $key=>$column) if (array_key_exists($column,$old)) $data[$key] = $old[$column];
    $data = array_merge($data, $meta, $input);
    $status = lead_text($data,'status',30) ?: 'new';
    $statuses = ['new','contacted','won','lost','in-progress','in_progress','reviewed','quoted','approved','confirmed','completed','closed','rejected','cancelled'];
    if (!in_array($status,$statuses,true)) throw new InvalidArgumentException('Choose a valid inquiry status.');
    $email = lead_text($data,'email',200); $phone = lead_text($data,'phone',30);
    if ($email !== '' && !filter_var($email,FILTER_VALIDATE_EMAIL)) throw new InvalidArgumentException('Enter a valid email address.');
    if ($email === '' && $phone === '') throw new InvalidArgumentException('Enter a phone number or email address so the client can be contacted.');
    $fields = ['email'=>$email,'phone'=>$phone,'status'=>$status,'admin_notes'=>lead_text($data,'admin_notes',20000)];
    if ($type === 'contact') {
        $fields += ['name'=>lead_text($data,'name',150,true),'subject'=>lead_text($data,'subject',100,true),'message'=>lead_text($data,'message',20000,true)];
    } elseif ($type === 'activation') {
        $days = lead_days($data['durationDays'] ?? 1); $start = lead_date(lead_text($data,'bookingStartDate',10,true));
        $end = $start->modify('+' . ($days-1) . ' days')->format('Y-m-d');
        if (strlen($end) !== 10) throw new InvalidArgumentException('Booking end date is outside the supported range.');
        $fields += ['company_name'=>lead_text($data,'companyName',200,true),'contact_name'=>lead_text($data,'contactName',150,true),'activation_type'=>lead_text($data,'activationType',120,true),'booking_start_date'=>$start->format('Y-m-d'),'duration_days'=>$days,'booking_end_date'=>$end,'concept_description'=>lead_text($data,'concept',20000,true)];
    } else {
        $fields += ['business_name'=>lead_text($data,'businessName',200,true),'contact_name'=>lead_text($data,'contactName',150,true),'package_requested'=>lead_text($data,'packageRequested',120,true),'slot_length'=>lead_text($data,'slotLength',80),'notes'=>lead_text($data,'notes',20000)];
        // Preserve online estimator durations/prices when staff only change status or notes.
        $fields['duration_requested'] = $old['duration_requested'] ?? '1 Day';
        $fields['duration_code'] = $old['duration_code'] ?? 'custom';
        $fields['estimated_cost_kes'] = $old['estimated_cost_kes'] ?? 0;
        $fields['estimated_cost_vat'] = $old['estimated_cost_vat'] ?? 0;
        $fields['estimated_cost_total'] = $old['estimated_cost_total'] ?? 0;
        if (array_key_exists('durationDays',$input) || !$id) {
            $days = lead_days($data['durationDays'] ?? 1);
            $meta['durationDays'] = $days;
            $fields['duration_requested'] = $days . ($days === 1 ? ' Day' : ' Days');
            $fields['duration_code'] = 'custom';
        }
        if (array_key_exists('campaignStartDate',$input) || array_key_exists('durationDays',$input) || !$id) {
            $start = lead_text($data,'campaignStartDate',10);
            $meta['campaignStartDate'] = $start;
            $meta['campaignEndDate'] = $start !== '' ? lead_date($start)->modify('+' . (($meta['durationDays'] ?? 1)-1) . ' days')->format('Y-m-d') : '';
            if (strlen($meta['campaignEndDate']) > 10) throw new InvalidArgumentException('Campaign end date is outside the supported range.');
        }
        if (array_key_exists('cost',$input) || !$id) {
            if (!is_scalar($data['cost'] ?? 0) || !is_numeric($data['cost'] ?? 0)) throw new InvalidArgumentException('Enter a valid campaign amount.');
            $amount = round((float)($data['cost'] ?? 0),2);
            if (!is_finite($amount) || $amount < 0 || $amount > 8000000000) throw new InvalidArgumentException('Campaign amount is outside the supported range.');
            $fields['estimated_cost_kes'] = $amount; $fields['estimated_cost_vat'] = round($amount*0.16,2); $fields['estimated_cost_total'] = $amount + $fields['estimated_cost_vat'];
        }
        if (array_key_exists('mediaAssets',$input)) $meta['mediaAssets'] = lead_media($input['mediaAssets']);
        if (array_key_exists('referralCompany',$input)) $meta['referralCompany'] = lead_text($input,'referralCompany',200);
    }
    if ($id) {
        $sets = implode(', ',array_map(function($column){return "`$column` = ?";},array_keys($fields)));
        $stmt=$pdo->prepare("UPDATE `$table` SET $sets WHERE id = ?");$stmt->execute(array_merge(array_values($fields),[$id]));
    } else {
        $fields['ref_code'] = strtoupper($type === 'activation' ? 'ACT' : ($type === 'contact' ? 'CNT' : 'LED')) . '-' . strtoupper(bin2hex(random_bytes(10)));
        $columns=implode('`,`',array_keys($fields));$marks=implode(',',array_fill(0,count($fields),'?'));
        $stmt=$pdo->prepare("INSERT INTO `$table` (`$columns`) VALUES ($marks)");$stmt->execute(array_values($fields));$id=(int)$pdo->lastInsertId();
        $meta['source']='admin';$meta['createdBy']=(int)$_SESSION['admin_user']['id'];$meta['createdAt']=date('c');
    }
    $meta['updatedBy']=(int)$_SESSION['admin_user']['id'];
    metadata_save($pdo,$metaType,$id,$meta);
    log_activity($pdo,$_SESSION['admin_user']['id'],$old ? 'edit_lead' : 'create_lead',$table,$id,'Saved ' . $type . ' inquiry');
    return $id;
}
