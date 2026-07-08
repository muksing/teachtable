-- Award behavior points automatically when a student checks in, based on
-- schools.settings.checkin_config.auto_points_enabled / auto_points_amount.
-- Re-reads the config server-side (not from client input) and is idempotent
-- per student per day via the auto_checkin source_type check.
create or replace function award_checkin_points(
  p_school_id uuid,
  p_student_code text,
  p_class_id text,
  p_date date default (now() at time zone 'Asia/Bangkok')::date
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings jsonb;
  v_cfg jsonb;
  v_enabled boolean;
  v_amount integer;
  v_term text;
  v_carry numeric;
  v_general numeric;
  v_attend numeric;
  v_learning numeric;
  v_new_general numeric;
  v_new_total numeric;
  v_already boolean;
begin
  select settings into v_settings from schools where id = p_school_id;
  if v_settings is null then
    return null;
  end if;

  v_cfg := coalesce(v_settings->'checkin_config', '{}'::jsonb);
  v_enabled := coalesce((v_cfg->>'auto_points_enabled')::boolean, false);
  v_amount := coalesce((v_cfg->>'auto_points_amount')::integer, 0);
  if not v_enabled or v_amount = 0 then
    return null;
  end if;

  v_term := coalesce(v_settings->>'current_term', '2568_1');

  select exists(
    select 1 from behavior_logs
    where school_id = p_school_id and student_id = p_student_code
      and date = p_date and source_type = 'auto_checkin'
  ) into v_already;
  if v_already then
    return null;
  end if;

  select behavior_carry_over, general_behavior_score, attendance_behavior_score, learning_behavior_score
    into v_carry, v_general, v_attend, v_learning
    from students where student_code = p_student_code and school_id = p_school_id;

  v_new_general := coalesce(v_general, 0) + v_amount;
  v_new_total := coalesce(v_carry, 0) + v_new_general + coalesce(v_attend, 0) + coalesce(v_learning, 0);

  insert into behavior_logs (
    term_id, student_id, class_id, recorded_by, recorded_by_name_snapshot,
    source_type, source_id, behavior_type, behavior_type_label_snapshot,
    label_snapshot, points_change, score_after, note, image_urls,
    school_id, date, created_at
  ) values (
    v_term, p_student_code, p_class_id, null, 'ระบบเช็คอิน (อัตโนมัติ)',
    'auto_checkin', null, 'general', 'ความประพฤติทั่วไป',
    'เช็คอินเข้าโรงเรียน', v_amount, v_new_general, 'เช็คอินเข้าโรงเรียนตรงเวลา', '[]'::jsonb,
    p_school_id, p_date, now()
  );

  update students set general_behavior_score = v_new_general, total_behavior_score = v_new_total
    where student_code = p_student_code and school_id = p_school_id;

  return v_amount;
end;
$$;

grant execute on function award_checkin_points(uuid, text, text, date) to anon, authenticated;
