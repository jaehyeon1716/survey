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

      // Get all participant tokens in batches
      let allTokens: string[] = []
      let offset = 0
      const batchSize = 1000

      while (true) {
        const { data: tokens, error: tokenError } = await supabase
          .from("survey_participants")
          .select("token")
          .eq("survey_id", Number.parseInt(surveyId))
          .range(offset, offset + batchSize - 1)

        if (tokenError) {
          console.error("[v0] 토큰 조회 오류:", tokenError)
          throw new Error(`토큰 조회 중 오류 발생: ${tokenError.message}`)
        }

        if (!tokens || tokens.length === 0) break

        allTokens = allTokens.concat(tokens.map((t) => t.token))
        offset += batchSize

        if (tokens.length < batchSize) break
      }

      console.log(`[v0] 총 ${allTokens.length}개의 참여자 토큰 발견`)

      // Delete survey_responses in batches
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
      }

      // Delete survey_participants in batches
      let deletedCount = 0
      while (true) {
        const { data: deleted, error: deleteError } = await supabase
          .from("survey_participants")
          .delete()
          .eq("survey_id", Number.parseInt(surveyId))
          .limit(1000)
          .select("token")

        if (deleteError) {
          console.error("[v0] 참여자 삭제 오류:", deleteError)
          throw new Error(`참여자 삭제 중 오류 발생: ${deleteError.message}`)
        }

        if (!deleted || deleted.length === 0) break

        deletedCount += deleted.length
        console.log(`[v0] 참여자 삭제 진행: ${deletedCount}명`)

        if (deleted.length < 1000) break
      }

      console.log(`[v0] 기존 참여자 삭제 완료: 총 ${deletedCount}명`)
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
