DO $$
DECLARE
    v_survey_id INTEGER;
    v_batch_size INTEGER := 5000; -- 한 번에 처리할 참여자 수
    v_offset INTEGER := 0;
    v_total_participants INTEGER;
    v_processed INTEGER := 0;
    v_objective_questions INTEGER[];
    v_subjective_questions INTEGER[];
BEGIN
    -- 설문지 ID 가져오기 (가장 최근 설문지)
    SELECT id INTO v_survey_id 
    FROM surveys 
    ORDER BY created_at DESC 
    LIMIT 1;
    
    IF v_survey_id IS NULL THEN
        RAISE EXCEPTION '설문지를 찾을 수 없습니다.';
    END IF;
    
    RAISE NOTICE '설문지 ID: %', v_survey_id;
    
    -- 객관식 문항 ID 배열로 가져오기
    SELECT array_agg(id) INTO v_objective_questions
    FROM survey_questions
    WHERE survey_id = v_survey_id AND question_type = 'objective';
    
    -- 주관식 문항 ID 배열로 가져오기
    SELECT array_agg(id) INTO v_subjective_questions
    FROM survey_questions
    WHERE survey_id = v_survey_id AND question_type = 'subjective';
    
    RAISE NOTICE '객관식 문항: %, 주관식 문항: %', 
        array_length(v_objective_questions, 1), 
        array_length(v_subjective_questions, 1);
    
    -- 전체 참여자 수 확인
    SELECT COUNT(*) INTO v_total_participants
    FROM survey_participants
    WHERE survey_id = v_survey_id;
    
    RAISE NOTICE '전체 참여자 수: %', v_total_participants;
    RAISE NOTICE '배치 크기: % (총 % 배치)', v_batch_size, CEIL(v_total_participants::FLOAT / v_batch_size);
    RAISE NOTICE '처리 시작...';
    
    -- 배치 단위로 처리
    WHILE v_offset < v_total_participants LOOP
        -- 객관식 응답 생성 (bulk insert)
        INSERT INTO survey_responses (participant_token, question_id, response_value, response_text)
        SELECT 
            p.token,
            q.question_id,
            FLOOR(random() * 5 + 1)::INTEGER, -- 1-5 랜덤 점수
            NULL
        FROM (
            SELECT token
            FROM survey_participants
            WHERE survey_id = v_survey_id
            ORDER BY token
            LIMIT v_batch_size OFFSET v_offset
        ) p
        CROSS JOIN unnest(v_objective_questions) AS q(question_id)
        ON CONFLICT (participant_token, question_id) DO NOTHING;
        
        -- 주관식 응답 생성 (50% 확률, bulk insert)
        INSERT INTO survey_responses (participant_token, question_id, response_value, response_text)
        SELECT 
            p.token,
            q.question_id,
            NULL,
            CASE 
                WHEN random() < 0.5 THEN 
                    (ARRAY[
                        '서비스가 전반적으로 만족스러웠습니다.',
                        '직원분들이 매우 친절하셨습니다.',
                        '시설이 깨끗하고 쾌적했습니다.',
                        '대기 시간이 적절했습니다.',
                        '전문적인 상담을 받을 수 있었습니다.',
                        '다음에도 이용하고 싶습니다.',
                        '주변 사람들에게 추천하고 싶습니다.',
                        '개선이 필요한 부분이 있습니다.',
                        '전반적으로 좋은 경험이었습니다.',
                        '기대 이상의 서비스였습니다.'
                    ])[FLOOR(random() * 10 + 1)::INTEGER]
                ELSE NULL
            END
        FROM (
            SELECT token
            FROM survey_participants
            WHERE survey_id = v_survey_id
            ORDER BY token
            LIMIT v_batch_size OFFSET v_offset
        ) p
        CROSS JOIN unnest(v_subjective_questions) AS q(question_id)
        WHERE random() < 0.5 -- 50% 확률로 주관식 응답
        ON CONFLICT (participant_token, question_id) DO NOTHING;
        
        v_processed := v_processed + v_batch_size;
        v_offset := v_offset + v_batch_size;
        
        RAISE NOTICE '진행률: % / % (%.1f%%)', 
            LEAST(v_processed, v_total_participants), 
            v_total_participants,
            (LEAST(v_processed, v_total_participants)::FLOAT / v_total_participants * 100);
    END LOOP;
    
    RAISE NOTICE '응답 생성 완료!';
    
    -- 통계 출력
    RAISE NOTICE '=== 최종 통계 ===';
    RAISE NOTICE '총 응답 레코드 수: %', (
        SELECT COUNT(*) FROM survey_responses 
        WHERE participant_token IN (
            SELECT token FROM survey_participants WHERE survey_id = v_survey_id
        )
    );
    RAISE NOTICE '객관식 응답 수: %', (
        SELECT COUNT(*) FROM survey_responses 
        WHERE participant_token IN (
            SELECT token FROM survey_participants WHERE survey_id = v_survey_id
        ) AND response_value IS NOT NULL
    );
    RAISE NOTICE '주관식 응답 수: %', (
        SELECT COUNT(*) FROM survey_responses 
        WHERE participant_token IN (
            SELECT token FROM survey_participants WHERE survey_id = v_survey_id
        ) AND response_text IS NOT NULL
    );
    
END $$;
