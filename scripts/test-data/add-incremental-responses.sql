-- 미응답 대상자에게 점진적으로 응답 추가하는 스크립트
-- 사용법: v_add_count 변수를 원하는 숫자로 변경 (1, 10, 100, 1000 등)

DO $$
DECLARE
    v_survey_id UUID;
    v_add_count INTEGER := 100; -- ★ 여기를 원하는 숫자로 변경하세요 (1, 10, 100, 1000 등)
    v_added_count INTEGER := 0;
    v_objective_count INTEGER;
    v_subjective_count INTEGER;
    v_before_completed INTEGER;
    v_after_completed INTEGER;
BEGIN
    -- 설문지 ID 가져오기 (가장 최근 설문지)
    SELECT id INTO v_survey_id 
    FROM surveys 
    ORDER BY created_at DESC 
    LIMIT 1;
    
    IF v_survey_id IS NULL THEN
        RAISE EXCEPTION '설문지가 존재하지 않습니다.';
    END IF;
    
    -- 현재 완료된 참여자 수 확인
    SELECT COUNT(*) INTO v_before_completed
    FROM survey_participants
    WHERE survey_id = v_survey_id AND is_completed = true;
    
    RAISE NOTICE '=== 응답 추가 시작 ===';
    RAISE NOTICE '설문지 ID: %', v_survey_id;
    RAISE NOTICE '추가할 응답자 수: %명', v_add_count;
    RAISE NOTICE '현재 완료된 응답자: %명', v_before_completed;
    
    -- 객관식 문항 수 확인
    SELECT COUNT(*) INTO v_objective_count
    FROM survey_questions
    WHERE survey_id = v_survey_id AND question_type = 'objective';
    
    -- 주관식 문항 수 확인
    SELECT COUNT(*) INTO v_subjective_count
    FROM survey_questions
    WHERE survey_id = v_survey_id AND question_type = 'subjective';
    
    RAISE NOTICE '객관식 문항: %개 (필수)', v_objective_count;
    RAISE NOTICE '주관식 문항: %개 (선택)', v_subjective_count;
    
    -- UPSERT에서 INSERT로 변경 - 이미 응답이 있으면 건너뛰기
    -- 1. 미응답 참여자 중 지정된 수만큼 선택하여 객관식 응답 생성
    WITH selected_participants AS (
        SELECT token
        FROM survey_participants
        WHERE survey_id = v_survey_id 
        AND is_completed = false
        LIMIT v_add_count
    ),
    objective_questions AS (
        SELECT id
        FROM survey_questions
        WHERE survey_id = v_survey_id 
        AND question_type = 'objective'
    )
    INSERT INTO survey_responses (
        participant_token,
        question_id,
        response_value,
        response_text
    )
    SELECT 
        sp.token,
        oq.id,
        floor(random() * 5 + 1)::INTEGER, -- 1-5 랜덤 점수
        NULL
    FROM selected_participants sp
    CROSS JOIN objective_questions oq
    ON CONFLICT (participant_token, question_id) 
    DO NOTHING; -- 기존 응답이 있으면 건너뛰기 (덮어쓰지 않음)
    
    GET DIAGNOSTICS v_added_count = ROW_COUNT;
    RAISE NOTICE '객관식 응답 추가: %개 레코드', v_added_count;
    
    -- 2. 같은 참여자들에게 주관식 응답 생성 (100% 응답으로 테스트)
    WITH selected_participants AS (
        SELECT token
        FROM survey_participants
        WHERE survey_id = v_survey_id 
        AND is_completed = false
        LIMIT v_add_count
    ),
    subjective_questions AS (
        SELECT id
        FROM survey_questions
        WHERE survey_id = v_survey_id 
        AND question_type = 'subjective'
    ),
    random_texts AS (
        SELECT ARRAY[
            '매우 만족스러운 경험이었습니다.',
            '서비스 품질이 우수했습니다.',
            '직원분들이 친절하게 응대해주셨습니다.',
            '시설이 깨끗하고 쾌적했습니다.',
            '대기 시간이 적절했습니다.',
            '전문적인 상담을 받을 수 있었습니다.',
            '다음에도 이용하고 싶습니다.',
            '주변에 추천하고 싶습니다.',
            '전반적으로 만족스러웠습니다.',
            '개선이 필요한 부분도 있지만 대체로 좋았습니다.'
        ] AS texts
    )
    INSERT INTO survey_responses (
        participant_token,
        question_id,
        response_value,
        response_text
    )
    SELECT 
        sp.token,
        sq.id,
        NULL,
        (SELECT texts[floor(random() * 10 + 1)::INTEGER] FROM random_texts)
    FROM selected_participants sp
    CROSS JOIN subjective_questions sq
    ON CONFLICT (participant_token, question_id) 
    DO NOTHING; -- 기존 응답이 있으면 건너뛰기 (덮어쓰지 않음)
    
    GET DIAGNOSTICS v_added_count = ROW_COUNT;
    RAISE NOTICE '주관식 응답 추가: %개 레코드', v_added_count;
    
    -- 완료 상태 업데이트 로직 개선
    -- 3. 완료 상태 업데이트 (모든 필수 문항에 응답한 참여자)
    WITH participant_response_counts AS (
        SELECT 
            sr.participant_token,
            COUNT(DISTINCT CASE WHEN sq.question_type = 'objective' THEN sq.id END) as objective_answered
        FROM survey_responses sr
        JOIN survey_questions sq ON sr.question_id = sq.id
        WHERE sq.survey_id = v_survey_id
        GROUP BY sr.participant_token
    )
    UPDATE survey_participants sp
    SET is_completed = true
    FROM participant_response_counts prc
    WHERE sp.token = prc.participant_token
    AND sp.survey_id = v_survey_id
    AND prc.objective_answered >= v_objective_count
    AND sp.is_completed = false;
    
    GET DIAGNOSTICS v_added_count = ROW_COUNT;
    RAISE NOTICE '완료 상태 업데이트: %명', v_added_count;
    
    -- 최종 완료된 참여자 수 확인
    SELECT COUNT(*) INTO v_after_completed
    FROM survey_participants
    WHERE survey_id = v_survey_id AND is_completed = true;
    
    RAISE NOTICE '';
    RAISE NOTICE '=== 응답 추가 완료 ===';
    RAISE NOTICE '이전 완료 응답자: %명', v_before_completed;
    RAISE NOTICE '현재 완료 응답자: %명', v_after_completed;
    RAISE NOTICE '추가된 응답자: %명', v_after_completed - v_before_completed;
    
END $$;
