import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { randomBytes } from "crypto"

export const maxDuration = 300

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const surveyId = params.id

  try {
    const body = await request.json()
    const { participants, isFirstBatch } = body

    if (!participants || !Array.isArray(participants)) {
      return NextResponse.json({ error: "참여자 데이터가 필요합니다." }, { status: 400 })
    }

    if (participants.length === 0) {
      return NextResponse.json({ error: "참여자 데이터가 비어있습니다." }, { status: 400 })
    }

    if (isFirstBatch) {
      console.log("[v0] 첫 번째 배치: 기존 참여자 삭제 시작...")

      let allTokens: string[] = []
      let page = 0
      const pageSize = 1000

      while (true) {
        const { data: tokens, error: tokenError } = await supabase
          .from("survey_participants")
          .select("token")
          .eq("survey_id", Number.parseInt(surveyId))
          .range(page * pageSize, (page + 1) * pageSize - 1)

        if (tokenError) {
          console.error("[v0] 토큰 조회 오류:", tokenError)
          throw new Error(`토큰 조회 중 오류 발생: ${tokenError.message}`)
        }

        if (!tokens || tokens.length === 0) break

        allTokens = allTokens.concat(tokens.map((t) => t.token))
        console.log(`[v0] 토큰 조회 진행: ${allTokens.length}개`)

        if (tokens.length < pageSize) break
        page++
      }

      console.log(`[v0] 총 ${allTokens.length}개의 참여자 토큰 발견`)

      if (allTokens.length > 0) {
        const responseBatchSize = 1000
        for (let i = 0; i < allTokens.length; i += responseBatchSize) {
          const tokenBatch = allTokens.slice(i, i + responseBatchSize)
          const { error: responseError } = await supabase
            .from("survey_responses")
            .delete()
            .in("participant_token", tokenBatch)

          if (responseError) {
            console.error("[v0] 응답 삭제 오류:", responseError)
            throw new Error(`응답 삭제 중 오류 발생: ${responseError.message}`)
          }

          console.log(`[v0] 응답 삭제 진행: ${Math.min(i + responseBatchSize, allTokens.length)}/${allTokens.length}`)
        }

        for (let i = 0; i < allTokens.length; i += responseBatchSize) {
          const tokenBatch = allTokens.slice(i, i + responseBatchSize)
          const { error: participantError } = await supabase
            .from("survey_participants")
            .delete()
            .in("token", tokenBatch)

          if (participantError) {
            console.error("[v0] 참여자 삭제 오류:", participantError)
            throw new Error(`참여자 삭제 중 오류 발생: ${participantError.message}`)
          }

          console.log(`[v0] 참여자 삭제 진행: ${Math.min(i + responseBatchSize, allTokens.length)}/${allTokens.length}`)
        }
      }

      console.log(`[v0] 기존 참여자 삭제 완료: 총 ${allTokens.length}명`)
    }

    const participantsWithTokens = participants.map((p) => ({
      survey_id: Number.parseInt(surveyId),
      token: randomBytes(16).toString("hex"),
      jurisdiction: p.jurisdiction,
      institution_code: p.institution_code,
      institution_name: p.institution_name,
      category: p.category,
      name: p.name,
      age: p.age,
      gender: p.gender,
      mobile_phone: p.mobile_phone,
      inpatient_outpatient: p.inpatient_outpatient,
      qualification_type: p.qualification_type,
      hospital_name: p.hospital_name,
      participant_name: p.participant_name,
      phone_number: p.phone_number,
    }))

    const { error } = await supabase.from("survey_participants").insert(participantsWithTokens)

    if (error) {
      console.error("[v0] 삽입 오류:", error)
      throw new Error(`참여자 등록 중 오류 발생: ${error.message}`)
    }

    console.log(`[v0] ${participantsWithTokens.length}명 등록 완료`)

    return NextResponse.json({
      message: `${participantsWithTokens.length}명의 참여자가 등록되었습니다.`,
      count: participantsWithTokens.length,
    })
  } catch (error) {
    console.error("[v0] 참여자 등록 오류:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "참여자 등록 중 오류가 발생했습니다.",
      },
      { status: 500 },
    )
  }
}
