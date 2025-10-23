# 데이터베이스 설정 스크립트

이 폴더의 스크립트는 **반드시 순서대로** 실행해야 합니다.

## 실행 순서

### 1️⃣ 01-create-initial-tables.sql
**목적**: 초기 데이터베이스 테이블 생성

**생성되는 테이블**:
- `surveys`: 설문지 정보
- `survey_questions`: 설문 문항
- `survey_participants`: 참여자 정보
- `survey_responses`: 응답 데이터

**실행 시점**: 새 데이터베이스 설정 시 가장 먼저 실행

---

### 2️⃣ 02-add-participant-fields.sql
**목적**: 참여자 테이블에 상세 정보 컬럼 추가

**추가되는 컬럼**:
- jurisdiction (관할)
- institution_code (기관기호)
- institution_name (기관명)
- category (종별)
- name (성명)
- age (나이)
- gender (성별)
- mobile_phone (휴대전화)
- inpatient_outpatient (입원/외래)
- qualification_type (자격유형)

**실행 시점**: 01번 스크립트 실행 후

---

### 3️⃣ 03-add-question-types.sql
**목적**: 문항 유형 구분 기능 추가

**추가되는 컬럼**:
- question_type (객관식/주관식 구분)

**실행 시점**: 02번 스크립트 실행 후

---

### 4️⃣ 04-add-response-scale-type.sql
**목적**: 응답 척도 유형 구분 기능 추가

**추가되는 컬럼**:
- response_scale_type (5점 척도 등)

**실행 시점**: 03번 스크립트 실행 후

---

### 5️⃣ 05-fix-subjective-constraint.sql
**목적**: 주관식 문항의 제약조건 수정

**변경 내용**:
- response_value를 NULL 허용으로 변경 (주관식 문항은 숫자 응답이 없음)

**실행 시점**: 04번 스크립트 실행 후

---

## ⚠️ 중요 사항

1. **순서 준수**: 반드시 01 → 02 → 03 → 04 → 05 순서로 실행
2. **중복 실행 금지**: 이미 실행한 스크립트를 다시 실행하면 오류 발생
3. **오류 확인**: 각 스크립트 실행 후 오류 메시지 확인
4. **백업**: 프로덕션 환경에서는 실행 전 데이터베이스 백업 권장
