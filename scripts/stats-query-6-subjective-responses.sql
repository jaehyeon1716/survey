-- 6. 주관식 응답내용
-- (문항번호, 병원명, 응답내용)

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
    -- 특정 설문지로 필터링하려면 아래 주석을 해제하고 survey_id를 입력하세요
    -- AND q.survey_id = 1
ORDER BY 
    q.question_number, p.hospital_name, r.created_at;
