-- 6. 주관식 응답내용
-- (문항번호, 병원명, 응답내용)

-- Added survey_id parameter at the top for easy modification
-- 사용법: 아래 survey_id 값을 실제 설문 ID로 변경하세요

SELECT 
    q.question_number AS "문항번호",
    p.hospital_name AS "병원명",
    r.response_text AS "응답내용",
    r.created_at AS "응답일시"
FROM 
    survey_responses r
    INNER JOIN survey_questions q ON r.question_id = q.id
    INNER JOIN survey_participants p ON r.participant_token = p.token
WHERE 
    q.question_type = 'subjective'
    AND r.response_text IS NOT NULL
    AND r.response_text != ''
    -- Added survey_id filter to prevent data mixing
    AND q.survey_id = 'YOUR_SURVEY_ID_HERE'  -- 이 값을 실제 설문 ID로 변경하세요
    AND p.survey_id = 'YOUR_SURVEY_ID_HERE'  -- 이 값을 실제 설문 ID로 변경하세요
ORDER BY 
    q.question_number, p.hospital_name, r.created_at;
